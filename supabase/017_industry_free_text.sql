-- ============================================================
-- Migration 017: Allow free-text industry
--
-- The CHECK constraint added in 012 conflicts with:
--   1. Onboarding wizard tile values (school, gym, etc.)
--   2. "Other — type your own" UX pattern
--
-- Dropping the constraint allows any text. The 13 categories
-- remain as suggested options in the UI and are used for
-- analytics grouping in queries (CASE / ILIKE), not enforced
-- at the database level.
-- ============================================================

alter table businesses
  drop constraint if exists businesses_industry_check;
