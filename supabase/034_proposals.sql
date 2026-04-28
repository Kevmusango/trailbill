-- 034_proposals.sql
-- Proposal module: send offers, collect client commitment + start date

CREATE TABLE IF NOT EXISTS proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name         TEXT NOT NULL,
  client_email        TEXT,
  client_phone        TEXT,
  public_token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  title               TEXT NOT NULL,
  description         TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  payment_terms       JSONB NOT NULL DEFAULT '[]',
  allow_counter       BOOLEAN NOT NULL DEFAULT false,
  min_counter_amount  NUMERIC(12,2),
  expiry_date         DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent','viewed','accepted','revised_requested','expired')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id           UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  start_date            DATE NOT NULL,
  start_month_only      BOOLEAN NOT NULL DEFAULT false,
  selected_payment_term TEXT,
  counter_amount        NUMERIC(12,2),
  counter_note          TEXT,
  project_started_at    TIMESTAMPTZ,
  responded_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can read a proposal (token is unguessable — 32 hex chars)
CREATE POLICY "public_read_proposals" ON proposals
  FOR SELECT USING (true);

-- Owners manage their own proposals
CREATE POLICY "owners_manage_proposals" ON proposals
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Anyone can insert a response (public proposal page)
CREATE POLICY "public_insert_response" ON proposal_responses
  FOR INSERT WITH CHECK (true);

-- Owners read responses for their proposals
CREATE POLICY "owners_read_responses" ON proposal_responses
  FOR SELECT USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN businesses b ON b.id = p.business_id
      WHERE b.owner_id = auth.uid()
    )
  );

-- Owners update responses (e.g. mark project started)
CREATE POLICY "owners_update_responses" ON proposal_responses
  FOR UPDATE USING (
    proposal_id IN (
      SELECT p.id FROM proposals p
      JOIN businesses b ON b.id = p.business_id
      WHERE b.owner_id = auth.uid()
    )
  );

-- Track proposal view (moves sent → viewed)
CREATE OR REPLACE FUNCTION track_proposal_view(p_token TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE proposals
  SET status = 'viewed'
  WHERE public_token = p_token AND status = 'sent';
END;
$$;
