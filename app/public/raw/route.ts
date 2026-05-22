import { NextResponse } from 'next/server';
import { readDocsRollup } from '@/lib/docs-rollup-public';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const markdown = await readDocsRollup();

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
