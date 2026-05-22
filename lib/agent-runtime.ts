/**
 * Agent Runtime — bare Anthropic SDK with streaming + tool use.
 *
 * Chat-first: every turn is a streaming Claude call. Tools run when the
 * model asks for them; otherwise the agent just chats. Subagents are
 * spawned via the `spawn_subagent` tool, which makes a focused, non-streamed
 * Claude call with a tighter prompt + a smaller toolset.
 *
 * No /tmp materialization: file ops go through the GitHub API directly,
 * with an in-memory cache loaded once per turn.
 */

import Anthropic from '@anthropic-ai/sdk';
import matter from 'gray-matter';
import {
  fetchRepoArticles,
  commitFiles,
  buildRepoPath,
} from './github-sync';
import { generateLlmsTxt, generateDocsRollup } from './generate-rollups';
import { COLLECTION_HIERARCHY } from './collection-hierarchy.js';

const MODEL = 'claude-sonnet-4-5';
const MAX_TOOL_ITERATIONS = 20;
const SUBAGENT_MODEL = 'claude-haiku-4-5';

const FB_BASE_URL = 'https://do.featurebase.app';
const FB_API_VERSION = '2026-01-01.nova';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'list_articles',
    description:
      'List every documentation article in the local repo with its title, slug, collection, and path. Use this first when the user asks broad questions about the docs.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_article',
    description:
      'Read the full body of one article. Pass the article slug (preferred) or part of the title.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Article slug or title fragment' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'search_articles',
    description:
      'Keyword search across all article bodies. Returns matching articles with snippets. Case-insensitive.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search for' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'edit_article',
    description:
      'Stage an edit to an article by replacing exact `original` text with `replacement`. Edits are batched in memory until you call `commit_pending_edits`. Pass the article slug.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Article slug' },
        original: {
          type: 'string',
          description:
            'Exact text in the article body to replace (must appear verbatim, including whitespace)',
        },
        replacement: { type: 'string', description: 'Text to insert in place' },
        reasoning: {
          type: 'string',
          description: 'Brief note on why this change is needed',
        },
      },
      required: ['slug', 'original', 'replacement', 'reasoning'],
    },
  },
  {
    name: 'create_article',
    description:
      'Create a brand-new documentation article from a drafted markdown body. Use this after reading a changelog, announcement, or other source when the right outcome is a new docs article rather than editing an existing one. This publishes the article live to Featurebase, writes the matching markdown file with Featurebase metadata, regenerates llms.txt/docs-rollup.md, and commits the full bundle to GitHub. You must pass either collection_id or collection_name.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Article title' },
        body: {
          type: 'string',
          description: 'Full article body in markdown, without YAML frontmatter',
        },
        collection_id: {
          type: 'string',
          description:
            'Featurebase collection id. Prefer this when known; otherwise pass collection_name.',
        },
        collection_name: {
          type: 'string',
          description:
            'Featurebase collection name, such as Features, Story Bible, Story Smarts, FAQ, Credits, etc.',
        },
        slug: {
          type: 'string',
          description:
            'Optional preferred slug. Usually omit this and let Featurebase assign the canonical slug.',
        },
        source_url: {
          type: 'string',
          description:
            'Optional source URL, such as the changelog post this article was derived from.',
        },
        commit_message: {
          type: 'string',
          description: 'Optional commit message. Defaults to a concise article creation message.',
        },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'commit_pending_edits',
    description:
      'Publish all staged article edits: push them to Featurebase when configured, regenerate llms.txt and docs-rollup.md, then commit the article and rollup changes to GitHub as a single commit. Returns the commit URL. No-op if nothing is staged.',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit message describing what changed and why',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'featurebase_list_articles',
    description:
      'List all articles currently published in the Featurebase help center (live state). Each item has id, title, slug, parentId, updatedAt.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'featurebase_get_article',
    description:
      'Fetch the full live article from Featurebase by id. Use to compare what is published vs. the local repo.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Featurebase article id' },
      },
      required: ['id'],
    },
  },
  {
    name: 'featurebase_update_article',
    description:
      'Push an updated article body to Featurebase. The body must be markdown. Prefer edit_article + commit_pending_edits for repo-backed docs changes so Featurebase, markdown, and rollups stay in sync.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Featurebase article id' },
        title: { type: 'string' },
        body: { type: 'string', description: 'Full article body, markdown' },
      },
      required: ['id', 'title', 'body'],
    },
  },
  {
    name: 'run_changelog_audit',
    description:
      "Run the two-stage AI audit (keyword filter + Claude deep dive) against a changelog entry. Returns the list of articles that contradict or miss information from the changelog. Use when the user wants to verify documentation against a specific product change.",
    input_schema: {
      type: 'object',
      properties: {
        changelog_text: {
          type: 'string',
          description: 'Full text of the changelog entry to audit against',
        },
      },
      required: ['changelog_text'],
    },
  },
  {
    name: 'web_fetch',
    description:
      'Fetch a URL and return its text content. Useful for reading external pages, changelogs, blog posts, etc. that the user references.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute https:// URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'spawn_subagent',
    description:
      'Spin up a focused subagent to handle one chunk of a larger task in parallel. Pass a clear, self-contained `task` description and (optionally) a list of article slugs the subagent should focus on. The subagent has read-only tools (read_article, search_articles, web_fetch) and returns a text summary. Use for big tasks like "for each of these 12 articles, summarize key claims" — call multiple times in one turn for parallel exploration.',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Self-contained task for the subagent to perform' },
        focus_slugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of article slugs to focus on',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'notion_search',
    description:
      'Search Notion for a query. (Stub — Notion integration not yet wired up. Returns a not-configured message.)',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
];

const SUBAGENT_TOOLS: Anthropic.Messages.Tool[] = TOOLS.filter((t) =>
  ['list_articles', 'read_article', 'search_articles', 'web_fetch'].includes(t.name)
);

// ---------------------------------------------------------------------------
// Per-turn state — articles cached in memory, edits staged
// ---------------------------------------------------------------------------

interface CachedArticle {
  id: string;
  title: string;
  slug: string;
  collection: string;
  path: string;
  frontmatter: any;
  /** Current body (may include staged edits). */
  body: string;
  /** Original body, for the GitHub commit (frontmatter is preserved on commit). */
  originalBody: string;
  dirty: boolean;
}

export interface AgentRuntime {
  anthropic: Anthropic;
  articles: Map<string, CachedArticle>; // keyed by slug
  byId: Map<string, CachedArticle>;
  byPath: Map<string, CachedArticle>;
  /** Surface tool execution detail to the SSE stream. */
  emit: AgentEmitter;
}

export interface AgentEmitter {
  text(text: string): void;
  toolStart(call: { id: string; name: string; input: unknown }): void;
  toolResult(result: { id: string; text: string; isError: boolean }): void;
  status(message: string): void;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type ToolHandler = (input: any, rt: AgentRuntime) => Promise<string>;

const findArticle = (rt: AgentRuntime, slugOrTitle: string): CachedArticle | null => {
  const needle = slugOrTitle.toLowerCase().trim();
  const direct = rt.articles.get(needle);
  if (direct) return direct;
  for (const a of rt.articles.values()) {
    if (a.slug?.toLowerCase() === needle) return a;
    if (a.title?.toLowerCase() === needle) return a;
  }
  for (const a of rt.articles.values()) {
    if (a.title?.toLowerCase().includes(needle) || a.slug?.toLowerCase().includes(needle)) {
      return a;
    }
  }
  return null;
};

const ok = (text: string) => text;
const err = (text: string) => `ERROR: ${text}`;

async function publishArticleToFeaturebase(article: CachedArticle): Promise<string | null> {
  const apiKey = process.env.FEATUREBASE_API_KEY;
  if (!apiKey) return 'FEATUREBASE_API_KEY not configured';

  const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${article.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Featurebase-Version': FB_API_VERSION,
    },
    body: JSON.stringify({ title: article.title, body: article.body, formatter: 'ai', state: 'live' }),
  });

  if (!res.ok) {
    return `Featurebase ${res.status}: ${await res.text()}`;
  }

  return null;
}

function rollupArticlesFromRuntime(rt: AgentRuntime) {
  return [...rt.articles.values()].map((a) => ({
    title: a.title,
    slug: a.slug,
    category: a.frontmatter.category || '',
    content: a.body,
    last_updated: a.frontmatter.last_updated,
    id: a.id,
  }));
}

function slugifyTitle(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function normalizeLookup(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueRepoPath(basePath: string, rt: AgentRuntime): string {
  if (!rt.byPath.has(basePath)) return basePath;

  let index = 2;
  let candidate = basePath;
  while (rt.byPath.has(candidate)) {
    candidate = basePath.replace(/\.md$/, `-${index}.md`);
    index += 1;
  }
  return candidate;
}

function addArticleToRuntime(rt: AgentRuntime, article: CachedArticle) {
  if (article.slug) rt.articles.set(article.slug.toLowerCase(), article);
  rt.byId.set(article.id, article);
  rt.byPath.set(article.path, article);
}

function removeArticleFromRuntime(rt: AgentRuntime, article: CachedArticle) {
  if (article.slug) rt.articles.delete(article.slug.toLowerCase());
  rt.byId.delete(article.id);
  rt.byPath.delete(article.path);
}

type FeaturebaseCollectionRef = { id: string; name: string };

function runtimeCollections(rt: AgentRuntime): FeaturebaseCollectionRef[] {
  const byId = new Map<string, FeaturebaseCollectionRef>();
  for (const article of rt.articles.values()) {
    const id = String(article.frontmatter.category || '').trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      name: article.collection || article.frontmatter.collection_name || id,
    });
  }
  return [...byId.values()];
}

async function fetchFeaturebaseCollections(
  apiKey: string,
  helpCenterId: string
): Promise<FeaturebaseCollectionRef[]> {
  const res = await fetch(
    `${FB_BASE_URL}/v2/help_center/collections?help_center_id=${encodeURIComponent(
      helpCenterId
    )}&limit=200`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Featurebase-Version': FB_API_VERSION,
      },
    }
  );
  if (!res.ok) throw new Error(`Featurebase collections ${res.status}: ${await res.text()}`);

  const data: any = await res.json();
  return (data?.data || [])
    .map((collection: any) => ({
      id: String(collection.id || ''),
      name:
        collection.name ||
        collection.title ||
        collection.translations?.en?.name ||
        collection.translations?.en?.title ||
        '',
    }))
    .filter((collection: FeaturebaseCollectionRef) => collection.id && collection.name);
}

async function resolveCollection(
  input: { collection_id?: string; collection_name?: string },
  rt: AgentRuntime,
  apiKey: string,
  helpCenterId: string
): Promise<FeaturebaseCollectionRef> {
  const collections = runtimeCollections(rt);
  try {
    const remoteCollections = await fetchFeaturebaseCollections(apiKey, helpCenterId);
    for (const collection of remoteCollections) {
      if (!collections.some((existing) => existing.id === collection.id)) {
        collections.push(collection);
      }
    }
  } catch {
    // Runtime article metadata is usually enough; do not block creation if the
    // collection list endpoint is temporarily unhappy.
  }

  const byId = new Map(collections.map((collection) => [collection.id, collection]));
  const byName = new Map<string, FeaturebaseCollectionRef[]>();
  for (const collection of collections) {
    const key = normalizeLookup(collection.name);
    byName.set(key, [...(byName.get(key) || []), collection]);
  }

  const collectionId = String(input.collection_id || '').trim();
  if (collectionId) {
    return {
      id: collectionId,
      name: String(input.collection_name || byId.get(collectionId)?.name || 'Uncategorized'),
    };
  }

  const collectionName = String(input.collection_name || '').trim();
  if (collectionName) {
    const matches = byName.get(normalizeLookup(collectionName)) || [];
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(
        `Collection name "${collectionName}" is ambiguous. Pass collection_id instead. Matches: ${matches
          .map((collection) => `${collection.name} (${collection.id})`)
          .join(', ')}`
      );
    }
  }

  const known = collections
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((collection) => `${collection.name} (${collection.id})`)
    .join(', ');
  throw new Error(
    collectionName
      ? `Unknown collection "${collectionName}". Known collections: ${known}`
      : `Pass collection_id or collection_name. Known collections: ${known}`
  );
}

async function createFeaturebaseArticle(input: {
  apiKey: string;
  helpCenterId: string;
  title: string;
  body: string;
  collectionId: string;
  slug?: string;
}): Promise<any> {
  const payload = {
    title: input.title,
    ...(input.slug ? { slug: input.slug } : {}),
    content: input.body,
    content_markdown: input.body,
    help_center_id: input.helpCenterId,
    collection_id: input.collectionId,
    formatter: 'ai',
    state: 'live',
    is_public: true,
  };

  const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'Featurebase-Version': FB_API_VERSION,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Featurebase ${res.status}: ${await res.text()}`);

  const data: any = await res.json();
  return data?.data || data;
}

async function deleteFeaturebaseArticle(apiKey: string, articleId: string): Promise<string | null> {
  const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${articleId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Featurebase-Version': FB_API_VERSION,
    },
  });
  if (res.ok) return null;
  return `Featurebase ${res.status}: ${await res.text()}`;
}

const handlers: Record<string, ToolHandler> = {
  list_articles: async (_input, rt) => {
    const items = [...rt.articles.values()].map((a) => ({
      title: a.title,
      slug: a.slug,
      collection: a.collection,
      path: a.path,
    }));
    items.sort((a, b) => a.collection.localeCompare(b.collection) || a.title.localeCompare(b.title));
    return ok(JSON.stringify({ count: items.length, articles: items }, null, 2));
  },

  read_article: async ({ slug }, rt) => {
    const article = findArticle(rt, slug);
    if (!article) return err(`Article not found: ${slug}`);
    return ok(
      JSON.stringify(
        {
          title: article.title,
          slug: article.slug,
          collection: article.collection,
          path: article.path,
          last_updated: article.frontmatter.last_updated,
          body: article.body,
        },
        null,
        2
      )
    );
  },

  search_articles: async ({ query, limit = 10 }, rt) => {
    const q = String(query).toLowerCase();
    const matches: { title: string; slug: string; collection: string; snippet: string; score: number }[] = [];
    for (const a of rt.articles.values()) {
      const titleHit = a.title?.toLowerCase().includes(q);
      const slugHit = a.slug?.toLowerCase().includes(q);
      const bodyIdx = a.body.toLowerCase().indexOf(q);
      if (!titleHit && !slugHit && bodyIdx === -1) continue;
      const snippet =
        bodyIdx >= 0
          ? '...' + a.body.slice(Math.max(0, bodyIdx - 60), bodyIdx + 120) + '...'
          : a.body.slice(0, 180) + '...';
      const score = (titleHit ? 3 : 0) + (slugHit ? 2 : 0) + (bodyIdx >= 0 ? 1 : 0);
      matches.push({ title: a.title, slug: a.slug, collection: a.collection, snippet, score });
    }
    matches.sort((a, b) => b.score - a.score);
    return ok(
      JSON.stringify(
        { count: matches.length, results: matches.slice(0, Math.min(50, Number(limit))) },
        null,
        2
      )
    );
  },

  edit_article: async ({ slug, original, replacement, reasoning }, rt) => {
    const article = findArticle(rt, slug);
    if (!article) return err(`Article not found: ${slug}`);
    if (!article.body.includes(original)) {
      return err(
        `The exact \`original\` text was not found in "${article.slug}". The article body has not changed. Re-read the article and try again with verbatim text.`
      );
    }
    article.body = article.body.replace(original, replacement);
    article.dirty = true;
    return ok(
      `Staged edit on "${article.title}" (${article.slug}). Reasoning: ${reasoning}\n\nCall commit_pending_edits to push to GitHub.`
    );
  },

  create_article: async (
    { title, body, collection_id, collection_name, slug, source_url, commit_message },
    rt
  ) => {
    const apiKey = process.env.FEATUREBASE_API_KEY;
    const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;
    if (!apiKey || !helpCenterId) return err('Featurebase API not configured');

    const articleTitle = String(title || '').trim();
    const articleBody = String(body || '').trim();
    const sourceUrl = String(source_url || '').trim();
    if (!articleTitle) return err('Article title is required');
    if (!articleBody) return err('Article body is required');

    const duplicate = [...rt.articles.values()].find(
      (article) => normalizeLookup(article.title) === normalizeLookup(articleTitle)
    );
    if (duplicate) {
      return err(
        `An article titled "${duplicate.title}" already exists at ${duplicate.path}. Update that article instead, or choose a distinct title.`
      );
    }

    const preferredSlug = slug ? slugifyTitle(String(slug)) : '';
    if (preferredSlug && rt.articles.has(preferredSlug.toLowerCase())) {
      return err(`An article with slug "${preferredSlug}" already exists. Omit slug or choose another.`);
    }

    let collection: FeaturebaseCollectionRef;
    try {
      collection = await resolveCollection(
        { collection_id, collection_name },
        rt,
        apiKey,
        helpCenterId
      );
    } catch (e) {
      return err((e as Error).message);
    }

    let created: any;
    try {
      created = await createFeaturebaseArticle({
        apiKey,
        helpCenterId,
        title: articleTitle,
        body: articleBody,
        collectionId: collection.id,
        slug: preferredSlug || undefined,
      });
    } catch (e) {
      return err(`Featurebase create failed: ${(e as Error).message}`);
    }

    const featurebaseId = String(created?.id || '').trim();
    if (!featurebaseId) {
      return err(`Featurebase create returned no article id: ${JSON.stringify(created).slice(0, 1000)}`);
    }

    const createdTitle = String(created?.title || articleTitle).trim();
    const createdSlug = String(created?.slug || `${featurebaseId}-${slugifyTitle(createdTitle)}`).trim();
    const timestamp = new Date().toISOString();
    const lastUpdated = created?.updatedAt || created?.updated_at || timestamp;
    const repoPath = uniqueRepoPath(
      buildRepoPath(
        COLLECTION_HIERARCHY as Record<string, { main: string; sub: string | null }>,
        collection.id,
        createdTitle
      ),
      rt
    );

    const frontmatter = {
      title: createdTitle,
      slug: createdSlug,
      category: collection.id,
      collection_name: collection.name,
      featurebase_id: featurebaseId,
      last_updated: lastUpdated,
      synced_at: timestamp,
      source: 'featurebase',
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
    };

    const cached: CachedArticle = {
      id: featurebaseId,
      title: createdTitle,
      slug: createdSlug,
      collection: collection.name,
      path: repoPath,
      frontmatter,
      body: articleBody,
      originalBody: articleBody,
      dirty: false,
    };
    addArticleToRuntime(rt, cached);

    const rollupArticles = rollupArticlesFromRuntime(rt);
    const files = [
      { path: repoPath, content: matter.stringify(articleBody, frontmatter) },
      { path: 'llms.txt', content: generateLlmsTxt(rollupArticles) },
      { path: 'docs-rollup.md', content: generateDocsRollup(rollupArticles) },
    ];

    try {
      const message = String(commit_message || `create ${createdTitle} documentation article`).trim();
      const commit = await commitFiles(files, `agent: ${message}`);
      return ok(
        `Created "${createdTitle}" in Featurebase (${featurebaseId}) and committed the repo article plus llms.txt/docs-rollup.md.\n${commit.url}\n\nFiles:\n${files.map((f) => `  - ${f.path}`).join('\n')}`
      );
    } catch (e) {
      removeArticleFromRuntime(rt, cached);
      let rollbackMessage = 'I also could not confirm rollback of the created Featurebase article.';
      try {
        const rollbackError = await deleteFeaturebaseArticle(apiKey, featurebaseId);
        rollbackMessage = rollbackError
          ? `Rollback delete failed: ${rollbackError}`
          : 'Rolled back the created Featurebase article.';
      } catch (rollback) {
        rollbackMessage = `Rollback delete failed: ${(rollback as Error).message}`;
      }
      return err(
        `Featurebase article ${featurebaseId} was created, but the GitHub commit failed: ${(e as Error).message}. ${rollbackMessage}`
      );
    }
  },

  commit_pending_edits: async ({ message }, rt) => {
    const dirty = [...rt.articles.values()].filter((a) => a.dirty);
    if (dirty.length === 0) return ok('No staged edits — nothing to commit.');

    const timestamp = new Date().toISOString();
    const published: string[] = [];
    const publishedIds = new Set<string>();
    const publishErrors: string[] = [];

    for (const article of dirty) {
      try {
        const error = await publishArticleToFeaturebase(article);
        if (error) {
          publishErrors.push(`${article.title}: ${error}`);
        } else {
          published.push(article.title);
          publishedIds.add(article.id);
        }
      } catch (e) {
        publishErrors.push(`${article.title}: ${(e as Error).message}`);
      }
    }

    const files = dirty.map((a) => {
      const wasPublished = publishedIds.has(a.id);
      a.frontmatter = {
        ...a.frontmatter,
        last_updated: timestamp,
        ...(wasPublished ? { synced_at: timestamp, source: 'featurebase' } : {}),
      };
      return {
        path: a.path,
        content: matter.stringify(a.body, a.frontmatter),
      };
    });

    const rollupArticles = rollupArticlesFromRuntime(rt);
    files.push({ path: 'llms.txt', content: generateLlmsTxt(rollupArticles) });
    files.push({ path: 'docs-rollup.md', content: generateDocsRollup(rollupArticles) });

    try {
      const commit = await commitFiles(files, `agent: ${message}`);
      // Mark clean post-commit
      for (const a of dirty) {
        a.originalBody = a.body;
        a.dirty = false;
      }
      const publishSummary =
        publishErrors.length === 0
          ? `Published ${published.length} article(s) to Featurebase.`
          : `Featurebase publish was incomplete:\n${publishErrors.map((e) => `  - ${e}`).join('\n')}`;
      return ok(
        `${publishSummary}\nCommitted ${dirty.length} article file(s) plus llms.txt and docs-rollup.md.\n${commit.url}\n\nFiles:\n${files.map((f) => `  - ${f.path}`).join('\n')}`
      );
    } catch (e) {
      return err(`Commit failed: ${(e as Error).message}`);
    }
  },

  featurebase_list_articles: async () => {
    const apiKey = process.env.FEATUREBASE_API_KEY;
    const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;
    if (!apiKey || !helpCenterId) return err('Featurebase API not configured');
    try {
      const res = await fetch(
        `${FB_BASE_URL}/v2/help_center/articles?help_center_id=${helpCenterId}&limit=200`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Featurebase-Version': FB_API_VERSION,
          },
        }
      );
      if (!res.ok) return err(`Featurebase ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      const articles = (data?.data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        parentId: a.parentId,
        updatedAt: a.updatedAt || a.updated_at,
      }));
      return ok(JSON.stringify({ count: articles.length, articles }, null, 2));
    } catch (e) {
      return err((e as Error).message);
    }
  },

  featurebase_get_article: async ({ id }) => {
    const apiKey = process.env.FEATUREBASE_API_KEY;
    if (!apiKey) return err('Featurebase API not configured');
    try {
      const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Featurebase-Version': FB_API_VERSION,
        },
      });
      if (!res.ok) return err(`Featurebase ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      return ok(JSON.stringify(data?.data || data, null, 2));
    } catch (e) {
      return err((e as Error).message);
    }
  },

  featurebase_update_article: async ({ id, title, body }) => {
    const apiKey = process.env.FEATUREBASE_API_KEY;
    if (!apiKey) return err('Featurebase API not configured');
    try {
      const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Featurebase-Version': FB_API_VERSION,
        },
        body: JSON.stringify({ title, body, formatter: 'ai', state: 'live' }),
      });
      if (!res.ok) return err(`Featurebase ${res.status}: ${await res.text()}`);
      return ok(`Updated Featurebase article ${id} ("${title}")`);
    } catch (e) {
      return err((e as Error).message);
    }
  },

  run_changelog_audit: async ({ changelog_text }) => {
    try {
      const mod: any = await import('./audit-engine-v3.js');
      const result = await mod.runAudit({
        id: 'agent-' + Date.now(),
        title: 'Agent-triggered audit',
        content: changelog_text,
        publishedAt: new Date().toISOString(),
        url: '',
        tags: [],
      });
      return ok(JSON.stringify(result, null, 2));
    } catch (e) {
      return err(`Audit failed: ${(e as Error).message}`);
    }
  },

  web_fetch: async ({ url }) => {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'docs-control-agent/0.1' },
      });
      if (!res.ok) return err(`HTTP ${res.status} fetching ${url}`);
      const text = await res.text();
      // Crude HTML → text fallback
      const stripped = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      return ok(stripped.slice(0, 8000));
    } catch (e) {
      return err((e as Error).message);
    }
  },

  spawn_subagent: async ({ task, focus_slugs }, rt) => {
    rt.emit.status(`Subagent: ${String(task).slice(0, 80)}...`);
    let context = '';
    if (Array.isArray(focus_slugs) && focus_slugs.length > 0) {
      const focusArticles = focus_slugs
        .map((s: string) => findArticle(rt, s))
        .filter(Boolean) as CachedArticle[];
      if (focusArticles.length > 0) {
        context =
          '\n\n# Articles in scope\n\n' +
          focusArticles
            .map(
              (a) =>
                `## ${a.title} (${a.slug})\n\n${a.body.slice(0, 4000)}${
                  a.body.length > 4000 ? '\n[... truncated ...]' : ''
                }`
            )
            .join('\n\n---\n\n');
      }
    }

    const sysPrompt = `You are a focused subagent for the docs-control system. You have read-only tools.
Complete the task below thoroughly and return a clear, well-structured text answer.${context}`;

    try {
      const messages: Anthropic.Messages.MessageParam[] = [
        { role: 'user', content: String(task) },
      ];
      const summary: string[] = [];
      for (let i = 0; i < 8; i++) {
        const resp = await rt.anthropic.messages.create({
          model: SUBAGENT_MODEL,
          max_tokens: 4096,
          system: sysPrompt,
          tools: SUBAGENT_TOOLS,
          messages,
        });
        messages.push({ role: 'assistant', content: resp.content });

        const toolUses = resp.content.filter(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
        );
        const text = resp.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        if (text) summary.push(text);

        if (toolUses.length === 0 || resp.stop_reason === 'end_turn') break;

        const results: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const handler = handlers[tu.name];
          if (!handler) {
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: `ERROR: subagent has no access to tool ${tu.name}`,
              is_error: true,
            });
            continue;
          }
          try {
            const out = await handler(tu.input, rt);
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
          } catch (e) {
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: `ERROR: ${(e as Error).message}`,
              is_error: true,
            });
          }
        }
        messages.push({ role: 'user', content: results });
      }
      return ok(summary.join('\n\n').trim() || '(subagent returned no text)');
    } catch (e) {
      return err(`Subagent failed: ${(e as Error).message}`);
    }
  },

  notion_search: async ({ query }) => {
    return ok(
      `Notion integration is not configured yet. Search query was: "${query}". Ask the operator to wire up NOTION_API_KEY and a Notion database/workspace, and this tool will be enabled.`
    );
  },
};

// ---------------------------------------------------------------------------
// Setup — load all articles into memory once per turn
// ---------------------------------------------------------------------------

export async function buildRuntime(emit: AgentEmitter): Promise<AgentRuntime> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const repoArticles = await fetchRepoArticles();
  const articles = new Map<string, CachedArticle>();
  const byId = new Map<string, CachedArticle>();
  const byPath = new Map<string, CachedArticle>();
  for (const [fbId, a] of repoArticles) {
    const cached: CachedArticle = {
      id: fbId,
      title: a.frontmatter.title || '',
      slug: a.frontmatter.slug || '',
      collection: a.frontmatter.collection_name || 'Uncategorized',
      path: a.path,
      frontmatter: a.frontmatter,
      body: a.content,
      originalBody: a.content,
      dirty: false,
    };
    if (cached.slug) articles.set(cached.slug.toLowerCase(), cached);
    byId.set(fbId, cached);
    byPath.set(a.path, cached);
  }

  return {
    anthropic: new Anthropic({ apiKey }),
    articles,
    byId,
    byPath,
    emit,
  };
}

// ---------------------------------------------------------------------------
// Streaming chat loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the docs-control agent for Sudowrite — an AI-assisted creative writing tool.

# Your job
You help the operator review, audit, and edit the Sudowrite documentation. You're a chat partner first: respond conversationally, ask clarifying questions when needed, and only reach for tools when you actually need them. Don't run tools just to look busy.

# What you have access to
- The full local documentation repo, via list_articles, read_article, search_articles
- Live Featurebase published state, via featurebase_list_articles / get_article / update_article
- Create, edit, and commit: create_article publishes a new Featurebase article and repo markdown in one commit; edit_article stages edits in memory; commit_pending_edits publishes staged edits and refreshes rollups
- The two-stage changelog audit, via run_changelog_audit
- Web access, via web_fetch
- Subagents: spawn_subagent (focused, read-only, returns text). Use multiple parallel calls in one turn for big multi-part tasks
- notion_search (stub — not wired up yet)

# Working with edits
When the operator asks you to update an article:
1. read_article to confirm you understand current content
2. edit_article with verbatim original text + replacement
3. Only call commit_pending_edits once you have all edits staged for that turn
4. Treat commit_pending_edits as the publish step: it pushes Featurebase when possible, regenerates llms.txt/docs-rollup.md, and commits the full update

# Working from changelog links
When the operator links a public changelog post and asks you to document it:
1. web_fetch the URL and read the changelog content
2. search/read existing docs to decide whether to update an existing article or create a new one
3. If creating a new article, draft concise customer-facing markdown and call create_article with the best collection_name or collection_id plus source_url
4. If updating existing docs, use edit_article and commit_pending_edits

# Style
- Concise. The operator is technical and busy.
- Don't dump giant tool results back at them; summarize what you found.
- If you make an edit, mention what you changed and why in 1–2 sentences.`;

export interface ChatTurnResult {
  /** Final assistant text the user sees. */
  text: string;
  /** Tool calls executed this turn, in order. */
  toolCalls: { id: string; name: string; input: unknown; result: string; isError: boolean }[];
  /** Whether any commits were made this turn. */
  committed: boolean;
}

export async function runChatTurn(
  rt: AgentRuntime,
  conversationHistory: Anthropic.Messages.MessageParam[],
  newUserMessage: string
): Promise<ChatTurnResult> {
  const messages: Anthropic.Messages.MessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: newUserMessage },
  ];

  const collectedToolCalls: ChatTurnResult['toolCalls'] = [];
  const finalTextBuffer: string[] = [];
  let committed = false;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const stream = rt.anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // Per-stream accumulation
    type Block =
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; inputJson: string };
    const blocks: Block[] = [];
    let stopReason: string | null = null;

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start': {
          if (event.content_block.type === 'text') {
            blocks[event.index] = { type: 'text', text: '' };
          } else if (event.content_block.type === 'tool_use') {
            blocks[event.index] = {
              type: 'tool_use',
              id: event.content_block.id,
              name: event.content_block.name,
              inputJson: '',
            };
          }
          break;
        }
        case 'content_block_delta': {
          const block = blocks[event.index];
          if (!block) break;
          if (event.delta.type === 'text_delta' && block.type === 'text') {
            block.text += event.delta.text;
            rt.emit.text(event.delta.text);
          } else if (event.delta.type === 'input_json_delta' && block.type === 'tool_use') {
            block.inputJson += event.delta.partial_json;
          }
          break;
        }
        case 'content_block_stop': {
          const block = blocks[event.index];
          if (block?.type === 'tool_use') {
            // Tool call now complete — surface it before we run it
            let parsedInput: unknown = {};
            try {
              parsedInput = block.inputJson ? JSON.parse(block.inputJson) : {};
            } catch {
              parsedInput = { _raw: block.inputJson };
            }
            rt.emit.toolStart({ id: block.id, name: block.name, input: parsedInput });
          }
          break;
        }
        case 'message_delta': {
          if ((event.delta as any).stop_reason) {
            stopReason = (event.delta as any).stop_reason;
          }
          break;
        }
      }
    }

    // Reconstruct the assistant message blocks for the conversation history
    const assistantContent: Anthropic.Messages.ContentBlockParam[] = blocks
      .filter(Boolean)
      .map((b) => {
        if (b.type === 'text') return { type: 'text', text: b.text };
        let parsed: unknown = {};
        try {
          parsed = b.inputJson ? JSON.parse(b.inputJson) : {};
        } catch {
          parsed = {};
        }
        return { type: 'tool_use', id: b.id, name: b.name, input: parsed };
      });

    messages.push({ role: 'assistant', content: assistantContent });

    // Capture text for the final result
    for (const b of blocks) {
      if (b?.type === 'text' && b.text) finalTextBuffer.push(b.text);
    }

    // No tool use → we're done
    const toolUseBlocks = assistantContent.filter(
      (b): b is Anthropic.Messages.ToolUseBlockParam => b.type === 'tool_use'
    );
    if (toolUseBlocks.length === 0 || stopReason === 'end_turn') {
      break;
    }

    // Execute tool calls (in parallel — Claude can request multiple at once)
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (tu) => {
        const handler = handlers[tu.name];
        if (!handler) {
          const errMsg = `Unknown tool: ${tu.name}`;
          rt.emit.toolResult({ id: tu.id, text: errMsg, isError: true });
          collectedToolCalls.push({
            id: tu.id,
            name: tu.name,
            input: tu.input,
            result: errMsg,
            isError: true,
          });
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: errMsg,
            is_error: true,
          };
        }
        try {
          const result = await handler(tu.input, rt);
          const isError = result.startsWith('ERROR:');
          rt.emit.toolResult({ id: tu.id, text: result, isError });
          collectedToolCalls.push({
            id: tu.id,
            name: tu.name,
            input: tu.input,
            result,
            isError,
          });
          if (tu.name === 'commit_pending_edits' && !isError) committed = true;
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: result,
            is_error: isError,
          };
        } catch (e) {
          const errMsg = `ERROR: ${(e as Error).message}`;
          rt.emit.toolResult({ id: tu.id, text: errMsg, isError: true });
          collectedToolCalls.push({
            id: tu.id,
            name: tu.name,
            input: tu.input,
            result: errMsg,
            isError: true,
          });
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: errMsg,
            is_error: true,
          };
        }
      })
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    text: finalTextBuffer.join('').trim(),
    toolCalls: collectedToolCalls,
    committed,
  };
}
