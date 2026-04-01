/**
 * History — stores analysis and proposal records in the GitHub repo.
 *
 * Records are stored as JSON in data/history/ directory.
 * On Vercel, we read via GitHub API and write via commit API.
 */

import { Octokit } from '@octokit/rest';
import type { EditProposal } from './improve-agent';

const REPO_OWNER = 'mcstew';
const REPO_NAME = 'sw-docs-control';
const BRANCH = 'main';
const HISTORY_DIR = 'data/history';

export interface AnalysisRecord {
  id: string;
  type: 'improve' | 'audit';
  timestamp: string;
  user: string;
  input: {
    format?: string;
    itemCount?: number;
    changelogTitle?: string;
    preview?: string; // first 200 chars of input
  };
  output: {
    summary: string;
    proposalCount: number;
    proposals: {
      id: string;
      articleTitle: string;
      editType: string;
      confidence: string;
      status: string;
      reasoning: string;
    }[];
  };
}

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return new Octokit({ auth: token });
}

/**
 * Save an analysis record to the repo.
 */
export async function saveAnalysisRecord(record: AnalysisRecord): Promise<void> {
  const octokit = getOctokit();
  const filename = `${record.type}-${record.id}.json`;
  const path = `${HISTORY_DIR}/${filename}`;

  try {
    // Get current HEAD
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
    });

    const { data: commit } = await octokit.git.getCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      commit_sha: ref.object.sha,
    });

    // Create blob
    const { data: blob } = await octokit.git.createBlob({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      content: Buffer.from(JSON.stringify(record, null, 2)).toString('base64'),
      encoding: 'base64',
    });

    // Create tree
    const { data: tree } = await octokit.git.createTree({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      base_tree: commit.tree.sha,
      tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }],
    });

    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      message: `Save ${record.type} history: ${record.id}`,
      tree: tree.sha,
      parents: [ref.object.sha],
    });

    // Update ref
    await octokit.git.updateRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
      sha: newCommit.sha,
    });
  } catch (err) {
    console.error('Failed to save history record:', err);
    // Non-fatal — history is best-effort
  }
}

/**
 * Update a proposal's status within a history record.
 */
export async function updateProposalInHistory(
  analysisId: string,
  proposalId: string,
  status: string
): Promise<void> {
  const records = await getHistory();
  const record = records.find((r) => r.id === analysisId);
  if (!record) return;

  const proposal = record.output.proposals.find((p) => p.id === proposalId);
  if (!proposal) return;

  proposal.status = status;
  await saveAnalysisRecord(record);
}

/**
 * Fetch all history records from the repo.
 */
export async function getHistory(type?: 'improve' | 'audit'): Promise<AnalysisRecord[]> {
  const octokit = getOctokit();

  try {
    // Get the tree for data/history/
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`,
    });

    const { data: tree } = await octokit.git.getTree({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      tree_sha: ref.object.sha,
      recursive: 'true',
    });

    const historyFiles = tree.tree.filter(
      (item) =>
        item.type === 'blob' &&
        item.path?.startsWith(HISTORY_DIR + '/') &&
        item.path?.endsWith('.json') &&
        (!type || item.path?.includes(`${type}-`))
    );

    const records: AnalysisRecord[] = [];

    for (const file of historyFiles) {
      if (!file.sha) continue;
      try {
        const { data: blob } = await octokit.git.getBlob({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          file_sha: file.sha,
        });
        const content = Buffer.from(blob.content, 'base64').toString('utf-8');
        records.push(JSON.parse(content));
      } catch {
        // Skip unparseable files
      }
    }

    // Sort newest first
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}
