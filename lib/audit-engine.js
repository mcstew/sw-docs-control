/**
 * ⚠️ DEPRECATED - Use audit-engine-v3.js instead
 *
 * AI Audit Engine (V1 Baseline)
 *
 * This is the original baseline version kept for reference and comparison.
 * The active version is audit-engine-v3.js which uses a two-stage approach
 * for better accuracy and scalability.
 *
 * Uses Claude Haiku 4.5 to analyze documentation against changelog entries
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { createGitHubIssue } from './github-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTICLES_DIR = path.join(__dirname, '../docs-source/articles');
const FULL_SCROLL_PATH = path.join(__dirname, '../docs-source/exports/full-scroll.md');

/**
 * Get all article metadata for context
 */
async function getArticleMetadata() {
  const articles = [];

  async function traverse(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const { data } = matter(content);
        articles.push({
          title: data.title,
          slug: data.slug,
          category: data.category,
          filepath: fullPath
        });
      }
    }
  }

  await traverse(ARTICLES_DIR);
  return articles;
}

/**
 * Build audit prompt for Claude
 */
function buildAuditPrompt(changelogEntry, fullDocumentation, articleList) {
  return `You are auditing documentation for accuracy after a product change.

# CHANGELOG ENTRY

**Title:** ${changelogEntry.title}

**Content:**
${changelogEntry.content}

**Published:** ${changelogEntry.publishedAt}

---

# YOUR TASK

Analyze this changelog entry against the complete documentation and identify which articles need updates.

For each affected article:
1. Quote the specific passage that is now incorrect or incomplete
2. Explain why it needs updating based on the changelog
3. Provide a suggested replacement or addition
4. Rate confidence (high/medium/low)

Be comprehensive but not overly cautious. Over-flagging is better than missing something.

# DOCUMENTATION STRUCTURE

Here are all the available articles (for reference):

${articleList.map(a => `- ${a.title} (${a.category}/${a.slug})`).join('\n')}

# FULL DOCUMENTATION CONTENT

${fullDocumentation}

---

# OUTPUT FORMAT

Respond with a JSON object:

\`\`\`json
{
  "affected_articles": [
    {
      "article_title": "Article Name",
      "article_slug": "article-slug",
      "confidence": "high|medium|low",
      "reason": "Why this article is affected",
      "specific_passage": "Quote the exact text that needs changing",
      "suggested_change": "Proposed new text or addition",
      "change_type": "update|addition|removal"
    }
  ],
  "summary": "Brief summary of what changed and documentation impact"
}
\`\`\`

If no articles are affected, return:
\`\`\`json
{
  "affected_articles": [],
  "summary": "This change does not require documentation updates."
}
\`\`\``;
}

/**
 * Run AI audit using Claude Haiku 4.5
 */
async function runClaudeAudit(changelogEntry, fullDocumentation, articleList) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment');
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = buildAuditPrompt(changelogEntry, fullDocumentation, articleList);

  console.log('Running AI audit with Claude Haiku 4.5...');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 8000,
    temperature: 0.2, // Low temperature for more consistent analysis
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
 * Main audit function
 */
export async function runAudit(changelogEntry) {
  try {
    console.log(`\n=== Starting Audit ===`);
    console.log(`Changelog: ${changelogEntry.title}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    // Load documentation
    console.log('Loading documentation...');
    const fullDocumentation = await fs.readFile(FULL_SCROLL_PATH, 'utf-8');
    const articleList = await getArticleMetadata();
    console.log(`  Loaded ${articleList.length} articles`);

    // Run AI audit
    console.log('Running AI audit...');
    const auditResult = await runClaudeAudit(changelogEntry, fullDocumentation, articleList);

    console.log(`  Found ${auditResult.affected_articles.length} affected article(s)`);

    // Save audit result
    const auditLogPath = path.join(__dirname, '../docs-source/audits');
    await fs.mkdir(auditLogPath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logFile = path.join(auditLogPath, `audit-${timestamp}.json`);

    const auditLog = {
      timestamp: new Date().toISOString(),
      changelog: changelogEntry,
      result: auditResult
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
      console.log('  No documentation updates needed');
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
