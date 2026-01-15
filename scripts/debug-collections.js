#!/usr/bin/env node
/**
 * Debug collections structure
 */

import { config } from 'dotenv';
import { FeaturebaseClient } from '../lib/featurebase-client.js';

config();

async function main() {
  const apiKey = process.env.FEATUREBASE_API_KEY;
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;

  const client = new FeaturebaseClient(apiKey);

  // Get all collections with pagination
  const collections = await client.getCollections({
    help_center_id: helpCenterId,
    limit: 100
  });

  console.log('📚 Collections:');
  console.log('Total:', collections.data.length);
  console.log('\n');

  // Print each collection with full details
  for (const col of collections.data) {
    console.log(JSON.stringify(col, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

main().catch(console.error);
