import { createServerClient } from '@/lib/supabase/server';
import type { Order, Customer, WorkflowExecution, CommunicationWorkflow, EmailTemplate } from '@/types/database';
import { sendOrSimulateEmail } from './resend';
import { formatCurrency } from '@/utils/format';

export interface WorkflowStatusOverview {
  workflow: CommunicationWorkflow | null;
  template: EmailTemplate | null;
  totalExecutions: number;
  lastExecution: WorkflowExecution | null;
}

/**
 * Get the workflow status overview directly from Supabase
 */
export async function getWorkflowStatus(): Promise<WorkflowStatusOverview> {
  const supabase = createServerClient();

  try {
    const { data: wf, error: wfErr } = await supabase
      .from('communication_workflows')
      .select('*, email_templates(*)')
      .eq('trigger_type', 'order_completed')
      .maybeSingle();

    if (wfErr) throw wfErr;

    const { data: executions, count } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(1);

    if (wf) {
      return {
        workflow: wf as unknown as CommunicationWorkflow,
        template: (wf as unknown as { email_templates: EmailTemplate })?.email_templates || null,
        totalExecutions: count ?? 0,
        lastExecution: (executions?.[0] as WorkflowExecution) ?? null,
      };
    }
  } catch (err: unknown) {
    console.warn('[workflow.ts] Error retrieving workflow from database:', err);
  }

  return {
    workflow: null,
    template: null,
    totalExecutions: 0,
    lastExecution: null,
  };
}

/**
 * Toggle workflow active status directly in database
 */
export async function toggleWorkflow(enabled: boolean): Promise<boolean> {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('communication_workflows')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('trigger_type', 'order_completed')
      .select('is_enabled')
      .single();

    if (error) throw error;
    return Boolean(data?.is_enabled);
  } catch (err: unknown) {
    console.warn('[workflow.ts] Failed to update workflow state in DB:', err);
    return enabled;
  }
}

/**
 * Execute the automated order-completed workflow with strict idempotency and database verification
 */
export async function executeOrderCompletedWorkflow({
  orderId,
  isSimulation = false,
}: {
  orderId: string;
  isSimulation?: boolean;
}): Promise<{ success: boolean; status: string; message: string; execution: WorkflowExecution }> {
  const supabase = createServerClient();
  const eventKey = `order_completed:${orderId}${isSimulation ? `_sim_${Date.now()}` : ''}`;

  // 1. Fetch workflow and template from database
  const { data: wfData } = await supabase
    .from('communication_workflows')
    .select('*, email_templates(*)')
    .eq('trigger_type', 'order_completed')
    .maybeSingle();

  if (!wfData) {
    throw new Error('Automated workflow "order_completed" not found in database. Please run the seed script to configure workflows.');
  }

  const workflow = wfData as unknown as (CommunicationWorkflow & { email_templates?: EmailTemplate });
  const template = workflow.email_templates || null;

  if (!workflow.is_enabled && !isSimulation) {
    throw new Error('Automated workflow "order_completed" is currently disabled.');
  }

  // 2. Check idempotency (prevent duplicate execution for same order & workflow)
  if (!isSimulation) {
    const { data: existing } = await supabase
      .from('workflow_executions')
      .select('id, status')
      .eq('event_key', eventKey)
      .maybeSingle();

    if (existing) {
      throw new Error(`Workflow already executed for order ${orderId} (Status: ${existing.status}). Duplicate blocked.`);
    }
  }

  // 3. Fetch order and customer details directly from DB
  const { data: oData, error: oErr } = await supabase
    .from('orders')
    .select('*, customers(*)')
    .eq('id', orderId)
    .single();

  if (oErr || !oData) {
    throw new Error(`Order with ID "${orderId}" not found in database.`);
  }

  const orderRecord = oData as unknown as (Order & { customers?: Customer });
  const customer = orderRecord.customers;

  // 4. Validation: Customer email & opt-out
  if (!customer?.email) {
    const executionRecord: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflow_id: workflow.id,
      event_key: eventKey,
      order_id: orderId,
      customer_id: customer?.id || null,
      status: 'skipped',
      result_details: 'Skipped: Order has no customer email address associated.',
      created_at: new Date().toISOString(),
    };
    return { success: false, status: 'skipped', message: executionRecord.result_details!, execution: executionRecord };
  }

  if (customer.email_opt_out) {
    const executionRecord: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflow_id: workflow.id,
      event_key: eventKey,
      order_id: orderId,
      customer_id: customer.id,
      status: 'skipped',
      result_details: 'Skipped: Customer has opted out of automated email communications.',
      created_at: new Date().toISOString(),
    };
    return { success: false, status: 'skipped', message: executionRecord.result_details!, execution: executionRecord };
  }

  // 5. Populate Template from database
  const customerName = `${customer.first_name} ${customer.last_name}`.trim();
  const formattedTotal = formatCurrency(Number(orderRecord.total), orderRecord.currency);

  const subjectTemplate = template?.subject || `Thank you for your order (${orderRecord.order_number})`;
  const bodyTemplate = template?.body || `Hi {{customer_name}},\n\nThank you for choosing Kilowatt! Your order ({{order_number}}) has been completed.\n\nOrder Total: {{order_total}}\n\nBest regards,\nThe Kilowatt Customer Care Team`;

  const populatedSubject = subjectTemplate.replace(/{{order_number}}/g, orderRecord.order_number);
  const populatedBody = bodyTemplate
    .replace(/{{customer_name}}/g, customerName)
    .replace(/{{order_number}}/g, orderRecord.order_number)
    .replace(/{{order_total}}/g, formattedTotal);

  // 6. Send or Simulate Email
  const sendResult = await sendOrSimulateEmail({
    recipient: customer.email,
    subject: populatedSubject,
    body: populatedBody,
    customerId: customer.id,
    orderId: orderRecord.id,
    workflowId: workflow.id,
    source: 'workflow',
    isPromotional: false,
  });

  // 7. Record Execution in Database
  const executionRecord: WorkflowExecution = {
    id: `exec-${Date.now()}`,
    workflow_id: workflow.id,
    event_key: eventKey,
    order_id: orderRecord.id,
    customer_id: customer.id,
    status: sendResult.isSimulated ? 'simulated' : sendResult.success ? 'success' : 'failed',
    result_details: sendResult.isSimulated
      ? `SIMULATED: Thank-you email generated for order ${orderRecord.order_number} to ${customer.email}.`
      : sendResult.success
      ? `Email accepted by Resend (ID: ${sendResult.providerMessageId}) for order ${orderRecord.order_number}.`
      : `Email failed: ${sendResult.errorMessage}`,
    created_at: new Date().toISOString(),
  };

  try {
    if (workflow?.id) {
      await supabase.from('workflow_executions').insert({
        workflow_id: workflow.id,
        event_key: eventKey,
        order_id: orderRecord.id,
        customer_id: customer.id,
        status: executionRecord.status,
        result_details: executionRecord.result_details,
      });
    }
  } catch (err: unknown) {
    console.warn('[workflow.ts] workflow_executions insert error:', err);
  }

  return {
    success: sendResult.success,
    status: executionRecord.status,
    message: executionRecord.result_details!,
    execution: executionRecord,
  };
}
