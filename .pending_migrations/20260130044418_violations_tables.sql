-- ============================================
-- VIOLATION TRACKING TABLES
-- ============================================
-- Phase 8 Plan 07: Violation Tracking
--
-- Creates tables for:
-- - violation_types: Configurable violation definitions with penalty schedules
-- - violations: Individual violation records with offense tracking
-- - violation_sanctions: Sanctions applied to violations

-- ============================================
-- VIOLATION TYPES TABLE
-- ============================================
-- Configurable violation definitions per community with
-- default severity and escalating penalty schedule

CREATE TABLE violation_types (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Type definition
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'noise', 'parking', 'pet', 'common_area', 'payment', 'behavior', 'property', 'other'
  )),

  -- Default severity for new violations of this type
  default_severity violation_severity NOT NULL DEFAULT 'minor',

  -- Escalation rules
  escalate_after_count INTEGER NOT NULL DEFAULT 3,  -- After N violations, increase severity

  -- Penalty schedule (fines per offense)
  first_offense_fine money_amount DEFAULT 0,
  second_offense_fine money_amount DEFAULT 0,
  third_offense_fine money_amount DEFAULT 0,

  -- Consequence capabilities
  can_suspend_amenities BOOLEAN NOT NULL DEFAULT false,
  can_restrict_access BOOLEAN NOT NULL DEFAULT false,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Unique name per community
  CONSTRAINT violation_types_unique_name UNIQUE (community_id, name)
);

COMMENT ON TABLE violation_types IS 'Configurable violation types per community with default severity and escalating penalty schedule';
COMMENT ON COLUMN violation_types.category IS 'Violation category: noise, parking, pet, common_area, payment, behavior, property, other';
COMMENT ON COLUMN violation_types.escalate_after_count IS 'After N violations of this type, severity escalates';
COMMENT ON COLUMN violation_types.first_offense_fine IS 'Fine amount for first offense (0 = warning only)';
COMMENT ON COLUMN violation_types.can_suspend_amenities IS 'Whether this violation type can result in amenity suspension';
COMMENT ON COLUMN violation_types.can_restrict_access IS 'Whether this violation type can result in access restrictions';

-- ============================================
-- VIOLATIONS TABLE
-- ============================================
-- Individual violation records with automatic offense tracking

CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Auto-generated violation number
  violation_number TEXT NOT NULL,  -- Format: VIOL-YYYY-NNNNN

  -- Violation type and severity
  violation_type_id UUID NOT NULL REFERENCES violation_types(id) ON DELETE RESTRICT,
  severity violation_severity NOT NULL,

  -- Violator identification
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,

  -- Violation details
  description TEXT NOT NULL,
  location TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,

  -- Evidence
  photo_urls TEXT[],
  video_urls TEXT[],
  witness_names TEXT[],

  -- Reporter information
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN (
    'reported',       -- Initial report
    'under_review',   -- Being investigated
    'confirmed',      -- Violation confirmed
    'sanctioned',     -- Sanction issued
    'appealed',       -- Under appeal
    'appeal_denied',  -- Appeal rejected
    'appeal_granted', -- Appeal accepted (violation voided)
    'closed',         -- Resolved
    'dismissed'       -- Dismissed (insufficient evidence)
  )),

  -- Repeat offense tracking (auto-calculated by trigger)
  offense_number INTEGER NOT NULL DEFAULT 1,
  previous_violation_id UUID REFERENCES violations(id) ON DELETE SET NULL,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Unique violation number per community
  CONSTRAINT violations_unique_number UNIQUE (community_id, violation_number)
);

COMMENT ON TABLE violations IS 'Individual violation records with automatic offense tracking within 12-month window';
COMMENT ON COLUMN violations.violation_number IS 'Auto-generated number: VIOL-YYYY-NNNNN';
COMMENT ON COLUMN violations.offense_number IS 'Nth offense of this type by this unit within 12 months (auto-calculated)';
COMMENT ON COLUMN violations.previous_violation_id IS 'Link to previous violation of same type by same unit';
COMMENT ON COLUMN violations.status IS 'Workflow: reported->under_review->confirmed->sanctioned->closed OR appealed->appeal_denied/granted';

-- ============================================
-- GENERATE VIOLATION NUMBER FUNCTION
-- ============================================
-- Generates sequential violation numbers: VIOL-YYYY-NNNNN

CREATE OR REPLACE FUNCTION generate_violation_number(p_community_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get next sequence number for this community/year
  SELECT COALESCE(
    MAX(
      NULLIF(
        REGEXP_REPLACE(violation_number, '^VIOL-' || v_year || '-', ''),
        violation_number
      )::INTEGER
    ),
    0
  ) + 1
  INTO v_sequence
  FROM public.violations
  WHERE community_id = p_community_id
    AND violation_number LIKE 'VIOL-' || v_year || '-%';

  -- Format: VIOL-YYYY-NNNNN (e.g., VIOL-2026-00001)
  v_number := 'VIOL-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');

  RETURN v_number;
END;
$$;

COMMENT ON FUNCTION generate_violation_number IS 'Generates sequential violation numbers: VIOL-YYYY-NNNNN. Sequence resets each year per community.';

-- ============================================
-- AUTO-GENERATE VIOLATION NUMBER TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION set_violation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.violation_number IS NULL OR NEW.violation_number = '' THEN
    NEW.violation_number := public.generate_violation_number(NEW.community_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER violations_auto_number
  BEFORE INSERT ON violations
  FOR EACH ROW
  EXECUTE FUNCTION set_violation_number();

-- ============================================
-- VIOLATION SANCTIONS TABLE
-- ============================================
-- Sanctions applied to violations

CREATE TABLE violation_sanctions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,

  -- Sanction type
  sanction_type sanction_type NOT NULL,
  description TEXT NOT NULL,

  -- Fine details (if sanction_type = 'fine')
  fine_amount money_amount,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  -- Suspension details (if sanction_type = 'amenity_suspension' or 'access_restriction')
  suspension_start DATE,
  suspension_end DATE,
  suspended_amenities UUID[],  -- Array of amenity IDs

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Sanction issued, awaiting notification
    'notified',     -- Violator notified
    'acknowledged', -- Violator acknowledged receipt
    'paid',         -- Fine paid (for fine sanctions)
    'served',       -- Suspension served (for suspension sanctions)
    'appealed',     -- Under appeal
    'cancelled'     -- Cancelled (e.g., appeal granted)
  )),

  -- Notification tracking
  notified_at TIMESTAMPTZ,
  notification_method TEXT CHECK (notification_method IN ('email', 'letter', 'in_person', 'app')),

  -- Issuer information
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Audit (no soft delete for sanctions - they are permanent record)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE violation_sanctions IS 'Sanctions applied to violations (warnings, fines, suspensions)';
COMMENT ON COLUMN violation_sanctions.fine_amount IS 'Fine amount if sanction_type is fine';
COMMENT ON COLUMN violation_sanctions.transaction_id IS 'Link to financial transaction if fine is recorded';
COMMENT ON COLUMN violation_sanctions.suspended_amenities IS 'Array of amenity UUIDs if sanction involves amenity suspension';
COMMENT ON COLUMN violation_sanctions.status IS 'Workflow: pending->notified->acknowledged->paid/served OR appealed->cancelled';

-- ============================================
-- INDEXES
-- ============================================

-- Violation types: lookup by community
CREATE INDEX idx_violation_types_community ON violation_types(community_id)
  WHERE deleted_at IS NULL AND is_active = true;

-- Violation types: lookup by category
CREATE INDEX idx_violation_types_category ON violation_types(community_id, category)
  WHERE deleted_at IS NULL AND is_active = true;

-- Violations: by community and status (most common query)
CREATE INDEX idx_violations_community_status ON violations(community_id, status)
  WHERE deleted_at IS NULL;

-- Violations: by unit for offense counting
CREATE INDEX idx_violations_unit_type ON violations(unit_id, violation_type_id, occurred_at)
  WHERE deleted_at IS NULL;

-- Violations: by resident (find all violations by a person)
CREATE INDEX idx_violations_resident ON violations(resident_id)
  WHERE deleted_at IS NULL AND resident_id IS NOT NULL;

-- Violation sanctions: by violation
CREATE INDEX idx_violation_sanctions_violation ON violation_sanctions(violation_id);

-- Violation sanctions: pending sanctions (for notification queue)
CREATE INDEX idx_violation_sanctions_pending ON violation_sanctions(status)
  WHERE status IN ('pending', 'notified');

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger for violation_types
CREATE TRIGGER set_violation_types_audit
  BEFORE INSERT OR UPDATE ON violation_types
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger for violation_types
CREATE TRIGGER soft_delete_violation_types
  BEFORE DELETE ON violation_types
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- Audit trigger for violations
CREATE TRIGGER set_violations_audit
  BEFORE INSERT OR UPDATE ON violations
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger for violations
CREATE TRIGGER soft_delete_violations
  BEFORE DELETE ON violations
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE violation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_sanctions ENABLE ROW LEVEL SECURITY;

-- Violation types: Community members can SELECT, admins can full CRUD
CREATE POLICY violation_types_select ON violation_types
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY violation_types_insert ON violation_types
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"')
  );

CREATE POLICY violation_types_update ON violation_types
  FOR UPDATE
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"')
  );

CREATE POLICY violation_types_delete ON violation_types
  FOR DELETE
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"')
  );

-- Violations: Staff can full CRUD, residents can SELECT their own unit's violations
CREATE POLICY violations_select_staff ON violations
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"', '"staff"', '"guard"')
  );

CREATE POLICY violations_select_own ON violations
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND unit_id IN (
      SELECT o.unit_id FROM occupancies o
      WHERE o.resident_id = (SELECT auth.uid())
        AND o.status = 'active'
        AND o.deleted_at IS NULL
    )
  );

CREATE POLICY violations_insert ON violations
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"', '"staff"', '"guard"')
  );

CREATE POLICY violations_update ON violations
  FOR UPDATE
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"', '"staff"')
  );

CREATE POLICY violations_delete ON violations
  FOR DELETE
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"')
  );

-- Violation sanctions: Staff can full CRUD, residents can SELECT their own
CREATE POLICY violation_sanctions_select_staff ON violation_sanctions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM violations v
      WHERE v.id = violation_id
        AND v.community_id = (SELECT get_current_community_id())
        AND v.deleted_at IS NULL
    )
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"', '"staff"')
  );

CREATE POLICY violation_sanctions_select_own ON violation_sanctions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM violations v
      WHERE v.id = violation_id
        AND v.community_id = (SELECT get_current_community_id())
        AND v.deleted_at IS NULL
        AND v.unit_id IN (
          SELECT o.unit_id FROM occupancies o
          WHERE o.resident_id = (SELECT auth.uid())
            AND o.status = 'active'
            AND o.deleted_at IS NULL
        )
    )
  );

CREATE POLICY violation_sanctions_insert ON violation_sanctions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM violations v
      WHERE v.id = violation_id
        AND v.community_id = (SELECT get_current_community_id())
        AND v.deleted_at IS NULL
    )
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"', '"staff"')
  );

CREATE POLICY violation_sanctions_update ON violation_sanctions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM violations v
      WHERE v.id = violation_id
        AND v.community_id = (SELECT get_current_community_id())
        AND v.deleted_at IS NULL
    )
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"')
  );

-- No delete policy for sanctions - they are permanent audit trail

-- ============================================
-- ENABLE AUDIT TRACKING
-- ============================================

SELECT audit.enable_tracking('public.violation_types'::regclass);
SELECT audit.enable_tracking('public.violations'::regclass);
