-- ============================================================
-- Migration 007: Live reliability scoring
--
-- Adds recalculate_client_reliability() helper that computes
-- reliability_score (0-5) and status from actual payment history,
-- then wires it into record_payment so scores update automatically.
--
-- Scoring formula:
--   pay_rate       = sum(amount_paid) / sum(base_amount)   → did they pay in full?
--   cleared_rate   = count(status='paid') / count(*)        → did requests get closed?
--   score          = (pay_rate * 3) + (cleared_rate * 2)    → 0–5
--
-- Status thresholds:
--   >= 4.5  excellent
--   >= 3.5  good
--   >= 2.0  warning
--   <  2.0  at-risk
-- ============================================================


-- ── 1. Helper: recalculate one client ────────────────────────────────────────

create or replace function recalculate_client_reliability(p_client_id uuid)
returns void language plpgsql as $$
declare
  v_total_billed   numeric;
  v_total_paid     numeric;
  v_total_requests int;
  v_paid_requests  int;
  v_pay_rate       numeric;
  v_cleared_rate   numeric;
  v_score          numeric;
  v_status         text;
begin
  select
    coalesce(sum(base_amount), 0),
    coalesce(sum(amount_paid), 0),
    count(*),
    count(*) filter (where status = 'paid')
  into v_total_billed, v_total_paid, v_total_requests, v_paid_requests
  from payment_requests
  where client_id = p_client_id;

  -- Not enough data yet — leave defaults
  if v_total_requests = 0 or v_total_billed = 0 then
    return;
  end if;

  v_pay_rate     := least(v_total_paid / v_total_billed, 1.0);
  v_cleared_rate := v_paid_requests::numeric / v_total_requests;
  v_score        := round((v_pay_rate * 3 + v_cleared_rate * 2)::numeric, 1);

  v_status := case
    when v_score >= 4.5 then 'excellent'
    when v_score >= 3.5 then 'good'
    when v_score >= 2.0 then 'warning'
    else 'at-risk'
  end;

  update clients
  set reliability_score = v_score,
      status            = v_status,
      updated_at        = now()
  where id = p_client_id;
end;
$$;


-- ── 2. Updated record_payment — calls reliability recalc after each payment ──

create or replace function record_payment(
  p_request_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method text,
  p_reference text default null,
  p_notes text default null
)
returns json language plpgsql as $$
declare
  v_request         payment_requests%rowtype;
  v_new_amount_paid numeric;
  v_new_outstanding numeric;
  v_new_status      text;
begin
  select * into v_request from payment_requests where id = p_request_id;

  if v_request is null then
    return json_build_object('success', false, 'error', 'Request not found');
  end if;

  -- Insert payment record
  insert into payments (request_id, business_id, client_id, amount, payment_date, method, reference, notes)
  values (p_request_id, v_request.business_id, v_request.client_id, p_amount, p_payment_date, p_method, p_reference, p_notes);

  -- Update request totals
  v_new_amount_paid := v_request.amount_paid + p_amount;
  v_new_outstanding := v_request.total_due - v_new_amount_paid;

  if v_new_outstanding <= 0 then
    v_new_status := 'paid';
  elsif v_new_amount_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := v_request.status;
  end if;

  update payment_requests
  set amount_paid  = v_new_amount_paid,
      outstanding  = greatest(v_new_outstanding, 0),
      status       = v_new_status,
      updated_at   = now()
  where id = p_request_id;

  -- Update client stats and recalculate reliability
  update clients
  set total_paid = total_paid + p_amount,
      updated_at = now()
  where id = v_request.client_id;

  perform recalculate_client_reliability(v_request.client_id);

  -- Log activity
  insert into activity_log (business_id, type, description, amount, metadata)
  values (
    v_request.business_id,
    'payment',
    'Payment of R' || p_amount || ' received',
    p_amount,
    json_build_object('request_id', p_request_id, 'client_id', v_request.client_id, 'method', p_method)::jsonb
  );

  return json_build_object(
    'success', true,
    'new_status', v_new_status,
    'amount_paid', v_new_amount_paid,
    'outstanding', greatest(v_new_outstanding, 0)
  );
end;
$$;


-- ── 3. Backfill: recalculate all existing clients ────────────────────────────

create or replace function backfill_reliability()
returns int language plpgsql as $$
declare
  v_client record;
  v_count  int := 0;
begin
  for v_client in select id from clients where is_active = true loop
    perform recalculate_client_reliability(v_client.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Run backfill immediately so existing clients get accurate scores now
select backfill_reliability();
