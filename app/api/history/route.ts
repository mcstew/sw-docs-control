/**
 * History API — fetch past analyses and audits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getHistory } from '@/lib/history';

export async function GET(req: NextRequest) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as 'improve' | 'audit' | null;
    const records = await getHistory(type || undefined);

    return NextResponse.json({
      success: true,
      total: records.length,
      records,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message, records: [] },
      { status: 500 }
    );
  }
}
