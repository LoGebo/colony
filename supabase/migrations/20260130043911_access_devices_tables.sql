-- ============================================
-- ACCESS DEVICE INVENTORY AND ASSIGNMENT TABLES
-- ============================================
-- Phase 08-05: Access Device Lifecycle Management
-- Device type definitions, inventory tracking, and assignment records

-- ============================================
-- ACCESS DEVICE TYPES TABLE
-- ============================================
-- Define device categories with deposit and replacement fees

CREATE TABLE access_device_types (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Device category
  device_type device_type NOT NULL,

  -- Naming
  name TEXT NOT NULL,                      -- e.g., "Main Gate Remote", "Building A Tag"
  description TEXT,

  -- Access point restrictions (NULL = all access points)
  access_point_ids UUID[],                 -- Which access points this type can open

  -- Fees
  deposit_amount money_amount DEFAULT 0,   -- Refundable deposit collected on assignment
  replacement_fee money_amount DEFAULT 0,  -- Fee charged if lost/damaged

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Each device type name must be unique per community
  CONSTRAINT access_device_types_name_unique UNIQUE (community_id, name)
);

COMMENT ON TABLE access_device_types IS
  'Device type definitions per community with deposit and replacement fee configuration.
   access_point_ids NULL means device can open all community access points.';

COMMENT ON COLUMN access_device_types.access_point_ids IS
  'Array of access_point IDs this device type can open. NULL = all access points.';
COMMENT ON COLUMN access_device_types.deposit_amount IS
  'Refundable deposit collected when device is assigned.';
COMMENT ON COLUMN access_device_types.replacement_fee IS
  'Fee charged if device is lost or damaged beyond repair.';

-- ============================================
-- ACCESS DEVICES TABLE
-- ============================================
-- Individual device inventory with serial numbers

CREATE TABLE access_devices (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  device_type_id UUID NOT NULL REFERENCES access_device_types(id) ON DELETE RESTRICT,

  -- Identification
  serial_number TEXT NOT NULL,             -- Manufacturer serial number
  internal_code TEXT,                      -- RFID code, key number, etc.

  -- Batch/procurement info
  batch_number TEXT,                       -- Purchase batch tracking
  purchased_at DATE,                       -- Date of purchase
  vendor TEXT,                             -- Where purchased from

  -- Status tracking
  status device_status NOT NULL DEFAULT 'in_inventory',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Current assignment (denormalized for quick lookup)
  current_assignment_id UUID,              -- Updated by trigger

  -- Lost device tracking
  lost_reported_at TIMESTAMPTZ,
  lost_reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Damage tracking
  damaged_reported_at TIMESTAMPTZ,
  damage_notes TEXT,

  -- Deactivation tracking
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deactivation_reason TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Serial number unique per community
  CONSTRAINT access_devices_serial_unique UNIQUE (community_id, serial_number)
);

COMMENT ON TABLE access_devices IS
  'Individual access device inventory with serial numbers and status tracking.
   current_assignment_id is maintained by trigger for O(1) assignment lookup.';

COMMENT ON COLUMN access_devices.serial_number IS
  'Manufacturer serial number - must be unique per community.';
COMMENT ON COLUMN access_devices.internal_code IS
  'Device-specific identifier (RFID code, key cut number, transponder ID).';
COMMENT ON COLUMN access_devices.current_assignment_id IS
  'Denormalized: current active assignment. Updated by trigger.';

-- ============================================
-- ACCESS DEVICE ASSIGNMENTS TABLE
-- ============================================
-- Track device assignments to units, residents, guards, or providers

CREATE TABLE access_device_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  access_device_id UUID NOT NULL REFERENCES access_devices(id) ON DELETE RESTRICT,

  -- Polymorphic assignee (exactly one must be set)
  unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID REFERENCES residents(id) ON DELETE RESTRICT,
  guard_id UUID REFERENCES guards(id) ON DELETE RESTRICT,
  provider_personnel_id UUID REFERENCES provider_personnel(id) ON DELETE RESTRICT,

  -- Assignment details
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Return details (NULL until returned)
  returned_at TIMESTAMPTZ,
  returned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Deposit tracking
  deposit_collected BOOLEAN NOT NULL DEFAULT false,
  deposit_amount money_amount,
  deposit_returned_at TIMESTAMPTZ,

  -- Return condition (NULL until returned)
  return_condition TEXT CHECK (return_condition IN ('good', 'damaged', 'lost', 'not_returned')),
  condition_notes TEXT,

  -- Fee tracking
  replacement_fee_charged BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Exactly one assignee must be set
  CONSTRAINT assignments_exactly_one_assignee CHECK (
    (unit_id IS NOT NULL)::INT +
    (resident_id IS NOT NULL)::INT +
    (guard_id IS NOT NULL)::INT +
    (provider_personnel_id IS NOT NULL)::INT = 1
  ),

  -- Return condition requires return timestamp
  CONSTRAINT assignments_return_requires_timestamp CHECK (
    return_condition IS NULL OR returned_at IS NOT NULL
  )
);

COMMENT ON TABLE access_device_assignments IS
  'Device assignment history. is_active=true for current assignment.
   Polymorphic assignee: exactly one of unit_id, resident_id, guard_id, provider_personnel_id.';

COMMENT ON COLUMN access_device_assignments.deposit_collected IS
  'Whether deposit was collected at assignment time.';
COMMENT ON COLUMN access_device_assignments.deposit_returned_at IS
  'When deposit was returned (only for good condition returns).';
COMMENT ON COLUMN access_device_assignments.replacement_fee_charged IS
  'Whether replacement fee was charged (for lost/damaged returns).';

-- One active assignment per device
CREATE UNIQUE INDEX access_device_assignments_one_active
  ON access_device_assignments(access_device_id)
  WHERE is_active = true;

COMMENT ON INDEX access_device_assignments_one_active IS
  'Ensures only one active assignment exists per device at any time.';

-- ============================================
-- INDEXES
-- ============================================

-- access_device_types indexes
CREATE INDEX idx_access_device_types_community
  ON access_device_types(community_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_access_device_types_active
  ON access_device_types(community_id, device_type)
  WHERE is_active = true AND deleted_at IS NULL;

-- access_devices indexes
CREATE INDEX idx_access_devices_community_status
  ON access_devices(community_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_access_devices_serial
  ON access_devices(community_id, serial_number)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_access_devices_type
  ON access_devices(device_type_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_access_devices_available
  ON access_devices(community_id, device_type_id)
  WHERE status = 'in_inventory' AND deleted_at IS NULL;

-- access_device_assignments indexes
CREATE INDEX idx_access_device_assignments_device
  ON access_device_assignments(access_device_id);

CREATE INDEX idx_access_device_assignments_resident
  ON access_device_assignments(resident_id)
  WHERE resident_id IS NOT NULL AND is_active = true;

CREATE INDEX idx_access_device_assignments_unit
  ON access_device_assignments(unit_id)
  WHERE unit_id IS NOT NULL AND is_active = true;

CREATE INDEX idx_access_device_assignments_guard
  ON access_device_assignments(guard_id)
  WHERE guard_id IS NOT NULL AND is_active = true;

CREATE INDEX idx_access_device_assignments_provider
  ON access_device_assignments(provider_personnel_id)
  WHERE provider_personnel_id IS NOT NULL AND is_active = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE access_device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_device_assignments ENABLE ROW LEVEL SECURITY;

-- access_device_types RLS
CREATE POLICY "super_admin_all_device_types"
  ON access_device_types FOR ALL TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

CREATE POLICY "community_members_view_device_types"
  ON access_device_types FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "admin_manager_manage_device_types"
  ON access_device_types FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- access_devices RLS
CREATE POLICY "super_admin_all_devices"
  ON access_devices FOR ALL TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

CREATE POLICY "residents_view_devices"
  ON access_devices FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "staff_manage_devices"
  ON access_devices FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- access_device_assignments RLS
CREATE POLICY "super_admin_all_assignments"
  ON access_device_assignments FOR ALL TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

CREATE POLICY "residents_view_own_assignments"
  ON access_device_assignments FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND resident_id = auth.uid()
  );

CREATE POLICY "staff_manage_assignments"
  ON access_device_assignments FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit triggers
CREATE TRIGGER set_access_device_types_audit
  BEFORE INSERT OR UPDATE ON access_device_types
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER access_device_types_soft_delete
  BEFORE DELETE ON access_device_types
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

CREATE TRIGGER set_access_devices_audit
  BEFORE INSERT OR UPDATE ON access_devices
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER access_devices_soft_delete
  BEFORE DELETE ON access_devices
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

CREATE TRIGGER set_access_device_assignments_audit
  BEFORE INSERT OR UPDATE ON access_device_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();
