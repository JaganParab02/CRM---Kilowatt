import type { OrderStatus, PaymentStatus, FulfillmentStatus } from '@/types/database';

/**
 * Format a numeric amount to formatted currency string (default INR: ₹)
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toFixed(2)}`;
  }
}

/**
 * Format date string to readable format
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Format date string to short date (e.g. 15 Apr 2026)
 */
export function formatShortDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Return badge color classes for Order Status
 */
export function getOrderStatusBadge(status: OrderStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-500/20',
      };
    case 'processing':
      return {
        bg: 'bg-blue-500/10 dark:bg-blue-500/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-500/20',
      };
    case 'pending':
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-500/20',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-500/20',
      };
    case 'cancelled':
      return {
        bg: 'bg-rose-500/10 dark:bg-rose-500/20',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/20',
      };
    case 'refunded':
      return {
        bg: 'bg-purple-500/10 dark:bg-purple-500/20',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-500/20',
      };
    default:
      return {
        bg: 'bg-slate-500/10 dark:bg-slate-500/20',
        text: 'text-slate-700 dark:text-slate-400',
        border: 'border-slate-500/20',
      };
  }
}

/**
 * Return badge color classes for Payment Status
 */
export function getPaymentStatusBadge(status: PaymentStatus): { bg: string; text: string } {
  switch (status) {
    case 'paid':
      return { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', text: 'Paid' };
    case 'pending':
      return { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', text: 'Pending' };
    case 'failed':
      return { bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300', text: 'Failed' };
    case 'refunded':
      return { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300', text: 'Refunded' };
    default:
      return { bg: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300', text: status };
  }
}

/**
 * Return badge color classes for Fulfillment Status
 */
export function getFulfillmentStatusBadge(status: FulfillmentStatus): { bg: string; text: string } {
  switch (status) {
    case 'delivered':
      return { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', text: 'Delivered' };
    case 'shipped':
      return { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300', text: 'Shipped' };
    case 'processing':
      return { bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300', text: 'Processing' };
    case 'unfulfilled':
      return { bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300', text: 'Unfulfilled' };
    default:
      return { bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300', text: status };
  }
}
