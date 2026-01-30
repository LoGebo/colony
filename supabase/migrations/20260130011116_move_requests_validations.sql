-- Migration: Move requests and validations tables
-- Phase: 07-operations-compliance
-- Plan: 03 (Move Coordination)
-- Description: Move scheduling with auto-generated validation checklists

--------------------------------------------------------------------------------
-- move_requests table
--------------------------------------------------------------------------------

CREATE TABLE move_requests (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Who is moving
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,

  -- Move direction
  move_type move_type NOT NULL,

  -- Requested scheduling
  requested_date DATE NOT NULL,
  requested_time_start TIME,
  requested_time_end TIME,

  -- Confirmed scheduling (after approval)
  confirmed_date DATE,
  confirmed_time_start TIME,
  confirmed_time_end TIME,

  -- Moving company details
  moving_company_name TEXT,
  moving_company_phone TEXT,
  moving_company_vehicle_plates TEXT[], -- Array for multiple trucks
  estimated_duration_hours INTEGER,

  -- Facility reservations
  elevator_reserved BOOLEAN DEFAULT false,
  loading_dock_reserved BOOLEAN DEFAULT false,

  -- Status tracking
  status move_status NOT NULL DEFAULT 'requested',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation summary (updated by trigger)
  all_validations_passed BOOLEAN DEFAULT false,

  -- Notes
  resident_notes TEXT,
  admin_notes TEXT,

  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT move_requests_time_range_valid CHECK (
    requested_time_start IS NULL OR requested_time_end IS NULL
    OR requested_time_start < requested_time_end
  ),
  CONSTRAINT move_requests_confirmed_time_range_valid CHECK (
    confirmed_time_start IS NULL OR confirmed_time_end IS NULL
    OR confirmed_time_start < confirmed_time_end
  ),
  CONSTRAINT move_requests_completed_requires_status CHECK (
    (completed_at IS NULL) OR (status = 'completed')
  )
);

COMMENT ON TABLE move_requests IS 'Move-in/move-out requests with scheduling and validation workflow';
COMMENT ON COLUMN move_requests.moving_company_vehicle_plates IS 'Array of license plates for moving trucks';
COMMENT ON COLUMN move_requests.all_validations_passed IS 'Auto-updated by trigger when all validations pass';

-- Indexes
CREATE INDEX idx_move_requests_community_status
  ON move_requests(community_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_move_requests_unit
  ON move_requests(unit_id, requested_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_move_requests_active_date
  ON move_requests(requested_date)
  WHERE status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL;

CREATE INDEX idx_move_requests_resident
  ON move_requests(resident_id)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- move_validations table
--------------------------------------------------------------------------------

CREATE TABLE move_validations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  move_request_id UUID NOT NULL REFERENCES move_requests(id) ON DELETE CASCADE,

  -- Validation type
  validation_type TEXT NOT NULL CHECK (validation_type IN (
    'debt_free',            -- No outstanding balance
    'keys_returned',        -- All keys/access devices returned
    'vehicles_updated',     -- Vehicle registry updated
    'pets_updated',         -- Pet registry updated
    'parking_cleared',      -- Parking spot vacated
    'utility_transfer',     -- Utilities transferred/cancelled
    'inspection_scheduled', -- Final inspection scheduled
    'deposit_review',       -- Damage deposit review complete
    'documentation_signed'  -- Required paperwork signed
  )),

  -- Status
  status validation_status NOT NULL DEFAULT 'pending',

  -- Check details
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES auth.users(id),
  notes TEXT,

  -- Specific to debt_free validation
  balance_at_check NUMERIC(12,2),

  -- Waiver info (if status = 'waived')
  waiver_reason TEXT,
  waived_by UUID REFERENCES auth.users(id),

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),

  -- Unique constraint: one validation per type per move request
  CONSTRAINT move_validations_unique UNIQUE (move_request_id, validation_type),

  -- Waiver requires waiver_reason
  CONSTRAINT move_validations_waiver_requires_reason CHECK (
    status != 'waived' OR waiver_reason IS NOT NULL
  )
);

COMMENT ON TABLE move_validations IS 'Pre-move validation checklist items, auto-generated based on move type';
COMMENT ON COLUMN move_validations.balance_at_check IS 'Captures unit balance at time of debt_free check';

-- Indexes
CREATE INDEX idx_move_validations_request
  ON move_validations(move_request_id);

CREATE INDEX idx_move_validations_pending
  ON move_validations(move_request_id)
  WHERE status = 'pending';

--------------------------------------------------------------------------------
-- Trigger: Auto-generate validations on move request creation
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_move_validations()
RETURNS TRIGGER AS $$
BEGIN
  -- For move_out: Create comprehensive validation checklist
  IF NEW.move_type = 'move_out' THEN
    INSERT INTO move_validations (move_request_id, validation_type, created_by)
    VALUES
      (NEW.id, 'debt_free', NEW.created_by),
      (NEW.id, 'keys_returned', NEW.created_by),
      (NEW.id, 'vehicles_updated', NEW.created_by),
      (NEW.id, 'pets_updated', NEW.created_by),
      (NEW.id, 'parking_cleared', NEW.created_by),
      (NEW.id, 'inspection_scheduled', NEW.created_by),
      (NEW.id, 'deposit_review', NEW.created_by);

  -- For move_in: Create minimal validation checklist
  ELSIF NEW.move_type = 'move_in' THEN
    INSERT INTO move_validations (move_request_id, validation_type, created_by)
    VALUES
      (NEW.id, 'documentation_signed', NEW.created_by),
      (NEW.id, 'deposit_review', NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_move_validations
  AFTER INSERT ON move_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_move_validations();

COMMENT ON FUNCTION create_move_validations() IS 'Auto-generates validation checklist based on move type';

--------------------------------------------------------------------------------
-- Trigger: Update validation summary when validations change
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_validation_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_all_passed BOOLEAN;
  v_request_id UUID;
BEGIN
  -- Get the move_request_id from the affected row
  v_request_id := COALESCE(NEW.move_request_id, OLD.move_request_id);

  -- Check if all validations for this request are passed or waived
  SELECT NOT EXISTS (
    SELECT 1
    FROM move_validations
    WHERE move_request_id = v_request_id
      AND status NOT IN ('passed', 'waived')
  ) INTO v_all_passed;

  -- Update the move_request
  UPDATE move_requests
  SET all_validations_passed = v_all_passed,
      updated_at = now()
  WHERE id = v_request_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_validation_summary
  AFTER INSERT OR UPDATE OR DELETE ON move_validations
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_summary();

COMMENT ON FUNCTION update_validation_summary() IS 'Updates move_requests.all_validations_passed when validations change';

--------------------------------------------------------------------------------
-- Trigger: Update move_requests.status_changed_at on status change
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_move_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_move_status_timestamp
  BEFORE UPDATE ON move_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_move_status_timestamp();

--------------------------------------------------------------------------------
-- Helper function: Check if unit is debt-free
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_debt_free(p_unit_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance NUMERIC(12,2);
BEGIN
  -- Query from unit_balances view (created in Phase 4)
  SELECT COALESCE(current_balance, 0) INTO v_balance
  FROM unit_balances
  WHERE unit_id = p_unit_id;

  -- Return true if balance is zero or credit (negative = overpayment)
  RETURN COALESCE(v_balance, 0) <= 0;
EXCEPTION
  WHEN undefined_table THEN
    -- If unit_balances doesn't exist yet, return true (no debt tracking)
    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_debt_free(UUID) IS 'Checks if unit has zero or credit balance in unit_balances view';

--------------------------------------------------------------------------------
-- Trigger: Auto-update debt_free validation status
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_check_debt_free()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_id UUID;
  v_is_debt_free BOOLEAN;
  v_balance NUMERIC(12,2);
BEGIN
  -- Only process debt_free validations when status changes to 'pending'
  -- or when explicitly checked (checked_at is set)
  IF NEW.validation_type = 'debt_free' AND
     (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.checked_at IS NOT NULL AND OLD.checked_at IS NULL)) THEN

    -- Get the unit_id from the move_request
    SELECT unit_id INTO v_unit_id
    FROM move_requests
    WHERE id = NEW.move_request_id;

    -- Check debt status
    v_is_debt_free := check_debt_free(v_unit_id);

    -- Get current balance for record
    SELECT COALESCE(current_balance, 0) INTO v_balance
    FROM unit_balances
    WHERE unit_id = v_unit_id;

    -- Update validation with result
    IF v_is_debt_free THEN
      NEW.status := 'passed';
    ELSE
      NEW.status := 'failed';
    END IF;

    NEW.balance_at_check := COALESCE(v_balance, 0);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN undefined_table THEN
    -- If unit_balances doesn't exist, mark as passed (no debt system)
    IF NEW.validation_type = 'debt_free' THEN
      NEW.status := 'passed';
      NEW.balance_at_check := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_check_debt_free
  BEFORE INSERT OR UPDATE ON move_validations
  FOR EACH ROW
  EXECUTE FUNCTION auto_check_debt_free();

--------------------------------------------------------------------------------
-- RLS Policies
--------------------------------------------------------------------------------

ALTER TABLE move_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_validations ENABLE ROW LEVEL SECURITY;

-- move_requests policies
CREATE POLICY move_requests_select ON move_requests
  FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY move_requests_insert ON move_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
  );

CREATE POLICY move_requests_update ON move_requests
  FOR UPDATE TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY move_requests_delete ON move_requests
  FOR DELETE TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
  );

-- move_validations policies
CREATE POLICY move_validations_select ON move_validations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM move_requests mr
      WHERE mr.id = move_validations.move_request_id
        AND mr.community_id = (SELECT get_current_community_id())
        AND mr.deleted_at IS NULL
    )
  );

CREATE POLICY move_validations_insert ON move_validations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM move_requests mr
      WHERE mr.id = move_validations.move_request_id
        AND mr.community_id = (SELECT get_current_community_id())
    )
  );

CREATE POLICY move_validations_update ON move_validations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM move_requests mr
      WHERE mr.id = move_validations.move_request_id
        AND mr.community_id = (SELECT get_current_community_id())
        AND mr.deleted_at IS NULL
    )
  );

CREATE POLICY move_validations_delete ON move_validations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM move_requests mr
      WHERE mr.id = move_validations.move_request_id
        AND mr.community_id = (SELECT get_current_community_id())
    )
  );

--------------------------------------------------------------------------------
-- Audit triggers (uses set_audit_fields from foundation)
--------------------------------------------------------------------------------

CREATE TRIGGER set_move_requests_audit
  BEFORE INSERT OR UPDATE ON move_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER set_move_validations_audit
  BEFORE INSERT OR UPDATE ON move_validations
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();
