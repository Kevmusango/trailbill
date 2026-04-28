-- Migration 009: Remove restrictive account_type check constraint
-- account_type is now free-text to allow custom types (e.g. "bond", "investment")

alter table businesses
  drop constraint if exists businesses_account_type_check;
