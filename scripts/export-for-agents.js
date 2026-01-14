#!/usr/bin/env node
/**
 * Generate full-scroll markdown export for AI agent training
 * Consolidates all documentation into a single markdown file
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTICLES_DIR = path.join(__dirname, '../docs-source/articles');
const EXPORTS_DIR = path.join(__dirname, '../docs-source/exports');

/**
 * Get all markdown files recursively
 */
async function getAllMarkdownFiles(dir) {
  const files = [];

  async function traverse(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  await traverse(dir);
  return files;
}

/**
 * Parse markdown file and extract frontmatter
 */
async function parseMarkdownFile(filepath) {
  const content = await fs.readFile(filepath, 'utf-8');
  const { data, content: markdown } = matter(content);

  return {
    filepath,
    frontmatter: data,
    markdown,
    category: data.category || 'uncategorized'
  };
}

/**
 * Sort articles by category and title
 */
function sortArticles(articles) {
  return articles.sort((a, b) => {
    // First sort by category
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    // Then by title
    const titleA = a.frontmatter.title || '';
    const titleB = b.frontmatter.title || '';
    return titleA.localeCompare(titleB);
  });
}

/**
 * Generate full-scroll markdown
 */
function generateFullScroll(articles) {
  let output = `# Sudowrite Documentation\n\n`;
  output += `> Complete documentation export for AI agent training\n`;
  output += `> Generated: ${new Date().toISOString()}\n`;
  output += `> Total Articles: ${articles.length}\n\n`;

  output += `---\n\n`;

  // Table of contents
  output += `## Table of Contents\n\n`;
  let currentCategory = null;

  articles.forEach((article, index) => {
    if (article.category !== currentCategory) {
      currentCategory = article.category;
      output += `\n### ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}\n\n`;
    }

    const title = article.frontmatter.title || 'Untitled';
    output += `${index + 1}. [${title}](#article-${index + 1})\n`;
  });

  output += `\n---\n\n`;

  // Full content
  currentCategory = null;

  articles.forEach((article, index) => {
    if (article.category !== currentCategory) {
      currentCategory = article.category;
      output += `\n# ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}\n\n`;
    }

    const title = article.frontmatter.title || 'Untitled';
    output += `## Article ${index + 1}: ${title}\n\n`;
    output += `<a id="article-${index + 1}"></a>\n\n`;

    if (article.frontmatter.description) {
      output += `> ${article.frontmatter.description}\n\n`;
    }

    output += article.markdown.trim() + '\n\n';
    output += `---\n\n`;
  });

  return output;
}

/**
 * Generate summary statistics
 */
function generateStats(articles) {
  const stats = {
    totalArticles: articles.length,
    categories: {},
    totalWords: 0,
    totalCharacters: 0
  };

  articles.forEach(article => {
    // Count by category
    if (!stats.categories[article.category]) {
      stats.categories[article.category] = 0;
    }
    stats.categories[article.category]++;

    // Count words and characters
    const words = article.markdown.split(/\s+/).length;
    stats.totalWords += words;
    stats.totalCharacters += article.markdown.length;
  });

  return stats;
}

/**
 * Main export process
 */
async function main() {
  console.log('Generating agent training export...\n');

  // Create exports directory
  await fs.mkdir(EXPORTS_DIR, { recursive: true });

  // Get all markdown files
  const markdownFiles = await getAllMarkdownFiles(ARTICLES_DIR);

  if (markdownFiles.length === 0) {
    console.error('Error: No markdown files found in', ARTICLES_DIR);
    console.log('Run: npm run import (to import documentation first)');
    process.exit(1);
  }

  console.log(`Found ${markdownFiles.length} article(s)\n`);

  // Parse all articles
  const articles = await Promise.all(
    markdownFiles.map(file => parseMarkdownFile(file))
  );

  // Sort articles
  const sortedArticles = sortArticles(articles);

  // Generate full scroll
  const fullScroll = generateFullScroll(sortedArticles);

  // Save full scroll
  const fullScrollPath = path.join(EXPORTS_DIR, 'full-scroll.md');
  await fs.writeFile(fullScrollPath, fullScroll, 'utf-8');

  console.log(`✓ Generated: ${fullScrollPath}`);

  // Generate and save stats
  const stats = generateStats(sortedArticles);
  const statsPath = path.join(EXPORTS_DIR, 'export-stats.json');
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), 'utf-8');

  console.log(`✓ Generated: ${statsPath}\n`);

  // Display stats
  console.log('Export Statistics:');
  console.log(`  Total Articles: ${stats.totalArticles}`);
  console.log(`  Total Words: ${stats.totalWords.toLocaleString()}`);
  console.log(`  Total Characters: ${stats.totalCharacters.toLocaleString()}`);
  console.log(`\n  Articles by Category:`);

  Object.entries(stats.categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`    ${category}: ${count}`);
    });

  console.log('\n✓ Export complete!');
  console.log('\nThe full-scroll.md file is ready to be used as training material for:');
  console.log('  - ChatGPT (Custom GPTs)');
  console.log('  - Claude (Projects)');
  console.log('  - ElevenLabs (Voice agents)');
  console.log('  - Any AI agent that accepts markdown knowledge bases');
}

main().catch(console.error);
