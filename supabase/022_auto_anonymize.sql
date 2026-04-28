-- ============================================================
-- Migration 022: Automatic Client Anonymisation
--
-- Businesses should not have to remember to archive clients.
-- This migration adds a scheduled function that automatically
-- anonymises PII for clients who have been inactive for
-- 12+ months, regardless of whether the business acted.
--
-- Definition of "inactive":
--   - No payment_request with due_date in the last 12 months
--   - AND is_active = false OR no payment request at all
--
-- auto_anonymize_stale_clients()
--   → Runs monthly (1st of month via cron)
--   → Returns count of clients anonymised
--
-- POPIA retention guideline:
--   Personal data must not be kept longer than necessary.
--   12 months after last activity is a reasonable threshold.
-- ============================================================

create or replace function auto_anonymize_stale_clients()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update clients c
  set
    name       = 'Archived Client',
    email      = null,
    phone      = null,
    is_active  = false,
    deleted_at = now()
  where
    c.deleted_at is null  -- not already anonymised
    and (
      -- Condition A: explicitly deactivated + no recent activity
      (
        c.is_active = false
        and not exists (
          select 1 from payment_requests pr
          where pr.client_id = c.id
            and pr.due_date >= (now() - interval '12 months')::date
        )
      )
      OR
      -- Condition B: never had any payment request and older than 12 months
      (
        not exists (select 1 from payment_requests pr where pr.client_id = c.id)
        and c.created_at < now() - interval '12 months'
      )
    );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function auto_anonymize_stale_clients() to authenticated;

-- ============================================================
-- Policy note stored in DB for audit trail
-- ============================================================
comment on function auto_anonymize_stale_clients() is
  'POPIA compliance: auto-wipes PII for clients inactive 12+ months. Runs monthly via cron.';
