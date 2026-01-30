-- ============================================
-- INCIDENT MANAGEMENT TABLES
-- ============================================
-- Phase 8 Plan 01: Incident Management Schema
--
-- Creates incident_types (configurable categories), incidents (core records),
-- incident_media (attachments), and incident_assignments (handlers).
-- Includes auto-generated incident numbers and SLA tracking fields.

-- ============================================
-- HELPER: GENERATE INCIDENT NUMBER
-- ============================================
-- Format: INC-YYYY-NNNNN (e.g., INC-2026-00001)
-- Sequential per community per year

CREATE OR REPLACE FUNCTION generate_incident_number(
  p_community_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_year := TO_CHAR(p_date, 'YYYY');

  -- Get next sequence number for this community/year
  SELECT COALESCE(
    MAX(
      NULLIF(
        REGEXP_REPLACE(incident_number, '^INC-' || v_year || '-', ''),
        incident_number
      )::INTEGER
    ),
    0
  ) + 1
  INTO v_sequence
  FROM public.incidents
  WHERE community_id = p_community_id
    AND incident_number LIKE 'INC-' || v_year || '-%';

  -- Format: INC-YYYY-NNNNN
  v_number := 'INC-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');

  RETURN v_number;
END;
$$;

COMMENT ON FUNCTION generate_incident_number IS
  'Generates sequential incident numbers per community per year.
   Format: INC-YYYY-NNNNN (e.g., INC-2026-00001)';

-- ============================================
-- INCIDENT TYPES TABLE
-- ============================================
-- Configurable incident categories per community

CREATE TABLE incident_types (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Type definition
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'security', 'maintenance', 'noise', 'pet', 'parking', 'common_area', 'other'
  )),

  -- Defaults for incidents of this type
  default_severity incident_severity NOT NULL DEFAULT 'medium',
  default_priority INTEGER NOT NULL DEFAULT 3 CHECK (default_priority BETWEEN 1 AND 5),

  -- SLA configuration (hours)
  sla_response_hours INTEGER,
  sla_resolution_hours INTEGER,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Unique name per community
  CONSTRAINT uq_incident_types_community_name UNIQUE (community_id, name)
);

-- Indexes
CREATE INDEX idx_incident_types_community ON incident_types(community_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_incident_types_category ON incident_types(community_id, category)
  WHERE deleted_at IS NULL AND is_active = true;

-- Audit trigger
CREATE TRIGGER set_incident_types_audit
  BEFORE INSERT OR UPDATE ON incident_types
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER soft_delete_incident_types
  BEFORE DELETE ON incident_types
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- Comments
COMMENT ON TABLE incident_types IS 'Configurable incident categories with default severity/priority and SLA settings';
COMMENT ON COLUMN incident_types.default_priority IS 'Priority 1=highest, 5=lowest. Applied to new incidents of this type';
COMMENT ON COLUMN incident_types.sla_response_hours IS 'Target hours for first response. NULL = no SLA';
COMMENT ON COLUMN incident_types.sla_resolution_hours IS 'Target hours for resolution. NULL = no SLA';

-- ============================================
-- INCIDENTS TABLE
-- ============================================
-- Core incident records with timeline and SLA tracking

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Auto-generated reference number
  incident_number TEXT NOT NULL,

  -- Classification
  incident_type_id UUID REFERENCES incident_types(id) ON DELETE SET NULL,
  severity incident_severity NOT NULL DEFAULT 'medium',
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),

  -- Location (polymorphic - can be unit, access_point, or general description)
  location_type TEXT CHECK (location_type IN (
    'common_area', 'unit', 'parking', 'entrance', 'exterior', 'other'
  )),
  location_description TEXT,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  access_point_id UUID REFERENCES access_points(id) ON DELETE SET NULL,
  gps_latitude NUMERIC(10, 7),
  gps_longitude NUMERIC(10, 7),

  -- Description
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Reporter (one of: resident, guard, or external)
  reported_by UUID REFERENCES residents(id) ON DELETE SET NULL,
  reported_by_guard UUID REFERENCES guards(id) ON DELETE SET NULL,
  reporter_name TEXT,  -- For external/anonymous reporters
  reporter_phone TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status tracking
  status incident_status NOT NULL DEFAULT 'reported',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Primary assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- SLA tracking
  first_response_at TIMESTAMPTZ,

  -- Timeline (JSONB array of events)
  -- Format: [{id, type, timestamp, actor_id, actor_name, data}]
  timeline JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Unique incident number per community
  CONSTRAINT uq_incidents_community_number UNIQUE (community_id, incident_number)
);

-- Indexes for common queries
CREATE INDEX idx_incidents_community_status ON incidents(community_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_incidents_reported_at ON incidents(community_id, reported_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_incidents_unit ON incidents(unit_id)
  WHERE unit_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_incidents_assigned_to ON incidents(assigned_to)
  WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_incidents_priority_open ON incidents(community_id, priority, reported_at)
  WHERE status NOT IN ('resolved', 'closed') AND deleted_at IS NULL;

-- Audit trigger
CREATE TRIGGER set_incidents_audit
  BEFORE INSERT OR UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER soft_delete_incidents
  BEFORE DELETE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- Auto-generate incident number on INSERT
CREATE OR REPLACE FUNCTION set_incident_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.incident_number IS NULL OR NEW.incident_number = '' THEN
    NEW.incident_number := public.generate_incident_number(NEW.community_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_incident_number
  BEFORE INSERT ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION set_incident_number();

-- Comments
COMMENT ON TABLE incidents IS 'Core incident records with reporter, location, status workflow, SLA tracking, and JSONB timeline';
COMMENT ON COLUMN incidents.incident_number IS 'Auto-generated: INC-YYYY-NNNNN, sequential per community per year';
COMMENT ON COLUMN incidents.priority IS 'Priority 1=highest, 5=lowest';
COMMENT ON COLUMN incidents.timeline IS 'JSONB array of events: [{id, type, timestamp, actor_id, actor_name, data}]';
COMMENT ON COLUMN incidents.first_response_at IS 'Set when status first changes from "reported", used for SLA tracking';

-- ============================================
-- INCIDENT MEDIA TABLE
-- ============================================
-- Photos, videos, audio, documents attached to incidents

CREATE TABLE incident_media (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Media info
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'audio', 'document')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes INTEGER,

  -- Metadata
  caption TEXT,
  taken_at TIMESTAMPTZ,  -- When photo/video was captured
  transcription TEXT,     -- For audio files

  -- Upload tracking
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit (no soft delete - CASCADE from incident)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incident_media_incident ON incident_media(incident_id);
CREATE INDEX idx_incident_media_community ON incident_media(community_id);

-- Comments
COMMENT ON TABLE incident_media IS 'Evidence attachments for incidents: photos, videos, audio, documents';
COMMENT ON COLUMN incident_media.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN incident_media.transcription IS 'Text transcription for audio recordings';

-- ============================================
-- INCIDENT ASSIGNMENTS TABLE
-- ============================================
-- Track all personnel assigned to incident (history and current)

CREATE TABLE incident_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Role in handling the incident
  role TEXT NOT NULL DEFAULT 'handler' CHECK (role IN ('handler', 'supervisor', 'observer')),

  -- Assignment period
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,

  -- Notes
  notes TEXT
);

-- Indexes
CREATE INDEX idx_incident_assignments_incident ON incident_assignments(incident_id);
CREATE INDEX idx_incident_assignments_user ON incident_assignments(assigned_to)
  WHERE unassigned_at IS NULL;

-- Comments
COMMENT ON TABLE incident_assignments IS 'Assignment history for incidents - tracks all handlers, supervisors, observers';
COMMENT ON COLUMN incident_assignments.role IS 'handler: primary responder, supervisor: oversight, observer: view-only';
COMMENT ON COLUMN incident_assignments.unassigned_at IS 'NULL means currently assigned';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE incident_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_assignments ENABLE ROW LEVEL SECURITY;

-- incident_types: Community members can SELECT, admins can full CRUD
CREATE POLICY incident_types_select_community ON incident_types
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY incident_types_admin_all ON incident_types
  FOR ALL
  USING (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'community_admin')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'community_admin')
  );

-- incidents: Residents can SELECT their community's incidents and INSERT (report)
CREATE POLICY incidents_select_community ON incidents
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY incidents_insert_resident ON incidents
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
  );

CREATE POLICY incidents_staff_all ON incidents
  FOR ALL
  USING (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff', 'guard', 'community_admin')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff', 'guard', 'community_admin')
  );

-- incident_media: Community members can SELECT, staff can INSERT
CREATE POLICY incident_media_select_community ON incident_media
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
  );

CREATE POLICY incident_media_insert_reporter ON incident_media
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (
      uploaded_by = (SELECT auth.uid())
      OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'staff', 'guard', 'community_admin')
    )
  );

-- incident_assignments: Staff can view and manage
CREATE POLICY incident_assignments_select_staff ON incident_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id
        AND i.community_id = (SELECT get_current_community_id())
    )
  );

CREATE POLICY incident_assignments_manage_staff ON incident_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id
        AND i.community_id = (SELECT get_current_community_id())
    )
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'community_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id
        AND i.community_id = (SELECT get_current_community_id())
    )
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager', 'community_admin')
  );

-- ============================================
-- ENABLE AUDIT TRACKING
-- ============================================
-- Note: Using DO block to handle case where audit.enable_tracking may not exist

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'audit' AND p.proname = 'enable_tracking') THEN
    PERFORM audit.enable_tracking('public.incident_types'::regclass);
    PERFORM audit.enable_tracking('public.incidents'::regclass);
  END IF;
END$$;
