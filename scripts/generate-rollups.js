#!/usr/bin/env node
/**
 * Generate AI-ready knowledge files
 * Creates both llms.txt (index) and docs-rollup.md (full content)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanLocalArticles } from '../lib/featurebase-sync.js';
import { COLLECTION_HIERARCHY } from '../lib/collection-hierarchy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Get collection name from ID
function getCollectionName(collectionId) {
  const hierarchy = COLLECTION_HIERARCHY[collectionId];
  if (!hierarchy) return 'Uncategorized';

  // Format: "Main Collection > Subcollection"
  const parts = [];

  // Convert kebab-case to Title Case
  const toTitleCase = (str) => str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  parts.push(toTitleCase(hierarchy.main));
  if (hierarchy.sub) {
    parts.push(toTitleCase(hierarchy.sub));
  }

  return parts.join(' > ');
}

// Group articles by main collection
function groupArticles(articles) {
  const grouped = {};

  for (const article of articles) {
    const hierarchy = COLLECTION_HIERARCHY[article.category];
    const mainCollection = hierarchy
      ? hierarchy.main
      : 'uncategorized';

    if (!grouped[mainCollection]) {
      grouped[mainCollection] = [];
    }
    grouped[mainCollection].push(article);
  }

  return grouped;
}

async function generateLlmsTxt(articles) {
  console.log('📄 Generating llms.txt...');

  const baseUrl = 'https://docs.sudowrite.com'; // Update with your actual docs URL

  let content = `# Sudowrite Documentation

> AI-optimized documentation for Sudowrite, the AI writing assistant for creative fiction authors.

## Overview

Sudowrite is an AI-powered writing partner designed to help authors achieve their writing goals. It functions as a junior writing assistant, editor, and creative companion that helps writers get unstuck, stay inspired, maintain organization, and speed up their creative process.

This documentation covers:
- Getting started with Sudowrite
- Account management and plans
- Core features and workflows
- Story Bible and Story Smarts
- Plugins and mobile app
- Resources and community

## Documentation Sections

`;

  // Group by main collection
  const grouped = groupArticles(articles);

  // Sort main collections
  const collectionOrder = [
    'getting-started',
    'plans-and-account',
    'using-sudowrite',
    'resources',
    'frequently-asked-questions',
    'legal-stuff',
    'about-sudowrite',
    'uncategorized'
  ];

  for (const mainKey of collectionOrder) {
    const articlesInCollection = grouped[mainKey];
    if (!articlesInCollection) continue;

    // Format section header
    const sectionTitle = mainKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    content += `### ${sectionTitle}\n\n`;

    // Group by subcollection
    const subgroups = {};
    for (const article of articlesInCollection) {
      const hierarchy = COLLECTION_HIERARCHY[article.category];
      const subKey = hierarchy?.sub || 'general';

      if (!subgroups[subKey]) {
        subgroups[subKey] = [];
      }
      subgroups[subKey].push(article);
    }

    // Output articles grouped by subcollection
    for (const [subKey, subArticles] of Object.entries(subgroups)) {
      if (subKey !== 'general') {
        const subTitle = subKey
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        content += `**${subTitle}:**\n\n`;
      }

      for (const article of subArticles) {
        const url = article.id
          ? `${baseUrl}/articles/${article.id}`
          : `${baseUrl}/${article.slug}`;
        content += `- [${article.title}](${url}): ${getArticleDescription(article)}\n`;
      }
      content += '\n';
    }
  }

  content += `## Additional Resources

- Website: https://www.sudowrite.com
- Support: hi@sudowrite.com
- Community: https://discord.gg/sudowrite

---

*Last updated: ${new Date().toISOString()}*
*Total articles: ${articles.length}*
`;

  await fs.writeFile(path.join(PROJECT_ROOT, 'llms.txt'), content, 'utf-8');
  console.log('✅ llms.txt created');
}

async function generateDocsRollup(articles) {
  console.log('📄 Generating docs-rollup.md...');

  let content = `# Sudowrite Documentation - Complete Knowledge Base

> Generated: ${new Date().toISOString()}
> Total Articles: ${articles.length}

This file contains the complete Sudowrite documentation in a single document for AI training and reference purposes.

---

`;

  // Group by main collection
  const grouped = groupArticles(articles);

  // Sort main collections
  const collectionOrder = [
    'getting-started',
    'plans-and-account',
    'using-sudowrite',
    'resources',
    'frequently-asked-questions',
    'legal-stuff',
    'about-sudowrite',
    'uncategorized'
  ];

  for (const mainKey of collectionOrder) {
    const articlesInCollection = grouped[mainKey];
    if (!articlesInCollection) continue;

    // Format section header
    const sectionTitle = mainKey
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    content += `\n\n# ${sectionTitle}\n\n`;
    content += `---\n\n`;

    // Sort articles by subcollection
    const subgroups = {};
    for (const article of articlesInCollection) {
      const hierarchy = COLLECTION_HIERARCHY[article.category];
      const subKey = hierarchy?.sub || 'general';

      if (!subgroups[subKey]) {
        subgroups[subKey] = [];
      }
      subgroups[subKey].push(article);
    }

    // Output articles grouped by subcollection
    for (const [subKey, subArticles] of Object.entries(subgroups)) {
      if (subKey !== 'general') {
        const subTitle = subKey
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        content += `## ${subTitle}\n\n`;
      }

      for (const article of subArticles) {
        content += `### ${article.title}\n\n`;
        content += `**Collection:** ${getCollectionName(article.category)}\n`;
        content += `**Slug:** ${article.slug}\n`;
        if (article.id) {
          content += `**ID:** ${article.id}\n`;
        }
        content += `**Last Updated:** ${article.last_updated || 'Unknown'}\n\n`;

        // Add article content (strip frontmatter header if present)
        const contentWithoutFrontmatter = article.content.replace(/^---\n[\s\S]*?\n---\n/, '');
        content += contentWithoutFrontmatter;
        content += '\n\n---\n\n';
      }
    }
  }

  content += `\n\n# End of Documentation\n\nTotal sections: ${collectionOrder.length}\nTotal articles: ${articles.length}\n`;

  await fs.writeFile(path.join(PROJECT_ROOT, 'docs-rollup.md'), content, 'utf-8');
  console.log('✅ docs-rollup.md created');
}

// Extract a brief description from article content
function getArticleDescription(article) {
  // Remove frontmatter
  const content = article.content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Get first paragraph (after title)
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Skip headings
    if (line.startsWith('#')) continue;

    // Skip HTML comments and aside blocks
    if (line.startsWith('<') || line.startsWith('>')) continue;

    // Return first real paragraph, truncated
    const cleaned = line.replace(/[*_]/g, '').trim();
    if (cleaned.length > 10) {
      return cleaned.length > 100
        ? cleaned.substring(0, 97) + '...'
        : cleaned;
    }
  }

  return 'Documentation article';
}

async function main() {
  console.log('🚀 Generating AI knowledge files...\n');

  // Load all articles
  const articles = await scanLocalArticles();
  console.log(`📚 Found ${articles.length} articles\n`);

  // Generate both files
  await generateLlmsTxt(articles);
  await generateDocsRollup(articles);

  console.log('\n✅ All knowledge files generated successfully!');
  console.log('\nFiles created:');
  console.log('  - llms.txt (structured index)');
  console.log('  - docs-rollup.md (complete knowledge base)');
}

main().catch(console.error);
