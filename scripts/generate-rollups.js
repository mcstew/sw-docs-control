#!/usr/bin/env node
/**
 * Generate AI-ready knowledge files.
 * Keep this in sync with lib/generate-rollups.ts; this CLI version writes the
 * generated strings to disk for local workflows.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanLocalArticles } from '../lib/featurebase-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const COLLECTION_NAMES = {
  '7475072': { main: 'Getting Started', sub: 'Introduction' },
  '6149413': { main: 'Getting Started', sub: 'Sudowrite Manual' },
  '6550900': { main: 'Plans And Account', sub: 'Sudowrite Plans' },
  '5445363': { main: 'Plans And Account', sub: 'Credits' },
  '4304666': { main: 'Plans And Account', sub: 'Your Account' },
  '5442133': { main: 'Using Sudowrite', sub: 'Features' },
  '5279540': { main: 'Using Sudowrite', sub: 'Workflows' },
  '9773420': { main: 'Using Sudowrite', sub: 'Story Bible' },
  '5566496': { main: 'Using Sudowrite', sub: 'Story Smarts' },
  '2165317': { main: 'Using Sudowrite', sub: 'Plugins' },
  '4553298': { main: 'Using Sudowrite', sub: 'Sudowrite Mobile App' },
  '5844132': { main: 'Resources', sub: 'Classes' },
  '8291256': { main: 'Resources', sub: 'Community' },
  '4621459': { main: 'Frequently Asked Questions', sub: null },
  '4964533': { main: 'Legal Stuff', sub: 'The Fine Print' },
  '8861565': { main: 'About Sudowrite', sub: 'More About Us' },
};

const SECTION_ORDER = [
  'Getting Started',
  'Plans And Account',
  'Using Sudowrite',
  'Resources',
  'Frequently Asked Questions',
  'Legal Stuff',
  'About Sudowrite',
];

function getCollection(category) {
  return COLLECTION_NAMES[category] || { main: 'Uncategorized', sub: null };
}

function getDescription(content) {
  const lines = content.split('\n').filter((line) => line.trim());
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('<') || line.startsWith('>') || line.startsWith('!')) {
      continue;
    }
    const cleaned = line.replace(/[*_]/g, '').trim();
    if (cleaned.length > 10) {
      return cleaned.length > 100 ? cleaned.substring(0, 97) + '...' : cleaned;
    }
  }
  return 'Documentation article';
}

function cleanArticleContent(content) {
  return content.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

function groupBySection(articles) {
  const grouped = new Map();

  for (const article of articles) {
    const { main, sub } = getCollection(article.category);
    if (!grouped.has(main)) grouped.set(main, new Map());
    const subKey = sub || 'General';
    const subMap = grouped.get(main);
    if (!subMap.has(subKey)) subMap.set(subKey, []);
    subMap.get(subKey).push(article);
  }

  return grouped;
}

function generateLlmsTxt(articles) {
  const baseUrl = 'https://feedback.sudowrite.com/help';
  const grouped = groupBySection(articles);

  let content = '# Sudowrite Documentation\n\n';
  content += '> AI-optimized documentation for Sudowrite, the AI writing assistant for creative fiction authors.\n\n';
  content += '## Documentation Sections\n\n';

  for (const section of SECTION_ORDER) {
    const subMap = grouped.get(section);
    if (!subMap) continue;

    content += `### ${section}\n\n`;

    for (const [subKey, subArticles] of subMap) {
      if (subKey !== 'General') {
        content += `**${subKey}:**\n\n`;
      }
      for (const article of subArticles) {
        const url = `${baseUrl}/articles/${article.slug}`;
        content += `- [${article.title}](${url}): ${getDescription(article.content)}\n`;
      }
      content += '\n';
    }
  }

  content += '## Additional Resources\n\n';
  content += '- Website: https://www.sudowrite.com\n';
  content += '- Support: hi@sudowrite.com\n';
  content += '- Community: https://discord.gg/sudowrite\n\n';
  content += `---\n\n*Last updated: ${new Date().toISOString()}*\n*Total articles: ${articles.length}*\n`;

  return content;
}

function generateDocsRollup(articles) {
  const grouped = groupBySection(articles);

  let content = '# Sudowrite Documentation - Complete Knowledge Base\n\n';
  content += `> Generated: ${new Date().toISOString()}\n`;
  content += `> Total Articles: ${articles.length}\n\n`;
  content += '---\n\n';

  for (const section of SECTION_ORDER) {
    const subMap = grouped.get(section);
    if (!subMap) continue;

    content += `\n\n# ${section}\n\n---\n\n`;

    for (const [subKey, subArticles] of subMap) {
      if (subKey !== 'General') {
        content += `## ${subKey}\n\n`;
      }
      for (const article of subArticles) {
        const col = getCollection(article.category);
        content += `### ${article.title}\n\n`;
        content += `**Collection:** ${col.main}${col.sub ? ' > ' + col.sub : ''}\n`;
        content += `**Slug:** ${article.slug}\n`;
        if (article.id) content += `**ID:** ${article.id}\n`;
        content += `**Last Updated:** ${article.last_updated || 'Unknown'}\n\n`;
        content += cleanArticleContent(article.content);
        content += '\n\n---\n\n';
      }
    }
  }

  content += `\n\n# End of Documentation\n\nTotal articles: ${articles.length}\n`;

  return content;
}

async function main() {
  console.log('🚀 Generating AI knowledge files...\n');

  const articles = await scanLocalArticles();
  console.log(`📚 Found ${articles.length} articles\n`);

  console.log('📄 Generating llms.txt...');
  await fs.writeFile(path.join(PROJECT_ROOT, 'llms.txt'), generateLlmsTxt(articles), 'utf-8');
  console.log('✅ llms.txt created');

  console.log('📄 Generating docs-rollup.md...');
  await fs.writeFile(path.join(PROJECT_ROOT, 'docs-rollup.md'), generateDocsRollup(articles), 'utf-8');
  console.log('✅ docs-rollup.md created');

  console.log('\n✅ All knowledge files generated successfully!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
