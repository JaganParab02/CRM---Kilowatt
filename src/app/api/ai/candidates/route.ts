import { NextResponse } from 'next/server';
import { findFollowUpCandidates } from '@/lib/ai/tools';

export async function GET() {
  try {
    const candidates = await findFollowUpCandidates(60);
    return NextResponse.json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (err: unknown) {
    console.error('Error in /api/ai/candidates:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve follow-up candidates',
      },
      { status: 500 }
    );
  }
}
