-- ============================================================
-- Migration 011: System cleanup
--
-- 1. Fix activity_log.type constraint — adds 'late_fee' (was
--    silently failing on every late fee application since 008)
-- 2. Drop running_balance from clients — deprecated by 006,
--    balance is always derived from payment_requests history
-- 3. Fix recalculate_client_reliability — now properly computes
--    average_days_to_pay and on_time_rate from real payment data
-- 4. Clean up reminder_type constraint — removes old naming
--    (before_due, due_today, follow_up_1, follow_up_2, escalation)
--    keeping only the current naming used across the app
-- ============================================================


-- ── 1. Fix activity_log.type constraint ──────────────────────

alter table activity_log
  drop constraint if exists activity_log_type_check;

alter table activity_log
  add constraint activity_log_type_check
  check (type in ('payment', 'request', 'reminder', 'overdue', 'client', 'group', 'system', 'late_fee'));


-- ── 2. Drop running_balance from clients ─────────────────────
-- Balance is derived from payment_requests (sum of amount_paid - base_amount).
-- This column has not been updated since migration 006 removed the sync.

alter table clients
  drop column if exists running_balance;


-- ── 3. Fix recalculate_client_reliability ────────────────────
-- Now also computes average_days_to_pay and on_time_rate from
-- the payments table so these fields reflect real behaviour.
--
-- average_days_to_pay: avg days between due_date and last payment_date
--   for fully paid requests (positive = late, 0 = on time, capped at 0 floor)
-- on_time_rate: % of paid requests where payment landed on or before due_date

create or replace function recalculate_client_reliability(p_client_id uuid)
returns void language plpgsql as $$
declare
  v_total_billed    numeric;
  v_total_paid      numeric;
  v_total_requests  int;
  v_paid_requests   int;
  v_pay_rate        numeric;
  v_cleared_rate    numeric;
  v_score           numeric;
  v_status          text;
  v_avg_days        numeric;
  v_on_time_rate    numeric;
begin
  -- Core payment totals
  select
    coalesce(sum(base_amount), 0),
    coalesce(sum(amount_paid), 0),
    count(*),
    count(*) filter (where status = 'paid')
  into v_total_billed, v_total_paid, v_total_requests, v_paid_requests
  from payment_requests
  where client_id = p_client_id;

  if v_total_requests = 0 or v_total_billed = 0 then
    return;
  end if;

  -- Reliability score (unchanged formula)
  v_pay_rate     := least(v_total_paid / v_total_billed, 1.0);
  v_cleared_rate := v_paid_requests::numeric / v_total_requests;
  v_score        := round((v_pay_rate * 3 + v_cleared_rate * 2)::numeric, 1);

  v_status := case
    when v_score >= 4.5 then 'excellent'
    when v_score >= 3.5 then 'good'
    when v_score >= 2.0 then 'warning'
    else 'at-risk'
  end;

  -- average_days_to_pay: per paid request, use the latest payment date
  -- Days = payment_date - due_date (positive means late, negative means early)
  select
    coalesce(
      round(avg(days_diff)::numeric, 0),
      0
    )
  into v_avg_days
  from (
    select
      pr.due_date,
      max(p.payment_date) as last_payment_date,
      extract(day from (max(p.payment_date)::timestamptz - pr.due_date::timestamptz)) as days_diff
    from payment_requests pr
    join payments p on p.request_id = pr.id
    where pr.client_id = p_client_id
      and pr.status = 'paid'
    group by pr.id, pr.due_date
  ) paid_requests;

  -- on_time_rate: % of paid requests where final payment was on or before due_date
  select
    coalesce(
      round(
        100.0 * count(*) filter (where last_payment_date <= due_date) / nullif(count(*), 0),
        1
      ),
      100.0
    )
  into v_on_time_rate
  from (
    select
      pr.due_date,
      max(p.payment_date) as last_payment_date
    from payment_requests pr
    join payments p on p.request_id = pr.id
    where pr.client_id = p_client_id
      and pr.status = 'paid'
    group by pr.id, pr.due_date
  ) paid_requests;

  update clients
  set reliability_score   = v_score,
      status              = v_status,
      average_days_to_pay = greatest(coalesce(v_avg_days::int, 0), 0),
      on_time_rate        = coalesce(v_on_time_rate, 100.0),
      updated_at          = now()
  where id = p_client_id;
end;
$$;

-- Backfill all existing clients with accurate values now
select backfill_reliability();


-- ── 4. Clean up reminder_type constraint ─────────────────────
-- Remove legacy names. Only the current naming is used in
-- get_todays_reminders(), the activity API, and the UI.

alter table reminder_log
  drop constraint if exists reminder_log_reminder_type_check;

alter table reminder_log
  add constraint reminder_log_reminder_type_check
  check (reminder_type in (
    '1_day_before',
    'due_date',
    '1_day_after',
    '3_days_after',
    '7_days_after'
  ));
