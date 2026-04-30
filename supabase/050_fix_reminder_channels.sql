-- Migration 050: Fix reminder channel detection + update default send time
--
-- Issues fixed:
--   1. get_todays_reminders only recognized 'email', 'whatsapp', 'both'
--      — missed 'email+sms', 'whatsapp+sms', 'sms', 'all'
--   2. Added should_send_sms output column
--   3. Default reminder_send_time changed from 08:00 to 12:00

-- 1. Update default reminder_send_time to noon
ALTER TABLE businesses
  ALTER COLUMN reminder_send_time SET DEFAULT '12:00:00';

-- Update existing businesses still on the old default
UPDATE businesses
  SET reminder_send_time = '12:00:00'
  WHERE reminder_send_time = '08:00:00';

-- 2. Rewrite get_todays_reminders with full channel support
DROP FUNCTION IF EXISTS get_todays_reminders(uuid);

CREATE OR REPLACE FUNCTION get_todays_reminders(business_uuid uuid)
RETURNS TABLE (
  request_id           uuid,
  client_name          text,
  amount               numeric,
  due_date             date,
  reminder_type        text,
  should_send_email    boolean,
  should_send_whatsapp boolean,
  should_send_sms      boolean,
  already_sent         boolean
) AS $$
DECLARE
  today_sast date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  -- Auto-flag requests 4+ days past their effective due date
  UPDATE payment_requests pr
  SET needs_attention = true
  WHERE pr.business_id = business_uuid
    AND pr.status IN ('sent', 'opened', 'scheduled', 'committed', 'partial', 'overdue')
    AND pr.outstanding > 0
    AND COALESCE(pr.committed_date, pr.due_date) <= today_sast - 4;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      pr.id,
      c.name                                          AS client_name,
      pr.total_due,
      pr.due_date,
      pr.notification_channels,
      COALESCE(pr.committed_date, pr.due_date)        AS eff_due
    FROM payment_requests pr
    JOIN clients c ON pr.client_id = c.id
    WHERE pr.business_id = business_uuid
      AND pr.status IN ('sent', 'opened', 'scheduled', 'committed', 'partial', 'overdue')
      AND pr.outstanding > 0
  ),
  with_type AS (
    SELECT
      e.*,
      CASE
        WHEN e.eff_due = today_sast + 1              THEN '1_day_before'
        WHEN e.eff_due = today_sast                  THEN 'due_date'
        WHEN e.eff_due = today_sast - 1              THEN '1_day_after'
        WHEN e.eff_due = today_sast - 3              THEN '3_days_after'
        WHEN e.eff_due = today_sast - 7              THEN '7_days_after'
      END AS rtype
    FROM eligible e
  )
  SELECT
    wt.id                                               AS request_id,
    wt.client_name,
    wt.total_due                                        AS amount,
    wt.due_date,
    wt.rtype                                            AS reminder_type,
    (wt.notification_channels IN ('email', 'both', 'email+sms', 'all'))      AS should_send_email,
    (wt.notification_channels IN ('whatsapp', 'both', 'whatsapp+sms', 'all')) AS should_send_whatsapp,
    (wt.notification_channels IN ('sms', 'email+sms', 'whatsapp+sms', 'all')) AS should_send_sms,
    EXISTS(
      SELECT 1 FROM reminder_log rl
      WHERE rl.request_id = wt.id
        AND rl.reminder_type = wt.rtype
        AND rl.sent_at::date = today_sast
    )                                                   AS already_sent
  FROM with_type wt
  WHERE wt.rtype IS NOT NULL
  ORDER BY wt.due_date ASC, wt.client_name ASC;
END;
$$ LANGUAGE plpgsql;
