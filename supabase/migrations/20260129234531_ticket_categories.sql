-- ============================================================================
-- TICKET CATEGORIES TABLE
-- Phase 6, Plan 1: Maintenance Ticketing Foundation
-- ============================================================================
-- Community-specific maintenance categories with optional hierarchy
-- Examples: Plomeria, Electricidad, Jardineria, Limpieza, Seguridad
-- ============================================================================

--------------------------------------------------------------------------------
-- TICKET_CATEGORIES TABLE
--------------------------------------------------------------------------------

CREATE TABLE ticket_categories (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Category identification
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                              -- Icon name or emoji for UI
  color TEXT,                             -- Hex color for UI (e.g., '#FF5733')

  -- Hierarchy support (optional subcategories)
  parent_category_id UUID REFERENCES ticket_categories(id) ON DELETE SET NULL,

  -- Default assignment
  default_assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  escalation_contact_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Default SLA times (overridable in sla_definitions)
  default_response_hours INTEGER,         -- Hours to first response
  default_resolution_hours INTEGER,       -- Hours to resolution

  -- Status and ordering
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Unique category names within community
  CONSTRAINT ticket_categories_unique_name UNIQUE (community_id, name)
);

-- Comments
COMMENT ON TABLE ticket_categories IS 'Community-specific maintenance ticket categories with optional hierarchy';
COMMENT ON COLUMN ticket_categories.parent_category_id IS 'For subcategories, e.g., Electricidad > Iluminacion';
COMMENT ON COLUMN ticket_categories.default_response_hours IS 'Default response time SLA, can be overridden in sla_definitions';
COMMENT ON COLUMN ticket_categories.default_resolution_hours IS 'Default resolution time SLA, can be overridden in sla_definitions';

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

-- Category listing for community
CREATE INDEX idx_ticket_categories_community_active
  ON ticket_categories(community_id, is_active, sort_order)
  WHERE deleted_at IS NULL;

-- Parent category lookup
CREATE INDEX idx_ticket_categories_parent
  ON ticket_categories(parent_category_id)
  WHERE parent_category_id IS NOT NULL AND deleted_at IS NULL;

--------------------------------------------------------------------------------
-- AUDIT TRIGGER
--------------------------------------------------------------------------------

CREATE TRIGGER ticket_categories_audit_trigger
  BEFORE INSERT OR UPDATE ON ticket_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY super_admin_all_ticket_categories ON ticket_categories
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Community members can view active categories
CREATE POLICY users_view_ticket_categories ON ticket_categories
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Community admins can manage categories
CREATE POLICY admins_manage_ticket_categories ON ticket_categories
  FOR ALL
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );
