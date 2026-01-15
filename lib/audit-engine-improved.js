/**
 * Improved AI Audit Engine
 * Uses Claude Haiku 4.5 with improved fact-checking prompt
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
 * Build improved audit prompt
 */
function buildAuditPrompt(changelogEntry, fullDocumentation) {
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

You are reviewing the EXISTING documentation (which is the source of truth) after a product update. Your job is to identify where the documentation is now OUTDATED or CONTRADICTS the update.

# CRITICAL RULES

1. **The documentation is the baseline** - treat it as what users currently see
2. **Only flag EXISTING text that is now wrong** - don't suggest adding features unless the docs explicitly contradict the update
3. **Be skeptical of changelog marketing** - "new feature" might just mean "newly announced" not "never documented"
4. **Quote exact passages** - you must find the specific text that's now incorrect
5. **No hallucinations** - if you can't find incorrect text, don't flag the article
6. **Distinguish clearly**:
   - ❌ Docs say X, changelog says Y → FLAG (contradiction)
   - ✅ Docs say nothing, changelog announces X → SKIP (might be documented elsewhere or already accurate)
   - ✅ Docs mention X vaguely, changelog details X → SKIP unless there's a clear error

# THE UPDATE

**Title:** ${changelogEntry.title}

**Content:**
${changelogEntry.content}

---

# THE EXISTING DOCUMENTATION

This is what users see RIGHT NOW. It is the source of truth for what's currently documented.

${fullDocumentation}

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
async function runClaudeAudit(changelogEntry, fullDocumentation) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment');
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = buildAuditPrompt(changelogEntry, fullDocumentation);

  console.log('Running improved audit with Claude Haiku 4.5...');

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
 * Main audit function
 */
export async function runAudit(changelogEntry) {
  try {
    console.log(`\n=== Starting Improved Audit ===`);
    console.log(`Changelog: ${changelogEntry.title}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    // Load documentation
    console.log('Loading documentation...');
    const fullDocumentation = await fs.readFile(FULL_SCROLL_PATH, 'utf-8');
    const articleList = await getArticleMetadata();
    console.log(`  Loaded ${articleList.length} articles`);

    // Run AI audit
    console.log('Running AI audit...');
    const auditResult = await runClaudeAudit(changelogEntry, fullDocumentation);

    console.log(`  Found ${auditResult.affected_articles.length} contradiction(s)`);

    // Save audit result
    const auditLogPath = path.join(__dirname, '../docs-source/audits');
    await fs.mkdir(auditLogPath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logFile = path.join(auditLogPath, `audit-improved-${timestamp}.json`);

    const auditLog = {
      version: 'improved',
      model: 'claude-haiku-4-5',
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
