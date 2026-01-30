-- ============================================
-- PARKING SPOTS AND ASSIGNMENTS TABLES
-- Phase 8 Plan 04 Task 2: Parking Inventory
-- ============================================
-- Core parking infrastructure tables:
-- - parking_spots: Inventory of all parking spaces
-- - parking_assignments: Links spots to units with validity periods
-- Includes trigger for denormalized assigned_unit_id maintenance.

-- ============================================
-- PARKING SPOTS TABLE
-- ============================================
-- Master inventory of all parking spots in a community

CREATE TABLE parking_spots (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  spot_number TEXT NOT NULL,  -- e.g., "A-01", "V-05", "D-01"

  -- Classification
  spot_type parking_spot_type NOT NULL,
  status parking_spot_status NOT NULL DEFAULT 'available',

  -- Location information
  area TEXT,        -- e.g., "Building A", "Outdoor", "Basement 1"
  level TEXT,       -- e.g., "P1", "Ground", "Level 2"
  section TEXT,     -- e.g., "North", "East Wing"

  -- Physical characteristics
  is_covered BOOLEAN NOT NULL DEFAULT false,
  is_electric_vehicle BOOLEAN NOT NULL DEFAULT false,
  width_meters NUMERIC(4,2),   -- For oversized vehicles
  length_meters NUMERIC(4,2),

  -- Denormalized assignment reference (for quick lookups)
  -- Updated automatically by trigger on parking_assignments
  assigned_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  -- Pricing (for rental spots)
  monthly_fee money_amount DEFAULT 0,

  -- Notes
  notes TEXT,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Unique spot number within community
  CONSTRAINT parking_spots_unique_number
    UNIQUE (community_id, spot_number)
);

-- Table comment
COMMENT ON TABLE parking_spots IS
  'Inventory of all parking spots in a community.
   Tracks location, type, physical characteristics, and current status.
   assigned_unit_id is denormalized from parking_assignments for quick lookups.';

COMMENT ON COLUMN parking_spots.spot_number IS
  'Unique identifier within community. Convention: TYPE-NUMBER (A-01, V-05, D-01).
   A=Assigned, V=Visitor, D=Disabled, L=Loading, R=Reserved.';

COMMENT ON COLUMN parking_spots.assigned_unit_id IS
  'Denormalized from parking_assignments for quick lookup.
   Automatically updated by sync_parking_spot_assignment trigger.';

COMMENT ON COLUMN parking_spots.monthly_fee IS
  'Monthly rental/maintenance fee for the spot. 0 if included with unit.';

-- ============================================
-- PARKING ASSIGNMENTS TABLE
-- ============================================
-- Links parking spots to units with validity periods

CREATE TABLE parking_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  parking_spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,

  -- Optional vehicle (spot assigned but vehicle may not be specified yet)
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,

  -- Validity period
  assigned_from DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_until DATE,  -- NULL = permanent/indefinite

  -- Assignment type
  assignment_type parking_assignment_type NOT NULL DEFAULT 'ownership',

  -- Pricing (for rentals)
  monthly_rate money_amount,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Notes
  notes TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure assigned_from <= assigned_until when both present
  CONSTRAINT parking_assignments_valid_dates
    CHECK (assigned_until IS NULL OR assigned_from <= assigned_until)
);

-- Table comment
COMMENT ON TABLE parking_assignments IS
  'Links parking spots to units with validity periods.
   Supports ownership, rental, and temporary assignment types.
   Only one active assignment per spot allowed (partial unique index).';

COMMENT ON COLUMN parking_assignments.assigned_until IS
  'End date of assignment. NULL means permanent/indefinite assignment.';

COMMENT ON COLUMN parking_assignments.is_active IS
  'Whether this assignment is currently active.
   Partial unique index enforces one active assignment per spot.';

-- ============================================
-- PARTIAL UNIQUE INDEX: ONE ACTIVE ASSIGNMENT PER SPOT
-- ============================================

CREATE UNIQUE INDEX parking_assignments_one_active
  ON parking_assignments(parking_spot_id)
  WHERE is_active = true;

COMMENT ON INDEX parking_assignments_one_active IS
  'Ensures only one active assignment per parking spot.
   Multiple historical assignments (is_active=false) are allowed.';

-- ============================================
-- TRIGGER: SYNC PARKING_SPOTS.ASSIGNED_UNIT_ID
-- ============================================
-- Maintains denormalized assigned_unit_id on parking_spots table

CREATE OR REPLACE FUNCTION sync_parking_spot_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_spot_id UUID;
  v_active_unit_id UUID;
BEGIN
  -- Determine which spot was affected
  IF TG_OP = 'DELETE' THEN
    v_spot_id := OLD.parking_spot_id;
  ELSE
    v_spot_id := NEW.parking_spot_id;
  END IF;

  -- Also handle old spot if spot changed
  IF TG_OP = 'UPDATE' AND OLD.parking_spot_id != NEW.parking_spot_id THEN
    -- Clear assignment on old spot
    UPDATE public.parking_spots
    SET assigned_unit_id = NULL, updated_at = now()
    WHERE id = OLD.parking_spot_id;
  END IF;

  -- Find current active assignment for the spot
  SELECT unit_id INTO v_active_unit_id
  FROM public.parking_assignments
  WHERE parking_spot_id = v_spot_id
    AND is_active = true
  LIMIT 1;

  -- Update the parking_spots table
  UPDATE public.parking_spots
  SET
    assigned_unit_id = v_active_unit_id,
    updated_at = now()
  WHERE id = v_spot_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION sync_parking_spot_assignment() IS
  'Maintains denormalized assigned_unit_id on parking_spots table.
   Triggered by INSERT/UPDATE/DELETE on parking_assignments.';

-- Create the trigger
CREATE TRIGGER sync_parking_spot_assignment_trigger
  AFTER INSERT OR UPDATE OR DELETE ON parking_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_parking_spot_assignment();

-- ============================================
-- INDEXES
-- ============================================

-- Parking spots: by community and type (for availability queries)
CREATE INDEX idx_parking_spots_community_type
  ON parking_spots(community_id, spot_type)
  WHERE deleted_at IS NULL;

-- Parking spots: by status (for operational dashboard)
CREATE INDEX idx_parking_spots_status
  ON parking_spots(community_id, status)
  WHERE deleted_at IS NULL;

-- Parking spots: assigned spots lookup
CREATE INDEX idx_parking_spots_assigned
  ON parking_spots(assigned_unit_id)
  WHERE deleted_at IS NULL AND assigned_unit_id IS NOT NULL;

-- Parking assignments: by unit (for unit profile)
CREATE INDEX idx_parking_assignments_unit
  ON parking_assignments(unit_id)
  WHERE is_active = true;

-- Parking assignments: by spot (for history)
CREATE INDEX idx_parking_assignments_spot
  ON parking_assignments(parking_spot_id, assigned_from DESC);

-- ============================================
-- TRIGGERS: AUDIT
-- ============================================

CREATE TRIGGER set_parking_spots_audit
  BEFORE INSERT OR UPDATE ON parking_spots
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER set_parking_assignments_audit
  BEFORE INSERT OR UPDATE ON parking_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete for parking spots
CREATE TRIGGER soft_delete_parking_spots
  BEFORE DELETE ON parking_spots
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE parking_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_assignments ENABLE ROW LEVEL SECURITY;

-- =====================
-- PARKING SPOTS RLS
-- =====================

-- Super admin: full access
CREATE POLICY super_admin_all_parking_spots ON parking_spots
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Community members: view spots in their community
CREATE POLICY users_view_parking_spots ON parking_spots
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Staff: full CRUD on community spots
CREATE POLICY staff_manage_parking_spots ON parking_spots
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

-- =====================
-- PARKING ASSIGNMENTS RLS
-- =====================

-- Super admin: full access
CREATE POLICY super_admin_all_parking_assignments ON parking_assignments
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Community members: view their own unit's assignments
CREATE POLICY users_view_own_parking_assignments ON parking_assignments
  FOR SELECT
  TO authenticated
  USING (
    unit_id IN (
      SELECT o.unit_id
      FROM occupancies o
      WHERE o.resident_id = auth.uid()
        AND o.status = 'active'
        AND o.deleted_at IS NULL
    )
  );

-- Staff: full CRUD on community assignments
CREATE POLICY staff_manage_parking_assignments ON parking_assignments
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

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get all available spots by type for a community
CREATE OR REPLACE FUNCTION get_available_parking_spots(
  p_community_id UUID,
  p_spot_type parking_spot_type DEFAULT NULL
)
RETURNS TABLE (
  spot_id UUID,
  spot_number TEXT,
  spot_type parking_spot_type,
  area TEXT,
  is_covered BOOLEAN,
  is_electric_vehicle BOOLEAN,
  monthly_fee money_amount
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ps.id AS spot_id,
    ps.spot_number,
    ps.spot_type,
    ps.area,
    ps.is_covered,
    ps.is_electric_vehicle,
    ps.monthly_fee
  FROM public.parking_spots ps
  WHERE ps.community_id = p_community_id
    AND ps.status = 'available'
    AND ps.assigned_unit_id IS NULL
    AND ps.deleted_at IS NULL
    AND (p_spot_type IS NULL OR ps.spot_type = p_spot_type)
  ORDER BY ps.area, ps.spot_number;
$$;

COMMENT ON FUNCTION get_available_parking_spots IS
  'Returns all available (unassigned) parking spots for a community.
   Optionally filter by spot type.';

-- Get spots assigned to a unit
CREATE OR REPLACE FUNCTION get_unit_parking_spots(p_unit_id UUID)
RETURNS TABLE (
  spot_id UUID,
  spot_number TEXT,
  spot_type parking_spot_type,
  area TEXT,
  is_covered BOOLEAN,
  assignment_type parking_assignment_type,
  vehicle_plates TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ps.id AS spot_id,
    ps.spot_number,
    ps.spot_type,
    ps.area,
    ps.is_covered,
    pa.assignment_type,
    v.plate_number AS vehicle_plates
  FROM public.parking_spots ps
  JOIN public.parking_assignments pa ON pa.parking_spot_id = ps.id
  LEFT JOIN public.vehicles v ON v.id = pa.vehicle_id
  WHERE pa.unit_id = p_unit_id
    AND pa.is_active = true
    AND ps.deleted_at IS NULL
  ORDER BY ps.spot_number;
$$;

COMMENT ON FUNCTION get_unit_parking_spots IS
  'Returns all parking spots currently assigned to a unit.
   Includes vehicle plates if a vehicle is linked to the assignment.';
