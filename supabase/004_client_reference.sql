-- ============================================================
-- 004 — Client reference number
-- Each client can have an optional reference number that
-- matches the business's internal invoicing/accounting system.
-- Must be unique per business (when set).
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS reference_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_reference
  ON clients(business_id, reference_number)
  WHERE reference_number IS NOT NULL;
