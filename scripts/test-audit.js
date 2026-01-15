#!/usr/bin/env node
/**
 * Test the AI audit engine with a sample changelog entry
 */

import { runManualAudit } from '../lib/audit-engine.js';
import { config } from 'dotenv';

config();

const SAMPLE_CHANGELOG = `
We've just released a major update to the Story Bible feature!

## What's New

- **Enhanced Character Profiles**: You can now add custom fields to character profiles, including physical descriptions, motivations, and relationships
- **Scene Context**: Story Bible now automatically pulls in context from your current scene to provide more relevant suggestions
- **Export Functionality**: Export your Story Bible as PDF or markdown for offline reference

## Breaking Changes

- The old "Character Notes" feature has been replaced with the new Character Profiles
- Story Bible now requires 50 credits per generation instead of 30 credits

## How to Use

Access the updated Story Bible from the sidebar. Your existing character notes will be automatically migrated to the new format.
`;

async function main() {
  console.log('Testing AI Audit Engine\n');
  console.log('Sample Changelog:');
  console.log('='.repeat(60));
  console.log(SAMPLE_CHANGELOG);
  console.log('='.repeat(60));
  console.log('\n');

  // Check for required env vars
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set in environment');
    console.log('\nPlease add your Anthropic API key to .env:');
    console.log('ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  console.log('Running audit...\n');

  try {
    const result = await runManualAudit(SAMPLE_CHANGELOG);

    console.log('\n' + '='.repeat(60));
    console.log('AUDIT RESULTS');
    console.log('='.repeat(60));

    console.log(`\nSummary: ${result.summary}`);
    console.log(`\nAffected Articles: ${result.affected_articles.length}`);

    if (result.affected_articles.length > 0) {
      console.log('\nDetails:\n');

      result.affected_articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.article_title}`);
        console.log(`   Confidence: ${article.confidence}`);
        console.log(`   Reason: ${article.reason}`);

        if (article.specific_passage) {
          console.log(`   Current: "${article.specific_passage.substring(0, 80)}..."`);
        }

        console.log(`   Suggested: ${article.suggested_change.substring(0, 100)}...`);
        console.log('');
      });
    }

    console.log('✓ Audit test complete!');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
