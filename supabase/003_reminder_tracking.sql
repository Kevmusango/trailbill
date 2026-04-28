-- Migration: Add activity center support
-- Run this in the Supabase SQL editor
--
-- NOTE: reminder_log already exists in 001_schema.sql with columns:
--   request_id, client_id, channel, reminder_type, status, sent_at, created_at
-- This migration adds missing columns and new functions.

-- ============================================================
-- 1. Add business_id to existing reminder_log table
-- ============================================================
ALTER TABLE reminder_log
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;

-- Backfill business_id from payment_requests for any existing rows
UPDATE reminder_log rl
  SET business_id = pr.business_id
  FROM payment_requests pr
  WHERE rl.request_id = pr.id
  AND rl.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminder_log_business ON reminder_log(business_id);
CREATE INDEX IF NOT EXISTS idx_reminder_log_sent_at ON reminder_log(sent_at);

-- Drop old reminder_type check and add expanded one
ALTER TABLE reminder_log DROP CONSTRAINT IF EXISTS reminder_log_reminder_type_check;
ALTER TABLE reminder_log ADD CONSTRAINT reminder_log_reminder_type_check
  CHECK (reminder_type IN ('before_due', 'due_today', 'follow_up_1', 'follow_up_2', 'escalation',
                           '1_day_before', 'due_date', '1_day_after', '3_days_after', '7_days_after'));

-- Drop old status check and add expanded one
ALTER TABLE reminder_log DROP CONSTRAINT IF EXISTS reminder_log_status_check;
ALTER TABLE reminder_log ADD CONSTRAINT reminder_log_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'bounced'));

-- Add unique constraint if not exists (prevent duplicate reminders)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reminder_log_request_type_channel_unique'
  ) THEN
    ALTER TABLE reminder_log ADD CONSTRAINT reminder_log_request_type_channel_unique
      UNIQUE(request_id, reminder_type, channel);
  END IF;
END $$;

-- ============================================================
-- 2. Add weekly report preferences to businesses
-- ============================================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS weekly_report_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS weekly_report_day text NOT NULL DEFAULT 'monday';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS weekly_report_time time NOT NULL DEFAULT '08:00:00';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS end_of_week_report_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS end_of_week_report_day text NOT NULL DEFAULT 'friday';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS end_of_week_report_time time NOT NULL DEFAULT '17:00:00';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS daily_digest_time time NOT NULL DEFAULT '08:00:00';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_weekly_report_day_check'
  ) THEN
    ALTER TABLE businesses ADD CONSTRAINT businesses_weekly_report_day_check
      CHECK (weekly_report_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_end_of_week_report_day_check'
  ) THEN
    ALTER TABLE businesses ADD CONSTRAINT businesses_end_of_week_report_day_check
      CHECK (end_of_week_report_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));
  END IF;
END $$;

-- ============================================================
-- 3. Function: get today's reminders (SAST - UTC+2)
--    Uses existing reminder_log columns: request_id, reminder_type, sent_at
-- ============================================================
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

-- ============================================================
-- 4. Function: get upcoming week's activity (SAST - UTC+2)
-- ============================================================
CREATE OR REPLACE FUNCTION get_upcoming_week_activity(business_uuid uuid)
RETURNS TABLE (
  activity_date date,
  activity_type text,
  count bigint,
  total_amount numeric
) AS $$
DECLARE
  today_sast date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  week_end date := today_sast + interval '7 days';
BEGIN
  RETURN QUERY
  -- Scheduled payment sends
  SELECT
    (pb.scheduled_at AT TIME ZONE 'Africa/Johannesburg')::date as activity_date,
    'scheduled_send'::text as activity_type,
    COUNT(*)::bigint as count,
    SUM(pb.total_amount) as total_amount
  FROM payment_batches pb
  WHERE pb.business_id = business_uuid
    AND pb.status = 'scheduled'
    AND (pb.scheduled_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN today_sast AND week_end
  GROUP BY (pb.scheduled_at AT TIME ZONE 'Africa/Johannesburg')::date

  UNION ALL

  -- 1 day before due reminders
  SELECT
    (pr.due_date - interval '1 day')::date as activity_date,
    'reminder_1_day_before'::text as activity_type,
    COUNT(*)::bigint as count,
    SUM(pr.total_due) as total_amount
  FROM payment_requests pr
  WHERE pr.business_id = business_uuid
    AND pr.status IN ('sent', 'scheduled', 'partial')
    AND pr.outstanding > 0
    AND (pr.due_date - interval '1 day')::date BETWEEN today_sast AND week_end
  GROUP BY (pr.due_date - interval '1 day')::date

  UNION ALL

  -- Due date reminders
  SELECT
    pr.due_date as activity_date,
    'due_date_reminder'::text as activity_type,
    COUNT(*)::bigint as count,
    SUM(pr.total_due) as total_amount
  FROM payment_requests pr
  WHERE pr.business_id = business_uuid
    AND pr.status IN ('sent', 'scheduled', 'partial')
    AND pr.outstanding > 0
    AND pr.due_date BETWEEN today_sast AND week_end
  GROUP BY pr.due_date

  ORDER BY activity_date ASC, activity_type ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. RLS policies for reminder_log
-- ============================================================
ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their business reminder logs' AND tablename = 'reminder_log'
  ) THEN
    CREATE POLICY "Users can view their business reminder logs"
      ON reminder_log FOR SELECT
      USING (
        client_id IN (
          SELECT c.id FROM clients c
          JOIN businesses b ON c.business_id = b.id
          WHERE b.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their business reminder logs' AND tablename = 'reminder_log'
  ) THEN
    CREATE POLICY "Users can insert their business reminder logs"
      ON reminder_log FOR INSERT
      WITH CHECK (
        client_id IN (
          SELECT c.id FROM clients c
          JOIN businesses b ON c.business_id = b.id
          WHERE b.owner_id = auth.uid()
        )
      );
  END IF;
END $$;
