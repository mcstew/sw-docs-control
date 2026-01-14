#!/usr/bin/env node
/**
 * Import documentation from Notion export
 * Processes markdown files and organizes them into /docs-source/articles
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTION_EXPORT_DIR = path.join(__dirname, '../notion-export');
const OUTPUT_DIR = path.join(__dirname, '../docs-source/articles');

// Track import progress
const importLog = {
  timestamp: new Date().toISOString(),
  articles: [],
  skipped: [],
  errors: []
};

/**
 * Recursively find all markdown files
 */
async function findMarkdownFiles(dir) {
  const files = [];

  async function traverse(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${currentDir}:`, error.message);
    }
  }

  await traverse(dir);
  return files;
}

/**
 * Extract category from Notion file path
 * e.g., "Private & Shared/Collections/Getting Started/..." -> "getting-started"
 */
function extractCategory(filepath) {
  const parts = filepath.split(path.sep);
  const collectionsIndex = parts.indexOf('Collections');

  if (collectionsIndex !== -1 && collectionsIndex + 1 < parts.length) {
    const category = parts[collectionsIndex + 1];
    return category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
  }

  return 'general';
}

/**
 * Clean up Notion markdown content
 */
function cleanMarkdown(content) {
  // Remove Notion's UUID from headings
  content = content.replace(/\s+[a-f0-9]{32}$/gm, '');

  // Clean up extra whitespace
  content = content.replace(/\n{3,}/g, '\n\n');

  return content.trim();
}

/**
 * Generate clean slug from filename
 */
function generateSlug(filename) {
  // Remove .md extension and Notion UUID
  let slug = filename.replace(/\.md$/, '');
  slug = slug.replace(/\s+[a-f0-9]{32}$/, '');

  // Convert to kebab-case
  slug = slug
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();

  return slug;
}

/**
 * Process a single Notion markdown file
 */
async function processNotionFile(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    const filename = path.basename(filepath);

    // Skip if file is empty or just contains header
    if (content.trim().length < 10) {
      importLog.skipped.push({
        file: filename,
        reason: 'Empty or too short'
      });
      return null;
    }

    // Parse existing frontmatter (if any)
    const { data: existingFrontmatter, content: markdownContent } = matter(content);

    // Clean up the markdown
    const cleanedMarkdown = cleanMarkdown(markdownContent);

    // Extract metadata
    const category = extractCategory(filepath);
    const slug = generateSlug(filename);

    // Extract title from first heading or filename
    let title = existingFrontmatter.title;
    if (!title) {
      const headingMatch = cleanedMarkdown.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
      } else {
        // Use filename as title
        title = filename.replace(/\.md$/, '').replace(/\s+[a-f0-9]{32}$/, '');
      }
    }

    return {
      title,
      slug,
      category,
      markdown: cleanedMarkdown,
      originalPath: filepath,
      importedAt: new Date().toISOString()
    };
  } catch (error) {
    importLog.errors.push({
      file: filepath,
      error: error.message
    });
    return null;
  }
}

/**
 * Save processed article
 */
async function saveArticle(article) {
  const categoryDir = path.join(OUTPUT_DIR, article.category);
  await fs.mkdir(categoryDir, { recursive: true });

  // Create frontmatter
  const frontmatter = `---
title: "${article.title.replace(/"/g, '\\"')}"
slug: ${article.slug}
category: ${article.category}
imported_at: ${article.importedAt}
last_updated: ${article.importedAt}
source: notion
---

`;

  const content = frontmatter + article.markdown;
  const filename = `${article.slug}.md`;
  const filepath = path.join(categoryDir, filename);

  await fs.writeFile(filepath, content, 'utf-8');

  // Save metadata JSON
  const metaPath = path.join(categoryDir, `${article.slug}.meta.json`);
  await fs.writeFile(metaPath, JSON.stringify({
    title: article.title,
    slug: article.slug,
    category: article.category,
    imported_at: article.importedAt,
    last_updated: article.importedAt,
    last_audited: null,
    featurebase_id: null,
    notion_path: article.originalPath
  }, null, 2), 'utf-8');

  importLog.articles.push({
    slug: article.slug,
    title: article.title,
    category: article.category,
    filepath
  });

  console.log(`✓ ${article.category}/${article.slug}`);
}

/**
 * Main import process
 */
async function main() {
  console.log('Importing documentation from Notion export...\n');

  // Clear output directory
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Find all markdown files
  console.log('Scanning for markdown files...');
  const markdownFiles = await findMarkdownFiles(NOTION_EXPORT_DIR);
  console.log(`Found ${markdownFiles.length} markdown files\n`);

  console.log('Processing articles...');

  // Process each file
  for (const filepath of markdownFiles) {
    const article = await processNotionFile(filepath);
    if (article) {
      await saveArticle(article);
    }
  }

  // Save import log
  const logPath = path.join(__dirname, '../docs-source/notion-import-log.json');
  await fs.writeFile(logPath, JSON.stringify(importLog, null, 2), 'utf-8');

  console.log(`\n✓ Import complete!`);
  console.log(`  Articles imported: ${importLog.articles.length}`);
  console.log(`  Skipped: ${importLog.skipped.length}`);
  console.log(`  Errors: ${importLog.errors.length}`);

  if (importLog.skipped.length > 0) {
    console.log(`\n  Skipped files:`);
    importLog.skipped.slice(0, 5).forEach(s => {
      console.log(`    - ${s.file}: ${s.reason}`);
    });
    if (importLog.skipped.length > 5) {
      console.log(`    ... and ${importLog.skipped.length - 5} more`);
    }
  }

  if (importLog.errors.length > 0) {
    console.log(`\n  Errors:`);
    importLog.errors.forEach(e => {
      console.log(`    - ${path.basename(e.file)}: ${e.error}`);
    });
  }

  console.log(`\n  Log saved to: ${logPath}`);
  console.log(`\nNext step: Run 'npm run export' to generate agent training file`);
}

main().catch(console.error);
