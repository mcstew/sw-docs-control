/**
 * In-process MCP server exposing docs-control's domain tools to the agent.
 *
 * Featurebase, audit, and commit operations the agent can call directly.
 * Native filesystem tools (Read/Edit/Write/Glob/Grep) come from the Agent SDK
 * and are configured separately on the query() options.
 */

import { z } from 'zod';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import {
  diffWorkspace,
  commitWorkspaceChanges,
  type WorkspaceManifest,
} from './agent-workspace';

const FB_BASE_URL = 'https://do.featurebase.app';
const FB_API_VERSION = '2026-01-01.nova';

const getFbHeaders = () => {
  const apiKey = process.env.FEATUREBASE_API_KEY;
  if (!apiKey) throw new Error('FEATUREBASE_API_KEY not configured');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Featurebase-Version': FB_API_VERSION,
  };
};

const getHelpCenterId = () => {
  const id = process.env.FEATUREBASE_HELP_CENTER_ID;
  if (!id) throw new Error('FEATUREBASE_HELP_CENTER_ID not configured');
  return id;
};

const ok = (text: string) => ({
  content: [{ type: 'text' as const, text }],
});

const err = (text: string) => ({
  content: [{ type: 'text' as const, text }],
  isError: true,
});

/**
 * Build the MCP server. Pass the per-turn workspace manifest so the
 * commit tool knows what to diff against.
 */
export function buildAgentToolsServer(manifest: WorkspaceManifest) {
  return createSdkMcpServer({
    name: 'docs-control',
    version: '0.1.0',
    tools: [
      // ---- Featurebase: read ----
      tool(
        'featurebase_list_articles',
        'List all articles in the Featurebase help center. Returns id, title, slug, parentId (collection id), and updatedAt for each. Use this when the user asks about live published documentation as it currently appears in Featurebase, vs. the local repo state.',
        {},
        async () => {
          try {
            const res = await fetch(
              `${FB_BASE_URL}/v2/help_center/articles?help_center_id=${getHelpCenterId()}&limit=200`,
              { headers: getFbHeaders() }
            );
            if (!res.ok) return err(`Featurebase API ${res.status}: ${await res.text()}`);
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
            return err(`featurebase_list_articles failed: ${(e as Error).message}`);
          }
        }
      ),

      tool(
        'featurebase_get_article',
        'Fetch the full content of a single article from Featurebase by its id. Returns title, slug, body (HTML), and metadata. Use to compare what is live in Featurebase against the local repo file.',
        { id: z.string().describe('The Featurebase article id') },
        async ({ id }) => {
          try {
            const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${id}`, {
              headers: getFbHeaders(),
            });
            if (!res.ok) return err(`Featurebase API ${res.status}: ${await res.text()}`);
            const data: any = await res.json();
            return ok(JSON.stringify(data?.data || data, null, 2));
          } catch (e) {
            return err(`featurebase_get_article failed: ${(e as Error).message}`);
          }
        }
      ),

      tool(
        'featurebase_list_collections',
        'List all collections (categories) in the Featurebase help center. Returns id, name, and parentId so you can map articles into their collection hierarchy.',
        {},
        async () => {
          try {
            const res = await fetch(
              `${FB_BASE_URL}/v2/help_center/collections?help_center_id=${getHelpCenterId()}&limit=100`,
              { headers: getFbHeaders() }
            );
            if (!res.ok) return err(`Featurebase API ${res.status}: ${await res.text()}`);
            const data: any = await res.json();
            const collections = (data?.data || []).map((c: any) => ({
              id: c.id,
              name: c.name || c.translations?.en?.name,
              parentId: c.parentId,
            }));
            return ok(JSON.stringify({ count: collections.length, collections }, null, 2));
          } catch (e) {
            return err(`featurebase_list_collections failed: ${(e as Error).message}`);
          }
        }
      ),

      // ---- Featurebase: write ----
      tool(
        'featurebase_update_article',
        'Push an updated article body to Featurebase. The body should be markdown — Featurebase will render it. Use this AFTER editing the corresponding local file and committing it (commit_workspace), so the repo and Featurebase stay in sync.',
        {
          id: z.string().describe('The Featurebase article id'),
          title: z.string().describe('The article title'),
          body: z.string().describe('The full article body, in markdown'),
        },
        async ({ id, title, body }) => {
          try {
            const res = await fetch(`${FB_BASE_URL}/v2/help_center/articles/${id}`, {
              method: 'PATCH',
              headers: getFbHeaders(),
              body: JSON.stringify({ title, body }),
            });
            if (!res.ok) return err(`Featurebase API ${res.status}: ${await res.text()}`);
            return ok(`Updated Featurebase article ${id} ("${title}")`);
          } catch (e) {
            return err(`featurebase_update_article failed: ${(e as Error).message}`);
          }
        }
      ),

      // ---- Audit ----
      tool(
        'run_changelog_audit',
        'Run the two-stage AI audit (keyword filter + Claude deep dive) against a changelog entry. Returns the list of articles that contradict or miss information from the changelog. Use this when the user wants to verify documentation against a specific product change.',
        {
          changelog_text: z
            .string()
            .describe('The full text of the changelog entry to audit against'),
        },
        async ({ changelog_text }) => {
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
            return err(`run_changelog_audit failed: ${(e as Error).message}`);
          }
        }
      ),

      // ---- Workspace: commit ----
      tool(
        'commit_workspace',
        'Commit any local file changes you made (via Read/Edit/Write) back to the GitHub repo as a single commit. Returns the commit URL. Call this once you are done editing files and want the changes persisted. If you have not modified any files, this is a no-op.',
        {
          message: z
            .string()
            .describe(
              'A descriptive commit message explaining what changed and why (will be prefixed with "agent: ")'
            ),
        },
        async ({ message }) => {
          try {
            const diff = await diffWorkspace(manifest);
            const totalChanges = diff.modified.length + diff.added.length;
            if (totalChanges === 0) {
              return ok('No file changes detected — nothing to commit.');
            }
            const result = await commitWorkspaceChanges(diff, `agent: ${message}`);
            if (!result) return ok('No file changes detected — nothing to commit.');
            return ok(
              `Committed ${diff.modified.length} modified + ${diff.added.length} new files.\n` +
                `Commit: ${result.url}\n` +
                `Modified:\n${diff.modified.map((f) => `  - ${f.path}`).join('\n')}\n` +
                (diff.added.length
                  ? `Added:\n${diff.added.map((f) => `  - ${f.path}`).join('\n')}`
                  : '')
            );
          } catch (e) {
            return err(`commit_workspace failed: ${(e as Error).message}`);
          }
        }
      ),
    ],
  });
}
