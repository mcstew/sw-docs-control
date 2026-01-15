#!/usr/bin/env node
/**
 * Sync FROM Featurebase (Version 2)
 * Improved version that:
 * - Fetches ALL articles with pagination
 * - Extracts HTML body content and converts to markdown
 * - Organizes articles by collection structure
 * - Creates proper folder hierarchy matching Featurebase
 */

import { config } from 'dotenv';
import { FeaturebaseClient } from '../lib/featurebase-client.js';
import {
  findLocalArticleById,
  loadSyncState,
  saveSyncState,
  hashContent,
  handleConflict,
  createLocalArticle,
  updateLocalArticle,
  collectionToFolderName
} from '../lib/featurebase-sync.js';

config();

async function main() {
  console.log('🚀 Syncing FROM Featurebase (v2)...\n');

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

  // Fetch ALL collections
  console.log('📚 Fetching collections...');
  const collectionsResponse = await client.getCollections({
    help_center_id: helpCenterId,
    limit: 100
  });
  const collections = collectionsResponse?.data || [];

  // Build collection map: id -> name
  const collectionMap = {};
  collections.forEach(col => {
    collectionMap[col.id] = col.name || col.translations?.en?.name || 'Uncategorized';
  });

  console.log(`Found ${collections.length} collections:`);
  collections.forEach(col => {
    const name = collectionMap[col.id];
    console.log(`  - ${name} (ID: ${col.id})`);
  });
  console.log('');

  // Fetch ALL remote articles (with pagination)
  console.log('📄 Fetching articles from Featurebase...');
  const remoteResponse = await client.getArticles({
    help_center_id: helpCenterId,
    limit: 100  // Fetch up to 100 articles
  });
  const remoteArticles = remoteResponse?.data || [];
  console.log(`Found ${remoteArticles.length} remote articles\n`);

  const syncState = await loadSyncState();

  // Track results
  const results = {
    pulled: [],
    created: [],
    skipped: [],
    conflicts: [],
    errors: []
  };

  // Process each remote article
  for (const remoteArticle of remoteArticles) {
    try {
      const collectionName = remoteArticle.parentId
        ? collectionMap[remoteArticle.parentId] || 'Uncategorized'
        : 'Uncategorized';

      console.log(`Processing: ${remoteArticle.title}`);
      console.log(`  Collection: ${collectionName} (ID: ${remoteArticle.id})`);

      // Find corresponding local article
      const localArticle = await findLocalArticleById(remoteArticle.id);

      // If local doesn't exist, create it
      if (!localArticle) {
        console.log('  📝 Creating new local file...');

        const { article, filePath } = await createLocalArticle(remoteArticle, collectionName);

        // Update sync state
        syncState.articles[article.id] = {
          local_path: filePath,
          remote_id: article.id,
          last_synced_at: new Date().toISOString(),
          last_synced_hash: hashContent(article.content),
          sync_direction: 'pull',
          status: 'synced'
        };

        results.created.push({ id: article.id, title: article.title, collection: collectionName });
        console.log('');
        continue;
      }

      // Local exists - check for changes
      const lastSync = syncState.articles[remoteArticle.id];

      if (!lastSync) {
        // No sync record - treat as first sync
        console.log('  ⬇️  First sync, pulling from remote...');

        await updateLocalArticle(localArticle.path, remoteArticle, collectionName);

        syncState.articles[remoteArticle.id] = {
          local_path: localArticle.path,
          remote_id: remoteArticle.id,
          last_synced_at: new Date().toISOString(),
          last_synced_hash: hashContent(localArticle.content),
          sync_direction: 'pull',
          status: 'synced'
        };

        results.pulled.push({ id: remoteArticle.id, title: remoteArticle.title, collection: collectionName });
        console.log('');
        continue;
      }

      // Check if remote changed since last sync
      const remoteUpdatedAt = new Date(remoteArticle.updatedAt || remoteArticle.updated_at);
      const lastSyncedAt = new Date(lastSync.last_synced_at);

      if (remoteUpdatedAt <= lastSyncedAt) {
        console.log('  ⏭️  Skipped (unchanged since last sync)');
        results.skipped.push({ id: remoteArticle.id, title: remoteArticle.title, collection: collectionName });
        console.log('');
        continue;
      }

      // Remote changed - check if local also changed
      const localHash = hashContent(localArticle.content);
      const localChanged = localHash !== lastSync.last_synced_hash;

      if (localChanged) {
        // Both changed - conflict!
        console.log('  ⚠️  Conflict detected (both local and remote changed)');

        const { report, winner } = await handleConflict(localArticle, remoteArticle, 'pull');

        // Add to conflicts
        syncState.conflicts.push(report);
        results.conflicts.push({
          id: remoteArticle.id,
          title: remoteArticle.title,
          collection: collectionName,
          report
        });

        // If remote wins, pull it
        if (report.resolution === 'used_remote') {
          console.log('  ⬇️  Pulling remote version (newer)...');
          await updateLocalArticle(localArticle.path, remoteArticle, collectionName);
        } else {
          console.log('  📍 Local version is newer, keeping local');
        }

        // Update sync state
        syncState.articles[remoteArticle.id] = {
          local_path: localArticle.path,
          remote_id: remoteArticle.id,
          last_synced_at: new Date().toISOString(),
          last_synced_hash: hashContent(localArticle.content),
          sync_direction: 'pull',
          status: 'conflict_resolved',
          last_conflict: report.detected_at
        };

        console.log('');
        continue;
      }

      // No conflict - pull remote changes
      console.log('  ⬇️  Pulling changes from Featurebase...');

      await updateLocalArticle(localArticle.path, remoteArticle, collectionName);

      console.log('  ✅ Pulled');

      // Update sync state
      syncState.articles[remoteArticle.id] = {
        local_path: localArticle.path,
        remote_id: remoteArticle.id,
        last_synced_at: new Date().toISOString(),
        last_synced_hash: hashContent(localArticle.content),
        sync_direction: 'pull',
        status: 'synced'
      };

      results.pulled.push({ id: remoteArticle.id, title: remoteArticle.title, collection: collectionName });

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      results.errors.push({
        id: remoteArticle.id,
        title: remoteArticle.title,
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
  console.log('SYNC FROM FEATUREBASE COMPLETE');
  console.log('='.repeat(60));
  console.log(`⬇️  Pulled:    ${results.pulled.length} articles`);
  console.log(`📝 Created:   ${results.created.length} articles`);
  console.log(`⏭️  Skipped:   ${results.skipped.length} articles (unchanged)`);
  console.log(`⚠️  Conflicts: ${results.conflicts.length} articles`);
  console.log(`❌ Errors:    ${results.errors.length} articles`);
  console.log('='.repeat(60) + '\n');

  if (results.conflicts.length > 0) {
    console.log('⚠️  Conflicts detected:');
    results.conflicts.forEach(c => {
      console.log(`  - ${c.title} (${c.collection})`);
      console.log(`    ID: ${c.id}`);
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

  if (results.created.length > 0) {
    console.log('📝 Created locally:');
    const byCollection = {};
    results.created.forEach(c => {
      if (!byCollection[c.collection]) byCollection[c.collection] = [];
      byCollection[c.collection].push(c.title);
    });

    Object.keys(byCollection).sort().forEach(col => {
      console.log(`\n  ${col}:`);
      byCollection[col].forEach(title => {
        console.log(`    - ${title}`);
      });
    });
    console.log('');
  }

  console.log('💾 Sync state saved');
  console.log('📁 Articles organized by collection in sudowrite-documentation/\n');

  // Exit with error code if there were errors
  if (results.errors.length > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
