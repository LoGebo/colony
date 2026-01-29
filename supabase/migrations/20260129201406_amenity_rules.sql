-- ============================================
-- AMENITY RULES TABLE AND VALIDATION FUNCTION
-- Phase 5 Plan 01 Task 3: Booking Rules Engine
-- ============================================
-- Configurable rules per amenity for quotas, advance windows,
-- blackout dates, and other booking restrictions.
-- Rules are data-driven - administrators can add/modify rules
-- without code changes.

-- ============================================
-- AMENITY_RULES TABLE
-- ============================================

CREATE TABLE amenity_rules (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,

  -- Rule configuration
  rule_type rule_type NOT NULL,

  -- Type-specific JSONB configuration
  -- See rule_type enum comments for expected formats:
  --   max_per_day: {"limit": 1}
  --   max_per_week: {"limit": 3}
  --   max_per_month: {"limit": 5}
  --   advance_min: {"hours": 2}
  --   advance_max: {"days": 30}
  --   duration_min: {"minutes": 30}
  --   duration_max: {"minutes": 180}
  --   blackout: {"start": "2026-12-24", "end": "2026-12-26", "reason": "Holidays"}
  --   require_deposit: {"amount": 500, "currency": "MXN"}
  --   owner_only: {} (no value needed)
  rule_value JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Priority for rule evaluation (higher = checked first)
  -- Allows blackout dates to override normal quota rules
  priority INTEGER NOT NULL DEFAULT 0,

  -- Active period for seasonal or temporary rules
  effective_from DATE,    -- NULL = immediately effective
  effective_until DATE,   -- NULL = no expiration

  -- Rule status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- Partial unique index: Only one default rule (no effective_from) per amenity per rule_type
-- This allows multiple seasonal rules with different effective dates
CREATE UNIQUE INDEX idx_amenity_rules_one_default_per_type
  ON amenity_rules(amenity_id, rule_type)
  WHERE effective_from IS NULL AND deleted_at IS NULL;

-- ============================================
-- TABLE AND COLUMN COMMENTS
-- ============================================

COMMENT ON TABLE amenity_rules IS
  'Configurable booking rules per amenity. Each rule_type has specific JSONB format.
   Rules are evaluated in priority order (DESC) - first violation stops the check.
   Seasonal rules can be created with effective_from/until dates.';

COMMENT ON COLUMN amenity_rules.rule_type IS
  'Type of rule. Determines expected rule_value JSONB format.';

COMMENT ON COLUMN amenity_rules.rule_value IS
  'Type-specific rule configuration as JSONB. Examples:
   max_per_day: {"limit": 1}
   advance_max: {"days": 30}
   blackout: {"start": "2026-12-24", "end": "2026-12-26", "reason": "Holidays"}
   duration_max: {"minutes": 120}
   require_deposit: {"amount": 500, "currency": "MXN"}';

COMMENT ON COLUMN amenity_rules.priority IS
  'Evaluation priority (higher = checked first). Use for:
   - Blackout rules (priority 100) override quotas (priority 10)
   - Holiday exceptions (priority 50) override normal schedule';

COMMENT ON COLUMN amenity_rules.effective_from IS
  'Start date for rule (NULL = always active). For seasonal rules like:
   - Summer pool hours (effective_from: June 1)
   - Holiday blackouts (effective_from: Dec 24)';

COMMENT ON COLUMN amenity_rules.effective_until IS
  'End date for rule (NULL = no expiration). For temporary rules like:
   - Maintenance blackout (effective_until when repairs done)
   - Promotional rates (effective_until end of promo)';

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookup: active rules for an amenity
CREATE INDEX idx_amenity_rules_lookup
  ON amenity_rules(amenity_id, is_active, priority DESC)
  WHERE deleted_at IS NULL;

-- Community-wide rule search
CREATE INDEX idx_amenity_rules_community
  ON amenity_rules(community_id, rule_type)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger
CREATE TRIGGER set_amenity_rules_audit
  BEFORE INSERT OR UPDATE ON amenity_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER amenity_rules_soft_delete
  BEFORE DELETE ON amenity_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE amenity_rules ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY super_admin_all_amenity_rules ON amenity_rules
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users: view active rules for their community's amenities
CREATE POLICY users_view_amenity_rules ON amenity_rules
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND community_id = (SELECT public.get_current_community_id())
  );

-- Admins/Managers: manage rules in their community
CREATE POLICY admins_manage_amenity_rules ON amenity_rules
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
-- VALIDATE BOOKING RULES FUNCTION
-- ============================================
-- Core rule validation engine. Checks all active rules for an amenity
-- against a proposed reservation time.
--
-- Returns: is_valid BOOLEAN, violated_rule TEXT, message TEXT
-- On first violation, returns details. If all pass, returns (true, NULL, NULL).

CREATE OR REPLACE FUNCTION validate_booking_rules(
  p_amenity_id UUID,
  p_unit_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
)
RETURNS TABLE (is_valid BOOLEAN, violated_rule TEXT, message TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_booking_count INTEGER;
  v_advance_hours NUMERIC;
  v_duration_minutes NUMERIC;
  v_community_id UUID;
  v_occupancy_type public.occupancy_type;
BEGIN
  -- Calculate advance time and duration
  v_advance_hours := EXTRACT(EPOCH FROM (p_start_time - now())) / 3600.0;
  v_duration_minutes := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60.0;

  -- Get amenity's community for context
  SELECT community_id INTO v_community_id
  FROM public.amenities
  WHERE id = p_amenity_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'amenity_not_found'::TEXT, 'Amenity does not exist'::TEXT;
    RETURN;
  END IF;

  -- Loop through active rules ordered by priority (highest first)
  FOR r IN
    SELECT * FROM public.amenity_rules
    WHERE amenity_id = p_amenity_id
      AND is_active = TRUE
      AND deleted_at IS NULL
      AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
      AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    ORDER BY priority DESC
  LOOP
    CASE r.rule_type
      -- ========================================
      -- ADVANCE TIME RULES
      -- ========================================
      WHEN 'advance_min' THEN
        -- Must book at least X hours in advance
        IF v_advance_hours < COALESCE((r.rule_value->>'hours')::NUMERIC, 0) THEN
          RETURN QUERY SELECT FALSE, 'advance_min'::TEXT,
            format('Must book at least %s hours in advance', r.rule_value->>'hours');
          RETURN;
        END IF;

      WHEN 'advance_max' THEN
        -- Cannot book more than X days in advance
        IF v_advance_hours > (COALESCE((r.rule_value->>'days')::NUMERIC, 365) * 24.0) THEN
          RETURN QUERY SELECT FALSE, 'advance_max'::TEXT,
            format('Cannot book more than %s days in advance', r.rule_value->>'days');
          RETURN;
        END IF;

      -- ========================================
      -- DURATION RULES
      -- ========================================
      WHEN 'duration_min' THEN
        -- Reservation must be at least X minutes
        IF v_duration_minutes < COALESCE((r.rule_value->>'minutes')::NUMERIC, 0) THEN
          RETURN QUERY SELECT FALSE, 'duration_min'::TEXT,
            format('Reservation must be at least %s minutes', r.rule_value->>'minutes');
          RETURN;
        END IF;

      WHEN 'duration_max' THEN
        -- Reservation cannot exceed X minutes
        IF v_duration_minutes > COALESCE((r.rule_value->>'minutes')::NUMERIC, 1440) THEN
          RETURN QUERY SELECT FALSE, 'duration_max'::TEXT,
            format('Reservation cannot exceed %s minutes', r.rule_value->>'minutes');
          RETURN;
        END IF;

      -- ========================================
      -- QUOTA RULES
      -- ========================================
      -- Note: These rules require the reservations table (created in Plan 05-02).
      -- Until then, quota checks will pass (0 existing reservations).
      -- The checks use dynamic SQL to avoid hard dependency on the table.

      WHEN 'max_per_day' THEN
        -- Count existing confirmed reservations for this unit on the same day
        BEGIN
          SELECT COUNT(*) INTO v_booking_count
          FROM public.reservations res
          WHERE res.amenity_id = p_amenity_id
            AND res.unit_id = p_unit_id
            AND res.status = 'confirmed'
            AND res.deleted_at IS NULL
            AND date_trunc('day', lower(res.reserved_range)) = date_trunc('day', p_start_time);
        EXCEPTION
          WHEN undefined_table THEN
            v_booking_count := 0;  -- Table doesn't exist yet
        END;

        IF v_booking_count >= COALESCE((r.rule_value->>'limit')::INTEGER, 99) THEN
          RETURN QUERY SELECT FALSE, 'max_per_day'::TEXT,
            format('Maximum %s reservation(s) per day reached', r.rule_value->>'limit');
          RETURN;
        END IF;

      WHEN 'max_per_week' THEN
        -- Count reservations in the same ISO week
        BEGIN
          SELECT COUNT(*) INTO v_booking_count
          FROM public.reservations res
          WHERE res.amenity_id = p_amenity_id
            AND res.unit_id = p_unit_id
            AND res.status = 'confirmed'
            AND res.deleted_at IS NULL
            AND date_trunc('week', lower(res.reserved_range)) = date_trunc('week', p_start_time);
        EXCEPTION
          WHEN undefined_table THEN
            v_booking_count := 0;  -- Table doesn't exist yet
        END;

        IF v_booking_count >= COALESCE((r.rule_value->>'limit')::INTEGER, 99) THEN
          RETURN QUERY SELECT FALSE, 'max_per_week'::TEXT,
            format('Maximum %s reservation(s) per week reached', r.rule_value->>'limit');
          RETURN;
        END IF;

      WHEN 'max_per_month' THEN
        -- Count reservations in the same month
        BEGIN
          SELECT COUNT(*) INTO v_booking_count
          FROM public.reservations res
          WHERE res.amenity_id = p_amenity_id
            AND res.unit_id = p_unit_id
            AND res.status = 'confirmed'
            AND res.deleted_at IS NULL
            AND date_trunc('month', lower(res.reserved_range)) = date_trunc('month', p_start_time);
        EXCEPTION
          WHEN undefined_table THEN
            v_booking_count := 0;  -- Table doesn't exist yet
        END;

        IF v_booking_count >= COALESCE((r.rule_value->>'limit')::INTEGER, 99) THEN
          RETURN QUERY SELECT FALSE, 'max_per_month'::TEXT,
            format('Maximum %s reservation(s) per month reached', r.rule_value->>'limit');
          RETURN;
        END IF;

      -- ========================================
      -- BLACKOUT DATES
      -- ========================================
      WHEN 'blackout' THEN
        -- Check if reservation date falls within blackout period
        IF p_start_time::DATE BETWEEN
           COALESCE((r.rule_value->>'start')::DATE, '1900-01-01'::DATE) AND
           COALESCE((r.rule_value->>'end')::DATE, '2100-12-31'::DATE) THEN
          RETURN QUERY SELECT FALSE, 'blackout'::TEXT,
            format('Amenity unavailable: %s', COALESCE(r.rule_value->>'reason', 'Scheduled maintenance'));
          RETURN;
        END IF;

      -- ========================================
      -- OWNER-ONLY RESTRICTION
      -- ========================================
      WHEN 'owner_only' THEN
        -- Check if current user is an owner of the unit
        SELECT o.occupancy_type INTO v_occupancy_type
        FROM public.occupancies o
        WHERE o.unit_id = p_unit_id
          AND o.resident_id = auth.uid()
          AND o.status = 'active'
          AND o.deleted_at IS NULL
        LIMIT 1;

        IF v_occupancy_type IS NULL OR v_occupancy_type != 'owner' THEN
          RETURN QUERY SELECT FALSE, 'owner_only'::TEXT,
            'Only unit owners can reserve this amenity';
          RETURN;
        END IF;

      -- ========================================
      -- DEPOSIT REQUIREMENT (info only, not blocking)
      -- ========================================
      WHEN 'require_deposit' THEN
        -- This is informational - actual deposit handling is in reservation flow
        -- We don't block here, just note the requirement
        NULL;

      ELSE
        -- Unknown rule type - skip silently
        NULL;

    END CASE;
  END LOOP;

  -- All rules passed
  RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION validate_booking_rules(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Validates proposed reservation against all active rules for an amenity.
   Parameters:
     p_amenity_id: UUID of the amenity
     p_unit_id: UUID of the unit making the reservation
     p_start_time: Proposed reservation start time
     p_end_time: Proposed reservation end time
   Returns:
     is_valid: TRUE if all rules pass, FALSE if any violated
     violated_rule: The rule_type that was violated (NULL if valid)
     message: Human-readable explanation of violation (NULL if valid)

   Rules are evaluated in priority order (highest first).
   First violation stops evaluation and returns immediately.

   Note: max_per_day/week/month rules require reservations table from Plan 05-02.
   Until that table exists, these checks will return 0 count (always pass).';

-- ============================================
-- DEFAULT RULES FUNCTION
-- ============================================
-- Creates sensible default rules for a new amenity

CREATE OR REPLACE FUNCTION create_default_amenity_rules(p_amenity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community_id UUID;
BEGIN
  -- Get community from amenity
  SELECT community_id INTO v_community_id
  FROM public.amenities
  WHERE id = p_amenity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Amenity % not found', p_amenity_id;
  END IF;

  -- Default: Max 1 reservation per day per unit
  INSERT INTO public.amenity_rules (community_id, amenity_id, rule_type, rule_value, priority)
  VALUES (v_community_id, p_amenity_id, 'max_per_day', '{"limit": 1}', 10)
  ON CONFLICT DO NOTHING;

  -- Default: Max 30 days advance booking
  INSERT INTO public.amenity_rules (community_id, amenity_id, rule_type, rule_value, priority)
  VALUES (v_community_id, p_amenity_id, 'advance_max', '{"days": 30}', 5)
  ON CONFLICT DO NOTHING;

  -- Default: Min 2 hours advance booking
  INSERT INTO public.amenity_rules (community_id, amenity_id, rule_type, rule_value, priority)
  VALUES (v_community_id, p_amenity_id, 'advance_min', '{"hours": 2}', 5)
  ON CONFLICT DO NOTHING;

  -- Default: Max 3 hours duration
  INSERT INTO public.amenity_rules (community_id, amenity_id, rule_type, rule_value, priority)
  VALUES (v_community_id, p_amenity_id, 'duration_max', '{"minutes": 180}', 5)
  ON CONFLICT DO NOTHING;

END;
$$;

COMMENT ON FUNCTION create_default_amenity_rules(UUID) IS
  'Creates default booking rules for a new amenity:
   - Max 1 reservation per day per unit
   - Max 30 days advance booking
   - Min 2 hours advance notice
   - Max 3 hours duration
   Can be customized by admin after creation.';
