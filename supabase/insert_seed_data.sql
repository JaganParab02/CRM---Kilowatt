-- ============================================================
-- CommercePilot AI — Complete Demo Seed Data
-- Run this in your Supabase Project -> SQL Editor
-- Populates all 15 customers, 30 orders, items, activities,
-- templates, workflows, and sample drafts.
-- ============================================================

-- ─── 1. CUSTOMERS (15) ───────────────────────────────────────

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
ON CONFLICT (id) DO UPDATE SET
  email_opt_out = EXCLUDED.email_opt_out,
  tags = EXCLUDED.tags;

-- ─── 2. ORDERS (30) ──────────────────────────────────────────

INSERT INTO orders (id, customer_id, order_number, status, payment_status, fulfillment_status, total, currency, source, ordered_at) VALUES
  -- Aarav Sharma — 5 orders (VIP repeat customer)
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'KW-1001', 'completed', 'paid',     'delivered',   45999.00, 'INR', 'demo', '2026-04-15 10:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'KW-1002', 'completed', 'paid',     'delivered',   12500.00, 'INR', 'demo', '2026-06-20 14:15:00+05:30'),
  ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'KW-1003', 'completed', 'paid',     'delivered',   8750.00,  'INR', 'demo', '2026-08-10 09:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', 'KW-1004', 'processing','paid',     'processing',  32000.00, 'INR', 'demo', '2026-10-01 11:45:00+05:30'),
  ('b0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000001', 'KW-1005', 'pending',   'pending',  'unfulfilled', 15600.00, 'INR', 'demo', '2026-10-12 16:20:00+05:30'),

  -- Priya Patel — 3 orders
  ('b0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000002', 'KW-1006', 'completed', 'paid',     'delivered',   22300.00, 'INR', 'demo', '2026-05-08 13:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000002', 'KW-1007', 'completed', 'paid',     'delivered',   9800.00,  'INR', 'demo', '2026-07-22 10:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000002', 'KW-1008', 'processing','paid',     'shipped',     18450.00, 'INR', 'demo', '2026-10-05 08:15:00+05:30'),

  -- Rohan Gupta — 1 order (new customer)
  ('b0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000003', 'KW-1009', 'pending',   'pending',  'unfulfilled', 5200.00,  'INR', 'demo', '2026-10-13 09:30:00+05:30'),

  -- Ananya Singh — 4 orders (solar equipment buyer)
  ('b0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000004', 'KW-1010', 'completed', 'paid',     'delivered',   125000.00,'INR', 'demo', '2026-04-20 15:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000004', 'KW-1011', 'completed', 'paid',     'delivered',   67500.00, 'INR', 'demo', '2026-06-15 11:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000004', 'KW-1012', 'cancelled', 'refunded', 'unfulfilled', 34000.00, 'INR', 'demo', '2026-08-28 14:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000004', 'KW-1013', 'processing','paid',     'processing',  89000.00, 'INR', 'demo', '2026-10-08 10:00:00+05:30'),

  -- Vikram Reddy — 2 orders (wholesale)
  ('b0000001-0000-0000-0000-000000000014', 'a0000001-0000-0000-0000-000000000005', 'KW-1014', 'completed', 'paid',     'delivered',   245000.00,'INR', 'demo', '2026-05-30 09:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000005', 'KW-1015', 'completed', 'paid',     'delivered',   178500.00,'INR', 'demo', '2026-09-12 12:00:00+05:30'),

  -- Meera Nair — 1 order (new)
  ('b0000001-0000-0000-0000-000000000016', 'a0000001-0000-0000-0000-000000000006', 'KW-1016', 'completed', 'paid',     'delivered',   3400.00,  'INR', 'demo', '2026-09-25 16:30:00+05:30'),

  -- Arjun Deshmukh — 2 orders
  ('b0000001-0000-0000-0000-000000000017', 'a0000001-0000-0000-0000-000000000007', 'KW-1017', 'completed', 'paid',     'delivered',   14200.00, 'INR', 'demo', '2026-07-05 10:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000018', 'a0000001-0000-0000-0000-000000000007', 'KW-1018', 'refunded',  'refunded', 'unfulfilled', 7600.00,  'INR', 'demo', '2026-09-18 14:30:00+05:30'),

  -- Kavya Iyer — 3 orders (VIP)
  ('b0000001-0000-0000-0000-000000000019', 'a0000001-0000-0000-0000-000000000008', 'KW-1019', 'completed', 'paid',     'delivered',   56800.00, 'INR', 'demo', '2026-05-12 11:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000020', 'a0000001-0000-0000-0000-000000000008', 'KW-1020', 'completed', 'paid',     'delivered',   29400.00, 'INR', 'demo', '2026-08-03 15:45:00+05:30'),
  ('b0000001-0000-0000-0000-000000000021', 'a0000001-0000-0000-0000-000000000008', 'KW-1021', 'pending',   'pending',  'unfulfilled', 41200.00, 'INR', 'demo', '2026-10-11 13:00:00+05:30'),

  -- Siddharth Joshi — 1 order (new, failed payment)
  ('b0000001-0000-0000-0000-000000000022', 'a0000001-0000-0000-0000-000000000009', 'KW-1022', 'pending',   'failed',   'unfulfilled', 8900.00,  'INR', 'demo', '2026-10-10 17:00:00+05:30'),

  -- Divya Menon — 1 old order (inactive candidate)
  ('b0000001-0000-0000-0000-000000000023', 'a0000001-0000-0000-0000-000000000010', 'KW-1023', 'completed', 'paid',     'delivered',   6200.00,  'INR', 'demo', '2026-04-02 10:00:00+05:30'),

  -- Rahul Choudhury — 2 orders
  ('b0000001-0000-0000-0000-000000000024', 'a0000001-0000-0000-0000-000000000011', 'KW-1024', 'completed', 'paid',     'delivered',   19800.00, 'INR', 'demo', '2026-06-28 09:30:00+05:30'),
  ('b0000001-0000-0000-0000-000000000025', 'a0000001-0000-0000-0000-000000000011', 'KW-1025', 'processing','paid',     'processing',  11500.00, 'INR', 'demo', '2026-10-03 14:00:00+05:30'),

  -- Neha Kapoor — 1 order (new)
  ('b0000001-0000-0000-0000-000000000026', 'a0000001-0000-0000-0000-000000000012', 'KW-1026', 'completed', 'paid',     'delivered',   4300.00,  'INR', 'demo', '2026-09-30 11:15:00+05:30'),

  -- Amit Verma — 2 orders (wholesale VIP)
  ('b0000001-0000-0000-0000-000000000027', 'a0000001-0000-0000-0000-000000000013', 'KW-1027', 'completed', 'paid',     'delivered',   312000.00,'INR', 'demo', '2026-07-10 08:00:00+05:30'),
  ('b0000001-0000-0000-0000-000000000028', 'a0000001-0000-0000-0000-000000000013', 'KW-1028', 'processing','paid',     'shipped',     156000.00,'INR', 'demo', '2026-10-07 10:30:00+05:30'),

  -- Sneha Rao — 1 old order (inactive candidate)
  ('b0000001-0000-0000-0000-000000000029', 'a0000001-0000-0000-0000-000000000014', 'KW-1029', 'completed', 'paid',     'delivered',   7800.00,  'INR', 'demo', '2026-04-25 13:00:00+05:30'),

  -- Guest order (no customer)
  ('b0000001-0000-0000-0000-000000000030', NULL,                                    'KW-1030', 'completed', 'paid',     'delivered',   2100.00,  'INR', 'demo', '2026-09-05 10:00:00+05:30')
ON CONFLICT (id) DO NOTHING;

-- ─── 3. ORDER ITEMS (29) ─────────────────────────────────────

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

-- ─── 4. CUSTOMER ACTIVITIES (12) ─────────────────────────────

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

-- ─── 5. TEMPLATES & WORKFLOWS ────────────────────────────────

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

-- ─── 6. SAMPLE AI EMAIL DRAFTS ───────────────────────────────

INSERT INTO email_drafts (id, customer_id, order_id, subject, body, status, ai_generated, recommendation_reason)
VALUES
  (
    'f0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000001',
    'Checking in on your 5kW Solar Panel Kit setup',
    'Hi Aarav,

It has been a few months since your 5kW Solar Panel Kit and mounting brackets were installed. We wanted to reach out to ensure everything is operating at peak energy efficiency!

If you are thinking about expanding to battery storage or upgrading your DC cable kit, we would be delighted to assist.

Warm regards,
Kilowatt Energy Team',
    'draft',
    true,
    'Customer has 3 completed orders exceeding ₹67,000 in spend, with the last completed order over 60 days ago. Excellent candidate for solar kit check-in.'
  ),
  (
    'f0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000010',
    'b0000001-0000-0000-0000-000000000023',
    'How can we help with your energy equipment?',
    'Hi Divya,

We noticed it has been several months since your last purchase with Kilowatt. We value your business and wanted to see if your equipment is performing well, or if you need any technical advice.

Please feel free to reply directly to this email if you need anything!

Best regards,
Kilowatt Customer Care',
    'draft',
    true,
    'Customer has been inactive for >180 days with only one historical completed order. High retention opportunity.'
  )
ON CONFLICT (id) DO NOTHING;
