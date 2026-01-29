-- ============================================
-- RESERVATIONS TABLE WITH EXCLUSION CONSTRAINT
-- Phase 5 Plan 02 Task 1b: Reservations with Double-Booking Prevention
-- ============================================
-- Main table for amenity reservations with PostgreSQL exclusion constraint
-- to prevent double-booking at the database level.
--
-- CRITICAL: Uses '[)' bounds (inclusive start, exclusive end) so that
-- adjacent slots (14:00-15:00, 15:00-16:00) do NOT conflict.

-- ============================================
-- RESERVATIONS TABLE
-- ============================================

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Time range for the reservation
  -- CRITICAL: Always use '[)' bounds when creating!
  -- '[)' = inclusive start, exclusive end
  -- This allows adjacent slots: [14:00,15:00) and [15:00,16:00) do NOT overlap
  reserved_range TSTZRANGE NOT NULL,

  -- Status
  status reservation_status NOT NULL DEFAULT 'confirmed',

  -- Additional info
  notes TEXT,                  -- Guest count, special requests, etc.

  -- Confirmation tracking
  confirmed_at TIMESTAMPTZ DEFAULT now(),

  -- Cancellation tracking
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,

  -- Completion tracking
  completed_at TIMESTAMPTZ,

  -- No-show tracking
  no_show_at TIMESTAMPTZ,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- =============================================
  -- EXCLUSION CONSTRAINT: Prevents double-booking
  -- =============================================
  -- Two reservations conflict if:
  --   1. Same amenity (amenity_id WITH =)
  --   2. Overlapping time ranges (reserved_range WITH &&)
  --   3. Both are confirmed and not soft-deleted
  --
  -- The WHERE clause ensures:
  --   - Cancelled reservations don't block new bookings
  --   - Soft-deleted reservations don't block new bookings
  --
  CONSTRAINT reservations_no_overlap
    EXCLUDE USING GIST (
      amenity_id WITH =,
      reserved_range WITH &&
    )
    WHERE (status = 'confirmed' AND deleted_at IS NULL)
);

-- ============================================
-- TABLE AND COLUMN COMMENTS
-- ============================================

COMMENT ON TABLE reservations IS
  'Amenity reservations with database-enforced double-booking prevention.
   Uses PostgreSQL exclusion constraint on (amenity_id, reserved_range).
   CRITICAL: Always create reserved_range with ''[)'' bounds.';

COMMENT ON COLUMN reservations.reserved_range IS
  'Time range for the reservation using TSTZRANGE.
   ALWAYS use ''[)'' bounds (inclusive start, exclusive end).
   Example: tstzrange(''2026-01-30 14:00'', ''2026-01-30 16:00'', ''[)'')
   This allows adjacent slots without conflict.';

COMMENT ON COLUMN reservations.status IS
  'Reservation lifecycle: pending->confirmed->completed/cancelled/no_show.
   Only confirmed reservations participate in exclusion constraint.';

COMMENT ON COLUMN reservations.notes IS
  'Free-text notes: number of guests, special requests, equipment needed.';

COMMENT ON COLUMN reservations.cancelled_at IS
  'Timestamp when reservation was cancelled. Triggers waitlist promotion.';

COMMENT ON COLUMN reservations.cancelled_by IS
  'User who cancelled (resident or admin). For audit trail.';

COMMENT ON COLUMN reservations.no_show_at IS
  'Timestamp when reservation was marked as no-show.
   May trigger no-show fee in reservation_fees table.';

COMMENT ON CONSTRAINT reservations_no_overlap ON reservations IS
  'Exclusion constraint preventing overlapping confirmed reservations for same amenity.
   Uses btree_gist extension for UUID + tstzrange combination.
   Only active on: status = confirmed AND deleted_at IS NULL.';

-- ============================================
-- INDEXES
-- ============================================

-- Primary query: availability check for an amenity (used by exclusion constraint too)
CREATE INDEX idx_reservations_amenity_range
  ON reservations USING GIST (amenity_id, reserved_range)
  WHERE deleted_at IS NULL;

-- Unit history: all reservations for a unit
CREATE INDEX idx_reservations_unit_status
  ON reservations(unit_id, status)
  WHERE deleted_at IS NULL;

-- Resident history: all reservations by a resident
CREATE INDEX idx_reservations_resident_status
  ON reservations(resident_id, status)
  WHERE deleted_at IS NULL;

-- Confirmed reservations: for availability queries
CREATE INDEX idx_reservations_confirmed
  ON reservations(amenity_id, (lower(reserved_range)))
  WHERE status = 'confirmed' AND deleted_at IS NULL;

-- Community-wide queries
CREATE INDEX idx_reservations_community
  ON reservations(community_id, status)
  WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger
CREATE TRIGGER set_reservations_audit
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER reservations_soft_delete
  BEFORE DELETE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY super_admin_all_reservations ON reservations
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users: view own reservations
CREATE POLICY users_view_own_reservations ON reservations
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND resident_id = auth.uid()
  );

-- Admins/Managers: view all reservations in community
CREATE POLICY admins_view_community_reservations ON reservations
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- Residents: create reservations (actual validation in create_reservation function)
CREATE POLICY residents_create_reservations ON reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
  );

-- Residents: cancel own reservations (only status and cancellation fields)
CREATE POLICY residents_cancel_own_reservations ON reservations
  FOR UPDATE
  TO authenticated
  USING (
    resident_id = auth.uid()
    AND status = 'confirmed'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- Admins: full management of community reservations
CREATE POLICY admins_manage_reservations ON reservations
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- CREATE_RESERVATION FUNCTION
-- ============================================
-- Main function for creating reservations with rule validation

CREATE OR REPLACE FUNCTION create_reservation(
  p_amenity_id UUID,
  p_unit_id UUID,
  p_resident_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reservation_id UUID;
  v_community_id UUID;
  v_validation_result RECORD;
BEGIN
  -- Get community_id from amenity
  SELECT community_id INTO v_community_id
  FROM public.amenities
  WHERE id = p_amenity_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Amenity % not found', p_amenity_id;
  END IF;

  -- Validate booking rules
  SELECT * INTO v_validation_result
  FROM public.validate_booking_rules(p_amenity_id, p_unit_id, p_start_time, p_end_time)
  LIMIT 1;

  IF NOT v_validation_result.is_valid THEN
    RAISE EXCEPTION 'Booking rule violation [%]: %',
      v_validation_result.violated_rule,
      v_validation_result.message;
  END IF;

  -- Check amenity is open
  IF NOT public.is_amenity_open(p_amenity_id, p_start_time) THEN
    RAISE EXCEPTION 'Amenity is not open at the requested time';
  END IF;

  IF NOT public.is_amenity_open(p_amenity_id, p_end_time - INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Amenity closes before reservation end time';
  END IF;

  -- Insert reservation with '[)' bounds
  -- CRITICAL: '[)' = inclusive start, exclusive end
  INSERT INTO public.reservations (
    community_id,
    amenity_id,
    unit_id,
    resident_id,
    reserved_range,
    status,
    notes,
    confirmed_at
  ) VALUES (
    v_community_id,
    p_amenity_id,
    p_unit_id,
    p_resident_id,
    tstzrange(p_start_time, p_end_time, '[)'),  -- CRITICAL: '[)' bounds!
    'confirmed',
    p_notes,
    now()
  )
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;

EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Time slot already booked. Please choose a different time.';
END;
$$;

COMMENT ON FUNCTION create_reservation IS
  'Creates a new reservation with full validation.

   Steps:
   1. Validates amenity exists
   2. Runs validate_booking_rules() for quota/advance/duration checks
   3. Checks amenity is open at requested time
   4. Inserts with ''[)'' bounds for adjacent slot compatibility
   5. On exclusion violation, returns user-friendly error

   Parameters:
     p_amenity_id: UUID of amenity to reserve
     p_unit_id: UUID of unit making reservation
     p_resident_id: UUID of resident (auth.uid())
     p_start_time: Reservation start timestamp
     p_end_time: Reservation end timestamp
     p_notes: Optional notes (guest count, etc.)

   Returns: UUID of created reservation

   Raises:
     - "Booking rule violation [rule]: message" on rule failure
     - "Amenity is not open..." if outside operating hours
     - "Time slot already booked..." on exclusion constraint violation';
