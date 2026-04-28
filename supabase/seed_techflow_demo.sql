-- ================================================================
-- TrailBill Demo Seed Data — TechFlow Solutions (Technology)
-- 6 months of realistic data: Oct 2025 – Mar 2026
-- 8 clients with varied payment behaviour
-- ================================================================
--
-- STEP 1: Find your business ID
--   SELECT id, name FROM businesses;
--
-- STEP 2: Replace the UUID on line 21 with your business ID
--
-- STEP 3: Run the full script in the Supabase SQL editor
--
-- TO REMOVE ALL SEED DATA: scroll to the bottom for the cleanup
-- ================================================================

DO $$
DECLARE
  v_biz uuid := 'd29b397e-f7ce-452d-9f25-fc220b70c580';

  -- Group
  v_group  uuid := gen_random_uuid();

  -- Clients
  v_apex   uuid := gen_random_uuid();  -- Apex Digital      — excellent
  v_blue   uuid := gen_random_uuid();  -- BlueSky Systems   — good
  v_clear  uuid := gen_random_uuid();  -- ClearCode Labs    — good
  v_data   uuid := gen_random_uuid();  -- DataStream SA     — warning
  v_evo    uuid := gen_random_uuid();  -- EvoTech           — warning
  v_future uuid := gen_random_uuid();  -- FutureMind        — at-risk
  v_grid   uuid := gen_random_uuid();  -- GridPoint IT      — excellent
  v_hyper  uuid := gen_random_uuid();  -- HyperLink SA      — good (new Feb)

  -- Batches (one per month)
  v_b_oct uuid := gen_random_uuid();
  v_b_nov uuid := gen_random_uuid();
  v_b_dec uuid := gen_random_uuid();
  v_b_jan uuid := gen_random_uuid();
  v_b_feb uuid := gen_random_uuid();
  v_b_mar uuid := gen_random_uuid();

BEGIN

-- ── 1. GROUP ──────────────────────────────────────────────────
INSERT INTO client_groups (
  id, business_id, name, description,
  default_amount, due_day, grace_days, late_fee_pct, is_active
) VALUES (
  v_group, v_biz,
  'Monthly SLA Retainer',
  'Ongoing software support & infrastructure monitoring',
  3000.00, 25, 5, 5.00, true
);

-- ── 2. CLIENTS ────────────────────────────────────────────────
INSERT INTO clients (
  id, business_id, name, email, phone, reference_number,
  reliability_score, average_days_to_pay,
  inferred_payday_day, payday_confidence,
  preferred_channel, status, is_active
) VALUES
  (v_apex,   v_biz, 'Apex Digital',    'accounts@apexdigital.co.za',  '071 111 2233', 'TF-001', 5.00,  3,  28, 'high', 'email',     'excellent', true),
  (v_blue,   v_biz, 'BlueSky Systems', 'finance@blueskysys.co.za',    '072 222 3344', 'TF-002', 4.20,  5,  null, 'none', 'email',   'good',      true),
  (v_clear,  v_biz, 'ClearCode Labs',  'accounts@clearcode.co.za',    '073 333 4455', 'TF-003', 4.00,  7,  null, 'none', 'email',   'good',      true),
  (v_data,   v_biz, 'DataStream SA',   'billing@datastream.co.za',    '074 444 5566', 'TF-004', 3.20, 12,  null, 'none', 'email',   'warning',   true),
  (v_evo,    v_biz, 'EvoTech',         'admin@evotech.co.za',         '076 555 6677', 'TF-005', 2.10, 18,  null, 'none', 'whatsapp','warning',   true),
  (v_future, v_biz, 'FutureMind',      'accounts@futuremind.co.za',   '077 666 7788', 'TF-006', 1.20,  30, null, 'none', 'email',  'at-risk',   true),
  (v_grid,   v_biz, 'GridPoint IT',    'finance@gridpoint.co.za',     '078 777 8899', 'TF-007', 5.00,  2,  26, 'high', 'email',     'excellent', true),
  (v_hyper,  v_biz, 'HyperLink SA',    'billing@hyperlink.co.za',     '079 888 9900', 'TF-008', 4.50,  4,  null, 'none', 'email',   'good',      true);

-- ── 3. GROUP MEMBERSHIPS ──────────────────────────────────────
INSERT INTO group_memberships (id, group_id, client_id, custom_amount, is_active) VALUES
  (gen_random_uuid(), v_group, v_apex,   3500.00, true),  -- custom: R3 500
  (gen_random_uuid(), v_group, v_blue,   null,    true),  -- default: R3 000
  (gen_random_uuid(), v_group, v_clear,  2500.00, true),  -- custom: R2 500
  (gen_random_uuid(), v_group, v_data,   null,    true),  -- default: R3 000
  (gen_random_uuid(), v_group, v_evo,    2000.00, true),  -- custom: R2 000
  (gen_random_uuid(), v_group, v_future, 3500.00, true),  -- custom: R3 500
  (gen_random_uuid(), v_group, v_grid,   null,    true),  -- default: R3 000
  (gen_random_uuid(), v_group, v_hyper,  2500.00, true);  -- custom: R2 500

-- ── 4. PAYMENT BATCHES ────────────────────────────────────────
INSERT INTO payment_batches (
  id, business_id, group_id, batch_number, description,
  month, total_amount, total_clients, status, scheduled_at
) VALUES
  (v_b_oct, v_biz, v_group, 'TF-2025-10', 'SLA Retainer – October 2025',  '2025-10-01', 20500, 7, 'sent', '2025-10-20 06:00:00+00'),
  (v_b_nov, v_biz, v_group, 'TF-2025-11', 'SLA Retainer – November 2025', '2025-11-01', 20500, 7, 'sent', '2025-11-20 06:00:00+00'),
  (v_b_dec, v_biz, v_group, 'TF-2025-12', 'SLA Retainer – December 2025', '2025-12-01', 20500, 7, 'sent', '2025-12-20 06:00:00+00'),
  (v_b_jan, v_biz, v_group, 'TF-2026-01', 'SLA Retainer – January 2026',  '2026-01-01', 20500, 7, 'sent', '2026-01-20 06:00:00+00'),
  (v_b_feb, v_biz, v_group, 'TF-2026-02', 'SLA Retainer – February 2026', '2026-02-01', 23000, 8, 'sent', '2026-02-20 06:00:00+00'),
  (v_b_mar, v_biz, v_group, 'TF-2026-03', 'SLA Retainer – March 2026',    '2026-03-01', 23000, 8, 'sent', '2026-03-20 06:00:00+00');

-- ── 5. PAYMENT REQUESTS ───────────────────────────────────────
-- Columns: base_amount = what the client owes, previous_balance = 0,
--          outstanding = total_due - amount_paid (regular NOT NULL column)

-- OCTOBER 2025 (7 clients)
INSERT INTO payment_requests (
  id, batch_id, business_id, client_id, request_number, public_token,
  base_amount, previous_balance, total_due, amount_paid, outstanding,
  status, due_date, notification_channels
) VALUES
  (gen_random_uuid(), v_b_oct, v_biz, v_apex,   'TF-25-10-001', gen_random_uuid()::text, 3500, 0, 3500, 3500,    0, 'paid',    '2025-10-25', 'email'),
  (gen_random_uuid(), v_b_oct, v_biz, v_blue,   'TF-25-10-002', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-10-25', 'email'),
  (gen_random_uuid(), v_b_oct, v_biz, v_clear,  'TF-25-10-003', gen_random_uuid()::text, 2500, 0, 2500, 2500,    0, 'paid',    '2025-10-25', 'email'),
  (gen_random_uuid(), v_b_oct, v_biz, v_data,   'TF-25-10-004', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-10-25', 'email'),
  (gen_random_uuid(), v_b_oct, v_biz, v_evo,    'TF-25-10-005', gen_random_uuid()::text, 2000, 0, 2000, 2000,    0, 'paid',    '2025-10-25', 'email'),
  (gen_random_uuid(), v_b_oct, v_biz, v_future, 'TF-25-10-006', gen_random_uuid()::text, 3500, 0, 3500, 2000, 1500, 'partial', '2025-10-25', 'email'),
  (gen_random_uuid(), v_b_oct, v_biz, v_grid,   'TF-25-10-007', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-10-25', 'email');

-- NOVEMBER 2025
INSERT INTO payment_requests (
  id, batch_id, business_id, client_id, request_number, public_token,
  base_amount, previous_balance, total_due, amount_paid, outstanding,
  status, due_date, notification_channels
) VALUES
  (gen_random_uuid(), v_b_nov, v_biz, v_apex,   'TF-25-11-001', gen_random_uuid()::text, 3500, 0, 3500, 3500,    0, 'paid',    '2025-11-25', 'email'),
  (gen_random_uuid(), v_b_nov, v_biz, v_blue,   'TF-25-11-002', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-11-25', 'email'),
  (gen_random_uuid(), v_b_nov, v_biz, v_clear,  'TF-25-11-003', gen_random_uuid()::text, 2500, 0, 2500, 2500,    0, 'paid',    '2025-11-25', 'email'),
  (gen_random_uuid(), v_b_nov, v_biz, v_data,   'TF-25-11-004', gen_random_uuid()::text, 3000, 0, 3000, 1500, 1500, 'partial', '2025-11-25', 'email'),
  (gen_random_uuid(), v_b_nov, v_biz, v_evo,    'TF-25-11-005', gen_random_uuid()::text, 2000, 0, 2000, 2000,    0, 'paid',    '2025-11-25', 'email'),
  (gen_random_uuid(), v_b_nov, v_biz, v_future, 'TF-25-11-006', gen_random_uuid()::text, 3500, 0, 3500,    0, 3500, 'overdue', '2025-11-25', 'email'),
  (gen_random_uuid(), v_b_nov, v_biz, v_grid,   'TF-25-11-007', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-11-25', 'email');

-- DECEMBER 2025
INSERT INTO payment_requests (
  id, batch_id, business_id, client_id, request_number, public_token,
  base_amount, previous_balance, total_due, amount_paid, outstanding,
  status, due_date, notification_channels
) VALUES
  (gen_random_uuid(), v_b_dec, v_biz, v_apex,   'TF-25-12-001', gen_random_uuid()::text, 3500, 0, 3500, 3500,    0, 'paid',    '2025-12-25', 'email'),
  (gen_random_uuid(), v_b_dec, v_biz, v_blue,   'TF-25-12-002', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-12-25', 'email'),
  (gen_random_uuid(), v_b_dec, v_biz, v_clear,  'TF-25-12-003', gen_random_uuid()::text, 2500, 0, 2500, 2500,    0, 'paid',    '2025-12-25', 'email'),
  (gen_random_uuid(), v_b_dec, v_biz, v_data,   'TF-25-12-004', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-12-25', 'email'),
  (gen_random_uuid(), v_b_dec, v_biz, v_evo,    'TF-25-12-005', gen_random_uuid()::text, 2000, 0, 2000,    0, 2000, 'overdue', '2025-12-25', 'email'),
  (gen_random_uuid(), v_b_dec, v_biz, v_future, 'TF-25-12-006', gen_random_uuid()::text, 3500, 0, 3500, 1500, 2000, 'partial', '2025-12-25', 'email'),
  (gen_random_uuid(), v_b_dec, v_biz, v_grid,   'TF-25-12-007', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2025-12-25', 'email');

-- JANUARY 2026
INSERT INTO payment_requests (
  id, batch_id, business_id, client_id, request_number, public_token,
  base_amount, previous_balance, total_due, amount_paid, outstanding,
  status, due_date, notification_channels
) VALUES
  (gen_random_uuid(), v_b_jan, v_biz, v_apex,   'TF-26-01-001', gen_random_uuid()::text, 3500, 0, 3500, 3500,    0, 'paid',    '2026-01-25', 'email'),
  (gen_random_uuid(), v_b_jan, v_biz, v_blue,   'TF-26-01-002', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2026-01-25', 'email'),
  (gen_random_uuid(), v_b_jan, v_biz, v_clear,  'TF-26-01-003', gen_random_uuid()::text, 2500, 0, 2500, 2500,    0, 'paid',    '2026-01-25', 'email'),
  (gen_random_uuid(), v_b_jan, v_biz, v_data,   'TF-26-01-004', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2026-01-25', 'email'),
  (gen_random_uuid(), v_b_jan, v_biz, v_evo,    'TF-26-01-005', gen_random_uuid()::text, 2000, 0, 2000, 1000, 1000, 'partial', '2026-01-25', 'email'),
  (gen_random_uuid(), v_b_jan, v_biz, v_future, 'TF-26-01-006', gen_random_uuid()::text, 3500, 0, 3500,    0, 3500, 'overdue', '2026-01-25', 'email'),
  (gen_random_uuid(), v_b_jan, v_biz, v_grid,   'TF-26-01-007', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2026-01-25', 'email');

-- FEBRUARY 2026 (HyperLink SA joins)
INSERT INTO payment_requests (
  id, batch_id, business_id, client_id, request_number, public_token,
  base_amount, previous_balance, total_due, amount_paid, outstanding,
  status, due_date, notification_channels
) VALUES
  (gen_random_uuid(), v_b_feb, v_biz, v_apex,   'TF-26-02-001', gen_random_uuid()::text, 3500, 0, 3500, 3500,    0, 'paid',    '2026-02-25', 'email'),
  (gen_random_uuid(), v_b_feb, v_biz, v_blue,   'TF-26-02-002', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2026-02-25', 'email'),
  (gen_random_uuid(), v_b_feb, v_biz, v_clear,  'TF-26-02-003', gen_random_uuid()::text, 2500, 0, 2500, 1500, 1000, 'partial', '2026-02-25', 'email'),
  (gen_random_uuid(), v_b_feb, v_biz, v_data,   'TF-26-02-004', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2026-02-25', 'email'),
  (gen_random_uuid(), v_b_feb, v_biz, v_evo,    'TF-26-02-005', gen_random_uuid()::text, 2000, 0, 2000, 2000,    0, 'paid',    '2026-02-25', 'email'),
  (gen_random_uuid(), v_b_feb, v_biz, v_future, 'TF-26-02-006', gen_random_uuid()::text, 3500, 0, 3500, 2000, 1500, 'partial', '2026-02-25', 'email'),
  (gen_random_uuid(), v_b_feb, v_biz, v_grid,   'TF-26-02-007', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2026-02-25', 'email'),
  (gen_random_uuid(), v_b_feb, v_biz, v_hyper,  'TF-26-02-008', gen_random_uuid()::text, 2500, 0, 2500, 2500,    0, 'paid',    '2026-02-25', 'email');

-- MARCH 2026 (current month — some still outstanding)
INSERT INTO payment_requests (
  id, batch_id, business_id, client_id, request_number, public_token,
  base_amount, previous_balance, total_due, amount_paid, outstanding,
  status, due_date, notification_channels
) VALUES
  (gen_random_uuid(), v_b_mar, v_biz, v_apex,   'TF-26-03-001', gen_random_uuid()::text, 3500, 0, 3500, 3500,    0, 'paid',    '2026-03-25', 'email'),
  (gen_random_uuid(), v_b_mar, v_biz, v_blue,   'TF-26-03-002', gen_random_uuid()::text, 3000, 0, 3000, 2000, 1000, 'partial', '2026-03-25', 'email'),
  (gen_random_uuid(), v_b_mar, v_biz, v_clear,  'TF-26-03-003', gen_random_uuid()::text, 2500, 0, 2500, 2500,    0, 'paid',    '2026-03-25', 'email'),
  (gen_random_uuid(), v_b_mar, v_biz, v_data,   'TF-26-03-004', gen_random_uuid()::text, 3000, 0, 3000, 1000, 2000, 'partial', '2026-03-25', 'email'),
  (gen_random_uuid(), v_b_mar, v_biz, v_evo,    'TF-26-03-005', gen_random_uuid()::text, 2000, 0, 2000,    0, 2000, 'overdue', '2026-03-25', 'email'),
  (gen_random_uuid(), v_b_mar, v_biz, v_future, 'TF-26-03-006', gen_random_uuid()::text, 3500, 0, 3500,    0, 3500, 'overdue', '2026-03-25', 'email'),
  (gen_random_uuid(), v_b_mar, v_biz, v_grid,   'TF-26-03-007', gen_random_uuid()::text, 3000, 0, 3000, 3000,    0, 'paid',    '2026-03-25', 'email'),
  (gen_random_uuid(), v_b_mar, v_biz, v_hyper,  'TF-26-03-008', gen_random_uuid()::text, 2500, 0, 2500, 2500,    0, 'paid',    '2026-03-25', 'email');

-- ── 6. PAYMENTS (actual recorded payments for paid/partial) ───
-- Simulates realistic payment dates (Apex pays fast, FutureMind drags)
INSERT INTO payments (id, request_id, business_id, client_id, amount, payment_date, method)
SELECT
  gen_random_uuid(),
  pr.id,
  pr.business_id,
  pr.client_id,
  pr.amount_paid,
  pr.due_date + (
    CASE
      WHEN c.name = 'Apex Digital'    THEN  1
      WHEN c.name = 'GridPoint IT'    THEN  2
      WHEN c.name = 'HyperLink SA'    THEN  3
      WHEN c.name = 'BlueSky Systems' THEN  4
      WHEN c.name = 'ClearCode Labs'  THEN  6
      WHEN c.name = 'DataStream SA'   THEN 11
      WHEN c.name = 'EvoTech'         THEN 16
      WHEN c.name = 'FutureMind'      THEN 22
      ELSE 5
    END
  ) * interval '1 day',
  'eft'
FROM payment_requests pr
JOIN clients c ON c.id = pr.client_id
WHERE pr.business_id = v_biz
  AND pr.amount_paid > 0;

-- ── 7. BEHAVIOR FLAGS ─────────────────────────────────────────
INSERT INTO behavior_flags (id, business_id, client_id, flag_type, message, severity, is_read) VALUES
  (gen_random_uuid(), v_biz, v_future, 'needs_attention',
    'FutureMind has missed or partially paid 5 consecutive months — action required.',
    'critical', false),
  (gen_random_uuid(), v_biz, v_evo, 'watch',
    'EvoTech has 2 unpaid months and inconsistent amounts. Monitor closely.',
    'warning', false),
  (gen_random_uuid(), v_biz, v_apex, 'reliable',
    'Apex Digital has paid in full and on time for 6 consecutive months.',
    'info', true),
  (gen_random_uuid(), v_biz, v_grid, 'reliable',
    'GridPoint IT consistently pays within 2 days — fastest payer on your list.',
    'info', true);

-- ── 8. PAYMENT EVENTS (Feb & Mar interactions) ────────────────
-- Link visits for all Feb and Mar requests
INSERT INTO payment_events (id, business_id, request_id, client_id, event_type, channel)
SELECT gen_random_uuid(), pr.business_id, pr.id, pr.client_id, 'link_visited', 'email'
FROM payment_requests pr
WHERE pr.business_id = v_biz AND pr.batch_id IN (v_b_feb, v_b_mar);

-- Pay Now clicks for clients who paid or partially paid
INSERT INTO payment_events (id, business_id, request_id, client_id, event_type, channel)
SELECT gen_random_uuid(), pr.business_id, pr.id, pr.client_id, 'pay_now_clicked', 'email'
FROM payment_requests pr
WHERE pr.business_id = v_biz
  AND pr.amount_paid > 0
  AND pr.batch_id IN (v_b_feb, v_b_mar);

-- Payment recorded events
INSERT INTO payment_events (id, business_id, request_id, client_id, event_type, channel)
SELECT gen_random_uuid(), pr.business_id, pr.id, pr.client_id, 'payment_recorded', 'email'
FROM payment_requests pr
WHERE pr.business_id = v_biz
  AND pr.status = 'paid'
  AND pr.batch_id IN (v_b_jan, v_b_feb, v_b_mar);

-- ── 9. MONTHLY SNAPSHOTS (Oct 2025 – Feb 2026) ────────────────
-- paid_count  = clients who paid in full
-- total_count = total clients that month
INSERT INTO business_monthly_snapshots (
  id, business_id, year, month,
  expected, collected, outstanding, collection_rate,
  paid_count, total_count, avg_days_to_pay, new_clients
) VALUES
  (gen_random_uuid(), v_biz, 2025, 10, 20500.00, 19000.00,  1500.00, 92.68,  6, 7,  8.0, 0),
  (gen_random_uuid(), v_biz, 2025, 11, 20500.00, 15500.00,  5000.00, 75.61,  4, 7, 10.2, 0),
  (gen_random_uuid(), v_biz, 2025, 12, 20500.00, 16500.00,  4000.00, 80.49,  5, 7,  9.1, 0),
  (gen_random_uuid(), v_biz, 2026,  1, 20500.00, 16000.00,  4500.00, 78.05,  5, 7,  9.4, 0),
  (gen_random_uuid(), v_biz, 2026,  2, 23000.00, 20500.00,  2500.00, 89.13,  6, 8,  8.3, 1);

-- ── 10. REPORT LOG (sample sent reports) ─────────────────────
INSERT INTO report_log (
  id, business_id, report_type, period_label,
  period_start, period_end, email_sent_to, sent_at, generated_at, content_json
) VALUES
  (gen_random_uuid(), v_biz, 'monthly',      'February 2026',      '2026-02-01', '2026-02-28',
   'hello@techflow.co.za', '2026-02-28 14:00:00+00', '2026-02-28 13:58:00+00',
   '{"collection_rate":89,"total_due":23000,"total_paid":20500,"outstanding":2500}'),
  (gen_random_uuid(), v_biz, 'monthly',      'January 2026',       '2026-01-01', '2026-01-31',
   'hello@techflow.co.za', '2026-01-31 14:00:00+00', '2026-01-31 13:58:00+00',
   '{"collection_rate":78,"total_due":20500,"total_paid":16000,"outstanding":4500}'),
  (gen_random_uuid(), v_biz, 'weekly_report','Week of 7 Apr 2026',  '2026-04-07', '2026-04-11',
   'hello@techflow.co.za', '2026-04-07 06:00:00+00', '2026-04-07 05:58:00+00',
   '{"pending_reminders":3,"scheduled_sends":0}'),
  (gen_random_uuid(), v_biz, 'daily_digest', 'Wednesday 15 Apr 2026','2026-04-15','2026-04-15',
   'hello@techflow.co.za', '2026-04-15 06:00:00+00', '2026-04-15 05:58:00+00',
   '{"reminders_today":2,"overdue_count":2}');

END $$;

-- ================================================================
-- CLEANUP — run this to remove ALL seed data for this business
-- Replace the UUID below with the same business ID you used above
-- ================================================================
/*
DO $$
DECLARE v_biz uuid := 'REPLACE-WITH-YOUR-BUSINESS-UUID';
BEGIN
  DELETE FROM report_log            WHERE business_id = v_biz;
  DELETE FROM business_monthly_snapshots WHERE business_id = v_biz;
  DELETE FROM payment_events        WHERE business_id = v_biz;
  DELETE FROM behavior_flags        WHERE business_id = v_biz;
  DELETE FROM payments              WHERE business_id = v_biz;
  DELETE FROM payment_requests      WHERE business_id = v_biz;
  DELETE FROM payment_batches       WHERE business_id = v_biz;
  DELETE FROM group_memberships     WHERE group_id IN (SELECT id FROM client_groups WHERE business_id = v_biz);
  DELETE FROM client_groups         WHERE business_id = v_biz;
  DELETE FROM clients               WHERE business_id = v_biz;
END $$;
*/
