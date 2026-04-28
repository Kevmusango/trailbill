-- ============================================================
-- Migration 015: Wire payment_events into the payment flow
--
-- 1. Grant execute on log_payment_event to anon + authenticated
--    so the /pay/[token] page can log link_visited server-side
--    using the anon key (function is security definer, safe)
--
-- 2. Update record_payment to insert a payment_recorded event
--    directly — so every payment logged by a business owner
--    is automatically captured in payment_events without any
--    extra API calls
-- ============================================================


-- ── 1. Grant execute ─────────────────────────────────────────

grant execute on function log_payment_event(uuid, text, text, text, jsonb)
  to anon, authenticated;


-- ── 2. record_payment — add payment_recorded event ───────────
-- Final canonical version. Adds one insert into payment_events
-- at the end of the transaction, using data already in scope.

create or replace function record_payment(
  p_request_id   uuid,
  p_amount       numeric,
  p_payment_date date,
  p_method       text,
  p_reference    text default null,
  p_notes        text default null
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

  insert into payments (request_id, business_id, client_id, amount, payment_date, method, reference, notes)
  values (p_request_id, v_request.business_id, v_request.client_id,
          p_amount, p_payment_date, p_method, p_reference, p_notes);

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
  set amount_paid = v_new_amount_paid,
      outstanding = greatest(v_new_outstanding, 0),
      status      = v_new_status,
      updated_at  = now()
  where id = p_request_id;

  update clients
  set total_paid = total_paid + p_amount,
      updated_at = now()
  where id = v_request.client_id;

  perform recalculate_client_reliability(v_request.client_id);
  perform update_inferred_payday(v_request.client_id);

  -- Log to activity feed
  insert into activity_log (business_id, type, description, amount, metadata)
  values (
    v_request.business_id, 'payment',
    'Payment of R' || p_amount || ' received',
    p_amount,
    json_build_object('request_id', p_request_id, 'client_id', v_request.client_id, 'method', p_method)::jsonb
  );

  -- Log to payment_events (behavioural intelligence)
  insert into payment_events (business_id, request_id, client_id, event_type, channel, days_relative_to_due, metadata)
  values (
    v_request.business_id, p_request_id, v_request.client_id,
    'payment_recorded', 'system',
    (p_payment_date - v_request.due_date),
    json_build_object('amount', p_amount, 'method', p_method)::jsonb
  );

  return json_build_object(
    'success',     true,
    'new_status',  v_new_status,
    'amount_paid', v_new_amount_paid,
    'outstanding', greatest(v_new_outstanding, 0)
  );
end;
$$;
