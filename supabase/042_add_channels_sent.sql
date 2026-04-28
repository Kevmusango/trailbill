-- 042_add_channels_sent.sql
-- Track which channels were actually delivered per request
-- (distinct from notification_channels which stores what was requested)
-- Format: "+" separated channel names e.g. "email", "whatsapp", "email+whatsapp", "email+whatsapp+sms"

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS channels_sent text;
