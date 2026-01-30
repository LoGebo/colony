-- Migration: Packages and Storage Locations Tables
-- Plan: 07-01 (Package Management Schema)
-- Creates package tracking with state machine and storage location management

-- ============================================
-- PACKAGE STORAGE LOCATIONS TABLE
-- ============================================
-- Tracks mailroom organization (shelves, lockers, etc.)

CREATE TABLE package_storage_locations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Location identification
  name TEXT NOT NULL,  -- e.g., "Shelf A-1", "Locker 5"
  location_type TEXT NOT NULL CHECK (location_type IN ('shelf', 'locker', 'floor', 'refrigerator')),

  -- Physical position
  area TEXT,           -- e.g., "Mailroom", "Guard Booth", "Lobby"
  row_number TEXT,     -- Row identifier
  shelf_number TEXT,   -- Shelf within row

  -- Capacity tracking
  max_packages INTEGER,           -- NULL = unlimited
  current_count INTEGER NOT NULL DEFAULT 0,

  -- Availability
  is_available BOOLEAN NOT NULL DEFAULT true,

  -- Audit columns (no soft delete for locations - just deactivate)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique location names per community
  CONSTRAINT uq_storage_location_name UNIQUE (community_id, name),

  -- Current count cannot exceed max
  CONSTRAINT chk_storage_capacity CHECK (
    max_packages IS NULL OR current_count <= max_packages
  )
);

-- Update timestamp trigger
CREATE TRIGGER set_storage_location_timestamp
  BEFORE UPDATE ON package_storage_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE package_storage_locations IS
  'Storage locations for packages in community mailroom/guard booth.
   Tracks capacity and current usage for space management.';

-- ============================================
-- PACKAGES TABLE
-- ============================================
-- Main package tracking with state machine

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Carrier information
  carrier package_carrier NOT NULL,
  carrier_other TEXT,  -- Used when carrier = 'other'
  tracking_number TEXT,

  -- Recipient information
  recipient_resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  recipient_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  recipient_name TEXT NOT NULL,

  -- Package details
  description TEXT,
  package_count INTEGER NOT NULL DEFAULT 1 CHECK (package_count > 0),
  is_oversized BOOLEAN NOT NULL DEFAULT false,
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  is_perishable BOOLEAN NOT NULL DEFAULT false,

  -- Photos (URLs to storage bucket)
  photo_url TEXT,        -- Photo of package
  label_photo_url TEXT,  -- Photo of shipping label

  -- Storage assignment
  storage_location_id UUID REFERENCES package_storage_locations(id) ON DELETE SET NULL,

  -- State machine
  status package_status NOT NULL DEFAULT 'received',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Timeline timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stored_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  picked_up_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Retention policy
  retention_days INTEGER NOT NULL DEFAULT 14 CHECK (retention_days > 0),
  abandonment_date DATE GENERATED ALWAYS AS ((received_at::DATE + retention_days)) STORED,

  -- Notes
  special_instructions TEXT,  -- e.g., "Fragile", "Keep refrigerated"
  staff_notes TEXT,           -- Internal notes

  -- Standard audit columns with soft delete
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Carrier 'other' requires explanation
  CONSTRAINT chk_carrier_other CHECK (
    carrier != 'other' OR carrier_other IS NOT NULL
  )
);

-- Update timestamp trigger
CREATE TRIGGER set_packages_timestamp
  BEFORE UPDATE ON packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE packages IS
  'Package tracking with carrier info, recipient details, storage location, and state machine.
   Status transitions are validated by trigger to enforce state machine rules.';

COMMENT ON COLUMN packages.abandonment_date IS
  'Auto-calculated date when package becomes abandoned if not picked up.
   Based on received_at + retention_days.';

-- ============================================
-- STATE MACHINE TRIGGER
-- ============================================
-- Validates status transitions and auto-sets timestamps

CREATE OR REPLACE FUNCTION validate_package_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_valid_transitions TEXT[];
BEGIN
  -- Only validate on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions for each state
  CASE OLD.status
    WHEN 'received' THEN
      v_valid_transitions := ARRAY['stored', 'returned'];
    WHEN 'stored' THEN
      v_valid_transitions := ARRAY['notified', 'returned'];
    WHEN 'notified' THEN
      v_valid_transitions := ARRAY['pending_pickup', 'returned'];
    WHEN 'pending_pickup' THEN
      v_valid_transitions := ARRAY['picked_up', 'abandoned', 'returned', 'forwarded'];
    WHEN 'abandoned' THEN
      v_valid_transitions := ARRAY['returned'];
    -- Terminal states: picked_up, forwarded, returned (no transitions allowed)
    WHEN 'picked_up' THEN
      v_valid_transitions := ARRAY[]::TEXT[];
    WHEN 'forwarded' THEN
      v_valid_transitions := ARRAY[]::TEXT[];
    WHEN 'returned' THEN
      v_valid_transitions := ARRAY[]::TEXT[];
    ELSE
      v_valid_transitions := ARRAY[]::TEXT[];
  END CASE;

  -- Validate transition
  IF NOT (NEW.status::TEXT = ANY(v_valid_transitions)) THEN
    RAISE EXCEPTION 'Invalid package status transition from % to %', OLD.status, NEW.status
      USING HINT = 'Valid transitions: ' || array_to_string(v_valid_transitions, ', ');
  END IF;

  -- Auto-set status_changed_at
  NEW.status_changed_at := now();

  -- Auto-set relevant timestamp based on new status
  CASE NEW.status
    WHEN 'stored' THEN
      NEW.stored_at := now();
    WHEN 'notified' THEN
      NEW.notified_at := now();
    WHEN 'picked_up' THEN
      NEW.picked_up_at := now();
    ELSE
      -- No additional timestamp for other states
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER package_transition_trigger
  BEFORE UPDATE ON packages
  FOR EACH ROW
  EXECUTE FUNCTION validate_package_transition();

COMMENT ON FUNCTION validate_package_transition IS
  'Enforces package status state machine:
   received -> stored, returned
   stored -> notified, returned
   notified -> pending_pickup, returned
   pending_pickup -> picked_up/abandoned/returned/forwarded
   abandoned -> returned
   picked_up/forwarded/returned are terminal (no further transitions)';

-- ============================================
-- STORAGE COUNT TRIGGERS
-- ============================================
-- Maintain current_count on storage locations

CREATE OR REPLACE FUNCTION update_storage_location_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' AND NEW.storage_location_id IS NOT NULL THEN
    UPDATE package_storage_locations
    SET current_count = current_count + 1
    WHERE id = NEW.storage_location_id;
    RETURN NEW;
  END IF;

  -- Handle UPDATE (storage location change or soft delete)
  IF TG_OP = 'UPDATE' THEN
    -- Decrement old location if changed or soft deleted
    IF (OLD.storage_location_id IS NOT NULL AND
        (OLD.storage_location_id != NEW.storage_location_id OR NEW.deleted_at IS NOT NULL)) THEN
      UPDATE package_storage_locations
      SET current_count = current_count - 1
      WHERE id = OLD.storage_location_id;
    END IF;

    -- Increment new location if changed and not deleted
    IF (NEW.storage_location_id IS NOT NULL AND NEW.deleted_at IS NULL AND
        (OLD.storage_location_id IS NULL OR OLD.storage_location_id != NEW.storage_location_id)) THEN
      UPDATE package_storage_locations
      SET current_count = current_count + 1
      WHERE id = NEW.storage_location_id;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle DELETE (hard delete - rare)
  IF TG_OP = 'DELETE' AND OLD.storage_location_id IS NOT NULL THEN
    UPDATE package_storage_locations
    SET current_count = current_count - 1
    WHERE id = OLD.storage_location_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER package_storage_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON packages
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_location_count();

COMMENT ON FUNCTION update_storage_location_count IS
  'Maintains current_count on package_storage_locations when packages are assigned/moved/deleted.';

-- ============================================
-- INDEXES
-- ============================================

-- Main query patterns
CREATE INDEX idx_packages_community_status
  ON packages(community_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_packages_recipient
  ON packages(recipient_unit_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_packages_tracking
  ON packages(tracking_number)
  WHERE tracking_number IS NOT NULL AND deleted_at IS NULL;

-- Abandonment monitoring
CREATE INDEX idx_packages_abandonment
  ON packages(abandonment_date)
  WHERE status = 'pending_pickup' AND deleted_at IS NULL;

-- Storage location queries
CREATE INDEX idx_packages_storage_location
  ON packages(storage_location_id)
  WHERE storage_location_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_storage_locations_community
  ON package_storage_locations(community_id, is_available);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE package_storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Storage Locations: Super admins
CREATE POLICY "super_admin_all_storage_locations"
  ON package_storage_locations
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

-- Storage Locations: Community members can view
CREATE POLICY "community_view_storage_locations"
  ON package_storage_locations
  FOR SELECT
  TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Storage Locations: Staff can manage
CREATE POLICY "staff_manage_storage_locations"
  ON package_storage_locations
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- Packages: Super admins
CREATE POLICY "super_admin_all_packages"
  ON packages
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

-- Packages: Staff can full CRUD
CREATE POLICY "staff_manage_packages"
  ON packages
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- Packages: Residents can view their own unit's packages
CREATE POLICY "residents_view_unit_packages"
  ON packages
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND recipient_unit_id IN (
      SELECT unit_id FROM occupancies
      WHERE resident_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN packages.carrier_other IS
  'Description when carrier = other. Required by CHECK constraint.';

COMMENT ON COLUMN packages.storage_location_id IS
  'Current storage location. Triggers maintain location current_count.';

COMMENT ON COLUMN packages.status IS
  'Current lifecycle state. Transitions validated by trigger.';

COMMENT ON COLUMN package_storage_locations.current_count IS
  'Auto-maintained count of packages in this location via trigger.';

COMMENT ON COLUMN package_storage_locations.max_packages IS
  'Maximum capacity. NULL means unlimited. CHECK prevents over-allocation.';
