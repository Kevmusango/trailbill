-- Add billing_categories to client_groups
-- This allows businesses to define what they bill for (e.g. Rent, Parking, Maintenance)
-- Used to populate the "What is this payment for?" dropdown on the send page

ALTER TABLE client_groups
  ADD COLUMN IF NOT EXISTS billing_categories text[] NOT NULL DEFAULT '{}';
