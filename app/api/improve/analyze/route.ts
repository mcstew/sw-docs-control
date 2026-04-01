/**
 * Analyze feedback — runs the improve agent to generate edit proposals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseFeedback } from '@/lib/feedback-parser';
import { runImproveAgent } from '@/lib/improve-agent';
import { addProposals } from '@/lib/proposals';

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

    const { items, summaries } = parseFeedback(text);

    if (items.length === 0 && summaries.length === 0) {
      return NextResponse.json({ error: 'Could not parse any feedback from the input' }, { status: 400 });
    }

    const { proposals, summary } = await runImproveAgent(items, summaries);

    // Persist proposals (best-effort — may fail on Vercel read-only)
    try {
      await addProposals(proposals);
    } catch {
      // On Vercel, proposals live only in the response
    }

    return NextResponse.json({
      success: true,
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
