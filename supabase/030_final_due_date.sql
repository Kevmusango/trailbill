-- Migration 030: Add final_due_date for daily accruing late fee system
--
-- New payment terms model:
--   due_date          → original due date (Button 1 range ends here)
--   grace_end_date    → free grace period ends (existing, no fee before this)
--   final_due_date    → absolute last date (late fee fully accrued = late_fee_pct cap by this date)
--   late_fee_pct      → max % cap (e.g. 15%), daily rate = late_fee_pct / days(grace_end → final_due)

-- 1. payment_requests: add final_due_date
alter table payment_requests
  add column if not exists final_due_date date;

-- 2. client_groups: add final_due_date_days (days after grace_end_date)
alter table client_groups
  add column if not exists final_due_date_days int not null default 0;

-- 3. businesses: add default_final_due_date_days
alter table businesses
  add column if not exists default_final_due_date_days int not null default 0;
