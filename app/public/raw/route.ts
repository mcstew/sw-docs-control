import { NextResponse } from 'next/server';
import { readDocsRollup } from '@/lib/docs-rollup-public';

export const dynamic = 'force-static';

export async function GET() {
  const markdown = await readDocsRollup();

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
