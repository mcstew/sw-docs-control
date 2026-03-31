/**
 * Featurebase Changelog Webhook Handler (App Router)
 * Receives changelog entry webhooks and triggers documentation audit.
 * Migrated from api/webhooks/changelog.js — same logic, Next.js App Router format.
 */

import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to handle the .js ES module
const getAuditEngine = async () => {
  const mod = await import('@/lib/audit-engine-v3.js');
  return mod;
};

export const maxDuration = 300; // 5 minutes for audit processing

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    console.log('Received changelog webhook:', {
      id: payload.id,
      title: payload.title,
      timestamp: new Date().toISOString(),
    });

    if (!payload.title || !payload.content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const changelogData = {
      id: payload.id,
      title: payload.title,
      content: payload.content,
      publishedAt: payload.publishedAt,
      url: payload.url,
      tags: payload.tags || [],
    };

    // Trigger audit asynchronously
    const { runAudit } = await getAuditEngine();
    runAudit(changelogData).catch((error: Error) => {
      console.error('Audit failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Changelog received, audit triggered',
      changelogId: payload.id,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
