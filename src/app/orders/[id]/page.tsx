'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Order, Customer, OrderItem } from '@/types/database';
import {
  formatCurrency,
  formatDate,
  getOrderStatusBadge,
  getPaymentStatusBadge,
  getFulfillmentStatusBadge,
} from '@/utils/format';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrderDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserClient();

      // 1. Fetch Order Record
      const { data: oData, error: oErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (oErr) {
        console.error('Order query failed:', {
          code: oErr.code,
          message: oErr.message,
          details: oErr.details,
          hint: oErr.hint,
        });
        throw new Error(`Order query failed [${oErr.code || 'UNKNOWN'}]: ${oErr.message}`);
      }
      if (!oData) throw new Error('Order not found');

      setOrder(oData);

      // 2. Fetch Customer if linked
      if (oData.customer_id) {
        const { data: cData, error: cErr } = await supabase
          .from('customers')
          .select('*')
          .eq('id', oData.customer_id)
          .single();

        if (cErr) {
          console.warn('Order linked customer query warning:', {
            code: cErr.code,
            message: cErr.message,
            details: cErr.details,
            hint: cErr.hint,
          });
        } else if (cData) {
          setCustomer(cData);
        }
      }

      // 3. Fetch Order Items
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsErr) {
        console.warn('Order items query warning:', {
          code: itemsErr.code,
          message: itemsErr.message,
          details: itemsErr.details,
          hint: itemsErr.hint,
        });
      }
      setOrderItems(itemsData ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error retrieving order details');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderDetails();
  }, [loadOrderDetails]);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
        <div className="h-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl space-y-4">
        <Link
          href="/orders"
          className="text-xs text-slate-500 hover:text-emerald-600 inline-flex items-center gap-1"
        >
          &larr; Back to Order Directory
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <h3 className="font-semibold text-base">Order Not Found</h3>
          <p className="text-sm mt-1 text-rose-800 dark:text-rose-300">
            {error || 'Unable to locate order with ID: ' + orderId}
          </p>
        </div>
      </div>
    );
  }

  const statusBadge = getOrderStatusBadge(order.status);
  const paymentBadge = getPaymentStatusBadge(order.payment_status);
  const fulfillmentBadge = getFulfillmentStatusBadge(order.fulfillment_status);

  return (
    <div className="max-w-4xl space-y-8">
      {/* Back Link & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Back to Orders"
          >
            &larr;
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span className="font-mono">{order.order_number}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Placed on {formatDate(order.ordered_at)} &bull; Source: <span className="uppercase">{order.source}</span>
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
          >
            Order: {order.status}
          </span>
          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${paymentBadge.bg}`}>
            Payment: {paymentBadge.text}
          </span>
          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${fulfillmentBadge.bg}`}>
            Fulfillment: {fulfillmentBadge.text}
          </span>
        </div>
      </div>

      {/* Grid: Order Summary & Customer Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Customer Information Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800 flex items-center justify-between">
            <span>Customer Information</span>
            {customer && (
              <Link
                href={`/customers/${customer.id}`}
                className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
              >
                View Profile &rarr;
              </Link>
            )}
          </h3>

          {customer ? (
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block">Full Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {customer.first_name} {customer.last_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Email</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {customer.email}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {customer.phone || 'No phone recorded'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-slate-500">
              <span className="inline-block rounded bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Guest Checkout Order
              </span>
              <p className="mt-2 text-[11px] text-slate-400">
                This transaction was completed without a registered customer account.
              </p>
            </div>
          )}
        </div>

        {/* Financial & Order Summary Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 pb-3 dark:border-slate-800">
            Financial Snapshot
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 dark:text-slate-400">Currency</span>
              <span className="font-mono font-medium text-slate-900 dark:text-white">
                {order.currency}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Items Quantity</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {orderItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0)} items
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Stored Order Total</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(Number(order.total), order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items Table */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Purchased Items ({orderItems.length})
        </h3>

        {orderItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No line items recorded for this order.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Product Name</th>
                  <th className="px-6 py-3.5 text-center">Quantity</th>
                  <th className="px-6 py-3.5 text-right">Unit Price</th>
                  <th className="px-6 py-3.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {orderItems.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {item.product_name}
                      </span>
                      {item.product_external_id && (
                        <span className="block text-[11px] font-mono text-slate-400">
                          External Ref: {item.product_external_id}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center font-medium text-slate-700 dark:text-slate-300">
                      {item.quantity}
                    </td>

                    <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                      {formatCurrency(Number(item.unit_price), order.currency)}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(Number(item.line_total), order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/70 border-t border-slate-200 dark:bg-slate-800/30 dark:border-slate-800 font-semibold text-slate-900 dark:text-white">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-right text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Grand Total
                  </td>
                  <td className="px-6 py-3 text-right text-base text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(Number(order.total), order.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
