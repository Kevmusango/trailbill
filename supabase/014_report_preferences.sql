-- ============================================================
-- Migration 014: Report preferences — beginning & end of month
--
-- Migration 003 already added:
--   daily_digest_enabled / daily_digest_time
--   weekly_report_enabled / weekly_report_day / weekly_report_time
--   end_of_week_report_enabled / end_of_week_report_day / end_of_week_report_time
--
-- This migration completes the 5-report schedule by adding:
--   month_start_report_enabled / month_start_report_time
--     — sent on the 1st of each month (morning)
--     — shows: expected income this month, due dates, contracts active
--
--   month_end_report_enabled / month_end_report_time
--     — sent on the last day of each month (afternoon)
--     — shows: actual vs expected, outstanding, reliability changes
-- ============================================================

alter table businesses
  add column if not exists month_start_report_enabled boolean not null default true,
  add column if not exists month_start_report_time    time    not null default '07:00:00',
  add column if not exists month_end_report_enabled   boolean not null default true,
  add column if not exists month_end_report_time      time    not null default '16:00:00';
