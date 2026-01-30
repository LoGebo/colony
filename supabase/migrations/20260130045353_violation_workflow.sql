-- ============================================
-- VIOLATION WORKFLOW AUTOMATION
-- ============================================
-- Phase 8 Plan 07: Violation Tracking
--
-- Creates:
-- - calculate_offense_number() trigger for automatic offense counting
-- - violation_appeals table for formal appeal process
-- - update_violation_on_appeal() trigger for status updates
-- - issue_sanction() function for sanction creation with financial integration
-- - get_violation_history() function for escalation decisions

-- ============================================
-- CALCULATE OFFENSE NUMBER TRIGGER
-- ============================================
-- Automatically calculates offense number for new violations
-- Counts previous violations of same type for same unit in last 12 months
-- Only counts violations with status: confirmed, sanctioned, appeal_denied, closed

CREATE OR REPLACE FUNCTION calculate_offense_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
  v_previous_id UUID;
BEGIN
  -- Count previous violations of same type for same unit in last 12 months
  -- Only count violations that "count" (confirmed, sanctioned, appeal_denied, closed)
  SELECT COUNT(*), MAX(id)
  INTO v_count, v_previous_id
  FROM public.violations
  WHERE community_id = NEW.community_id
    AND unit_id = NEW.unit_id
    AND violation_type_id = NEW.violation_type_id
    AND occurred_at >= (NEW.occurred_at - INTERVAL '12 months')
    AND occurred_at < NEW.occurred_at
    AND status IN ('confirmed', 'sanctioned', 'appeal_denied', 'closed')
    AND deleted_at IS NULL
    AND id != NEW.id;  -- Exclude self (for updates)

  -- Set offense number (count + 1 for current violation)
  NEW.offense_number := v_count + 1;

  -- Link to most recent previous violation
  NEW.previous_violation_id := v_previous_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION calculate_offense_number IS 'Calculates offense number within 12-month window. Only counts confirmed/sanctioned violations.';

-- Create trigger (must drop first if exists to avoid duplicate)
DROP TRIGGER IF EXISTS violations_offense_number ON violations;
CREATE TRIGGER violations_offense_number
  BEFORE INSERT ON violations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_offense_number();

-- ============================================
-- VIOLATION APPEALS TABLE
-- ============================================
-- Formal appeal process for violations

CREATE TABLE violation_appeals (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
  sanction_id UUID REFERENCES violation_sanctions(id) ON DELETE SET NULL,

  -- Appellant information
  appealed_by UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Appeal content
  appeal_reason TEXT NOT NULL,
  supporting_documents TEXT[],

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted',          -- Initial submission
    'under_review',       -- Being reviewed
    'hearing_scheduled',  -- Hearing date set
    'granted',            -- Appeal accepted (violation voided)
    'denied',             -- Appeal rejected
    'withdrawn'           -- Appellant withdrew appeal
  )),

  -- Hearing details
  hearing_date DATE,
  hearing_notes TEXT,

  -- Decision details
  decision TEXT,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,

  -- Relief granted (if appeal granted or partially granted)
  fine_reduced_to money_amount,
  sanction_modified_to TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE violation_appeals IS 'Formal appeal process for violations with hearing support';
COMMENT ON COLUMN violation_appeals.sanction_id IS 'Optional: specific sanction being appealed (if not the whole violation)';
COMMENT ON COLUMN violation_appeals.status IS 'Workflow: submitted->under_review->hearing_scheduled->granted/denied OR withdrawn';
COMMENT ON COLUMN violation_appeals.fine_reduced_to IS 'If appeal partially granted, new fine amount';

-- ============================================
-- UPDATE VIOLATION ON APPEAL TRIGGER
-- ============================================
-- Updates violation and sanction status when appeal status changes

CREATE OR REPLACE FUNCTION update_violation_on_appeal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- On new appeal submission: mark violation as appealed
  IF TG_OP = 'INSERT' THEN
    UPDATE public.violations
    SET status = 'appealed',
        updated_at = now()
    WHERE id = NEW.violation_id;

    -- If specific sanction is being appealed, mark it too
    IF NEW.sanction_id IS NOT NULL THEN
      UPDATE public.violation_sanctions
      SET status = 'appealed'
      WHERE id = NEW.sanction_id;
    END IF;

    RETURN NEW;
  END IF;

  -- On appeal decision: update violation status
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'granted' THEN
      -- Appeal granted: violation is voided
      UPDATE public.violations
      SET status = 'appeal_granted',
          resolved_at = now(),
          resolved_by = NEW.decided_by,
          resolution_notes = COALESCE(resolution_notes, '') || 'Appeal granted: ' || COALESCE(NEW.decision, 'No details provided'),
          updated_at = now()
      WHERE id = NEW.violation_id;

      -- Cancel any sanctions
      UPDATE public.violation_sanctions
      SET status = 'cancelled'
      WHERE violation_id = NEW.violation_id;

    ELSIF NEW.status = 'denied' THEN
      -- Appeal denied: violation stands
      UPDATE public.violations
      SET status = 'appeal_denied',
          updated_at = now()
      WHERE id = NEW.violation_id;

      -- Restore sanction status if it was specific to one sanction
      IF NEW.sanction_id IS NOT NULL THEN
        UPDATE public.violation_sanctions
        SET status = 'notified'  -- Return to notified so it can proceed
        WHERE id = NEW.sanction_id;
      END IF;

    ELSIF NEW.status = 'withdrawn' THEN
      -- Appellant withdrew: violation returns to sanctioned status
      UPDATE public.violations
      SET status = 'sanctioned',
          updated_at = now()
      WHERE id = NEW.violation_id;

      -- Restore sanction status
      IF NEW.sanction_id IS NOT NULL THEN
        UPDATE public.violation_sanctions
        SET status = 'notified'
        WHERE id = NEW.sanction_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_violation_on_appeal IS 'Updates violation and sanction status based on appeal decisions';

CREATE TRIGGER violation_appeal_status
  AFTER INSERT OR UPDATE ON violation_appeals
  FOR EACH ROW
  EXECUTE FUNCTION update_violation_on_appeal();

-- ============================================
-- ISSUE SANCTION FUNCTION
-- ============================================
-- Creates a sanction for a violation, optionally creating a financial charge

CREATE OR REPLACE FUNCTION issue_sanction(
  p_violation_id UUID,
  p_sanction_type sanction_type,
  p_description TEXT,
  p_fine_amount money_amount DEFAULT NULL,
  p_suspension_start DATE DEFAULT NULL,
  p_suspension_end DATE DEFAULT NULL,
  p_suspended_amenities UUID[] DEFAULT NULL,
  p_issued_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sanction_id UUID;
  v_violation RECORD;
  v_transaction_id UUID;
BEGIN
  -- Get violation details
  SELECT v.*, vt.name AS type_name
  INTO v_violation
  FROM public.violations v
  JOIN public.violation_types vt ON v.violation_type_id = vt.id
  WHERE v.id = p_violation_id
    AND v.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violation not found: %', p_violation_id;
  END IF;

  -- Validate sanction type requirements
  IF p_sanction_type = 'fine' AND (p_fine_amount IS NULL OR p_fine_amount <= 0) THEN
    RAISE EXCEPTION 'Fine sanction requires a positive fine_amount';
  END IF;

  IF p_sanction_type IN ('amenity_suspension', 'access_restriction') THEN
    IF p_suspension_start IS NULL OR p_suspension_end IS NULL THEN
      RAISE EXCEPTION 'Suspension sanctions require suspension_start and suspension_end dates';
    END IF;
    IF p_suspension_end < p_suspension_start THEN
      RAISE EXCEPTION 'suspension_end must be after suspension_start';
    END IF;
  END IF;

  -- Create the sanction record
  INSERT INTO public.violation_sanctions (
    violation_id,
    sanction_type,
    description,
    fine_amount,
    suspension_start,
    suspension_end,
    suspended_amenities,
    issued_by,
    issued_at
  ) VALUES (
    p_violation_id,
    p_sanction_type,
    p_description,
    p_fine_amount,
    p_suspension_start,
    p_suspension_end,
    p_suspended_amenities,
    p_issued_by,
    now()
  ) RETURNING id INTO v_sanction_id;

  -- If this is a fine, create a charge in the financial system
  IF p_sanction_type = 'fine' AND p_fine_amount > 0 THEN
    -- Use record_charge if available
    BEGIN
      v_transaction_id := public.record_charge(
        v_violation.community_id,
        v_violation.unit_id,
        p_fine_amount,
        CURRENT_DATE,
        'Violation Fine: ' || v_violation.type_name || ' - ' || v_violation.violation_number,
        NULL,  -- No fee_structure_id
        p_issued_by
      );

      -- Link transaction to sanction
      UPDATE public.violation_sanctions
      SET transaction_id = v_transaction_id
      WHERE id = v_sanction_id;
    EXCEPTION WHEN OTHERS THEN
      -- If record_charge fails, continue without financial integration
      RAISE NOTICE 'Could not create financial charge: %', SQLERRM;
    END;
  END IF;

  -- Update violation status to sanctioned
  UPDATE public.violations
  SET status = 'sanctioned',
      updated_at = now()
  WHERE id = p_violation_id;

  RETURN v_sanction_id;
END;
$$;

COMMENT ON FUNCTION issue_sanction IS 'Issues a sanction for a violation. For fines, creates a charge in the financial system.';

-- ============================================
-- GET VIOLATION HISTORY FUNCTION
-- ============================================
-- Returns violation history for a unit for escalation decisions

CREATE OR REPLACE FUNCTION get_violation_history(
  p_unit_id UUID,
  p_months INTEGER DEFAULT 12
)
RETURNS TABLE (
  violation_id UUID,
  violation_number TEXT,
  violation_type_name TEXT,
  violation_type_category TEXT,
  severity violation_severity,
  offense_number INTEGER,
  occurred_at TIMESTAMPTZ,
  status TEXT,
  sanction_types TEXT[],
  total_fines money_amount,
  appeal_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id AS violation_id,
    v.violation_number,
    vt.name AS violation_type_name,
    vt.category AS violation_type_category,
    v.severity,
    v.offense_number,
    v.occurred_at,
    v.status,
    ARRAY_AGG(DISTINCT vs.sanction_type::TEXT) FILTER (WHERE vs.id IS NOT NULL) AS sanction_types,
    COALESCE(SUM(vs.fine_amount) FILTER (WHERE vs.sanction_type = 'fine'), 0::money_amount) AS total_fines,
    MAX(va.status) AS appeal_status
  FROM public.violations v
  JOIN public.violation_types vt ON v.violation_type_id = vt.id
  LEFT JOIN public.violation_sanctions vs ON v.id = vs.violation_id
  LEFT JOIN public.violation_appeals va ON v.id = va.violation_id
  WHERE v.unit_id = p_unit_id
    AND v.occurred_at >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
    AND v.deleted_at IS NULL
  GROUP BY v.id, v.violation_number, vt.name, vt.category, v.severity, v.offense_number, v.occurred_at, v.status
  ORDER BY v.occurred_at DESC;
END;
$$;

COMMENT ON FUNCTION get_violation_history IS 'Returns violation history for a unit within specified months. Useful for escalation decisions.';

-- ============================================
-- INDEXES
-- ============================================

-- Violation appeals: by violation
CREATE INDEX idx_violation_appeals_violation ON violation_appeals(violation_id);

-- Violation appeals: by appellant
CREATE INDEX idx_violation_appeals_appellant ON violation_appeals(appealed_by);

-- Violation appeals: pending appeals
CREATE INDEX idx_violation_appeals_pending ON violation_appeals(status)
  WHERE status IN ('submitted', 'under_review', 'hearing_scheduled');

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger for violation_appeals
CREATE TRIGGER set_violation_appeals_audit
  BEFORE INSERT OR UPDATE ON violation_appeals
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger for violation_appeals
CREATE TRIGGER soft_delete_violation_appeals
  BEFORE DELETE ON violation_appeals
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE violation_appeals ENABLE ROW LEVEL SECURITY;

-- Residents can INSERT their own appeals (for violations on their unit)
CREATE POLICY violation_appeals_insert_own ON violation_appeals
  FOR INSERT
  WITH CHECK (
    appealed_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM violations v
      JOIN occupancies o ON o.unit_id = v.unit_id
      WHERE v.id = violation_id
        AND o.resident_id = (SELECT auth.uid())
        AND o.status = 'active'
        AND o.deleted_at IS NULL
    )
  );

-- Residents can SELECT their own appeals
CREATE POLICY violation_appeals_select_own ON violation_appeals
  FOR SELECT
  USING (
    appealed_by = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Staff can SELECT all appeals in their community
CREATE POLICY violation_appeals_select_staff ON violation_appeals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM violations v
      WHERE v.id = violation_id
        AND v.community_id = (SELECT get_current_community_id())
        AND v.deleted_at IS NULL
    )
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'staff')
  );

-- Staff can UPDATE appeals (for review, hearing, decisions)
CREATE POLICY violation_appeals_update_staff ON violation_appeals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM violations v
      WHERE v.id = violation_id
        AND v.community_id = (SELECT get_current_community_id())
        AND v.deleted_at IS NULL
    )
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Residents can UPDATE their own appeals (to withdraw)
CREATE POLICY violation_appeals_update_own ON violation_appeals
  FOR UPDATE
  USING (
    appealed_by = (SELECT auth.uid())
    AND deleted_at IS NULL
    AND status IN ('submitted', 'under_review')  -- Can only withdraw before decision
  );

-- No delete policy - appeals are permanent record

-- ============================================
-- ENABLE AUDIT TRACKING (if function exists)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enable_tracking' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'audit')) THEN
    PERFORM audit.enable_tracking('public.violation_appeals'::regclass);
  END IF;
END $$;
