-- Migration: Medical conditions and accessibility needs tables for Phase 8-06
-- Provides privacy-aware medical and accessibility tracking for emergency preparedness

-- ============================================================================
-- MEDICAL CONDITION TYPE ENUM
-- ============================================================================

CREATE TYPE medical_condition_type AS ENUM (
  'allergy',
  'chronic_condition',
  'disability',
  'medication',
  'other'
);

CREATE TYPE medical_severity AS ENUM (
  'mild',
  'moderate',
  'severe',
  'life_threatening'
);

-- ============================================================================
-- ACCESSIBILITY NEED TYPE ENUM
-- ============================================================================

CREATE TYPE accessibility_need_type AS ENUM (
  'wheelchair',
  'visual',
  'hearing',
  'cognitive',
  'mobility',
  'respiratory',
  'other'
);

CREATE TYPE mobility_device_type AS ENUM (
  'wheelchair',
  'walker',
  'scooter',
  'cane',
  'other'
);

-- ============================================================================
-- MEDICAL CONDITIONS TABLE
-- ============================================================================

CREATE TABLE medical_conditions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Condition details
  condition_type medical_condition_type NOT NULL,
  condition_name TEXT NOT NULL,
  severity medical_severity,
  description TEXT,

  -- Allergy-specific
  reaction_description TEXT,

  -- Medications
  medications TEXT[],

  -- CRITICAL: Emergency instructions
  emergency_instructions TEXT,

  -- Medical provider info
  doctor_name TEXT,
  doctor_phone TEXT,
  hospital_preference TEXT,

  -- Documentation
  document_url TEXT,

  -- Privacy controls
  share_with_security BOOLEAN NOT NULL DEFAULT true,
  share_with_neighbors BOOLEAN NOT NULL DEFAULT false,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Comments
COMMENT ON TABLE medical_conditions IS 'Medical conditions for residents with privacy-aware sharing controls';
COMMENT ON COLUMN medical_conditions.emergency_instructions IS 'CRITICAL: Instructions for responders in medical emergency (e.g., EpiPen location)';
COMMENT ON COLUMN medical_conditions.share_with_security IS 'If true, guards can view this condition. CRITICAL for allergies and life-threatening conditions.';
COMMENT ON COLUMN medical_conditions.share_with_neighbors IS 'If true, neighbors can view for community support (rare, resident choice)';

-- ============================================================================
-- ACCESSIBILITY NEEDS TABLE
-- ============================================================================

CREATE TABLE accessibility_needs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Need details
  need_type accessibility_need_type NOT NULL,
  description TEXT NOT NULL,

  -- Required accommodations
  accommodations TEXT[],  -- 'ramp_access', 'elevator_priority', 'large_print', 'sign_language', etc.

  -- Mobility equipment
  uses_mobility_device BOOLEAN NOT NULL DEFAULT false,
  mobility_device_type mobility_device_type,

  -- Service animal
  has_service_animal BOOLEAN NOT NULL DEFAULT false,
  service_animal_type TEXT,

  -- Evacuation requirements
  needs_evacuation_assistance BOOLEAN NOT NULL DEFAULT false,
  evacuation_notes TEXT,

  -- Unit modifications
  unit_modifications TEXT[],

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Comments
COMMENT ON TABLE accessibility_needs IS 'Accessibility needs for residents to enable proper accommodation and evacuation planning';
COMMENT ON COLUMN accessibility_needs.accommodations IS 'Required accommodations: ramp_access, elevator_priority, large_print, sign_language, etc.';
COMMENT ON COLUMN accessibility_needs.needs_evacuation_assistance IS 'If true, resident requires assistance during evacuation (fire, earthquake, etc.)';
COMMENT ON COLUMN accessibility_needs.evacuation_notes IS 'Specific instructions for evacuation assistance (e.g., "Cannot use stairs, needs stair chair")';
COMMENT ON COLUMN accessibility_needs.unit_modifications IS 'Modifications made to unit: grab_bars, ramp, widened_doorways, etc.';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Medical conditions: by resident
CREATE INDEX idx_medical_conditions_resident
  ON medical_conditions(resident_id)
  WHERE deleted_at IS NULL;

-- Medical conditions: security-visible conditions for guard access
CREATE INDEX idx_medical_conditions_security
  ON medical_conditions(community_id)
  WHERE share_with_security = true AND deleted_at IS NULL;

-- Accessibility needs: by resident
CREATE INDEX idx_accessibility_needs_resident
  ON accessibility_needs(resident_id)
  WHERE deleted_at IS NULL;

-- Accessibility needs: evacuation priority list
CREATE INDEX idx_accessibility_evacuation
  ON accessibility_needs(community_id)
  WHERE needs_evacuation_assistance = true AND deleted_at IS NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Audit trigger for medical_conditions
CREATE TRIGGER set_medical_conditions_audit
  BEFORE INSERT OR UPDATE ON medical_conditions
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger for medical_conditions
CREATE TRIGGER soft_delete_medical_conditions
  BEFORE DELETE ON medical_conditions
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- Audit trigger for accessibility_needs
CREATE TRIGGER set_accessibility_needs_audit
  BEFORE INSERT OR UPDATE ON accessibility_needs
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger for accessibility_needs
CREATE TRIGGER soft_delete_accessibility_needs
  BEFORE DELETE ON accessibility_needs
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- ============================================================================
-- SECURITY MEDICAL SUMMARY VIEW
-- ============================================================================
-- View for guard booth quick access to critical medical/accessibility info

CREATE VIEW security_medical_summary AS
SELECT
  r.id AS resident_id,
  r.full_name,
  u.unit_number,
  mc.condition_type,
  mc.condition_name,
  mc.severity,
  mc.emergency_instructions,
  an.need_type,
  an.needs_evacuation_assistance,
  an.evacuation_notes
FROM residents r
JOIN occupancies o ON o.resident_id = r.id AND o.status = 'active' AND o.deleted_at IS NULL
JOIN units u ON u.id = o.unit_id
LEFT JOIN medical_conditions mc ON mc.resident_id = r.id AND mc.share_with_security = true AND mc.deleted_at IS NULL
LEFT JOIN accessibility_needs an ON an.resident_id = r.id AND an.deleted_at IS NULL
WHERE r.deleted_at IS NULL;

COMMENT ON VIEW security_medical_summary IS 'Summary view of medical conditions and accessibility needs for security staff. Only shows conditions where share_with_security = true.';

-- ============================================================================
-- EVACUATION PRIORITY LIST FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_evacuation_priority_list(p_community_id UUID)
RETURNS TABLE (
  resident_id UUID,
  resident_name TEXT,
  unit_id UUID,
  unit_number TEXT,
  floor_number INTEGER,
  need_type accessibility_need_type,
  needs_evacuation_assistance BOOLEAN,
  evacuation_notes TEXT,
  uses_mobility_device BOOLEAN,
  mobility_device_type mobility_device_type
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    r.id AS resident_id,
    r.full_name AS resident_name,
    u.id AS unit_id,
    u.unit_number,
    u.floor_number,
    an.need_type,
    an.needs_evacuation_assistance,
    an.evacuation_notes,
    an.uses_mobility_device,
    an.mobility_device_type
  FROM residents r
  JOIN occupancies o ON o.resident_id = r.id
  JOIN units u ON u.id = o.unit_id
  JOIN accessibility_needs an ON an.resident_id = r.id
  WHERE u.community_id = p_community_id
    AND an.needs_evacuation_assistance = true
    AND an.deleted_at IS NULL
    AND o.status = 'active'
    AND o.deleted_at IS NULL
    AND r.deleted_at IS NULL
  ORDER BY u.floor_number DESC, u.unit_number ASC;  -- Higher floors first for fire evacuation
$$;

COMMENT ON FUNCTION get_evacuation_priority_list IS 'Returns residents needing evacuation assistance, ordered by floor (highest first for fire evacuation protocol)';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE medical_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_needs ENABLE ROW LEVEL SECURITY;

-- MEDICAL CONDITIONS RLS

-- Residents can view their own conditions
CREATE POLICY medical_conditions_select_own ON medical_conditions
  FOR SELECT
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Residents can insert their own conditions
CREATE POLICY medical_conditions_insert_own ON medical_conditions
  FOR INSERT
  WITH CHECK (
    resident_id = (SELECT auth.uid())
    AND community_id = (SELECT get_current_community_id())
  );

-- Residents can update their own conditions
CREATE POLICY medical_conditions_update_own ON medical_conditions
  FOR UPDATE
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    resident_id = (SELECT auth.uid())
  );

-- Residents can delete (soft) their own conditions
CREATE POLICY medical_conditions_delete_own ON medical_conditions
  FOR DELETE
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Staff can view all conditions in their community
CREATE POLICY medical_conditions_select_staff ON medical_conditions
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin', 'manager', 'staff')
  );

-- Guards can view only conditions where share_with_security = true
CREATE POLICY medical_conditions_select_guard ON medical_conditions
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND share_with_security = true
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'guard'
  );

-- ACCESSIBILITY NEEDS RLS

-- Residents can view their own accessibility needs
CREATE POLICY accessibility_needs_select_own ON accessibility_needs
  FOR SELECT
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Residents can insert their own accessibility needs
CREATE POLICY accessibility_needs_insert_own ON accessibility_needs
  FOR INSERT
  WITH CHECK (
    resident_id = (SELECT auth.uid())
    AND community_id = (SELECT get_current_community_id())
  );

-- Residents can update their own accessibility needs
CREATE POLICY accessibility_needs_update_own ON accessibility_needs
  FOR UPDATE
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    resident_id = (SELECT auth.uid())
  );

-- Residents can delete (soft) their own accessibility needs
CREATE POLICY accessibility_needs_delete_own ON accessibility_needs
  FOR DELETE
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Staff can view all accessibility needs (needed for accommodation)
CREATE POLICY accessibility_needs_select_staff ON accessibility_needs
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin', 'manager', 'staff')
  );

-- Guards can view all accessibility needs (needed for accommodation and evacuation)
CREATE POLICY accessibility_needs_select_guard ON accessibility_needs
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'guard'
  );

-- ============================================================================
-- ENABLE AUDIT TRACKING (conditional)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enable_tracking' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'audit')) THEN
    PERFORM audit.enable_tracking('public.medical_conditions'::regclass);
    PERFORM audit.enable_tracking('public.accessibility_needs'::regclass);
  END IF;
END;
$$;
