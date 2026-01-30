-- Migration: Webhook queue and delivery functions
-- Phase: 08-governance-analytics
-- Plan: 09 - External Integrations
-- Task: 2 - Create webhook queue and delivery functions

-- =====================================================
-- CALCULATE NEXT RETRY INTERVAL
-- =====================================================
-- Exponential backoff schedule:
-- Attempt 1: 1 minute
-- Attempt 2: 5 minutes
-- Attempt 3: 15 minutes
-- Attempt 4: 1 hour
-- Attempt 5: 4 hours
-- Attempt 6+: 24 hours

CREATE OR REPLACE FUNCTION calculate_next_retry(p_attempt INTEGER)
RETURNS INTERVAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_attempt
    WHEN 1 THEN INTERVAL '1 minute'
    WHEN 2 THEN INTERVAL '5 minutes'
    WHEN 3 THEN INTERVAL '15 minutes'
    WHEN 4 THEN INTERVAL '1 hour'
    WHEN 5 THEN INTERVAL '4 hours'
    ELSE INTERVAL '24 hours'
  END;
END;
$$;

COMMENT ON FUNCTION calculate_next_retry(INTEGER) IS 'Calculates exponential backoff interval for webhook retry (1m, 5m, 15m, 1h, 4h, 24h)';

-- =====================================================
-- QUEUE WEBHOOK DELIVERY
-- =====================================================
-- Creates webhook delivery records for all endpoints subscribed to event type
-- Returns delivery IDs created

CREATE OR REPLACE FUNCTION queue_webhook(
  p_community_id UUID,
  p_event_type TEXT,
  p_event_id UUID,
  p_payload JSONB
)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_endpoint RECORD;
  v_delivery_id UUID;
  v_signature TEXT;
BEGIN
  -- Find all active endpoints subscribed to this event type
  FOR v_endpoint IN
    SELECT id, secret, max_retries
    FROM webhook_endpoints
    WHERE community_id = p_community_id
      AND is_active = true
      AND auto_disabled_at IS NULL
      AND deleted_at IS NULL
      AND p_event_type = ANY(event_types)
  LOOP
    -- Generate HMAC-SHA256 signature using endpoint secret
    v_signature := encode(
      extensions.hmac(p_payload::TEXT::BYTEA, v_endpoint.secret::BYTEA, 'sha256'),
      'hex'
    );

    -- Create delivery record with immediate first attempt
    INSERT INTO webhook_deliveries (
      endpoint_id,
      community_id,
      event_type,
      event_id,
      payload,
      signature,
      max_attempts,
      next_attempt_at
    ) VALUES (
      v_endpoint.id,
      p_community_id,
      p_event_type,
      p_event_id,
      p_payload,
      v_signature,
      v_endpoint.max_retries + 1,  -- max_retries is retries after first attempt
      now()  -- Immediate first attempt
    ) RETURNING id INTO v_delivery_id;

    RETURN NEXT v_delivery_id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION queue_webhook(UUID, TEXT, UUID, JSONB) IS 'Queues webhook deliveries for all endpoints subscribed to the event type';

-- =====================================================
-- PROCESS WEBHOOK DELIVERY
-- =====================================================
-- Locks and prepares a delivery for HTTP call
-- Actual HTTP call done by Edge Function

CREATE OR REPLACE FUNCTION process_webhook_delivery(p_delivery_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery webhook_deliveries;
BEGIN
  -- Lock the delivery record (SKIP LOCKED for concurrent processing)
  SELECT * INTO v_delivery
  FROM webhook_deliveries
  WHERE id = p_delivery_id
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Only process pending or retrying deliveries
  IF v_delivery.status NOT IN ('pending', 'retrying') THEN
    RETURN false;
  END IF;

  -- Update status to sending, increment attempt count
  UPDATE webhook_deliveries
  SET status = 'sending',
      attempt_count = attempt_count + 1,
      last_attempt_at = now()
  WHERE id = p_delivery_id;

  -- Return true - Edge Function should now make HTTP call
  RETURN true;
END;
$$;

COMMENT ON FUNCTION process_webhook_delivery(UUID) IS 'Locks and updates delivery for processing. Returns true if ready for HTTP call.';

-- =====================================================
-- RECORD WEBHOOK RESULT
-- =====================================================
-- Records the result of a webhook delivery attempt

CREATE OR REPLACE FUNCTION record_webhook_result(
  p_delivery_id UUID,
  p_success BOOLEAN,
  p_response_code INTEGER DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery webhook_deliveries;
  v_current_failures INTEGER;
BEGIN
  -- Get current delivery state
  SELECT * INTO v_delivery
  FROM webhook_deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found: %', p_delivery_id;
  END IF;

  IF p_success THEN
    -- Success: Mark as delivered
    UPDATE webhook_deliveries
    SET status = 'delivered',
        delivered_at = now(),
        last_response_code = p_response_code,
        last_response_body = p_response_body
    WHERE id = p_delivery_id;

    -- Update endpoint health: reset consecutive failures
    UPDATE webhook_endpoints
    SET consecutive_failures = 0,
        last_success_at = now()
    WHERE id = v_delivery.endpoint_id;

  ELSE
    -- Failure: Check if exhausted retries
    IF v_delivery.attempt_count >= v_delivery.max_attempts THEN
      -- Dead letter: exhausted all retries
      UPDATE webhook_deliveries
      SET status = 'dead_letter',
          last_response_code = p_response_code,
          last_response_body = p_response_body,
          last_error = p_error
      WHERE id = p_delivery_id;
    ELSE
      -- Schedule retry with exponential backoff
      UPDATE webhook_deliveries
      SET status = 'retrying',
          last_response_code = p_response_code,
          last_response_body = p_response_body,
          last_error = p_error,
          next_attempt_at = now() + calculate_next_retry(v_delivery.attempt_count)
      WHERE id = p_delivery_id;
    END IF;

    -- Update endpoint health: increment consecutive failures
    UPDATE webhook_endpoints
    SET consecutive_failures = consecutive_failures + 1,
        last_failure_at = now(),
        last_failure_reason = p_error
    WHERE id = v_delivery.endpoint_id
    RETURNING consecutive_failures INTO v_current_failures;

    -- Auto-disable endpoint after 10 consecutive failures
    IF v_current_failures >= 10 THEN
      UPDATE webhook_endpoints
      SET auto_disabled_at = now(),
          is_active = false
      WHERE id = v_delivery.endpoint_id
        AND auto_disabled_at IS NULL;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION record_webhook_result(UUID, BOOLEAN, INTEGER, TEXT, TEXT) IS 'Records webhook delivery result, handles success/failure/retry/dead-letter states';

-- =====================================================
-- GET PENDING WEBHOOKS
-- =====================================================
-- Returns pending webhooks ready for processing

CREATE OR REPLACE FUNCTION get_pending_webhooks(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  delivery_id UUID,
  endpoint_url TEXT,
  payload JSONB,
  signature TEXT,
  custom_headers JSONB,
  event_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS delivery_id,
    e.url AS endpoint_url,
    d.payload,
    d.signature,
    e.custom_headers,
    d.event_type
  FROM webhook_deliveries d
  JOIN webhook_endpoints e ON e.id = d.endpoint_id
  WHERE d.status IN ('pending', 'retrying')
    AND d.next_attempt_at <= now()
    AND e.is_active = true
    AND e.auto_disabled_at IS NULL
    AND e.deleted_at IS NULL
  ORDER BY d.next_attempt_at ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_pending_webhooks(INTEGER) IS 'Returns pending webhooks ready for delivery, ordered by next_attempt_at';

-- =====================================================
-- RETRY DEAD LETTER
-- =====================================================
-- Resets a dead letter delivery for manual retry

CREATE OR REPLACE FUNCTION retry_dead_letter(p_delivery_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery webhook_deliveries;
BEGIN
  -- Get delivery and verify it's in dead_letter status
  SELECT * INTO v_delivery
  FROM webhook_deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_delivery.status != 'dead_letter' THEN
    RETURN false;
  END IF;

  -- Reset for retry: 3 more attempts
  UPDATE webhook_deliveries
  SET status = 'retrying',
      attempt_count = 0,
      max_attempts = 3,
      next_attempt_at = now(),
      last_error = NULL,
      last_response_code = NULL,
      last_response_body = NULL
  WHERE id = p_delivery_id;

  -- Re-enable endpoint if it was auto-disabled
  UPDATE webhook_endpoints
  SET auto_disabled_at = NULL,
      is_active = true,
      consecutive_failures = 0
  WHERE id = v_delivery.endpoint_id
    AND auto_disabled_at IS NOT NULL;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION retry_dead_letter(UUID) IS 'Resets a dead letter delivery for manual retry with 3 new attempts';

-- =====================================================
-- HELPER VIEW: WEBHOOK DELIVERY STATS
-- =====================================================
-- View for monitoring webhook delivery statistics

CREATE OR REPLACE VIEW webhook_delivery_stats AS
SELECT
  e.id AS endpoint_id,
  e.community_id,
  e.name AS endpoint_name,
  e.url,
  e.is_active,
  e.consecutive_failures,
  e.auto_disabled_at IS NOT NULL AS is_auto_disabled,
  COUNT(d.id) FILTER (WHERE d.status = 'delivered') AS delivered_count,
  COUNT(d.id) FILTER (WHERE d.status = 'pending') AS pending_count,
  COUNT(d.id) FILTER (WHERE d.status = 'retrying') AS retrying_count,
  COUNT(d.id) FILTER (WHERE d.status = 'dead_letter') AS dead_letter_count,
  COUNT(d.id) FILTER (WHERE d.status = 'failed') AS failed_count,
  MAX(d.delivered_at) AS last_delivered_at,
  AVG(EXTRACT(EPOCH FROM (d.delivered_at - d.created_at)))::INTEGER AS avg_delivery_seconds
FROM webhook_endpoints e
LEFT JOIN webhook_deliveries d ON d.endpoint_id = e.id
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.community_id, e.name, e.url, e.is_active,
         e.consecutive_failures, e.auto_disabled_at;

COMMENT ON VIEW webhook_delivery_stats IS 'Aggregated delivery statistics per webhook endpoint';
