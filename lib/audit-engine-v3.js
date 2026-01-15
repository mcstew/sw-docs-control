/**
 * AI Audit Engine V3 - Two-Stage Approach
 * Stage 1: Keyword filtering to find relevant articles
 * Stage 2: AI deep dive on filtered articles only
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { createGitHubIssue } from './github-client.js';
import { filterRelevantArticles, buildFocusedContext } from './keyword-filter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FEATUREBASE_HELP_CENTER_ID = process.env.FEATUREBASE_HELP_CENTER_ID || 'okvvzwjutywdznic';

/**
 * Generate Featurebase edit URL for an article
 */
function getFeaturebaseEditUrl(slug) {
  return `https://do.featurebase.app/help-center/${FEATUREBASE_HELP_CENTER_ID}/articles/${slug}/edit`;
}

/**
 * Build improved audit prompt with focused context
 */
function buildAuditPrompt(changelogEntry, focusedDocumentation) {
  return `You are a documentation accuracy auditor for Sudowrite, an AI-powered creative writing tool.

# CONTEXT: WHAT SUDOWRITE IS

Sudowrite is a creative writing application that helps authors write novels, scripts, and other creative content using AI. It includes features like:
- Story Bible (characters, worldbuilding, outlines, scenes)
- Write, Rewrite, Describe, Expand, and other prose generation tools
- Canvas for brainstorming
- Chat for AI assistance
- Credit-based usage system
- Multiple AI models (Muse, Claude, GPT)

# YOUR ROLE

You are reviewing a PRE-FILTERED set of articles that are potentially affected by a product update. Your job is to identify where the documentation is now OUTDATED or CONTRADICTS the update.

# CRITICAL RULES

1. **The documentation is the baseline** - treat it as what users currently see
2. **Only flag EXISTING text that is now wrong** - don't suggest adding features unless the docs explicitly contradict the update
3. **Be skeptical of changelog marketing** - "new feature" might just mean "newly announced" not "never documented"
4. **Quote exact passages** - you must find the specific text that's now incorrect
5. **No hallucinations** - if you can't find incorrect text, don't flag the article
6. **Distinguish clearly**:
   - ❌ Docs say X, changelog says Y → FLAG (contradiction)
   - ❌ Docs list features A, B, C but changelog says D also applies → FLAG (incomplete list)
   - ✅ Docs say nothing, changelog announces X → SKIP (might be documented elsewhere)
   - ✅ Docs mention X vaguely, changelog details X → SKIP unless there's a clear error

# THE UPDATE

**Title:** ${changelogEntry.title}

**Content:**
${changelogEntry.content}

---

# PRE-FILTERED DOCUMENTATION

The articles below were identified as potentially relevant using keyword matching. Focus your attention on these articles.

${focusedDocumentation}

---

# YOUR TASK

Find articles where the EXISTING text is now INCORRECT due to this update.

For each affected article, you must:

1. **Quote the exact incorrect passage** from the docs (must exist in the documentation above)
2. **Explain the contradiction** - how does the changelog conflict with this passage?
3. **Provide corrected text** - what should it say instead?
4. **Confidence level**:
   - HIGH: Clear factual contradiction (e.g., docs say "30 credits", changelog says "50 credits")
   - MEDIUM: Implicit contradiction (e.g., docs describe old workflow, changelog changes it)
   - LOW: Tangentially related but may not need update

# IMPORTANT

- If the docs DON'T mention something the changelog announces, that's probably fine - don't flag it
- If the docs mention something vaguely and the changelog adds details, that's probably fine - don't flag it
- ONLY flag clear contradictions where existing text is now demonstrably wrong

# OUTPUT FORMAT

Respond with a JSON object:

\`\`\`json
{
  "affected_articles": [
    {
      "article_title": "Article Name",
      "article_slug": "article-slug",
      "confidence": "high|medium|low",
      "contradiction": "Docs say X, but changelog says Y",
      "existing_passage": "Exact quote from documentation that is now wrong",
      "corrected_text": "What it should say instead",
      "change_type": "correction|update|removal"
    }
  ],
  "summary": "Brief summary of contradictions found"
}
\`\`\`

If NO contradictions found, return:
\`\`\`json
{
  "affected_articles": [],
  "summary": "No documentation contradictions identified. The existing docs appear accurate or don't cover the changed areas."
}
\`\`\``;
}

/**
 * Run AI audit using Claude Haiku 4.5
 */
async function runClaudeAudit(changelogEntry, focusedDocumentation) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment');
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = buildAuditPrompt(changelogEntry, focusedDocumentation);

  console.log('Running two-stage audit with Claude Haiku 4.5...');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 8000,
    temperature: 0.1, // Very low temperature for consistency
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const responseText = message.content[0].text;

  // Extract JSON from response
  const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/);

  if (!jsonMatch) {
    throw new Error('Failed to parse JSON response from Claude');
  }

  return JSON.parse(jsonMatch[1]);
}

/**
 * Main audit function with two-stage approach
 */
export async function runAudit(changelogEntry) {
  try {
    console.log(`\n=== Starting Two-Stage Audit (V3) ===`);
    console.log(`Changelog: ${changelogEntry.title}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    // STAGE 1: Keyword filtering
    console.log('STAGE 1: Keyword Filtering');
    console.log('-'.repeat(60));

    const filterResults = await filterRelevantArticles(changelogEntry.content, {
      minScore: 5,
      maxArticles: 20,
      includeContext: true
    });

    console.log(`  Found ${filterResults.relevantArticles.length} potentially relevant articles`);
    console.log(`  High relevance: ${filterResults.summary.high}`);
    console.log(`  Medium relevance: ${filterResults.summary.medium}`);
    console.log(`  Low relevance: ${filterResults.summary.low}`);

    if (filterResults.relevantArticles.length === 0) {
      console.log('\n  No relevant articles found - skipping AI audit');
      return {
        affected_articles: [],
        summary: 'No relevant articles identified by keyword filter'
      };
    }

    // STAGE 2: AI deep dive
    console.log('\nSTAGE 2: AI Deep Dive');
    console.log('-'.repeat(60));

    const focusedContext = buildFocusedContext(filterResults.relevantArticles);
    console.log(`  Context size: ${Math.round(focusedContext.length / 4)} tokens (approx)`);

    const auditResult = await runClaudeAudit(changelogEntry, focusedContext);

    console.log(`  Found ${auditResult.affected_articles.length} contradiction(s)`);

    // Add edit URLs to affected articles
    auditResult.affected_articles = auditResult.affected_articles.map(article => ({
      ...article,
      edit_url: getFeaturebaseEditUrl(article.article_slug)
    }));

    // Save audit result
    const auditLogPath = path.join(__dirname, '../docs-source/audits');
    await fs.mkdir(auditLogPath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logFile = path.join(auditLogPath, `audit-v3-${timestamp}.json`);

    const auditLog = {
      version: 'v3-two-stage',
      model: 'claude-haiku-4-5',
      timestamp: new Date().toISOString(),
      changelog: changelogEntry,
      stage1_filter: {
        keywords: filterResults.keywords,
        articlesScanned: filterResults.totalArticles,
        articlesFiltered: filterResults.relevantArticles.length,
        topArticles: filterResults.relevantArticles.slice(0, 10).map(a => ({
          title: a.title,
          slug: a.slug,
          score: a.relevanceScore
        }))
      },
      stage2_audit: auditResult
    };

    await fs.writeFile(logFile, JSON.stringify(auditLog, null, 2), 'utf-8');
    console.log(`  Audit log saved: ${logFile}`);

    // Create GitHub issue if articles are affected
    if (auditResult.affected_articles.length > 0) {
      console.log('Creating GitHub issue...');

      try {
        const issue = await createGitHubIssue({
          changelog: changelogEntry,
          auditResult: auditResult
        });

        console.log(`  ✓ GitHub issue created: ${issue.html_url}`);
      } catch (error) {
        console.error('  Failed to create GitHub issue:', error.message);
      }
    } else {
      console.log('  ✓ No contradictions found - docs appear accurate');
    }

    console.log('\n=== Audit Complete ===\n');

    return auditResult;

  } catch (error) {
    console.error('Audit error:', error);
    throw error;
  }
}

/**
 * Manual audit trigger (for testing)
 */
export async function runManualAudit(changelogText) {
  const changelogEntry = {
    id: 'manual-' + Date.now(),
    title: 'Manual Audit',
    content: changelogText,
    publishedAt: new Date().toISOString(),
    url: null,
    tags: []
  };

  return runAudit(changelogEntry);
}
