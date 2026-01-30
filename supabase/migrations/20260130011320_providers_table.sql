-- Migration: Providers Table
-- Phase: 07-operations-compliance
-- Plan: 02 - Provider Management
-- Description: Service provider companies with status workflow, specialties, and rating

-- ==================================================================
-- PROVIDERS TABLE
-- ==================================================================
-- Third-party service companies (cleaning, landscaping, security, etc.)

CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Company identification
  company_name TEXT NOT NULL,
  legal_name TEXT,          -- Official registered name
  rfc TEXT,                 -- Mexican tax ID (RFC)

  -- Primary contact
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone phone_number NOT NULL,  -- Reuse domain from Phase 2
  address TEXT,

  -- Services offered
  specialties TEXT[] NOT NULL,  -- e.g., ['plumbing', 'electrical', 'cleaning']

  -- Status workflow
  status provider_status NOT NULL DEFAULT 'pending_approval',

  -- Rating (computed from work orders)
  average_rating NUMERIC(3,2),  -- e.g., 4.75
  total_work_orders INTEGER NOT NULL DEFAULT 0,

  -- Approval tracking
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Notes
  notes TEXT,

  -- Standard audit columns with soft delete
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Approval consistency: both NULL or both NOT NULL
  CONSTRAINT chk_approval_consistency CHECK (
    (approved_at IS NULL AND approved_by IS NULL) OR
    (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  )
);

-- ==================================================================
-- INDEXES
-- ==================================================================

-- Main query patterns
CREATE INDEX idx_providers_community_status
  ON providers(community_id, status)
  WHERE deleted_at IS NULL;

-- Search by specialties (GIN for array containment queries)
CREATE INDEX idx_providers_specialties
  ON providers USING GIN(specialties);

-- ==================================================================
-- ROW LEVEL SECURITY
-- ==================================================================

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Super admins: full access
CREATE POLICY "super_admin_all_providers"
  ON providers
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

-- Admins/managers: full CRUD for their community
CREATE POLICY "admin_manager_full_providers"
  ON providers
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Guards: can SELECT active providers only
CREATE POLICY "guard_view_active_providers"
  ON providers
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND status = 'active'
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) = 'guard'
  );

-- Providers themselves: can view their own record via provider_id in JWT
-- This requires app_metadata.provider_id to be set
CREATE POLICY "provider_view_self"
  ON providers
  FOR SELECT
  TO authenticated
  USING (
    id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'provider_id')::UUID,
      '00000000-0000-0000-0000-000000000000'::UUID
    )
    AND deleted_at IS NULL
  );

-- ==================================================================
-- TRIGGERS
-- ==================================================================

-- Audit fields trigger
CREATE TRIGGER set_providers_audit
  BEFORE INSERT OR UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER providers_soft_delete
  BEFORE DELETE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- ==================================================================
-- COMMENTS
-- ==================================================================

COMMENT ON TABLE providers IS
  'Third-party service provider companies with status workflow and rating.
   Specialties array enables filtering by service type.
   Rating computed from provider_work_orders (created separately).';

COMMENT ON COLUMN providers.rfc IS 'Mexican tax ID (Registro Federal de Contribuyentes)';
COMMENT ON COLUMN providers.specialties IS 'Array of service types: plumbing, electrical, cleaning, landscaping, security, etc.';
COMMENT ON COLUMN providers.average_rating IS 'Auto-computed average from work order ratings (1-5 scale)';
COMMENT ON COLUMN providers.status IS 'Workflow: pending_approval -> active -> suspended/inactive';
