'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Order, Customer } from '@/types/database';
import { StatsCard } from '@/components/StatsCard';
import { StatusIndicator } from '@/components/StatusIndicator';
import { formatCurrency, formatDate, getOrderStatusBadge } from '@/utils/format';

interface OrderWithCustomer extends Order {
  customers?: Pick<Customer, 'first_name' | 'last_name' | 'email'> | null;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Dashboard Metrics (Directly from database)
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [orderCount, setOrderCount] = useState<number>(0);
  const [completedRevenue, setCompletedRevenue] = useState<number>(0);
  const [processingOrdersCount, setProcessingOrdersCount] = useState<number>(0);
  const [recentOrders, setRecentOrders] = useState<OrderWithCustomer[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();

      // 1. Total Customers
      const { count: cCount, error: cErr } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      if (cErr) {
        console.error('Dashboard customer count failed:', {
          code: cErr.code,
          message: cErr.message,
          details: cErr.details,
          hint: cErr.hint,
        });
        throw cErr;
      }
      setCustomerCount(cCount ?? 0);

      // 2. All Orders for metrics (Total orders, completed revenue, processing count)
      const { data: allOrders, count: oCount, error: oErr } = await supabase
        .from('orders')
        .select('status, total', { count: 'exact' });

      if (oErr) {
        console.error('Dashboard orders count failed:', {
          code: oErr.code,
          message: oErr.message,
          details: oErr.details,
          hint: oErr.hint,
        });
        throw oErr;
      }
      setOrderCount(oCount ?? 0);

      if (allOrders) {
        const typedOrders = allOrders as Pick<Order, 'status' | 'total'>[];
        // Revenue from completed orders only
        const completedTotal = typedOrders
          .filter((o: Pick<Order, 'status' | 'total'>) => o.status === 'completed')
          .reduce((acc: number, curr: Pick<Order, 'status' | 'total'>) => acc + (Number(curr.total) || 0), 0);
        setCompletedRevenue(completedTotal);

        // Orders currently processing
        const processingCount = typedOrders.filter((o: Pick<Order, 'status' | 'total'>) => o.status === 'processing').length;
        setProcessingOrdersCount(processingCount);
      } else {
        setCompletedRevenue(0);
        setProcessingOrdersCount(0);
      }

      // 3. 5 Most Recent Orders (with customer join)
      const { data: recOrders, error: rErr } = await supabase
        .from('orders')
        .select('*, customers(first_name, last_name, email)')
        .order('ordered_at', { ascending: false })
        .limit(5);

      if (rErr) {
        console.error('Dashboard recent orders query failed:', {
          code: rErr.code,
          message: rErr.message,
          details: rErr.details,
          hint: rErr.hint,
        });
        throw rErr;
      }
      setRecentOrders((recOrders as unknown as OrderWithCustomer[]) ?? []);

      setConnectionStatus('connected');
      setStatusMessage('Connected');
    } catch (err: unknown) {
      setConnectionStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Database error');
      setCustomerCount(0);
      setOrderCount(0);
      setCompletedRevenue(0);
      setProcessingOrdersCount(0);
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="max-w-6xl space-y-8">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back to CommercePilot
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Store operations overview, customer engagement metrics, and order activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusIndicator status={connectionStatus} message={statusMessage} />
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Database Setup & RLS Notices */}
      {connectionStatus === 'error' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚙️</span>
            <span>Database Connection Error</span>
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-300">
            {statusMessage}. Check that your Supabase credentials in <code className="font-mono bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded">.env.local</code> are correct.
          </p>
        </div>
      )}

      {connectionStatus === 'connected' && !loading && customerCount === 0 && orderCount === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <span>ℹ️</span>
            <span>0 Records Retrieved from Database</span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Connected to Supabase, but 0 customer and order records were returned. If records already exist in your <strong>Supabase Dashboard</strong>, PostgreSQL <strong>Row Level Security (RLS)</strong> is blocking the unauthenticated <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">anon</code> API role from reading tables.
          </p>
          <div className="pt-1 text-xs text-amber-800 dark:text-amber-300">
            <span>To allow the application to read your records, execute </span>
            <code className="font-mono font-bold bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 text-emerald-700 dark:text-emerald-400">
              supabase/fix_permissions_and_rls.sql
            </code>
            <span> in your <strong>Supabase Project → SQL Editor</strong>.</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Customers"
          value={customerCount}
          subtitle="Registered customer profiles"
          isLoading={loading}
          icon={
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Total Orders"
          value={orderCount}
          subtitle="Total store orders placed"
          isLoading={loading}
          icon={
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          }
        />

        <StatsCard
          title="Completed Revenue"
          value={formatCurrency(completedRevenue)}
          subtitle="Revenue from completed orders"
          isLoading={loading}
          icon={
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Processing Orders"
          value={processingOrdersCount}
          subtitle="Awaiting fulfillment / dispatch"
          isLoading={loading}
          icon={
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Recent Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Orders
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest 5 customer purchases from your store
            </p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            View all orders &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No orders found in database</p>
            <p className="text-xs text-slate-500 mt-1">All data is loaded live from Supabase. Insert orders or run the seed script to view records.</p>
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
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {recentOrders.map((order) => {
                    const statusBadge = getOrderStatusBadge(order.status);
                    const customerName = order.customers
                      ? `${order.customers.first_name} ${order.customers.last_name}`
                      : 'Guest Customer';

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
                          <span className="font-medium text-slate-900 dark:text-slate-200">
                            {customerName}
                          </span>
                          {order.customers?.email && (
                            <span className="block text-xs text-slate-400">
                              {order.customers.email}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
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
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/orders/${order.id}`}
                            className="inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            Details &rarr;
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

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/customers"
          className="group block rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Customer Directory &rarr;
            </h4>
            <span className="text-xs text-slate-400">{customerCount} records</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Search customer profiles, view lifetime spending, order counts, and tags.
          </p>
        </Link>

        <Link
          href="/orders"
          className="group block rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Order Directory &rarr;
            </h4>
            <span className="text-xs text-slate-400">{orderCount} records</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Filter orders by status (pending, processing, completed), search order numbers.
          </p>
        </Link>
      </div>
    </div>
  );
}
