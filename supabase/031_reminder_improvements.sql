-- Migration 031: Reminder system improvements
--
-- Changes:
--   1. Add needs_attention flag — auto-set when a payment is 4+ days past its effective due date
--   2. Rewrite get_todays_reminders to:
--      a. Use committed_date as the effective due date (falls back to due_date)
--      b. Auto-set needs_attention during each cron run

-- 1. Add needs_attention flag
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS needs_attention boolean NOT NULL DEFAULT false;

-- 2. Rewrite get_todays_reminders
DROP FUNCTION IF EXISTS get_todays_reminders(uuid);

CREATE OR REPLACE FUNCTION get_todays_reminders(business_uuid uuid)
RETURNS TABLE (
  request_id        uuid,
  client_name       text,
  amount            numeric,
  due_date          date,
  reminder_type     text,
  should_send_email boolean,
  should_send_whatsapp boolean,
  already_sent      boolean
) AS $$
DECLARE
  today_sast date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  -- Auto-flag requests 4+ days past their effective due date (committed_date takes priority)
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
    (wt.notification_channels IN ('email', 'both'))     AS should_send_email,
    (wt.notification_channels IN ('whatsapp', 'both'))  AS should_send_whatsapp,
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
