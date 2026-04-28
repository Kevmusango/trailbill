-- ============================================================
-- Migration 006: Remove running_balance sync from record_payment
-- Balance is now always computed from payment_requests history
-- (sum of amount_paid - total_due per client), which is the
-- single source of truth used by the UI and all API routes.
-- ============================================================

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
  v_request payment_requests%rowtype;
  v_new_amount_paid numeric;
  v_new_outstanding numeric;
  v_new_status text;
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

  -- Update client stats (total_paid only — balance is derived from payment_requests)
  update clients
  set total_paid = total_paid + p_amount,
      updated_at = now()
  where id = v_request.client_id;

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
