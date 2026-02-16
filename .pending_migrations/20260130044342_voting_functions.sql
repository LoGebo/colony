-- Voting functions with Mexican law compliance
-- Phase 8-02: Elections and Voting
-- Migration: 20260130044342_voting_functions.sql

-- ============================================================================
-- PROXY LIMIT VALIDATION TRIGGER
-- Mexican law: Maximum 2 units per representative (Ley de Propiedad en Condominio)
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_proxy_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_proxy_count INTEGER;
BEGIN
  -- Only check proxy votes
  IF NEW.is_proxy_vote = true THEN
    -- Count existing proxy ballots in same election by same voter
    SELECT COUNT(*)
    INTO v_proxy_count
    FROM ballots
    WHERE election_id = NEW.election_id
      AND voted_by = NEW.voted_by
      AND is_proxy_vote = true;

    -- Mexican law limit: max 2 proxy votes per person per election
    IF v_proxy_count >= 2 THEN
      RAISE EXCEPTION 'Cannot represent more than 2 units by proxy (Mexican law / Ley de Propiedad en Condominio)'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_proxy_limit() IS
  'Enforces Mexican condominium law limit of 2 proxy votes per representative';

-- Create trigger on ballots
CREATE TRIGGER ballots_proxy_limit_check
  BEFORE INSERT ON ballots
  FOR EACH ROW
  EXECUTE FUNCTION validate_proxy_limit();

-- ============================================================================
-- CAST VOTE FUNCTION
-- Core voting function with full validation
-- ============================================================================

CREATE OR REPLACE FUNCTION cast_vote(
  p_election_id UUID,
  p_unit_id UUID,
  p_selected_options UUID[],
  p_is_proxy BOOLEAN DEFAULT false,
  p_proxy_for UUID DEFAULT NULL,
  p_proxy_document TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_election RECORD;
  v_unit RECORD;
  v_voter_id UUID;
  v_has_occupancy BOOLEAN;
  v_vote_weight NUMERIC(7,4);
  v_ballot_id UUID;
  v_option_id UUID;
BEGIN
  -- Get current user
  v_voter_id := auth.uid();
  IF v_voter_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required / Se requiere autenticacion'
      USING ERRCODE = 'P0001';
  END IF;

  -- 1. Validate election exists and is open
  SELECT e.*, c.id AS community_check
  INTO v_election
  FROM public.elections e
  JOIN public.communities c ON c.id = e.community_id
  WHERE e.id = p_election_id
    AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Election not found / Eleccion no encontrada'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_election.status != 'open' THEN
    RAISE EXCEPTION 'Election is not open for voting / La eleccion no esta abierta para votar'
      USING ERRCODE = 'P0003';
  END IF;

  -- 2. Validate voting period
  IF now() < v_election.opens_at THEN
    RAISE EXCEPTION 'Voting has not started / La votacion aun no ha comenzado'
      USING ERRCODE = 'P0004';
  END IF;

  IF now() > v_election.closes_at THEN
    RAISE EXCEPTION 'Voting has ended / La votacion ha terminado'
      USING ERRCODE = 'P0005';
  END IF;

  -- 3. Validate option count within min/max
  IF array_length(p_selected_options, 1) IS NULL OR array_length(p_selected_options, 1) < v_election.min_options_selectable THEN
    RAISE EXCEPTION 'Must select at least % option(s) / Debe seleccionar al menos % opcion(es)',
      v_election.min_options_selectable, v_election.min_options_selectable
      USING ERRCODE = 'P0006';
  END IF;

  IF array_length(p_selected_options, 1) > v_election.max_options_selectable THEN
    RAISE EXCEPTION 'Cannot select more than % option(s) / No puede seleccionar mas de % opcion(es)',
      v_election.max_options_selectable, v_election.max_options_selectable
      USING ERRCODE = 'P0007';
  END IF;

  -- 4. Validate all selected options belong to this election
  IF EXISTS (
    SELECT 1 FROM unnest(p_selected_options) AS opt_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.election_options
      WHERE id = opt_id AND election_id = p_election_id
    )
  ) THEN
    RAISE EXCEPTION 'Invalid option selection / Seleccion de opcion invalida'
      USING ERRCODE = 'P0008';
  END IF;

  -- 5. Validate unit exists in same community as election
  SELECT u.*, u.coefficient AS unit_coefficient
  INTO v_unit
  FROM public.units u
  WHERE u.id = p_unit_id
    AND u.community_id = v_election.community_id
    AND u.deleted_at IS NULL
    AND u.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit not found in election community / Unidad no encontrada en la comunidad de la eleccion'
      USING ERRCODE = 'P0009';
  END IF;

  -- 6. Validate voter authorization
  IF NOT p_is_proxy THEN
    -- Direct vote: verify voter has active occupancy (owner or tenant) for unit
    SELECT EXISTS (
      SELECT 1 FROM public.occupancies o
      JOIN public.residents r ON r.id = o.resident_id
      WHERE o.unit_id = p_unit_id
        AND r.id = v_voter_id
        AND o.status = 'active'
        AND o.deleted_at IS NULL
        AND o.occupancy_type IN ('owner', 'tenant')
        AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
    ) INTO v_has_occupancy;

    IF NOT v_has_occupancy THEN
      RAISE EXCEPTION 'You are not authorized to vote for this unit / No esta autorizado para votar por esta unidad'
        USING ERRCODE = 'P0010';
    END IF;
  ELSE
    -- Proxy vote: validate proxy requirements
    IF p_proxy_for IS NULL THEN
      RAISE EXCEPTION 'Proxy vote requires proxy_for_resident_id / El voto por poder requiere proxy_for_resident_id'
        USING ERRCODE = 'P0011';
    END IF;

    IF p_proxy_document IS NULL OR p_proxy_document = '' THEN
      RAISE EXCEPTION 'Proxy vote requires carta poder document / El voto por poder requiere documento de carta poder'
        USING ERRCODE = 'P0012';
    END IF;

    -- Proxy limit is enforced by trigger (validate_proxy_limit)
  END IF;

  -- 7. Check unit hasn't already voted
  IF EXISTS (
    SELECT 1 FROM public.ballots
    WHERE election_id = p_election_id AND unit_id = p_unit_id
  ) THEN
    RAISE EXCEPTION 'This unit has already voted in this election / Esta unidad ya ha votado en esta eleccion'
      USING ERRCODE = 'P0013';
  END IF;

  -- Get vote weight from unit coefficient (CRITICAL: snapshot at vote time)
  v_vote_weight := v_unit.unit_coefficient;

  -- 8. Insert ballot record
  INSERT INTO public.ballots (
    election_id,
    unit_id,
    voted_by,
    vote_weight,
    selected_options,
    is_proxy_vote,
    proxy_for_resident_id,
    proxy_document_url,
    ip_address,
    user_agent
  ) VALUES (
    p_election_id,
    p_unit_id,
    v_voter_id,
    v_vote_weight,
    p_selected_options,
    p_is_proxy,
    p_proxy_for,
    p_proxy_document,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  )
  RETURNING id INTO v_ballot_id;

  -- 9. Update election total_coefficient_voted
  UPDATE public.elections
  SET total_coefficient_voted = total_coefficient_voted + v_vote_weight
  WHERE id = p_election_id;

  -- 10. Update election_options vote counts and coefficient totals
  FOREACH v_option_id IN ARRAY p_selected_options
  LOOP
    UPDATE public.election_options
    SET
      votes_count = votes_count + 1,
      coefficient_total = coefficient_total + v_vote_weight
    WHERE id = v_option_id;
  END LOOP;

  RETURN v_ballot_id;
END;
$$;

COMMENT ON FUNCTION cast_vote(UUID, UUID, UUID[], BOOLEAN, UUID, TEXT) IS
  'Cast a vote in an election. Validates eligibility, enforces proxy limit (2 max per Mexican law), and snapshots unit coefficient as vote weight.';

-- ============================================================================
-- CHECK ELECTION QUORUM FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_election_quorum(p_election_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_election RECORD;
  v_total_community_coefficient NUMERIC(10,4);
  v_voted_coefficient NUMERIC(10,4);
  v_percentage NUMERIC(7,4);
  v_quorum_met BOOLEAN;
BEGIN
  -- Get election details
  SELECT *
  INTO v_election
  FROM public.elections
  WHERE id = p_election_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Election not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Calculate total community coefficient from active units
  SELECT COALESCE(SUM(coefficient), 0)
  INTO v_total_community_coefficient
  FROM public.units
  WHERE community_id = v_election.community_id
    AND status = 'active'
    AND deleted_at IS NULL;

  -- Get voted coefficient from ballots
  SELECT COALESCE(SUM(vote_weight), 0)
  INTO v_voted_coefficient
  FROM public.ballots
  WHERE election_id = p_election_id;

  -- Calculate percentage
  IF v_total_community_coefficient > 0 THEN
    v_percentage := (v_voted_coefficient / v_total_community_coefficient) * 100;
  ELSE
    v_percentage := 0;
  END IF;

  -- Determine if quorum met
  v_quorum_met := v_percentage >= v_election.quorum_required;

  -- Update election with current values
  UPDATE public.elections
  SET
    total_coefficient_voted = v_voted_coefficient,
    quorum_met = v_quorum_met
  WHERE id = p_election_id;

  RETURN v_quorum_met;
END;
$$;

COMMENT ON FUNCTION check_election_quorum(UUID) IS
  'Check and update quorum status for an election. Calculates percentage of total community coefficient that has voted.';

-- ============================================================================
-- GET ELECTION RESULTS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_election_results(p_election_id UUID)
RETURNS TABLE (
  option_id UUID,
  title TEXT,
  votes_count INTEGER,
  coefficient_total NUMERIC(7,4),
  percentage NUMERIC(7,4)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_voted_coefficient NUMERIC(10,4);
BEGIN
  -- Get total voted coefficient for this election
  SELECT COALESCE(SUM(vote_weight), 0)
  INTO v_total_voted_coefficient
  FROM public.ballots
  WHERE election_id = p_election_id;

  RETURN QUERY
  SELECT
    eo.id AS option_id,
    eo.title,
    eo.votes_count,
    eo.coefficient_total,
    CASE
      WHEN v_total_voted_coefficient > 0 THEN
        ROUND((eo.coefficient_total / v_total_voted_coefficient) * 100, 4)
      ELSE 0
    END AS percentage
  FROM public.election_options eo
  WHERE eo.election_id = p_election_id
  ORDER BY eo.coefficient_total DESC, eo.votes_count DESC, eo.display_order;
END;
$$;

COMMENT ON FUNCTION get_election_results(UUID) IS
  'Get election results with coefficient-weighted percentages. Ordered by coefficient total descending.';

-- ============================================================================
-- HELPER: GET ELECTION SUMMARY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_election_summary(p_election_id UUID)
RETURNS TABLE (
  election_id UUID,
  title TEXT,
  status election_status,
  total_units INTEGER,
  voted_units INTEGER,
  total_coefficient NUMERIC(10,4),
  voted_coefficient NUMERIC(10,4),
  participation_percentage NUMERIC(7,4),
  quorum_required NUMERIC(5,2),
  quorum_met BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_election RECORD;
  v_total_units INTEGER;
  v_voted_units INTEGER;
  v_total_coefficient NUMERIC(10,4);
  v_voted_coefficient NUMERIC(10,4);
  v_participation NUMERIC(7,4);
BEGIN
  -- Get election
  SELECT *
  INTO v_election
  FROM public.elections e
  WHERE e.id = p_election_id
    AND e.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Count total active units in community
  SELECT COUNT(*), COALESCE(SUM(coefficient), 0)
  INTO v_total_units, v_total_coefficient
  FROM public.units
  WHERE community_id = v_election.community_id
    AND status = 'active'
    AND deleted_at IS NULL;

  -- Count voted units
  SELECT COUNT(*), COALESCE(SUM(vote_weight), 0)
  INTO v_voted_units, v_voted_coefficient
  FROM public.ballots
  WHERE election_id = p_election_id;

  -- Calculate participation percentage
  IF v_total_coefficient > 0 THEN
    v_participation := ROUND((v_voted_coefficient / v_total_coefficient) * 100, 4);
  ELSE
    v_participation := 0;
  END IF;

  RETURN QUERY SELECT
    v_election.id,
    v_election.title,
    v_election.status,
    v_total_units,
    v_voted_units,
    v_total_coefficient,
    v_voted_coefficient,
    v_participation,
    v_election.quorum_required,
    v_participation >= v_election.quorum_required;
END;
$$;

COMMENT ON FUNCTION get_election_summary(UUID) IS
  'Get comprehensive election summary including unit counts, coefficient totals, and participation rates.';
