-- Migration 025: Remove sole_proprietor client type
-- Merge sole_proprietor → individual (both are natural persons)

UPDATE clients
  SET client_type = 'individual'
  WHERE client_type = 'sole_proprietor';

-- Drop old check constraint and add updated one
ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_client_type_check;

ALTER TABLE clients
  ADD CONSTRAINT clients_client_type_check
    CHECK (client_type IN ('individual', 'business'));
