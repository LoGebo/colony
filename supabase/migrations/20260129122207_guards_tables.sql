-- ============================================
-- GUARDS AND SHIFT MANAGEMENT TABLES
-- ============================================
-- Phase 03-01: Access Control & Security Infrastructure
-- Complete guard workforce management: profiles, certifications, shifts, assignments

-- ============================================
-- GUARDS TABLE
-- ============================================
-- Security personnel (separate from residents for non-resident staff)

CREATE TABLE guards (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Optional link to auth if guard has app access
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Personal info (Mexican name format)
  first_name TEXT NOT NULL,
  paternal_surname TEXT NOT NULL,
  maternal_surname TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    first_name || ' ' || paternal_surname || COALESCE(' ' || maternal_surname, '')
  ) STORED,
  photo_url TEXT,

  -- Contact
  phone phone_number NOT NULL,
  phone_emergency phone_number,
  email TEXT,

  -- Employment
  employee_number TEXT,                    -- Company employee ID
  hired_at DATE,                          -- Date of hire
  employment_status general_status NOT NULL DEFAULT 'active',

  -- Documents (Mexican IDs)
  ine_number TEXT,                        -- INE (voter ID) number
  curp TEXT,                              -- CURP (unique population registry)

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE guards IS
  'Security personnel records. Guards may or may not have app access (user_id).
   Separate from residents table to support third-party security companies.';

COMMENT ON COLUMN guards.user_id IS 'Optional link to auth.users for guards with app access';
COMMENT ON COLUMN guards.ine_number IS 'Mexican INE (Instituto Nacional Electoral) credential number';
COMMENT ON COLUMN guards.curp IS 'Mexican CURP (Clave Unica de Registro de Poblacion)';

-- ============================================
-- GUARD CERTIFICATIONS TABLE
-- ============================================
-- Training records and certifications for guards

CREATE TABLE guard_certifications (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,

  certification_type TEXT NOT NULL,        -- 'security_license', 'first_aid', 'fire_safety'
  certificate_number TEXT,                 -- Official certificate number
  issuing_authority TEXT,                  -- Who issued the certificate
  issued_at DATE NOT NULL,                 -- When issued
  expires_at DATE,                         -- Expiration date (NULL = no expiry)
  document_url TEXT,                       -- Certificate scan in storage

  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE guard_certifications IS
  'Guard training records and certifications with expiry tracking.
   Common types: security_license, first_aid, fire_safety, cpr, weapons';

COMMENT ON COLUMN guard_certifications.certification_type IS
  'Type of certification (security_license, first_aid, fire_safety, cpr, weapons)';

-- ============================================
-- GUARD SHIFTS TABLE
-- ============================================
-- Shift definitions (templates, not actual assignments)

CREATE TABLE guard_shifts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,                      -- "Morning Shift", "Night Shift"

  -- Schedule times
  start_time TIME NOT NULL,                -- Shift starts at this time
  end_time TIME NOT NULL,                  -- Shift ends at this time

  -- Which days this shift applies (NULL = all days)
  -- Array of day-of-week: 0=Sun, 1=Mon, ..., 6=Sat
  applicable_days INTEGER[],

  -- Computed: whether shift crosses midnight (22:00-06:00)
  crosses_midnight BOOLEAN GENERATED ALWAYS AS (end_time < start_time) STORED,

  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT guard_shifts_name_unique UNIQUE (community_id, name)
);

COMMENT ON TABLE guard_shifts IS
  'Shift definitions (templates) for guard scheduling.
   Actual guard assignments are in shift_assignments table.';

COMMENT ON COLUMN guard_shifts.applicable_days IS
  'Days of week this shift applies. Array of 0-6 where 0=Sunday. NULL = all days.';
COMMENT ON COLUMN guard_shifts.crosses_midnight IS
  'Auto-computed: TRUE if shift spans midnight (e.g., 22:00-06:00)';

-- ============================================
-- SHIFT ASSIGNMENTS TABLE
-- ============================================
-- Links guards to shifts at specific access points

CREATE TABLE shift_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES guard_shifts(id) ON DELETE CASCADE,
  access_point_id UUID NOT NULL REFERENCES access_points(id) ON DELETE CASCADE,

  -- Assignment period
  effective_from DATE NOT NULL,            -- When assignment starts
  effective_until DATE,                    -- When assignment ends (NULL = ongoing)

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Prevent double-booking same guard at same time/place
  CONSTRAINT assignments_guard_shift_unique
    UNIQUE (guard_id, shift_id, access_point_id, effective_from)
);

COMMENT ON TABLE shift_assignments IS
  'Assigns guards to specific shifts at specific access points for a date range.
   Used to track who should be on duty where and when.';

COMMENT ON COLUMN shift_assignments.effective_until IS
  'End date of assignment. NULL means ongoing/indefinite assignment.';

-- ============================================
-- INDEXES
-- ============================================

-- Guards
CREATE INDEX idx_guards_community ON guards(community_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_guards_user ON guards(user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_guards_status ON guards(community_id, employment_status)
  WHERE deleted_at IS NULL;

-- Guard certifications
CREATE INDEX idx_guard_certs_guard ON guard_certifications(guard_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_guard_certs_expiry ON guard_certifications(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'active';

-- Guard shifts
CREATE INDEX idx_guard_shifts_community ON guard_shifts(community_id)
  WHERE deleted_at IS NULL;

-- Shift assignments
CREATE INDEX idx_shift_assignments_guard ON shift_assignments(guard_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_shift_assignments_access_point ON shift_assignments(access_point_id, effective_from)
  WHERE deleted_at IS NULL;

-- ============================================
-- AUDIT TRIGGERS
-- ============================================

CREATE TRIGGER guards_audit
  BEFORE INSERT OR UPDATE ON guards
  FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER guard_certifications_audit
  BEFORE INSERT OR UPDATE ON guard_certifications
  FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER guard_shifts_audit
  BEFORE INSERT OR UPDATE ON guard_shifts
  FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER shift_assignments_audit
  BEFORE INSERT OR UPDATE ON shift_assignments
  FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;

-- =====================
-- Guards RLS
-- =====================

CREATE POLICY "super_admin_all_guards"
  ON guards FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "users_view_own_community_guards"
  ON guards FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "admins_manage_guards"
  ON guards FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- =====================
-- Guard Certifications RLS (follows guard access)
-- =====================

CREATE POLICY "super_admin_all_guard_certs"
  ON guard_certifications FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "users_view_guard_certs"
  ON guard_certifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM guards g
    WHERE g.id = guard_certifications.guard_id
      AND g.community_id = (SELECT get_current_community_id())
      AND g.deleted_at IS NULL
  ));

CREATE POLICY "admins_manage_guard_certs"
  ON guard_certifications FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM guards g
    WHERE g.id = guard_certifications.guard_id
      AND g.community_id = (SELECT get_current_community_id())
      AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM guards g
    WHERE g.id = guard_certifications.guard_id
      AND g.community_id = (SELECT get_current_community_id())
      AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  ));

-- =====================
-- Guard Shifts RLS
-- =====================

CREATE POLICY "super_admin_all_shifts"
  ON guard_shifts FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "users_view_own_community_shifts"
  ON guard_shifts FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "admins_manage_shifts"
  ON guard_shifts FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- =====================
-- Shift Assignments RLS
-- =====================

CREATE POLICY "super_admin_all_assignments"
  ON shift_assignments FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "users_view_own_community_assignments"
  ON shift_assignments FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "admins_manage_assignments"
  ON shift_assignments FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- GET GUARDS ON DUTY FUNCTION
-- ============================================
-- Returns guards currently on duty at a given access point

CREATE OR REPLACE FUNCTION get_guards_on_duty(
  p_access_point_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF guards
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT g.*
  FROM public.guards g
  JOIN public.shift_assignments sa ON sa.guard_id = g.id
  JOIN public.guard_shifts s ON s.id = sa.shift_id
  WHERE sa.access_point_id = p_access_point_id
    AND sa.status = 'active'
    AND sa.deleted_at IS NULL
    AND sa.effective_from <= p_check_time::DATE
    AND (sa.effective_until IS NULL OR sa.effective_until >= p_check_time::DATE)
    AND (s.applicable_days IS NULL OR EXTRACT(DOW FROM p_check_time)::INTEGER = ANY(s.applicable_days))
    AND (
      CASE WHEN s.crosses_midnight THEN
        -- Night shift: time is >= start OR time is <= end
        p_check_time::TIME >= s.start_time OR p_check_time::TIME <= s.end_time
      ELSE
        -- Day shift: time is between start and end
        p_check_time::TIME BETWEEN s.start_time AND s.end_time
      END
    )
    AND g.deleted_at IS NULL
    AND g.employment_status = 'active';
$$;

COMMENT ON FUNCTION get_guards_on_duty(UUID, TIMESTAMPTZ) IS
  'Returns guards currently on duty at a specific access point.
   Handles midnight-crossing shifts (e.g., 22:00-06:00).
   Usage: SELECT * FROM get_guards_on_duty(''access-point-uuid'');';
