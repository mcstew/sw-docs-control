#!/usr/bin/env node
/**
 * Import documentation from Helpkit (docs.sudowrite.com)
 * Scrapes the site and converts to markdown files in /docs-source/articles
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://docs.sudowrite.com';
const OUTPUT_DIR = path.join(__dirname, '../docs-source/articles');

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

// Keep track of imported articles
const importLog = {
  timestamp: new Date().toISOString(),
  articles: [],
  errors: []
};

/**
 * Fetch and parse a page
 */
async function fetchPage(url) {
  try {
    console.log(`Fetching: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    return cheerio.load(response.data);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    importLog.errors.push({ url, error: error.message });
    return null;
  }
}

/**
 * Extract article links from the main page
 */
async function getArticleLinks() {
  const $ = await fetchPage(BASE_URL);
  if (!$) return [];

  const links = [];

  // Look for article links in navigation or content area
  $('a[href*="/"]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href && !href.startsWith('http') && !href.includes('#') && href !== '/') {
      const fullUrl = href.startsWith('/') ? `${BASE_URL}${href}` : `${BASE_URL}/${href}`;
      if (!links.includes(fullUrl)) {
        links.push(fullUrl);
      }
    }
  });

  console.log(`Found ${links.length} potential article links`);
  return links;
}

/**
 * Extract article content and metadata
 */
async function extractArticle(url) {
  const $ = await fetchPage(url);
  if (!$) return null;

  // Try to find the main content area (adjust selectors based on Helpkit's HTML structure)
  const mainContent = $('article, main, [role="main"], .content, .article-content').first();

  if (!mainContent.length) {
    console.warn(`Could not find main content for ${url}`);
    return null;
  }

  // Extract title
  const title = $('h1').first().text().trim() ||
                $('title').text().trim() ||
                'Untitled Article';

  // Extract metadata
  const description = $('meta[name="description"]').attr('content') || '';

  // Convert HTML to markdown
  const html = mainContent.html();
  const markdown = turndownService.turndown(html || '');

  // Create slug from URL
  const urlPath = new URL(url).pathname;
  const slug = urlPath.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';

  return {
    title,
    slug,
    url,
    description,
    markdown,
    importedAt: new Date().toISOString()
  };
}

/**
 * Save article as markdown file with metadata
 */
async function saveArticle(article) {
  // Determine category from slug (e.g., "getting-started-welcome" -> "getting-started")
  const parts = article.slug.split('-');
  const category = parts.length > 1 ? parts[0] : 'general';

  const categoryDir = path.join(OUTPUT_DIR, category);
  await fs.mkdir(categoryDir, { recursive: true });

  // Create frontmatter
  const frontmatter = `---
title: "${article.title.replace(/"/g, '\\"')}"
slug: ${article.slug}
url: ${article.url}
description: "${article.description.replace(/"/g, '\\"')}"
category: ${category}
imported_at: ${article.importedAt}
last_updated: ${article.importedAt}
---

`;

  const content = frontmatter + article.markdown;
  const filename = `${article.slug}.md`;
  const filepath = path.join(categoryDir, filename);

  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`✓ Saved: ${filepath}`);

  // Also save metadata as JSON
  const metaPath = path.join(categoryDir, `${article.slug}.meta.json`);
  await fs.writeFile(metaPath, JSON.stringify({
    title: article.title,
    slug: article.slug,
    url: article.url,
    description: article.description,
    category: category,
    imported_at: article.importedAt,
    last_updated: article.importedAt,
    last_audited: null,
    featurebase_id: null
  }, null, 2), 'utf-8');

  importLog.articles.push({
    slug: article.slug,
    title: article.title,
    filepath
  });
}

/**
 * Main import process
 */
async function main() {
  console.log('Starting import from docs.sudowrite.com...\n');

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Get all article links
  const links = await getArticleLinks();

  if (links.length === 0) {
    console.error('No article links found. The site structure may have changed.');
    console.log('Attempting to import the homepage as a fallback...');
    links.push(BASE_URL);
  }

  // Import each article
  for (const url of links) {
    const article = await extractArticle(url);
    if (article && article.markdown.trim()) {
      await saveArticle(article);
    }

    // Be nice to the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Save import log
  const logPath = path.join(__dirname, '../docs-source/import-log.json');
  await fs.writeFile(logPath, JSON.stringify(importLog, null, 2), 'utf-8');

  console.log(`\n✓ Import complete!`);
  console.log(`  Articles imported: ${importLog.articles.length}`);
  console.log(`  Errors: ${importLog.errors.length}`);
  console.log(`  Log saved to: ${logPath}`);
}

main().catch(console.error);
