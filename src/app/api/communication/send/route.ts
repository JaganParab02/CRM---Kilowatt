import { NextRequest, NextResponse } from 'next/server';
import { sendOrSimulateEmail } from '@/lib/email/resend';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipient, subject, body: emailBody, customerId, orderId, draftId, isPromotional } = body;

    if (!recipient || typeof recipient !== 'string' || !recipient.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid recipient email address is required.' }, { status: 400 });
    }
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return NextResponse.json({ success: false, error: 'Subject line is required.' }, { status: 400 });
    }
    if (!emailBody || typeof emailBody !== 'string' || !emailBody.trim()) {
      return NextResponse.json({ success: false, error: 'Email message body is required.' }, { status: 400 });
    }

    const result = await sendOrSimulateEmail({
      recipient,
      subject,
      body: emailBody,
      customerId: customerId || null,
      orderId: orderId || null,
      draftId: draftId || null,
      source: 'manual',
      isPromotional: Boolean(isPromotional),
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      isSimulated: result.isSimulated,
      providerMessageId: result.providerMessageId,
      log: result.log,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Send request failed' },
      { status: 500 }
    );
  }
}
