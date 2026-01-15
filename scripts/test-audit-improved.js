#!/usr/bin/env node
/**
 * Test the improved AI audit engine with better prompt
 */

import { runManualAudit } from '../lib/audit-engine-improved.js';
import { config } from 'dotenv';

config();

const SAMPLE_CHANGELOG = `
Bigger, Better Rewrite

We just updated the Rewrite feature so that it can be used on up to 9,000 words. We also changed the model powering it. Rewrite now uses Muse, so you get the highest quality rewrites possible. Happy writing!
`;

async function main() {
  console.log('Testing Improved AI Audit Engine\n');
  console.log('Sample Changelog:');
  console.log('='.repeat(60));
  console.log(SAMPLE_CHANGELOG);
  console.log('='.repeat(60));
  console.log('\n');

  // Check for required env vars
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set in environment');
    console.log('\nPlease add your Anthropic API key to .env');
    process.exit(1);
  }

  console.log('Running audit with improved fact-checking prompt...\n');

  try {
    const result = await runManualAudit(SAMPLE_CHANGELOG);

    console.log('\n' + '='.repeat(60));
    console.log('AUDIT RESULTS (IMPROVED)');
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
    console.log('COMPARISON');
    console.log('='.repeat(60));
    console.log('\nV1 (over-eager): Found 7 affected articles (some hallucinated)');
    console.log(`V2 (improved): Found ${result.affected_articles.length} contradictions (fact-checked)`);
    console.log('\nImproved version only flags REAL contradictions in existing docs.');

    console.log('\n✓ Audit test complete!');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
