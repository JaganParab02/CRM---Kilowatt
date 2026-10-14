import { createServerClient } from '@/lib/supabase/server';
import type { EmailLog, EmailLogStatus } from '@/types/database';
import { logCustomerActivity } from '@/lib/ai/tools';

export interface SendEmailPayload {
  recipient: string;
  subject: string;
  body: string;
  customerId?: string | null;
  orderId?: string | null;
  draftId?: string | null;
  workflowId?: string | null;
  source: 'manual' | 'workflow';
  isPromotional?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  status: EmailLogStatus;
  isSimulated: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  log: EmailLog;
}

// In-memory logs for resilience when remote database table is awaiting migration
const globalForEmail = globalThis as unknown as {
  inMemoryLogs?: EmailLog[];
};
const inMemoryLogs: EmailLog[] =
  globalForEmail.inMemoryLogs ?? (globalForEmail.inMemoryLogs = []);

/**
 * Send an email via Resend API or simulate in Demo Mode
 */
export async function sendOrSimulateEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { recipient, subject, body, customerId, orderId, draftId, workflowId, source, isPromotional } = payload;

  // 1. Basic validation
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Valid recipient email address is required.');
  }
  if (!subject.trim()) {
    throw new Error('Email subject is required.');
  }
  if (!body.trim()) {
    throw new Error('Email body is required.');
  }

  // 2. Opt-out check for customers directly from database (if promotional)
  if (isPromotional) {
    let isOptedOut = false;
    const supabase = createServerClient();

    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('email_opt_out')
        .eq('id', customerId)
        .maybeSingle();

      if (customer?.email_opt_out) {
        isOptedOut = true;
      }
    } else if (recipient) {
      const { data: customer } = await supabase
        .from('customers')
        .select('email_opt_out')
        .eq('email', recipient.trim().toLowerCase())
        .maybeSingle();

      if (customer?.email_opt_out) {
        isOptedOut = true;
      }
    }

    if (isOptedOut) {
      throw new Error('Customer has opted out of promotional communications. Email delivery blocked.');
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'CommercePilot <onboarding@resend.dev>';

  let status: EmailLogStatus = 'simulated';
  let isSimulated = true;
  let providerMessageId: string | undefined = undefined;
  let errorMessage: string | undefined = undefined;

  // 3. Provider invocation or Demo Mode
  if (resendApiKey && resendApiKey.trim() !== '' && !resendApiKey.includes('your-resend')) {
    // Live Resend Provider Call
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey.trim()}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient.trim()],
          subject: subject.trim(),
          text: body.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        status = 'failed';
        isSimulated = false;
        errorMessage = `Resend API error (${res.status}): ${errText}`;
      } else {
        const resData = await res.json();
        status = 'sent'; // Accepted by provider, not claiming delivered without webhook evidence
        isSimulated = false;
        providerMessageId = resData.id;
      }
    } catch (err: unknown) {
      status = 'failed';
      isSimulated = false;
      errorMessage = err instanceof Error ? err.message : 'Network error communicating with Resend API';
    }
  } else {
    // Safe Demo Mode
    status = 'simulated';
    isSimulated = true;
    providerMessageId = `sim_resend_${Date.now()}`;
  }

  // 4. Record Communication Log
  const logRecord: EmailLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    customer_id: customerId || null,
    order_id: orderId || null,
    draft_id: draftId || null,
    workflow_id: workflowId || null,
    recipient: recipient.trim(),
    subject: subject.trim(),
    body: body.trim(),
    source,
    status,
    provider_message_id: providerMessageId || null,
    error_message: errorMessage || null,
    is_simulated: isSimulated,
    created_at: new Date().toISOString(),
  };

  // Persist in Supabase email_logs
  try {
    const supabase = createServerClient();
    const { data: dbLog, error: logErr } = await supabase
      .from('email_logs')
      .insert({
        customer_id: customerId || null,
        order_id: orderId || null,
        draft_id: draftId || null,
        workflow_id: workflowId || null,
        recipient: recipient.trim(),
        subject: subject.trim(),
        body: body.trim(),
        source,
        status,
        provider_message_id: providerMessageId || null,
        error_message: errorMessage || null,
        is_simulated: isSimulated,
      })
      .select('*')
      .single();

    if (!logErr && dbLog) {
      logRecord.id = dbLog.id;
    }
  } catch (err: unknown) {
    console.warn('[resend.ts] email_logs table insert fallback:', err);
  }

  // Add to in-memory fallback
  inMemoryLogs.unshift(logRecord);

  // 5. Record Customer Activity Entry
  if (customerId) {
    const statusLabel = isSimulated ? 'Simulated Email' : status === 'sent' ? 'Email Accepted' : 'Email Delivery Failed';
    await logCustomerActivity({
      customerId,
      description: `[${source.toUpperCase()}] ${statusLabel}: "${subject.trim()}" to ${recipient}`,
      orderId: orderId || undefined,
      type: 'note',
    });
  }

  return {
    success: status !== 'failed',
    status,
    isSimulated,
    providerMessageId,
    errorMessage,
    log: logRecord,
  };
}

/**
 * Retrieve Communication History
 */
export async function getCommunicationHistory(): Promise<EmailLog[]> {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      return [];
    }

    return data as EmailLog[];
  } catch {
    return [];
  }
}
