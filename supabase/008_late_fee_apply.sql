-- ============================================================
-- Migration 008: Configurable late fee auto-application
--
-- Adds to client_groups:
--   late_fee_trigger      — 'after_grace' | 'immediately' | 'days_overdue'
--   late_fee_trigger_days — used when trigger = 'days_overdue'
--   late_fee_recurring    — apply on each follow-up or once only
--
-- Adds to payment_requests:
--   late_fee_trigger / late_fee_trigger_days / late_fee_recurring (copied from group)
--   late_fee_applied      — prevents double-charging
--
-- apply_late_fees(business_id) runs on page load to update
-- total_due + outstanding for all eligible requests.
-- ============================================================

-- ── client_groups ────────────────────────────────────────────────────────────

alter table client_groups
  add column if not exists late_fee_trigger      text    not null default 'after_grace'
    check (late_fee_trigger in ('after_grace', 'immediately', 'days_overdue')),
  add column if not exists late_fee_trigger_days int     not null default 0,
  add column if not exists late_fee_recurring    boolean not null default false;

-- ── payment_requests ─────────────────────────────────────────────────────────

alter table payment_requests
  add column if not exists late_fee_trigger      text    not null default 'after_grace'
    check (late_fee_trigger in ('after_grace', 'immediately', 'days_overdue')),
  add column if not exists late_fee_trigger_days int     not null default 0,
  add column if not exists late_fee_recurring    boolean not null default false,
  add column if not exists late_fee_applied      boolean not null default false,
  add column if not exists late_fee_applied_count int    not null default 0;

-- ── apply_late_fees ──────────────────────────────────────────────────────────
-- Determines eligibility per request based on trigger config, then
-- adds late fee to total_due + outstanding. Recurring fees re-apply
-- on subsequent calls (up to once per follow-up cycle: 1, 3, 7 days).

create or replace function apply_late_fees(p_business_id uuid)
returns int language plpgsql as $$
declare
  v_req    record;
  v_fee    numeric;
  v_count  int  := 0;
  v_today  date := current_date;
  v_days_overdue int;
  v_eligible bool;
begin
  for v_req in
    select *
    from payment_requests
    where business_id  = p_business_id
      and late_fee_pct > 0
      and status       not in ('paid')
  loop
    v_days_overdue := v_today - v_req.due_date;

    -- Determine if the trigger threshold has been reached
    v_eligible := case v_req.late_fee_trigger
      when 'immediately'  then v_days_overdue > 0
      when 'after_grace'  then (
        v_req.grace_end_date is not null and v_today > v_req.grace_end_date
        or
        v_req.grace_end_date is null and v_days_overdue > 0
      )
      when 'days_overdue' then v_days_overdue >= v_req.late_fee_trigger_days
      else false
    end;

    if not v_eligible then continue; end if;

    -- Non-recurring: skip if already applied
    if not v_req.late_fee_recurring and v_req.late_fee_applied then continue; end if;

    -- Recurring: only re-apply on follow-up days (1, 3, 7 days overdue) and not same day
    if v_req.late_fee_recurring and v_req.late_fee_applied then
      if v_days_overdue not in (1, 3, 7) then continue; end if;
      -- Avoid applying twice on the same follow-up day by checking applied_count
      -- (applied_count tracks how many times fee has fired; compare to follow-up index)
      if v_req.late_fee_applied_count >= (
        case
          when v_days_overdue >= 7 then 3
          when v_days_overdue >= 3 then 2
          when v_days_overdue >= 1 then 1
          else 0
        end
      ) then continue; end if;
    end if;

    v_fee := round(v_req.base_amount * (v_req.late_fee_pct / 100.0), 2);

    update payment_requests
    set total_due              = total_due + v_fee,
        outstanding            = outstanding + v_fee,
        late_fee_applied       = true,
        late_fee_applied_count = late_fee_applied_count + 1,
        updated_at             = now()
    where id = v_req.id;

    insert into activity_log (business_id, type, description, amount, metadata)
    values (
      v_req.business_id,
      'late_fee',
      'Late fee of R' || v_fee || ' applied (' || v_req.late_fee_pct || '%) — ' ||
        case v_req.late_fee_recurring when true then 'recurring #' || (v_req.late_fee_applied_count + 1) else 'once' end,
      v_fee,
      json_build_object(
        'request_id',    v_req.id,
        'client_id',     v_req.client_id,
        'late_fee_pct',  v_req.late_fee_pct,
        'trigger',       v_req.late_fee_trigger,
        'days_overdue',  v_days_overdue,
        'recurring',     v_req.late_fee_recurring
      )::jsonb
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
