-- ============================================================
-- CommercePilot AI — Fix Row Level Security (RLS) & Table Permissions
-- ============================================================
-- Run this script in your Supabase Project -> SQL Editor.
-- This grants SELECT permissions to the public/anon API role
-- while keeping Row Level Security (RLS) active and secure.
-- ============================================================

-- 1. Grant Schema Usage and Select Privileges to API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;

-- 2. Ensure RLS is active on all CRM tables
ALTER TABLE IF EXISTS customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_drafts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS communication_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_executions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_logs             ENABLE ROW LEVEL SECURITY;

-- 3. Configure SELECT policies allowing both anon and authenticated roles
DROP POLICY IF EXISTS "Allow read access to customers" ON customers;
CREATE POLICY "Allow read access to customers"
  ON customers FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read access to orders" ON orders;
CREATE POLICY "Allow read access to orders"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read access to order_items" ON order_items;
CREATE POLICY "Allow read access to order_items"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read access to customer_activities" ON customer_activities;
CREATE POLICY "Allow read access to customer_activities"
  ON customer_activities FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read access to email_drafts" ON email_drafts;
CREATE POLICY "Allow read access to email_drafts"
  ON email_drafts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read email_templates" ON email_templates;
CREATE POLICY "Allow read email_templates"
  ON email_templates FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read communication_workflows" ON communication_workflows;
CREATE POLICY "Allow read communication_workflows"
  ON communication_workflows FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read workflow_executions" ON workflow_executions;
CREATE POLICY "Allow read workflow_executions"
  ON workflow_executions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read email_logs" ON email_logs;
CREATE POLICY "Allow read email_logs"
  ON email_logs FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
