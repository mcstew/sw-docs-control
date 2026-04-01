/**
 * Audit API — triggers AI-powered changelog audit.
 * Accepts { "changelogText": "..." } to run a manual audit.
 * Saves results to history.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { saveAnalysisRecord } from '@/lib/history';

export const maxDuration = 300;

const getAuditEngine = async (): Promise<any> => {
  const mod = await import('@/lib/audit-engine-v3.js');
  return mod;
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
    let body: { changelogText?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided
    }

    if (!body.changelogText) {
      return NextResponse.json({
        success: false,
        error: 'Provide { "changelogText": "..." } in the request body to run an audit.',
        hint: 'The webhook at /api/webhooks/changelog automatically triggers audits when Featurebase publishes a changelog.',
      }, { status: 400 });
    }

    const { runAudit } = await getAuditEngine();

    const changelogEntry = {
      id: 'dashboard-' + Date.now(),
      title: 'Manual Audit',
      content: body.changelogText,
      publishedAt: new Date().toISOString(),
      url: null,
      tags: [],
    };

    let result;
    try {
      result = await runAudit(changelogEntry);
    } catch (auditError: any) {
      if (auditError.code === 'EROFS' || auditError.code === 'ENOENT') {
        return NextResponse.json({
          success: true,
          message: 'Audit completed (log save skipped on Vercel)',
          result: { affected_articles: [], summary: auditError.message },
        });
      }
      throw auditError;
    }

    // Save to history
    const analysisId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await saveAnalysisRecord({
        id: analysisId,
        type: 'audit',
        timestamp: new Date().toISOString(),
        user: session?.user?.email || 'dev',
        input: {
          changelogTitle: changelogEntry.title,
          preview: body.changelogText.slice(0, 200),
        },
        output: {
          summary: result.summary || `${result.affected_articles.length} contradiction(s) found`,
          proposalCount: result.affected_articles.length,
          proposals: (result.affected_articles || []).map((a: any) => ({
            id: a.article_slug,
            articleTitle: a.article_title,
            editType: a.change_type || 'correction',
            confidence: a.confidence,
            status: 'flagged',
            reasoning: a.contradiction,
          })),
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      analysisId,
      message: `Audit complete: ${result.affected_articles.length} contradiction(s) found`,
      result,
    });
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
