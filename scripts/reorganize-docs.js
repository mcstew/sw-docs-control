#!/usr/bin/env node
/**
 * Reorganize documentation into clean structure
 * Renames articles to readable filenames while preserving Featurebase IDs
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLD_DIR = path.join(__dirname, '../docs-source/articles');
const NEW_DIR = path.join(__dirname, '../sudowrite-documentation');

/**
 * Convert title to clean filename
 */
function titleToFilename(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') + '.md';
}

async function main() {
  console.log('📦 Reorganizing documentation...\n');

  // Create new directory
  await fs.mkdir(NEW_DIR, { recursive: true });

  // Find all article.md files
  const entries = await fs.readdir(OLD_DIR, { withFileTypes: true });
  const articles = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const articlePath = path.join(OLD_DIR, entry.name, 'article.md');
      try {
        const exists = await fs.access(articlePath).then(() => true).catch(() => false);
        if (exists) {
          articles.push(articlePath);
        }
      } catch (error) {
        // Skip
      }
    }
  }

  console.log(`Found ${articles.length} articles\n`);

  const results = {
    moved: [],
    errors: []
  };

  // Process each article
  for (const articlePath of articles) {
    try {
      // Read article
      const content = await fs.readFile(articlePath, 'utf-8');
      const { data: frontmatter, content: markdown } = matter(content);

      const title = frontmatter.title || 'Untitled';
      const id = frontmatter.featurebase_id;

      if (!id) {
        console.warn(`⚠️  Skipping ${title} - no featurebase_id`);
        continue;
      }

      // Generate clean filename
      const newFilename = titleToFilename(title);
      const newPath = path.join(NEW_DIR, newFilename);

      // Check if file already exists
      const exists = await fs.access(newPath).then(() => true).catch(() => false);
      if (exists) {
        console.warn(`⚠️  Skipping ${title} - ${newFilename} already exists`);
        continue;
      }

      // Write to new location
      await fs.writeFile(newPath, content, 'utf-8');

      console.log(`✅ ${title}`);
      console.log(`   → ${newFilename}`);
      console.log(`   ID: ${id}\n`);

      results.moved.push({ title, filename: newFilename, id });

    } catch (error) {
      console.error(`❌ Error processing ${articlePath}:`, error.message);
      results.errors.push({ path: articlePath, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('REORGANIZATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Moved:  ${results.moved.length} articles`);
  console.log(`❌ Errors: ${results.errors.length} articles`);
  console.log('='.repeat(60));

  console.log(`\n📁 New location: sudowrite-documentation/`);
  console.log(`   Old location preserved: docs-source/articles/`);
  console.log(`\n💡 Review the new structure, then:`);
  console.log(`   1. Delete docs-source/articles/`);
  console.log(`   2. Update sync scripts to use sudowrite-documentation/`);
  console.log(`   3. Commit to GitHub\n`);

  // Create index
  const indexContent = results.moved
    .map(a => `- [${a.title}](${a.filename}) (ID: ${a.id})`)
    .join('\n');

  await fs.writeFile(
    path.join(NEW_DIR, 'INDEX.md'),
    `# Sudowrite Documentation\n\n${indexContent}\n`,
    'utf-8'
  );

  console.log('📄 Created INDEX.md with all articles\n');
}

main().catch(console.error);
