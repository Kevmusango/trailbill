-- ============================================================
-- Migration 020: Report Log
--
-- Tracks every report generated or emailed, so the Reports
-- hub can show history and let users re-view or re-download.
-- ============================================================

create table if not exists report_log (
  id            uuid        primary key default gen_random_uuid(),
  business_id   uuid        not null references businesses(id) on delete cascade,
  report_type   text        not null,   -- daily_digest | weekly_report | end_of_week | month_start | month_end | monthly
  period_label  text        not null,   -- human label e.g. "April 2026" or "Week of 13 Apr"
  period_start  date        not null,
  period_end    date        not null,
  email_sent_to text,                   -- null = not emailed yet (preview/manual)
  sent_at       timestamptz,
  generated_at  timestamptz not null default now(),
  content_json  jsonb                   -- snapshot of report data at generation time
);

alter table report_log enable row level security;

create policy "Business owners manage own report log"
  on report_log for all
  to authenticated
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

create index if not exists report_log_business_type
  on report_log (business_id, report_type, generated_at desc);
