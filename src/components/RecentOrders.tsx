import type { Order, Customer } from '@/types/database';
import { formatCurrency, formatDate, getOrderStatusBadge, getPaymentStatusBadge } from '@/utils/format';

interface OrderWithCustomer extends Order {
  customers?: Pick<Customer, 'first_name' | 'last_name' | 'email'> | null;
}

interface RecentOrdersProps {
  orders: OrderWithCustomer[];
  isLoading: boolean;
}

export function RecentOrders({ orders, isLoading }: RecentOrdersProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="h-6 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No orders found in database</p>
        <p className="mt-1 text-xs text-slate-500">Run the seed script in your Supabase SQL editor to populate sample data.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="border-b border-slate-200/80 px-6 py-4 dark:border-slate-800">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Orders</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Latest orders retrieved directly from Supabase</p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {orders.map((order) => {
          const statusBadge = getOrderStatusBadge(order.status);
          const paymentBadge = getPaymentStatusBadge(order.payment_status);
          const customerName = order.customers
            ? `${order.customers.first_name} ${order.customers.last_name}`
            : 'Guest Customer';

          return (
            <div
              key={order.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/30"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 font-mono text-xs font-bold">
                  KW
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {order.order_number}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {customerName}
                    {order.customers?.email && (
                      <span className="text-slate-400 dark:text-slate-500 ml-1">
                        &bull; {order.customers.email}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                <div className="text-left sm:text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${paymentBadge.bg}`}>
                    {paymentBadge.text}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(order.ordered_at)}
                  </p>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white min-w-[90px] text-right">
                  {formatCurrency(Number(order.total), order.currency)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
