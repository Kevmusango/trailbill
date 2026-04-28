-- ============================================================
-- TrailBill v2 — Complete Database Schema
-- Payment tracking & cash flow prediction system
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. LEADS — Interest form submissions
-- ============================================================
create table leads (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  business_name text,
  email text not null,
  phone text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. PROFILES — Auth users (created on signup/conversion)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'business' check (role in ('admin', 'business')),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. BUSINESSES — Business accounts
-- ============================================================
create table businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete set null unique,
  name text not null,
  phone text,
  email text,
  -- Banking details
  bank_name text,
  account_number text,
  branch_code text,
  account_type text default 'cheque' check (account_type in ('cheque', 'savings', 'transmission')),
  -- Defaults for payment terms
  default_due_days int not null default 7,
  default_grace_days int not null default 0,
  default_late_fee_pct numeric(5,2) not null default 0,
  -- Subscription
  subscription_start timestamptz,
  subscription_days int not null default 30,
  -- Status
  status text not null default 'active' check (status in ('active', 'inactive')),
  onboarding_completed boolean not null default false,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. CLIENTS — People/companies that owe money
-- ============================================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  -- Balance tracking
  running_balance numeric(12,2) not null default 0, -- positive = owes, negative = credit
  -- Reliability metrics
  reliability_score numeric(3,1) not null default 5.0 check (reliability_score >= 0 and reliability_score <= 5),
  average_days_to_pay int not null default 0,
  on_time_rate numeric(5,1) not null default 100,
  total_paid numeric(12,2) not null default 0,
  total_requests int not null default 0,
  status text not null default 'good' check (status in ('excellent', 'good', 'warning', 'at-risk')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_business on clients(business_id);

-- ============================================================
-- 5. CLIENT_GROUPS — Groups = Contracts
-- ============================================================
create table client_groups (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  description text,
  -- Contract terms
  default_amount numeric(12,2) not null,
  due_day int not null check (due_day >= 1 and due_day <= 28),
  contract_start_month date, -- first day of start month, e.g., 2026-01-01
  contract_duration_months int not null default 12,
  active_months int[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}', -- month numbers that are active
  -- Payment terms
  grace_days int not null default 0,
  late_fee_pct numeric(5,2) not null default 0,
  -- Message templates (variables: {client_name}, {amount}, {due_date}, {link}, {business_name})
  email_template text,
  whatsapp_template text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_groups_business on client_groups(business_id);

-- ============================================================
-- 6. GROUP_MEMBERSHIPS — Links clients to groups
-- ============================================================
create table group_memberships (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references client_groups(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  custom_amount numeric(12,2), -- null = use group default
  custom_note text, -- shows on their payment request
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(group_id, client_id)
);

create index idx_memberships_group on group_memberships(group_id);
create index idx_memberships_client on group_memberships(client_id);

-- ============================================================
-- 7. PAYMENT_BATCHES — One record per group request
-- ============================================================
create table payment_batches (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  group_id uuid not null references client_groups(id) on delete cascade,
  batch_number text not null unique,
  description text, -- e.g., "May 2026 Transport"
  month date not null, -- which month this batch covers (first of month)
  total_amount numeric(12,2) not null default 0,
  total_clients int not null default 0,
  scheduled_at timestamptz, -- null = sent immediately, otherwise scheduled for this time
  status text not null default 'sent' check (status in ('scheduled', 'sent', 'partial', 'completed')),
  created_at timestamptz not null default now()
);

create index idx_batches_business on payment_batches(business_id);
create index idx_batches_group on payment_batches(group_id);

-- ============================================================
-- 8. PAYMENT_REQUESTS — Individual request per client per batch
-- ============================================================
create table payment_requests (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references payment_batches(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  request_number text not null unique,
  public_token text not null unique, -- for /pay/[token]
  -- Amounts
  base_amount numeric(12,2) not null, -- the monthly charge
  previous_balance numeric(12,2) not null default 0, -- carried from last month
  total_due numeric(12,2) not null, -- base + previous_balance
  amount_paid numeric(12,2) not null default 0,
  outstanding numeric(12,2) not null, -- total_due - amount_paid
  -- Display
  description text,
  custom_note text, -- from group_membership
  -- Dates
  due_date date not null, -- original due date
  grace_end_date date, -- due_date + grace_days
  committed_date date, -- the date client committed to pay
  extra_days_requested int not null default 0,
  -- Late fee
  late_fee_pct numeric(5,2) not null default 0,
  -- Tracking
  link_opened_at timestamptz,
  pay_now_clicked_at timestamptz,
  committed_at timestamptz,
  -- Status
  status text not null default 'sent' check (status in ('scheduled', 'sent', 'opened', 'committed', 'partial', 'paid', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_requests_batch on payment_requests(batch_id);
create index idx_requests_business on payment_requests(business_id);
create index idx_requests_client on payment_requests(client_id);
create index idx_requests_token on payment_requests(public_token);
create index idx_requests_due_date on payment_requests(due_date);
create index idx_requests_status on payment_requests(status);

-- ============================================================
-- 9. PAYMENTS — Actual payment records (supports partial)
-- ============================================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references payment_requests(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null,
  method text check (method in ('eft', 'cash', 'card', 'other')),
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_payments_request on payments(request_id);
create index idx_payments_client on payments(client_id);

-- ============================================================
-- 10. ACTIVITY_LOG — Activity feed
-- ============================================================
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  type text not null check (type in ('payment', 'request', 'reminder', 'overdue', 'client', 'group', 'system')),
  description text not null,
  amount numeric(12,2),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_activity_business on activity_log(business_id);
create index idx_activity_created on activity_log(created_at desc);

-- ============================================================
-- 11. BEHAVIOR_FLAGS — Client reliability alerts
-- ============================================================
create table behavior_flags (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  flag_type text not null check (flag_type in ('needs_attention', 'watch', 'reliable', 'first_miss', 'improving')),
  message text not null,
  severity text not null default 'info' check (severity in ('critical', 'warning', 'info')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_flags_business on behavior_flags(business_id);
create index idx_flags_client on behavior_flags(client_id);

-- ============================================================
-- 12. REMINDER_LOG — Track sent reminders
-- ============================================================
create table reminder_log (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references payment_requests(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  reminder_type text not null check (reminder_type in ('before_due', 'due_today', 'follow_up_1', 'follow_up_2', 'escalation')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_reminders_request on reminder_log(request_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Generate batch number: TRB-2026-001
create or replace function generate_batch_number(p_business_id uuid)
returns text language plpgsql as $$
declare
  v_year text;
  v_seq int;
begin
  v_year := extract(year from now())::text;
  select coalesce(count(*), 0) + 1 into v_seq
  from payment_batches
  where business_id = p_business_id
    and extract(year from created_at) = extract(year from now());
  return 'TRB-' || v_year || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- Generate request number: TRB-2026-001-01
create or replace function generate_request_number(p_batch_number text, p_seq int)
returns text language sql as $$
  select p_batch_number || '-' || lpad(p_seq::text, 2, '0');
$$;

-- Generate public token (20 chars, URL-safe)
create or replace function generate_public_token()
returns text language sql as $$
  select replace(replace(encode(gen_random_bytes(15), 'base64'), '/', '_'), '+', '-');
$$;

-- Track link open
create or replace function track_link_open(p_token text)
returns void language plpgsql as $$
begin
  update payment_requests
  set link_opened_at = coalesce(link_opened_at, now()),
      status = case when status = 'sent' then 'opened' else status end,
      updated_at = now()
  where public_token = p_token;
end;
$$;

-- Record commitment (client asks for extra days)
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

  -- Calculate new due date
  if p_extra_days > 0 and v_request.grace_end_date is not null then
    v_new_due := least(v_request.due_date + p_extra_days, v_request.grace_end_date);
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

-- Record payment and update balances
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
  v_balance_change numeric;
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
  set amount_paid = v_new_amount_paid,
      outstanding = greatest(v_new_outstanding, 0),
      status = v_new_status,
      updated_at = now()
  where id = p_request_id;

  -- Update client running balance
  -- Balance decreases by the amount paid
  v_balance_change := p_amount;
  update clients
  set running_balance = running_balance - v_balance_change,
      total_paid = total_paid + p_amount,
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

-- Get client's previous balance (for creating new payment requests)
create or replace function get_client_previous_balance(p_client_id uuid)
returns numeric language sql stable as $$
  select coalesce(running_balance, 0) from clients where id = p_client_id;
$$;

-- ============================================================
-- AUTO-UPDATE TIMESTAMPS
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_leads_updated before update on leads for each row execute function update_updated_at();
create trigger trg_profiles_updated before update on profiles for each row execute function update_updated_at();
create trigger trg_businesses_updated before update on businesses for each row execute function update_updated_at();
create trigger trg_clients_updated before update on clients for each row execute function update_updated_at();
create trigger trg_groups_updated before update on client_groups for each row execute function update_updated_at();
create trigger trg_requests_updated before update on payment_requests for each row execute function update_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON AUTH SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'business')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: get current user's role
create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- Helper: get current user's business id
create or replace function auth_business_id()
returns uuid language sql stable security definer as $$
  select id from businesses where owner_id = auth.uid();
$$;

-- LEADS
alter table leads enable row level security;
create policy "Anyone can submit a lead" on leads for insert with check (true);
create policy "Admins can view all leads" on leads for select using (auth_role() = 'admin');
create policy "Admins can update leads" on leads for update using (auth_role() = 'admin');

-- PROFILES
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (id = auth.uid());
create policy "Admins can view all profiles" on profiles for select using (auth_role() = 'admin');
create policy "Users can update own profile" on profiles for update using (id = auth.uid());
create policy "Admins can manage profiles" on profiles for all using (auth_role() = 'admin');

-- BUSINESSES
alter table businesses enable row level security;
create policy "Owners can view own business" on businesses for select using (owner_id = auth.uid());
create policy "Owners can update own business" on businesses for update using (owner_id = auth.uid());
create policy "Admins can manage businesses" on businesses for all using (auth_role() = 'admin');

-- CLIENTS
alter table clients enable row level security;
create policy "Business owners can manage own clients" on clients for all using (business_id = auth_business_id());
create policy "Admins can view all clients" on clients for select using (auth_role() = 'admin');

-- CLIENT_GROUPS
alter table client_groups enable row level security;
create policy "Business owners can manage own groups" on client_groups for all using (business_id = auth_business_id());
create policy "Admins can view all groups" on client_groups for select using (auth_role() = 'admin');

-- GROUP_MEMBERSHIPS
alter table group_memberships enable row level security;
create policy "Business owners can manage own memberships" on group_memberships for all
  using (group_id in (select id from client_groups where business_id = auth_business_id()));
create policy "Admins can view all memberships" on group_memberships for select using (auth_role() = 'admin');

-- PAYMENT_BATCHES
alter table payment_batches enable row level security;
create policy "Business owners can manage own batches" on payment_batches for all using (business_id = auth_business_id());
create policy "Admins can view all batches" on payment_batches for select using (auth_role() = 'admin');

-- PAYMENT_REQUESTS
alter table payment_requests enable row level security;
create policy "Business owners can manage own requests" on payment_requests for all using (business_id = auth_business_id());
create policy "Public can view by token" on payment_requests for select using (true); -- filtered by token in app
create policy "Public can update commitment" on payment_requests for update using (true); -- controlled by functions
create policy "Admins can view all requests" on payment_requests for select using (auth_role() = 'admin');

-- PAYMENTS
alter table payments enable row level security;
create policy "Business owners can manage own payments" on payments for all using (business_id = auth_business_id());
create policy "Admins can view all payments" on payments for select using (auth_role() = 'admin');

-- ACTIVITY_LOG
alter table activity_log enable row level security;
create policy "Business owners can view own activity" on activity_log for select using (business_id = auth_business_id());
create policy "Business owners can insert activity" on activity_log for insert with check (business_id = auth_business_id());
create policy "Admins can view all activity" on activity_log for select using (auth_role() = 'admin');

-- BEHAVIOR_FLAGS
alter table behavior_flags enable row level security;
create policy "Business owners can manage own flags" on behavior_flags for all using (business_id = auth_business_id());
create policy "Admins can view all flags" on behavior_flags for select using (auth_role() = 'admin');

-- REMINDER_LOG
alter table reminder_log enable row level security;
create policy "Business owners can view own reminders" on reminder_log for select
  using (client_id in (select id from clients where business_id = auth_business_id()));
create policy "Admins can view all reminders" on reminder_log for select using (auth_role() = 'admin');
