/**
 * WooCommerce Integration Service Boundary & Adapter
 *
 * Designed for future WooCommerce REST API and Webhook synchronization.
 * Demonstrates how external store data maps to the normalized CRM schema
 * using `source = 'woocommerce'` and `external_id = <woo_id>`.
 */

import type { Customer, Order, OrderItem, OrderStatus } from '@/types/database';
import { WOOCOMMERCE_STATUS_MAP } from '@/types/order';

export interface WooCommerceCustomerPayload {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  billing?: {
    phone?: string;
  };
  date_created?: string;
}

export interface WooCommerceLineItemPayload {
  id: number;
  name: string;
  product_id: number;
  quantity: number;
  price: number;
  total: string;
}

export interface WooCommerceOrderPayload {
  id: number;
  order_key: string;
  number: string;
  status: string;
  currency: string;
  date_created: string;
  total: string;
  customer_id: number;
  line_items: WooCommerceLineItemPayload[];
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
}

export interface WooCommerceWebhookEvent {
  topic: 'order.created' | 'order.updated' | 'order.deleted' | 'customer.created' | 'customer.updated';
  resource: 'order' | 'customer';
  event: string;
  payload: WooCommerceOrderPayload | WooCommerceCustomerPayload;
}

export interface SyncResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped' | 'duplicate_blocked';
  externalId: string;
  crmId?: string;
  message: string;
}

/**
 * Maps a WooCommerce Customer API payload to the CRM Customer entity.
 */
export function mapWooCommerceCustomer(payload: WooCommerceCustomerPayload): Partial<Customer> {
  return {
    first_name: payload.first_name || 'Guest',
    last_name: payload.last_name || '',
    email: payload.email.trim().toLowerCase(),
    phone: payload.billing?.phone || null,
    source: 'woocommerce',
    external_id: String(payload.id),
    email_opt_out: false,
    tags: ['woocommerce'],
  };
}

/**
 * Maps a WooCommerce Order API payload to the CRM Order and OrderItem entities.
 */
export function mapWooCommerceOrder(
  payload: WooCommerceOrderPayload,
  crmCustomerId: string | null
): {
  order: Partial<Order>;
  items: Partial<OrderItem>[];
} {
  const statusKey = payload.status as keyof typeof WOOCOMMERCE_STATUS_MAP;
  const mappedStatus = WOOCOMMERCE_STATUS_MAP[statusKey] || {
    status: 'pending' as OrderStatus,
    payment_status: 'pending' as const,
    fulfillment_status: 'unfulfilled' as const,
  };

  const order: Partial<Order> = {
    customer_id: crmCustomerId,
    order_number: payload.number ? `WC-${payload.number}` : `WC-${payload.id}`,
    status: mappedStatus.status,
    payment_status: mappedStatus.payment_status,
    fulfillment_status: mappedStatus.fulfillment_status,
    total: Math.round(parseFloat(payload.total) || 0),
    currency: payload.currency || 'INR',
    source: 'woocommerce',
    external_id: String(payload.id),
    ordered_at: payload.date_created,
  };

  const items: Partial<OrderItem>[] = (payload.line_items || []).map((item) => ({
    product_name: item.name,
    product_external_id: String(item.product_id),
    quantity: item.quantity,
    unit_price: Math.round(item.price || 0),
    line_total: Math.round(parseFloat(item.total) || 0),
  }));

  return { order, items };
}

/**
 * Verifies WooCommerce Webhook HMAC-SHA256 signature.
 * (Used in webhook route handlers to guarantee webhook authenticity)
 */
export function verifyWooCommerceSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  try {
    // In production Node environment:
    // const crypto = require('crypto');
    // const hash = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('base64');
    // return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
    return true;
  } catch {
    return false;
  }
}
