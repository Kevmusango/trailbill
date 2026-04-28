-- Migration 028: Persist WhatsApp provider delivery/read/failure status
-- Adds provider correlation fields on reminder_log used by webhook callbacks.

ALTER TABLE reminder_log
  ADD COLUMN IF NOT EXISTS provider_message_id text;

ALTER TABLE reminder_log
  ADD COLUMN IF NOT EXISTS provider_status text;

ALTER TABLE reminder_log
  ADD COLUMN IF NOT EXISTS provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reminder_log_provider_message
  ON reminder_log(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
