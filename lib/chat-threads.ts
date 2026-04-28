/**
 * Chat Threads — persistence for agent conversations.
 *
 * Threads are stored as JSON in the repo at `data/chats/<threadId>.json` so
 * they survive Vercel's stateless invocations and inherit git history for free.
 * Mirrors the storage pattern in lib/history.ts.
 */

import { Octokit } from '@octokit/rest';
import { commitFiles } from './github-sync';

const REPO_OWNER = 'sudowrite';
const REPO_NAME = 'docs-control';
const BRANCH = 'main';
const CHATS_DIR = 'data/chats';

/** A single rendered message in the chat UI. */
export interface ChatMessage {
  /** Stable id (uuid). */
  id: string;
  role: 'user' | 'assistant' | 'tool';
  /** Plain-text content. For tool messages, this is a summary. */
  text: string;
  /** Optional structured tool-call info (rendered as a card). */
  toolCall?: {
    name: string;
    input: unknown;
    result?: string;
    isError?: boolean;
  };
  /** ISO timestamp. */
  createdAt: string;
}

export interface ChatThread {
  id: string;
  title: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  /** Messages rendered in the UI, in chronological order. */
  messages: ChatMessage[];
  /** Cumulative cost in USD across all turns. */
  totalCostUsd?: number;
}

export interface ChatThreadSummary {
  id: string;
  title: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return new Octokit({ auth: token });
}

function threadPath(id: string): string {
  return `${CHATS_DIR}/${id}.json`;
}

/**
 * Generate a short, deterministic thread title from the first user message.
 */
export function generateThreadTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 60) return trimmed || 'New chat';
  return trimmed.slice(0, 57) + '...';
}

/**
 * Load a single thread by id. Returns null if not found.
 */
export async function loadThread(id: string): Promise<ChatThread | null> {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: threadPath(id),
      ref: BRANCH,
    });
    if ('content' in data && data.content) {
      const raw = Buffer.from(data.content, 'base64').toString('utf-8');
      return JSON.parse(raw) as ChatThread;
    }
    return null;
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/**
 * Save (create or overwrite) a thread.
 */
export async function saveThread(thread: ChatThread): Promise<void> {
  const updated: ChatThread = { ...thread, updatedAt: new Date().toISOString() };
  await commitFiles(
    [{ path: threadPath(updated.id), content: JSON.stringify(updated, null, 2) }],
    `chat: update thread ${updated.id} (${updated.messages.length} msgs)`
  );
}

/**
 * List all threads (summaries only — full message bodies are not loaded).
 * Sorted by updatedAt desc.
 */
export async function listThreads(): Promise<ChatThreadSummary[]> {
  const octokit = getOctokit();
  try {
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

    const chatFiles = tree.tree.filter(
      (t) =>
        t.type === 'blob' &&
        t.path?.startsWith(CHATS_DIR + '/') &&
        t.path?.endsWith('.json')
    );

    const summaries: ChatThreadSummary[] = [];
    for (const file of chatFiles) {
      if (!file.sha) continue;
      try {
        const { data: blob } = await octokit.git.getBlob({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          file_sha: file.sha,
        });
        const raw = Buffer.from(blob.content, 'base64').toString('utf-8');
        const thread = JSON.parse(raw) as ChatThread;
        summaries.push({
          id: thread.id,
          title: thread.title,
          user: thread.user,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          messageCount: thread.messages.length,
        });
      } catch {
        // skip unparseable
      }
    }

    return summaries.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * Delete a thread.
 */
export async function deleteThread(id: string): Promise<void> {
  const octokit = getOctokit();
  try {
    // Need the file's blob sha to delete via Contents API
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: threadPath(id),
      ref: BRANCH,
    });
    if (!('sha' in data)) throw new Error('Thread file metadata missing');
    await octokit.repos.deleteFile({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: threadPath(id),
      message: `chat: delete thread ${id}`,
      sha: data.sha,
      branch: BRANCH,
    });
  } catch (err: any) {
    if (err?.status === 404) return; // already gone, fine
    throw err;
  }
}

/**
 * Build a new empty thread.
 */
export function newThread(user: string): ChatThread {
  const now = new Date().toISOString();
  // Use crypto.randomUUID if available, fall back to a simple unique id
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    title: 'New chat',
    user,
    createdAt: now,
    updatedAt: now,
    messages: [],
    totalCostUsd: 0,
  };
}
