/**
 * Sync API — bidirectional synchronization between GitHub/local markdown,
 * Featurebase, and generated agent rollups.
 *
 * On Vercel: reads existing articles from GitHub repo API, updates
 * Featurebase when local articles are newer, and commits any repo/rollup
 * changes back through the Git Data API.
 *
 * Locally: reads/writes files directly on disk and updates Featurebase with
 * the same decision logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { commitFiles, buildRepoPath, fetchRepoArticles } from '@/lib/github-sync';
import { generateLlmsTxt, generateDocsRollup } from '@/lib/generate-rollups';
import matter from 'gray-matter';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300;

type LocalArticle = {
  path: string;
  content: string;
  frontmatter: Record<string, any>;
};

type RollupArticle = {
  title: string;
  slug: string;
  category: string;
  content: string;
  last_updated?: string;
  id?: string;
};

type FileChange = { path: string; content: string };

type PlannedAction =
  | {
      kind: 'pull' | 'create-local';
      id: string;
      title: string;
      path: string;
      fileContent: string;
      rollupArticle: RollupArticle;
    }
  | {
      kind: 'push';
      id: string;
      title: string;
      local: LocalArticle;
      frontmatter: Record<string, any>;
      rollupArticle: RollupArticle;
    };

const getClient = async () => {
  const mod = await import('@/lib/featurebase-client.js');
  return mod.FeaturebaseClient;
};

const getSync = async (): Promise<any> => {
  const mod = await import('@/lib/featurebase-sync.js');
  return mod;
};

const getHierarchy = async () => {
  const mod = await import('@/lib/collection-hierarchy.js');
  return mod.COLLECTION_HIERARCHY;
};

const isVercel = !!process.env.VERCEL;
const CONFLICT_WINDOW_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 1000;

/**
 * Normalize content before hashing so transient Featurebase attachment
 * signatures don't produce false sync diffs.
 */
function normalizeContent(content: string): string {
  return String(content || '')
    .replace(/\?X-Amz-[^)\s\]]*/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(normalizeContent(content)).digest('hex');
}

function toMs(value: unknown): number {
  if (!value) return 0;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function remoteUpdatedAt(remoteArticle: any): string {
  return remoteArticle.updatedAt || remoteArticle.updated_at || new Date().toISOString();
}

function changedAfter(value: unknown, baseline: unknown): boolean {
  const valueMs = toMs(value);
  const baselineMs = toMs(baseline);
  return valueMs > 0 && baselineMs > 0 && valueMs > baselineMs + CLOCK_SKEW_MS;
}

function chooseDirection(local: LocalArticle, remoteArticle: any): 'push' | 'pull' | 'conflict' {
  const syncedAt = local.frontmatter.synced_at;
  const localUpdated = local.frontmatter.last_updated;
  const remoteUpdated = remoteUpdatedAt(remoteArticle);

  const localDirty = syncedAt
    ? changedAfter(localUpdated, syncedAt)
    : toMs(localUpdated) >= toMs(remoteUpdated);
  const remoteDirty = syncedAt
    ? changedAfter(remoteUpdated, syncedAt)
    : toMs(remoteUpdated) > toMs(localUpdated);

  if (localDirty && remoteDirty) {
    const delta = toMs(localUpdated) - toMs(remoteUpdated);
    if (Math.abs(delta) <= CONFLICT_WINDOW_MS) {
      return 'conflict';
    }
    return delta > 0 ? 'push' : 'pull';
  }

  if (localDirty) return 'push';
  if (remoteDirty) return 'pull';

  // Content differs but neither side advertises a clean dirty timestamp.
  // Prefer the side with the newer explicit update time, defaulting to remote.
  return toMs(localUpdated) > toMs(remoteUpdated) + CLOCK_SKEW_MS ? 'push' : 'pull';
}

function collectionNameFor(remoteArticle: any, collectionMap: Record<string, string>): string {
  return remoteArticle.parentId
    ? collectionMap[remoteArticle.parentId] || 'Uncategorized'
    : 'Uncategorized';
}

function remoteToFileContent(sync: any, remoteArticle: any, collectionName: string, existing?: LocalArticle) {
  const markdown = sync.extractArticleContent(remoteArticle);
  const syncedAt = new Date().toISOString();
  const frontmatter = {
    ...(existing?.frontmatter || {}),
    title: remoteArticle.title,
    slug: remoteArticle.slug,
    category: remoteArticle.parentId || '',
    collection_name: collectionName,
    featurebase_id: String(remoteArticle.id),
    last_updated: remoteUpdatedAt(remoteArticle),
    synced_at: syncedAt,
    source: 'featurebase',
  };

  return {
    markdown,
    fileContent: matter.stringify(markdown, frontmatter),
    rollupArticle: {
      title: remoteArticle.title,
      slug: remoteArticle.slug,
      category: remoteArticle.parentId || '',
      content: markdown,
      last_updated: remoteUpdatedAt(remoteArticle),
      id: String(remoteArticle.id),
    } satisfies RollupArticle,
  };
}

function localToRollupArticle(id: string, local: LocalArticle, frontmatter = local.frontmatter): RollupArticle {
  return {
    title: frontmatter.title || 'Untitled',
    slug: frontmatter.slug || '',
    category: frontmatter.category || '',
    content: local.content,
    last_updated: frontmatter.last_updated,
    id,
  };
}

async function writeLocalFiles(files: FileChange[]) {
  for (const file of files) {
    const fullPath = path.resolve(file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
  }
}

export async function POST() {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.FEATUREBASE_API_KEY;
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;

  if (!apiKey || !helpCenterId) {
    return NextResponse.json(
      { success: false, error: 'Featurebase API not configured' },
      { status: 500 }
    );
  }

  try {
    const FeaturebaseClient = await getClient();
    const sync = await getSync();
    const hierarchy = await getHierarchy();
    const client = new FeaturebaseClient(apiKey);

    const testResult = await client.testConnection();
    if (!testResult.success) {
      return NextResponse.json(
        { success: false, error: `Featurebase connection failed: ${testResult.error}` },
        { status: 500 }
      );
    }

    const collectionsResponse = await client.getCollections({
      help_center_id: helpCenterId,
      limit: 100,
    });
    const collections = collectionsResponse?.data || [];
    const collectionMap: Record<string, string> = {};
    collections.forEach((col: any) => {
      collectionMap[String(col.id)] = col.name || col.translations?.en?.name || 'Uncategorized';
    });

    const remoteResponse = await client.getArticles({
      help_center_id: helpCenterId,
      limit: 100,
    });
    const remoteArticles = remoteResponse?.data || [];
    const remoteById = new Map<string, any>();
    remoteArticles.forEach((article: any) => remoteById.set(String(article.id), article));

    let localById: Map<string, LocalArticle>;

    if (isVercel) {
      if (!process.env.GITHUB_TOKEN) {
        return NextResponse.json(
          { success: false, error: 'GITHUB_TOKEN not configured' },
          { status: 500 }
        );
      }
      localById = await fetchRepoArticles();
    } else {
      localById = new Map();
      const localArticles = await sync.scanLocalArticles();
      for (const article of localArticles) {
        localById.set(String(article.id), {
          path: article.path,
          content: article.content,
          frontmatter: article.frontmatter,
        });
      }
    }

    const results = {
      pushed: 0,
      pulled: 0,
      created: 0,
      matched: 0,
      conflicts: [] as Array<{
        id: string;
        title: string;
        local_updated?: string;
        remote_updated?: string;
      }>,
      errors: [] as string[],
      details: [] as string[],
    };

    const planned: PlannedAction[] = [];
    const rollupById = new Map<string, RollupArticle>();

    for (const remoteArticle of remoteArticles) {
      const id = String(remoteArticle.id);
      const collectionName = collectionNameFor(remoteArticle, collectionMap);
      const remoteMarkdown = sync.extractArticleContent(remoteArticle);
      const remoteHash = hashContent(remoteMarkdown);
      const local = localById.get(id);

      if (!local) {
        const repoPath = buildRepoPath(hierarchy, remoteArticle.parentId, remoteArticle.title);
        const remoteFile = remoteToFileContent(sync, remoteArticle, collectionName);
        planned.push({
          kind: 'create-local',
          id,
          title: remoteArticle.title,
          path: repoPath,
          fileContent: remoteFile.fileContent,
          rollupArticle: remoteFile.rollupArticle,
        });
        continue;
      }

      const localHash = hashContent(local.content);

      if (remoteHash === localHash) {
        results.matched++;
        rollupById.set(id, localToRollupArticle(id, local));
        continue;
      }

      const direction = chooseDirection(local, remoteArticle);
      if (direction === 'conflict') {
        results.conflicts.push({
          id,
          title: local.frontmatter.title || remoteArticle.title,
          local_updated: local.frontmatter.last_updated,
          remote_updated: remoteUpdatedAt(remoteArticle),
        });
        continue;
      }

      if (direction === 'push') {
        const syncedAt = new Date().toISOString();
        const frontmatter: Record<string, any> = {
          ...local.frontmatter,
          last_updated: local.frontmatter.last_updated || syncedAt,
          synced_at: syncedAt,
          source: 'featurebase',
        };
        planned.push({
          kind: 'push',
          id,
          title: frontmatter.title || remoteArticle.title,
          local,
          frontmatter,
          rollupArticle: localToRollupArticle(id, local, frontmatter),
        });
      } else {
        const remoteFile = remoteToFileContent(sync, remoteArticle, collectionName, local);
        planned.push({
          kind: 'pull',
          id,
          title: remoteArticle.title,
          path: local.path,
          fileContent: remoteFile.fileContent,
          rollupArticle: remoteFile.rollupArticle,
        });
      }
    }

    for (const [id, local] of localById) {
      if (!remoteById.has(id)) {
        rollupById.set(id, localToRollupArticle(id, local));
        results.details.push(`Local-only article not in Featurebase: ${local.frontmatter.title || id}`);
      }
    }

    if (results.conflicts.length > 0) {
      results.conflicts.forEach((conflict) => {
        results.details.push(
          `Conflict: ${conflict.title} (local ${conflict.local_updated || 'unknown'} vs Featurebase ${conflict.remote_updated || 'unknown'})`
        );
      });

      return NextResponse.json(
        {
          success: false,
          error: `${results.conflicts.length} article conflict(s) need review. No changes were applied.`,
          results,
          remoteCount: remoteArticles.length,
          localCount: localById.size,
        },
        { status: 409 }
      );
    }

    const filesToCommit: FileChange[] = [];

    for (const action of planned) {
      try {
        if (action.kind === 'push') {
          await client.updateArticle(action.id, {
            title: action.title,
            body: action.local.content,
            formatter: 'ai',
            state: 'live',
          });
          filesToCommit.push({
            path: action.local.path,
            content: matter.stringify(action.local.content, action.frontmatter),
          });
          rollupById.set(action.id, action.rollupArticle);
          results.pushed++;
          results.details.push(`Pushed local changes to Featurebase: ${action.title}`);
        } else {
          filesToCommit.push({ path: action.path, content: action.fileContent });
          rollupById.set(action.id, action.rollupArticle);
          if (action.kind === 'create-local') {
            results.created++;
            results.details.push(`Created local article from Featurebase: ${action.title}`);
          } else {
            results.pulled++;
            results.details.push(`Pulled Featurebase changes: ${action.title}`);
          }
        }
      } catch (error) {
        results.errors.push(`${action.title}: ${(error as Error).message}`);
      }
    }

    if (results.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Sync hit ${results.errors.length} error(s).`,
          results,
          remoteCount: remoteArticles.length,
          localCount: localById.size,
        },
        { status: 500 }
      );
    }

    if (filesToCommit.length === 0) {
      return NextResponse.json({
        success: true,
        message: `All ${results.matched} articles are in sync. No changes needed.`,
        results,
        remoteCount: remoteArticles.length,
        localCount: localById.size,
      });
    }

    const allArticles = Array.from(rollupById.values());
    const llmsTxt = generateLlmsTxt(allArticles);
    const docsRollup = generateDocsRollup(allArticles);
    filesToCommit.push({ path: 'llms.txt', content: llmsTxt });
    filesToCommit.push({ path: 'docs-rollup.md', content: docsRollup });
    results.details.push('Regenerated llms.txt and docs-rollup.md');

    const summary = [
      results.pushed ? `${results.pushed} pushed` : '',
      results.pulled ? `${results.pulled} pulled` : '',
      results.created ? `${results.created} new` : '',
    ].filter(Boolean).join(', ');

    if (isVercel) {
      const commit = await commitFiles(
        filesToCommit,
        `Sync ${summary || 'documentation'} across Featurebase and rollups`
      );

      return NextResponse.json({
        success: true,
        message: `Synced ${summary || 'documentation'}. Committed rollups and article state to GitHub.`,
        results,
        commit: commit.url,
        remoteCount: remoteArticles.length,
        localCount: localById.size,
      });
    }

    await writeLocalFiles(filesToCommit);
    const syncState = await sync.loadSyncState();
    syncState.last_sync = new Date().toISOString();
    await sync.saveSyncState(syncState);

    return NextResponse.json({
      success: true,
      message: `Synced ${summary || 'documentation'} locally.`,
      results,
      remoteCount: remoteArticles.length,
      localCount: localById.size,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
