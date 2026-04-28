-- 046_topup_credits.sql
-- Credit top-up ONLY: adds p_credits to the existing balance, capped at 100.
-- Does NOT touch subscription dates or active status.
-- Use the Subscription dialog separately to renew/extend subscription days.

CREATE OR REPLACE FUNCTION topup_credits(
  p_business_id uuid,
  p_credits     int
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current  int;
  v_new      int;
BEGIN
  SELECT credits_remaining
  INTO v_current
  FROM businesses
  WHERE id = p_business_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Business not found');
  END IF;

  -- Add credits, hard cap at 100 (starter plan limit)
  v_new := LEAST(v_current + p_credits, 100);

  UPDATE businesses
  SET credits_remaining = v_new,
      credits_monthly   = 100,
      updated_at        = now()
  WHERE id = p_business_id;

  INSERT INTO activity_log (business_id, type, description, metadata)
  VALUES (
    p_business_id,
    'system',
    p_credits || ' credits added — total now ' || v_new,
    json_build_object(
      'credits_added',     p_credits,
      'credits_remaining', v_new
    )::jsonb
  );

  RETURN json_build_object(
    'success',           true,
    'credits_added',     p_credits,
    'credits_remaining', v_new
  );
END;
$$;
