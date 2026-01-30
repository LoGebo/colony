-- ============================================================================
-- PUSH TOKENS TABLE
-- ============================================================================
-- Purpose: Manage push notification device tokens for FCM/APNs/Web Push.
-- Tracks device registration, staleness, and delivery success/failure.
--
-- Token lifecycle:
-- 1. register_push_token() - Device registers on app open
-- 2. record_push_success() - Token confirmed working on successful delivery
-- 3. mark_token_invalid() - Token marked invalid on delivery failure
-- 4. cleanup_stale_push_tokens() - Periodic cleanup of old/invalid tokens
-- ============================================================================

-- ============================================================================
-- PUSH_TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

    -- User ownership
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Platform and token
    platform push_platform NOT NULL,
    token TEXT NOT NULL,

    -- Device identification
    device_id TEXT,                    -- Unique device identifier (e.g., IDFV, Android ID)
    device_name TEXT,                  -- User-friendly name: "John's iPhone"
    device_model TEXT,                 -- Hardware model: "iPhone 14 Pro"
    os_version TEXT,                   -- OS version: "iOS 17.2"
    app_version TEXT,                  -- App version: "1.2.3"

    -- Registration tracking
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Active status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivation_reason TEXT,          -- 'user_logout', 'token_expired', 'unregistered', 'bounced'
    deactivated_at TIMESTAMPTZ,

    -- Delivery statistics
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_failure_reason TEXT,

    -- Constraints
    CONSTRAINT push_tokens_token_unique UNIQUE (token),
    CONSTRAINT push_tokens_user_device_platform_unique UNIQUE (user_id, device_id, platform),
    CONSTRAINT push_tokens_deactivation_valid CHECK (
        (is_active = TRUE AND deactivated_at IS NULL AND deactivation_reason IS NULL)
        OR (is_active = FALSE AND deactivated_at IS NOT NULL)
    )
);

-- Comments
COMMENT ON TABLE push_tokens IS
    'Push notification device tokens for FCM, APNs, and Web Push delivery.';

COMMENT ON COLUMN push_tokens.token IS
    'The push notification token from the device/browser. Must be unique across all tokens.';

COMMENT ON COLUMN push_tokens.device_id IS
    'Unique device identifier for token refresh detection. Combined with user_id and platform for upsert.';

COMMENT ON COLUMN push_tokens.last_used_at IS
    'Last time this token was used for a successful notification delivery.';

COMMENT ON COLUMN push_tokens.last_refreshed_at IS
    'Last time the token was registered/refreshed by the app.';

COMMENT ON COLUMN push_tokens.deactivation_reason IS
    'Reason for deactivation: user_logout (user logged out), token_expired (platform reported expired), unregistered (app uninstalled), bounced (repeated delivery failures).';


-- ============================================================================
-- INDEXES
-- ============================================================================

-- Active tokens for a user (for notification delivery)
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active
    ON push_tokens(user_id, is_active)
    WHERE is_active = TRUE;

-- Cleanup query: inactive tokens ready for deletion
CREATE INDEX IF NOT EXISTS idx_push_tokens_cleanup
    ON push_tokens(is_active, deactivated_at)
    WHERE is_active = FALSE;

-- Token lookup for marking invalid
CREATE INDEX IF NOT EXISTS idx_push_tokens_token
    ON push_tokens(token);

-- Stale token detection: active but not used recently
CREATE INDEX IF NOT EXISTS idx_push_tokens_stale
    ON push_tokens(last_used_at)
    WHERE is_active = TRUE;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY push_tokens_select_own ON push_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY push_tokens_insert_own ON push_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY push_tokens_update_own ON push_tokens
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY push_tokens_delete_own ON push_tokens
    FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Register or refresh a push token
CREATE OR REPLACE FUNCTION register_push_token(
    p_user_id UUID,
    p_platform push_platform,
    p_token TEXT,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL,
    p_device_model TEXT DEFAULT NULL,
    p_app_version TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_id UUID;
BEGIN
    -- Upsert: if same user/device/platform, update token; otherwise insert
    INSERT INTO push_tokens (
        user_id,
        platform,
        token,
        device_id,
        device_name,
        device_model,
        app_version,
        registered_at,
        last_refreshed_at,
        is_active,
        deactivation_reason,
        deactivated_at
    )
    VALUES (
        p_user_id,
        p_platform,
        p_token,
        p_device_id,
        p_device_name,
        p_device_model,
        p_app_version,
        now(),
        now(),
        TRUE,
        NULL,
        NULL
    )
    ON CONFLICT (user_id, device_id, platform)
    DO UPDATE SET
        token = EXCLUDED.token,
        device_name = COALESCE(EXCLUDED.device_name, push_tokens.device_name),
        device_model = COALESCE(EXCLUDED.device_model, push_tokens.device_model),
        app_version = COALESCE(EXCLUDED.app_version, push_tokens.app_version),
        last_refreshed_at = now(),
        is_active = TRUE,
        deactivation_reason = NULL,
        deactivated_at = NULL
    RETURNING id INTO v_token_id;

    RETURN v_token_id;
END;
$$;

COMMENT ON FUNCTION register_push_token IS
    'Register or refresh a push token. If same user/device/platform exists, updates the token and reactivates if needed.';


-- Mark a token as invalid (delivery failure)
CREATE OR REPLACE FUNCTION mark_token_invalid(
    p_token TEXT,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE push_tokens
    SET
        is_active = FALSE,
        deactivation_reason = p_reason,
        deactivated_at = now(),
        failure_count = failure_count + 1,
        last_failure_at = now(),
        last_failure_reason = p_reason
    WHERE token = p_token
      AND is_active = TRUE;

    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION mark_token_invalid IS
    'Mark a push token as invalid after delivery failure. Records reason and increments failure count.';


-- Record successful push delivery
CREATE OR REPLACE FUNCTION record_push_success(
    p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE push_tokens
    SET
        last_used_at = now(),
        success_count = success_count + 1
    WHERE token = p_token
      AND is_active = TRUE;

    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION record_push_success IS
    'Record a successful push notification delivery. Updates last_used_at and increments success count.';


-- Get active push tokens for a user
CREATE OR REPLACE FUNCTION get_user_push_tokens(
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    platform push_platform,
    token TEXT,
    device_name TEXT,
    device_model TEXT,
    last_used_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pt.id,
        pt.platform,
        pt.token,
        pt.device_name,
        pt.device_model,
        pt.last_used_at
    FROM push_tokens pt
    WHERE pt.user_id = p_user_id
      AND pt.is_active = TRUE
    ORDER BY pt.last_used_at DESC;
END;
$$;

COMMENT ON FUNCTION get_user_push_tokens IS
    'Get all active push tokens for a user. Used by notification sender to deliver push notifications.';


-- Cleanup stale push tokens
CREATE OR REPLACE FUNCTION cleanup_stale_push_tokens(
    p_stale_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_marked_stale INTEGER := 0;
    v_stale_threshold TIMESTAMPTZ;
BEGIN
    v_stale_threshold := now() - (p_stale_days || ' days')::INTERVAL;

    -- Delete inactive tokens that have been deactivated for over p_stale_days
    DELETE FROM push_tokens
    WHERE is_active = FALSE
      AND deactivated_at < v_stale_threshold;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Mark active tokens as stale if not used for p_stale_days
    UPDATE push_tokens
    SET
        is_active = FALSE,
        deactivation_reason = 'token_expired',
        deactivated_at = now()
    WHERE is_active = TRUE
      AND last_used_at < v_stale_threshold;

    GET DIAGNOSTICS v_marked_stale = ROW_COUNT;

    -- Return total count of deleted tokens (marked stale will be deleted next run)
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_stale_push_tokens IS
    'Cleanup stale push tokens. Deletes inactive tokens older than p_stale_days and marks active but unused tokens as stale.';
