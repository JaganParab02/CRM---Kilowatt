-- ============================================================
-- CommercePilot AI — Phase 1 Database Schema
-- Migration: 001_initial_schema.sql
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
  external_id  TEXT,                        -- future WooCommerce customer ID
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

-- Unique email for the single-store demo (one customer per email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique ON customers (lower(email));

-- Search index
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
  external_id        TEXT,                  -- future WooCommerce order ID
  ordered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

/*
  NOTE — external_id scoping for future WooCommerce integration:
  ──────────────────────────────────────────────────────────────
  When WooCommerce integration is added, external_id will hold the
  WooCommerce order ID (e.g. "12345"). This is unique only within a
  single WooCommerce store, NOT globally. To support multiple stores
  in the future, add a `store_id` or `integration_id` column and
  create a UNIQUE constraint on (store_id, external_id) instead of
  a global unique on external_id alone. For the single-store demo
  phase, no additional scoping is needed.
*/

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at  ON orders (ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders (status);

-- ─── 3. ORDER ITEMS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name        TEXT NOT NULL,
  product_external_id TEXT,                 -- future WooCommerce product ID
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

-- ─── 5. ROW LEVEL SECURITY (RLS) ─────────────────────────────

ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;

/*
  RLS Access Strategy for Phase 1 Prototype:
  ──────────────────────────────────────────
  1. READ ACCESS (SELECT):
     Allowed for both `anon` and `authenticated` roles so the Phase 1
     foundation dashboard can display live telemetry without requiring
     authentication UI screens.
  
  2. WRITE ACCESS (INSERT, UPDATE, DELETE):
     STRICTLY FORBIDDEN for anonymous users.
     Only `authenticated` users (and service-role superusers) can modify data.
     Anonymous users cannot create, modify, or delete any CRM records.

  3. FUTURE PHASE 2 MULTI-TENANCY:
     In Phase 2, `organization_id` or `store_id` will be introduced and
     policies will be updated to check `auth.uid()` against organization
     membership tables.
*/

-- Customers Policies
DROP POLICY IF EXISTS "Allow read access to customers" ON customers;
CREATE POLICY "Allow read access to customers"
  ON customers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;
CREATE POLICY "Authenticated users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- Orders Policies
DROP POLICY IF EXISTS "Allow read access to orders" ON orders;
CREATE POLICY "Allow read access to orders"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert orders" ON orders;
CREATE POLICY "Authenticated users can insert orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update orders" ON orders;
CREATE POLICY "Authenticated users can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete orders" ON orders;
CREATE POLICY "Authenticated users can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (true);

-- Order Items Policies
DROP POLICY IF EXISTS "Allow read access to order_items" ON order_items;
CREATE POLICY "Allow read access to order_items"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert order_items" ON order_items;
CREATE POLICY "Authenticated users can insert order_items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update order_items" ON order_items;
CREATE POLICY "Authenticated users can update order_items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete order_items" ON order_items;
CREATE POLICY "Authenticated users can delete order_items"
  ON order_items FOR DELETE
  TO authenticated
  USING (true);

-- Customer Activities Policies
DROP POLICY IF EXISTS "Allow read access to activities" ON customer_activities;
CREATE POLICY "Allow read access to activities"
  ON customer_activities FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activities" ON customer_activities;
CREATE POLICY "Authenticated users can insert activities"
  ON customer_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update activities" ON customer_activities;
CREATE POLICY "Authenticated users can update activities"
  ON customer_activities FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete activities" ON customer_activities;
CREATE POLICY "Authenticated users can delete activities"
  ON customer_activities FOR DELETE
  TO authenticated
  USING (true);
