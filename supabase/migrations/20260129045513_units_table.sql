-- Units table: properties within a community
-- Migration: 20260129045513_units_table.sql

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  unit_number TEXT NOT NULL,           -- "A-101", "Casa 5", etc.
  unit_type unit_type NOT NULL,        -- casa, departamento, local, bodega, estacionamiento, otro

  -- Physical characteristics
  area_m2 NUMERIC(10,2),               -- Square meters
  floor_number INTEGER,                -- NULL for houses
  building TEXT,                       -- Building/tower name if applicable

  -- Coefficient for fee calculation (Mexican indiviso)
  -- Sum of all coefficients in a community should equal 100
  coefficient NUMERIC(7,4) NOT NULL DEFAULT 0,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Address details (for houses, may differ from community address)
  address_line TEXT,

  -- Parking spaces included (separate from estacionamiento unit type)
  parking_spaces INTEGER NOT NULL DEFAULT 0,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique unit number within community
  CONSTRAINT units_community_number_unique
    UNIQUE (community_id, unit_number)
);

-- Enable RLS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Audit trigger (from Phase 1)
CREATE TRIGGER set_units_audit
  BEFORE INSERT OR UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes for performance
CREATE INDEX idx_units_community ON units(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_units_type ON units(community_id, unit_type) WHERE deleted_at IS NULL;

-- RLS Policies (following Phase 1 patterns)

-- Super admins can do everything
CREATE POLICY "super_admins_full_access_units"
  ON units
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can view units in their community
CREATE POLICY "users_view_own_community_units"
  ON units
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Admins and managers can insert/update units
CREATE POLICY "admins_manage_units"
  ON units
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

-- Comment for documentation
COMMENT ON TABLE units IS 'Properties within a community: apartments, houses, commercial spaces, storage units';
COMMENT ON COLUMN units.coefficient IS 'Mexican indiviso - percentage for fee calculation, sum should equal 100 per community';
COMMENT ON COLUMN units.unit_type IS 'Property type from unit_type enum: casa, departamento, local, bodega, estacionamiento, otro';
