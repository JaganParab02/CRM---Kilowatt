-- ============================================================
-- CommercePilot AI — Master Database Setup & Seed Script
-- Single-file execution for Supabase SQL Editor
-- Creates all tables, triggers, indexes, RLS policies, and demo seed data.
-- 100% idempotent and safe to run multiple times.
-- ============================================================

-- ─── 1. CUSTOMERS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  source       TEXT NOT NULL DEFAULT 'demo',
  external_id  TEXT,
  email_opt_out BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalize email to lowercase on insert/update
CREATE OR REPLACE FUNCTION normalize_customer_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_normalize_email ON customers;
CREATE TRIGGER trg_customers_normalize_email
  BEFORE INSERT OR UPDATE OF email ON customers
  FOR EACH ROW EXECUTE FUNCTION normalize_customer_email();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique ON customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (last_name, first_name);


-- ─── 2. ORDERS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number       TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','completed','cancelled','refunded')),
  payment_status     TEXT NOT NULL DEFAULT 'pending'
                       CHECK (payment_status IN ('pending','paid','failed','refunded')),
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled'
                       CHECK (fulfillment_status IN ('unfulfilled','processing','shipped','delivered')),
  total              NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency           TEXT NOT NULL DEFAULT 'INR',
  source             TEXT NOT NULL DEFAULT 'demo',
  external_id        TEXT,
  ordered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at  ON orders (ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders (status);


-- ─── 3. ORDER ITEMS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name        TEXT NOT NULL,
  product_external_id TEXT,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total          NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);


-- ─── 4. CUSTOMER ACTIVITIES ─────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('note','order_event','system_event')),
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_customer_id ON customer_activities (customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at  ON customer_activities (created_at DESC);


-- ─── 5. EMAIL DRAFTS (PHASE 3) ──────────────────────────────

CREATE TABLE IF NOT EXISTS email_drafts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id              UUID REFERENCES orders(id) ON DELETE SET NULL,
  subject               TEXT NOT NULL,
  body                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'sent', 'discarded')),
  ai_generated          BOOLEAN NOT NULL DEFAULT true,
  recommendation_reason TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_customer_id ON email_drafts (customer_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts (status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at ON email_drafts (created_at DESC);


-- ─── 6. EMAIL TEMPLATES & WORKFLOWS (PHASE 4) ───────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'transactional',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communication_workflows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  template_id  UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id    UUID NOT NULL REFERENCES communication_workflows(id) ON DELETE CASCADE,
  event_key      TEXT NOT NULL,
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  status         TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'simulated')),
  result_details TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_event_key UNIQUE (workflow_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_order_id ON workflow_executions (order_id);

CREATE TABLE IF NOT EXISTS email_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id            UUID REFERENCES orders(id) ON DELETE SET NULL,
  draft_id            UUID REFERENCES email_drafts(id) ON DELETE SET NULL,
  workflow_id         UUID REFERENCES communication_workflows(id) ON DELETE SET NULL,
  recipient           TEXT NOT NULL,
  subject             TEXT NOT NULL,
  body                TEXT NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('manual', 'workflow')),
  status              TEXT NOT NULL CHECK (status IN ('sent', 'simulated', 'failed')),
  provider_message_id TEXT,
  error_message       TEXT,
  is_simulated        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_customer_id ON email_logs (customer_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs (created_at DESC);


-- ─── 7. ROW LEVEL SECURITY (RLS) POLICIES ────────────────────

ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs             ENABLE ROW LEVEL SECURITY;

-- Customers
DROP POLICY IF EXISTS "Allow read access to customers" ON customers;
CREATE POLICY "Allow read access to customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
CREATE POLICY "Authenticated users can insert customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
CREATE POLICY "Authenticated users can update customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;
CREATE POLICY "Authenticated users can delete customers" ON customers FOR DELETE TO anon, authenticated USING (true);

-- Orders
DROP POLICY IF EXISTS "Allow read access to orders" ON orders;
CREATE POLICY "Allow read access to orders" ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON orders;
CREATE POLICY "Authenticated users can insert orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update orders" ON orders;
CREATE POLICY "Authenticated users can update orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON orders;
CREATE POLICY "Authenticated users can delete orders" ON orders FOR DELETE TO anon, authenticated USING (true);

-- Order Items
DROP POLICY IF EXISTS "Allow read access to order_items" ON order_items;
CREATE POLICY "Allow read access to order_items" ON order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert order_items" ON order_items;
CREATE POLICY "Authenticated users can insert order_items" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update order_items" ON order_items;
CREATE POLICY "Authenticated users can update order_items" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete order_items" ON order_items;
CREATE POLICY "Authenticated users can delete order_items" ON order_items FOR DELETE TO anon, authenticated USING (true);

-- Customer Activities
DROP POLICY IF EXISTS "Allow read access to activities" ON customer_activities;
CREATE POLICY "Allow read access to activities" ON customer_activities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON customer_activities;
CREATE POLICY "Authenticated users can insert activities" ON customer_activities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update activities" ON customer_activities;
CREATE POLICY "Authenticated users can update activities" ON customer_activities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete activities" ON customer_activities;
CREATE POLICY "Authenticated users can delete activities" ON customer_activities FOR DELETE TO anon, authenticated USING (true);

-- Email Drafts
DROP POLICY IF EXISTS "Allow read access to email_drafts" ON email_drafts;
CREATE POLICY "Allow read access to email_drafts" ON email_drafts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert access to email_drafts" ON email_drafts;
CREATE POLICY "Allow insert access to email_drafts" ON email_drafts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update access to email_drafts" ON email_drafts;
CREATE POLICY "Allow update access to email_drafts" ON email_drafts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Templates & Workflows
DROP POLICY IF EXISTS "Allow read email_templates" ON email_templates;
CREATE POLICY "Allow read email_templates" ON email_templates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow read communication_workflows" ON communication_workflows;
CREATE POLICY "Allow read communication_workflows" ON communication_workflows FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow read workflow_executions" ON workflow_executions;
CREATE POLICY "Allow read workflow_executions" ON workflow_executions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow read email_logs" ON email_logs;
CREATE POLICY "Allow read email_logs" ON email_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert workflow_executions" ON workflow_executions;
CREATE POLICY "Allow insert workflow_executions" ON workflow_executions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update communication_workflows" ON communication_workflows;
CREATE POLICY "Allow update communication_workflows" ON communication_workflows FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow insert email_logs" ON email_logs;
CREATE POLICY "Allow insert email_logs" ON email_logs FOR INSERT TO anon, authenticated WITH CHECK (true);


-- ─── 8. DEFAULT TEMPLATES & WORKFLOWS SEED ───────────────────

INSERT INTO email_templates (id, name, subject, body, category, is_active)
VALUES (
  'e0000001-0000-0000-0000-000000000001',
  'Order Completed Thank You',
  'Thank you for your order with Kilowatt!',
  'Hi {{customer_name}},

Thank you for choosing Kilowatt! Your order ({{order_number}}) has been completed and is on its way.

Order Total: {{order_total}}

If you have any questions or need technical support with your equipment, simply reply to this email.

Best regards,
The Kilowatt Customer Care Team',
  'transactional',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO communication_workflows (id, name, trigger_type, is_enabled, template_id)
VALUES (
  'w0000001-0000-0000-0000-000000000001',
  'Order Completed Notification',
  'order_completed',
  true,
  'e0000001-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;


-- ─── 9. DEMO SEED DATA (CUSTOMERS, ORDERS, ITEMS, ACTIVITIES) ───

INSERT INTO customers (id, first_name, last_name, email, phone, tags, source, email_opt_out) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Aarav',   'Sharma',     'aarav.sharma@example.com',     '+91-98765-00001', ARRAY['vip','repeat'],    'demo', false),
  ('a0000001-0000-0000-0000-000000000002', 'Priya',   'Patel',      'priya.patel@example.com',      '+91-98765-00002', ARRAY['repeat'],          'demo', false),
  ('a0000001-0000-0000-0000-000000000003', 'Rohan',   'Gupta',      'rohan.gupta@example.com',      '+91-98765-00003', ARRAY['new'],             'demo', false),
  ('a0000001-0000-0000-0000-000000000004', 'Ananya',  'Singh',      'ananya.singh@example.com',     '+91-98765-00004', ARRAY['repeat','solar'],  'demo', false),
  ('a0000001-0000-0000-0000-000000000005', 'Vikram',  'Reddy',      'vikram.reddy@example.com',     '+91-98765-00005', ARRAY['wholesale'],       'demo', false),
  ('a0000001-0000-0000-0000-000000000006', 'Meera',   'Nair',       'meera.nair@example.com',       '+91-98765-00006', ARRAY['new'],             'demo', false),
  ('a0000001-0000-0000-0000-000000000007', 'Arjun',   'Deshmukh',   'arjun.deshmukh@example.com',   '+91-98765-00007', ARRAY['repeat'],          'demo', false),
  ('a0000001-0000-0000-0000-000000000008', 'Kavya',   'Iyer',       'kavya.iyer@example.com',       '+91-98765-00008', ARRAY['vip','repeat'],    'demo', false),
  ('a0000001-0000-0000-0000-000000000009', 'Siddharth','Joshi',     'siddharth.joshi@example.com',  '+91-98765-00009', ARRAY['new'],             'demo', false),
  ('a0000001-0000-0000-0000-000000000010', 'Divya',   'Menon',      'divya.menon@example.com',      NULL,              ARRAY['inactive'],        'demo', false),
  ('a0000001-0000-0000-0000-000000000011', 'Rahul',   'Choudhury',  'rahul.choudhury@example.com',  '+91-98765-00011', ARRAY['repeat'],          'demo', false),
  ('a0000001-0000-0000-0000-000000000012', 'Neha',    'Kapoor',     'neha.kapoor@example.com',      '+91-98765-00012', ARRAY['new'],             'demo', false),
  ('a0000001-0000-0000-0000-000000000013', 'Amit',    'Verma',      'amit.verma@example.com',       '+91-98765-00013', ARRAY['wholesale','vip'], 'demo', false),
  ('a0000001-0000-0000-0000-000000000014', 'Sneha',   'Rao',        'sneha.rao@example.com',        '+91-98765-00014', ARRAY['inactive'],        'demo', true),
  ('a0000001-0000-0000-0000-000000000015', 'Karthik', 'Pillai',     'karthik.pillai@example.com',   '+91-98765-00015', ARRAY['new'],             'demo', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (id, customer_id, order_number, status, payment_status, fulfillment_status, total, currency, source, ordered_at) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'KW-1001', 'completed', 'paid',     'delivered',   45999.00, 'INR', 'demo', '2026-04-15 10:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'KW-1002', 'completed', 'paid',     'delivered',   12500.00, 'INR', 'demo', '2026-06-20 14:15:00+05:30'),
  ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'KW-1003', 'completed', 'paid',     'delivered',   8750.00,  'INR', 'demo', '2026-08-10 09:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', 'KW-1004', 'processing','paid',     'processing',  32000.00, 'INR', 'demo', '2026-10-01 11:45:00+05:30'),
  ('b0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 'KW-1005', 'pending',   'pending',  'unfulfilled', 15600.00, 'INR', 'demo', '2026-10-12 16:20:00+05:30'),
  ('b0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000002', 'KW-1006', 'completed', 'paid',     'delivered',   22300.00, 'INR', 'demo', '2026-05-08 13:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000002', 'KW-1007', 'completed', 'paid',     'delivered',   9800.00,  'INR', 'demo', '2026-07-22 10:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000002', 'KW-1008', 'processing','paid',     'shipped',     18450.00, 'INR', 'demo', '2026-10-05 08:15:00+05:30'),
  ('b0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000003', 'KW-1009', 'pending',   'pending',  'unfulfilled', 5200.00,  'INR', 'demo', '2026-10-13 09:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000004', 'KW-1010', 'completed', 'paid',     'delivered',   125000.00,'INR', 'demo', '2026-04-20 15:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000004', 'KW-1011', 'completed', 'paid',     'delivered',   67500.00, 'INR', 'demo', '2026-06-15 11:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000004', 'KW-1012', 'cancelled', 'refunded', 'unfulfilled', 34000.00, 'INR', 'demo', '2026-08-28 14:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000004', 'KW-1013', 'processing','paid',     'processing',  89000.00, 'INR', 'demo', '2026-10-08 10:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000014', 'a0000001-0000-0000-0000-000000000005', 'KW-1014', 'completed', 'paid',     'delivered',   245000.00,'INR', 'demo', '2026-05-30 09:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000005', 'KW-1015', 'completed', 'paid',     'delivered',   178500.00,'INR', 'demo', '2026-09-12 12:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000006', 'KW-1016', 'completed', 'paid',     'delivered',   3400.00,  'INR', 'demo', '2026-09-25 16:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000017', 'a0000001-0000-0000-0000-000000000007', 'KW-1017', 'completed', 'paid',     'delivered',   14200.00, 'INR', 'demo', '2026-07-05 10:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000018', 'a0000001-0000-0000-0000-000000000007', 'KW-1018', 'refunded',  'refunded', 'unfulfilled', 7600.00,  'INR', 'demo', '2026-09-18 14:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000019', 'a0000001-0000-0000-0000-000000000008', 'KW-1019', 'completed', 'paid',     'delivered',   56800.00, 'INR', 'demo', '2026-05-12 11:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000020', 'a0000001-0000-0000-0000-000000000008', 'KW-1020', 'completed', 'paid',     'delivered',   29400.00, 'INR', 'demo', '2026-08-03 15:45:00+05:30'),
  ('b0000001-0000-0000-0000-000000000021', 'a0000001-0000-0000-0000-000000000008', 'KW-1021', 'pending',   'pending',  'unfulfilled', 41200.00, 'INR', 'demo', '2026-10-11 13:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000022', 'a0000001-0000-0000-0000-000000000009', 'KW-1022', 'pending',   'failed',   'unfulfilled', 8900.00,  'INR', 'demo', '2026-10-10 17:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000023', 'a0000001-0000-0000-0000-000000000010', 'KW-1023', 'completed', 'paid',     'delivered',   6200.00,  'INR', 'demo', '2026-04-02 10:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000024', 'a0000001-0000-0000-0000-000000000011', 'KW-1024', 'completed', 'paid',     'delivered',   19800.00, 'INR', 'demo', '2026-06-28 09:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000025', 'a0000001-0000-0000-0000-000000000011', 'KW-1025', 'processing','paid',     'processing',  11500.00, 'INR', 'demo', '2026-10-03 14:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000026', 'a0000001-0000-0000-0000-000000000012', 'KW-1026', 'completed', 'paid',     'delivered',   4300.00,  'INR', 'demo', '2026-09-30 11:15:00+05:30'),
  ('b0000001-0000-0000-0000-000000000027', 'a0000001-0000-0000-0000-000000000013', 'KW-1027', 'completed', 'paid',     'delivered',   312000.00,'INR', 'demo', '2026-07-10 08:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000028', 'a0000001-0000-0000-0000-000000000013', 'KW-1028', 'processing','paid',     'shipped',     156000.00,'INR', 'demo', '2026-10-07 10:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000029', 'a0000001-0000-0000-0000-000000000014', 'KW-1029', 'completed', 'paid',     'delivered',   7800.00,  'INR', 'demo', '2026-04-25 13:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000030', NULL,                                    'KW-1030', 'completed', 'paid',     'delivered',   2100.00,  'INR', 'demo', '2026-09-05 10:00:00+05:30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_name, quantity, unit_price, line_total) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', '5kW Solar Panel Kit',         1, 38999.00, 38999.00),
  ('c0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', 'Panel Mounting Brackets',     2,  1500.00,  3000.00),
  ('c0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001', 'DC Cable Kit (10m)',          2,  2000.00,  4000.00),
  ('c0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000002', 'Smart Energy Monitor',        1,  8500.00,  8500.00),
  ('c0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000002', 'WiFi Relay Module',           2,  2000.00,  4000.00),
  ('c0000001-0000-0000-0000-000000000006', 'b0000001-0000-0000-0000-000000000003', 'LED Panel Light 40W',         5,  1750.00,  8750.00),
  ('c0000001-0000-0000-0000-000000000007', 'b0000001-0000-0000-0000-000000000004', '3kW Hybrid Inverter',         1, 28000.00, 28000.00),
  ('c0000001-0000-0000-0000-000000000008', 'b0000001-0000-0000-0000-000000000004', 'Battery Cable Set',           2,  2000.00,  4000.00),
  ('c0000001-0000-0000-0000-000000000009', 'b0000001-0000-0000-0000-000000000005', 'Smart Plug Pack (4 units)',   2,  4800.00,  9600.00),
  ('c0000001-0000-0000-0000-000000000010', 'b0000001-0000-0000-0000-000000000005', 'Motion Sensor Outdoor',       3,  2000.00,  6000.00),
  ('c0000001-0000-0000-0000-000000000011', 'b0000001-0000-0000-0000-000000000006', 'EV Charger 7kW',              1, 18500.00, 18500.00),
  ('c0000001-0000-0000-0000-000000000012', 'b0000001-0000-0000-0000-000000000006', 'Charging Cable Extension',    1,  3800.00,  3800.00),
  ('c0000001-0000-0000-0000-000000000013', 'b0000001-0000-0000-0000-000000000009', 'Smart Thermostat',            1,  3700.00,  3700.00),
  ('c0000001-0000-0000-0000-000000000014', 'b0000001-0000-0000-0000-000000000009', 'Temperature Sensor Pack',     1,  1500.00,  1500.00),
  ('c0000001-0000-0000-0000-000000000015', 'b0000001-0000-0000-0000-000000000010', '10kW Solar Panel Kit',        1, 95000.00, 95000.00),
  ('c0000001-0000-0000-0000-000000000016', 'b0000001-0000-0000-0000-000000000010', '5kW Hybrid Inverter',         1, 24000.00, 24000.00),
  ('c0000001-0000-0000-0000-000000000017', 'b0000001-0000-0000-0000-000000000010', 'MC4 Connector Pack',          4,  1500.00,  6000.00),
  ('c0000001-0000-0000-0000-000000000018', 'b0000001-0000-0000-0000-000000000014', '5kW Solar Panel Kit',        5,  38000.00, 190000.00),
  ('c0000001-0000-0000-0000-000000000019', 'b0000001-0000-0000-0000-000000000014', 'Panel Mounting Brackets',    10,   1500.00,  15000.00),
  ('c0000001-0000-0000-0000-000000000020', 'b0000001-0000-0000-0000-000000000014', '3kW Hybrid Inverter',         1,  28000.00,  28000.00),
  ('c0000001-0000-0000-0000-000000000021', 'b0000001-0000-0000-0000-000000000014', 'DC Cable Kit (10m)',           6,   2000.00,  12000.00),
  ('c0000001-0000-0000-0000-000000000022', 'b0000001-0000-0000-0000-000000000016', 'Smart Bulb RGB Pack (3)',     2,  1700.00,  3400.00),
  ('c0000001-0000-0000-0000-000000000023', 'b0000001-0000-0000-0000-000000000019', '5kW Solar Panel Kit',        1, 38999.00, 38999.00),
  ('c0000001-0000-0000-0000-000000000024', 'b0000001-0000-0000-0000-000000000019', 'Smart Energy Monitor',       1,  8500.00,  8500.00),
  ('c0000001-0000-0000-0000-000000000025', 'b0000001-0000-0000-0000-000000000019', 'Installation Kit Standard',  1,  9301.00,  9301.00),
  ('c0000001-0000-0000-0000-000000000026', 'b0000001-0000-0000-0000-000000000027', '10kW Solar Panel Kit',       3, 92000.00, 276000.00),
  ('c0000001-0000-0000-0000-000000000027', 'b0000001-0000-0000-0000-000000000027', '5kW Hybrid Inverter',        1, 24000.00,  24000.00),
  ('c0000001-0000-0000-0000-000000000028', 'b0000001-0000-0000-0000-000000000027', 'DC Cable Kit (10m)',          6,  2000.00,  12000.00),
  ('c0000001-0000-0000-0000-000000000029', 'b0000001-0000-0000-0000-000000000030', 'Smart Plug Pack (4 units)',  1,  2100.00,  2100.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_activities (id, customer_id, order_id, type, description) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'order_event',  'Order KW-1001 placed — 5kW Solar Panel Kit + accessories'),
  ('d0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'order_event',  'Order KW-1001 delivered successfully'),
  ('d0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', NULL,                                    'note',         'VIP customer — interested in battery storage solutions for 2027'),
  ('d0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000012', 'order_event',  'Order KW-1012 cancelled — customer requested different specification'),
  ('d0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000014', 'order_event',  'Wholesale order KW-1014 fulfilled — 5x panel kits shipped'),
  ('d0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000007', 'b0000001-0000-0000-0000-000000000018', 'order_event',  'Order KW-1018 refunded — product returned due to compatibility issue'),
  ('d0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000009', 'b0000001-0000-0000-0000-000000000022', 'order_event',  'Payment failed for KW-1022 — customer to retry with different card'),
  ('d0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000010', NULL,                                    'system_event', 'Customer inactive — no orders in 6+ months, follow-up recommended'),
  ('d0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000014', NULL,                                    'system_event', 'Customer inactive — no orders in 5+ months, follow-up recommended'),
  ('d0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000013', 'b0000001-0000-0000-0000-000000000028', 'order_event',  'Wholesale order KW-1028 shipped — estimated delivery in 3 days'),
  ('d0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000008', NULL,                                    'note',         'VIP customer inquired about commercial solar solutions for office building'),
  ('d0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000008', 'order_event',  'Order KW-1008 shipped — tracking number shared via SMS')
ON CONFLICT (id) DO NOTHING;
