import { NextRequest, NextResponse } from 'next/server';
import { getCustomerHistory, createEmailDraft } from '@/lib/ai/tools';
import { generateEmailDraftWithAI } from '@/lib/ai/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, recommendationReason, orderId } = body;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid customerId is required.' },
        { status: 400 }
      );
    }

    // 1. Authoritative Customer History
    const history = await getCustomerHistory(customerId);

    // 2. Generate Draft Content
    const draftContent = await generateEmailDraftWithAI(
      history,
      recommendationReason || 'Customer re-engagement follow-up'
    );

    // 3. Persist Draft in Supabase
    const savedDraft = await createEmailDraft({
      customerId,
      subject: draftContent.subject,
      body: draftContent.body,
      recommendationReason: recommendationReason || 'Customer re-engagement follow-up',
      orderId: orderId || history.recentOrders[0]?.id || null,
      isAiGenerated: draftContent.source === 'ai',
    });

    return NextResponse.json({
      success: true,
      draft: savedDraft,
      source: draftContent.source,
      modelUsed: draftContent.modelUsed,
    });
  } catch (err: unknown) {
    console.error('Error in /api/ai/draft-email:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Draft generation failed',
      },
      { status: 500 }
    );
  }
}
