-- Assemblies, attendance, and agreements tables
-- Plan 08-03: Assembly management with Mexican convocatoria system
-- Migration: 20260130050400_assemblies_tables.sql

-- ============================================================================
-- ASSEMBLY NUMBER SEQUENCE (per community)
-- ============================================================================

-- Function to generate assembly number per community: ASM-YYYY-NNN
CREATE OR REPLACE FUNCTION generate_assembly_number(p_community_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
  v_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  -- Get next sequence number for this community this year
  SELECT COALESCE(MAX(
    CASE
      WHEN assembly_number ~ ('^ASM-' || v_year || '-[0-9]+$')
      THEN SUBSTRING(assembly_number FROM 'ASM-[0-9]{4}-([0-9]+)')::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM assemblies
  WHERE community_id = p_community_id;

  v_number := 'ASM-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');

  RETURN v_number;
END;
$$;

-- ============================================================================
-- ASSEMBLIES TABLE
-- ============================================================================

CREATE TABLE assemblies (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  assembly_number TEXT NOT NULL,
  assembly_type assembly_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  location TEXT,
  meeting_url TEXT,

  -- Status (progression through convocatorias)
  status assembly_status NOT NULL DEFAULT 'scheduled',

  -- Convocatoria timestamps (Mexican law timing - 30 min between each)
  convocatoria_1_at TIMESTAMPTZ,
  convocatoria_2_at TIMESTAMPTZ,
  convocatoria_3_at TIMESTAMPTZ,

  -- Quorum tracking (updated as attendance is recorded)
  quorum_coefficient_present NUMERIC(7,4) NOT NULL DEFAULT 0,
  quorum_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  quorum_met BOOLEAN NOT NULL DEFAULT false,

  -- Actual session times
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Documentation
  agenda_document_id UUID, -- FK added after documents table check
  minutes_document_id UUID, -- FK added after documents table check

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT assemblies_community_number_unique UNIQUE (community_id, assembly_number),
  CONSTRAINT assemblies_valid_session CHECK (ended_at IS NULL OR started_at IS NOT NULL)
);

-- Add FKs to documents if table exists (it should from Phase 6)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    ALTER TABLE assemblies
      ADD CONSTRAINT assemblies_agenda_document_fk
      FOREIGN KEY (agenda_document_id) REFERENCES documents(id) ON DELETE SET NULL;

    ALTER TABLE assemblies
      ADD CONSTRAINT assemblies_minutes_document_fk
      FOREIGN KEY (minutes_document_id) REFERENCES documents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_assemblies_audit
  BEFORE INSERT OR UPDATE ON assemblies
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_assemblies_community_date ON assemblies(community_id, scheduled_date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_assemblies_status ON assemblies(community_id, status)
  WHERE deleted_at IS NULL;

-- RLS Policies
-- Super admins full access
CREATE POLICY "super_admins_full_access_assemblies"
  ON assemblies FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

-- All community members can view assemblies
CREATE POLICY "users_view_community_assemblies"
  ON assemblies FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Admins/managers can manage assemblies
CREATE POLICY "admins_manage_assemblies"
  ON assemblies FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Comments
COMMENT ON TABLE assemblies IS 'HOA assembly meetings with Mexican convocatoria quorum progression';
COMMENT ON COLUMN assemblies.assembly_number IS 'Unique identifier format: ASM-YYYY-NNN';
COMMENT ON COLUMN assemblies.convocatoria_1_at IS 'Timestamp of first call (75% quorum required)';
COMMENT ON COLUMN assemblies.convocatoria_2_at IS 'Timestamp of second call (50%+1 quorum required, ~30 min after first)';
COMMENT ON COLUMN assemblies.convocatoria_3_at IS 'Timestamp of third call (any attendance valid, ~30 min after second)';
COMMENT ON COLUMN assemblies.quorum_coefficient_present IS 'Sum of coefficients from present/checked-in units';
COMMENT ON COLUMN assemblies.quorum_percentage IS 'Present coefficient as percentage of total community coefficient';

-- ============================================================================
-- ADD FK TO ELECTIONS TABLE (links elections to assemblies)
-- ============================================================================

-- Add FK constraint to elections.assembly_id (column already exists from 08-02)
ALTER TABLE elections
  ADD CONSTRAINT elections_assembly_fk
  FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE SET NULL;

COMMENT ON COLUMN elections.assembly_id IS 'Links election to parent assembly (votes conducted during assembly)';

-- ============================================================================
-- ASSEMBLY ATTENDANCE TABLE
-- ============================================================================

CREATE TABLE assembly_attendance (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,

  -- CRITICAL: Coefficient copied at check-in time for immutable historical accuracy
  coefficient NUMERIC(7,4) NOT NULL,

  -- Attendee identification
  attendee_type attendance_type NOT NULL,
  resident_id UUID REFERENCES residents(id),
  attendee_name TEXT, -- For external representatives

  -- Proxy delegation (Mexican law: max 2 units per representative)
  is_proxy BOOLEAN NOT NULL DEFAULT false,
  proxy_grantor_id UUID REFERENCES residents(id), -- Original owner granting proxy
  proxy_document_url TEXT, -- Carta poder

  -- Check-in tracking
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ, -- For tracking who left early
  arrived_at_convocatoria INTEGER CHECK (arrived_at_convocatoria BETWEEN 1 AND 3),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One attendance per unit per assembly
  CONSTRAINT attendance_one_per_unit UNIQUE (assembly_id, unit_id),

  -- Proxy must have document
  CONSTRAINT attendance_proxy_requires_document CHECK (
    NOT is_proxy OR proxy_document_url IS NOT NULL
  ),

  -- Proxy must have grantor
  CONSTRAINT attendance_proxy_requires_grantor CHECK (
    NOT is_proxy OR proxy_grantor_id IS NOT NULL
  ),

  -- Either resident_id or attendee_name required
  CONSTRAINT attendance_requires_identification CHECK (
    resident_id IS NOT NULL OR attendee_name IS NOT NULL
  )
);

-- Enable RLS
ALTER TABLE assembly_attendance ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_assembly_attendance_assembly ON assembly_attendance(assembly_id);
CREATE INDEX idx_assembly_attendance_resident ON assembly_attendance(resident_id)
  WHERE resident_id IS NOT NULL;
CREATE INDEX idx_assembly_attendance_proxy ON assembly_attendance(resident_id, assembly_id)
  WHERE is_proxy = true;

-- RLS Policies
-- Super admins full access
CREATE POLICY "super_admins_full_access_assembly_attendance"
  ON assembly_attendance FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

-- All community members can view attendance
CREATE POLICY "users_view_assembly_attendance"
  ON assembly_attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assemblies a
      WHERE a.id = assembly_attendance.assembly_id
        AND a.community_id = (SELECT get_current_community_id())
        AND a.deleted_at IS NULL
    )
  );

-- Staff can manage attendance
CREATE POLICY "staff_manage_assembly_attendance"
  ON assembly_attendance FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assemblies a
      WHERE a.id = assembly_attendance.assembly_id
        AND a.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assemblies a
      WHERE a.id = assembly_attendance.assembly_id
        AND a.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
    )
  );

-- Comments
COMMENT ON TABLE assembly_attendance IS 'Attendance records for assembly meetings with proxy tracking';
COMMENT ON COLUMN assembly_attendance.coefficient IS 'CRITICAL: Snapshot of unit coefficient at check-in for immutable accuracy';
COMMENT ON COLUMN assembly_attendance.is_proxy IS 'True if attending on behalf of another unit (max 2 per Mexican law)';
COMMENT ON COLUMN assembly_attendance.proxy_grantor_id IS 'Original unit owner who granted the power of attorney (carta poder)';
COMMENT ON COLUMN assembly_attendance.arrived_at_convocatoria IS 'Which convocatoria was active when unit checked in (1, 2, or 3)';
COMMENT ON CONSTRAINT attendance_one_per_unit ON assembly_attendance IS 'Each unit can only have one attendance record per assembly';

-- ============================================================================
-- ASSEMBLY AGREEMENTS TABLE
-- ============================================================================

CREATE TABLE assembly_agreements (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,

  -- Agreement identification (order in assembly)
  agreement_number INTEGER NOT NULL,

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Election link (if this agreement was voted via formal election)
  election_id UUID REFERENCES elections(id) ON DELETE SET NULL,

  -- Approval details
  approved BOOLEAN,
  votes_for_coefficient NUMERIC(7,4),
  votes_against_coefficient NUMERIC(7,4),
  abstentions_coefficient NUMERIC(7,4),

  -- Action items
  action_required BOOLEAN NOT NULL DEFAULT false,
  action_description TEXT,
  action_due_date DATE,
  action_responsible TEXT,
  action_completed_at TIMESTAMPTZ,

  -- Display
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique agreement number per assembly
  CONSTRAINT agreements_number_per_assembly UNIQUE (assembly_id, agreement_number)
);

-- Enable RLS
ALTER TABLE assembly_agreements ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_assembly_agreements_assembly ON assembly_agreements(assembly_id);
CREATE INDEX idx_assembly_agreements_election ON assembly_agreements(election_id)
  WHERE election_id IS NOT NULL;
CREATE INDEX idx_assembly_agreements_pending_actions ON assembly_agreements(assembly_id)
  WHERE action_required = true AND action_completed_at IS NULL;

-- RLS Policies
-- Super admins full access
CREATE POLICY "super_admins_full_access_assembly_agreements"
  ON assembly_agreements FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

-- All community members can view agreements
CREATE POLICY "users_view_assembly_agreements"
  ON assembly_agreements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assemblies a
      WHERE a.id = assembly_agreements.assembly_id
        AND a.community_id = (SELECT get_current_community_id())
        AND a.deleted_at IS NULL
    )
  );

-- Admins can manage agreements
CREATE POLICY "admins_manage_assembly_agreements"
  ON assembly_agreements FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assemblies a
      WHERE a.id = assembly_agreements.assembly_id
        AND a.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assemblies a
      WHERE a.id = assembly_agreements.assembly_id
        AND a.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- Comments
COMMENT ON TABLE assembly_agreements IS 'Resolutions and agreements from assembly meetings';
COMMENT ON COLUMN assembly_agreements.agreement_number IS 'Order in assembly (1, 2, 3...)';
COMMENT ON COLUMN assembly_agreements.election_id IS 'Links to formal election if agreement was voted via election';
COMMENT ON COLUMN assembly_agreements.approved IS 'Whether the agreement passed (NULL if not yet voted)';
COMMENT ON COLUMN assembly_agreements.votes_for_coefficient IS 'Total coefficient voting in favor';
COMMENT ON COLUMN assembly_agreements.action_required IS 'True if this agreement creates action items';
