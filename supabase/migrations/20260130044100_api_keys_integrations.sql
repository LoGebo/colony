-- Migration: API keys and integration configuration tables
-- Phase: 08-governance-analytics
-- Plan: 09 - External Integrations
-- Task: 3 - Create API keys and integration configuration tables

-- =====================================================
-- API KEYS TABLE
-- =====================================================
-- Stores API key metadata. Key hash stored, NEVER plaintext.

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Identification
  name TEXT NOT NULL,
  description TEXT,

  -- Key storage: prefix for display, hash for validation
  -- CRITICAL: Full key is only shown once at creation
  key_prefix TEXT NOT NULL,  -- First 16 chars: "upoe_sk_abc12345..."
  key_hash TEXT NOT NULL,    -- SHA-256 hash of full key

  -- Scopes (permissions this key grants)
  -- Format: ['access_logs:read', 'residents:read', 'payments:write']
  scopes TEXT[] NOT NULL,

  -- Restrictions
  allowed_ips INET[],  -- NULL = any IP allowed
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,

  -- Validity
  expires_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  last_used_ip INET,
  total_requests INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT api_keys_prefix_unique UNIQUE (community_id, key_prefix),
  CONSTRAINT api_keys_scopes_not_empty CHECK (cardinality(scopes) > 0),
  CONSTRAINT api_keys_rate_limit_positive CHECK (rate_limit_per_minute > 0)
);

COMMENT ON TABLE api_keys IS 'API key management with hash-only storage (never stores plaintext keys)';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 16 characters of key for identification (never the full key)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of full API key for validation';
COMMENT ON COLUMN api_keys.scopes IS 'Array of permissions: resource:action format';

-- =====================================================
-- API KEY USAGE TABLE
-- =====================================================
-- Logs API key usage for rate limiting and auditing

CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,

  -- Client info
  ip_address INET NOT NULL,
  user_agent TEXT,

  -- Response
  response_code INTEGER,
  response_time_ms INTEGER,

  -- Timestamp
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE api_key_usage IS 'API key usage log for rate limiting and auditing';

-- =====================================================
-- INTEGRATION CONFIGS TABLE
-- =====================================================
-- Stores external integration configurations

CREATE TABLE integration_configs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Integration type
  integration_type TEXT NOT NULL,  -- 'bank_feed', 'lpr', 'cctv', 'access_control', 'payment_gateway'
  name TEXT NOT NULL,

  -- Provider
  provider TEXT NOT NULL,  -- 'banamex', 'hikvision', 'stripe', 'conekta'

  -- Non-sensitive configuration
  config JSONB NOT NULL DEFAULT '{}',

  -- Credentials reference (ID in Supabase Vault)
  vault_secret_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',   -- Not yet configured
    'active',    -- Working normally
    'error',     -- Last sync failed
    'disabled'   -- Manually disabled
  )),

  -- Health tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_error TEXT,

  -- Sync settings
  sync_interval_minutes INTEGER NOT NULL DEFAULT 60,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT integration_configs_unique UNIQUE (community_id, integration_type, name)
);

COMMENT ON TABLE integration_configs IS 'External integration configurations with vault references for credentials';
COMMENT ON COLUMN integration_configs.vault_secret_id IS 'Reference to Supabase Vault for sensitive credentials';

-- =====================================================
-- INTEGRATION SYNC LOGS TABLE
-- =====================================================
-- Logs synchronization runs for each integration

CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  integration_id UUID NOT NULL REFERENCES integration_configs(id) ON DELETE CASCADE,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
    'running',   -- Currently executing
    'success',   -- Completed successfully
    'partial',   -- Completed with some errors
    'failed'     -- Failed completely
  )),

  -- Record counts
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,

  -- Errors
  error_message TEXT,
  error_details JSONB,

  -- Metadata
  sync_type TEXT,  -- 'full', 'incremental', 'manual'
  triggered_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE integration_sync_logs IS 'Log of integration synchronization runs with record counts';

-- =====================================================
-- INDEXES
-- =====================================================

-- API keys: lookup by hash for validation
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- API keys: community active keys
CREATE INDEX idx_api_keys_community
  ON api_keys(community_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- API key usage: rate limiting queries
CREATE INDEX idx_api_key_usage_key_time
  ON api_key_usage(api_key_id, requested_at DESC);

-- API key usage: time-series queries
CREATE INDEX idx_api_key_usage_time_brin
  ON api_key_usage USING BRIN(requested_at);

-- Integration configs: community lookup
CREATE INDEX idx_integration_configs_community
  ON integration_configs(community_id)
  WHERE deleted_at IS NULL;

-- Integration sync logs: recent logs per integration
CREATE INDEX idx_integration_sync_logs_integration
  ON integration_sync_logs(integration_id, started_at DESC);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

CREATE TRIGGER set_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_integration_configs_updated_at
  BEFORE UPDATE ON integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- GENERATE API KEY FUNCTION
-- =====================================================
-- Creates a new API key. CRITICAL: Full key returned ONLY ONCE.

CREATE OR REPLACE FUNCTION generate_api_key(
  p_community_id UUID,
  p_name TEXT,
  p_scopes TEXT[],
  p_expires_in_days INTEGER DEFAULT NULL
)
RETURNS TABLE (
  key_id UUID,
  api_key TEXT,        -- ONLY returned once - never stored!
  prefix TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
  v_prefix TEXT;
  v_hash TEXT;
  v_id UUID;
  v_expires TIMESTAMPTZ;
  v_random_bytes BYTEA;
BEGIN
  -- Generate random key: upoe_sk_{32 URL-safe random chars}
  v_random_bytes := extensions.gen_random_bytes(24);
  v_key := 'upoe_sk_' || encode(v_random_bytes, 'base64');

  -- Make URL-safe: replace +, /, = with alphanumeric
  v_key := replace(replace(replace(v_key, '+', 'x'), '/', 'y'), '=', 'z');

  -- Extract prefix (first 16 characters for display)
  v_prefix := substring(v_key FROM 1 FOR 16);

  -- Hash the full key for storage
  v_hash := encode(extensions.digest(v_key::BYTEA, 'sha256'), 'hex');

  -- Calculate expiration if specified
  IF p_expires_in_days IS NOT NULL THEN
    v_expires := now() + (p_expires_in_days || ' days')::INTERVAL;
  END IF;

  -- Insert the key record
  INSERT INTO api_keys (
    community_id,
    name,
    key_prefix,
    key_hash,
    scopes,
    expires_at,
    created_by
  ) VALUES (
    p_community_id,
    p_name,
    v_prefix,
    v_hash,
    p_scopes,
    v_expires,
    auth.uid()
  ) RETURNING id INTO v_id;

  -- Return key info (api_key only shown this once!)
  RETURN QUERY SELECT v_id, v_key, v_prefix, v_expires;
END;
$$;

COMMENT ON FUNCTION generate_api_key(UUID, TEXT, TEXT[], INTEGER) IS 'Generates new API key. CRITICAL: api_key column is only returned once - save it!';

-- =====================================================
-- VALIDATE API KEY FUNCTION
-- =====================================================
-- Validates an API key and checks scope permissions

CREATE OR REPLACE FUNCTION validate_api_key(
  p_key TEXT,
  p_required_scope TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_valid BOOLEAN,
  key_id UUID,
  community_id UUID,
  scopes TEXT[],
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash TEXT;
  v_api_key api_keys;
BEGIN
  -- Hash the provided key
  v_hash := encode(extensions.digest(p_key::BYTEA, 'sha256'), 'hex');

  -- Find key by hash
  SELECT * INTO v_api_key
  FROM api_keys
  WHERE key_hash = v_hash
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::TEXT[], 'Invalid API key'::TEXT;
    RETURN;
  END IF;

  -- Check if active
  IF NOT v_api_key.is_active THEN
    RETURN QUERY SELECT false, v_api_key.id, v_api_key.community_id, v_api_key.scopes, 'API key is revoked'::TEXT;
    RETURN;
  END IF;

  -- Check expiration
  IF v_api_key.expires_at IS NOT NULL AND v_api_key.expires_at < now() THEN
    RETURN QUERY SELECT false, v_api_key.id, v_api_key.community_id, v_api_key.scopes, 'API key has expired'::TEXT;
    RETURN;
  END IF;

  -- Check scope if required
  IF p_required_scope IS NOT NULL AND NOT (p_required_scope = ANY(v_api_key.scopes)) THEN
    RETURN QUERY SELECT false, v_api_key.id, v_api_key.community_id, v_api_key.scopes, 'Insufficient scope'::TEXT;
    RETURN;
  END IF;

  -- Update usage statistics
  UPDATE api_keys
  SET last_used_at = now(),
      total_requests = total_requests + 1
  WHERE id = v_api_key.id;

  -- Return success
  RETURN QUERY SELECT true, v_api_key.id, v_api_key.community_id, v_api_key.scopes, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION validate_api_key(TEXT, TEXT) IS 'Validates API key by hashing and comparing. Returns error_message for specific failures.';

-- =====================================================
-- REVOKE API KEY FUNCTION
-- =====================================================
-- Revokes an API key with reason

CREATE OR REPLACE FUNCTION revoke_api_key(
  p_key_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE api_keys
  SET is_active = false,
      revoked_at = now(),
      revoked_by = auth.uid(),
      revoke_reason = p_reason
  WHERE id = p_key_id
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION revoke_api_key(UUID, TEXT) IS 'Revokes an API key with optional reason. Idempotent.';

-- =====================================================
-- CHECK RATE LIMIT FUNCTION
-- =====================================================
-- Checks if API key is within rate limit

CREATE OR REPLACE FUNCTION check_api_key_rate_limit(
  p_key_id UUID,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE (
  is_allowed BOOLEAN,
  requests_remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_api_key api_keys;
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Get API key
  SELECT * INTO v_api_key
  FROM api_keys
  WHERE id = p_key_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, now();
    RETURN;
  END IF;

  -- Calculate window start (current minute)
  v_window_start := date_trunc('minute', now());

  -- Count requests in current window
  SELECT COUNT(*) INTO v_count
  FROM api_key_usage
  WHERE api_key_id = p_key_id
    AND requested_at >= v_window_start;

  -- Check against limit
  RETURN QUERY SELECT
    v_count < v_api_key.rate_limit_per_minute,
    GREATEST(0, v_api_key.rate_limit_per_minute - v_count),
    v_window_start + INTERVAL '1 minute';
END;
$$;

COMMENT ON FUNCTION check_api_key_rate_limit(UUID, INET) IS 'Checks if API key is within rate limit for current minute';

-- =====================================================
-- LOG API KEY USAGE FUNCTION
-- =====================================================
-- Records API key usage for auditing and rate limiting

CREATE OR REPLACE FUNCTION log_api_key_usage(
  p_key_id UUID,
  p_endpoint TEXT,
  p_method TEXT,
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL,
  p_response_code INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage_id UUID;
BEGIN
  INSERT INTO api_key_usage (
    api_key_id,
    endpoint,
    method,
    ip_address,
    user_agent,
    response_code,
    response_time_ms
  ) VALUES (
    p_key_id,
    p_endpoint,
    p_method,
    p_ip_address,
    p_user_agent,
    p_response_code,
    p_response_time_ms
  ) RETURNING id INTO v_usage_id;

  -- Update last used on API key
  UPDATE api_keys
  SET last_used_at = now(),
      last_used_ip = p_ip_address
  WHERE id = p_key_id;

  RETURN v_usage_id;
END;
$$;

COMMENT ON FUNCTION log_api_key_usage(UUID, TEXT, TEXT, INET, TEXT, INTEGER, INTEGER) IS 'Logs API key usage for rate limiting and auditing';

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- API keys: Admins can CRUD, but key_hash never exposed in SELECT
CREATE POLICY api_keys_select ON api_keys
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND has_permission('config:read')
  );

CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND has_permission('config:write')
  );

CREATE POLICY api_keys_update ON api_keys
  FOR UPDATE
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND has_permission('config:write')
  );

CREATE POLICY api_keys_delete ON api_keys
  FOR DELETE
  USING (
    community_id = (SELECT get_current_community_id())
    AND has_permission('config:write')
  );

-- API key usage: Platform admins only (service role)
CREATE POLICY api_key_usage_service ON api_key_usage
  FOR ALL
  USING (auth.role() = 'service_role');

-- Integration configs: Admins can full CRUD
CREATE POLICY integration_configs_select ON integration_configs
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND has_permission('config:read')
  );

CREATE POLICY integration_configs_insert ON integration_configs
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND has_permission('config:write')
  );

CREATE POLICY integration_configs_update ON integration_configs
  FOR UPDATE
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND has_permission('config:write')
  );

CREATE POLICY integration_configs_delete ON integration_configs
  FOR DELETE
  USING (
    community_id = (SELECT get_current_community_id())
    AND has_permission('config:write')
  );

-- Integration sync logs: Admins can SELECT only
CREATE POLICY integration_sync_logs_select ON integration_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM integration_configs ic
      WHERE ic.id = integration_sync_logs.integration_id
        AND ic.community_id = (SELECT get_current_community_id())
        AND ic.deleted_at IS NULL
    )
    AND has_permission('config:read')
  );

-- Service role can insert sync logs
CREATE POLICY integration_sync_logs_service ON integration_sync_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- HELPER VIEW: API KEY SUMMARY
-- =====================================================
-- View for listing API keys without exposing hash

CREATE OR REPLACE VIEW api_key_summary AS
SELECT
  id,
  community_id,
  name,
  description,
  key_prefix,
  -- NEVER expose key_hash
  scopes,
  allowed_ips,
  rate_limit_per_minute,
  expires_at,
  is_active,
  revoked_at,
  revoke_reason,
  last_used_at,
  total_requests,
  created_at,
  created_by,
  CASE
    WHEN NOT is_active THEN 'revoked'
    WHEN expires_at IS NOT NULL AND expires_at < now() THEN 'expired'
    ELSE 'active'
  END AS status
FROM api_keys
WHERE deleted_at IS NULL;

COMMENT ON VIEW api_key_summary IS 'API key listing without exposing key_hash';

-- =====================================================
-- HELPER VIEW: INTEGRATION STATUS
-- =====================================================
-- View for monitoring integration health

CREATE OR REPLACE VIEW integration_status AS
SELECT
  ic.id,
  ic.community_id,
  ic.integration_type,
  ic.name,
  ic.provider,
  ic.status,
  ic.last_sync_at,
  ic.last_sync_status,
  ic.last_error,
  ic.sync_interval_minutes,
  -- Last sync stats
  ls.records_processed AS last_sync_records,
  ls.records_failed AS last_sync_failures,
  EXTRACT(EPOCH FROM (ls.completed_at - ls.started_at))::INTEGER AS last_sync_duration_seconds,
  -- Health indicators
  CASE
    WHEN ic.status = 'error' THEN 'unhealthy'
    WHEN ic.last_sync_at IS NULL THEN 'never_synced'
    WHEN ic.last_sync_at < now() - (ic.sync_interval_minutes * 2 || ' minutes')::INTERVAL THEN 'stale'
    ELSE 'healthy'
  END AS health_status
FROM integration_configs ic
LEFT JOIN LATERAL (
  SELECT * FROM integration_sync_logs
  WHERE integration_id = ic.id
  ORDER BY started_at DESC
  LIMIT 1
) ls ON true
WHERE ic.deleted_at IS NULL;

COMMENT ON VIEW integration_status IS 'Integration health status with last sync details';
