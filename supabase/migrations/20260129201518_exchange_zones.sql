-- ============================================
-- EXCHANGE ZONES AND APPOINTMENTS
-- ============================================
-- Phase 5 Plan 5: Safe meeting points for marketplace transactions
-- Designated locations within community for buyer-seller exchanges

-- ============================================
-- EXCHANGE_ZONES TABLE
-- ============================================
-- Safe, designated meeting points for marketplace transactions

CREATE TABLE IF NOT EXISTS exchange_zones (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Zone identification
  name TEXT NOT NULL,
  description TEXT,
  location_instructions TEXT, -- Detailed directions within community

  -- Geographic coordinates (for map display)
  latitude NUMERIC(10, 7),  -- -90 to 90 degrees, 7 decimal places (~1cm precision)
  longitude NUMERIC(10, 7), -- -180 to 180 degrees

  -- Link to amenity (if exchange zone is at an amenity like lobby, gym entrance)
  -- NOTE: FK to amenities table will be added via ALTER TABLE after amenities exists
  -- This column stores the reference but constraint is deferred
  amenity_id UUID,

  -- Availability schedule
  available_hours JSONB DEFAULT '{}'::JSONB,
  -- Example: {
  --   "mon": {"open": "08:00", "close": "20:00"},
  --   "tue": {"open": "08:00", "close": "20:00"},
  --   "sat": {"open": "09:00", "close": "18:00"},
  --   "sun": null  -- closed
  -- }

  -- Safety features
  has_video_surveillance BOOLEAN NOT NULL DEFAULT FALSE,
  has_lighting BOOLEAN NOT NULL DEFAULT TRUE,
  is_indoor BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Unique name per community
  CONSTRAINT exchange_zones_unique_name UNIQUE (community_id, name)
);

-- Add audit trigger
DO $$ BEGIN
  CREATE TRIGGER exchange_zones_audit
    BEFORE INSERT OR UPDATE ON exchange_zones
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_fields();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add soft delete trigger
DO $$ BEGIN
  CREATE TRIGGER exchange_zones_soft_delete
    BEFORE DELETE ON exchange_zones
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add FK constraint to amenities if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'amenities') THEN
    BEGIN
      ALTER TABLE exchange_zones
        ADD CONSTRAINT exchange_zones_amenity_fk
        FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE exchange_zones IS
  'Designated safe meeting points for marketplace transactions.
   Zones are typically at well-lit, surveilled areas like lobbies or guard stations.';

COMMENT ON COLUMN exchange_zones.location_instructions IS
  'Human-readable directions within the community to find this zone.
   Example: "Inside main lobby, to the left of the reception desk"';

COMMENT ON COLUMN exchange_zones.available_hours IS
  'JSONB object with per-day availability. Keys are: mon, tue, wed, thu, fri, sat, sun.
   Each day has {open: "HH:MM", close: "HH:MM"} or null if closed.';

COMMENT ON COLUMN exchange_zones.amenity_id IS
  'Optional link to amenities table if this zone is at/near an amenity.
   FK constraint added when amenities table exists.';

-- ============================================
-- EXCHANGE_APPOINTMENTS TABLE
-- ============================================
-- Scheduled meetings between buyers and sellers at exchange zones

CREATE TABLE IF NOT EXISTS exchange_appointments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Transaction context
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  exchange_zone_id UUID NOT NULL REFERENCES exchange_zones(id) ON DELETE RESTRICT,

  -- Parties involved
  seller_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Schedule
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,

  -- Status workflow: pending -> approved -> completed/cancelled
  status approval_status NOT NULL DEFAULT 'pending',

  -- Dual confirmation for completion
  seller_confirmed BOOLEAN,
  buyer_confirmed BOOLEAN,
  completed_at TIMESTAMPTZ,

  -- Notes from either party
  notes TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT exchange_appointments_different_parties CHECK (seller_id != buyer_id),
  CONSTRAINT exchange_appointments_valid_duration CHECK (duration_minutes BETWEEN 15 AND 120)
);

-- Add audit trigger
DO $$ BEGIN
  CREATE TRIGGER exchange_appointments_audit
    BEFORE INSERT OR UPDATE ON exchange_appointments
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_fields();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add soft delete trigger
DO $$ BEGIN
  CREATE TRIGGER exchange_appointments_soft_delete
    BEFORE DELETE ON exchange_appointments
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Comments
COMMENT ON TABLE exchange_appointments IS
  'Scheduled appointments for marketplace item exchanges.
   Both parties must confirm completion for the listing to be marked as sold.';

COMMENT ON COLUMN exchange_appointments.seller_confirmed IS
  'Set to TRUE when seller confirms the exchange was completed successfully.';

COMMENT ON COLUMN exchange_appointments.buyer_confirmed IS
  'Set to TRUE when buyer confirms receipt of the item/service.';

COMMENT ON COLUMN exchange_appointments.completed_at IS
  'Timestamp when both parties confirmed completion.
   Set automatically by confirm_exchange_completion() function.';

-- ============================================
-- INDEXES
-- ============================================

-- Active exchange zones in community
CREATE INDEX IF NOT EXISTS idx_exchange_zones_community_active
  ON exchange_zones(community_id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Appointments by listing
CREATE INDEX IF NOT EXISTS idx_exchange_appointments_listing
  ON exchange_appointments(listing_id)
  WHERE deleted_at IS NULL;

-- Appointments by schedule (for calendar queries)
CREATE INDEX IF NOT EXISTS idx_exchange_appointments_schedule
  ON exchange_appointments(scheduled_at)
  WHERE deleted_at IS NULL;

-- Pending appointments (for reminders)
CREATE INDEX IF NOT EXISTS idx_exchange_appointments_pending
  ON exchange_appointments(community_id, scheduled_at)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- User's appointments (seller or buyer)
CREATE INDEX IF NOT EXISTS idx_exchange_appointments_seller
  ON exchange_appointments(seller_id, scheduled_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exchange_appointments_buyer
  ON exchange_appointments(buyer_id, scheduled_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================
-- CONFIRM EXCHANGE COMPLETION FUNCTION
-- ============================================
-- Handles dual confirmation and marks listing as sold

CREATE OR REPLACE FUNCTION confirm_exchange_completion(
  p_appointment_id UUID,
  p_role TEXT  -- 'seller' or 'buyer'
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Validate role parameter
  IF p_role NOT IN ('seller', 'buyer') THEN
    RETURN QUERY SELECT FALSE, 'Invalid role. Must be seller or buyer.';
    RETURN;
  END IF;

  -- Get appointment with lock to prevent race conditions
  SELECT * INTO v_appointment
  FROM public.exchange_appointments
  WHERE id = p_appointment_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Appointment not found.';
    RETURN;
  END IF;

  -- Verify appointment is in approved status
  IF v_appointment.status NOT IN ('approved', 'pending') THEN
    RETURN QUERY SELECT FALSE, 'Appointment cannot be confirmed in current status.';
    RETURN;
  END IF;

  -- Verify user is the correct party
  IF p_role = 'seller' AND v_appointment.seller_id != v_user_id THEN
    RETURN QUERY SELECT FALSE, 'Only the seller can confirm as seller.';
    RETURN;
  END IF;

  IF p_role = 'buyer' AND v_appointment.buyer_id != v_user_id THEN
    RETURN QUERY SELECT FALSE, 'Only the buyer can confirm as buyer.';
    RETURN;
  END IF;

  -- Set the appropriate confirmation flag
  IF p_role = 'seller' THEN
    UPDATE public.exchange_appointments
    SET seller_confirmed = TRUE,
        updated_at = now()
    WHERE id = p_appointment_id;
  ELSE
    UPDATE public.exchange_appointments
    SET buyer_confirmed = TRUE,
        updated_at = now()
    WHERE id = p_appointment_id;
  END IF;

  -- Refresh to check if both confirmed
  SELECT * INTO v_appointment
  FROM public.exchange_appointments
  WHERE id = p_appointment_id;

  -- If both confirmed, complete the exchange and mark listing as sold
  IF v_appointment.seller_confirmed = TRUE AND v_appointment.buyer_confirmed = TRUE THEN
    -- Update appointment to completed
    UPDATE public.exchange_appointments
    SET status = 'approved',  -- Using 'approved' as completed since it's in approval_status enum
        completed_at = now(),
        updated_at = now()
    WHERE id = p_appointment_id;

    -- Mark listing as sold
    UPDATE public.marketplace_listings
    SET is_sold = TRUE,
        sold_at = now(),
        sold_to_resident_id = v_appointment.buyer_id,
        moderation_status = 'approved',  -- Ensure it stays approved
        updated_at = now()
    WHERE id = v_appointment.listing_id;

    RETURN QUERY SELECT TRUE, 'Exchange completed. Listing marked as sold.';
  ELSE
    RETURN QUERY SELECT TRUE, format('Confirmation recorded. Waiting for %s confirmation.',
      CASE WHEN p_role = 'seller' THEN 'buyer' ELSE 'seller' END);
  END IF;
END;
$$;

COMMENT ON FUNCTION confirm_exchange_completion IS
  'Confirms an exchange from either the seller or buyer perspective.
   When both parties confirm, the listing is automatically marked as sold.
   Parameters:
   - p_appointment_id: The exchange appointment UUID
   - p_role: "seller" or "buyer"
   Returns success boolean and message.';

-- ============================================
-- DEFAULT EXCHANGE ZONES FUNCTION
-- ============================================
-- Seeds default exchange zones for new communities

CREATE OR REPLACE FUNCTION create_default_exchange_zones(p_community_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row_count INTEGER;
BEGIN
  -- Insert "Lobby Principal" if not exists
  INSERT INTO public.exchange_zones (
    community_id, name, description, location_instructions,
    has_video_surveillance, has_lighting, is_indoor,
    available_hours
  )
  VALUES (
    p_community_id,
    'Lobby Principal',
    'Area de recepcion principal del edificio',
    'Entrada principal, junto al escritorio de recepcion',
    TRUE,  -- has_video_surveillance
    TRUE,  -- has_lighting
    TRUE,  -- is_indoor
    '{"mon": {"open": "06:00", "close": "22:00"},
      "tue": {"open": "06:00", "close": "22:00"},
      "wed": {"open": "06:00", "close": "22:00"},
      "thu": {"open": "06:00", "close": "22:00"},
      "fri": {"open": "06:00", "close": "22:00"},
      "sat": {"open": "08:00", "close": "20:00"},
      "sun": {"open": "08:00", "close": "20:00"}}'::JSONB
  )
  ON CONFLICT (community_id, name) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_count := v_count + v_row_count;

  -- Insert "Caseta de Vigilancia" if not exists
  INSERT INTO public.exchange_zones (
    community_id, name, description, location_instructions,
    has_video_surveillance, has_lighting, is_indoor,
    available_hours
  )
  VALUES (
    p_community_id,
    'Caseta de Vigilancia',
    'Area de seguridad en la entrada del fraccionamiento',
    'Caseta de entrada principal, junto a la ventanilla de guardia',
    TRUE,  -- has_video_surveillance
    TRUE,  -- has_lighting
    FALSE, -- is_indoor (typically outdoor booth)
    '{"mon": {"open": "00:00", "close": "23:59"},
      "tue": {"open": "00:00", "close": "23:59"},
      "wed": {"open": "00:00", "close": "23:59"},
      "thu": {"open": "00:00", "close": "23:59"},
      "fri": {"open": "00:00", "close": "23:59"},
      "sat": {"open": "00:00", "close": "23:59"},
      "sun": {"open": "00:00", "close": "23:59"}}'::JSONB
  )
  ON CONFLICT (community_id, name) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_count := v_count + v_row_count;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION create_default_exchange_zones IS
  'Creates default exchange zones for a new community.
   Zones created:
   - Lobby Principal: Main reception area (06:00-22:00 weekdays, 08:00-20:00 weekends)
   - Caseta de Vigilancia: Guard station at entrance (24/7)
   Both have video surveillance and lighting.';

-- ============================================
-- ROW LEVEL SECURITY - EXCHANGE ZONES
-- ============================================

ALTER TABLE exchange_zones ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
DROP POLICY IF EXISTS super_admin_all_exchange_zones ON exchange_zones;
CREATE POLICY super_admin_all_exchange_zones ON exchange_zones
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- All authenticated users can view active exchange zones in their community
DROP POLICY IF EXISTS users_view_exchange_zones ON exchange_zones;
CREATE POLICY users_view_exchange_zones ON exchange_zones
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND status = 'active'
    AND deleted_at IS NULL
  );

-- Admins/managers can manage exchange zones
DROP POLICY IF EXISTS admins_manage_exchange_zones ON exchange_zones;
CREATE POLICY admins_manage_exchange_zones ON exchange_zones
  FOR ALL
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- ROW LEVEL SECURITY - EXCHANGE APPOINTMENTS
-- ============================================

ALTER TABLE exchange_appointments ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
DROP POLICY IF EXISTS super_admin_all_appointments ON exchange_appointments;
CREATE POLICY super_admin_all_appointments ON exchange_appointments
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Participants can view their appointments (as seller or buyer)
DROP POLICY IF EXISTS participants_view_appointments ON exchange_appointments;
CREATE POLICY participants_view_appointments ON exchange_appointments
  FOR SELECT
  USING (
    (seller_id = auth.uid() OR buyer_id = auth.uid())
    AND deleted_at IS NULL
  );

-- Buyers can create appointments (they initiate the purchase)
DROP POLICY IF EXISTS buyers_create_appointments ON exchange_appointments;
CREATE POLICY buyers_create_appointments ON exchange_appointments
  FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    AND community_id = (SELECT get_current_community_id())
    AND status = 'pending'
  );

-- Participants can update their appointments (confirm, cancel)
DROP POLICY IF EXISTS participants_update_appointments ON exchange_appointments;
CREATE POLICY participants_update_appointments ON exchange_appointments
  FOR UPDATE
  USING (
    (seller_id = auth.uid() OR buyer_id = auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    (seller_id = auth.uid() OR buyer_id = auth.uid())
  );

-- Participants can cancel (soft delete) their appointments
DROP POLICY IF EXISTS participants_delete_appointments ON exchange_appointments;
CREATE POLICY participants_delete_appointments ON exchange_appointments
  FOR DELETE
  USING (
    (seller_id = auth.uid() OR buyer_id = auth.uid())
    AND deleted_at IS NULL
  );

-- Admins can view all appointments in their community
DROP POLICY IF EXISTS admins_view_all_appointments ON exchange_appointments;
CREATE POLICY admins_view_all_appointments ON exchange_appointments
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    AND deleted_at IS NULL
  );

-- ============================================
-- ADD FK FROM LISTINGS TO EXCHANGE ZONES
-- ============================================
-- Now that exchange_zones exists, add the FK from marketplace_listings

DO $$
BEGIN
  ALTER TABLE marketplace_listings
    ADD CONSTRAINT marketplace_listings_exchange_zone_fk
    FOREIGN KEY (preferred_exchange_zone_id) REFERENCES exchange_zones(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
