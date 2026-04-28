-- 039_notification_channels.sql
-- Add per-business channel preference toggles and SMS credit pricing
--
-- Owner toggles which channels they want active.
-- Credits: email = 1, whatsapp = 2, sms = 2

-- ============================================================
-- 1. CHANNEL PREFERENCE COLUMNS ON BUSINESSES
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS email_notifications    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_notifications      boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. UPDATE credits_for_channel TO INCLUDE SMS
-- ============================================================

CREATE OR REPLACE FUNCTION credits_for_channel(channel text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE channel
    WHEN 'email'    THEN 1
    WHEN 'whatsapp' THEN 2
    WHEN 'sms'      THEN 2
    WHEN 'both'     THEN 3   -- legacy: email + whatsapp
    WHEN 'all'      THEN 5   -- email(1) + whatsapp(2) + sms(2)
    ELSE 1
  END;
$$;
