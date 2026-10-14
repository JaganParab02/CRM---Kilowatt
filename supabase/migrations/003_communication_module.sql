-- ============================================================
-- CommercePilot AI — Phase 4 Database Schema Extension
-- Migration: 003_communication_module.sql
-- ============================================================

-- 1. Add email_opt_out to customers if not present
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT false;

-- 2. Email Templates
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

-- Seed default Thank You template for completed order
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

-- 3. Communication Workflows
CREATE TABLE IF NOT EXISTS communication_workflows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- e.g. 'order_completed'
  is_enabled   BOOLEAN NOT NULL DEFAULT true,
  template_id  UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default workflow for Order Completed
INSERT INTO communication_workflows (id, name, trigger_type, is_enabled, template_id)
VALUES (
  'w0000001-0000-0000-0000-000000000001',
  'Order Completed Notification',
  'order_completed',
  true,
  'e0000001-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Workflow Executions (Database-enforced idempotency via UNIQUE constraint)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id    UUID NOT NULL REFERENCES communication_workflows(id) ON DELETE CASCADE,
  event_key      TEXT NOT NULL, -- e.g. 'order_completed:b0000001-0000-0000-0000-000000000001'
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  status         TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'simulated')),
  result_details TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_event_key UNIQUE (workflow_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_order_id ON workflow_executions (order_id);

-- 5. Email Logs (Communication History)
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

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Read policies for prototype
DROP POLICY IF EXISTS "Allow read email_templates" ON email_templates;
CREATE POLICY "Allow read email_templates" ON email_templates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow read communication_workflows" ON communication_workflows;
CREATE POLICY "Allow read communication_workflows" ON communication_workflows FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow read workflow_executions" ON workflow_executions;
CREATE POLICY "Allow read workflow_executions" ON workflow_executions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow read email_logs" ON email_logs;
CREATE POLICY "Allow read email_logs" ON email_logs FOR SELECT TO anon, authenticated USING (true);

-- Insert/Update policies
DROP POLICY IF EXISTS "Allow insert workflow_executions" ON workflow_executions;
CREATE POLICY "Allow insert workflow_executions" ON workflow_executions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update communication_workflows" ON communication_workflows;
CREATE POLICY "Allow update communication_workflows" ON communication_workflows FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert email_logs" ON email_logs;
CREATE POLICY "Allow insert email_logs" ON email_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
