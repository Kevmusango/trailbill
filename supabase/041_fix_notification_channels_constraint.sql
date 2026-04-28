-- 041_fix_notification_channels_constraint.sql
-- The original 002 migration only allowed ('email','whatsapp','both').
-- SMS was added later (039) but the CHECK constraints were never updated.
-- This migration widens the allowed values on both tables.

-- payment_batches
ALTER TABLE payment_batches
  DROP CONSTRAINT IF EXISTS payment_batches_notification_channels_check;

ALTER TABLE payment_batches
  ADD CONSTRAINT payment_batches_notification_channels_check
  CHECK (notification_channels IN ('email', 'whatsapp', 'sms', 'both', 'email+sms', 'whatsapp+sms', 'all'));

-- payment_requests
ALTER TABLE payment_requests
  DROP CONSTRAINT IF EXISTS payment_requests_notification_channels_check;

ALTER TABLE payment_requests
  ADD CONSTRAINT payment_requests_notification_channels_check
  CHECK (notification_channels IN ('email', 'whatsapp', 'sms', 'both', 'email+sms', 'whatsapp+sms', 'all'));
