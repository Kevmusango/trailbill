-- 040_proposal_tracking.sql
-- Track which channels a proposal was sent via, and how many times it was viewed

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS channels_sent  text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS viewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS view_count     integer     NOT NULL DEFAULT 0;

-- Helper function: append a channel once (idempotent)
CREATE OR REPLACE FUNCTION record_channel_sent(p_proposal_id uuid, p_channel text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE proposals
  SET channels_sent = array_append(channels_sent, p_channel)
  WHERE id = p_proposal_id
    AND NOT (p_channel = ANY(channels_sent));
$$;
