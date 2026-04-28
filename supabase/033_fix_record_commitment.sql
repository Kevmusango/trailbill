create or replace function record_commitment(p_token text, p_extra_days int)
returns json language plpgsql as $$
declare
  v_request payment_requests%rowtype;
  v_new_due date;
begin
  select * into v_request from payment_requests where public_token = p_token;

  if v_request is null then
    return json_build_object('success', false, 'error', 'Request not found');
  end if;

  if v_request.committed_at is not null then
    return json_build_object('success', false, 'error', 'Already committed');
  end if;

  -- Calculate new due date, capping at final_due_date (or grace_end_date if no late fee period)
  if p_extra_days > 0 then
    v_new_due := v_request.due_date + p_extra_days;
    if v_request.final_due_date is not null then
      v_new_due := least(v_new_due, v_request.final_due_date);
    elsif v_request.grace_end_date is not null then
      v_new_due := least(v_new_due, v_request.grace_end_date);
    end if;
  else
    v_new_due := v_request.due_date;
  end if;

  update payment_requests
  set committed_date = v_new_due,
      extra_days_requested = p_extra_days,
      committed_at = now(),
      status = 'committed',
      updated_at = now()
  where id = v_request.id;

  return json_build_object(
    'success', true,
    'committed_date', v_new_due,
    'extra_days', p_extra_days
  );
end;
$$;
