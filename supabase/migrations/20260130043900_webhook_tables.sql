-- Migration: Webhook endpoint and delivery tables
-- Phase: 08-governance-analytics
-- Plan: 09 - External Integrations
-- Task: 1 - Create webhook endpoint and delivery tables

-- =====================================================
-- WEBHOOK STATUS ENUM
-- =====================================================

CREATE TYPE webhook_status AS ENUM (
  'pending',      -- Awaiting first delivery attempt
  'sending',      -- Currently being delivered
  'delivered',    -- Successfully delivered
  'failed',       -- Failed but may retry
  'retrying',     -- Scheduled for retry
  'dead_letter'   -- Exhausted all retries
);

COMMENT ON TYPE webhook_status IS 'Status for webhook delivery lifecycle with retry support';

-- =====================================================
-- WEBHOOK ENDPOINTS TABLE
-- =====================================================
-- Stores webhook configurations for each community

CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Endpoint details
  name TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Security: HMAC signature verification
  secret TEXT NOT NULL,

  -- Event subscriptions
  event_types TEXT[] NOT NULL,  -- ['access.entry', 'incident.created', 'payment.received']

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Health tracking
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,

  -- Auto-disable after too many failures (10 consecutive)
  auto_disabled_at TIMESTAMPTZ,

  -- Custom HTTP headers for endpoint
  custom_headers JSONB DEFAULT '{}',

  -- Retry configuration
  max_retries INTEGER NOT NULL DEFAULT 5,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT webhook_endpoints_event_types_not_empty CHECK (cardinality(event_types) > 0),
  CONSTRAINT webhook_endpoints_url_format CHECK (url ~ '^https?://')
);

COMMENT ON TABLE webhook_endpoints IS 'Webhook endpoint configurations for external integrations';
COMMENT ON COLUMN webhook_endpoints.secret IS 'Secret key for HMAC-SHA256 signature verification';
COMMENT ON COLUMN webhook_endpoints.event_types IS 'Array of event types this endpoint subscribes to';
COMMENT ON COLUMN webhook_endpoints.auto_disabled_at IS 'Set when endpoint is auto-disabled after 10 consecutive failures';

-- =====================================================
-- WEBHOOK DELIVERIES TABLE
-- =====================================================
-- Queue for webhook delivery attempts with retry tracking

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL,  -- Reference to original event
  payload JSONB NOT NULL,

  -- Delivery status
  status webhook_status NOT NULL DEFAULT 'pending',

  -- Retry tracking
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 6,  -- 6 attempts with exponential backoff
  next_attempt_at TIMESTAMPTZ,

  -- Last attempt details
  last_attempt_at TIMESTAMPTZ,
  last_response_code INTEGER,
  last_response_body TEXT,
  last_error TEXT,

  -- Success tracking
  delivered_at TIMESTAMPTZ,

  -- HMAC signature of payload
  signature TEXT,

  -- Audit (deliveries are append-only, no soft delete)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE webhook_deliveries IS 'Queue for webhook deliveries with exponential backoff retry';
COMMENT ON COLUMN webhook_deliveries.signature IS 'HMAC-SHA256 signature of payload for verification';
COMMENT ON COLUMN webhook_deliveries.max_attempts IS 'Maximum delivery attempts before dead letter (default 6)';

-- =====================================================
-- INDEXES
-- =====================================================

-- Active endpoints per community
CREATE INDEX idx_webhook_endpoints_community
  ON webhook_endpoints(community_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- Pending deliveries for queue processing
CREATE INDEX idx_webhook_deliveries_pending
  ON webhook_deliveries(next_attempt_at)
  WHERE status IN ('pending', 'retrying');

-- Delivery history per endpoint
CREATE INDEX idx_webhook_deliveries_endpoint
  ON webhook_deliveries(endpoint_id, created_at DESC);

-- Community delivery lookup
CREATE INDEX idx_webhook_deliveries_community
  ON webhook_deliveries(community_id, created_at DESC);

-- Event reference lookup
CREATE INDEX idx_webhook_deliveries_event
  ON webhook_deliveries(event_id);

-- =====================================================
-- AUDIT TRIGGER
-- =====================================================

CREATE TRIGGER set_webhook_endpoints_audit
  BEFORE INSERT OR UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Webhook endpoints: Admins can full CRUD
CREATE POLICY webhook_endpoints_select ON webhook_endpoints
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND has_permission('config:read')
  );

CREATE POLICY webhook_endpoints_insert ON webhook_endpoints
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND has_permission('config:write')
  );

CREATE POLICY webhook_endpoints_update ON webhook_endpoints
  FOR UPDATE
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND has_permission('config:write')
  );

CREATE POLICY webhook_endpoints_delete ON webhook_endpoints
  FOR DELETE
  USING (
    community_id = (SELECT get_current_community_id())
    AND has_permission('config:write')
  );

-- Webhook deliveries: Admins can SELECT, system can full CRUD
CREATE POLICY webhook_deliveries_select ON webhook_deliveries
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND has_permission('config:read')
  );

-- Service role for queue processing (Edge Functions)
CREATE POLICY webhook_deliveries_service ON webhook_deliveries
  FOR ALL
  USING (auth.role() = 'service_role');
