-- ============================================
-- RESERVATION WAITLIST TABLE AND AUTO-PROMOTION
-- Phase 5 Plan 02 Task 2: Waitlist with Auto-Promotion Trigger
-- ============================================
-- Waitlist for fully-booked amenity slots with automatic promotion
-- when reservations are cancelled.
--
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions when
-- multiple waitlist entries could be promoted simultaneously.

-- ============================================
-- RESERVATION_WAITLIST TABLE
-- ============================================

CREATE TABLE reservation_waitlist (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Desired time range (may differ from actual promoted reservation)
  requested_range TSTZRANGE NOT NULL,

  -- Date of requested slot (populated by trigger for indexing)
  requested_date DATE NOT NULL,

  -- FIFO position per amenity per day
  position INTEGER NOT NULL,

  -- Status
  status waitlist_status NOT NULL DEFAULT 'waiting',

  -- Promotion tracking (populated when promoted)
  promoted_to_reservation_id UUID REFERENCES reservations(id),
  promoted_at TIMESTAMPTZ,

  -- Auto-expiry (if not promoted by this time, entry becomes invalid)
  expires_at TIMESTAMPTZ NOT NULL,

  -- Audit columns (no deleted_at - use status instead)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Unique position per amenity per day (prevents duplicate positions)
-- Uses generated requested_date column for IMMUTABLE index requirement
CREATE UNIQUE INDEX idx_waitlist_position_unique
  ON reservation_waitlist(amenity_id, position, requested_date)
  WHERE status = 'waiting';

-- ============================================
-- TABLE AND COLUMN COMMENTS
-- ============================================

COMMENT ON TABLE reservation_waitlist IS
  'Waitlist entries for fully-booked amenity time slots.
   Auto-promotes to reservation when cancellation opens the slot.
   Uses FIFO ordering (position column) per amenity per day.';

COMMENT ON COLUMN reservation_waitlist.requested_range IS
  'Desired time range. Must overlap with cancelled reservation to trigger promotion.
   Use ''[)'' bounds for consistency with reservations table.';

COMMENT ON COLUMN reservation_waitlist.position IS
  'FIFO queue position (1 = first in line). Assigned by add_to_waitlist().
   Lower position = higher priority for promotion.';

COMMENT ON COLUMN reservation_waitlist.status IS
  'waiting = in queue, promoted = converted to reservation,
   expired = past expiry time, cancelled = user withdrew.';

COMMENT ON COLUMN reservation_waitlist.promoted_to_reservation_id IS
  'Links to the reservation created when this entry was promoted.
   Populated by promote_from_waitlist() trigger.';

COMMENT ON COLUMN reservation_waitlist.expires_at IS
  'If not promoted by this timestamp, entry is considered expired.
   Expired entries are not eligible for promotion.';

-- ============================================
-- INDEXES
-- ============================================

-- Primary query: find waiting entries for promotion
CREATE INDEX idx_waitlist_promotion_lookup
  ON reservation_waitlist(amenity_id, status, expires_at)
  WHERE status = 'waiting';

-- User's waitlist entries
CREATE INDEX idx_waitlist_resident
  ON reservation_waitlist(resident_id, status);

-- Community-wide queries
CREATE INDEX idx_waitlist_community
  ON reservation_waitlist(community_id, status);

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger
CREATE TRIGGER set_waitlist_audit
  BEFORE INSERT OR UPDATE ON reservation_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE reservation_waitlist ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY super_admin_all_waitlist ON reservation_waitlist
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users: view own waitlist entries
CREATE POLICY users_view_own_waitlist ON reservation_waitlist
  FOR SELECT
  TO authenticated
  USING (resident_id = auth.uid());

-- Residents: create and cancel own waitlist entries
CREATE POLICY residents_manage_own_waitlist ON reservation_waitlist
  FOR ALL
  TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

-- Admins: view all waitlist in community
CREATE POLICY admins_view_community_waitlist ON reservation_waitlist
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- TRIGGER: Set requested_date from requested_range
-- ============================================

CREATE OR REPLACE FUNCTION set_waitlist_requested_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.requested_date := CAST(lower(NEW.requested_range) AS DATE);
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_waitlist_date
  BEFORE INSERT OR UPDATE OF requested_range ON reservation_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION set_waitlist_requested_date();

-- ============================================
-- GET NEXT WAITLIST POSITION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_next_waitlist_position(
  p_amenity_id UUID,
  p_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0)
  INTO v_max_position
  FROM public.reservation_waitlist
  WHERE amenity_id = p_amenity_id
    AND requested_date = p_date
    AND status = 'waiting';

  RETURN v_max_position + 1;
END;
$$;

COMMENT ON FUNCTION get_next_waitlist_position IS
  'Returns the next available position number for a waitlist entry.
   Position is per-amenity per-day, starting at 1.';

-- ============================================
-- ADD TO WAITLIST FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION add_to_waitlist(
  p_amenity_id UUID,
  p_unit_id UUID,
  p_resident_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_expires_hours INTEGER DEFAULT 24
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_waitlist_id UUID;
  v_community_id UUID;
  v_position INTEGER;
  v_date DATE;
BEGIN
  -- Get community_id from amenity
  SELECT community_id INTO v_community_id
  FROM public.amenities
  WHERE id = p_amenity_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Amenity % not found', p_amenity_id;
  END IF;

  -- Calculate position
  v_date := p_start_time::DATE;
  v_position := public.get_next_waitlist_position(p_amenity_id, v_date);

  -- Insert waitlist entry with '[)' bounds
  -- requested_date is set automatically by trigger
  INSERT INTO public.reservation_waitlist (
    community_id,
    amenity_id,
    unit_id,
    resident_id,
    requested_range,
    requested_date,
    position,
    status,
    expires_at
  ) VALUES (
    v_community_id,
    p_amenity_id,
    p_unit_id,
    p_resident_id,
    tstzrange(p_start_time, p_end_time, '[)'),
    p_start_time::DATE,
    v_position,
    'waiting',
    now() + (p_expires_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO v_waitlist_id;

  RETURN v_waitlist_id;
END;
$$;

COMMENT ON FUNCTION add_to_waitlist IS
  'Adds a resident to the waitlist for an amenity time slot.

   Parameters:
     p_amenity_id: UUID of amenity
     p_unit_id: UUID of unit
     p_resident_id: UUID of resident (auth.uid())
     p_start_time: Desired start time
     p_end_time: Desired end time
     p_expires_hours: Hours until entry expires (default 24)

   Returns: UUID of created waitlist entry

   Position is calculated automatically (FIFO per amenity per day).
   Expires_at is set to now + p_expires_hours.';

-- ============================================
-- PROMOTE FROM WAITLIST TRIGGER FUNCTION
-- ============================================
-- Triggered when a reservation is cancelled.
-- Finds the first waiting entry that overlaps the cancelled time slot
-- and creates a new reservation for them.
--
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions.

CREATE OR REPLACE FUNCTION promote_from_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_waitlist_entry RECORD;
  v_new_reservation_id UUID;
BEGIN
  -- Only process when status changes TO cancelled
  IF NEW.status != 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Find first eligible waitlist entry
  -- FOR UPDATE SKIP LOCKED prevents concurrent promotion races
  SELECT * INTO v_waitlist_entry
  FROM public.reservation_waitlist
  WHERE amenity_id = NEW.amenity_id
    AND requested_range && NEW.reserved_range  -- Overlapping time ranges
    AND status = 'waiting'
    AND expires_at > now()
  ORDER BY position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- No eligible waitlist entry
    RETURN NEW;
  END IF;

  -- Create new reservation for the waitlist entry
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
    v_waitlist_entry.community_id,
    v_waitlist_entry.amenity_id,
    v_waitlist_entry.unit_id,
    v_waitlist_entry.resident_id,
    v_waitlist_entry.requested_range,
    'confirmed',
    'Auto-promoted from waitlist',
    now()
  )
  RETURNING id INTO v_new_reservation_id;

  -- Update waitlist entry as promoted
  UPDATE public.reservation_waitlist
  SET status = 'promoted',
      promoted_to_reservation_id = v_new_reservation_id,
      promoted_at = now(),
      updated_at = now()
  WHERE id = v_waitlist_entry.id;

  -- Send real-time notification via pg_notify
  PERFORM pg_notify(
    'waitlist_promotion',
    json_build_object(
      'waitlist_id', v_waitlist_entry.id,
      'reservation_id', v_new_reservation_id,
      'resident_id', v_waitlist_entry.resident_id,
      'amenity_id', v_waitlist_entry.amenity_id,
      'start_time', lower(v_waitlist_entry.requested_range),
      'end_time', upper(v_waitlist_entry.requested_range)
    )::TEXT
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION promote_from_waitlist IS
  'Trigger function that auto-promotes waitlist entries when reservations are cancelled.

   Triggered: AFTER UPDATE ON reservations
   Condition: NEW.status = ''cancelled'' AND OLD.status != ''cancelled''

   Process:
   1. Find first waiting entry that overlaps cancelled time range
   2. Lock the row with FOR UPDATE SKIP LOCKED (prevents races)
   3. Create new reservation for the waitlist entry
   4. Update waitlist entry status to promoted
   5. Send pg_notify for real-time UI updates

   The SKIP LOCKED ensures that if two moderators cancel overlapping
   reservations simultaneously, different waitlist entries get promoted
   (no duplicate promotions).';

-- ============================================
-- ATTACH TRIGGER TO RESERVATIONS TABLE
-- ============================================

CREATE TRIGGER reservation_cancellation_promote_waitlist
  AFTER UPDATE ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION promote_from_waitlist();

COMMENT ON TRIGGER reservation_cancellation_promote_waitlist ON reservations IS
  'Triggers waitlist auto-promotion when reservation is cancelled.
   Only fires when status transitions TO cancelled (not already cancelled).';
