/**
 * Chat threads — list summaries (GET) and load a single thread (GET ?id=...)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listThreads, loadThread } from '@/lib/chat-threads';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  const isDev = process.env.NODE_ENV === 'development';
  const oauthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
  if (!session?.user && !(isDev && !oauthConfigured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  try {
    if (id) {
      const thread = await loadThread(id);
      if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ thread });
    }
    const threads = await listThreads();
    return NextResponse.json({ threads });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
