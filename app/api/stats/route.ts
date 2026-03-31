/**
 * Stats API — returns live article count, last sync time, etc.
 */

import { NextResponse } from 'next/server';

const getSync = async () => {
  const mod = await import('@/lib/featurebase-sync.js');
  return mod;
};

export async function GET() {
  try {
    const { getSyncStats } = await getSync();
    const stats = await getSyncStats();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
