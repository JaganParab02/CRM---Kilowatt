import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowStatus, toggleWorkflow } from '@/lib/email/workflow';

export async function GET() {
  try {
    const status = await getWorkflowStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to retrieve workflow status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { enabled } = body;

    const updated = await toggleWorkflow(Boolean(enabled));
    return NextResponse.json({ success: true, enabled: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to toggle workflow' },
      { status: 500 }
    );
  }
}
