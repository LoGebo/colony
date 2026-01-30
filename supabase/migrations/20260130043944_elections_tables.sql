-- Elections, election options, and ballots tables
-- Phase 8-02: Elections and Voting
-- Migration: 20260130043944_elections_tables.sql

-- ============================================================================
-- ELECTION NUMBER SEQUENCE (per community)
-- ============================================================================

-- Function to generate election number per community: ELEC-YYYY-NNN
CREATE OR REPLACE FUNCTION generate_election_number(p_community_id UUID)
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
      WHEN election_number ~ ('^ELEC-' || v_year || '-[0-9]+$')
      THEN SUBSTRING(election_number FROM 'ELEC-[0-9]{4}-([0-9]+)')::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM elections
  WHERE community_id = p_community_id;

  v_number := 'ELEC-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');

  RETURN v_number;
END;
$$;

-- ============================================================================
-- ELECTIONS TABLE
-- ============================================================================

CREATE TABLE elections (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  election_number TEXT NOT NULL,
  election_type election_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Voting rules
  min_options_selectable INTEGER NOT NULL DEFAULT 1,
  max_options_selectable INTEGER NOT NULL DEFAULT 1,

  -- Voting period
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,

  -- Status
  status election_status NOT NULL DEFAULT 'draft',

  -- Quorum requirements (Mexican law: 75%/50%+1/any for 1st/2nd/3rd convocatoria)
  quorum_required NUMERIC(5,2) NOT NULL DEFAULT 50.01,

  -- Results tracking
  total_coefficient_voted NUMERIC(7,4) NOT NULL DEFAULT 0,
  quorum_met BOOLEAN,

  -- Certification
  certified_at TIMESTAMPTZ,
  certified_by UUID REFERENCES auth.users(id),

  -- Assembly reference (will link to assemblies table from plan 08-03)
  assembly_id UUID,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT elections_community_number_unique UNIQUE (community_id, election_number),
  CONSTRAINT elections_valid_period CHECK (closes_at > opens_at),
  CONSTRAINT elections_valid_options CHECK (
    min_options_selectable >= 1
    AND max_options_selectable >= min_options_selectable
  ),
  CONSTRAINT elections_quorum_range CHECK (quorum_required BETWEEN 0 AND 100)
);

-- Enable RLS
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_elections_audit
  BEFORE INSERT OR UPDATE ON elections
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_elections_community_status ON elections(community_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_elections_dates ON elections(opens_at, closes_at) WHERE deleted_at IS NULL AND status = 'open';

-- RLS Policies
-- Super admins full access
CREATE POLICY "super_admins_full_access_elections"
  ON elections FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

-- All community members can view elections
CREATE POLICY "users_view_community_elections"
  ON elections FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Admins can manage elections
CREATE POLICY "admins_manage_elections"
  ON elections FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Comments
COMMENT ON TABLE elections IS 'Formal elections for board, bylaws, expenses, and general decisions';
COMMENT ON COLUMN elections.election_number IS 'Unique identifier format: ELEC-YYYY-NNN';
COMMENT ON COLUMN elections.quorum_required IS 'Minimum coefficient percentage required (Mexican law: typically 50.01%)';
COMMENT ON COLUMN elections.total_coefficient_voted IS 'Sum of coefficients that have voted';

-- ============================================================================
-- ELECTION OPTIONS TABLE
-- ============================================================================

CREATE TABLE election_options (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,

  -- Option details
  title TEXT NOT NULL,
  description TEXT,

  -- For board elections: candidate info
  candidate_resident_id UUID REFERENCES residents(id),
  candidate_photo_url TEXT,

  -- Display order
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Results (updated when votes cast)
  votes_count INTEGER NOT NULL DEFAULT 0,
  coefficient_total NUMERIC(7,4) NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE election_options ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_election_options_election ON election_options(election_id);
CREATE INDEX idx_election_options_candidate ON election_options(candidate_resident_id)
  WHERE candidate_resident_id IS NOT NULL;

-- RLS Policies (inherit from elections access)
-- Super admins full access
CREATE POLICY "super_admins_full_access_election_options"
  ON election_options FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can view options for elections they can see
CREATE POLICY "users_view_election_options"
  ON election_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = election_options.election_id
        AND e.community_id = (SELECT get_current_community_id())
        AND e.deleted_at IS NULL
    )
  );

-- Admins can manage options
CREATE POLICY "admins_manage_election_options"
  ON election_options FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = election_options.election_id
        AND e.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = election_options.election_id
        AND e.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- Comments
COMMENT ON TABLE election_options IS 'Options/candidates for an election';
COMMENT ON COLUMN election_options.candidate_resident_id IS 'For board elections: links to resident candidate';
COMMENT ON COLUMN election_options.coefficient_total IS 'Total coefficient weight of votes for this option';

-- ============================================================================
-- BALLOTS TABLE (votes)
-- ============================================================================

CREATE TABLE ballots (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,

  -- Voter (one vote per unit per election)
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  voted_by UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- CRITICAL: Vote weight copied from unit.coefficient at vote time for immutability
  vote_weight NUMERIC(7,4) NOT NULL,

  -- Selected options (array for multi-select elections)
  selected_options UUID[] NOT NULL,

  -- Proxy voting (Mexican law: max 2 units per representative)
  is_proxy_vote BOOLEAN NOT NULL DEFAULT false,
  proxy_for_resident_id UUID REFERENCES residents(id),
  proxy_document_url TEXT,

  -- Verification metadata
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,

  -- One vote per unit per election
  CONSTRAINT ballots_one_vote_per_unit UNIQUE (election_id, unit_id),

  -- Proxy must have document
  CONSTRAINT ballots_proxy_requires_document CHECK (
    NOT is_proxy_vote OR proxy_document_url IS NOT NULL
  ),

  -- Proxy must have proxy_for_resident_id
  CONSTRAINT ballots_proxy_requires_resident CHECK (
    NOT is_proxy_vote OR proxy_for_resident_id IS NOT NULL
  )
);

-- Enable RLS
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_ballots_election ON ballots(election_id);
CREATE INDEX idx_ballots_voter ON ballots(voted_by, election_id);
CREATE INDEX idx_ballots_unit ON ballots(unit_id);
CREATE INDEX idx_ballots_proxy ON ballots(voted_by, election_id) WHERE is_proxy_vote = true;

-- RLS Policies (restricted for vote secrecy - only show own votes, not selections)
-- Super admins can view all (for audit purposes)
CREATE POLICY "super_admins_view_ballots"
  ON ballots FOR SELECT TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can insert their own vote (via cast_vote function)
-- Using SECURITY DEFINER on cast_vote() bypasses this for proper validation
CREATE POLICY "voters_insert_own_ballot"
  ON ballots FOR INSERT TO authenticated
  WITH CHECK (
    voted_by = auth.uid()::UUID
  );

-- Users can see that they voted (but results come from aggregates)
CREATE POLICY "voters_see_own_ballots"
  ON ballots FOR SELECT TO authenticated
  USING (
    voted_by = auth.uid()::UUID
  );

-- Admins can view vote metadata (for quorum tracking, not vote content in UI)
CREATE POLICY "admins_view_ballot_metadata"
  ON ballots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM elections e
      WHERE e.id = ballots.election_id
        AND e.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- Comments
COMMENT ON TABLE ballots IS 'Individual votes - one per unit per election';
COMMENT ON COLUMN ballots.vote_weight IS 'CRITICAL: Snapshot of unit coefficient at vote time for immutable historical accuracy';
COMMENT ON COLUMN ballots.is_proxy_vote IS 'True if voting on behalf of another unit owner (max 2 per Mexican law)';
COMMENT ON COLUMN ballots.proxy_document_url IS 'Carta poder document required for proxy votes';
COMMENT ON CONSTRAINT ballots_one_vote_per_unit ON ballots IS 'Enforces one vote per unit per election';
