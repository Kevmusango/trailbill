-- Migration: Add description to get_todays_reminders()
-- Joins payment_batches to surface the batch description in the reminder feed.
-- Run this in the Supabase SQL editor.

DROP FUNCTION IF EXISTS get_todays_reminders(uuid);

CREATE OR REPLACE FUNCTION get_todays_reminders(business_uuid uuid)
RETURNS TABLE (
  request_id uuid,
  client_name text,
  amount numeric,
  due_date date,
  reminder_type text,
  should_send_email boolean,
  should_send_whatsapp boolean,
  already_sent boolean,
  description text
) AS $$
DECLARE
  today_sast date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  RETURN QUERY
  SELECT
    pr.id as request_id,
    c.name as client_name,
    pr.total_due as amount,
    pr.due_date,
    CASE
      WHEN pr.due_date = today_sast + interval '1 day' THEN '1_day_before'
      WHEN pr.due_date = today_sast THEN 'due_date'
      WHEN pr.due_date = today_sast - interval '1 day' THEN '1_day_after'
      WHEN pr.due_date = today_sast - interval '3 days' THEN '3_days_after'
      WHEN pr.due_date = today_sast - interval '7 days' THEN '7_days_after'
    END as reminder_type,
    (pr.notification_channels IN ('email', 'both')) as should_send_email,
    (pr.notification_channels IN ('whatsapp', 'both')) as should_send_whatsapp,
    EXISTS(
      SELECT 1 FROM reminder_log rl
      WHERE rl.request_id = pr.id
      AND rl.reminder_type = CASE
        WHEN pr.due_date = today_sast + interval '1 day' THEN '1_day_before'
        WHEN pr.due_date = today_sast THEN 'due_date'
        WHEN pr.due_date = today_sast - interval '1 day' THEN '1_day_after'
        WHEN pr.due_date = today_sast - interval '3 days' THEN '3_days_after'
        WHEN pr.due_date = today_sast - interval '7 days' THEN '7_days_after'
      END
      AND rl.sent_at::date = today_sast
    ) as already_sent,
    COALESCE(pb.description, '') as description
  FROM payment_requests pr
  JOIN clients c ON pr.client_id = c.id
  LEFT JOIN payment_batches pb ON pr.batch_id = pb.id
  WHERE pr.business_id = business_uuid
    AND pr.status IN ('sent', 'scheduled', 'partial')
    AND pr.outstanding > 0
    AND (
      pr.due_date = today_sast + interval '1 day' OR
      pr.due_date = today_sast OR
      pr.due_date = today_sast - interval '1 day' OR
      pr.due_date = today_sast - interval '3 days' OR
      pr.due_date = today_sast - interval '7 days'
    )
  ORDER BY pr.due_date ASC, c.name ASC;
END;
$$ LANGUAGE plpgsql;
