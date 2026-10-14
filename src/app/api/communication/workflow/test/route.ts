import { NextRequest, NextResponse } from 'next/server';
import { executeOrderCompletedWorkflow } from '@/lib/email/workflow';

import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId } = body;

    let targetOrderId = orderId;
    if (!targetOrderId) {
      const supabase = createServerClient();
      const { data: latestOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'completed')
        .order('ordered_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestOrder) {
        return NextResponse.json(
          { success: false, error: 'No completed orders found in database to test workflow. Please seed orders first.' },
          { status: 400 }
        );
      }
      targetOrderId = latestOrder.id;
    }

    const result = await executeOrderCompletedWorkflow({
      orderId: targetOrderId,
      isSimulation: true, // Controlled test simulation
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.message,
      execution: result.execution,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Workflow test failed' },
      { status: 500 }
    );
  }
}
