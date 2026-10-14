import { createServerClient } from '@/lib/supabase/server';
import type { Customer, Order, OrderItem, CustomerActivity, EmailDraft } from '@/types/database';

export interface FollowUpCandidate {
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  lastCompletedOrderDate: string;
  daysInactive: number;
  orderCount: number;
  totalSpend: number;
  tags: string[];
  eligibilityReason: string;
  sampleProduct?: string;
}

export interface CustomerHistoryPayload {
  customer: Customer;
  orderCount: number;
  completedOrdersCount: number;
  totalCompletedSpend: number;
  lastCompletedOrderDate: string | null;
  daysSinceLastCompletedOrder: number | null;
  recentOrders: (Order & { items: OrderItem[] })[];
  activities: CustomerActivity[];
  previousDrafts: EmailDraft[];
}

// In-memory draft store for when remote database table is awaiting migration
const inMemoryDrafts: EmailDraft[] = [];



/**
 * Tool A: find_follow_up_candidates
 * Deterministic rule:
 * - Has at least one completed order from 60+ days ago
 * - Has no completed order in the last 60 days
 * - Has a usable email address
 * - Cooldown: has not had a follow-up draft created in the last 30 days
 */
export async function findFollowUpCandidates(daysThreshold = 60): Promise<FollowUpCandidate[]> {
  const supabase = createServerClient();

  try {
    // 1. Fetch all customers with usable emails
    const { data: customers, error: cErr } = await supabase
      .from('customers')
      .select('*')
      .not('email', 'is', null);

    if (cErr) {
      console.error('[tools.ts] Supabase customers table query error:', cErr.message);
      return [];
    }

    if (!customers || customers.length === 0) {
      return [];
    }

    // 2. Fetch all orders with items
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('ordered_at', { ascending: false });

    if (oErr || !orders || orders.length === 0) {
      return [];
    }

    // 3. Fetch recent drafts for cooldown check (past 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentDrafts } = await supabase
      .from('email_drafts')
      .select('customer_id, created_at')
      .gte('created_at', thirtyDaysAgo);

    const cooldownCustomerIds = new Set((recentDrafts ?? inMemoryDrafts).map((d) => d.customer_id));

    const now = new Date();
    const candidates: FollowUpCandidate[] = [];

    for (const customer of (customers as Customer[])) {
      if (cooldownCustomerIds.has(customer.id)) continue;

      const customerOrders = (orders as (Order & { order_items: OrderItem[] })[] ?? [])
        .filter((o) => o.customer_id === customer.id);

      if (customerOrders.length === 0) continue;

      const completedOrders = customerOrders
        .filter((o) => o.status === 'completed')
        .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime());

      if (completedOrders.length === 0) continue;

      const mostRecentCompleted = completedOrders[0];
      const lastOrderDate = new Date(mostRecentCompleted.ordered_at);
      const diffTime = Math.abs(now.getTime() - lastOrderDate.getTime());
      const daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (daysInactive >= daysThreshold) {
        const totalSpend = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const firstItem = mostRecentCompleted.order_items?.[0]?.product_name;

        candidates.push({
          customerId: customer.id,
          name: `${customer.first_name} ${customer.last_name}`.trim(),
          email: customer.email,
          phone: customer.phone,
          lastCompletedOrderDate: mostRecentCompleted.ordered_at,
          daysInactive,
          orderCount: customerOrders.length,
          totalSpend,
          tags: customer.tags || [],
          eligibilityReason: `Last completed purchase was ${daysInactive} days ago (${mostRecentCompleted.order_number}). No completed orders since.`,
          sampleProduct: firstItem,
        });
      }
    }

    return candidates.sort((a, b) => b.totalSpend - a.totalSpend);
  } catch (err: unknown) {
    console.error('[tools.ts] findFollowUpCandidates error:', err);
    return [];
  }
}

/**
 * Tool B: get_customer_history
 * Validates customer ID and retrieves authoritative CRM history
 */
export async function getCustomerHistory(customerId: string): Promise<CustomerHistoryPayload> {
  const supabase = createServerClient();

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (cErr || !customer) {
    throw new Error(`Customer with ID "${customerId}" not found.`);
  }

  // Orders with items
  const { data: ordersData, error: oErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('customer_id', customerId)
    .order('ordered_at', { ascending: false });

  if (oErr) throw oErr;

  const orders = (ordersData as unknown as (Order & { order_items: OrderItem[] })[] ?? []).map((o) => ({
    ...o,
    items: o.order_items || [],
  }));

  // Customer activities
  const { data: activities } = await supabase
    .from('customer_activities')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Previous drafts
  const { data: drafts } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(5);

  const completedOrders = orders.filter((o) => o.status === 'completed');
  const totalCompletedSpend = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const lastCompletedOrder = completedOrders[0] || null;

  let daysSinceLast = null;
  if (lastCompletedOrder) {
    const diff = Date.now() - new Date(lastCompletedOrder.ordered_at).getTime();
    daysSinceLast = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  return {
    customer: customer as Customer,
    orderCount: orders.length,
    completedOrdersCount: completedOrders.length,
    totalCompletedSpend,
    lastCompletedOrderDate: lastCompletedOrder ? lastCompletedOrder.ordered_at : null,
    daysSinceLastCompletedOrder: daysSinceLast,
    recentOrders: orders,
    activities: (activities as CustomerActivity[]) ?? [],
    previousDrafts: (drafts as EmailDraft[]) ?? inMemoryDrafts.filter((d) => d.customer_id === customerId),
  };
}

/**
 * Tool C: create_email_draft
 * Persists draft to email_drafts table
 */
export async function createEmailDraft({
  customerId,
  subject,
  body,
  recommendationReason,
  orderId,
  isAiGenerated = true,
}: {
  customerId: string;
  subject: string;
  body: string;
  recommendationReason: string;
  orderId?: string | null;
  isAiGenerated?: boolean;
}): Promise<EmailDraft> {
  const supabase = createServerClient();

  const draftRecord: EmailDraft = {
    id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    customer_id: customerId,
    order_id: orderId || null,
    subject: subject.trim(),
    body: body.trim(),
    status: 'draft',
    ai_generated: isAiGenerated,
    recommendation_reason: recommendationReason.trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data: draft, error: dErr } = await supabase
      .from('email_drafts')
      .insert({
        customer_id: customerId,
        order_id: orderId || null,
        subject: subject.trim(),
        body: body.trim(),
        status: 'draft',
        ai_generated: isAiGenerated,
        recommendation_reason: recommendationReason.trim(),
      })
      .select('*')
      .single();

    if (!dErr && draft) {
      await logCustomerActivity({
        customerId,
        description: `AI follow-up draft created: "${subject.trim()}"`,
        orderId: orderId || undefined,
        type: 'note',
      });
      return draft as EmailDraft;
    }
  } catch (err: unknown) {
    console.warn('[tools.ts] email_drafts table insert fallback:', err);
  }

  // In-memory fallback if table not yet migrated
  inMemoryDrafts.unshift(draftRecord);
  return draftRecord;
}

/**
 * Tool D: log_customer_activity
 * Deduplicates recent activity logs within 10 minutes to avoid spamming on retries
 */
export async function logCustomerActivity({
  customerId,
  description,
  orderId,
  type = 'note',
}: {
  customerId: string;
  description: string;
  orderId?: string;
  type?: 'note' | 'order_event' | 'system_event';
}): Promise<void> {
  const supabase = createServerClient();

  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('customer_activities')
      .select('id')
      .eq('customer_id', customerId)
      .eq('description', description)
      .gte('created_at', tenMinsAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      return;
    }

    await supabase.from('customer_activities').insert({
      customer_id: customerId,
      order_id: orderId || null,
      type,
      description,
    });
  } catch (err: unknown) {
    console.warn('[tools.ts] logCustomerActivity fallback:', err);
  }
}
