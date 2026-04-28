-- Fix: get_todays_reminders was excluding requests with status='overdue'
-- This meant follow-up reminders (1_day_after, 3_days_after, 7_days_after)
-- never fired once a request was marked overdue.

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
  already_sent boolean
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
    ) as already_sent
  FROM payment_requests pr
  JOIN clients c ON pr.client_id = c.id
  WHERE pr.business_id = business_uuid
    AND pr.status IN ('sent', 'scheduled', 'partial', 'overdue')
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
