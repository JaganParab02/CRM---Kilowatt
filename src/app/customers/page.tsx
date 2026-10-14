'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Customer } from '@/types/database';
import { formatCurrency, formatShortDate, formatDate } from '@/utils/format';

export type RetentionStatus = 'all' | 'at_risk' | 'cooling' | 'active' | 'no_orders';

export interface CustomerRetentionInfo {
  status: 'at_risk' | 'cooling' | 'active' | 'no_orders';
  statusLabel: string;
  daysInactive: number | null;
  lastOrderDate: string | null;
  lastOrderNumber: string | null;
  sampleProduct: string | null;
  allProducts: string[];
  totalCompletedSpend: number;
  completedOrdersCount: number;
  totalOrdersCount: number;
  retentionSummary: string;
  suggestedAction: string;
  isEligibleForFollowUp: boolean;
}

interface OrderWithItems {
  customer_id: string;
  total: number;
  status: string;
  ordered_at: string;
  order_number: string;
  order_items?: { product_name: string }[] | null;
}

interface CustomerWithStats extends Customer {
  orderCount: number;
  totalSpending: number;
  retention: CustomerRetentionInfo;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [retentionFilter, setRetentionFilter] = useState<RetentionStatus>('all');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  const fetchCustomersWithStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserClient();

      // 1. Fetch all customers with exact count
      const { data: customerData, error: cErr, count: cCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (cErr) {
        console.error('Customer query failed:', {
          code: cErr.code,
          message: cErr.message,
          details: cErr.details,
          hint: cErr.hint,
        });
        throw new Error(
          `Customer query failed [${cErr.code || 'UNKNOWN'}]: ${cErr.message || 'Check database permissions and Row Level Security.'}`
        );
      } else {
        console.log('Customer records fetched:', cCount ?? customerData?.length ?? 0);
      }

      // 2. Fetch all orders with items to compute retention metrics and summaries
      let orderData: OrderWithItems[] = [];
      const { data: oData, error: oErr } = await supabase
        .from('orders')
        .select('customer_id, total, status, ordered_at, order_number, order_items(product_name)');

      if (oErr) {
        console.warn('Orders summary query warning (proceeding with basic stats):', {
          code: oErr.code,
          message: oErr.message,
          details: oErr.details,
          hint: oErr.hint,
        });
      } else if (oData) {
        orderData = oData as unknown as OrderWithItems[];
      }

      // Group orders by customer_id
      const customerOrdersMap = new Map<string, OrderWithItems[]>();
      orderData.forEach((o) => {
        if (!o.customer_id) return;
        const list = customerOrdersMap.get(o.customer_id) || [];
        list.push(o);
        customerOrdersMap.set(o.customer_id, list);
      });

      const now = new Date();

      const enriched: CustomerWithStats[] = ((customerData as Customer[]) ?? []).map((c: Customer) => {
        const cOrders = customerOrdersMap.get(c.id) || [];
        const completedOrders = cOrders
          .filter((o) => o.status === 'completed')
          .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime());

        const totalSpending = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        // Collect all distinct products purchased
        const productSet = new Set<string>();
        cOrders.forEach((o) => {
          (o.order_items || []).forEach((item) => {
            if (item.product_name) productSet.add(item.product_name);
          });
        });
        const allProducts = Array.from(productSet);

        // Determine retention status & summary
        let status: 'at_risk' | 'cooling' | 'active' | 'no_orders' = 'no_orders';
        let statusLabel = 'No Orders';
        let daysInactive: number | null = null;
        let lastOrderDate: string | null = null;
        let lastOrderNumber: string | null = null;
        let sampleProduct: string | null = null;
        let retentionSummary = 'New customer profile. No completed orders recorded yet.';
        let suggestedAction = 'Initial welcome sequence or onboarding outreach';
        let isEligibleForFollowUp = false;

        if (completedOrders.length > 0) {
          const latest = completedOrders[0];
          lastOrderDate = latest.ordered_at;
          lastOrderNumber = latest.order_number;
          sampleProduct = latest.order_items?.[0]?.product_name || allProducts[0] || null;

          const diffTime = Math.abs(now.getTime() - new Date(latest.ordered_at).getTime());
          daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (daysInactive >= 60) {
            status = 'at_risk';
            statusLabel = 'Retention Candidate';
            isEligibleForFollowUp = true;
            retentionSummary = `Last completed purchase was ${daysInactive} days ago (${latest.order_number}${sampleProduct ? ` • ${sampleProduct}` : ''}). No completed orders since.`;
            suggestedAction = `Re-engagement follow-up recommended: acknowledge past purchase of ${sampleProduct || 'items'} with tailored incentive.`;
          } else if (daysInactive >= 30) {
            status = 'cooling';
            statusLabel = 'Cooling (30–60d)';
            isEligibleForFollowUp = false;
            retentionSummary = `Last completed purchase was ${daysInactive} days ago (${latest.order_number}${sampleProduct ? ` • ${sampleProduct}` : ''}). In warm engagement stage.`;
            suggestedAction = 'Monitor for 60-day threshold or share new product arrivals.';
          } else {
            status = 'active';
            statusLabel = 'Active (<30d)';
            isEligibleForFollowUp = false;
            retentionSummary = `Recent purchase ${daysInactive} days ago (${latest.order_number}${sampleProduct ? ` • ${sampleProduct}` : ''}). High engagement.`;
            suggestedAction = 'Order delivery follow-up or customer satisfaction survey.';
          }
        }

        const retention: CustomerRetentionInfo = {
          status,
          statusLabel,
          daysInactive,
          lastOrderDate,
          lastOrderNumber,
          sampleProduct,
          allProducts,
          totalCompletedSpend: totalSpending,
          completedOrdersCount: completedOrders.length,
          totalOrdersCount: cOrders.length,
          retentionSummary,
          suggestedAction,
          isEligibleForFollowUp,
        };

        return {
          ...c,
          orderCount: cOrders.length,
          totalSpending,
          retention,
        };
      });

      setCustomers(enriched);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomersWithStats();
  }, [fetchCustomersWithStats]);

  // Aggregate Retention Metrics
  const metrics = useMemo(() => {
    const total = customers.length;
    let atRisk = 0;
    let cooling = 0;
    let active = 0;
    let noOrders = 0;
    let totalSpend = 0;

    customers.forEach((c) => {
      totalSpend += c.totalSpending;
      if (c.retention.status === 'at_risk') atRisk++;
      else if (c.retention.status === 'cooling') cooling++;
      else if (c.retention.status === 'active') active++;
      else noOrders++;
    });

    return { total, atRisk, cooling, active, noOrders, totalSpend };
  }, [customers]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      (c.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [customers]);

  // Filter customers by search query, tag, and retention status
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.retention.sampleProduct && c.retention.sampleProduct.toLowerCase().includes(q)) ||
        (c.retention.lastOrderNumber && c.retention.lastOrderNumber.toLowerCase().includes(q));

      // Tag filter
      const matchesTag =
        selectedTag === 'all' ||
        (c.tags && c.tags.includes(selectedTag));

      // Retention filter
      const matchesRetention =
        retentionFilter === 'all' ||
        c.retention.status === retentionFilter;

      return matchesSearch && matchesTag && matchesRetention;
    });
  }, [customers, searchQuery, selectedTag, retentionFilter]);

  const toggleExpand = (id: string) => {
    setExpandedCustomerId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-7xl space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Customer Directory & Retention Insights
            </h2>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              AI Monitored
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Real-time customer directory with AI-powered retention evaluation, inactivity tracking, purchase history summaries, and 1-click re-engagement workflows.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/ai-assistant"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
          >
            <span>✨ Open Retention Agent</span>
          </Link>
          <button
            onClick={fetchCustomersWithStats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {loading ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>
      </div>

      {/* Retention Overview Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div
          onClick={() => setRetentionFilter('all')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            retentionFilter === 'all'
              ? 'border-indigo-500 bg-indigo-50/30 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/20'
              : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Total Customers</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Database
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {metrics.total}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Total lifetime spend: {formatCurrency(metrics.totalSpend)}
          </p>
        </div>

        {/* Retention Candidates */}
        <div
          onClick={() => setRetentionFilter('at_risk')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            retentionFilter === 'at_risk'
              ? 'border-amber-500 bg-amber-50/40 shadow-sm dark:border-amber-500 dark:bg-amber-950/20'
              : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Follow-up Candidates
            </span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              &gt;60d Inactive
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.atRisk}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Eligible for AI re-engagement drafts
          </p>
        </div>

        {/* Cooling Engagement */}
        <div
          onClick={() => setRetentionFilter('cooling')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            retentionFilter === 'cooling'
              ? 'border-yellow-500 bg-yellow-50/30 shadow-sm dark:border-yellow-500 dark:bg-yellow-950/20'
              : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-yellow-700 dark:text-yellow-400">
            <span className="font-semibold">Cooling Stage</span>
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
              30–60d Inactive
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {metrics.cooling}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Warm stage &bull; approaching threshold
          </p>
        </div>

        {/* Active Shoppers */}
        <div
          onClick={() => setRetentionFilter('active')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            retentionFilter === 'active'
              ? 'border-emerald-500 bg-emerald-50/30 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/20'
              : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400">
            <span className="font-semibold">Active Shoppers</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              &lt;30d Recent
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.active}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            High engagement &bull; active shoppers
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 text-sm">
          <strong>Error loading customer records:</strong> {error}
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="space-y-3">
        {/* Retention Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
            Retention Filter:
          </span>
          <button
            onClick={() => setRetentionFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              retentionFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            All Customers ({metrics.total})
          </button>
          <button
            onClick={() => setRetentionFilter('at_risk')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              retentionFilter === 'at_risk'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
            }`}
          >
            <span>⚠️ Needs Follow-up &gt;60d</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              {metrics.atRisk}
            </span>
          </button>
          <button
            onClick={() => setRetentionFilter('cooling')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              retentionFilter === 'cooling'
                ? 'bg-yellow-600 text-white shadow-sm'
                : 'bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800'
            }`}
          >
            <span>🟡 Cooling (30–60d)</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              {metrics.cooling}
            </span>
          </button>
          <button
            onClick={() => setRetentionFilter('active')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              retentionFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
            }`}
          >
            <span>🟢 Active (&lt;30d)</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              {metrics.active}
            </span>
          </button>
          <button
            onClick={() => setRetentionFilter('no_orders')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              retentionFilter === 'no_orders'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span>⚪ No Orders</span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              {metrics.noOrders}
            </span>
          </button>
        </div>

        {/* Search input and Tag filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, product (e.g. Hoodie), order #..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="sm:w-48">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">All Tags ({customers.length})</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    Tag: #{tag}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Customer Count Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          Showing <strong>{filteredCustomers.length}</strong> of{' '}
          <strong>{customers.length}</strong> customers
        </span>
        {(selectedTag !== 'all' || retentionFilter !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Active filters:</span>
            {retentionFilter !== 'all' && (
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Status: {retentionFilter}
              </span>
            )}
            {selectedTag !== 'all' && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                #{selectedTag}
              </span>
            )}
            <button
              onClick={() => {
                setRetentionFilter('all');
                setSelectedTag('all');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-rose-600 hover:underline ml-1"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-10 text-center dark:border-amber-800/80 dark:bg-amber-950/20 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 text-xl font-bold">
            0
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No Customer Records Retrieved from Database
          </h3>
          <p className="max-w-xl mx-auto text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Ensure Row Level Security (RLS) permits SELECT for the public/anon API role on the customers table.
          </p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            No customers match your filter criteria
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query, tag, or retention filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTag('all');
              setRetentionFilter('all');
            }}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Retention Status</th>
                  <th className="px-5 py-3.5">Activity & Retention Summary</th>
                  <th className="px-5 py-3.5 text-center">Orders</th>
                  <th className="px-5 py-3.5 text-right">Spend</th>
                  <th className="px-5 py-3.5">Tags</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredCustomers.map((c) => {
                  const isExpanded = expandedCustomerId === c.id;
                  const ret = c.retention;

                  return (
                    <tr
                      key={c.id}
                      className={`group transition-colors ${
                        ret.status === 'at_risk'
                          ? 'hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                          : 'hover:bg-slate-50/75 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Customer Name & Info */}
                      <td className="px-5 py-4 align-top">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 block"
                        >
                          {c.first_name} {c.last_name}
                        </Link>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                          {c.email}
                        </span>
                        {c.phone && (
                          <span className="text-[11px] text-slate-400 block">
                            {c.phone}
                          </span>
                        )}
                        <span className="inline-block mt-1 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                          {c.source} &bull; Joined {formatShortDate(c.created_at)}
                        </span>
                      </td>

                      {/* Retention Status Badge */}
                      <td className="px-5 py-4 align-top whitespace-nowrap">
                        {ret.status === 'at_risk' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                              {ret.daysInactive}d inactive
                            </span>
                            <span className="block text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              Needs Follow-up
                            </span>
                          </div>
                        )}
                        {ret.status === 'cooling' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-yellow-700 border border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800">
                              🟡 {ret.daysInactive}d inactive
                            </span>
                            <span className="block text-[11px] font-medium text-yellow-600 dark:text-yellow-400">
                              Cooling Stage
                            </span>
                          </div>
                        )}
                        {ret.status === 'active' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                              🟢 {ret.daysInactive}d inactive
                            </span>
                            <span className="block text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              Active Shopper
                            </span>
                          </div>
                        )}
                        {ret.status === 'no_orders' && (
                          <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            No orders yet
                          </span>
                        )}
                      </td>

                      {/* Retention Summary & Insight (Matches Retention Agent) */}
                      <td className="px-5 py-4 align-top max-w-sm">
                        <div className="rounded-lg bg-slate-50/80 p-2.5 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800 space-y-1.5">
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                            💡 {ret.retentionSummary}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {ret.sampleProduct && (
                              <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700">
                                🛍️ {ret.sampleProduct}
                              </span>
                            )}
                            {ret.lastOrderNumber && (
                              <span className="font-mono text-[10px] text-slate-400">
                                #{ret.lastOrderNumber}
                              </span>
                            )}
                            {ret.isEligibleForFollowUp && (
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                Eligible for AI Draft
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Evidence Details Drawer */}
                        {isExpanded && (
                          <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-2 animate-fade-in">
                            <h5 className="font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider text-[10px]">
                              CRM Retention Evidence Breakdown
                            </h5>
                            <ul className="space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                              <li className="flex items-start gap-1.5">
                                <span className="text-emerald-500 font-bold">&#10003;</span>
                                <span>
                                  <strong>Inactivity:</strong>{' '}
                                  {ret.daysInactive !== null
                                    ? `${ret.daysInactive} days since last completed order (${ret.daysInactive >= 60 ? 'exceeds 60d threshold' : 'within active window'})`
                                    : 'No orders placed'}
                                </span>
                              </li>
                              {ret.lastOrderDate && (
                                <li className="flex items-start gap-1.5">
                                  <span className="text-emerald-500 font-bold">&#10003;</span>
                                  <span>
                                    <strong>Last Order:</strong> {ret.lastOrderNumber} placed on{' '}
                                    {formatDate(ret.lastOrderDate)}
                                  </span>
                                </li>
                              )}
                              {ret.allProducts.length > 0 && (
                                <li className="flex items-start gap-1.5">
                                  <span className="text-emerald-500 font-bold">&#10003;</span>
                                  <span>
                                    <strong>Purchased Products:</strong> {ret.allProducts.join(', ')}
                                  </span>
                                </li>
                              )}
                              <li className="flex items-start gap-1.5">
                                <span className="text-emerald-500 font-bold">&#10003;</span>
                                <span>
                                  <strong>Customer Lifetime:</strong> {ret.completedOrdersCount} completed orders totaling {formatCurrency(ret.totalCompletedSpend)}
                                </span>
                              </li>
                            </ul>

                            <div className="pt-1.5 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                              <span className="text-[10px] text-indigo-800 dark:text-indigo-300 font-medium">
                                Focus: {ret.suggestedAction}
                              </span>
                              <Link
                                href={`/ai-assistant?customerId=${c.id}`}
                                className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 shadow-sm"
                              >
                                <span>✨ Launch Assistant</span>
                              </Link>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Orders Count */}
                      <td className="px-5 py-4 align-top text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {c.orderCount}
                        </span>
                        {ret.completedOrdersCount !== c.orderCount && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {ret.completedOrdersCount} completed
                          </span>
                        )}
                      </td>

                      {/* Spend */}
                      <td className="px-5 py-4 align-top text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(c.totalSpending)}
                      </td>

                      {/* Tags */}
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {c.tags && c.tags.length > 0 ? (
                            c.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                              >
                                #{t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1.5">
                          {/* 1-Click AI Follow-up action */}
                          <Link
                            href={`/ai-assistant?customerId=${c.id}`}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-sm active:scale-95 ${
                              ret.isEligibleForFollowUp
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
                            }`}
                            title="Generate personalized engagement email draft using AI"
                          >
                            <span>✨ AI Follow-Up</span>
                          </Link>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleExpand(c.id)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium px-1"
                              title="Toggle evidence details"
                            >
                              {isExpanded ? 'Hide Evidence ▴' : 'Evidence ▾'}
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                            <Link
                              href={`/customers/${c.id}`}
                              className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
                            >
                              Profile &rarr;
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
