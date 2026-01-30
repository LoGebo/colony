-- Migration: Community Settings with Feature Flags
-- Phase: 07-operations-compliance
-- Plan: 05
-- Purpose: Community configuration schema with JSONB feature flags for per-tenant feature control
-- Patterns: JSONB feature flags with GIN index (Pattern 8 from 07-RESEARCH.md)

-- ============================================================================
-- COMMUNITY SETTINGS TABLE
-- ============================================================================
-- Stores operating hours, branding, locale, rules, and feature flags per community
-- Feature flags schema example:
-- {
--   "digital_mailroom": { "enabled": true, "config": { "qr_codes_enabled": true, "signature_required": false } },
--   "provider_management": { "enabled": true, "config": { "require_insurance": true } },
--   "move_coordination": { "enabled": true, "config": { "require_deposit": true, "deposit_amount": 5000 } },
--   "marketplace": { "enabled": false },
--   "voting": { "enabled": true, "config": { "weighted_voting": true } }
-- }

CREATE TABLE IF NOT EXISTS community_settings (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Operating hours
  office_hours_start TIME DEFAULT '08:00',
  office_hours_end TIME DEFAULT '18:00',
  office_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],  -- 0=Sunday, 1=Monday, ..., 6=Saturday (Mon-Fri default)

  -- Contact information
  management_email TEXT,
  management_phone phone_number,
  emergency_phone phone_number,

  -- Branding
  logo_url TEXT,
  primary_color TEXT,    -- Hex color e.g. '#1E40AF'
  secondary_color TEXT,  -- Hex color e.g. '#F97316'

  -- Locale settings
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  locale locale_code NOT NULL DEFAULT 'es-MX',
  currency currency_code NOT NULL DEFAULT 'MXN',

  -- Feature flags (JSONB for flexibility)
  feature_flags JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Rules and policies
  guest_parking_allowed BOOLEAN DEFAULT true,
  max_vehicles_per_unit INTEGER DEFAULT 2,
  pet_policy TEXT,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',

  -- Package settings
  package_retention_days INTEGER DEFAULT 14,
  package_notification_channels TEXT[] DEFAULT ARRAY['push', 'email'],

  -- Custom rules (JSONB array)
  custom_rules JSONB DEFAULT '[]'::JSONB,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- One settings record per community
  CONSTRAINT community_settings_unique UNIQUE (community_id)
);

-- Comments
COMMENT ON TABLE community_settings IS 'Per-community configuration: hours, branding, locale, rules, and feature flags';
COMMENT ON COLUMN community_settings.office_days IS 'Days of week when office is open (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN community_settings.feature_flags IS 'JSONB feature toggles: { "feature_name": { "enabled": bool, "config": {...} } }';
COMMENT ON COLUMN community_settings.custom_rules IS 'JSONB array of custom community rules and policies';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- GIN index for JSONB feature flag queries (enables @> containment queries)
CREATE INDEX IF NOT EXISTS idx_community_settings_features
  ON community_settings USING GIN (feature_flags);

-- Index for active settings lookup
CREATE INDEX IF NOT EXISTS idx_community_settings_community
  ON community_settings(community_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- TRIGGER FOR AUDIT FIELDS
-- ============================================================================

CREATE TRIGGER set_community_settings_audit
  BEFORE INSERT OR UPDATE ON community_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if a feature is enabled for a community
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_community_id UUID,
  p_feature_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_feature JSONB;
BEGIN
  SELECT feature_flags->p_feature_name INTO v_feature
  FROM community_settings
  WHERE community_id = p_community_id
    AND deleted_at IS NULL;

  IF v_feature IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN COALESCE((v_feature->>'enabled')::BOOLEAN, FALSE);
END;
$$;

COMMENT ON FUNCTION is_feature_enabled IS 'Check if a feature is enabled for a community';

-- Function to get feature configuration
CREATE OR REPLACE FUNCTION get_feature_config(
  p_community_id UUID,
  p_feature_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (
    SELECT feature_flags->p_feature_name->'config'
    FROM community_settings
    WHERE community_id = p_community_id
      AND deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION get_feature_config IS 'Get configuration object for a specific feature';

-- Function to create default community settings
CREATE OR REPLACE FUNCTION create_default_community_settings(
  p_community_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings_id UUID;
  v_default_features JSONB;
BEGIN
  -- Default feature flags for new communities
  v_default_features := '{
    "digital_mailroom": { "enabled": true, "config": {} },
    "provider_management": { "enabled": true, "config": {} },
    "move_coordination": { "enabled": true, "config": {} },
    "marketplace": { "enabled": false, "config": {} },
    "voting": { "enabled": true, "config": {} },
    "chat": { "enabled": true, "config": {} }
  }'::JSONB;

  INSERT INTO community_settings (
    community_id,
    feature_flags
  ) VALUES (
    p_community_id,
    v_default_features
  )
  ON CONFLICT (community_id) DO UPDATE
  SET updated_at = now()
  RETURNING id INTO v_settings_id;

  RETURN v_settings_id;
END;
$$;

COMMENT ON FUNCTION create_default_community_settings IS 'Create default settings for a new community with standard feature flags';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE community_settings ENABLE ROW LEVEL SECURITY;

-- Members can view their community's settings
CREATE POLICY community_settings_select_policy ON community_settings
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Only admins can update settings (check JWT role or use has_permission when available)
CREATE POLICY community_settings_update_policy ON community_settings
  FOR UPDATE
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
    )
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
    )
  );

-- Only super_admin can insert (typically done via create_default_community_settings)
CREATE POLICY community_settings_insert_policy ON community_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'community_admin')
    )
  );

-- Soft delete only for admins
CREATE POLICY community_settings_delete_policy ON community_settings
  FOR DELETE
  TO authenticated
  USING (FALSE);  -- No hard deletes allowed
