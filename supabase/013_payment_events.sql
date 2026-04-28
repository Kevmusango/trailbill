-- ============================================================
-- Migration 013: payment_events — behavioural intelligence layer
--
-- Every touch point between TrailBill and a client is logged here.
-- This is the single source of truth for answering:
--   - Which reminder type triggered payment?
--   - Which channel (email vs WhatsApp) gets faster results?
--   - How long between a reminder and payment?
--   - Did the client visit the page but not pay?
--
-- event_type values:
--   reminder_sent       — a reminder was dispatched (email or WhatsApp)
--   email_opened        — Resend open webhook received
--   whatsapp_delivered  — Twilio delivered webhook received
--   whatsapp_read       — Twilio read webhook received
--   link_visited        — client hit /pay/[token]
--   pay_now_clicked     — client clicked Pay Now (banking details revealed)
--   extra_days_requested — client submitted a commitment date
--   payment_recorded    — business owner marked as paid
--
-- days_relative_to_due:
--   negative = event happened before due date (e.g. -1 = day before)
--   0        = on the due date
--   positive = overdue (e.g. 3 = 3 days overdue)
-- ============================================================


create table if not exists payment_events (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null references businesses(id) on delete cascade,
  request_id          uuid not null references payment_requests(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  event_type          text not null check (event_type in (
                        'reminder_sent',
                        'email_opened',
                        'whatsapp_delivered',
                        'whatsapp_read',
                        'link_visited',
                        'pay_now_clicked',
                        'extra_days_requested',
                        'payment_recorded'
                      )),
  channel             text check (channel is null or channel in ('email', 'whatsapp', 'system')),
  reminder_type       text check (reminder_type is null or reminder_type in (
                        '1_day_before', 'due_date',
                        '1_day_after', '3_days_after', '7_days_after'
                      )),
  days_relative_to_due int,     -- computed on insert from due_date
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create index if not exists idx_payment_events_business  on payment_events(business_id);
create index if not exists idx_payment_events_request   on payment_events(request_id);
create index if not exists idx_payment_events_client    on payment_events(client_id);
create index if not exists idx_payment_events_type      on payment_events(event_type);
create index if not exists idx_payment_events_created   on payment_events(created_at desc);


-- ── RLS ──────────────────────────────────────────────────────

alter table payment_events enable row level security;

create policy "Business owners can view own payment events"
  on payment_events for select
  using (business_id = auth_business_id());

create policy "Business owners can insert own payment events"
  on payment_events for insert
  with check (business_id = auth_business_id());

create policy "Admins can view all payment events"
  on payment_events for select
  using (auth_role() = 'admin');


-- ── Helper: log_payment_event ─────────────────────────────────
-- Convenience function used by API routes to log any event.
-- Automatically computes days_relative_to_due from the request.

create or replace function log_payment_event(
  p_request_id   uuid,
  p_event_type   text,
  p_channel      text  default null,
  p_reminder_type text default null,
  p_metadata     jsonb default '{}'
)
returns void language plpgsql security definer as $$
declare
  v_req payment_requests%rowtype;
  v_days_relative int;
begin
  select * into v_req from payment_requests where id = p_request_id;
  if v_req is null then return; end if;

  v_days_relative := (current_date - v_req.due_date);

  insert into payment_events (
    business_id, request_id, client_id,
    event_type, channel, reminder_type,
    days_relative_to_due, metadata
  )
  values (
    v_req.business_id, p_request_id, v_req.client_id,
    p_event_type, p_channel, p_reminder_type,
    v_days_relative, p_metadata
  );
end;
$$;


-- ── Auto-update preferred_channel ────────────────────────────
-- After enough events accumulate, detect which channel the client
-- actually responds to and update preferred_channel on clients.
-- "Responds to" means: an email_opened or whatsapp_read event
-- was followed by a payment_recorded within 48 hours.

create or replace function update_preferred_channel(p_client_id uuid)
returns void language plpgsql as $$
declare
  v_email_responses    int;
  v_whatsapp_responses int;
  v_total              int;
  v_new_channel        text;
begin
  -- Count times an email open was followed by payment within 48h
  select count(*)
  into v_email_responses
  from payment_events e1
  where e1.client_id = p_client_id
    and e1.event_type = 'email_opened'
    and exists (
      select 1 from payment_events e2
      where e2.client_id = p_client_id
        and e2.request_id = e1.request_id
        and e2.event_type = 'payment_recorded'
        and e2.created_at between e1.created_at and e1.created_at + interval '48 hours'
    );

  -- Count times a whatsapp read was followed by payment within 48h
  select count(*)
  into v_whatsapp_responses
  from payment_events e1
  where e1.client_id = p_client_id
    and e1.event_type = 'whatsapp_read'
    and exists (
      select 1 from payment_events e2
      where e2.client_id = p_client_id
        and e2.request_id = e1.request_id
        and e2.event_type = 'payment_recorded'
        and e2.created_at between e1.created_at and e1.created_at + interval '48 hours'
    );

  v_total := v_email_responses + v_whatsapp_responses;

  -- Only update if we have enough signal (at least 3 responses total)
  if v_total < 3 then return; end if;

  v_new_channel := case
    when v_email_responses = 0                        then 'whatsapp'
    when v_whatsapp_responses = 0                     then 'email'
    when v_whatsapp_responses > v_email_responses * 2 then 'whatsapp'
    when v_email_responses > v_whatsapp_responses * 2 then 'email'
    else 'both'
  end;

  update clients
  set preferred_channel = v_new_channel,
      updated_at        = now()
  where id = p_client_id
    and preferred_channel != v_new_channel;
end;
$$;
