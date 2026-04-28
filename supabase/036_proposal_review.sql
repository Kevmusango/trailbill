-- 036_proposal_review.sql
-- Owner counter-review: review_token, approve or set final price

ALTER TABLE proposal_responses
  ADD COLUMN IF NOT EXISTS review_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS owner_action TEXT CHECK (owner_action IN ('approved', 'revised')),
  ADD COLUMN IF NOT EXISTS revised_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS revised_note TEXT,
  ADD COLUMN IF NOT EXISTS owner_reviewed_at TIMESTAMPTZ;

-- Add owner_revised to allowed proposal statuses
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('sent','viewed','accepted','revised_requested','expired','owner_revised'));
