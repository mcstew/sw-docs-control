/**
 * Keyword-based preprocessing to filter potentially impacted articles
 * This reduces the search space for AI audits and improves accuracy
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTICLES_DIR = path.join(__dirname, '../docs-source/articles');

/**
 * Extract keywords and phrases from changelog text
 * Uses simple heuristics to identify important terms
 */
function extractKeywords(changelogText) {
  const keywords = new Set();

  // Extract capitalized words (likely feature names)
  const capitalizedWords = changelogText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  capitalizedWords.forEach(word => keywords.add(word.toLowerCase()));

  // Extract quoted phrases
  const quotedPhrases = changelogText.match(/"([^"]+)"/g) || [];
  quotedPhrases.forEach(phrase => {
    keywords.add(phrase.replace(/"/g, '').toLowerCase());
  });

  // Extract numbers (version numbers, credit amounts, word limits, etc.)
  const numbers = changelogText.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  numbers.forEach(num => keywords.add(num.replace(/,/g, '')));

  // Common feature-related terms
  const commonTerms = [
    'story bible', 'write', 'rewrite', 'describe', 'expand', 'brainstorm',
    'canvas', 'draft', 'chat', 'scenes', 'character', 'worldbuilding',
    'muse', 'claude', 'gpt', 'gemini', 'credits', 'model', 'prose mode',
    'beta', 'feature', 'update', 'new', 'improved', 'changed'
  ];

  const lowerText = changelogText.toLowerCase();
  commonTerms.forEach(term => {
    if (lowerText.includes(term)) {
      keywords.add(term);
    }
  });

  return Array.from(keywords);
}

/**
 * Calculate relevance score for an article based on keyword matches
 */
function scoreArticle(articleContent, articleMeta, keywords) {
  const lowerContent = articleContent.toLowerCase();
  const lowerTitle = articleMeta.title?.toLowerCase() || '';
  const lowerSlug = articleMeta.slug?.toLowerCase() || '';

  let score = 0;
  const matches = [];

  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();

    // Title match is highly relevant
    if (lowerTitle.includes(keywordLower)) {
      score += 10;
      matches.push({ type: 'title', keyword, weight: 10 });
    }

    // Slug match is also highly relevant
    if (lowerSlug.includes(keywordLower)) {
      score += 8;
      matches.push({ type: 'slug', keyword, weight: 8 });
    }

    // Count content mentions (with diminishing returns)
    const contentMatches = (lowerContent.match(new RegExp(keywordLower, 'g')) || []).length;
    if (contentMatches > 0) {
      const contentScore = Math.min(contentMatches * 2, 10); // Cap at 10
      score += contentScore;
      matches.push({ type: 'content', keyword, count: contentMatches, weight: contentScore });
    }
  });

  return { score, matches };
}

/**
 * Read all articles and their metadata
 */
async function getAllArticles() {
  const articles = [];

  async function traverse(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const { data, content: articleContent } = matter(content);
        articles.push({
          path: fullPath,
          metadata: data,
          content: articleContent,
          fullContent: content
        });
      }
    }
  }

  await traverse(ARTICLES_DIR);
  return articles;
}

/**
 * Filter articles by changelog relevance
 */
export async function filterRelevantArticles(changelogText, options = {}) {
  const {
    minScore = 5, // Minimum relevance score
    maxArticles = 20, // Maximum articles to return
    includeContext = true // Include article content in results
  } = options;

  console.log('Extracting keywords from changelog...');
  const keywords = extractKeywords(changelogText);
  console.log(`  Found ${keywords.length} keywords:`, keywords.slice(0, 10).join(', '), '...');

  console.log('\nLoading articles...');
  const articles = await getAllArticles();
  console.log(`  Loaded ${articles.length} articles`);

  console.log('\nScoring articles...');
  const scoredArticles = articles.map(article => {
    const { score, matches } = scoreArticle(
      article.content,
      article.metadata,
      keywords
    );

    return {
      ...article,
      relevanceScore: score,
      keywordMatches: matches
    };
  });

  // Sort by relevance score (highest first)
  scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Filter by minimum score and max count
  const relevantArticles = scoredArticles
    .filter(article => article.relevanceScore >= minScore)
    .slice(0, maxArticles);

  console.log(`  ${relevantArticles.length} articles meet threshold (score >= ${minScore})`);

  // Format results
  const results = relevantArticles.map(article => ({
    title: article.metadata.title,
    slug: article.metadata.slug,
    category: article.metadata.category,
    path: article.path,
    relevanceScore: article.relevanceScore,
    keywordMatches: article.keywordMatches,
    ...(includeContext && { content: article.fullContent })
  }));

  return {
    keywords,
    totalArticles: articles.length,
    relevantArticles: results,
    summary: {
      high: results.filter(a => a.relevanceScore >= 20).length,
      medium: results.filter(a => a.relevanceScore >= 10 && a.relevanceScore < 20).length,
      low: results.filter(a => a.relevanceScore >= minScore && a.relevanceScore < 10).length
    }
  };
}

/**
 * Build a focused context string for AI audit
 * Only includes relevant articles, not the entire documentation
 */
export function buildFocusedContext(relevantArticles) {
  let context = `# Potentially Affected Documentation\n\n`;
  context += `These ${relevantArticles.length} articles were identified as potentially relevant based on keyword matching.\n\n`;
  context += `---\n\n`;

  relevantArticles.forEach((article, index) => {
    context += `## Article ${index + 1}: ${article.title}\n\n`;
    context += `**Slug:** ${article.slug}\n`;
    context += `**Category:** ${article.category}\n`;
    context += `**Relevance Score:** ${article.relevanceScore}\n`;
    context += `**Matched Keywords:** ${article.keywordMatches.map(m => m.keyword).join(', ')}\n\n`;

    if (article.content) {
      context += `### Content:\n\n`;
      context += article.content;
      context += `\n\n---\n\n`;
    }
  });

  return context;
}
