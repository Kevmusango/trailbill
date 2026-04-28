-- 038_credits_system.sql
-- Credit-based billing system for TrailBill
--
-- Pricing model: R799/month = 100 credits (resets monthly)
-- Credit costs:
--   email     = 1 credit
--   whatsapp  = 2 credits
--   both      = 3 credits  (email 1 + WhatsApp 2)
-- Reminders & follow-ups for existing requests = FREE (no credit cost)
-- When credits = 0: "Send Request" and "Send Proposal" buttons lock
--   but all active request automations continue uninterrupted

-- ============================================================
-- 1. ADD CREDIT & SUBSCRIPTION FIELDS TO BUSINESSES
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_active  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_end     date,
  ADD COLUMN IF NOT EXISTS credits_monthly      int     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS credits_remaining    int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_date   date;

-- ============================================================
-- 2. ADD CREDITS_USED TO PAYMENT_REQUESTS
-- ============================================================

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS credits_used int NOT NULL DEFAULT 1;

-- ============================================================
-- 3. HELPER: Credit cost per notification channel
-- ============================================================

CREATE OR REPLACE FUNCTION credits_for_channel(channel text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE channel
    WHEN 'email'    THEN 1
    WHEN 'whatsapp' THEN 2
    WHEN 'both'     THEN 3
    ELSE 1
  END;
$$;

GRANT EXECUTE ON FUNCTION credits_for_channel(text) TO authenticated;

-- ============================================================
-- 4. EXPAND activity_log.type CHECK CONSTRAINT to include 'credit_deducted'
-- Original: ('payment', 'request', 'reminder', 'overdue', 'client', 'group', 'system')
-- ============================================================

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_type_check;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_type_check
  CHECK (type IN ('payment', 'request', 'reminder', 'overdue', 'client', 'group', 'system', 'credit_deducted'));

-- ============================================================
-- 5. FUNCTION: Atomic credit deduction (call on Send Request / Send Proposal)
-- Runs as SECURITY DEFINER to bypass RLS — called from API routes with service key
-- Returns JSON: { success, credits_used, credits_remaining, error? }
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_credits(
  p_business_id uuid,
  p_channel      text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cost      int;
  v_remaining int;
  v_active    boolean;
  v_end       date;
  v_new_bal   int;
  v_today     date;
BEGIN
  v_cost  := credits_for_channel(p_channel);
  v_today := (now() AT TIME ZONE 'Africa/Johannesburg')::date;

  -- Lock the row to prevent race conditions on concurrent requests
  SELECT credits_remaining, subscription_active, subscription_end
  INTO v_remaining, v_active, v_end
  FROM businesses
  WHERE id = p_business_id
  FOR UPDATE;

  IF v_remaining IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Business not found');
  END IF;

  IF NOT v_active THEN
    RETURN json_build_object('success', false, 'error', 'Subscription inactive');
  END IF;

  -- Bug fix: also check expiry date (consistent with can_send_request)
  IF v_end IS NOT NULL AND v_end <= v_today THEN
    RETURN json_build_object(
      'success',          false,
      'error',            'Subscription expired',
      'subscription_end', v_end
    );
  END IF;

  IF v_remaining < v_cost THEN
    RETURN json_build_object(
      'success',           false,
      'error',             'Insufficient credits',
      'credits_remaining', v_remaining,
      'credits_needed',    v_cost
    );
  END IF;

  v_new_bal := v_remaining - v_cost;

  UPDATE businesses
  SET credits_remaining = v_new_bal,
      updated_at        = now()
  WHERE id = p_business_id;

  -- Log to activity_log for audit trail
  INSERT INTO activity_log (business_id, type, description, metadata)
  VALUES (
    p_business_id,
    'credit_deducted',
    v_cost || ' credit(s) used for ' || p_channel || ' request',
    json_build_object(
      'channel',           p_channel,
      'credits_used',      v_cost,
      'credits_remaining', v_new_bal
    )::jsonb
  );

  RETURN json_build_object(
    'success',           true,
    'credits_used',      v_cost,
    'credits_remaining', v_new_bal
  );
END;
$$;

-- ============================================================
-- 6. FUNCTION: Admin assigns / renews credits for a business
-- Called by admin when processing monthly payment (R799)
-- p_credits defaults to 100 (standard plan)
-- p_end_date defaults to +30 days from today (SAST)
-- Bug fix: was 'first day of next month' which could be as few as 1 day away
-- ============================================================

CREATE OR REPLACE FUNCTION assign_credits(
  p_business_id uuid,
  p_credits     int  DEFAULT 100,
  p_end_date    date DEFAULT ((now() AT TIME ZONE 'Africa/Johannesburg')::date + interval '30 days')::date
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE businesses
  SET subscription_active  = true,
      subscription_end     = p_end_date,
      credits_monthly      = p_credits,
      credits_remaining    = p_credits,
      credits_reset_date   = p_end_date,
      updated_at           = now()
  WHERE id = p_business_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Business not found');
  END IF;

  -- Audit trail: log credit assignment
  INSERT INTO activity_log (business_id, type, description, metadata)
  VALUES (
    p_business_id,
    'system',
    p_credits || ' credits assigned — subscription active until ' || p_end_date,
    json_build_object(
      'credits_assigned',  p_credits,
      'subscription_end',  p_end_date
    )::jsonb
  );

  RETURN json_build_object(
    'success',          true,
    'credits_assigned', p_credits,
    'subscription_end', p_end_date
  );
END;
$$;

-- ============================================================
-- 7. FUNCTION: Admin revokes / suspends a subscription
-- Keeps credits_remaining as-is but locks new sends
-- Existing automations (reminders/follow-ups) continue unaffected
-- ============================================================

CREATE OR REPLACE FUNCTION revoke_subscription(p_business_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE businesses
  SET subscription_active = false,
      updated_at          = now()
  WHERE id = p_business_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Business not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- 8. FUNCTION: Check if a business can send (subscription active + credits sufficient)
-- Lightweight check — use before showing Send button in the UI
-- Returns JSON: { can_send, credits_remaining, credits_needed, reason? }
-- ============================================================

CREATE OR REPLACE FUNCTION can_send_request(
  p_business_id uuid,
  p_channel      text DEFAULT 'both'
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_active    boolean;
  v_remaining int;
  v_end       date;
  v_cost      int;
BEGIN
  v_cost := credits_for_channel(p_channel);

  SELECT subscription_active, credits_remaining, subscription_end
  INTO v_active, v_remaining, v_end
  FROM businesses
  WHERE id = p_business_id;

  IF v_active IS NULL THEN
    RETURN json_build_object('can_send', false, 'reason', 'Business not found');
  END IF;

  IF NOT v_active THEN
    RETURN json_build_object(
      'can_send',           false,
      'reason',             'subscription_inactive',
      'credits_remaining',  v_remaining
    );
  END IF;

  IF v_end IS NOT NULL AND v_end <= (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
    RETURN json_build_object(
      'can_send',          false,
      'reason',            'subscription_expired',
      'subscription_end',  v_end,
      'credits_remaining', v_remaining
    );
  END IF;

  IF v_remaining < v_cost THEN
    RETURN json_build_object(
      'can_send',          false,
      'reason',            'insufficient_credits',
      'credits_remaining', v_remaining,
      'credits_needed',    v_cost
    );
  END IF;

  RETURN json_build_object(
    'can_send',          true,
    'credits_remaining', v_remaining,
    'credits_needed',    v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION can_send_request(uuid, text) TO authenticated;

-- ============================================================
-- 9. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_businesses_subscription
  ON businesses(subscription_active, subscription_end);

CREATE INDEX IF NOT EXISTS idx_businesses_credits
  ON businesses(credits_remaining);

-- ============================================================
-- 10. RLS — No new tables
-- Existing policies already cover all access correctly:
--   "Owners can view own business"   → owner reads credits_remaining
--   "Owners can update own business" → owner updates settings (not credits directly)
--   "Admins can manage businesses"   → admin assigns credits via UI
--   deduct_credits / assign_credits  → SECURITY DEFINER, bypass RLS safely
--   can_send_request                 → SECURITY DEFINER, read-only safe check
-- No new policies needed.
-- ============================================================
