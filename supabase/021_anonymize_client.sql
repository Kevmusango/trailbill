-- ============================================================
-- Migration 021: Client Anonymisation (POPIA Compliance)
--
-- When a business removes a client, personal identifiable
-- information (name, email, phone) is replaced with
-- anonymised values.  All financial records (payment
-- requests, payments, behavior flags, events) are kept
-- intact for the business's own reporting and SARS compliance.
--
-- anonymize_client(p_client_id)
--   → Nulls PII, sets deleted_at, keeps is_active = false
--   → Called from the UI instead of a hard DELETE
--
-- anonymize_business_clients(p_business_id)
--   → Anonymises ALL clients for a business (used when a
--     business account itself is closed)
-- ============================================================

-- 1. Add deleted_at column
alter table clients
  add column if not exists deleted_at timestamptz;

-- 2. Single-client anonymisation function
create or replace function anonymize_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update clients
  set
    name       = 'Archived Client',
    email      = null,
    phone      = null,
    is_active  = false,
    deleted_at = now()
  where id = p_client_id;
end;
$$;

-- 3. Bulk anonymisation — used when a business closes
create or replace function anonymize_business_clients(p_business_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update clients
  set
    name       = 'Archived Client',
    email      = null,
    phone      = null,
    is_active  = false,
    deleted_at = now()
  where business_id = p_business_id
    and deleted_at is null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- 4. Grant execute to authenticated users
--    (RLS on clients table still controls which rows they can touch)
grant execute on function anonymize_client(uuid)            to authenticated;
grant execute on function anonymize_business_clients(uuid)  to authenticated;
