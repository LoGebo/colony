-- ============================================
-- PARKING RESERVATIONS AND VIOLATIONS TABLES
-- Phase 8 Plan 04 Task 3: Visitor Reservations & Violations
-- ============================================
-- Visitor parking with exclusion constraint to prevent overlapping
-- reservations, and violation tracking for enforcement.
--
-- CRITICAL: Uses '[)' bounds (inclusive start, exclusive end) so that
-- adjacent slots (14:00-15:00, 15:00-16:00) do NOT conflict.
-- btree_gist extension already enabled in Phase 5.

-- ============================================
-- PARKING RESERVATIONS TABLE
-- ============================================
-- Visitor parking reservations with time slots

CREATE TABLE parking_reservations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  parking_spot_id UUID NOT NULL REFERENCES parking_spots(id) ON DELETE RESTRICT,

  -- Reserving resident/unit
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Visitor information
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  visitor_vehicle_plates TEXT,
  visitor_vehicle_description TEXT,  -- e.g., "Red Honda Civic"

  -- Time slot (stored as separate components for easier queries)
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Status workflow
  status parking_reservation_status NOT NULL DEFAULT 'confirmed',

  -- Actual usage tracking
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Cancellation tracking
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),

  -- Ensure start < end
  CONSTRAINT parking_reservations_valid_times
    CHECK (start_time < end_time),

  -- ============================================
  -- EXCLUSION CONSTRAINT: Prevents double-booking
  -- ============================================
  -- Two reservations conflict if:
  --   1. Same parking spot (parking_spot_id WITH =)
  --   2. Overlapping time ranges
  --   3. Both are pending or confirmed (not cancelled/completed/no_show)
  --
  -- Uses tstzrange constructed from date + time with Mexico City timezone.
  -- '[)' bounds ensure adjacent slots (10:00-12:00, 12:00-14:00) don't conflict.
  --
  CONSTRAINT parking_reservations_no_overlap
    EXCLUDE USING GIST (
      parking_spot_id WITH =,
      tstzrange(
        (reservation_date + start_time) AT TIME ZONE 'America/Mexico_City',
        (reservation_date + end_time) AT TIME ZONE 'America/Mexico_City',
        '[)'
      ) WITH &&
    )
    WHERE (status IN ('pending', 'confirmed'))
);

-- Table comments
COMMENT ON TABLE parking_reservations IS
  'Visitor parking reservations with database-enforced double-booking prevention.
   Uses exclusion constraint on (parking_spot_id, time_range).
   Only pending/confirmed reservations participate in constraint.';

COMMENT ON COLUMN parking_reservations.visitor_name IS
  'Name of the visitor who will use the parking spot.';

COMMENT ON COLUMN parking_reservations.reservation_date IS
  'Date of the reservation. Combined with start_time/end_time for the full range.';

COMMENT ON COLUMN parking_reservations.start_time IS
  'Start time of reservation (local time). Combined with reservation_date.';

COMMENT ON COLUMN parking_reservations.end_time IS
  'End time of reservation (local time). Must be > start_time.';

COMMENT ON COLUMN parking_reservations.checked_in_at IS
  'Timestamp when visitor actually arrived (for overstay tracking).';

COMMENT ON COLUMN parking_reservations.checked_out_at IS
  'Timestamp when visitor left (for completion).';

COMMENT ON CONSTRAINT parking_reservations_no_overlap ON parking_reservations IS
  'Exclusion constraint preventing overlapping reservations for same spot.
   Uses ''[)'' bounds so 10:00-12:00 and 12:00-14:00 do NOT conflict.
   Only active on: status IN (pending, confirmed).';

-- ============================================
-- PARKING VIOLATIONS TABLE
-- ============================================
-- Records of parking violations for enforcement

CREATE TABLE parking_violations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Location (optional spot reference - violation may be outside designated spots)
  parking_spot_id UUID REFERENCES parking_spots(id) ON DELETE SET NULL,
  location_description TEXT,  -- Free text if not in a designated spot

  -- Violating vehicle (may be known or unknown)
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,  -- If vehicle is registered
  vehicle_plates TEXT,          -- Original plates as observed
  vehicle_description TEXT,     -- e.g., "Black SUV, tinted windows"

  -- Violation details
  violation_type parking_violation_type NOT NULL,
  description TEXT NOT NULL,

  -- Evidence
  photo_urls TEXT[],

  -- Observation time
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Reporter
  reported_by UUID REFERENCES auth.users(id),

  -- Status workflow
  status parking_violation_status NOT NULL DEFAULT 'reported',

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- Link to formal violation record (Phase 8-07)
  -- Will reference violations table when created
  violation_record_id UUID,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table comments
COMMENT ON TABLE parking_violations IS
  'Records of parking violations for enforcement and tracking.
   May link to known vehicles via vehicle_id or just store plates.
   violation_record_id will link to formal violations table (08-07).';

COMMENT ON COLUMN parking_violations.vehicle_id IS
  'Reference to registered vehicle if identified. NULL if vehicle is unknown.';

COMMENT ON COLUMN parking_violations.vehicle_plates IS
  'License plates as observed. Stored separately even if vehicle_id is set.';

COMMENT ON COLUMN parking_violations.photo_urls IS
  'Array of photo URLs documenting the violation (stored in Supabase Storage).';

COMMENT ON COLUMN parking_violations.violation_record_id IS
  'Links to formal violation record in violations table (Phase 8-07).
   Set when a formal violation/fine is created from this parking violation.';

-- ============================================
-- INDEXES
-- ============================================

-- Parking reservations: by spot and date (for availability and exclusion)
CREATE INDEX idx_parking_reservations_spot_date
  ON parking_reservations USING GIST (parking_spot_id, tstzrange(
    (reservation_date + start_time) AT TIME ZONE 'America/Mexico_City',
    (reservation_date + end_time) AT TIME ZONE 'America/Mexico_City',
    '[)'
  ))
  WHERE status IN ('pending', 'confirmed');

-- Parking reservations: by unit (for resident history)
CREATE INDEX idx_parking_reservations_unit
  ON parking_reservations(unit_id, reservation_date DESC);

-- Parking reservations: by resident (for personal history)
CREATE INDEX idx_parking_reservations_resident
  ON parking_reservations(resident_id, reservation_date DESC);

-- Parking reservations: community-wide by date (for dashboard)
CREATE INDEX idx_parking_reservations_community_date
  ON parking_reservations(community_id, reservation_date)
  WHERE status IN ('pending', 'confirmed');

-- Parking violations: by spot (if assigned to specific spot)
CREATE INDEX idx_parking_violations_spot
  ON parking_violations(parking_spot_id)
  WHERE parking_spot_id IS NOT NULL;

-- Parking violations: by vehicle (if linked to known vehicle)
CREATE INDEX idx_parking_violations_vehicle
  ON parking_violations(vehicle_id)
  WHERE vehicle_id IS NOT NULL;

-- Parking violations: by community and status (for enforcement dashboard)
CREATE INDEX idx_parking_violations_community_status
  ON parking_violations(community_id, status, observed_at DESC);

-- Parking violations: by plates for pattern detection
CREATE INDEX idx_parking_violations_plates
  ON parking_violations(upper(vehicle_plates))
  WHERE vehicle_plates IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER set_parking_reservations_audit
  BEFORE INSERT OR UPDATE ON parking_reservations
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER set_parking_violations_audit
  BEFORE INSERT OR UPDATE ON parking_violations
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE parking_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_violations ENABLE ROW LEVEL SECURITY;

-- =====================
-- PARKING RESERVATIONS RLS
-- =====================

-- Super admin: full access
CREATE POLICY super_admin_all_parking_reservations ON parking_reservations
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Residents: full CRUD on their own reservations
CREATE POLICY residents_manage_own_reservations ON parking_reservations
  FOR ALL
  TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

-- Staff: full CRUD on all community reservations
CREATE POLICY staff_manage_parking_reservations ON parking_reservations
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

-- Community members: view all reservations (for coordination)
CREATE POLICY users_view_parking_reservations ON parking_reservations
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
  );

-- =====================
-- PARKING VIOLATIONS RLS
-- =====================

-- Super admin: full access
CREATE POLICY super_admin_all_parking_violations ON parking_violations
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Staff: full CRUD on all community violations
CREATE POLICY staff_manage_parking_violations ON parking_violations
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

-- Residents: view violations (especially their own)
CREATE POLICY users_view_parking_violations ON parking_violations
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if a parking spot is available for a specific time slot
CREATE OR REPLACE FUNCTION is_parking_available(
  p_spot_id UUID,
  p_date DATE,
  p_start TIME,
  p_end TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_range TSTZRANGE;
BEGIN
  -- Build the time range with Mexico City timezone
  v_range := tstzrange(
    (p_date + p_start) AT TIME ZONE 'America/Mexico_City',
    (p_date + p_end) AT TIME ZONE 'America/Mexico_City',
    '[)'
  );

  -- Check for any conflicting reservations
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.parking_reservations pr
    WHERE pr.parking_spot_id = p_spot_id
      AND pr.status IN ('pending', 'confirmed')
      AND tstzrange(
        (pr.reservation_date + pr.start_time) AT TIME ZONE 'America/Mexico_City',
        (pr.reservation_date + pr.end_time) AT TIME ZONE 'America/Mexico_City',
        '[)'
      ) && v_range
  );
END;
$$;

COMMENT ON FUNCTION is_parking_available IS
  'Check if a parking spot is available for a specific date and time slot.
   Returns true if no conflicting reservations exist.
   Uses the same timezone logic as the exclusion constraint.';

-- Create a parking reservation with validation
CREATE OR REPLACE FUNCTION create_parking_reservation(
  p_spot_id UUID,
  p_unit_id UUID,
  p_resident_id UUID,
  p_visitor_name TEXT,
  p_date DATE,
  p_start TIME,
  p_end TIME,
  p_visitor_phone TEXT DEFAULT NULL,
  p_visitor_plates TEXT DEFAULT NULL,
  p_visitor_vehicle TEXT DEFAULT NULL,
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
  v_spot_type public.parking_spot_type;
BEGIN
  -- Get spot details
  SELECT community_id, spot_type
  INTO v_community_id, v_spot_type
  FROM public.parking_spots
  WHERE id = p_spot_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parking spot % not found', p_spot_id;
  END IF;

  -- Verify spot is visitor type
  IF v_spot_type != 'visitor' THEN
    RAISE EXCEPTION 'Spot % is not a visitor parking spot (type: %)', p_spot_id, v_spot_type;
  END IF;

  -- Check availability
  IF NOT public.is_parking_available(p_spot_id, p_date, p_start, p_end) THEN
    RAISE EXCEPTION 'Spot is not available for the requested time slot';
  END IF;

  -- Create reservation
  INSERT INTO public.parking_reservations (
    community_id,
    parking_spot_id,
    unit_id,
    resident_id,
    visitor_name,
    visitor_phone,
    visitor_vehicle_plates,
    visitor_vehicle_description,
    reservation_date,
    start_time,
    end_time,
    notes,
    status
  ) VALUES (
    v_community_id,
    p_spot_id,
    p_unit_id,
    p_resident_id,
    p_visitor_name,
    p_visitor_phone,
    p_visitor_plates,
    p_visitor_vehicle,
    p_date,
    p_start,
    p_end,
    p_notes,
    'confirmed'
  )
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;

EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Time slot already booked. Please choose a different time.';
END;
$$;

COMMENT ON FUNCTION create_parking_reservation IS
  'Creates a visitor parking reservation with full validation.
   Verifies spot is visitor type and available.
   On exclusion violation, returns user-friendly error.';

-- Cancel a parking reservation
CREATE OR REPLACE FUNCTION cancel_parking_reservation(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.parking_reservations
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    updated_at = now()
  WHERE id = p_reservation_id
    AND status IN ('pending', 'confirmed');

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION cancel_parking_reservation IS
  'Cancels a parking reservation. Only pending/confirmed reservations can be cancelled.';

-- Check in a visitor (record actual arrival)
CREATE OR REPLACE FUNCTION checkin_parking_visitor(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.parking_reservations
  SET
    checked_in_at = now(),
    updated_at = now()
  WHERE id = p_reservation_id
    AND status = 'confirmed'
    AND checked_in_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION checkin_parking_visitor IS
  'Records visitor check-in time. Only confirmed reservations with no prior check-in.';

-- Check out a visitor and complete reservation
CREATE OR REPLACE FUNCTION checkout_parking_visitor(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.parking_reservations
  SET
    checked_out_at = now(),
    status = 'completed',
    updated_at = now()
  WHERE id = p_reservation_id
    AND status = 'confirmed'
    AND checked_in_at IS NOT NULL
    AND checked_out_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION checkout_parking_visitor IS
  'Records visitor check-out and marks reservation as completed.
   Requires prior check-in.';

-- Get today's parking reservations for a community
CREATE OR REPLACE FUNCTION get_todays_parking_reservations(p_community_id UUID)
RETURNS TABLE (
  reservation_id UUID,
  spot_number TEXT,
  unit_number TEXT,
  visitor_name TEXT,
  visitor_plates TEXT,
  start_time TIME,
  end_time TIME,
  status public.parking_reservation_status,
  checked_in_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pr.id AS reservation_id,
    ps.spot_number,
    u.unit_number,
    pr.visitor_name,
    pr.visitor_vehicle_plates AS visitor_plates,
    pr.start_time,
    pr.end_time,
    pr.status,
    pr.checked_in_at
  FROM public.parking_reservations pr
  JOIN public.parking_spots ps ON ps.id = pr.parking_spot_id
  JOIN public.units u ON u.id = pr.unit_id
  WHERE pr.community_id = p_community_id
    AND pr.reservation_date = CURRENT_DATE
    AND pr.status IN ('pending', 'confirmed', 'completed')
  ORDER BY pr.start_time;
$$;

COMMENT ON FUNCTION get_todays_parking_reservations IS
  'Returns all parking reservations for today in a community.
   Used for guard booth dashboard display.';

-- Report a parking violation
CREATE OR REPLACE FUNCTION report_parking_violation(
  p_community_id UUID,
  p_spot_id UUID DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_plates TEXT DEFAULT NULL,
  p_vehicle_description TEXT DEFAULT NULL,
  p_violation_type public.parking_violation_type DEFAULT 'unauthorized_parking',
  p_description TEXT DEFAULT NULL,
  p_photo_urls TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_violation_id UUID;
  v_vehicle_id UUID;
  v_description TEXT;
BEGIN
  -- Require at least some description
  v_description := COALESCE(p_description, 'Parking violation observed');

  -- Try to find registered vehicle by plates
  IF p_plates IS NOT NULL THEN
    SELECT v.id INTO v_vehicle_id
    FROM public.vehicles v
    WHERE v.community_id = p_community_id
      AND v.plate_normalized = UPPER(REGEXP_REPLACE(p_plates, '[^A-Z0-9]', '', 'gi'))
      AND v.deleted_at IS NULL
    LIMIT 1;
  END IF;

  -- Create violation record
  INSERT INTO public.parking_violations (
    community_id,
    parking_spot_id,
    location_description,
    vehicle_id,
    vehicle_plates,
    vehicle_description,
    violation_type,
    description,
    photo_urls,
    reported_by
  ) VALUES (
    p_community_id,
    p_spot_id,
    p_location,
    v_vehicle_id,
    p_plates,
    p_vehicle_description,
    p_violation_type,
    v_description,
    p_photo_urls,
    auth.uid()
  )
  RETURNING id INTO v_violation_id;

  RETURN v_violation_id;
END;
$$;

COMMENT ON FUNCTION report_parking_violation IS
  'Reports a parking violation. Auto-links to registered vehicle if plates match.
   Used by guards to document parking infractions.';
