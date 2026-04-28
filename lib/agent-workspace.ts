/**
 * Agent Workspace — materializes the documentation repo into /tmp so the
 * Claude Agent SDK can use its native Read/Edit/Write/Glob/Grep tools.
 *
 * Lifecycle (per chat turn):
 *   1. materializeWorkspace()  — pulls latest articles from GitHub into /tmp/<sessionId>
 *   2. agent runs, mutating files in cwd
 *   3. diffWorkspace()         — compares against the materialization snapshot
 *   4. commitWorkspaceChanges()— commits added/modified files back to GitHub
 *   5. cleanupWorkspace()      — removes the /tmp directory
 *
 * On Vercel, /tmp is per-invocation, so the lifecycle re-runs each chat turn.
 * On localhost, the same flow works without changes.
 */

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import { commitFiles } from './github-sync';

const REPO_OWNER = 'sudowrite';
const REPO_NAME = 'docs-control';
const BRANCH = 'main';
const DOCS_PREFIX = 'sudowrite-documentation';
const WORKSPACE_ROOT = '/tmp/docs-control';

export interface WorkspaceManifest {
  /** Absolute path to the workspace directory (use as `cwd` for the agent). */
  cwd: string;
  /** Commit SHA at the time of materialization — used for conflict detection on commit. */
  baseSha: string;
  /** Map of repo-relative path → sha256 of original content. */
  files: Record<string, string>;
}

export interface WorkspaceDiff {
  modified: { path: string; content: string }[];
  added: { path: string; content: string }[];
  deleted: string[];
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return new Octokit({ auth: token });
}

/**
 * Pull all markdown articles from GitHub into a fresh /tmp workspace.
 * Returns a manifest the diff step uses to detect changes.
 */
export async function materializeWorkspace(sessionId: string): Promise<WorkspaceManifest> {
  const cwd = path.join(WORKSPACE_ROOT, sessionId);
  await fs.mkdir(cwd, { recursive: true });

  const octokit = getOctokit();

  const { data: ref } = await octokit.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${BRANCH}`,
  });
  const baseSha = ref.object.sha;

  const { data: tree } = await octokit.git.getTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    tree_sha: baseSha,
    recursive: 'true',
  });

  const mdFiles = tree.tree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path?.startsWith(`${DOCS_PREFIX}/`) &&
      item.path?.endsWith('.md') &&
      !item.path?.includes('/.') &&
      !item.path?.endsWith('INDEX.md')
  );

  const manifest: WorkspaceManifest = { cwd, baseSha, files: {} };

  // Materialize in parallel batches of 10 to keep the GitHub API happy
  const batchSize = 10;
  for (let i = 0; i < mdFiles.length; i += batchSize) {
    const batch = mdFiles.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (file) => {
        if (!file.path || !file.sha) return;
        const { data: blob } = await octokit.git.getBlob({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          file_sha: file.sha,
        });
        const content = Buffer.from(blob.content, 'base64').toString('utf-8');
        const fullPath = path.join(cwd, file.path);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
        manifest.files[file.path] = sha256(content);
      })
    );
  }

  // Drop a lightweight INDEX so the agent can quickly understand the layout
  // without grepping every article.
  const index = mdFiles
    .filter((f) => f.path)
    .map((f) => f.path!)
    .sort()
    .join('\n');
  await fs.writeFile(path.join(cwd, 'INDEX.txt'), index, 'utf-8');

  return manifest;
}

/**
 * Walk a directory recursively, returning absolute file paths.
 */
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Compare the workspace's current state against the manifest snapshot.
 * Only considers files under sudowrite-documentation/ — agent scratch files
 * elsewhere in the workspace are ignored.
 */
export async function diffWorkspace(manifest: WorkspaceManifest): Promise<WorkspaceDiff> {
  const diff: WorkspaceDiff = { modified: [], added: [], deleted: [] };
  const docsRoot = path.join(manifest.cwd, DOCS_PREFIX);

  let allFiles: string[] = [];
  try {
    allFiles = await walk(docsRoot);
  } catch {
    // No docs directory at all — treat everything as deleted
    diff.deleted = Object.keys(manifest.files);
    return diff;
  }

  const seen = new Set<string>();

  for (const fullPath of allFiles) {
    const relPath = path.relative(manifest.cwd, fullPath);
    if (!relPath.endsWith('.md')) continue;

    const content = await fs.readFile(fullPath, 'utf-8');
    const hash = sha256(content);
    seen.add(relPath);

    const originalHash = manifest.files[relPath];
    if (!originalHash) {
      diff.added.push({ path: relPath, content });
    } else if (originalHash !== hash) {
      diff.modified.push({ path: relPath, content });
    }
  }

  for (const knownPath of Object.keys(manifest.files)) {
    if (!seen.has(knownPath)) diff.deleted.push(knownPath);
  }

  return diff;
}

/**
 * Commit the workspace's diff back to GitHub as a single commit.
 * Returns null if there's nothing to commit.
 *
 * Note: deletions are not committed yet — github-sync.commitFiles only handles
 * adds/updates. Add a deletion path here when needed.
 */
export async function commitWorkspaceChanges(
  diff: WorkspaceDiff,
  message: string
): Promise<{ sha: string; url: string } | null> {
  const files = [...diff.modified, ...diff.added];
  if (files.length === 0 && diff.deleted.length === 0) return null;

  if (diff.deleted.length > 0) {
    console.warn(
      `[agent-workspace] ${diff.deleted.length} deletions detected but not committed (not yet supported): ${diff.deleted.join(', ')}`
    );
  }

  if (files.length === 0) return null;
  return commitFiles(files, message);
}

/**
 * Remove the workspace directory. Best-effort — failures are swallowed.
 */
export async function cleanupWorkspace(cwd: string): Promise<void> {
  try {
    await fs.rm(cwd, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
