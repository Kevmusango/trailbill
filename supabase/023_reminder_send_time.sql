-- Migration: Add per-business reminder send time
-- Businesses can choose what time their client reminders fire daily.
-- Cron runs every 30 min and matches businesses in the current time slot.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS reminder_send_time time NOT NULL DEFAULT '08:00:00';
