-- ============================================================
-- Migration 012: Client intelligence fields
--
-- clients:
--   client_type       — individual | sole_proprietor | business
--   province          — SA province (standardised list)
--   city              — free text
--   preferred_channel — email | whatsapp | both (auto-updated by behaviour)
--   inferred_payday_day  — day of month (1-31), computed from payment history
--   payday_confidence    — none | low | medium | high
--
-- businesses:
--   province, city    — location context for benchmarks
--
-- industry on businesses:
--   Add standardised check constraint. NULL is allowed (not yet set).
--
-- New function: update_inferred_payday(client_id)
--   Computes the modal payment day-of-month from payment history.
--   Called automatically inside record_payment after each payment.
-- ============================================================


-- ── 1. clients — new columns ──────────────────────────────────

alter table clients
  add column if not exists client_type text not null default 'individual'
    check (client_type in ('individual', 'sole_proprietor', 'business')),
  add column if not exists province text
    check (province is null or province in (
      'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
      'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape'
    )),
  add column if not exists city text,
  add column if not exists preferred_channel text not null default 'both'
    check (preferred_channel in ('email', 'whatsapp', 'both')),
  add column if not exists inferred_payday_day int
    check (inferred_payday_day is null or (inferred_payday_day >= 1 and inferred_payday_day <= 31)),
  add column if not exists payday_confidence text not null default 'none'
    check (payday_confidence in ('none', 'low', 'medium', 'high'));

create index if not exists idx_clients_type     on clients(client_type);
create index if not exists idx_clients_province on clients(province);


-- ── 2. businesses — location + standardised industry ─────────

alter table businesses
  add column if not exists province text
    check (province is null or province in (
      'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
      'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape'
    )),
  add column if not exists city text;

-- Standardise industry — NULL is allowed until the business sets it.
-- Any existing free-text value outside the list is reset to NULL
-- so the constraint can be added cleanly.
update businesses
  set industry = null
  where industry is not null
    and industry not in (
      'Education', 'Healthcare', 'Fitness & Wellness', 'Retail',
      'Professional Services', 'Transport & Logistics', 'Construction',
      'Non-Profit', 'Hospitality', 'Financial Services',
      'Agriculture', 'Technology', 'Other'
    );

alter table businesses
  drop constraint if exists businesses_industry_check;

alter table businesses
  add constraint businesses_industry_check
  check (industry is null or industry in (
    'Education', 'Healthcare', 'Fitness & Wellness', 'Retail',
    'Professional Services', 'Transport & Logistics', 'Construction',
    'Non-Profit', 'Hospitality', 'Financial Services',
    'Agriculture', 'Technology', 'Other'
  ));


-- ── 3. update_inferred_payday(client_id) ─────────────────────
-- Finds the most common day-of-month across all recorded payments
-- for this client and stores it as inferred_payday_day.
-- Confidence grows with the number of data points.

create or replace function update_inferred_payday(p_client_id uuid)
returns void language plpgsql as $$
declare
  v_payment_count int;
  v_modal_day     int;
  v_confidence    text;
begin
  select count(distinct pr.id)
  into v_payment_count
  from payment_requests pr
  join payments p on p.request_id = pr.id
  where pr.client_id = p_client_id
    and pr.status = 'paid';

  if v_payment_count < 1 then
    return;
  end if;

  -- Modal day-of-month across all payment dates for this client
  select extract(day from p.payment_date)::int
  into v_modal_day
  from payment_requests pr
  join payments p on p.request_id = pr.id
  where pr.client_id = p_client_id
    and pr.status = 'paid'
  group by extract(day from p.payment_date)::int
  order by count(*) desc
  limit 1;

  v_confidence := case
    when v_payment_count >= 6 then 'high'
    when v_payment_count >= 3 then 'medium'
    else 'low'
  end;

  update clients
  set inferred_payday_day = v_modal_day,
      payday_confidence   = v_confidence,
      updated_at          = now()
  where id = p_client_id;
end;
$$;


-- ── 4. Wire update_inferred_payday into record_payment ───────
-- Extends the version from migration 007 to also infer payday
-- after every payment is recorded.

create or replace function record_payment(
  p_request_id uuid,
  p_amount     numeric,
  p_payment_date date,
  p_method     text,
  p_reference  text default null,
  p_notes      text default null
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
  values (p_request_id, v_request.business_id, v_request.client_id, p_amount, p_payment_date, p_method, p_reference, p_notes);

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

  -- Recalculate reliability score, avg days to pay, on-time rate
  perform recalculate_client_reliability(v_request.client_id);

  -- Infer payday pattern from accumulated payment dates
  perform update_inferred_payday(v_request.client_id);

  insert into activity_log (business_id, type, description, amount, metadata)
  values (
    v_request.business_id,
    'payment',
    'Payment of R' || p_amount || ' received',
    p_amount,
    json_build_object(
      'request_id', p_request_id,
      'client_id',  v_request.client_id,
      'method',     p_method
    )::jsonb
  );

  return json_build_object(
    'success',      true,
    'new_status',   v_new_status,
    'amount_paid',  v_new_amount_paid,
    'outstanding',  greatest(v_new_outstanding, 0)
  );
end;
$$;
