-- Migration 032: Store the exact amount the client accepted when committing to a payment date
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS committed_amount numeric;
