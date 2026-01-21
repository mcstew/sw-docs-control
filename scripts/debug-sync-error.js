#!/usr/bin/env node
/**
 * Debug sync error - check what's being sent to Featurebase
 */

import { config } from 'dotenv';
import { FeaturebaseClient } from '../lib/featurebase-client.js';
import {
  scanLocalArticles,
  formatForFeaturebaseUpdate
} from '../lib/featurebase-sync.js';

config();

async function main() {
  console.log('🔍 Debugging Featurebase sync error...\n');

  const apiKey = process.env.FEATUREBASE_API_KEY;
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;

  const client = new FeaturebaseClient(apiKey);

  // Load local articles
  const localArticles = await scanLocalArticles();

  // Find the "Write" article (one that failed)
  const writeArticle = localArticles.find(a => a.id === '8378195');

  if (!writeArticle) {
    console.log('❌ Could not find Write article');
    return;
  }

  console.log('📄 Article found:', writeArticle.title);
  console.log('   ID:', writeArticle.id);
  console.log('   Path:', writeArticle.path);
  console.log('   Category:', writeArticle.category);
  console.log('   Content length:', writeArticle.content.length);
  console.log('');

  // Format for Featurebase (UPDATE format)
  const articleData = formatForFeaturebaseUpdate(writeArticle);

  console.log('📤 Data being sent to Featurebase:');
  console.log(JSON.stringify(articleData, null, 2));
  console.log('');

  // Try to update
  console.log('🔄 Attempting to update article...');
  try {
    const result = await client.updateArticle(writeArticle.id, articleData);
    console.log('✅ Success!');
    console.log(result);
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('');
      console.log('📋 Response status:', error.response.status);
      console.log('📋 Response data:', JSON.stringify(error.response.data, null, 2));
      console.log('');

      if (error.response.data?.errors) {
        console.log('🔍 Validation errors:');
        console.log(JSON.stringify(error.response.data.errors, null, 2));
      }
    }
  }
}

main().catch(console.error);
