#!/usr/bin/env node
/**
 * Test the keyword filtering preprocessing
 */

import { filterRelevantArticles, buildFocusedContext } from '../lib/keyword-filter.js';

const SAMPLE_CHANGELOG = `
Bigger, Better Rewrite

We just updated the Rewrite feature so that it can be used on up to 9,000 words. We also changed the model powering it. Rewrite now uses Muse, so you get the highest quality rewrites possible. Happy writing!
`;

async function main() {
  console.log('Testing Keyword-Based Article Filter\n');
  console.log('Sample Changelog:');
  console.log('='.repeat(60));
  console.log(SAMPLE_CHANGELOG);
  console.log('='.repeat(60));
  console.log('\n');

  try {
    const results = await filterRelevantArticles(SAMPLE_CHANGELOG, {
      minScore: 5,
      maxArticles: 15,
      includeContext: false // Don't include full content for this test
    });

    console.log('\n' + '='.repeat(60));
    console.log('FILTERING RESULTS');
    console.log('='.repeat(60));

    console.log(`\nKeywords extracted: ${results.keywords.length}`);
    console.log(`Keywords: ${results.keywords.join(', ')}`);

    console.log(`\nTotal articles scanned: ${results.totalArticles}`);
    console.log(`Relevant articles found: ${results.relevantArticles.length}`);
    console.log(`  High relevance (≥20): ${results.summary.high}`);
    console.log(`  Medium relevance (10-19): ${results.summary.medium}`);
    console.log(`  Low relevance (5-9): ${results.summary.low}`);

    console.log('\n' + '='.repeat(60));
    console.log('TOP RELEVANT ARTICLES');
    console.log('='.repeat(60));

    results.relevantArticles.forEach((article, index) => {
      console.log(`\n${index + 1}. ${article.title} (score: ${article.relevanceScore})`);
      console.log(`   Slug: ${article.slug}`);
      console.log(`   Category: ${article.category}`);
      console.log(`   Matched keywords:`);

      const topMatches = article.keywordMatches
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5);

      topMatches.forEach(match => {
        if (match.type === 'title') {
          console.log(`     - "${match.keyword}" in TITLE (weight: ${match.weight})`);
        } else if (match.type === 'slug') {
          console.log(`     - "${match.keyword}" in slug (weight: ${match.weight})`);
        } else {
          console.log(`     - "${match.keyword}" in content ${match.count}x (weight: ${match.weight})`);
        }
      });
    });

    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS');
    console.log('='.repeat(60));

    // Check if we caught the expected articles
    const expectedArticles = [
      'rewrite',
      'sudowrite-muse',
      'quick-start'
    ];

    console.log('\nExpected articles:');
    expectedArticles.forEach(slug => {
      const found = results.relevantArticles.find(a => a.slug === slug);
      if (found) {
        console.log(`  ✓ ${slug} (score: ${found.relevanceScore})`);
      } else {
        console.log(`  ✗ ${slug} (NOT FOUND - may need to adjust scoring)`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('NEXT STEPS');
    console.log('='.repeat(60));
    console.log('\n1. These filtered articles would be passed to AI audit');
    console.log('2. Context size reduced from ~52K words to ~' +
      Math.round(results.relevantArticles.length * 500) + ' words (est.)');
    console.log('3. AI can focus deeply on each relevant article');
    console.log('4. Lower chance of missing contradictions or hallucinating');

    console.log('\n✓ Keyword filter test complete!');

  } catch (error) {
    console.error('\n❌ Filter test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
