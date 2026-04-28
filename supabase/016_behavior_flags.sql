-- ============================================================
-- Migration 016: Auto-generate behavior_flags
--
-- Rewrites recalculate_client_reliability to also insert
-- behavior_flags when meaningful thresholds are crossed.
--
-- Flag rules:
--   first_miss    — was excellent/good, now warning/at-risk
--                   (severity: warning) — created only ONCE per client
--   needs_attention — score < 2.0 (at-risk)
--                   (severity: critical) — created when no unread flag exists
--   watch         — score entered 2.0–3.5 range from above
--                   (severity: warning) — when no unread watch flag exists
--   reliable      — score entered >= 4.5 (excellent)
--                   (severity: info) — when no unread reliable flag exists
--   improving     — score increased by 0.5+ in this recalculation
--                   (severity: info) — max once per 30 days
--
-- Deduplication: flags are only created if there is no existing
-- UNREAD flag of the same type for that client, except for
-- first_miss which is limited to once ever.
-- ============================================================

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
  -- previous state (before recalculation)
  v_prev_score      numeric;
  v_prev_status     text;
  v_business_id     uuid;
begin
  -- Snapshot current state before recalculating
  select reliability_score, status, business_id
  into v_prev_score, v_prev_status, v_business_id
  from clients where id = p_client_id;

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

  -- Reliability score
  v_pay_rate     := least(v_total_paid / v_total_billed, 1.0);
  v_cleared_rate := v_paid_requests::numeric / v_total_requests;
  v_score        := round((v_pay_rate * 3 + v_cleared_rate * 2)::numeric, 1);

  v_status := case
    when v_score >= 4.5 then 'excellent'
    when v_score >= 3.5 then 'good'
    when v_score >= 2.0 then 'warning'
    else 'at-risk'
  end;

  -- average_days_to_pay
  select
    coalesce(round(avg(days_diff)::numeric, 0), 0)
  into v_avg_days
  from (
    select
      extract(day from (max(p.payment_date)::timestamptz - pr.due_date::timestamptz)) as days_diff
    from payment_requests pr
    join payments p on p.request_id = pr.id
    where pr.client_id = p_client_id and pr.status = 'paid'
    group by pr.id, pr.due_date
  ) pd;

  -- on_time_rate
  select
    coalesce(
      round(100.0 * count(*) filter (where last_payment_date <= due_date) / nullif(count(*), 0), 1),
      100.0
    )
  into v_on_time_rate
  from (
    select
      pr.due_date,
      max(p.payment_date) as last_payment_date
    from payment_requests pr
    join payments p on p.request_id = pr.id
    where pr.client_id = p_client_id and pr.status = 'paid'
    group by pr.id, pr.due_date
  ) pd;

  update clients
  set reliability_score   = v_score,
      status              = v_status,
      average_days_to_pay = greatest(coalesce(v_avg_days::int, 0), 0),
      on_time_rate        = coalesce(v_on_time_rate, 100.0),
      updated_at          = now()
  where id = p_client_id;

  -- ── Flag: first_miss ───────────────────────────────────────
  -- Only ever created once. Was good/excellent, now slipping.
  if v_prev_status in ('excellent', 'good') and v_status in ('warning', 'at-risk') then
    if not exists (
      select 1 from behavior_flags
      where client_id = p_client_id and flag_type = 'first_miss'
    ) then
      insert into behavior_flags (business_id, client_id, flag_type, message, severity)
      values (
        v_business_id, p_client_id, 'first_miss',
        'First payment issue detected — reliability score has dropped below Good',
        'warning'
      );
    end if;
  end if;

  -- ── Flag: needs_attention ──────────────────────────────────
  -- Score is at-risk (< 2.0). Suppress if unread flag already exists.
  if v_score < 2.0 then
    if not exists (
      select 1 from behavior_flags
      where client_id = p_client_id and flag_type = 'needs_attention' and is_read = false
    ) then
      insert into behavior_flags (business_id, client_id, flag_type, message, severity)
      values (
        v_business_id, p_client_id, 'needs_attention',
        'Reliability score is critically low — this client needs immediate attention',
        'critical'
      );
    end if;
  end if;

  -- ── Flag: watch ────────────────────────────────────────────
  -- Entered warning zone from good/excellent. Suppress if unread flag exists.
  if v_status = 'warning' and v_prev_status in ('excellent', 'good') then
    if not exists (
      select 1 from behavior_flags
      where client_id = p_client_id and flag_type = 'watch' and is_read = false
    ) then
      insert into behavior_flags (business_id, client_id, flag_type, message, severity)
      values (
        v_business_id, p_client_id, 'watch',
        'Payment reliability has dropped — keep an eye on this client',
        'warning'
      );
    end if;
  end if;

  -- ── Flag: reliable ─────────────────────────────────────────
  -- Entered excellent zone. Only notify once until flag is read.
  if v_status = 'excellent' and v_prev_status != 'excellent' then
    if not exists (
      select 1 from behavior_flags
      where client_id = p_client_id and flag_type = 'reliable' and is_read = false
    ) then
      insert into behavior_flags (business_id, client_id, flag_type, message, severity)
      values (
        v_business_id, p_client_id, 'reliable',
        'This client has reached Excellent reliability — consistent on-time payments',
        'info'
      );
    end if;
  end if;

  -- ── Flag: improving ────────────────────────────────────────
  -- Score increased by 0.5 or more. Max one per 30 days.
  if v_score >= v_prev_score + 0.5 and v_prev_status in ('at-risk', 'warning') then
    if not exists (
      select 1 from behavior_flags
      where client_id = p_client_id
        and flag_type = 'improving'
        and created_at > now() - interval '30 days'
    ) then
      insert into behavior_flags (business_id, client_id, flag_type, message, severity)
      values (
        v_business_id, p_client_id, 'improving',
        'Reliability is improving — score increased by ' ||
          round(v_score - v_prev_score, 1) || ' points',
        'info'
      );
    end if;
  end if;

end;
$$;


-- Backfill: run recalculate on all active clients so flags are
-- generated immediately for any clients already at risk
select backfill_reliability();
