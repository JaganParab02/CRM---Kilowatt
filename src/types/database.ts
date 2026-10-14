// ─── Database type definitions for CommercePilot AI ───
// Keep in sync with migrations 001, 002, 003

/** Constrained types matching DB CHECK constraints */
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'shipped' | 'delivered';
export type ActivityType = 'note' | 'order_event' | 'system_event';
export type DraftStatus = 'draft' | 'reviewed' | 'sent' | 'discarded';
export type EmailLogStatus = 'sent' | 'simulated' | 'failed';
export type EmailSource = 'manual' | 'workflow';
export type ExecutionStatus = 'success' | 'failed' | 'skipped' | 'simulated';

/** ─── Row Types (what you SELECT from the DB) ─── */

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  tags: string[];
  source: string;
  external_id: string | null;
  email_opt_out?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string | null;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  total: number;
  currency: string;
  source: string;
  external_id: string | null;
  ordered_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  product_external_id: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface CustomerActivity {
  id: string;
  customer_id: string;
  order_id: string | null;
  type: ActivityType;
  description: string;
  created_at: string;
}

export interface EmailDraft {
  id: string;
  customer_id: string;
  order_id: string | null;
  subject: string;
  body: string;
  status: DraftStatus;
  ai_generated: boolean;
  recommendation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationWorkflow {
  id: string;
  name: string;
  trigger_type: string;
  is_enabled: boolean;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  event_key: string;
  order_id: string | null;
  customer_id: string | null;
  status: ExecutionStatus;
  result_details: string | null;
  created_at: string;
}

export interface EmailLog {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  draft_id: string | null;
  workflow_id: string | null;
  recipient: string;
  subject: string;
  body: string;
  source: EmailSource;
  status: EmailLogStatus;
  provider_message_id: string | null;
  error_message: string | null;
  is_simulated: boolean;
  created_at: string;
}

/**
 * Database type map for Supabase client generics.
 */
export interface Database {
  public: {
    Tables: {
      customers: {
        Row: Customer;
        Insert: Partial<Customer>;
        Update: Partial<Customer>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Partial<Order>;
        Update: Partial<Order>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: Partial<OrderItem>;
        Update: Partial<OrderItem>;
        Relationships: [];
      };
      customer_activities: {
        Row: CustomerActivity;
        Insert: Partial<CustomerActivity>;
        Update: Partial<CustomerActivity>;
        Relationships: [];
      };
      email_drafts: {
        Row: EmailDraft;
        Insert: Partial<EmailDraft>;
        Update: Partial<EmailDraft>;
        Relationships: [];
      };
      email_templates: {
        Row: EmailTemplate;
        Insert: Partial<EmailTemplate>;
        Update: Partial<EmailTemplate>;
        Relationships: [];
      };
      communication_workflows: {
        Row: CommunicationWorkflow;
        Insert: Partial<CommunicationWorkflow>;
        Update: Partial<CommunicationWorkflow>;
        Relationships: [];
      };
      workflow_executions: {
        Row: WorkflowExecution;
        Insert: Partial<WorkflowExecution>;
        Update: Partial<WorkflowExecution>;
        Relationships: [];
      };
      email_logs: {
        Row: EmailLog;
        Insert: Partial<EmailLog>;
        Update: Partial<EmailLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
