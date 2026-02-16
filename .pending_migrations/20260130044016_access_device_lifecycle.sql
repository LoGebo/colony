-- ============================================
-- ACCESS DEVICE LIFECYCLE MANAGEMENT
-- ============================================
-- Phase 08-05: Access Device Lifecycle Management
-- Event logging, assignment workflow, and lifecycle functions

-- ============================================
-- ACCESS DEVICE EVENTS TABLE
-- ============================================
-- Complete audit trail for device lifecycle events

CREATE TABLE access_device_events (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  access_device_id UUID NOT NULL REFERENCES access_devices(id) ON DELETE RESTRICT,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',        -- Device added to inventory
    'assigned',       -- Device assigned to someone
    'returned',       -- Device returned
    'lost',           -- Device reported lost
    'found',          -- Lost device recovered
    'damaged',        -- Device damaged
    'deactivated',    -- Device security deactivated
    'reactivated',    -- Device restored to service
    'retired'         -- Device permanently retired
  )),

  -- Event description
  description TEXT NOT NULL,

  -- Additional event data
  metadata JSONB DEFAULT '{}',

  -- Who performed the action
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- When it happened
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE access_device_events IS
  'Immutable audit trail for all device lifecycle events.
   Events are append-only; never updated or deleted.';

COMMENT ON COLUMN access_device_events.metadata IS
  'Additional event data: assignment_id, condition, notes, etc.';

-- Index for device event history
CREATE INDEX idx_access_device_events_device
  ON access_device_events(access_device_id, occurred_at DESC);

-- ============================================
-- DEVICE EVENT LOGGING FUNCTION
-- ============================================
-- Helper function to log device events

CREATE OR REPLACE FUNCTION log_device_event(
  p_device_id UUID,
  p_event_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.access_device_events (
    access_device_id,
    event_type,
    description,
    metadata,
    performed_by
  )
  VALUES (
    p_device_id,
    p_event_type,
    p_description,
    p_metadata,
    auth.uid()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION log_device_event IS
  'Helper function to log device lifecycle events with current user.';

-- ============================================
-- DEVICE STATUS UPDATE TRIGGER
-- ============================================
-- Update device status when assignments change

CREATE OR REPLACE FUNCTION update_device_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device RECORD;
  v_new_status public.device_status;
  v_event_type TEXT;
  v_description TEXT;
  v_metadata JSONB;
BEGIN
  -- Get device information
  SELECT * INTO v_device
  FROM public.access_devices
  WHERE id = NEW.access_device_id;

  -- Handle new assignment
  IF TG_OP = 'INSERT' THEN
    -- Update device status to assigned
    UPDATE public.access_devices
    SET
      status = 'assigned',
      status_changed_at = now(),
      current_assignment_id = NEW.id
    WHERE id = NEW.access_device_id;

    -- Log assignment event
    v_metadata := jsonb_build_object(
      'assignment_id', NEW.id,
      'unit_id', NEW.unit_id,
      'resident_id', NEW.resident_id,
      'guard_id', NEW.guard_id,
      'provider_personnel_id', NEW.provider_personnel_id,
      'deposit_collected', NEW.deposit_collected,
      'deposit_amount', NEW.deposit_amount
    );

    PERFORM public.log_device_event(
      NEW.access_device_id,
      'assigned',
      'Device assigned',
      v_metadata
    );

    RETURN NEW;
  END IF;

  -- Handle return (update on existing assignment)
  IF TG_OP = 'UPDATE' AND OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    -- Determine new status based on return condition
    CASE NEW.return_condition
      WHEN 'good' THEN
        v_new_status := 'in_inventory';
        v_event_type := 'returned';
        v_description := 'Device returned in good condition';
      WHEN 'damaged' THEN
        v_new_status := 'damaged';
        v_event_type := 'damaged';
        v_description := 'Device returned damaged';
      WHEN 'lost' THEN
        v_new_status := 'lost';
        v_event_type := 'lost';
        v_description := 'Device reported lost';
      WHEN 'not_returned' THEN
        v_new_status := 'lost';
        v_event_type := 'lost';
        v_description := 'Device not returned (marked as lost)';
      ELSE
        v_new_status := 'in_inventory';
        v_event_type := 'returned';
        v_description := 'Device returned';
    END CASE;

    -- Update device status
    UPDATE public.access_devices
    SET
      status = v_new_status,
      status_changed_at = now(),
      current_assignment_id = NULL
    WHERE id = NEW.access_device_id;

    -- Mark assignment as inactive
    NEW.is_active := false;

    -- Log return event
    v_metadata := jsonb_build_object(
      'assignment_id', NEW.id,
      'return_condition', NEW.return_condition,
      'condition_notes', NEW.condition_notes,
      'deposit_returned', NEW.deposit_returned_at IS NOT NULL,
      'replacement_fee_charged', NEW.replacement_fee_charged
    );

    PERFORM public.log_device_event(
      NEW.access_device_id,
      v_event_type,
      v_description,
      v_metadata
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER access_device_assignment_status
  AFTER INSERT OR UPDATE ON access_device_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_device_on_assignment();

COMMENT ON FUNCTION update_device_on_assignment IS
  'Trigger function to update device status on assignment/return.
   - INSERT: Sets device to assigned, logs event
   - UPDATE (return): Sets status based on condition, marks assignment inactive';

-- ============================================
-- ASSIGN DEVICE FUNCTION
-- ============================================
-- Safely assign a device with validation and deposit tracking

CREATE OR REPLACE FUNCTION assign_device(
  p_device_id UUID,
  p_unit_id UUID DEFAULT NULL,
  p_resident_id UUID DEFAULT NULL,
  p_guard_id UUID DEFAULT NULL,
  p_provider_personnel_id UUID DEFAULT NULL,
  p_collect_deposit BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device RECORD;
  v_device_type RECORD;
  v_assignment_id UUID;
  v_assignee_count INT;
BEGIN
  -- Validate exactly one assignee
  v_assignee_count := (p_unit_id IS NOT NULL)::INT +
                      (p_resident_id IS NOT NULL)::INT +
                      (p_guard_id IS NOT NULL)::INT +
                      (p_provider_personnel_id IS NOT NULL)::INT;

  IF v_assignee_count != 1 THEN
    RAISE EXCEPTION 'Exactly one assignee (unit_id, resident_id, guard_id, or provider_personnel_id) must be provided';
  END IF;

  -- Get device and validate status
  SELECT * INTO v_device
  FROM public.access_devices
  WHERE id = p_device_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found: %', p_device_id;
  END IF;

  IF v_device.status != 'in_inventory' THEN
    RAISE EXCEPTION 'Device is not available for assignment. Current status: %', v_device.status;
  END IF;

  -- Get device type for deposit amount
  SELECT * INTO v_device_type
  FROM public.access_device_types
  WHERE id = v_device.device_type_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device type not found for device: %', p_device_id;
  END IF;

  -- Create assignment
  INSERT INTO public.access_device_assignments (
    community_id,
    access_device_id,
    unit_id,
    resident_id,
    guard_id,
    provider_personnel_id,
    assigned_by,
    deposit_collected,
    deposit_amount
  )
  VALUES (
    v_device.community_id,
    p_device_id,
    p_unit_id,
    p_resident_id,
    p_guard_id,
    p_provider_personnel_id,
    auth.uid(),
    p_collect_deposit,
    CASE WHEN p_collect_deposit THEN v_device_type.deposit_amount ELSE NULL END
  )
  RETURNING id INTO v_assignment_id;

  -- Device status update handled by trigger

  RETURN v_assignment_id;
END;
$$;

COMMENT ON FUNCTION assign_device IS
  'Safely assign a device to a unit, resident, guard, or provider personnel.
   Validates device availability, creates assignment, and optionally records deposit.
   Returns: assignment_id UUID
   Usage: SELECT assign_device(device_id, unit_id := ''...'', p_collect_deposit := true);';

-- ============================================
-- RETURN DEVICE FUNCTION
-- ============================================
-- Process device return with condition tracking

CREATE OR REPLACE FUNCTION return_device(
  p_assignment_id UUID,
  p_condition TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignment RECORD;
  v_device_type RECORD;
  v_charge_fee BOOLEAN := false;
  v_return_deposit BOOLEAN := false;
BEGIN
  -- Validate condition
  IF p_condition NOT IN ('good', 'damaged', 'lost', 'not_returned') THEN
    RAISE EXCEPTION 'Invalid return condition: %. Must be good, damaged, lost, or not_returned', p_condition;
  END IF;

  -- Get and lock assignment
  SELECT a.*, d.device_type_id
  INTO v_assignment
  FROM public.access_device_assignments a
  JOIN public.access_devices d ON d.id = a.access_device_id
  WHERE a.id = p_assignment_id
    AND a.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active assignment not found: %', p_assignment_id;
  END IF;

  -- Get device type for fee information
  SELECT * INTO v_device_type
  FROM public.access_device_types
  WHERE id = v_assignment.device_type_id
    AND deleted_at IS NULL;

  -- Determine deposit/fee handling
  IF p_condition = 'good' AND v_assignment.deposit_collected THEN
    v_return_deposit := true;
  ELSIF p_condition IN ('damaged', 'lost', 'not_returned') THEN
    v_charge_fee := true;
  END IF;

  -- Update assignment
  UPDATE public.access_device_assignments
  SET
    returned_at = now(),
    returned_to = auth.uid(),
    return_condition = p_condition,
    condition_notes = p_notes,
    deposit_returned_at = CASE WHEN v_return_deposit THEN now() ELSE NULL END,
    replacement_fee_charged = v_charge_fee
  WHERE id = p_assignment_id;

  -- Device status update and event logging handled by trigger
END;
$$;

COMMENT ON FUNCTION return_device IS
  'Process device return with condition-based status updates.
   - good: Device returns to inventory, deposit returned
   - damaged: Device marked damaged, replacement fee may apply
   - lost/not_returned: Device marked lost, replacement fee charged
   Usage: SELECT return_device(assignment_id, ''good'', ''Device in perfect condition'');';

-- ============================================
-- REPORT DEVICE LOST FUNCTION
-- ============================================
-- Report a device as lost with automatic fee handling

CREATE OR REPLACE FUNCTION report_device_lost(
  p_device_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignment_id UUID;
  v_device RECORD;
BEGIN
  -- Get device and current assignment
  SELECT d.*, ada.id AS current_assignment_id
  INTO v_device
  FROM public.access_devices d
  LEFT JOIN public.access_device_assignments ada
    ON ada.access_device_id = d.id AND ada.is_active = true
  WHERE d.id = p_device_id
    AND d.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found: %', p_device_id;
  END IF;

  -- If device has active assignment, return it as lost
  IF v_device.current_assignment_id IS NOT NULL THEN
    PERFORM public.return_device(v_device.current_assignment_id, 'lost', p_notes);
  END IF;

  -- Update device lost tracking fields
  UPDATE public.access_devices
  SET
    lost_reported_at = now(),
    lost_reported_by = auth.uid(),
    status = 'lost',
    status_changed_at = now()
  WHERE id = p_device_id;

  -- Log lost event (additional to return event if assignment existed)
  PERFORM public.log_device_event(
    p_device_id,
    'lost',
    COALESCE(p_notes, 'Device reported lost'),
    jsonb_build_object(
      'had_active_assignment', v_device.current_assignment_id IS NOT NULL,
      'notes', p_notes
    )
  );
END;
$$;

COMMENT ON FUNCTION report_device_lost IS
  'Report a device as lost. If device has active assignment, it is automatically
   returned with lost condition and replacement fee applied.
   Usage: SELECT report_device_lost(device_id, ''Resident claims stolen from car'');';

-- ============================================
-- DEACTIVATE DEVICE FUNCTION
-- ============================================
-- Security deactivate a device

CREATE OR REPLACE FUNCTION deactivate_device(
  p_device_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device RECORD;
BEGIN
  -- Get device
  SELECT * INTO v_device
  FROM public.access_devices
  WHERE id = p_device_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found: %', p_device_id;
  END IF;

  -- Cannot deactivate if currently assigned
  IF v_device.status = 'assigned' THEN
    RAISE EXCEPTION 'Cannot deactivate device that is currently assigned. Return it first.';
  END IF;

  -- Update device status
  UPDATE public.access_devices
  SET
    status = 'deactivated',
    status_changed_at = now(),
    deactivated_at = now(),
    deactivated_by = auth.uid(),
    deactivation_reason = p_reason
  WHERE id = p_device_id;

  -- Log event
  PERFORM public.log_device_event(
    p_device_id,
    'deactivated',
    p_reason,
    jsonb_build_object(
      'previous_status', v_device.status,
      'reason', p_reason
    )
  );
END;
$$;

COMMENT ON FUNCTION deactivate_device IS
  'Security deactivate a device. Device must not be currently assigned.
   Usage: SELECT deactivate_device(device_id, ''Security upgrade - replacing all remotes'');';

-- ============================================
-- REACTIVATE DEVICE FUNCTION
-- ============================================
-- Restore a device to inventory

CREATE OR REPLACE FUNCTION reactivate_device(
  p_device_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device RECORD;
BEGIN
  -- Get device
  SELECT * INTO v_device
  FROM public.access_devices
  WHERE id = p_device_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found: %', p_device_id;
  END IF;

  -- Can only reactivate certain statuses
  IF v_device.status NOT IN ('deactivated', 'lost', 'damaged') THEN
    RAISE EXCEPTION 'Cannot reactivate device with status: %. Must be deactivated, lost, or damaged.', v_device.status;
  END IF;

  -- Update device status
  UPDATE public.access_devices
  SET
    status = 'in_inventory',
    status_changed_at = now(),
    deactivated_at = NULL,
    deactivated_by = NULL,
    deactivation_reason = NULL,
    lost_reported_at = NULL,
    lost_reported_by = NULL,
    damaged_reported_at = NULL,
    damage_notes = NULL
  WHERE id = p_device_id;

  -- Log event
  PERFORM public.log_device_event(
    p_device_id,
    'reactivated',
    'Device restored to inventory',
    jsonb_build_object('previous_status', v_device.status)
  );
END;
$$;

COMMENT ON FUNCTION reactivate_device IS
  'Restore a deactivated, lost, or damaged device to inventory.
   Clears all deactivation/lost/damage tracking fields.
   Usage: SELECT reactivate_device(device_id);';

-- ============================================
-- DEVICE CREATED EVENT TRIGGER
-- ============================================
-- Log event when device is added to inventory

CREATE OR REPLACE FUNCTION log_device_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.log_device_event(
    NEW.id,
    'created',
    'Device added to inventory',
    jsonb_build_object(
      'serial_number', NEW.serial_number,
      'internal_code', NEW.internal_code,
      'device_type_id', NEW.device_type_id,
      'batch_number', NEW.batch_number
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER access_device_created
  AFTER INSERT ON access_devices
  FOR EACH ROW
  EXECUTE FUNCTION log_device_created();

-- ============================================
-- ACCESS DEVICE EVENTS RLS
-- ============================================

ALTER TABLE access_device_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_device_events"
  ON access_device_events FOR ALL TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

CREATE POLICY "staff_view_device_events"
  ON access_device_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.access_devices d
      WHERE d.id = access_device_events.access_device_id
        AND d.community_id = (SELECT get_current_community_id())
    )
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- Prevent direct INSERT/UPDATE/DELETE on events (use functions)
CREATE POLICY "events_insert_via_function"
  ON access_device_events FOR INSERT TO authenticated
  WITH CHECK (false);

-- ============================================
-- INVENTORY SUMMARY VIEW
-- ============================================
-- Summary of device inventory by type and status

CREATE VIEW access_device_inventory AS
SELECT
  adt.community_id,
  adt.id AS device_type_id,
  adt.name AS device_type_name,
  adt.device_type,
  adt.deposit_amount,
  adt.replacement_fee,
  COUNT(ad.id) AS total_devices,
  COUNT(ad.id) FILTER (WHERE ad.status = 'in_inventory') AS available,
  COUNT(ad.id) FILTER (WHERE ad.status = 'assigned') AS assigned,
  COUNT(ad.id) FILTER (WHERE ad.status = 'lost') AS lost,
  COUNT(ad.id) FILTER (WHERE ad.status = 'damaged') AS damaged,
  COUNT(ad.id) FILTER (WHERE ad.status = 'deactivated') AS deactivated,
  COUNT(ad.id) FILTER (WHERE ad.status = 'retired') AS retired
FROM access_device_types adt
LEFT JOIN access_devices ad
  ON ad.device_type_id = adt.id
  AND ad.deleted_at IS NULL
WHERE adt.deleted_at IS NULL
  AND adt.is_active = true
GROUP BY adt.id, adt.community_id, adt.name, adt.device_type,
         adt.deposit_amount, adt.replacement_fee;

COMMENT ON VIEW access_device_inventory IS
  'Summary view of device inventory by type with status counts.
   Use for dashboard displays and inventory reports.';
