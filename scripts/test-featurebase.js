#!/usr/bin/env node
/**
 * Test Featurebase API connection and explore the help center structure
 */

import { FeaturebaseClient } from '../lib/featurebase-client.js';
import { config } from 'dotenv';

config();

async function main() {
  const apiKey = process.env.FEATUREBASE_API_KEY;

  if (!apiKey) {
    console.error('Error: FEATUREBASE_API_KEY not found in environment');
    console.log('Please create a .env file with your API key:');
    console.log('FEATUREBASE_API_KEY=your_api_key_here');
    process.exit(1);
  }

  const client = new FeaturebaseClient(apiKey);

  console.log('Testing Featurebase API connection...\n');

  // Test connection
  const result = await client.testConnection();

  if (!result.success) {
    console.error('❌ API connection failed!');
    console.error('Error:', result.error);
    if (result.response) {
      console.error('Response:', JSON.stringify(result.response, null, 2));
    }
    process.exit(1);
  }

  console.log('✓ API connection successful!\n');

  // Show help centers
  const helpCenters = result.helpCenters?.data || [];

  console.log(`Found ${helpCenters.length} help center(s):\n`);

  for (const hc of helpCenters) {
    console.log(`  ID: ${hc.id}`);
    console.log(`  Name: ${hc.displayName || hc.title}`);
    console.log(`  URL: ${hc.urls?.featurebaseSubpath || 'N/A'}`);
    console.log(`  Public: ${hc.isPublic ? 'Yes' : 'No'}`);
    console.log('');

    // Get articles for this help center
    try {
      const articlesResponse = await client.getArticles({ help_center_id: hc.id });
      const articles = articlesResponse?.data || [];
      console.log(`  Articles: ${articles.length}`);

      if (articles.length > 0) {
        console.log(`  Sample articles:`);
        articles.slice(0, 5).forEach(article => {
          console.log(`    - ${article.title} (ID: ${article.id})`);
        });
        if (articles.length > 5) {
          console.log(`    ... and ${articles.length - 5} more`);
        }
      }
      console.log('');
    } catch (error) {
      console.error(`  Error fetching articles:`, error.message);
    }

    // Get collections
    try {
      const collectionsResponse = await client.getCollections({ help_center_id: hc.id });
      const collections = collectionsResponse?.data || [];
      console.log(`  Collections: ${collections.length}`);

      if (collections.length > 0) {
        console.log(`  Collection list:`);
        collections.forEach(col => {
          console.log(`    - ${col.displayName || col.name} (ID: ${col.id})`);
        });
      }
      console.log('');
    } catch (error) {
      console.error(`  Error fetching collections:`, error.message);
    }
  }

  console.log('Test complete!');
  console.log('\nNext steps:');
  console.log('1. Add the help center ID to your .env file:');
  console.log(`   FEATUREBASE_HELP_CENTER_ID=${helpCenters[0]?.id || 'your_help_center_id'}`);
  console.log('2. Run: npm run import (to import from Helpkit)');
  console.log('3. Run: npm run export (to generate agent training file)');
}

main().catch(console.error);
