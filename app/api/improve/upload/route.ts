/**
 * Upload feedback — parses CSV or free text and returns structured feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseFeedback } from '@/lib/feedback-parser';

export async function POST(req: NextRequest) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const text = body.text || body.csv || '';

    if (!text.trim()) {
      return NextResponse.json({ error: 'No feedback data provided' }, { status: 400 });
    }

    const result = parseFeedback(text);

    return NextResponse.json({
      success: true,
      format: result.format,
      itemCount: result.items.length,
      summaryCount: result.summaries.length,
      items: result.items,
      summaries: result.summaries,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
