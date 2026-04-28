-- 044_fix_credits_for_channel.sql
-- Add missing composite channel entries to credits_for_channel().
-- 'email+sms'      = email(1) + sms(2)     = 3
-- 'whatsapp+sms'   = whatsapp(2) + sms(2)  = 4
-- 'all'            = email(1) + wa(2) + sms(2) = 5  (already present but included for completeness)

CREATE OR REPLACE FUNCTION credits_for_channel(channel text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE channel
    WHEN 'email'         THEN 1
    WHEN 'whatsapp'      THEN 2
    WHEN 'sms'           THEN 2
    WHEN 'both'          THEN 3   -- legacy: email + whatsapp
    WHEN 'email+sms'     THEN 3   -- email(1) + sms(2)
    WHEN 'whatsapp+sms'  THEN 4   -- whatsapp(2) + sms(2)
    WHEN 'all'           THEN 5   -- email(1) + whatsapp(2) + sms(2)
    ELSE 1
  END;
$$;
