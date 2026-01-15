#!/usr/bin/env node
/**
 * Debug Featurebase API responses
 * Check what data we're actually getting from the API
 */

import { config } from 'dotenv';
import { FeaturebaseClient } from '../lib/featurebase-client.js';

config();

async function main() {
  console.log('🔍 Debugging Featurebase API...\n');

  const apiKey = process.env.FEATUREBASE_API_KEY;
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;

  if (!apiKey || !helpCenterId) {
    console.error('❌ Missing API credentials');
    process.exit(1);
  }

  const client = new FeaturebaseClient(apiKey);

  // Test 1: Get articles with default params
  console.log('📋 Test 1: Get articles (default params)');
  console.log('='.repeat(60));
  const response1 = await client.getArticles({ help_center_id: helpCenterId });
  console.log('Response structure:', Object.keys(response1));
  console.log('Number of articles:', response1?.data?.length || 0);
  if (response1?.data?.[0]) {
    console.log('\nFirst article fields:', Object.keys(response1.data[0]));
    console.log('\nFirst article sample:');
    console.log(JSON.stringify(response1.data[0], null, 2));
  }
  console.log('\n');

  // Test 2: Get collections
  console.log('📚 Test 2: Get collections');
  console.log('='.repeat(60));
  const collections = await client.getCollections({ help_center_id: helpCenterId });
  console.log('Collections structure:', Object.keys(collections));
  console.log('Number of collections:', collections?.data?.length || 0);
  if (collections?.data) {
    console.log('\nCollections:');
    collections.data.forEach(col => {
      console.log(`  - ${col.title} (ID: ${col.id})`);
    });
  }
  console.log('\n');

  // Test 3: Try pagination params
  console.log('📄 Test 3: Get articles with pagination (limit=100)');
  console.log('='.repeat(60));
  const response2 = await client.getArticles({
    help_center_id: helpCenterId,
    limit: 100
  });
  console.log('Number of articles:', response2?.data?.length || 0);
  console.log('\n');

  // Test 4: Get a single article by ID to see full content
  if (response1?.data?.[0]?.id) {
    const articleId = response1.data[0].id;
    console.log(`📖 Test 4: Get single article (ID: ${articleId})`);
    console.log('='.repeat(60));
    const singleArticle = await client.getArticle(articleId);
    console.log('Single article fields:', Object.keys(singleArticle.data || singleArticle));
    console.log('\nFull article data:');
    console.log(JSON.stringify(singleArticle, null, 2));
  }
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  if (error.response?.data) {
    console.error('API Response:', JSON.stringify(error.response.data, null, 2));
  }
  process.exit(1);
});
