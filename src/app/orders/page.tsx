'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Order, Customer, OrderStatus } from '@/types/database';
import { formatCurrency, formatDate, getOrderStatusBadge, getPaymentStatusBadge } from '@/utils/format';

interface OrderWithCustomer extends Order {
  customers?: Pick<Customer, 'id' | 'first_name' | 'last_name' | 'email'> | null;
}

const statusTabs: { label: string; value: 'all' | OrderStatus }[] = [
  { label: 'All Orders', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Refunded', value: 'refunded' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserClient();
      const { data, error: oErr, count: oCount } = await supabase
        .from('orders')
        .select('*, customers(id, first_name, last_name, email)', { count: 'exact' })
        .order('ordered_at', { ascending: false });

      if (oErr) {
        console.error('Orders query failed:', {
          code: oErr.code,
          message: oErr.message,
          details: oErr.details,
          hint: oErr.hint,
        });
        throw new Error(
          `Orders query failed [${oErr.code || 'UNKNOWN'}]: ${oErr.message || 'Check database permissions and Row Level Security.'}`
        );
      } else {
        console.log('Order records fetched:', oCount ?? data?.length ?? 0);
      }

      setOrders((data as unknown as OrderWithCustomer[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Status Counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    statusTabs.forEach((tab) => {
      if (tab.value !== 'all') {
        counts[tab.value] = orders.filter((o) => o.status === tab.value).length;
      }
    });
    return counts;
  }, [orders]);

  // Filter orders by status tab and search
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (selectedStatus !== 'all' && order.status !== selectedStatus) {
        return false;
      }

      // Search filter
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const orderNumberMatch = order.order_number.toLowerCase().includes(q);
      const customerNameMatch = order.customers
        ? `${order.customers.first_name} ${order.customers.last_name}`
            .toLowerCase()
            .includes(q)
        : 'guest'.includes(q);
      const emailMatch = order.customers?.email
        ? order.customers.email.toLowerCase().includes(q)
        : false;

      return orderNumberMatch || customerNameMatch || emailMatch;
    });
  }, [orders, selectedStatus, searchQuery]);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Order Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track fulfillment states, payment transactions, and customer orders.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {loading ? 'Refreshing...' : 'Refresh Orders'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 text-sm">
          <strong>Error loading orders:</strong> {error}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200/80 pb-2 dark:border-slate-800">
        {statusTabs.map((tab) => {
          const isSelected = selectedStatus === tab.value;
          const count = statusCounts[tab.value] || 0;
          return (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  isSelected
                    ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800'
                    : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative">
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
          placeholder="Search by order number (e.g. KW-1001), customer name, or email..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
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

      {/* Results Count */}
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> orders
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-10 text-center dark:border-amber-800/80 dark:bg-amber-950/20 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 text-xl font-bold">
            0
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No Order Records Retrieved from Database
          </h3>
          <p className="max-w-xl mx-auto text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            If orders exist in your <strong>Supabase Dashboard</strong>, PostgreSQL <strong>Row Level Security (RLS)</strong> is blocking the unauthenticated <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">anon</code> client from reading the <code className="font-mono">orders</code> table.
          </p>
          <div className="pt-2 text-xs text-slate-500">
            <span>To allow read access, run </span>
            <code className="font-mono font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400">
              supabase/fix_permissions_and_rls.sql
            </code>
            <span> in your Supabase SQL Editor, then click Refresh above.</span>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            No orders match your filter criteria
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Try choosing a different status filter or clearing your search term.
          </p>
          {(searchQuery || selectedStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
              }}
              className="mt-3 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Total Amount</th>
                  <th className="px-6 py-3.5">Order Status</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredOrders.map((order) => {
                  const statusBadge = getOrderStatusBadge(order.status);
                  const paymentBadge = getPaymentStatusBadge(order.payment_status);
                  const isGuest = !order.customers;

                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                        <Link
                          href={`/orders/${order.id}`}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-slate-300 dark:decoration-slate-700 underline-offset-2"
                        >
                          {order.order_number}
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        {isGuest ? (
                          <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Guest Customer
                          </span>
                        ) : (
                          <div>
                            <Link
                              href={`/customers/${order.customers!.id}`}
                              className="font-medium text-slate-900 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400"
                            >
                              {order.customers!.first_name} {order.customers!.last_name}
                            </Link>
                            {order.customers!.email && (
                              <span className="block text-xs text-slate-400">
                                {order.customers!.email}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(order.ordered_at)}
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(Number(order.total), order.currency)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${paymentBadge.bg}`}>
                          {paymentBadge.text}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-emerald-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          View &rarr;
                        </Link>
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
