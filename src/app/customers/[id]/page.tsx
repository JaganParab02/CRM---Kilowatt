'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Customer, Order, CustomerActivity } from '@/types/database';
import { formatCurrency, formatDate, formatShortDate, getOrderStatusBadge } from '@/utils/format';

interface OrderItemSummary {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface OrderWithItems extends Order {
  order_items?: OrderItemSummary[];
}

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadCustomerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserClient();

      // 1. Fetch Customer
      const { data: cData, error: cErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (cErr) {
        console.error('Customer profile query failed:', {
          code: cErr.code,
          message: cErr.message,
          details: cErr.details,
          hint: cErr.hint,
        });
        throw new Error(`Customer profile query failed [${cErr.code || 'UNKNOWN'}]: ${cErr.message}`);
      }
      if (!cData) throw new Error('Customer not found');

      setCustomer(cData);
      setFirstName(cData.first_name);
      setLastName(cData.last_name);
      setEmail(cData.email);
      setPhone(cData.phone || '');

      // 2. Fetch Customer Orders with items
      const { data: oData, error: oErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('customer_id', customerId)
        .order('ordered_at', { ascending: false });

      if (oErr) {
        console.warn('Customer orders query warning:', {
          code: oErr.code,
          message: oErr.message,
          details: oErr.details,
          hint: oErr.hint,
        });
      }
      setOrders((oData as unknown as OrderWithItems[]) ?? []);

      // 3. Fetch Customer Activities
      const { data: aData, error: aErr } = await supabase
        .from('customer_activities')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (aErr) {
        console.warn('Customer activities query warning:', {
          code: aErr.code,
          message: aErr.message,
          details: aErr.details,
          hint: aErr.hint,
        });
      }
      setActivities(aData ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading customer details');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Compute metrics & retention insights
  const totalOrders = orders.length;
  const completedOrders = orders
    .filter((o) => o.status === 'completed')
    .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime());

  const completedSpending = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const mostRecentOrderDate = orders[0]?.ordered_at || null;

  // Extract all unique product names across orders
  const productSet = new Set<string>();
  orders.forEach((o) => {
    (o.order_items || []).forEach((item) => {
      if (item.product_name) productSet.add(item.product_name);
    });
  });
  const allProducts = Array.from(productSet);

  // Compute Retention Metrics & Evidence
  const now = new Date();
  let daysInactive: number | null = null;
  let retentionStatus: 'at_risk' | 'cooling' | 'active' | 'no_orders' = 'no_orders';
  let sampleProduct: string | null = null;
  let latestCompletedOrder: OrderWithItems | null = null;

  if (completedOrders.length > 0) {
    latestCompletedOrder = completedOrders[0];
    sampleProduct = latestCompletedOrder.order_items?.[0]?.product_name || allProducts[0] || null;
    const diff = Math.abs(now.getTime() - new Date(latestCompletedOrder.ordered_at).getTime());
    daysInactive = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (daysInactive >= 60) {
      retentionStatus = 'at_risk';
    } else if (daysInactive >= 30) {
      retentionStatus = 'cooling';
    } else {
      retentionStatus = 'active';
    }
  }

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim() || !cleanEmail) {
      setSaveMessage({ type: 'error', text: 'First name, last name, and email are required.' });
      setSaveLoading(false);
      return;
    }

    try {
      const supabase = createBrowserClient();
      const { error: updErr } = await supabase
        .from('customers')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: cleanEmail,
          phone: phone.trim() || null,
        })
        .eq('id', customerId);

      if (updErr) {
        if (updErr.message.includes('unique') || updErr.message.includes('email')) {
          throw new Error('A customer with this email address already exists.');
        }
        throw updErr;
      }

      setSaveMessage({ type: 'success', text: 'Customer profile updated successfully.' });
      setIsEditing(false);
      loadCustomerData();
    } catch (err: unknown) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="h-8 w-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          <div className="h-64 md:col-span-2 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-3xl space-y-4">
        <Link
          href="/customers"
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
        >
          &larr; Back to Customers Directory
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <h3 className="font-semibold text-base mb-1">Customer Not Found</h3>
          <p className="text-xs">{error || 'Unable to retrieve customer details.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Back to Customer Directory"
          >
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {customer.first_name} {customer.last_name}
              </h2>
              {retentionStatus === 'at_risk' && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                  ⚠️ Retention Candidate
                </span>
              )}
              {retentionStatus === 'cooling' && (
                <span className="rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-yellow-700 border border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800">
                  🟡 Cooling
                </span>
              )}
              {retentionStatus === 'active' && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  🟢 Active Shopper
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customer ID: <span className="font-mono">{customer.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href={`/ai-assistant?customerId=${customerId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
          >
            <span>✨ AI Retention Follow-Up</span>
          </Link>
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              setSaveMessage(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
        </div>
      </div>

      {/* Save Notification */}
      {saveMessage && (
        <div
          className={`rounded-lg p-3 text-xs font-medium border ${
            saveMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Edit Form (Collapsible) */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Edit Customer Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address * (normalized to lowercase)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveLoading}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saveLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* ─── AI Retention Agent Evaluation & Health Card (Matches Retention Agent) ─── */}
      <div className="rounded-xl border border-indigo-200/80 bg-white p-6 shadow-sm dark:border-indigo-950 dark:bg-slate-900/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Agentic AI Retention Evaluation & Evidence</span>
              </h3>
              {retentionStatus === 'at_risk' && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                  {daysInactive}d inactive &bull; Follow-Up Recommended
                </span>
              )}
              {retentionStatus === 'cooling' && (
                <span className="rounded bg-yellow-50 px-2 py-0.5 text-[11px] font-bold text-yellow-700 border border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300">
                  {daysInactive}d inactive &bull; Cooling
                </span>
              )}
              {retentionStatus === 'active' && (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {daysInactive}d inactive &bull; High Engagement
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Authoritative retention analysis based on real purchase history and activity records
            </p>
          </div>

          <Link
            href={`/ai-assistant?customerId=${customerId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95 self-start sm:self-auto shrink-0"
          >
            <span>✨ Launch AI Retention Assistant</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {/* Agent Recommendation Box */}
        <div className="rounded-lg bg-indigo-50/70 p-4 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/50 space-y-2">
          <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
            Agent Retention Summary & Recommendation
          </h4>
          <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
            {retentionStatus === 'at_risk' && (
              <>
                Re-engagement follow-up recommended: Customer last completed purchase was{' '}
                <strong>{daysInactive} days ago</strong> ({latestCompletedOrder?.order_number}
                {sampleProduct ? ` • ${sampleProduct}` : ''}). No completed orders since.
                Customer has a high lifetime value of <strong>{formatCurrency(completedSpending)}</strong> across {completedOrders.length} orders.
              </>
            )}
            {retentionStatus === 'cooling' && (
              <>
                Warm engagement stage: Customer last completed purchase was{' '}
                <strong>{daysInactive} days ago</strong> ({latestCompletedOrder?.order_number}
                {sampleProduct ? ` • ${sampleProduct}` : ''}). Inactivity is approaching the 60-day threshold.
              </>
            )}
            {retentionStatus === 'active' && (
              <>
                Active shopper: Customer completed a purchase{' '}
                <strong>{daysInactive} days ago</strong> ({latestCompletedOrder?.order_number}
                {sampleProduct ? ` • ${sampleProduct}` : ''}). Engagement health is strong.
              </>
            )}
            {retentionStatus === 'no_orders' && (
              <>
                New customer profile: No completed orders recorded in the CRM yet. Customer registered on{' '}
                {formatDate(customer.created_at)} via {customer.source}.
              </>
            )}
          </p>

          <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
            <strong>Suggested Retention Focus:</strong>{' '}
            {retentionStatus === 'at_risk' && (
              <>
                Acknowledge past purchase of {sampleProduct || 'items'} and propose an exclusive loyalty offer or showcase trending complementary products.
              </>
            )}
            {retentionStatus === 'cooling' && (
              <>
                Share new arrivals in categories complementary to {sampleProduct || 'past orders'} to maintain interest before reaching 60 days.
              </>
            )}
            {retentionStatus === 'active' && (
              <>
                Follow up on recent order satisfaction and provide helpful product care tips.
              </>
            )}
            {retentionStatus === 'no_orders' && (
              <>
                Send store introduction and onboarding promo code for their first purchase.
              </>
            )}
          </p>
        </div>

        {/* Evidence Checklist From Database */}
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Evidence From Database Records
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">&#10003;</span>
              <span>
                <strong>Inactivity Duration:</strong>{' '}
                {daysInactive !== null
                  ? `${daysInactive} days without a completed purchase (${daysInactive >= 60 ? 'Exceeds 60-day re-engagement threshold' : 'Within active threshold'})`
                  : 'No completed orders placed'}
              </span>
            </li>
            {latestCompletedOrder && (
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">&#10003;</span>
                <span>
                  <strong>Last Completed Order:</strong> {latestCompletedOrder.order_number} on{' '}
                  {formatDate(latestCompletedOrder.ordered_at)} for{' '}
                  {formatCurrency(Number(latestCompletedOrder.total))}
                </span>
              </li>
            )}
            {allProducts.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">&#10003;</span>
                <span>
                  <strong>Purchased Products:</strong> {allProducts.join(', ')}
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">&#10003;</span>
              <span>
                <strong>Lifetime Value:</strong> {completedOrders.length} completed orders totaling{' '}
                {formatCurrency(completedSpending)} ({totalOrders} total orders placed)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">&#10003;</span>
              <span>
                <strong>CRM Profile:</strong> Registered on {formatDate(customer.created_at)} via source &apos;{customer.source}&apos;
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Profile Overview Card & Purchase Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Details Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 lg:col-span-1 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
            Profile Details
          </h3>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-400 block">Email</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 text-xs break-all">
                {customer.email}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 block">Phone</span>
              <span className="text-slate-800 dark:text-slate-200 text-xs">
                {customer.phone || '—'}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 block">Source</span>
              <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase">
                {customer.source}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 block">Registered On</span>
              <span className="text-slate-800 dark:text-slate-200 text-xs">
                {formatDate(customer.created_at)}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 block mb-1">Tags</span>
              <div className="flex flex-wrap gap-1">
                {customer.tags && customer.tags.length > 0 ? (
                  customer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                    >
                      #{tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No tags assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Summary Metrics */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                Total Orders Placed
              </span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                {totalOrders}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Lifetime orders count</span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                Completed Spend
              </span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {formatCurrency(completedSpending)}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Completed orders only
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                Most Recent Order
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 block">
                {mostRecentOrderDate ? formatShortDate(mostRecentOrderDate) : 'No orders'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Last purchase activity</span>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <span>Customer Activity Timeline</span>
              <span className="text-xs text-slate-400 font-normal">{activities.length} events</span>
            </h3>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No activity records logged for this customer yet.
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 text-xs">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                      {act.type === 'order_event' ? '🛒' : act.type === 'note' ? '📝' : '⚙️'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {act.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="capitalize">{act.type.replace('_', ' ')}</span>
                        <span>&bull;</span>
                        <span>{formatDate(act.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase History Table */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Purchase History ({orders.length})
        </h3>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No orders placed by this customer yet.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Date Placed</th>
                  <th className="px-6 py-3.5">Items Purchased</th>
                  <th className="px-6 py-3.5">Total Amount</th>
                  <th className="px-6 py-3.5">Order Status</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {orders.map((o) => {
                  const badge = getOrderStatusBadge(o.status);
                  const items = o.order_items || [];

                  return (
                    <tr
                      key={o.id}
                      className="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                        <Link
                          href={`/orders/${o.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 underline decoration-slate-300 underline-offset-2"
                        >
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(o.ordered_at)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300">
                        {items.length > 0 ? (
                          <div className="space-y-0.5">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className="text-slate-400">&bull;</span>
                                <span>{item.product_name}</span>
                                {item.quantity > 1 && (
                                  <span className="text-slate-400 text-[11px]">(x{item.quantity})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No line items recorded</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(Number(o.total), o.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300 capitalize">
                        {o.payment_status}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/orders/${o.id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                          View Order &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
