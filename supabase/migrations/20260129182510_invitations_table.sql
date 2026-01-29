-- ============================================
-- INVITATIONS TABLE
-- ============================================
-- Visitor invitations with polymorphic validation
-- Part of Phase 3 Plan 02: Invitations & Access Management
--
-- PATTERN: Polymorphic table with type-specific CHECK constraints
-- Each invitation_type has specific required fields enforced at DB level

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Who created the invitation (resident authorizing visitor)
  created_by_resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  -- Invitation type determines validation rules
  invitation_type invitation_type NOT NULL,

  -- Visitor identification
  visitor_name TEXT NOT NULL,
  visitor_document TEXT,                   -- ID number if known in advance
  visitor_phone phone_number,
  visitor_email TEXT,
  visitor_company TEXT,                    -- Company/organization name

  -- Vehicle pre-authorization (for vehicle_preauth type)
  vehicle_plate TEXT,
  vehicle_plate_normalized TEXT GENERATED ALWAYS AS (
    UPPER(REGEXP_REPLACE(vehicle_plate, '[^A-Z0-9]', '', 'g'))
  ) STORED,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,

  -- Validity window
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,                 -- NULL for recurring with no end date

  -- Recurring pattern (for recurring type)
  -- Array of day-of-week: 0=Sun, 1=Mon, ..., 6=Sat
  recurring_days INTEGER[],
  recurring_start_time TIME,               -- e.g., 08:00
  recurring_end_time TIME,                 -- e.g., 18:00

  -- Event details (for event type)
  event_name TEXT,
  event_max_guests INTEGER,
  event_guests_checked_in INTEGER NOT NULL DEFAULT 0,

  -- Usage tracking
  max_uses INTEGER DEFAULT 1,              -- NULL for unlimited
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Status (invitations auto-approved by resident, admin can override)
  status approval_status NOT NULL DEFAULT 'approved',
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,

  -- Access restrictions
  allowed_access_points UUID[],            -- NULL means all points allowed
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  requires_document BOOLEAN NOT NULL DEFAULT false,

  -- Notes for guards
  special_instructions TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- ============================================
  -- TYPE-SPECIFIC CONSTRAINTS (Polymorphic validation)
  -- ============================================
  -- These ensure each invitation type has its required fields

  -- Single-use: max_uses must be exactly 1
  CONSTRAINT single_use_has_max_1 CHECK (
    invitation_type != 'single_use' OR max_uses = 1
  ),

  -- Event: must have both valid_from and valid_until dates
  CONSTRAINT event_has_dates CHECK (
    invitation_type != 'event' OR (valid_from IS NOT NULL AND valid_until IS NOT NULL)
  ),

  -- Recurring: must have day-of-week pattern
  CONSTRAINT recurring_has_pattern CHECK (
    invitation_type != 'recurring' OR recurring_days IS NOT NULL
  ),

  -- Vehicle pre-auth: must have plate number
  CONSTRAINT vehicle_has_plate CHECK (
    invitation_type != 'vehicle_preauth' OR vehicle_plate IS NOT NULL
  ),

  -- Recurring days must be valid (0-6 for Sun-Sat)
  CONSTRAINT recurring_days_valid CHECK (
    recurring_days IS NULL OR (
      array_length(recurring_days, 1) > 0 AND
      recurring_days <@ ARRAY[0,1,2,3,4,5,6]
    )
  )
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE invitations IS 'Visitor invitations with polymorphic validation. Each invitation_type has specific required fields enforced by CHECK constraints.';

COMMENT ON COLUMN invitations.invitation_type IS 'Type determines validation rules: single_use (max_uses=1), event (requires dates), recurring (requires days pattern), vehicle_preauth (requires plate)';
COMMENT ON COLUMN invitations.recurring_days IS 'Array of day-of-week integers: 0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN invitations.vehicle_plate_normalized IS 'Uppercase alphanumeric plate for LPR matching (generated column)';
COMMENT ON COLUMN invitations.allowed_access_points IS 'Array of access_point UUIDs. NULL means all access points allowed.';
COMMENT ON COLUMN invitations.max_uses IS 'Maximum number of uses. NULL for unlimited. Single-use type enforces max_uses=1.';

-- ============================================
-- INDEXES
-- ============================================

-- Community lookups (active invitations only)
CREATE INDEX idx_invitations_community ON invitations(community_id) WHERE deleted_at IS NULL;

-- Resident's own invitations
CREATE INDEX idx_invitations_resident ON invitations(created_by_resident_id) WHERE deleted_at IS NULL;

-- Valid invitations for access checking (active, approved, not cancelled)
CREATE INDEX idx_invitations_valid ON invitations(community_id, valid_from, valid_until)
  WHERE status = 'approved' AND deleted_at IS NULL AND cancelled_at IS NULL;

-- Vehicle plate lookups for LPR matching
CREATE INDEX idx_invitations_plate ON invitations(vehicle_plate_normalized)
  WHERE vehicle_plate_normalized IS NOT NULL AND status = 'approved' AND deleted_at IS NULL;

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER invitations_audit
  BEFORE INSERT OR UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- VALIDATION FUNCTION
-- ============================================
-- Checks if an invitation is valid for use at a specific time
-- Called during access control flow

CREATE OR REPLACE FUNCTION is_invitation_valid(
  inv_id UUID,
  check_time TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv RECORD;
  day_of_week INTEGER;
BEGIN
  -- Fetch the invitation
  SELECT * INTO inv FROM public.invitations WHERE id = inv_id AND deleted_at IS NULL;

  -- Basic existence checks
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF inv.status != 'approved' THEN RETURN FALSE; END IF;
  IF inv.cancelled_at IS NOT NULL THEN RETURN FALSE; END IF;

  -- Check time window
  IF inv.valid_from > check_time THEN RETURN FALSE; END IF;
  IF inv.valid_until IS NOT NULL AND inv.valid_until < check_time THEN RETURN FALSE; END IF;

  -- Check max uses
  IF inv.max_uses IS NOT NULL AND inv.times_used >= inv.max_uses THEN RETURN FALSE; END IF;

  -- Type-specific validation
  CASE inv.invitation_type
    WHEN 'recurring' THEN
      -- Check day of week
      day_of_week := EXTRACT(DOW FROM check_time)::INTEGER;
      IF NOT (day_of_week = ANY(inv.recurring_days)) THEN RETURN FALSE; END IF;
      -- Check time window within day
      IF inv.recurring_start_time IS NOT NULL AND check_time::TIME < inv.recurring_start_time THEN RETURN FALSE; END IF;
      IF inv.recurring_end_time IS NOT NULL AND check_time::TIME > inv.recurring_end_time THEN RETURN FALSE; END IF;
    WHEN 'event' THEN
      -- Check guest limit
      IF inv.event_max_guests IS NOT NULL AND inv.event_guests_checked_in >= inv.event_max_guests THEN RETURN FALSE; END IF;
    ELSE
      -- single_use and vehicle_preauth: basic checks already done above
      NULL;
  END CASE;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION is_invitation_valid IS 'Validates an invitation at access time. Checks status, time window, usage limits, and type-specific rules.';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "super_admin_all_invitations" ON invitations FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Residents can view/manage their own invitations
-- Admins/managers/guards can view all community invitations
CREATE POLICY "residents_own_invitations" ON invitations FOR ALL TO authenticated
  USING (
    created_by_resident_id = auth.uid()
    OR community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  )
  WITH CHECK (
    created_by_resident_id = auth.uid()
    OR (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Guards can view invitations for access validation (separate SELECT policy for clarity)
CREATE POLICY "guards_view_invitations" ON invitations FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'guard'
    AND deleted_at IS NULL
  );
