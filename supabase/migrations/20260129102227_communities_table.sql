-- ============================================
-- COMMUNITIES TABLE
-- ============================================
-- Individual gated community within an organization
-- This is the primary tenant isolation boundary

CREATE TABLE communities (
  -- Primary key using UUID v7 for time-ordering
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

  -- Organization relationship
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  -- Core fields
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Location
  timezone timezone_name NOT NULL DEFAULT 'America/Mexico_City',
  locale locale_code NOT NULL DEFAULT 'es-MX',
  address JSONB DEFAULT '{}'::JSONB,
  -- Structure: { street, neighborhood, city, state, postal_code, country, coordinates: {lat, lng} }

  -- Contact info
  email TEXT,
  phone phone_number,
  emergency_phone phone_number,

  -- Branding (overrides org-level)
  logo_url TEXT,
  cover_image_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,

  -- Settings (community-specific configuration)
  settings JSONB DEFAULT '{}'::JSONB,
  -- Typical settings:
  -- {
  --   operating_hours: { weekday: { open: "06:00", close: "22:00" }, weekend: {...} },
  --   access_rules: { require_photo: true, require_id: true },
  --   notifications: { channels: ["push", "email", "sms"] },
  --   features: { amenities: true, marketplace: true, chat: true },
  --   payment: { currency: "MXN", allow_partial: false },
  --   security: { panic_button: true, patrol_required: true }
  -- }

  -- Community metrics (denormalized for quick access)
  unit_count INTEGER DEFAULT 0,
  resident_count INTEGER DEFAULT 0,

  -- Financial settings
  currency currency_code NOT NULL DEFAULT 'MXN',

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,  -- Soft delete
  created_by UUID REFERENCES auth.users(id),

  -- Unique slug within organization
  CONSTRAINT communities_org_slug_unique UNIQUE (organization_id, slug)
);

-- CRITICAL: Index for RLS performance
-- This index is essential for fast RLS policy evaluation
CREATE INDEX idx_communities_id
  ON communities(id)
  WHERE deleted_at IS NULL;

-- Index for organization lookups
CREATE INDEX idx_communities_organization_id
  ON communities(organization_id)
  WHERE deleted_at IS NULL;

-- Index for status filtering
CREATE INDEX idx_communities_status
  ON communities(status)
  WHERE deleted_at IS NULL;

-- Composite index for org + status queries
CREATE INDEX idx_communities_org_status
  ON communities(organization_id, status)
  WHERE deleted_at IS NULL;

-- Audit trigger
CREATE TRIGGER set_communities_audit
  BEFORE INSERT OR UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Enable RLS immediately (CRITICAL!)
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE communities IS
  'Individual gated communities. Primary tenant isolation boundary - all other tables reference community_id.';
COMMENT ON COLUMN communities.slug IS
  'URL-friendly identifier, unique within organization. Used in URLs.';
COMMENT ON COLUMN communities.settings IS
  'JSONB configuration for community-specific features, rules, and preferences.';
COMMENT ON COLUMN communities.timezone IS
  'IANA timezone (e.g., America/Mexico_City). All community times displayed in this zone.';
COMMENT ON COLUMN communities.locale IS
  'BCP 47 locale for language and formatting (e.g., es-MX).';
COMMENT ON COLUMN communities.unit_count IS
  'Denormalized count of units. Updated by triggers when units change.';
