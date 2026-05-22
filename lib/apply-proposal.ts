/**
 * Apply an approved proposal — updates both GitHub repo and Featurebase.
 */

import { commitFiles, fetchRepoArticles } from './github-sync';
import { FeaturebaseClient } from './featurebase-client.js';
import { generateLlmsTxt, generateDocsRollup } from './generate-rollups';
import matter from 'gray-matter';
import type { EditProposal } from './improve-agent';

interface ApplyResult {
  github: boolean;
  featurebase: boolean;
  githubUrl?: string;
  errors: string[];
}

export async function applyProposal(proposal: EditProposal): Promise<ApplyResult> {
  const result: ApplyResult = { github: false, featurebase: false, errors: [] };

  // 1. Fetch the current article from GitHub
  const articles = await fetchRepoArticles();
  let articleEntry: { path: string; content: string; frontmatter: any } | undefined;
  let featurebaseId: string | undefined;

  for (const [id, a] of articles) {
    if (
      a.frontmatter.slug === proposal.articleSlug ||
      a.frontmatter.title === proposal.articleTitle
    ) {
      articleEntry = a;
      featurebaseId = id;
      break;
    }
  }

  if (!articleEntry || !featurebaseId) {
    result.errors.push(`Article not found in repo: ${proposal.articleSlug}`);
    return result;
  }

  // 2. Apply the text replacement
  const originalContent = articleEntry.content;

  if (!originalContent.includes(proposal.original)) {
    result.errors.push(`Original text not found in article — it may have already been changed.`);
    return result;
  }

  const updatedContent = originalContent.replace(proposal.original, proposal.replacement);

  const timestamp = new Date().toISOString();

  // 3. Push to Featurebase first; the repo commit records synced_at only if
  // the live write succeeded.
  const apiKey = process.env.FEATUREBASE_API_KEY;
  if (apiKey && featurebaseId) {
    try {
      const client = new FeaturebaseClient(apiKey);
      await client.updateArticle(featurebaseId, {
        title: articleEntry.frontmatter.title,
        body: updatedContent, // Featurebase accepts markdown in body
        formatter: 'ai',
        state: 'live',
      });
      result.featurebase = true;
    } catch (err) {
      result.errors.push(`Featurebase update failed: ${(err as Error).message}`);
    }
  } else {
    result.errors.push('FEATUREBASE_API_KEY not configured — skipped Featurebase update');
  }

  const updatedFrontmatter = {
    ...articleEntry.frontmatter,
    last_updated: timestamp,
    ...(result.featurebase ? { synced_at: timestamp, source: 'featurebase' } : {}),
  };

  const updatedFile = matter.stringify(updatedContent, updatedFrontmatter);

  const rollupArticles = Array.from(articles.entries()).map(([id, a]) => {
    const fm = id === featurebaseId ? updatedFrontmatter : a.frontmatter;
    return {
      title: fm.title || 'Untitled',
      slug: fm.slug || '',
      category: fm.category || '',
      content: id === featurebaseId ? updatedContent : a.content,
      last_updated: fm.last_updated,
      id,
    };
  });

  // 4. Commit article + generated agent files to GitHub.
  try {
    const commit = await commitFiles(
      [
        { path: articleEntry.path, content: updatedFile },
        { path: 'llms.txt', content: generateLlmsTxt(rollupArticles) },
        { path: 'docs-rollup.md', content: generateDocsRollup(rollupArticles) },
      ],
      `Improve: ${proposal.editType} in "${proposal.articleTitle}"\n\n${proposal.reasoning}`
    );
    result.github = true;
    result.githubUrl = commit.url;
  } catch (err) {
    result.errors.push(`GitHub commit failed: ${(err as Error).message}`);
  }

  return result;
}
