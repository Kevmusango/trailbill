-- ============================================================
-- Migration 018: Industry Benchmarks
--
-- POPIA compliance:
--   - Only expose aggregates where business_count >= 5
--   - RLS enforces this at the DB level as a second guard
--   - No individual business data is ever surfaced
--   - Businesses consent at signup via ToS
--
-- normalize_industry() maps onboarding tile values (school,
-- gym, etc.) and free-text entries to the 13 standard
-- categories used in the UI, so benchmarks are coherent
-- regardless of how industry was entered.
-- ============================================================

-- ── 1. Normalisation helper ──────────────────────────────────
create or replace function normalize_industry(raw text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(raw, '')))
    when 'school'           then 'Education'
    when 'daycare'          then 'Education'
    when 'studio'           then 'Education'
    when 'education'        then 'Education'
    when 'hoa'              then 'Professional Services'
    when 'property'         then 'Professional Services'
    when 'security'         then 'Professional Services'
    when 'cleaning'         then 'Professional Services'
    when 'garden'           then 'Professional Services'
    when 'professional services' then 'Professional Services'
    when 'storage'          then 'Other'
    when 'gym'              then 'Fitness & Wellness'
    when 'fitness & wellness' then 'Fitness & Wellness'
    when 'medical'          then 'Healthcare'
    when 'healthcare'       then 'Healthcare'
    when 'it'               then 'Technology'
    when 'technology'       then 'Technology'
    when 'stokvel'          then 'Financial Services'
    when 'insurance'        then 'Financial Services'
    when 'financial services' then 'Financial Services'
    when 'retail'           then 'Retail'
    when 'transport & logistics' then 'Transport & Logistics'
    when 'construction'     then 'Construction'
    when 'non-profit'       then 'Non-Profit'
    when 'hospitality'      then 'Hospitality'
    when 'agriculture'      then 'Agriculture'
    when 'other'            then 'Other'
    when ''                 then null
    else initcap(trim(raw))
  end
$$;

-- ── 2. Benchmarks table ──────────────────────────────────────
create table if not exists industry_benchmarks (
  industry              text        primary key,
  business_count        integer     not null default 0,
  avg_collection_rate   numeric(5,2),   -- 0–100 %
  avg_days_to_pay       numeric(5,1),
  avg_reliability_score numeric(3,2),   -- 0–5
  pct_clients_on_time   numeric(5,2),   -- 0–100 %
  updated_at            timestamptz default now()
);

-- RLS: authenticated users can read rows where count >= 5
alter table industry_benchmarks enable row level security;

create policy "Benchmarks readable when anonymised"
  on industry_benchmarks for select
  to authenticated
  using (business_count >= 5);

-- ── 3. Refresh function ──────────────────────────────────────
create or replace function refresh_industry_benchmarks()
returns void
language plpgsql
security definer
as $$
begin

  -- Compute per-business stats then aggregate by normalised industry.
  -- Only businesses that have completed onboarding are included.
  -- Only industries with >= 5 businesses are written (POPIA threshold).

  insert into industry_benchmarks (
    industry,
    business_count,
    avg_collection_rate,
    avg_days_to_pay,
    avg_reliability_score,
    pct_clients_on_time,
    updated_at
  )
  select
    normalize_industry(b.industry)                          as industry,
    count(distinct b.id)                                    as business_count,

    -- Average collection rate across businesses
    round(avg(biz.collection_rate)::numeric, 2)             as avg_collection_rate,

    -- Average days to pay across businesses (via their clients)
    round(avg(biz.avg_days_to_pay)::numeric, 1)             as avg_days_to_pay,

    -- Average reliability score across businesses (via their clients)
    round(avg(biz.avg_reliability_score)::numeric, 2)       as avg_reliability_score,

    -- % clients paying on time (reliability_score >= 4)
    round(avg(biz.pct_on_time)::numeric, 2)                 as pct_clients_on_time,

    now()

  from businesses b
  join (
    -- Per-business aggregates
    select
      b2.id as business_id,

      -- Collection rate for this business
      case
        when coalesce(sum(pr.total_due), 0) > 0
          then round(
            coalesce(sum(pr.amount_paid), 0)::numeric
            / sum(pr.total_due)::numeric * 100, 2
          )
        else 0
      end as collection_rate,

      -- Avg days to pay from their clients
      coalesce(avg(c.average_days_to_pay), 0) as avg_days_to_pay,

      -- Avg reliability score from their clients
      coalesce(avg(c.reliability_score), 0) as avg_reliability_score,

      -- % of clients with score >= 4
      case
        when count(c.id) > 0
          then round(
            count(c.id) filter (where c.reliability_score >= 4)::numeric
            / count(c.id)::numeric * 100, 2
          )
        else 0
      end as pct_on_time

    from businesses b2
    left join clients         c  on c.business_id  = b2.id and c.is_active = true
    left join payment_requests pr on pr.business_id = b2.id
    where b2.onboarding_completed = true
      and b2.industry is not null
      and b2.industry <> ''
    group by b2.id
  ) biz on biz.business_id = b.id

  where b.onboarding_completed = true
    and b.industry is not null
    and b.industry <> ''
    and normalize_industry(b.industry) is not null

  group by normalize_industry(b.industry)
  having count(distinct b.id) >= 5   -- POPIA: never expose < 5

  on conflict (industry) do update set
    business_count        = excluded.business_count,
    avg_collection_rate   = excluded.avg_collection_rate,
    avg_days_to_pay       = excluded.avg_days_to_pay,
    avg_reliability_score = excluded.avg_reliability_score,
    pct_clients_on_time   = excluded.pct_clients_on_time,
    updated_at            = excluded.updated_at;

  -- Remove industries that no longer qualify
  delete from industry_benchmarks
  where business_count < 5;

end;
$$;

-- Only the service role (cron) can call this
grant execute on function refresh_industry_benchmarks() to service_role;
grant execute on function normalize_industry(text)      to authenticated, service_role;
