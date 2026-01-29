-- Surveys with one-vote-per-unit enforcement and coefficient-weighted voting
-- Migration: 20260129202433_surveys_table.sql
--
-- Mexican HOA (condominios) use coefficient-based voting where each unit's vote
-- is weighted by its "indiviso" percentage (sum of all coefficients = 100%)
-- This enables proper representation for larger units in assembly decisions.

--------------------------------------------------------------------------------
-- SURVEYS TABLE
--------------------------------------------------------------------------------

CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Content
  title TEXT NOT NULL,
  description TEXT,

  -- Options: [{id: "opt1", text: "Approve"}, {id: "opt2", text: "Reject"}]
  options JSONB NOT NULL,

  -- Voting configuration
  -- 'simple': one vote per unit, equal weight
  -- 'coefficient': weighted by unit coefficient (Mexican indiviso)
  voting_method TEXT NOT NULL DEFAULT 'simple'
    CHECK (voting_method IN ('simple', 'coefficient')),

  -- Quorum and approval thresholds
  -- quorum_percentage: minimum participation required (e.g., 50.00 = 50%)
  -- approval_threshold: votes needed to pass (e.g., 66.67 = 2/3 majority)
  quorum_percentage NUMERIC(5,2),
  approval_threshold NUMERIC(5,2),

  -- Schedule
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT surveys_valid_period CHECK (ends_at > starts_at),

  -- Status
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Computed results (populated by close_survey())
  -- {"opt1": {"votes": 15, "weight": 65.50}, "opt2": {"votes": 8, "weight": 34.50}}
  results JSONB,

  -- Author
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_surveys_audit
  BEFORE INSERT OR UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_surveys_community_starts
  ON surveys(community_id, starts_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_surveys_active
  ON surveys(community_id, starts_at, ends_at)
  WHERE deleted_at IS NULL AND is_closed = FALSE;

--------------------------------------------------------------------------------
-- SURVEY_VOTES TABLE (One vote per unit)
--------------------------------------------------------------------------------

CREATE TABLE survey_votes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  voted_by UUID REFERENCES residents(id) ON DELETE SET NULL,

  -- Selected option (must match an id in surveys.options)
  option_id TEXT NOT NULL,

  -- Coefficient snapshot at vote time for weighted voting
  -- Snapshots the unit's coefficient so historical votes are accurate
  -- even if the unit's coefficient changes later
  vote_weight NUMERIC(7,4) NOT NULL DEFAULT 1,

  -- Timestamp
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ONE VOTE PER UNIT - Critical constraint for fair HOA voting
  CONSTRAINT survey_votes_one_per_unit
    UNIQUE (survey_id, unit_id)
);

-- Enable RLS
ALTER TABLE survey_votes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_survey_votes_survey_option
  ON survey_votes(survey_id, option_id);

CREATE INDEX idx_survey_votes_unit
  ON survey_votes(unit_id);

--------------------------------------------------------------------------------
-- CAST_SURVEY_VOTE FUNCTION
--------------------------------------------------------------------------------

-- Validates and records a vote, supporting vote changes before survey closes
CREATE OR REPLACE FUNCTION cast_survey_vote(
  p_survey_id UUID,
  p_unit_id UUID,
  p_option_id TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey RECORD;
  v_unit_coefficient NUMERIC(7,4);
  v_is_authorized BOOLEAN;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();

  -- Get survey details
  SELECT s.community_id, s.options, s.voting_method, s.starts_at, s.ends_at, s.is_closed
  INTO v_survey
  FROM surveys s
  WHERE s.id = p_survey_id AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Survey not found or has been deleted'::TEXT;
    RETURN;
  END IF;

  -- Check if survey is open
  IF v_survey.is_closed THEN
    RETURN QUERY SELECT FALSE, 'Survey is closed'::TEXT;
    RETURN;
  END IF;

  IF now() < v_survey.starts_at THEN
    RETURN QUERY SELECT FALSE, 'Survey has not started yet'::TEXT;
    RETURN;
  END IF;

  IF now() > v_survey.ends_at THEN
    RETURN QUERY SELECT FALSE, 'Survey has ended'::TEXT;
    RETURN;
  END IF;

  -- Validate option exists in survey options
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_survey.options) opt
    WHERE opt->>'id' = p_option_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid option selected'::TEXT;
    RETURN;
  END IF;

  -- Check if user is authorized to vote for this unit
  -- Must be owner or authorized occupant
  SELECT EXISTS (
    SELECT 1 FROM occupancies o
    WHERE o.unit_id = p_unit_id
      AND o.resident_id = v_current_user_id
      AND o.deleted_at IS NULL
      AND o.status = 'active'
      AND o.occupancy_type IN ('owner', 'authorized')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RETURN QUERY SELECT FALSE, 'Not authorized to vote for this unit'::TEXT;
    RETURN;
  END IF;

  -- Get unit coefficient for vote weight
  IF v_survey.voting_method = 'coefficient' THEN
    SELECT coefficient INTO v_unit_coefficient
    FROM units
    WHERE id = p_unit_id AND deleted_at IS NULL;

    IF v_unit_coefficient IS NULL OR v_unit_coefficient = 0 THEN
      v_unit_coefficient := 1;  -- Fallback for units without coefficient
    END IF;
  ELSE
    v_unit_coefficient := 1;  -- Simple voting = equal weight
  END IF;

  -- Insert or update vote (allows changing vote before survey closes)
  INSERT INTO survey_votes (survey_id, unit_id, voted_by, option_id, vote_weight)
  VALUES (p_survey_id, p_unit_id, v_current_user_id, p_option_id, v_unit_coefficient)
  ON CONFLICT (survey_id, unit_id)
  DO UPDATE SET
    option_id = EXCLUDED.option_id,
    voted_by = EXCLUDED.voted_by,
    vote_weight = EXCLUDED.vote_weight,
    voted_at = now();

  RETURN QUERY SELECT TRUE, 'Vote recorded successfully'::TEXT;
END;
$$;

COMMENT ON FUNCTION cast_survey_vote(UUID, UUID, TEXT) IS 'Cast or update a vote; validates authorization and survey status';

--------------------------------------------------------------------------------
-- CLOSE_SURVEY FUNCTION
--------------------------------------------------------------------------------

-- Closes survey and computes final results
CREATE OR REPLACE FUNCTION close_survey(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSONB;
  v_survey RECORD;
BEGIN
  -- Get survey
  SELECT options INTO v_survey
  FROM surveys
  WHERE id = p_survey_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survey not found: %', p_survey_id;
  END IF;

  -- Compute results: {option_id: {votes: N, weight: N.NN}}
  SELECT jsonb_object_agg(
    option_id,
    jsonb_build_object(
      'votes', vote_count,
      'weight', COALESCE(total_weight, 0)
    )
  )
  INTO v_results
  FROM (
    SELECT
      sv.option_id,
      COUNT(*)::INTEGER as vote_count,
      SUM(sv.vote_weight)::NUMERIC(10,4) as total_weight
    FROM survey_votes sv
    WHERE sv.survey_id = p_survey_id
    GROUP BY sv.option_id
  ) vote_agg;

  -- Include options with zero votes
  SELECT jsonb_object_agg(
    opt->>'id',
    COALESCE(v_results->(opt->>'id'),
      jsonb_build_object('votes', 0, 'weight', 0)
    )
  )
  INTO v_results
  FROM jsonb_array_elements(v_survey.options) opt;

  -- Update survey
  UPDATE surveys
  SET is_closed = TRUE,
      results = v_results,
      updated_at = now()
  WHERE id = p_survey_id;

  RETURN v_results;
END;
$$;

COMMENT ON FUNCTION close_survey(UUID) IS 'Close survey and compute final vote tallies with weights';

--------------------------------------------------------------------------------
-- RLS POLICIES: SURVEYS
--------------------------------------------------------------------------------

-- Super admins full access
CREATE POLICY "super_admins_full_access_surveys"
  ON surveys
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Admins can manage surveys in their community
CREATE POLICY "admins_manage_surveys"
  ON surveys
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Users can view surveys that have started
CREATE POLICY "users_view_active_surveys"
  ON surveys
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND starts_at <= now()
  );

--------------------------------------------------------------------------------
-- RLS POLICIES: SURVEY_VOTES
--------------------------------------------------------------------------------

-- Super admins full access
CREATE POLICY "super_admins_full_access_survey_votes"
  ON survey_votes
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Admins can view all votes in their surveys
CREATE POLICY "admins_view_survey_votes"
  ON survey_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveys s
      WHERE s.id = survey_votes.survey_id
        AND s.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- Users can view their own unit's votes
CREATE POLICY "users_view_own_unit_votes"
  ON survey_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM occupancies o
      WHERE o.unit_id = survey_votes.unit_id
        AND o.resident_id = auth.uid()
        AND o.deleted_at IS NULL
        AND o.status = 'active'
    )
  );

-- Votes are inserted via cast_survey_vote() SECURITY DEFINER function
-- No direct INSERT policy needed for regular users

--------------------------------------------------------------------------------
-- COMMENTS
--------------------------------------------------------------------------------

COMMENT ON TABLE surveys IS 'HOA surveys and polls with optional coefficient-weighted voting';
COMMENT ON COLUMN surveys.voting_method IS 'simple = equal votes, coefficient = weighted by unit indiviso';
COMMENT ON COLUMN surveys.quorum_percentage IS 'Minimum participation percentage required for validity';
COMMENT ON COLUMN surveys.approval_threshold IS 'Percentage of votes needed to pass (e.g., 66.67 for 2/3 majority)';
COMMENT ON COLUMN surveys.results IS 'Computed results after closing: {option_id: {votes: N, weight: N}}';

COMMENT ON TABLE survey_votes IS 'One vote per unit per survey; vote_weight captures coefficient at vote time';
COMMENT ON COLUMN survey_votes.vote_weight IS 'Snapshot of unit coefficient at vote time for weighted voting';
COMMENT ON CONSTRAINT survey_votes_one_per_unit ON survey_votes IS 'Critical: ONE VOTE PER UNIT for fair HOA voting';
