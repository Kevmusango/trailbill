-- 047_drop_old_topup.sql
-- Drops the old topup_credits overload that included p_monthly parameter.
-- Keeps only the clean 3-arg version (p_business_id, p_credits, p_end_date).

DROP FUNCTION IF EXISTS public.topup_credits(uuid, int, int, date);
