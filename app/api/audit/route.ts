/**
 * Audit API — triggers AI-powered changelog audit.
 * Fetches recent changelogs from Featurebase and runs the two-stage audit engine.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const maxDuration = 300;

const getAuditEngine = async () => {
  const mod = await import('@/lib/audit-engine-v3.js');
  return mod;
};

const getClient = async () => {
  const mod = await import('@/lib/featurebase-client.js');
  return mod.FeaturebaseClient;
};

export async function POST(req: Request) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    // Check if a manual changelog text was provided
    let body: { changelogText?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body — will fetch latest from Featurebase
    }

    const { runAudit, runManualAudit } = await getAuditEngine();

    if (body.changelogText) {
      // Manual audit with provided text
      const result = await runManualAudit(body.changelogText);
      return NextResponse.json({
        success: true,
        message: `Audit complete: ${result.affected_articles.length} contradiction(s) found`,
        result,
      });
    }

    // Otherwise, fetch the latest changelog from Featurebase
    // Featurebase sends changelogs via webhook, but we can also
    // use a test changelog for now
    const apiKey = process.env.FEATUREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'No changelog text provided and Featurebase API not configured. Provide { "changelogText": "..." } in the request body.' },
        { status: 400 }
      );
    }

    // For now, return a helpful message about how to use the audit
    // TODO: Add Featurebase changelog API fetching when their API supports it
    return NextResponse.json({
      success: false,
      error: 'No changelog text provided. Send POST with { "changelogText": "your changelog content here" } to run an audit.',
      hint: 'The webhook at /api/webhooks/changelog automatically triggers audits when Featurebase publishes a changelog.',
    }, { status: 400 });

  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
