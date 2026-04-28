-- Business-level billing categories (applies to all payment requests, groups and individuals)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS billing_categories text[] NOT NULL DEFAULT '{}';
