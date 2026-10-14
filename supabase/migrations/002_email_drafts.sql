-- ============================================================
-- CommercePilot AI — Phase 3 Database Schema Extension
-- Migration: 002_email_drafts.sql
-- ============================================================

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

-- Enable RLS
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

-- Allow read access for prototype preview
DROP POLICY IF EXISTS "Allow read access to email_drafts" ON email_drafts;
CREATE POLICY "Allow read access to email_drafts"
  ON email_drafts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow authenticated and service_role inserts
DROP POLICY IF EXISTS "Allow insert access to email_drafts" ON email_drafts;
CREATE POLICY "Allow insert access to email_drafts"
  ON email_drafts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow updates
DROP POLICY IF EXISTS "Allow update access to email_drafts" ON email_drafts;
CREATE POLICY "Allow update access to email_drafts"
  ON email_drafts FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);
