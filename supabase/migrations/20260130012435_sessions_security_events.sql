-- Migration: sessions_security_events
-- Phase: 07-operations-compliance
-- Plan: 04 (Audit Logs & Compliance)
-- Task: 3 - Create user sessions and security events tables
-- Description: Session tracking with device fingerprint and security event logging
-- Patterns: Security audit trail with rate limiting support

-- ============================================================================
-- USER_SESSIONS TABLE
-- ============================================================================
-- Tracks user sessions with device fingerprint, IP, and location

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_session_id TEXT,                               -- Supabase auth session ID

  -- Device fingerprint
  device_fingerprint TEXT,                            -- Computed hash of device characteristics
  device_id TEXT,                                     -- App-generated device ID

  -- Device details
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  device_model TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  screen_resolution TEXT,

  -- Network
  ip_address INET NOT NULL,

  -- Location (optional, from IP geolocation)
  country TEXT,
  region TEXT,
  city TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),

  -- Session lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  termination_reason TEXT CHECK (termination_reason IN ('logout', 'expired', 'admin_revoke', 'security')),

  -- Security flags
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  suspicious_reason TEXT,

  -- App version
  app_version TEXT
);

-- Comments
COMMENT ON TABLE user_sessions IS 'Tracks user sessions with device fingerprint, IP, and security flags';
COMMENT ON COLUMN user_sessions.device_fingerprint IS 'Hash of device characteristics for fingerprinting';
COMMENT ON COLUMN user_sessions.termination_reason IS 'Why session ended: logout, expired, admin_revoke, security';
COMMENT ON COLUMN user_sessions.is_suspicious IS 'Flag for suspicious sessions requiring review';

-- ============================================================================
-- USER_SESSIONS INDEXES
-- ============================================================================

-- Active sessions for a user (most common query)
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions (user_id, last_active_at DESC)
  WHERE terminated_at IS NULL;

-- Sessions by IP (for security investigation)
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip
  ON user_sessions (ip_address, created_at DESC);

-- Sessions by device fingerprint (for device tracking)
CREATE INDEX IF NOT EXISTS idx_user_sessions_fingerprint
  ON user_sessions (device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;

-- ============================================================================
-- SECURITY_EVENT_TYPE ENUM
-- ============================================================================

CREATE TYPE security_event_type AS ENUM (
  'login_success',
  'login_failed',
  'logout',
  'password_changed',
  'mfa_enabled',
  'mfa_disabled',
  'session_terminated',
  'access_blocked',
  'blacklist_hit',
  'suspicious_activity',
  'permission_denied',
  'data_export'
);

COMMENT ON TYPE security_event_type IS 'Types of security events tracked in the system';

-- ============================================================================
-- SECURITY_EVENTS TABLE
-- ============================================================================
-- Logs authentication and access events for security monitoring

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID REFERENCES communities(id),       -- NULL for platform-level events

  -- Event classification
  event_type security_event_type NOT NULL,

  -- Actor
  user_id UUID REFERENCES auth.users(id),             -- NULL for anonymous events
  session_id UUID REFERENCES user_sessions(id),       -- NULL if no session context

  -- Details
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,

  -- Related entity (polymorphic reference)
  entity_type TEXT,                                   -- 'unit', 'document', 'transaction', etc.
  entity_id UUID,

  -- Severity
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),

  -- Timestamp (no updated_at - these are audit records)
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE security_events IS 'Logs security-relevant events for monitoring and compliance';
COMMENT ON COLUMN security_events.metadata IS 'Additional event-specific data (e.g., failed login attempts, blocked IP)';
COMMENT ON COLUMN security_events.entity_type IS 'Type of related entity (polymorphic reference)';
COMMENT ON COLUMN security_events.severity IS 'Event severity: info, warning, critical';

-- ============================================================================
-- SECURITY_EVENTS INDEXES
-- ============================================================================

-- BRIN index for time-series queries
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp_brin
  ON security_events USING BRIN (logged_at);

-- Events by user (for user activity review)
CREATE INDEX IF NOT EXISTS idx_security_events_user
  ON security_events (user_id, logged_at DESC)
  WHERE user_id IS NOT NULL;

-- Events by type (for security dashboards)
CREATE INDEX IF NOT EXISTS idx_security_events_type
  ON security_events (event_type, logged_at DESC);

-- High severity events (for alerts)
CREATE INDEX IF NOT EXISTS idx_security_events_severity
  ON security_events (severity, logged_at DESC)
  WHERE severity IN ('warning', 'critical');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a new user session
CREATE OR REPLACE FUNCTION create_user_session(
  p_user_id UUID,
  p_ip_address INET,
  p_device_info JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO public.user_sessions (
    user_id,
    ip_address,
    device_type,
    device_model,
    browser,
    browser_version,
    os,
    os_version,
    screen_resolution,
    device_fingerprint,
    device_id,
    app_version
  ) VALUES (
    p_user_id,
    p_ip_address,
    COALESCE(p_device_info->>'device_type', 'unknown'),
    p_device_info->>'device_model',
    p_device_info->>'browser',
    p_device_info->>'browser_version',
    p_device_info->>'os',
    p_device_info->>'os_version',
    p_device_info->>'screen_resolution',
    p_device_info->>'device_fingerprint',
    p_device_info->>'device_id',
    p_device_info->>'app_version'
  )
  RETURNING id INTO v_session_id;

  -- Log security event
  INSERT INTO public.security_events (
    user_id,
    session_id,
    event_type,
    description,
    ip_address,
    metadata,
    severity
  ) VALUES (
    p_user_id,
    v_session_id,
    'login_success',
    'User session created',
    p_ip_address,
    p_device_info,
    'info'
  );

  RETURN v_session_id;
END;
$$;

COMMENT ON FUNCTION create_user_session IS 'Creates a new user session with device info and logs login event';

-- Function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_sessions
  SET last_active_at = now()
  WHERE id = p_session_id
    AND terminated_at IS NULL;
END;
$$;

COMMENT ON FUNCTION update_session_activity IS 'Updates last_active_at timestamp for an active session';

-- Function to terminate a session
CREATE OR REPLACE FUNCTION terminate_session(
  p_session_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_ip_address INET;
BEGIN
  -- Get session info
  SELECT user_id, ip_address INTO v_user_id, v_ip_address
  FROM public.user_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  -- Terminate the session
  UPDATE public.user_sessions
  SET
    terminated_at = now(),
    termination_reason = p_reason
  WHERE id = p_session_id
    AND terminated_at IS NULL;

  -- Log security event
  INSERT INTO public.security_events (
    user_id,
    session_id,
    event_type,
    description,
    ip_address,
    metadata,
    severity
  ) VALUES (
    v_user_id,
    p_session_id,
    'session_terminated',
    format('Session terminated: %s', p_reason),
    v_ip_address,
    jsonb_build_object('reason', p_reason),
    CASE
      WHEN p_reason = 'security' THEN 'warning'
      ELSE 'info'
    END
  );
END;
$$;

COMMENT ON FUNCTION terminate_session IS 'Terminates a session and logs security event';

-- Function to log a security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type security_event_type,
  p_description TEXT,
  p_user_id UUID DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_severity TEXT DEFAULT 'info',
  p_community_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
  v_ip_address INET;
  v_user_agent TEXT;
BEGIN
  -- Try to get request context
  BEGIN
    v_ip_address := (current_setting('request.headers', TRUE)::JSON->>'x-forwarded-for')::INET;
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
  END;

  BEGIN
    v_user_agent := current_setting('request.headers', TRUE)::JSON->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_user_agent := NULL;
  END;

  INSERT INTO public.security_events (
    community_id,
    event_type,
    user_id,
    session_id,
    description,
    metadata,
    ip_address,
    user_agent,
    entity_type,
    entity_id,
    severity
  ) VALUES (
    p_community_id,
    p_event_type,
    p_user_id,
    p_session_id,
    p_description,
    p_metadata,
    v_ip_address,
    v_user_agent,
    p_entity_type,
    p_entity_id,
    p_severity
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION log_security_event IS 'Logs a security event with automatic context extraction';

-- Function to check if login should be blocked (rate limiting)
CREATE OR REPLACE FUNCTION should_block_login(
  p_email TEXT,
  p_ip_address INET,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email_attempts INTEGER;
  v_ip_attempts INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Count failed login attempts by email (via metadata->>'email')
  SELECT COUNT(*) INTO v_email_attempts
  FROM public.security_events
  WHERE event_type = 'login_failed'
    AND logged_at > v_window_start
    AND metadata->>'email' = p_email;

  -- Count failed login attempts by IP (with 2x threshold)
  SELECT COUNT(*) INTO v_ip_attempts
  FROM public.security_events
  WHERE event_type = 'login_failed'
    AND logged_at > v_window_start
    AND ip_address = p_ip_address;

  -- Block if email exceeds limit OR IP exceeds 2x limit
  RETURN (v_email_attempts >= p_max_attempts) OR (v_ip_attempts >= (p_max_attempts * 2));
END;
$$;

COMMENT ON FUNCTION should_block_login IS 'Checks if login should be blocked based on failed attempt rate limiting';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY user_sessions_select_own ON user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all sessions (for security investigation)
CREATE POLICY user_sessions_select_admin ON user_sessions
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
  );

-- Only system can insert (via functions)
CREATE POLICY user_sessions_insert_system ON user_sessions
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- Only system can update (via functions)
CREATE POLICY user_sessions_update_system ON user_sessions
  FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Enable RLS on security_events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view security events (sensitive security data)
CREATE POLICY security_events_select_admin ON security_events
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
    AND (
      -- Super admin sees all
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      -- Community admin sees only their community
      OR community_id = (SELECT get_current_community_id())
      -- Or platform-level events (NULL community_id)
      OR community_id IS NULL
    )
  );

-- Only system can insert (via functions)
CREATE POLICY security_events_insert_system ON security_events
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- No updates or deletes on security events (audit trail)
-- Implicit deny since no UPDATE/DELETE policies exist
