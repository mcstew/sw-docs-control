/**
 * Analyze feedback — runs the improve agent to generate edit proposals.
 * Saves analysis record to history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseFeedback } from '@/lib/feedback-parser';
import { runImproveAgent } from '@/lib/improve-agent';
import { saveAnalysisRecord } from '@/lib/history';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const text = body.text || body.csv || '';

    if (!text.trim()) {
      return NextResponse.json({ error: 'No feedback data provided' }, { status: 400 });
    }

    const parsed = parseFeedback(text);

    if (parsed.items.length === 0 && parsed.summaries.length === 0) {
      return NextResponse.json({ error: 'Could not parse any feedback from the input' }, { status: 400 });
    }

    const { proposals, summary } = await runImproveAgent(parsed.items, parsed.summaries);

    // Save to history (persists in repo via GitHub API)
    const analysisId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await saveAnalysisRecord({
        id: analysisId,
        type: 'improve',
        timestamp: new Date().toISOString(),
        user: session?.user?.email || 'dev',
        input: {
          format: parsed.format,
          itemCount: parsed.items.length + parsed.summaries.length,
          preview: text.slice(0, 200),
        },
        output: {
          summary,
          proposalCount: proposals.length,
          proposals: proposals.map((p) => ({
            id: p.id,
            articleTitle: p.articleTitle,
            editType: p.editType,
            confidence: p.confidence,
            status: p.status,
            reasoning: p.reasoning,
          })),
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      analysisId,
      summary,
      proposalCount: proposals.length,
      autoApprovable: proposals.filter((p) => p.autoApprovable).length,
      needsReview: proposals.filter((p) => !p.autoApprovable).length,
      proposals,
    });
  } catch (error) {
    console.error('Improve agent error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
