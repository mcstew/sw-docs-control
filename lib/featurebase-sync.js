/**
 * Featurebase Sync Library
 * Core utilities for bidirectional synchronization between local markdown and Featurebase
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import TurndownService from 'turndown';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTICLES_DIR = path.join(__dirname, '../docs-source/articles');
const SYNC_STATE_FILE = path.join(__dirname, '../docs-source/sync-state.json');
const CONFLICTS_DIR = path.join(__dirname, '../docs-source/conflicts');

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

/**
 * Load sync state from disk
 */
export async function loadSyncState() {
  try {
    const data = await fs.readFile(SYNC_STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, return default state
      return {
        last_sync: null,
        articles: {},
        conflicts: []
      };
    }
    throw error;
  }
}

/**
 * Save sync state to disk
 */
export async function saveSyncState(state) {
  await fs.writeFile(
    SYNC_STATE_FILE,
    JSON.stringify(state, null, 2),
    'utf-8'
  );
}

/**
 * Hash content for change detection
 */
export function hashContent(content) {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * Scan local articles directory
 * Returns array of { id, path, title, slug, category, content, last_updated }
 */
export async function scanLocalArticles() {
  const articles = [];

  try {
    const entries = await fs.readdir(ARTICLES_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Look for article.md inside directory
        const articlePath = path.join(ARTICLES_DIR, entry.name, 'article.md');
        try {
          const exists = await fs.access(articlePath).then(() => true).catch(() => false);
          if (exists) {
            const article = await readLocalArticle(articlePath);
            if (article) {
              articles.push(article);
            }
          }
        } catch (error) {
          console.warn(`Skipping ${entry.name}:`, error.message);
        }
      } else if (entry.name.endsWith('.md')) {
        // Direct markdown file
        const articlePath = path.join(ARTICLES_DIR, entry.name);
        const article = await readLocalArticle(articlePath);
        if (article) {
          articles.push(article);
        }
      }
    }

    return articles;
  } catch (error) {
    console.error('Error scanning articles:', error);
    return [];
  }
}

/**
 * Read a local article file
 */
export async function readLocalArticle(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data: frontmatter, content: markdown } = matter(content);

    // Extract Featurebase ID from filename or frontmatter
    const filename = path.basename(filePath, '.md');
    const idMatch = filename.match(/([a-f0-9-]{36})/); // UUID format
    const id = idMatch ? idMatch[1] : frontmatter.featurebase_id || null;

    if (!id) {
      console.warn(`No Featurebase ID found for ${filePath}`);
      return null;
    }

    return {
      id,
      path: filePath,
      title: frontmatter.title || 'Untitled',
      slug: frontmatter.slug || '',
      category: frontmatter.category || '',
      content: markdown,
      last_updated: frontmatter.last_updated || new Date().toISOString(),
      frontmatter
    };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Write a local article file
 */
export async function writeLocalArticle(article, filePath) {
  const frontmatter = {
    title: article.title,
    slug: article.slug,
    category: article.category || article.collectionId || '',
    featurebase_id: article.id,
    last_updated: article.last_updated || new Date().toISOString(),
    synced_at: new Date().toISOString(),
    source: 'featurebase'
  };

  const fileContent = matter.stringify(article.content, frontmatter);

  // Ensure directory exists if using directory structure
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(filePath, fileContent, 'utf-8');
}

/**
 * Find local article by Featurebase ID
 */
export async function findLocalArticleById(featurebaseId) {
  const articles = await scanLocalArticles();
  return articles.find(a => a.id === featurebaseId);
}

/**
 * Convert markdown to HTML for Featurebase
 */
export function markdownToHtml(markdown) {
  // For now, just return the markdown
  // Featurebase might accept markdown directly, or we need a proper markdown-to-html converter
  // TODO: Add proper markdown to HTML conversion if needed
  return markdown;
}

/**
 * Convert HTML to markdown from Featurebase
 */
export function htmlToMarkdown(html) {
  return turndownService.turndown(html);
}

/**
 * Handle conflict between local and remote versions
 */
export async function handleConflict(local, remote, syncDirection) {
  // Ensure conflicts directory exists
  await fs.mkdir(CONFLICTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const articleId = local.id || remote.id;

  // Save local version
  const localConflictPath = path.join(
    CONFLICTS_DIR,
    `${articleId}-local-${timestamp}.md`
  );

  const localContent = matter.stringify(local.content, {
    title: local.title,
    last_updated: local.last_updated,
    source: 'local'
  });

  await fs.writeFile(localConflictPath, localContent, 'utf-8');

  // Save remote version
  const remoteConflictPath = path.join(
    CONFLICTS_DIR,
    `${articleId}-remote-${timestamp}.md`
  );

  const remoteMarkdown = remote.content_markdown ||
                         (remote.content ? htmlToMarkdown(remote.content) : '');

  const remoteContent = matter.stringify(remoteMarkdown, {
    title: remote.title,
    last_updated: remote.updatedAt || remote.updated_at,
    source: 'featurebase'
  });

  await fs.writeFile(remoteConflictPath, remoteContent, 'utf-8');

  // Determine which version to use (last-write-wins)
  const localDate = new Date(local.last_updated);
  const remoteDate = new Date(remote.updatedAt || remote.updated_at);

  const resolution = remoteDate > localDate ? 'used_remote' : 'used_local';
  const winner = resolution === 'used_remote' ? remote : local;

  // Create conflict report
  const report = {
    article_id: articleId,
    article_title: local.title || remote.title,
    detected_at: new Date().toISOString(),
    sync_direction: syncDirection,
    local_updated: local.last_updated,
    remote_updated: remote.updatedAt || remote.updated_at,
    resolution,
    local_conflict_file: localConflictPath,
    remote_conflict_file: remoteConflictPath
  };

  console.log('\n⚠️  CONFLICT DETECTED');
  console.log('='.repeat(60));
  console.log(`Article: "${report.article_title}" (ID: ${articleId})`);
  console.log(`Local updated:  ${report.local_updated}`);
  console.log(`Remote updated: ${report.remote_updated}`);
  console.log(`Resolution: ${resolution === 'used_remote' ? 'Using remote (newer)' : 'Using local (newer)'}`);
  console.log('\nConflict files saved:');
  console.log(`  Local:  ${localConflictPath}`);
  console.log(`  Remote: ${remoteConflictPath}`);
  console.log('\n💡 Review and merge manually if needed');
  console.log('='.repeat(60) + '\n');

  return { report, winner };
}

/**
 * Generate local file path for article
 */
export function generateLocalPath(article) {
  const slug = article.slug || article.title.toLowerCase().replace(/\s+/g, '-');
  const id = article.id;

  // Use directory structure: slug-id/article.md
  return path.join(ARTICLES_DIR, `${slug}-${id}`, 'article.md');
}

/**
 * Create a new local article from Featurebase data
 */
export async function createLocalArticle(remoteArticle) {
  const filePath = generateLocalPath(remoteArticle);

  const article = {
    id: remoteArticle.id,
    title: remoteArticle.title,
    slug: remoteArticle.slug,
    category: remoteArticle.collectionId || '',
    content: remoteArticle.content_markdown ||
             (remoteArticle.content ? htmlToMarkdown(remoteArticle.content) : ''),
    last_updated: remoteArticle.updatedAt || remoteArticle.updated_at || new Date().toISOString()
  };

  await writeLocalArticle(article, filePath);

  console.log(`✅ Created: ${article.title}`);

  return { article, filePath };
}

/**
 * Update existing local article from Featurebase data
 */
export async function updateLocalArticle(localPath, remoteArticle) {
  const article = {
    id: remoteArticle.id,
    title: remoteArticle.title,
    slug: remoteArticle.slug,
    category: remoteArticle.collectionId || '',
    content: remoteArticle.content_markdown ||
             (remoteArticle.content ? htmlToMarkdown(remoteArticle.content) : ''),
    last_updated: remoteArticle.updatedAt || remoteArticle.updated_at || new Date().toISOString()
  };

  await writeLocalArticle(article, localPath);

  console.log(`✅ Updated: ${article.title}`);
}

/**
 * Format article data for Featurebase API
 */
export function formatForFeaturebase(article, helpCenterId) {
  return {
    title: article.title,
    slug: article.slug,
    content: markdownToHtml(article.content),
    content_markdown: article.content,
    help_center_id: helpCenterId,
    collection_id: article.category || undefined,
    is_public: true
  };
}

/**
 * Get sync statistics
 */
export async function getSyncStats() {
  const syncState = await loadSyncState();
  const articles = await scanLocalArticles();

  return {
    total_articles: articles.length,
    synced_articles: Object.keys(syncState.articles).length,
    last_sync: syncState.last_sync,
    conflicts: syncState.conflicts.length,
    unsynced_articles: articles.length - Object.keys(syncState.articles).length
  };
}
