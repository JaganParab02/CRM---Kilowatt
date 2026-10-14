export type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from './database';

/**
 * Documented WooCommerce -> CRM Status Mapping for future integration:
 *
 * WooCommerce Status  ->  CRM Status      | Payment Status | Fulfillment Status
 * -----------------------------------------------------------------------------
 * pending             ->  pending         | pending        | unfulfilled
 * processing          ->  processing      | paid           | processing
 * on-hold             ->  pending         | pending        | unfulfilled
 * completed           ->  completed       | paid           | delivered
 * cancelled           ->  cancelled       | failed         | unfulfilled
 * refunded            ->  refunded        | refunded       | unfulfilled
 * failed              ->  cancelled       | failed         | unfulfilled
 */
export const WOOCOMMERCE_STATUS_MAP = {
  pending: { status: 'pending', payment_status: 'pending', fulfillment_status: 'unfulfilled' },
  processing: { status: 'processing', payment_status: 'paid', fulfillment_status: 'processing' },
  'on-hold': { status: 'pending', payment_status: 'pending', fulfillment_status: 'unfulfilled' },
  completed: { status: 'completed', payment_status: 'paid', fulfillment_status: 'delivered' },
  cancelled: { status: 'cancelled', payment_status: 'failed', fulfillment_status: 'unfulfilled' },
  refunded: { status: 'refunded', payment_status: 'refunded', fulfillment_status: 'unfulfilled' },
  failed: { status: 'cancelled', payment_status: 'failed', fulfillment_status: 'unfulfilled' },
} as const;
