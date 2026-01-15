#!/usr/bin/env node
/**
 * Test the two-stage AI audit engine (V3)
 */

import { runManualAudit } from '../lib/audit-engine-v3.js';
import { config } from 'dotenv';

config();

const SAMPLE_CHANGELOG = `
Bigger, Better Rewrite

We just updated the Rewrite feature so that it can be used on up to 9,000 words. We also changed the model powering it. Rewrite now uses Muse, so you get the highest quality rewrites possible. Happy writing!
`;

async function main() {
  console.log('Testing Two-Stage AI Audit Engine (V3)\n');
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

  try {
    const result = await runManualAudit(SAMPLE_CHANGELOG);

    console.log('\n' + '='.repeat(60));
    console.log('AUDIT RESULTS (V3 - TWO-STAGE)');
    console.log('='.repeat(60));

    console.log(`\nSummary: ${result.summary}`);
    console.log(`\nContradictions Found: ${result.affected_articles.length}`);

    if (result.affected_articles.length > 0) {
      console.log('\nDetails:\n');

      result.affected_articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.article_title} (${article.article_slug})`);
        console.log(`   Edit: ${article.edit_url}`);
        console.log(`   Confidence: ${article.confidence}`);
        console.log(`   Change Type: ${article.change_type}`);
        console.log(`   Issue: ${article.contradiction}`);

        if (article.existing_passage) {
          const excerpt = article.existing_passage.substring(0, 80);
          console.log(`   Existing: "${excerpt}${excerpt.length < article.existing_passage.length ? '...' : ''}"`);
        }

        const correctedExcerpt = article.corrected_text.substring(0, 100);
        console.log(`   Corrected: "${correctedExcerpt}${correctedExcerpt.length < article.corrected_text.length ? '...' : ''}"`);
        console.log('');
      });
    } else {
      console.log('\n✓ No contradictions found!');
      console.log('The existing documentation appears accurate for this update.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('EXPECTED RESULTS');
    console.log('='.repeat(60));
    console.log('\nShould find at least 3 articles:');
    console.log('  1. Quick Start - change "6000 words" to "9,000 words"');
    console.log('  2. Rewrite - add word limit and mention Muse model');
    console.log('  3. Sudowrite Muse - add Rewrite to list of features Muse powers');

    console.log('\n' + '='.repeat(60));
    console.log('COMPARISON');
    console.log('='.repeat(60));
    console.log('\nV1 (full context): Found 2 contradictions, missed Muse article');
    console.log('V2 (Gemini): Quota exhausted, couldn\'t test');
    console.log(`V3 (two-stage): Found ${result.affected_articles.length} contradictions with filtered context`);
    console.log('\nTwo-stage approach should catch more issues by focusing on relevant articles.');

    console.log('\n✓ Audit test complete!');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
