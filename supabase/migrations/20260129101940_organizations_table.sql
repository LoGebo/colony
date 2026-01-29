-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
-- Platform-level entity: SaaS customer (property management company)
-- One organization can manage multiple communities

CREATE TABLE organizations (
  -- Primary key using UUID v7 for time-ordering
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

  -- Core fields
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Contact info
  email TEXT,
  phone phone_number,
  website TEXT,

  -- Address (for billing)
  address JSONB DEFAULT '{}'::JSONB,
  -- Structure: { street, city, state, postal_code, country }

  -- Billing info
  billing_email TEXT,
  tax_id TEXT,  -- RFC in Mexico

  -- Settings (flexible JSONB for org-level config)
  settings JSONB DEFAULT '{}'::JSONB,
  -- Typical: { max_communities, subscription_tier, features_enabled }

  -- Branding
  logo_url TEXT,
  primary_color TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,  -- Soft delete
  created_by UUID REFERENCES auth.users(id)
);

-- Index for soft delete queries (exclude deleted)
CREATE INDEX idx_organizations_active
  ON organizations(id)
  WHERE deleted_at IS NULL;

-- Index for slug lookups
CREATE INDEX idx_organizations_slug
  ON organizations(slug)
  WHERE deleted_at IS NULL;

-- Index for status filtering
CREATE INDEX idx_organizations_status
  ON organizations(status)
  WHERE deleted_at IS NULL;

-- Audit trigger
CREATE TRIGGER set_organizations_audit
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Enable RLS immediately (CRITICAL - never skip this!)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE organizations IS
  'Platform-level SaaS customers. Property management companies that operate multiple gated communities.';
COMMENT ON COLUMN organizations.slug IS
  'URL-friendly unique identifier. Used in subdomains or paths.';
COMMENT ON COLUMN organizations.settings IS
  'Flexible JSONB for org-level configuration (subscription tier, feature flags, limits).';
COMMENT ON COLUMN organizations.deleted_at IS
  'Soft delete timestamp. When set, record is considered deleted but preserved for audit.';
