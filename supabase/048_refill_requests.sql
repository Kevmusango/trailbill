-- 048_refill_requests.sql
CREATE TABLE IF NOT EXISTS refill_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_email text NOT NULL,
  pack_label    text NOT NULL,
  pack_credits  int  NOT NULL,
  pack_price    text NOT NULL,
  contact_phone text,
  message       text,
  status        text NOT NULL DEFAULT 'pending',  -- pending | fulfilled | dismissed
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE refill_requests ENABLE ROW LEVEL SECURITY;

-- Admins can read/update all
CREATE POLICY "admin_all" ON refill_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Businesses can insert their own
CREATE POLICY "business_insert" ON refill_requests
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
