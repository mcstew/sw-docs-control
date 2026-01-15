#!/usr/bin/env node
/**
 * Reconcile local articles with Featurebase
 * Identifies: real articles, junk files, matches, and new articles
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { FeaturebaseClient } from '../lib/featurebase-client.js';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTICLES_DIR = path.join(__dirname, '../docs-source/articles');

// Patterns to identify junk/navigation files
const JUNK_PATTERNS = [
  /^new-collection/i,
  /^your-article-title/i,
  /^an-empty-help-article/i,
  /[a-f0-9]{32}\.md$/i, // UUID-based parent pages
  /^tbd$/i,
];

const JUNK_CATEGORIES = [
  'new-collection',
  'new-collection-954e9a42d43a46748750b8afa636211c.md',
];

/**
 * Get all local markdown files
 */
async function getLocalArticles() {
  const files = [];

  async function traverse(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  await traverse(ARTICLES_DIR);
  return files;
}

/**
 * Parse local article
 */
async function parseLocalArticle(filepath) {
  const content = await fs.readFile(filepath, 'utf-8');
  const { data } = matter(content);

  return {
    filepath,
    title: data.title,
    slug: data.slug,
    category: data.category,
    content: content
  };
}

/**
 * Check if article is junk
 */
function isJunk(article) {
  // Check category
  if (JUNK_CATEGORIES.includes(article.category)) {
    return true;
  }

  // Check slug patterns
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(article.slug)) {
      return true;
    }
  }

  // Check if content is too short (likely empty template)
  if (article.content.length < 100) {
    return true;
  }

  // Check for placeholder titles
  if (/your.*title|empty.*article|untitled/i.test(article.title)) {
    return true;
  }

  return false;
}

/**
 * Get all Featurebase articles
 */
async function getFeaturebaseArticles(client, helpCenterId) {
  let allArticles = [];
  let cursor = null;

  do {
    const params = { help_center_id: helpCenterId, limit: 100 };
    if (cursor) params.cursor = cursor;

    const response = await client.getArticles(params);
    const articles = response?.data || [];
    allArticles = allArticles.concat(articles);
    cursor = response?.nextCursor;
  } while (cursor);

  return allArticles;
}

/**
 * Fuzzy match article titles
 */
function fuzzyMatchTitle(title1, title2) {
  const normalize = (str) =>
    str.toLowerCase()
       .replace(/[^\w\s]/g, '')
       .replace(/\s+/g, ' ')
       .trim();

  return normalize(title1) === normalize(title2);
}

/**
 * Main reconciliation
 */
async function main() {
  console.log('Reconciling local articles with Featurebase...\n');

  // Get local articles
  const localFiles = await getLocalArticles();
  console.log(`Found ${localFiles.length} local markdown files`);

  const localArticles = await Promise.all(
    localFiles.map(f => parseLocalArticle(f))
  );

  // Identify junk
  const junkArticles = localArticles.filter(a => isJunk(a));
  const realArticles = localArticles.filter(a => !isJunk(a));

  console.log(`  Real articles: ${realArticles.length}`);
  console.log(`  Junk/navigation files: ${junkArticles.length}\n`);

  // Get Featurebase articles
  const apiKey = process.env.FEATUREBASE_API_KEY;
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;

  if (!apiKey || !helpCenterId) {
    console.error('Error: Missing FEATUREBASE_API_KEY or FEATUREBASE_HELP_CENTER_ID');
    process.exit(1);
  }

  const client = new FeaturebaseClient(apiKey);
  const fbArticles = await getFeaturebaseArticles(client, helpCenterId);

  console.log(`Featurebase has ${fbArticles.length} published articles\n`);

  // Match articles
  const matches = [];
  const newArticles = [];

  for (const local of realArticles) {
    const fbMatch = fbArticles.find(fb =>
      fuzzyMatchTitle(local.title, fb.title)
    );

    if (fbMatch) {
      matches.push({
        local,
        featurebase: fbMatch
      });
    } else {
      newArticles.push(local);
    }
  }

  console.log(`Matched articles: ${matches.length}`);
  console.log(`New articles (not in Featurebase): ${newArticles.length}\n`);

  // Show junk files
  if (junkArticles.length > 0) {
    console.log('Junk/Navigation files (will be ignored):');
    junkArticles.forEach(a => {
      console.log(`  - ${a.title} (${a.category}/${a.slug})`);
    });
    console.log('');
  }

  // Show new articles
  if (newArticles.length > 0) {
    console.log('New articles to add to Featurebase:');
    newArticles.forEach(a => {
      console.log(`  - ${a.title} (${a.category})`);
    });
    console.log('');
  }

  // Save reconciliation report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      local_total: localArticles.length,
      local_real: realArticles.length,
      local_junk: junkArticles.length,
      featurebase_total: fbArticles.length,
      matched: matches.length,
      new_articles: newArticles.length
    },
    junk_articles: junkArticles.map(a => ({
      title: a.title,
      slug: a.slug,
      category: a.category,
      reason: 'Identified as junk/navigation'
    })),
    new_articles: newArticles.map(a => ({
      title: a.title,
      slug: a.slug,
      category: a.category
    })),
    matches: matches.map(m => ({
      local_title: m.local.title,
      featurebase_title: m.featurebase.title,
      featurebase_id: m.featurebase.id
    }))
  };

  const reportPath = path.join(__dirname, '../docs-source/reconciliation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`✓ Reconciliation complete!`);
  console.log(`  Report saved to: ${reportPath}`);
  console.log(`\nSummary:`);
  console.log(`  Real articles in Git: ${realArticles.length}`);
  console.log(`  Published in Featurebase: ${fbArticles.length}`);
  console.log(`  Already synced: ${matches.length}`);
  console.log(`  Need to add: ${newArticles.length}`);
}

main().catch(console.error);
