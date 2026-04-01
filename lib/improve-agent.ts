/**
 * Improve Agent — Claude Opus 4.6 tool-use loop.
 *
 * Ingests feedback, searches articles, reads content, and proposes edits.
 * Minor fixes (typos, small factual updates) can be auto-approved.
 * Larger rewrites are queued for human review.
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchRepoArticles } from './github-sync';
import type { FeedbackItem, ArticleFeedbackSummary } from './feedback-parser';

export interface EditProposal {
  id: string;
  articleTitle: string;
  articleSlug: string;
  articlePath: string;
  editType: 'typo_fix' | 'factual_update' | 'clarity_improvement' | 'rewrite' | 'new_section';
  original: string;
  replacement: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  autoApprovable: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

// Tool definitions for the agent
const tools: Anthropic.Tool[] = [
  {
    name: 'search_articles',
    description: 'Search documentation articles by keyword. Returns matching article titles, slugs, and snippets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search keywords' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_article',
    description: 'Read the full content of a specific documentation article.',
    input_schema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Article slug or title to read' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'propose_edit',
    description: 'Propose an edit to an existing documentation article. For each edit, specify the exact original text and its replacement.',
    input_schema: {
      type: 'object' as const,
      properties: {
        article_slug: { type: 'string', description: 'Slug of the article to edit' },
        edit_type: {
          type: 'string',
          enum: ['typo_fix', 'factual_update', 'clarity_improvement', 'rewrite', 'new_section'],
          description: 'Type of edit',
        },
        original: { type: 'string', description: 'Exact original text to replace (must exist in the article)' },
        replacement: { type: 'string', description: 'New text to replace it with' },
        reasoning: { type: 'string', description: 'Why this change is needed, referencing the user feedback' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence this edit is correct' },
      },
      required: ['article_slug', 'edit_type', 'original', 'replacement', 'reasoning', 'confidence'],
    },
  },
  {
    name: 'complete',
    description: 'Signal that analysis is complete. Call this when done reviewing all feedback.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Summary of all proposed changes' },
      },
      required: ['summary'],
    },
  },
];

/**
 * Run the improve agent on a set of feedback.
 */
export async function runImproveAgent(
  feedbackItems: FeedbackItem[],
  feedbackSummaries: ArticleFeedbackSummary[],
  onProgress?: (msg: string) => void,
): Promise<{ proposals: EditProposal[]; summary: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const anthropic = new Anthropic({ apiKey });

  // Load articles for tool use
  const log = (msg: string) => onProgress?.(msg);
  log('Loading article inventory from GitHub...');

  let articlesMap: Awaited<ReturnType<typeof fetchRepoArticles>>;
  try {
    articlesMap = await fetchRepoArticles();
  } catch {
    // Fallback: empty map, agent will note it can't read articles
    articlesMap = new Map();
  }

  // Build article index for search
  const articleIndex = Array.from(articlesMap.entries()).map(([id, a]) => ({
    id,
    title: a.frontmatter.title || '',
    slug: a.frontmatter.slug || '',
    collection: a.frontmatter.collection_name || '',
    path: a.path,
    content: a.content,
  }));

  // Format feedback for the system prompt
  let feedbackContext = '';

  if (feedbackSummaries.length > 0) {
    feedbackContext += '## Article Satisfaction Scores\n\n';
    for (const s of feedbackSummaries.sort((a, b) => (a.satisfaction ?? 100) - (b.satisfaction ?? 100))) {
      feedbackContext += `- **${s.articleTitle}**: ${s.satisfaction}% satisfaction (${s.likes} likes, ${s.dislikes} dislikes, ${s.totalVotes} total)\n`;
    }
    feedbackContext += '\n';
  }

  if (feedbackItems.length > 0) {
    feedbackContext += '## User Feedback Comments\n\n';
    for (const item of feedbackItems) {
      feedbackContext += `- **${item.articleTitle}** [${item.sentiment}]: "${item.feedback}"\n`;
    }
  }

  const systemPrompt = `You are a documentation improvement agent for Sudowrite, an AI creative writing tool.

You have been given user feedback about the help center documentation. Your job is to:
1. Analyze the feedback to understand what users are struggling with
2. Search for and read the relevant documentation articles
3. Propose specific edits to improve the documentation

Guidelines:
- Focus on the articles with the worst satisfaction scores and most negative feedback
- Propose concrete text changes (exact original → replacement)
- For each edit, explain how it addresses the user feedback
- Minor fixes (typos, small clarifications under 100 chars) can be auto-approved
- Larger changes need human review
- Don't make changes that alter the product's functionality description unless you're certain
- Prioritize clarity and helpfulness over completeness

Use the tools to search articles, read their content, and propose edits. Call 'complete' when done.`;

  const userMessage = `Here is the user feedback to analyze:\n\n${feedbackContext}\n\nPlease analyze this feedback and propose documentation improvements. Start by searching for the articles with the worst feedback, read them, and propose specific edits.`;

  log('Starting Opus analysis...');

  const proposals: EditProposal[] = [];
  let summary = '';

  // Tool-use loop
  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  for (let turn = 0; turn < 15; turn++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Process response
    const assistantContent = response.content;
    messages.push({ role: 'assistant', content: assistantContent });

    // Check for tool use
    const toolUses = assistantContent.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUses.length === 0 || response.stop_reason === 'end_turn') {
      // Agent finished without calling complete — extract text
      const textBlocks = assistantContent.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      if (textBlocks.length > 0) {
        summary = textBlocks.map((b) => b.text).join('\n');
      }
      break;
    }

    // Process each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      const input = toolUse.input as any;

      if (toolUse.name === 'search_articles') {
        log(`Searching articles for: "${input.query}"`);
        const query = input.query.toLowerCase();
        const matches = articleIndex
          .filter(
            (a) =>
              a.title.toLowerCase().includes(query) ||
              a.content.toLowerCase().includes(query) ||
              a.slug.toLowerCase().includes(query)
          )
          .slice(0, 10)
          .map((a) => ({
            title: a.title,
            slug: a.slug,
            collection: a.collection,
            snippet: a.content.substring(0, 200) + '...',
          }));

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ results: matches, total: matches.length }),
        });
      } else if (toolUse.name === 'read_article') {
        log(`Reading article: ${input.slug}`);
        const found = articleIndex.find(
          (a) => a.slug === input.slug || a.title.toLowerCase().includes(input.slug.toLowerCase())
        );

        if (found) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              title: found.title,
              slug: found.slug,
              path: found.path,
              content: found.content,
            }),
          });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: `Article not found: ${input.slug}` }),
          });
        }
      } else if (toolUse.name === 'propose_edit') {
        log(`Proposing edit to: ${input.article_slug} (${input.edit_type})`);

        const article = articleIndex.find(
          (a) => a.slug === input.article_slug || a.title.toLowerCase().includes(input.article_slug.toLowerCase())
        );

        const isMinor =
          (input.edit_type === 'typo_fix' || input.edit_type === 'factual_update') &&
          input.replacement.length < 100 &&
          input.confidence === 'high';

        const proposal: EditProposal = {
          id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          articleTitle: article?.title || input.article_slug,
          articleSlug: article?.slug || input.article_slug,
          articlePath: article?.path || '',
          editType: input.edit_type,
          original: input.original,
          replacement: input.replacement,
          reasoning: input.reasoning,
          confidence: input.confidence,
          autoApprovable: isMinor,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        proposals.push(proposal);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: true,
            proposalId: proposal.id,
            autoApprovable: proposal.autoApprovable,
          }),
        });
      } else if (toolUse.name === 'complete') {
        summary = input.summary;
        log('Analysis complete.');
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ success: true }),
        });
        // Break after processing this turn
        messages.push({ role: 'user', content: toolResults });
        break;
      }
    }

    if (summary) break;

    messages.push({ role: 'user', content: toolResults });
  }

  return { proposals, summary: summary || `Analyzed feedback and generated ${proposals.length} proposals.` };
}
