import { NextRequest, NextResponse } from 'next/server';
import { getCustomerHistory, logCustomerActivity } from '@/lib/ai/tools';
import { analyzeCustomerWithAI } from '@/lib/ai/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId } = body;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid customerId is required.' },
        { status: 400 }
      );
    }

    // 1. Authoritative CRM History
    const history = await getCustomerHistory(customerId);

    // 2. AI Evaluation
    const analysis = await analyzeCustomerWithAI(history);

    // 3. Log Activity
    await logCustomerActivity({
      customerId,
      description: `AI Customer Engagement Analysis: ${analysis.recommendation.slice(0, 180)}...`,
      type: 'note',
    });

    return NextResponse.json({
      success: true,
      customerId,
      history,
      analysis,
    });
  } catch (err: unknown) {
    console.error('Error in /api/ai/analyze:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Analysis failed',
      },
      { status: 500 }
    );
  }
}
