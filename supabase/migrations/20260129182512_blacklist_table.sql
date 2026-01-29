-- ============================================
-- BLACKLIST ENTRIES TABLE
-- ============================================
-- Banned persons/vehicles with evidence and configurable response protocols
-- Part of Phase 3 Plan 02: Invitations & Access Management
--
-- PATTERN: Evidence arrays for Mexican legal compliance
-- Protocol determines guard response: deny_entry, alert_only, call_police

CREATE TABLE blacklist_entries (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Who is blacklisted (at least one identifier required)
  person_name TEXT NOT NULL,
  person_document TEXT,                    -- ID number if known
  person_photo_url TEXT,

  -- Vehicle if applicable
  vehicle_plate TEXT,
  vehicle_plate_normalized TEXT GENERATED ALWAYS AS (
    UPPER(REGEXP_REPLACE(vehicle_plate, '[^A-Z0-9]', '', 'g'))
  ) STORED,
  vehicle_description TEXT,

  -- Reason and evidence (Mexican law requires documentation)
  reason TEXT NOT NULL,
  incident_date DATE,
  evidence_photos TEXT[],                  -- Storage URLs
  evidence_documents TEXT[],               -- Police reports, etc.
  incident_description TEXT,

  -- Related records
  related_incident_id UUID,                -- Future: incidents table in Phase 8
  related_access_log_id UUID REFERENCES access_logs(id) ON DELETE SET NULL,

  -- Validity period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,                         -- NULL for permanent ban

  -- Protocol when encountered
  protocol TEXT NOT NULL DEFAULT 'deny_entry' CHECK (protocol IN ('deny_entry', 'alert_only', 'call_police')),
  alert_guards BOOLEAN NOT NULL DEFAULT TRUE,
  notify_admin BOOLEAN NOT NULL DEFAULT TRUE,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Who added/approved
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  -- If lifted early
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id),
  lifted_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE blacklist_entries IS 'Banned persons/vehicles with evidence and configurable response protocols';
COMMENT ON COLUMN blacklist_entries.protocol IS 'Action when encountered: deny_entry (block), alert_only (allow but notify), call_police (block and alert authorities)';
COMMENT ON COLUMN blacklist_entries.evidence_photos IS 'Array of storage URLs for incident photos';
COMMENT ON COLUMN blacklist_entries.evidence_documents IS 'Array of storage URLs for police reports, legal documents, etc.';
COMMENT ON COLUMN blacklist_entries.vehicle_plate_normalized IS 'Uppercase alphanumeric plate for LPR matching (generated column)';
COMMENT ON COLUMN blacklist_entries.expires_at IS 'NULL for permanent ban, date for temporary ban';

-- ============================================
-- INDEXES
-- ============================================

-- Active blacklist entries for community
CREATE INDEX idx_blacklist_active ON blacklist_entries(community_id)
  WHERE status = 'active' AND deleted_at IS NULL AND lifted_at IS NULL;

-- Plate lookup for LPR matching
CREATE INDEX idx_blacklist_plate ON blacklist_entries(vehicle_plate_normalized)
  WHERE vehicle_plate_normalized IS NOT NULL AND status = 'active' AND lifted_at IS NULL;

-- Document lookup for ID matching
CREATE INDEX idx_blacklist_document ON blacklist_entries(person_document)
  WHERE person_document IS NOT NULL AND status = 'active' AND lifted_at IS NULL;

-- Expiring entries for cleanup jobs
CREATE INDEX idx_blacklist_expires ON blacklist_entries(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'active' AND lifted_at IS NULL;

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER blacklist_entries_audit
  BEFORE INSERT OR UPDATE ON blacklist_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- VALIDATION FUNCTION
-- ============================================
-- Checks if person/vehicle is blacklisted
-- Returns blacklist details if found

CREATE OR REPLACE FUNCTION is_blacklisted(
  p_community_id UUID,
  p_person_name TEXT DEFAULT NULL,
  p_person_document TEXT DEFAULT NULL,
  p_plate_normalized TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_blocked BOOLEAN,
  blacklist_id UUID,
  reason TEXT,
  protocol TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    TRUE,
    b.id,
    b.reason,
    b.protocol
  FROM public.blacklist_entries b
  WHERE b.community_id = p_community_id
    AND b.status = 'active'
    AND b.deleted_at IS NULL
    AND b.effective_from <= CURRENT_DATE
    AND (b.expires_at IS NULL OR b.expires_at >= CURRENT_DATE)
    AND b.lifted_at IS NULL
    AND (
      -- Match by name (fuzzy using ILIKE)
      (p_person_name IS NOT NULL AND b.person_name ILIKE '%' || p_person_name || '%')
      -- Match by document (exact)
      OR (p_person_document IS NOT NULL AND b.person_document = p_person_document)
      -- Match by normalized plate (exact)
      OR (p_plate_normalized IS NOT NULL AND b.vehicle_plate_normalized = p_plate_normalized)
    )
  LIMIT 1;
$$;

COMMENT ON FUNCTION is_blacklisted IS 'Checks if person/vehicle is on the blacklist. Matches by name (fuzzy), document (exact), or plate (exact). Returns NULL if not blacklisted.';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE blacklist_entries ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "super_admin_all_blacklist" ON blacklist_entries FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Guards can view active blacklist entries
CREATE POLICY "staff_view_blacklist" ON blacklist_entries FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
    AND deleted_at IS NULL
  );

-- Admins can manage blacklist (full CRUD)
CREATE POLICY "admins_manage_blacklist" ON blacklist_entries FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );
