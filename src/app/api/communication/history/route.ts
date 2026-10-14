import { NextResponse } from 'next/server';
import { getCommunicationHistory } from '@/lib/email/resend';

export async function GET() {
  try {
    const logs = await getCommunicationHistory();
    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve history' },
      { status: 500 }
    );
  }
}
