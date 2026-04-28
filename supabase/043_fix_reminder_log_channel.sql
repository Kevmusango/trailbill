-- 043_fix_reminder_log_channel.sql
-- The original 001 schema only allowed ('email', 'whatsapp') for reminder_log.channel.
-- SMS was added as a notification channel but the constraint was never updated.

ALTER TABLE reminder_log
  DROP CONSTRAINT IF EXISTS reminder_log_channel_check;

ALTER TABLE reminder_log
  ADD CONSTRAINT reminder_log_channel_check
  CHECK (channel IN ('email', 'whatsapp', 'sms'));
