-- 037_add_declined_status.sql
-- Allow client to decline an owner's final offer

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('sent','viewed','accepted','revised_requested','expired','owner_revised','declined'));
