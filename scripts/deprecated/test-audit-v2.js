#!/usr/bin/env node
/**
 * Test the improved AI audit engine (V2) with Gemini 3 Flash
 */

import { runManualAudit } from '../lib/audit-engine-v2.js';
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
  console.log('Testing AI Audit Engine V2 (Gemini 3 Flash)\n');
  console.log('Sample Changelog:');
  console.log('='.repeat(60));
  console.log(SAMPLE_CHANGELOG);
  console.log('='.repeat(60));
  console.log('\n');

  // Check for required env vars
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('Error: GOOGLE_AI_API_KEY or GEMINI_API_KEY not set in environment');
    console.log('\nPlease add your Google AI API key to .env:');
    console.log('GOOGLE_AI_API_KEY=your-key-here');
    console.log('\nGet your key at: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  console.log('Running audit with improved prompt...\n');

  try {
    const result = await runManualAudit(SAMPLE_CHANGELOG);

    console.log('\n' + '='.repeat(60));
    console.log('AUDIT RESULTS (V2)');
    console.log('='.repeat(60));

    console.log(`\nSummary: ${result.summary}`);
    console.log(`\nContradictions Found: ${result.affected_articles.length}`);

    if (result.affected_articles.length > 0) {
      console.log('\nDetails:\n');

      result.affected_articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.article_title}`);
        console.log(`   Confidence: ${article.confidence}`);
        console.log(`   Contradiction: ${article.contradiction}`);

        if (article.existing_passage) {
          console.log(`   Existing: "${article.existing_passage.substring(0, 80)}..."`);
        }

        console.log(`   Corrected: ${article.corrected_text.substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('\n✓ No contradictions found!');
      console.log('The existing documentation appears accurate for this update.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('COMPARISON WITH V1');
    console.log('='.repeat(60));
    console.log('\nV1 (Claude): Found 7 affected articles (some hallucinated)');
    console.log(`V2 (Gemini): Found ${result.affected_articles.length} contradictions (fact-checked)`);
    console.log('\nV2 should only flag REAL contradictions in existing docs.');

    console.log('\n✓ Audit test complete!');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
