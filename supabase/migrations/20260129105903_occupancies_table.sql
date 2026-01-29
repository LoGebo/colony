-- Occupancies: junction table linking residents to units with relationship type
CREATE TABLE occupancies (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Role is part of the uniqueness constraint
  -- Allows same person to be owner AND authorized in same unit
  occupancy_type occupancy_type NOT NULL,

  -- Validity period
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- For tenants: can link to property owner
  authorized_by UUID REFERENCES residents(id),

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Prevents duplicate role assignments for same person in same unit
  CONSTRAINT occupancies_unique_role
    UNIQUE (unit_id, resident_id, occupancy_type)
);

-- Enable RLS
ALTER TABLE occupancies ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_occupancies_audit
  BEFORE INSERT OR UPDATE ON occupancies
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes for common queries
CREATE INDEX idx_occupancies_unit ON occupancies(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_occupancies_resident ON occupancies(resident_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_occupancies_community ON occupancies(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_occupancies_active ON occupancies(community_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

-- RLS Policies

-- Super admins full access
CREATE POLICY "super_admins_full_access_occupancies"
  ON occupancies
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can view occupancies in their community
CREATE POLICY "users_view_own_community_occupancies"
  ON occupancies
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Admins can manage occupancies
CREATE POLICY "admins_manage_occupancies"
  ON occupancies
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

-- Comments
COMMENT ON TABLE occupancies IS 'Junction table: resident-unit relationships with occupancy_type role';
COMMENT ON COLUMN occupancies.occupancy_type IS 'Role: owner, tenant, authorized - same person can have multiple roles';
COMMENT ON CONSTRAINT occupancies_unique_role ON occupancies IS 'Prevents duplicate role per person-unit, but allows multiple roles';
