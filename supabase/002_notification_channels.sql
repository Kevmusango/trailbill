-- Migration: add notification_channels to payment_requests and payment_batches
-- Run this in the Supabase SQL editor

ALTER TABLE payment_batches
  ADD COLUMN IF NOT EXISTS notification_channels text NOT NULL DEFAULT 'both'
  CHECK (notification_channels IN ('email', 'whatsapp', 'both'));

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS notification_channels text NOT NULL DEFAULT 'both'
  CHECK (notification_channels IN ('email', 'whatsapp', 'both'));
