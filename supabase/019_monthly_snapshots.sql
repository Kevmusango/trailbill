-- ============================================================
-- Migration 019: Business Monthly Snapshots
--
-- Records a point-in-time summary of each business's
-- performance at the close of every month.  This is the
-- data source for trend charts, predictive scoring, and
-- future anomaly detection.
--
-- snapshot_month()     — upserts one business × month
-- snapshot_all_month() — called by cron on the 1st at 01:00
-- ============================================================

create table if not exists business_monthly_snapshots (
  id               uuid        primary key default gen_random_uuid(),
  business_id      uuid        not null references businesses(id) on delete cascade,
  year             integer     not null,
  month            integer     not null check (month between 1 and 12),
  expected         numeric(12,2) not null default 0,
  collected        numeric(12,2) not null default 0,
  outstanding      numeric(12,2) not null default 0,
  collection_rate  numeric(5,2) not null default 0,  -- 0–100
  paid_count       integer     not null default 0,
  total_count      integer     not null default 0,
  avg_days_to_pay  numeric(5,1),
  new_clients      integer     not null default 0,
  created_at       timestamptz default now(),
  unique (business_id, year, month)
);

alter table business_monthly_snapshots enable row level security;

create policy "Business owners read own snapshots"
  on business_monthly_snapshots for select
  to authenticated
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- ── Snapshot one business × month ───────────────────────────
create or replace function snapshot_month(
  p_business_id uuid,
  p_year        integer,
  p_month       integer
)
returns void
language plpgsql
security definer
as $$
declare
  v_expected        numeric := 0;
  v_collected       numeric := 0;
  v_outstanding     numeric := 0;
  v_collection_rate numeric := 0;
  v_paid_count      integer := 0;
  v_total_count     integer := 0;
  v_avg_days        numeric;
  v_new_clients     integer := 0;
begin

  -- Payment request aggregates for the target month
  select
    coalesce(sum(total_due), 0),
    coalesce(sum(amount_paid), 0),
    coalesce(sum(outstanding), 0),
    count(*),
    count(*) filter (where status = 'paid')
  into v_expected, v_collected, v_outstanding, v_total_count, v_paid_count
  from payment_requests
  where business_id = p_business_id
    and extract(year  from due_date) = p_year
    and extract(month from due_date) = p_month;

  if v_expected > 0 then
    v_collection_rate := round(v_collected / v_expected * 100, 2);
  end if;

  -- Average days to pay from payment_events (link_visited → payment_recorded)
  select round(avg(
    extract(epoch from (paid.created_at - visited.created_at)) / 86400
  ), 1)
  into v_avg_days
  from payment_events visited
  join payment_events paid
    on paid.client_id     = visited.client_id
   and paid.business_id   = visited.business_id
   and paid.event_type    = 'payment_recorded'
   and paid.created_at    > visited.created_at
  where visited.business_id  = p_business_id
    and visited.event_type   = 'link_visited'
    and extract(year  from paid.created_at) = p_year
    and extract(month from paid.created_at) = p_month;

  -- New clients added this month
  select count(*)
  into v_new_clients
  from clients
  where business_id  = p_business_id
    and extract(year  from created_at) = p_year
    and extract(month from created_at) = p_month;

  insert into business_monthly_snapshots (
    business_id, year, month,
    expected, collected, outstanding,
    collection_rate, paid_count, total_count,
    avg_days_to_pay, new_clients
  ) values (
    p_business_id, p_year, p_month,
    v_expected, v_collected, v_outstanding,
    v_collection_rate, v_paid_count, v_total_count,
    v_avg_days, v_new_clients
  )
  on conflict (business_id, year, month) do update set
    expected        = excluded.expected,
    collected       = excluded.collected,
    outstanding     = excluded.outstanding,
    collection_rate = excluded.collection_rate,
    paid_count      = excluded.paid_count,
    total_count     = excluded.total_count,
    avg_days_to_pay = excluded.avg_days_to_pay,
    new_clients     = excluded.new_clients;

end;
$$;

-- ── Snapshot all businesses for a given month ────────────────
create or replace function snapshot_all_month(
  p_year  integer default extract(year  from now() - interval '1 month')::integer,
  p_month integer default extract(month from now() - interval '1 month')::integer
)
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select id from businesses where onboarding_completed = true
  loop
    perform snapshot_month(r.id, p_year, p_month);
  end loop;
end;
$$;

grant execute on function snapshot_month(uuid, integer, integer) to service_role;
grant execute on function snapshot_all_month(integer, integer)   to service_role;
