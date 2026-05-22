#!/usr/bin/env node
/**
 * Sync TO Featurebase
 * Push local markdown changes to Featurebase help center
 */

import { config } from 'dotenv';
import fs from 'fs/promises';
import matter from 'gray-matter';
import { FeaturebaseClient } from '../lib/featurebase-client.js';
import {
  scanLocalArticles,
  loadSyncState,
  saveSyncState,
  hashContent,
  handleConflict,
  formatForFeaturebaseCreate,
  formatForFeaturebaseUpdate
} from '../lib/featurebase-sync.js';

config();

async function markArticleSynced(article, syncedAt) {
  article.frontmatter = {
    ...article.frontmatter,
    synced_at: syncedAt,
    source: 'featurebase'
  };
  await fs.writeFile(article.path, matter.stringify(article.content, article.frontmatter), 'utf-8');
}

async function main() {
  console.log('🚀 Syncing TO Featurebase...\n');

  // Validate environment variables
  const apiKey = process.env.FEATUREBASE_API_KEY;
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;

  if (!apiKey) {
    console.error('❌ Error: FEATUREBASE_API_KEY not found in environment');
    process.exit(1);
  }

  if (!helpCenterId) {
    console.error('❌ Error: FEATUREBASE_HELP_CENTER_ID not found in environment');
    process.exit(1);
  }

  // Initialize client
  const client = new FeaturebaseClient(apiKey);

  // Test connection
  console.log('Testing Featurebase connection...');
  const testResult = await client.testConnection();

  if (!testResult.success) {
    console.error('❌ Failed to connect to Featurebase');
    console.error('Error:', testResult.error);
    process.exit(1);
  }

  console.log('✅ Connected to Featurebase\n');

  // Load local articles and sync state
  console.log('Loading local articles...');
  const localArticles = await scanLocalArticles();
  console.log(`Found ${localArticles.length} local articles\n`);

  const syncState = await loadSyncState();

  // Track results
  const results = {
    pushed: [],
    skipped: [],
    conflicts: [],
    errors: [],
    created: []
  };

  // Process each local article
  for (const article of localArticles) {
    try {
      console.log(`Processing: ${article.title} (${article.id})`);

      // Calculate content hash
      const localHash = hashContent(article.content);
      const lastSync = syncState.articles[article.id];

      // Skip if unchanged since last sync
      if (lastSync && lastSync.last_synced_hash === localHash) {
        console.log('  ⏭️  Skipped (unchanged since last sync)');
        results.skipped.push({ id: article.id, title: article.title });
        continue;
      }

      // Try to fetch remote article
      let remoteArticle;
      let articleExists = false;

      try {
        remoteArticle = await client.getArticle(article.id);
        articleExists = true;
      } catch (error) {
        if (error.response?.status === 404) {
          articleExists = false;
        } else {
          throw error;
        }
      }

      // If article doesn't exist on remote, create it
      if (!articleExists) {
        console.log('  📝 Creating new article on Featurebase...');

        const articleData = formatForFeaturebaseCreate(article, helpCenterId);

        const created = await client.createArticle(articleData);
        const syncedAt = new Date().toISOString();

        console.log(`  ✅ Created: ${created.title || article.title}`);
        await markArticleSynced(article, syncedAt);

        // Update sync state
        syncState.articles[article.id] = {
          local_path: article.path,
          remote_id: created.id,
          last_synced_at: syncedAt,
          last_synced_hash: localHash,
          sync_direction: 'push',
          status: 'synced'
        };

        results.created.push({ id: article.id, title: article.title });
        continue;
      }

      // Check for conflict
      if (lastSync) {
        const remoteUpdatedAt = new Date(remoteArticle.updatedAt || remoteArticle.updated_at);
        const lastSyncedAt = new Date(lastSync.last_synced_at);

        // Both changed since last sync
        if (remoteUpdatedAt > lastSyncedAt) {
          const localUpdatedAt = new Date(article.last_updated);

          if (localUpdatedAt > lastSyncedAt) {
            console.log('  ⚠️  Conflict detected (both local and remote changed)');

            const { report, winner } = await handleConflict(article, remoteArticle, 'push');

            // Add to conflicts
            syncState.conflicts.push(report);
            results.conflicts.push({ id: article.id, title: article.title, report });

            // If local wins, push it
            if (report.resolution === 'used_local') {
              console.log('  📤 Pushing local version (newer)...');
              const articleData = formatForFeaturebaseUpdate(article);
              await client.updateArticle(article.id, articleData);
              await markArticleSynced(article, new Date().toISOString());
            } else {
              console.log('  ⬇️  Remote version is newer, skipping push');
            }

            // Update sync state
            syncState.articles[article.id] = {
              local_path: article.path,
              remote_id: article.id,
              last_synced_at: new Date().toISOString(),
              last_synced_hash: localHash,
              sync_direction: 'push',
              status: 'conflict_resolved',
              last_conflict: report.detected_at
            };

            continue;
          }
        }
      }

      // No conflict - push local changes
      console.log('  📤 Pushing to Featurebase...');

      const articleData = formatForFeaturebaseUpdate(article);
      await client.updateArticle(article.id, articleData);
      const syncedAt = new Date().toISOString();

      console.log('  ✅ Pushed');
      await markArticleSynced(article, syncedAt);

      // Update sync state
      syncState.articles[article.id] = {
        local_path: article.path,
        remote_id: article.id,
        last_synced_at: syncedAt,
        last_synced_hash: localHash,
        sync_direction: 'push',
        status: 'synced'
      };

      results.pushed.push({ id: article.id, title: article.title });

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      results.errors.push({
        id: article.id,
        title: article.title,
        error: error.message
      });
    }

    console.log(''); // Blank line between articles
  }

  // Update last sync time
  syncState.last_sync = new Date().toISOString();

  // Save sync state
  await saveSyncState(syncState);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SYNC TO FEATUREBASE COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Pushed:    ${results.pushed.length} articles`);
  console.log(`📝 Created:   ${results.created.length} articles`);
  console.log(`⏭️  Skipped:   ${results.skipped.length} articles (unchanged)`);
  console.log(`⚠️  Conflicts: ${results.conflicts.length} articles`);
  console.log(`❌ Errors:    ${results.errors.length} articles`);
  console.log('='.repeat(60) + '\n');

  if (results.conflicts.length > 0) {
    console.log('⚠️  Conflicts detected:');
    results.conflicts.forEach(c => {
      console.log(`  - ${c.title} (ID: ${c.id})`);
      console.log(`    See: docs-source/conflicts/${c.id}-*`);
    });
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log('❌ Errors occurred:');
    results.errors.forEach(e => {
      console.log(`  - ${e.title}: ${e.error}`);
    });
    console.log('');
  }

  if (results.pushed.length > 0) {
    console.log('✅ Successfully pushed:');
    results.pushed.forEach(p => {
      console.log(`  - ${p.title}`);
    });
    console.log('');
  }

  if (results.created.length > 0) {
    console.log('📝 Created on Featurebase:');
    results.created.forEach(c => {
      console.log(`  - ${c.title}`);
    });
    console.log('');
  }

  console.log('💾 Sync state saved to docs-source/sync-state.json');
  console.log('');

  // Regenerate AI knowledge files if any articles were pushed or created
  if (results.pushed.length > 0 || results.created.length > 0) {
    console.log('🤖 Regenerating AI knowledge files...');
    const { execSync } = await import('child_process');
    try {
      execSync('node scripts/generate-rollups.js', {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      console.log('');
    } catch (error) {
      console.error('⚠️  Warning: Failed to regenerate knowledge files');
      console.error(error.message);
    }
  }

  // Exit with error code if there were errors
  if (results.errors.length > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
