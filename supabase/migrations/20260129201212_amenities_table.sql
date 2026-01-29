-- ============================================
-- AMENITIES TABLE
-- Phase 5 Plan 01 Task 2: Amenities with Schedules
-- ============================================
-- Main table for community amenity definitions with
-- operating schedules, capacity, and booking configuration.

-- ============================================
-- AMENITIES TABLE
-- ============================================

CREATE TABLE amenities (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  amenity_type amenity_type NOT NULL,

  -- Location within community
  location TEXT,                    -- e.g., "Building A, Floor 2", "Near main pool"
  floor_number INTEGER,

  -- Capacity
  capacity INTEGER,                 -- Max concurrent users/guests

  -- Operating hours schedule
  -- Format: {"mon": {"open": "06:00", "close": "22:00"}, "sun": {"open": "08:00", "close": "20:00"}}
  -- Use day abbreviations: mon, tue, wed, thu, fri, sat, sun
  -- Closed days can be omitted or use {"closed": true}
  schedule JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Booking configuration
  requires_reservation BOOLEAN NOT NULL DEFAULT TRUE,
  min_advance_hours INTEGER DEFAULT 1,         -- Minimum hours before booking starts
  max_advance_days INTEGER DEFAULT 30,         -- Maximum days ahead to book
  default_duration_minutes INTEGER DEFAULT 60, -- Default reservation length

  -- Fees (nullable for free amenities)
  hourly_rate money_amount,                    -- Hourly usage fee
  deposit_amount money_amount,                 -- Refundable damage deposit

  -- Media and documentation
  photo_urls TEXT[],                           -- Array of storage URLs for amenity photos
  rules_document_url TEXT,                     -- URL to PDF with full amenity rules

  -- Status and maintenance
  status general_status NOT NULL DEFAULT 'active',
  maintenance_notes TEXT,                      -- Current maintenance info

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Unique name per community
  CONSTRAINT amenities_unique_name UNIQUE (community_id, name)
);

-- ============================================
-- TABLE AND COLUMN COMMENTS
-- ============================================

COMMENT ON TABLE amenities IS
  'Community amenities (pools, gyms, salons, etc.) with operating schedules and booking configuration';

COMMENT ON COLUMN amenities.schedule IS
  'Operating hours JSONB. Format: {"mon": {"open": "06:00", "close": "22:00"}, ...}
   Days: mon, tue, wed, thu, fri, sat, sun
   Closed days: omit key or set {"closed": true}
   24-hour format for times';

COMMENT ON COLUMN amenities.requires_reservation IS
  'If TRUE, residents must reserve to use. If FALSE, first-come-first-served';

COMMENT ON COLUMN amenities.min_advance_hours IS
  'Minimum hours in advance a reservation can be made (prevents last-minute bookings)';

COMMENT ON COLUMN amenities.max_advance_days IS
  'Maximum days in advance a reservation can be made (prevents monopolizing)';

COMMENT ON COLUMN amenities.default_duration_minutes IS
  'Default duration for new reservations (can be overridden)';

COMMENT ON COLUMN amenities.hourly_rate IS
  'Hourly usage fee in community currency. NULL for free amenities';

COMMENT ON COLUMN amenities.deposit_amount IS
  'Refundable damage deposit required before reservation. NULL if none';

COMMENT ON COLUMN amenities.photo_urls IS
  'Array of Supabase Storage URLs for amenity photos. Recommended max 10 photos';

COMMENT ON COLUMN amenities.rules_document_url IS
  'URL to PDF containing full amenity rules and usage guidelines';

COMMENT ON COLUMN amenities.maintenance_notes IS
  'Current maintenance status or notes for admins (e.g., "Pool heater under repair")';

-- ============================================
-- INDEXES
-- ============================================

-- Primary query: active amenities in a community
CREATE INDEX idx_amenities_community_status
  ON amenities(community_id, status)
  WHERE deleted_at IS NULL;

-- Filter by amenity type
CREATE INDEX idx_amenities_type
  ON amenities(amenity_type)
  WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit fields (created_at, updated_at, created_by)
CREATE TRIGGER set_amenities_audit
  BEFORE INSERT OR UPDATE ON amenities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- Soft delete (convert DELETE to UPDATE with deleted_at)
CREATE TRIGGER amenities_soft_delete
  BEFORE DELETE ON amenities
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;

-- Super admin: full access to all communities
CREATE POLICY super_admin_all_amenities ON amenities
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users: view active amenities in their community
CREATE POLICY users_view_amenities ON amenities
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND community_id = (SELECT public.get_current_community_id())
  );

-- Admins/Managers: manage amenities in their community
CREATE POLICY admins_manage_amenities ON amenities
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
-- HELPER FUNCTION: Check amenity is open
-- ============================================
-- Returns TRUE if amenity is open at the given timestamp

CREATE OR REPLACE FUNCTION is_amenity_open(
  p_amenity_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_schedule JSONB;
  v_day_abbrev TEXT;
  v_day_schedule JSONB;
  v_open_time TIME;
  v_close_time TIME;
  v_check_time_local TIME;
BEGIN
  -- Get amenity schedule
  SELECT schedule INTO v_schedule
  FROM public.amenities
  WHERE id = p_amenity_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_schedule IS NULL OR v_schedule = '{}'::JSONB THEN
    -- No schedule defined = always open
    RETURN TRUE;
  END IF;

  -- Get day abbreviation (lowercase 3 chars)
  v_day_abbrev := lower(to_char(p_check_time, 'Dy'));

  -- Get schedule for this day
  v_day_schedule := v_schedule->v_day_abbrev;

  IF v_day_schedule IS NULL THEN
    -- Day not in schedule = closed
    RETURN FALSE;
  END IF;

  -- Check if explicitly closed
  IF (v_day_schedule->>'closed')::BOOLEAN IS TRUE THEN
    RETURN FALSE;
  END IF;

  -- Get open/close times
  v_open_time := (v_day_schedule->>'open')::TIME;
  v_close_time := (v_day_schedule->>'close')::TIME;

  IF v_open_time IS NULL OR v_close_time IS NULL THEN
    -- Invalid schedule = treat as closed
    RETURN FALSE;
  END IF;

  -- Get local time from timestamp
  v_check_time_local := p_check_time::TIME;

  -- Check if within operating hours
  IF v_close_time > v_open_time THEN
    -- Normal hours (e.g., 06:00-22:00)
    RETURN v_check_time_local >= v_open_time AND v_check_time_local < v_close_time;
  ELSE
    -- Crosses midnight (e.g., 22:00-02:00) - not typical but supported
    RETURN v_check_time_local >= v_open_time OR v_check_time_local < v_close_time;
  END IF;
END;
$$;

COMMENT ON FUNCTION is_amenity_open(UUID, TIMESTAMPTZ) IS
  'Returns TRUE if the amenity is open at the given time based on its schedule JSONB';
