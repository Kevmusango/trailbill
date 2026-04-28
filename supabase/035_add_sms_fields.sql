-- 035_add_sms_fields.sql
-- Add SMS number to businesses (for owner notifications) and clients

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sms_number TEXT;
ALTER TABLE clients    ADD COLUMN IF NOT EXISTS sms_number TEXT;
