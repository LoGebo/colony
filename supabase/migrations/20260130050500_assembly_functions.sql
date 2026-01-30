-- Assembly management functions with Mexican law compliance
-- Plan 08-03: Quorum calculation, proxy validation, attendance recording
-- Migration: 20260130050500_assembly_functions.sql

-- ============================================================================
-- PROXY LIMIT VALIDATION (Mexican law: max 2 units per representative)
-- ============================================================================

-- Trigger function to enforce 2-unit proxy limit per Mexican Ley de Propiedad en Condominio
CREATE OR REPLACE FUNCTION validate_assembly_proxy_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_proxy_count INTEGER;
BEGIN
  -- Only check if this is a proxy attendance
  IF NEW.is_proxy = true AND NEW.resident_id IS NOT NULL THEN
    -- Count existing proxy attendances by same resident in this assembly
    SELECT COUNT(*)
    INTO v_proxy_count
    FROM assembly_attendance
    WHERE assembly_id = NEW.assembly_id
      AND resident_id = NEW.resident_id
      AND is_proxy = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF v_proxy_count >= 2 THEN
      RAISE EXCEPTION 'A person cannot represent more than 2 units by proxy (Mexican law) / No se puede representar mas de 2 unidades por poder. Current: %, Max: 2',
        v_proxy_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER assembly_attendance_proxy_limit
  BEFORE INSERT OR UPDATE ON assembly_attendance
  FOR EACH ROW
  EXECUTE FUNCTION validate_assembly_proxy_limit();

COMMENT ON FUNCTION validate_assembly_proxy_limit() IS 'Enforces Mexican law limit of 2 proxy units per representative';

-- ============================================================================
-- COEFFICIENT COPY TRIGGER
-- ============================================================================

-- Auto-copy coefficient from unit when not provided
CREATE OR REPLACE FUNCTION copy_attendance_coefficient()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If coefficient not provided, copy from unit
  IF NEW.coefficient IS NULL OR NEW.coefficient = 0 THEN
    SELECT coefficient INTO NEW.coefficient
    FROM units
    WHERE id = NEW.unit_id;

    IF NEW.coefficient IS NULL THEN
      RAISE EXCEPTION 'Unit not found or has no coefficient: %', NEW.unit_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER assembly_attendance_copy_coefficient
  BEFORE INSERT ON assembly_attendance
  FOR EACH ROW
  EXECUTE FUNCTION copy_attendance_coefficient();

COMMENT ON FUNCTION copy_attendance_coefficient() IS 'Copies coefficient from unit to attendance for immutable snapshot';

-- ============================================================================
-- CALCULATE ASSEMBLY QUORUM
-- ============================================================================

-- Function to calculate quorum and return thresholds
CREATE OR REPLACE FUNCTION calculate_assembly_quorum(p_assembly_id UUID)
RETURNS TABLE (
  total_coefficient NUMERIC(7,4),
  present_coefficient NUMERIC(7,4),
  percentage NUMERIC(5,2),
  quorum_met BOOLEAN,
  required_for_convocatoria_1 BOOLEAN,
  required_for_convocatoria_2 BOOLEAN,
  required_for_convocatoria_3 BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_community_id UUID;
  v_total_coefficient NUMERIC(7,4);
  v_present_coefficient NUMERIC(7,4);
  v_percentage NUMERIC(5,2);
  v_status assembly_status;
  v_quorum_met BOOLEAN;
BEGIN
  -- Get community_id and status from assembly
  SELECT a.community_id, a.status
  INTO v_community_id, v_status
  FROM assemblies a
  WHERE a.id = p_assembly_id;

  IF v_community_id IS NULL THEN
    RAISE EXCEPTION 'Assembly not found: %', p_assembly_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Calculate total coefficient from active units in community
  SELECT COALESCE(SUM(u.coefficient), 0)
  INTO v_total_coefficient
  FROM units u
  WHERE u.community_id = v_community_id
    AND u.deleted_at IS NULL;

  -- Calculate present coefficient (only those still checked in)
  SELECT COALESCE(SUM(att.coefficient), 0)
  INTO v_present_coefficient
  FROM assembly_attendance att
  WHERE att.assembly_id = p_assembly_id
    AND att.checked_out_at IS NULL;

  -- Calculate percentage
  IF v_total_coefficient > 0 THEN
    v_percentage := (v_present_coefficient / v_total_coefficient) * 100;
  ELSE
    v_percentage := 0;
  END IF;

  -- Determine if quorum is met based on current convocatoria status
  v_quorum_met := CASE v_status
    WHEN 'convocatoria_1' THEN v_percentage >= 75.00
    WHEN 'convocatoria_2' THEN v_percentage >= 50.01
    WHEN 'convocatoria_3' THEN TRUE  -- Any attendance valid
    WHEN 'in_progress' THEN TRUE     -- Already started
    WHEN 'concluded' THEN TRUE       -- Already finished
    ELSE FALSE                       -- scheduled/cancelled
  END;

  -- Update assembly with calculated quorum values
  UPDATE assemblies
  SET quorum_coefficient_present = v_present_coefficient,
      quorum_percentage = v_percentage,
      quorum_met = v_quorum_met
  WHERE id = p_assembly_id;

  -- Return results with threshold checks
  RETURN QUERY SELECT
    v_total_coefficient,
    v_present_coefficient,
    v_percentage,
    v_quorum_met,
    v_percentage >= 75.00 AS required_for_convocatoria_1,
    v_percentage >= 50.01 AS required_for_convocatoria_2,
    TRUE AS required_for_convocatoria_3;
END;
$$;

COMMENT ON FUNCTION calculate_assembly_quorum(UUID) IS 'Calculates assembly quorum with Mexican law thresholds (75%/50%+1/any)';

-- ============================================================================
-- RECORD ATTENDANCE
-- ============================================================================

-- Function to record attendance with automatic coefficient copy and quorum recalculation
CREATE OR REPLACE FUNCTION record_attendance(
  p_assembly_id UUID,
  p_unit_id UUID,
  p_attendee_type attendance_type,
  p_resident_id UUID DEFAULT NULL,
  p_is_proxy BOOLEAN DEFAULT false,
  p_proxy_grantor_id UUID DEFAULT NULL,
  p_proxy_document_url TEXT DEFAULT NULL,
  p_attendee_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance_id UUID;
  v_unit_coefficient NUMERIC(7,4);
  v_assembly_status assembly_status;
  v_convocatoria INTEGER;
BEGIN
  -- Get assembly status to determine convocatoria
  SELECT status INTO v_assembly_status
  FROM assemblies
  WHERE id = p_assembly_id;

  IF v_assembly_status IS NULL THEN
    RAISE EXCEPTION 'Assembly not found: %', p_assembly_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Determine which convocatoria is active
  v_convocatoria := CASE v_assembly_status
    WHEN 'convocatoria_1' THEN 1
    WHEN 'convocatoria_2' THEN 2
    WHEN 'convocatoria_3' THEN 3
    WHEN 'in_progress' THEN 3  -- Late arrivals count as third
    ELSE NULL
  END;

  IF v_convocatoria IS NULL THEN
    RAISE EXCEPTION 'Assembly is not accepting attendance (status: %)', v_assembly_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Get coefficient from unit
  SELECT coefficient INTO v_unit_coefficient
  FROM units
  WHERE id = p_unit_id AND deleted_at IS NULL;

  IF v_unit_coefficient IS NULL THEN
    RAISE EXCEPTION 'Unit not found or inactive: %', p_unit_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Insert attendance record
  INSERT INTO assembly_attendance (
    assembly_id,
    unit_id,
    coefficient,
    attendee_type,
    resident_id,
    attendee_name,
    is_proxy,
    proxy_grantor_id,
    proxy_document_url,
    arrived_at_convocatoria
  ) VALUES (
    p_assembly_id,
    p_unit_id,
    v_unit_coefficient,
    p_attendee_type,
    p_resident_id,
    p_attendee_name,
    p_is_proxy,
    p_proxy_grantor_id,
    p_proxy_document_url,
    v_convocatoria
  )
  RETURNING id INTO v_attendance_id;

  -- Recalculate assembly quorum
  PERFORM calculate_assembly_quorum(p_assembly_id);

  RETURN v_attendance_id;
END;
$$;

COMMENT ON FUNCTION record_attendance(UUID, UUID, attendance_type, UUID, BOOLEAN, UUID, TEXT, TEXT) IS 'Records unit attendance with coefficient snapshot and quorum recalculation';

-- ============================================================================
-- ADVANCE CONVOCATORIA
-- ============================================================================

-- Function to advance assembly through convocatoria progression
CREATE OR REPLACE FUNCTION advance_convocatoria(p_assembly_id UUID)
RETURNS assembly_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status assembly_status;
  v_new_status assembly_status;
  v_quorum_result RECORD;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status
  FROM assemblies
  WHERE id = p_assembly_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Assembly not found: %', p_assembly_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Determine next status
  v_new_status := CASE v_current_status
    WHEN 'scheduled' THEN 'convocatoria_1'::assembly_status
    WHEN 'convocatoria_1' THEN 'convocatoria_2'::assembly_status
    WHEN 'convocatoria_2' THEN 'convocatoria_3'::assembly_status
    WHEN 'convocatoria_3' THEN 'in_progress'::assembly_status
    WHEN 'in_progress' THEN 'concluded'::assembly_status
    ELSE NULL
  END;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Cannot advance from status: %', v_current_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Update status and record timestamp
  UPDATE assemblies
  SET status = v_new_status,
      convocatoria_1_at = CASE WHEN v_new_status = 'convocatoria_1' THEN now() ELSE convocatoria_1_at END,
      convocatoria_2_at = CASE WHEN v_new_status = 'convocatoria_2' THEN now() ELSE convocatoria_2_at END,
      convocatoria_3_at = CASE WHEN v_new_status = 'convocatoria_3' THEN now() ELSE convocatoria_3_at END,
      started_at = CASE WHEN v_new_status = 'in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
      ended_at = CASE WHEN v_new_status = 'concluded' THEN now() ELSE ended_at END
  WHERE id = p_assembly_id;

  -- Recalculate quorum with new status
  SELECT * INTO v_quorum_result FROM calculate_assembly_quorum(p_assembly_id);

  RETURN v_new_status;
END;
$$;

COMMENT ON FUNCTION advance_convocatoria(UUID) IS 'Advances assembly through convocatoria progression (scheduled->1st->2nd->3rd->in_progress->concluded)';

-- ============================================================================
-- RECORD AGREEMENT
-- ============================================================================

-- Function to record assembly agreement with auto-numbering
CREATE OR REPLACE FUNCTION record_agreement(
  p_assembly_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_approved BOOLEAN DEFAULT NULL,
  p_votes_for NUMERIC(7,4) DEFAULT NULL,
  p_votes_against NUMERIC(7,4) DEFAULT NULL,
  p_abstentions NUMERIC(7,4) DEFAULT NULL,
  p_election_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agreement_id UUID;
  v_next_number INTEGER;
  v_election_votes_for NUMERIC(7,4);
  v_election_votes_against NUMERIC(7,4);
  v_election_approved BOOLEAN;
BEGIN
  -- Verify assembly exists
  IF NOT EXISTS (SELECT 1 FROM assemblies WHERE id = p_assembly_id) THEN
    RAISE EXCEPTION 'Assembly not found: %', p_assembly_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Get next agreement number
  SELECT COALESCE(MAX(agreement_number), 0) + 1
  INTO v_next_number
  FROM assembly_agreements
  WHERE assembly_id = p_assembly_id;

  -- If election_id provided, pull results from election
  IF p_election_id IS NOT NULL THEN
    SELECT
      e.quorum_met,
      (SELECT SUM(eo.coefficient_total) FROM election_options eo
       WHERE eo.election_id = e.id
       ORDER BY eo.coefficient_total DESC LIMIT 1),
      (SELECT SUM(eo.coefficient_total) FROM election_options eo
       WHERE eo.election_id = e.id
       ORDER BY eo.coefficient_total DESC OFFSET 1)
    INTO v_election_approved, v_election_votes_for, v_election_votes_against
    FROM elections e
    WHERE e.id = p_election_id;

    -- Use election results if not provided
    IF p_approved IS NULL THEN
      p_approved := v_election_approved;
    END IF;
    IF p_votes_for IS NULL THEN
      p_votes_for := v_election_votes_for;
    END IF;
    IF p_votes_against IS NULL THEN
      p_votes_against := v_election_votes_against;
    END IF;
  END IF;

  -- Insert agreement
  INSERT INTO assembly_agreements (
    assembly_id,
    agreement_number,
    title,
    description,
    election_id,
    approved,
    votes_for_coefficient,
    votes_against_coefficient,
    abstentions_coefficient,
    display_order
  ) VALUES (
    p_assembly_id,
    v_next_number,
    p_title,
    p_description,
    p_election_id,
    p_approved,
    p_votes_for,
    p_votes_against,
    p_abstentions,
    v_next_number
  )
  RETURNING id INTO v_agreement_id;

  RETURN v_agreement_id;
END;
$$;

COMMENT ON FUNCTION record_agreement(UUID, TEXT, TEXT, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, UUID) IS 'Records assembly agreement with auto-numbering and optional election linking';

-- ============================================================================
-- CHECK OUT ATTENDANCE
-- ============================================================================

-- Function to mark attendee as checked out (left early)
CREATE OR REPLACE FUNCTION checkout_attendance(
  p_assembly_id UUID,
  p_unit_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE assembly_attendance
  SET checked_out_at = now()
  WHERE assembly_id = p_assembly_id
    AND unit_id = p_unit_id
    AND checked_out_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Recalculate quorum (attendance now excludes checked-out units)
  PERFORM calculate_assembly_quorum(p_assembly_id);

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION checkout_attendance(UUID, UUID) IS 'Marks attendee as checked out and recalculates quorum';

-- ============================================================================
-- GET ASSEMBLY SUMMARY
-- ============================================================================

-- Function to get assembly overview
CREATE OR REPLACE FUNCTION get_assembly_summary(p_assembly_id UUID)
RETURNS TABLE (
  assembly_id UUID,
  assembly_number TEXT,
  title TEXT,
  assembly_type assembly_type,
  status assembly_status,
  scheduled_date DATE,
  scheduled_time TIME,
  total_units INTEGER,
  units_present INTEGER,
  total_coefficient NUMERIC(7,4),
  present_coefficient NUMERIC(7,4),
  quorum_percentage NUMERIC(5,2),
  quorum_met BOOLEAN,
  agreements_count INTEGER,
  agreements_approved INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS assembly_id,
    a.assembly_number,
    a.title,
    a.assembly_type,
    a.status,
    a.scheduled_date,
    a.scheduled_time,
    (SELECT COUNT(*)::INTEGER FROM units u
     WHERE u.community_id = a.community_id AND u.deleted_at IS NULL) AS total_units,
    (SELECT COUNT(*)::INTEGER FROM assembly_attendance att
     WHERE att.assembly_id = a.id AND att.checked_out_at IS NULL) AS units_present,
    (SELECT COALESCE(SUM(u.coefficient), 0) FROM units u
     WHERE u.community_id = a.community_id AND u.deleted_at IS NULL) AS total_coefficient,
    a.quorum_coefficient_present AS present_coefficient,
    a.quorum_percentage,
    a.quorum_met,
    (SELECT COUNT(*)::INTEGER FROM assembly_agreements ag
     WHERE ag.assembly_id = a.id) AS agreements_count,
    (SELECT COUNT(*)::INTEGER FROM assembly_agreements ag
     WHERE ag.assembly_id = a.id AND ag.approved = TRUE) AS agreements_approved
  FROM assemblies a
  WHERE a.id = p_assembly_id;
END;
$$;

COMMENT ON FUNCTION get_assembly_summary(UUID) IS 'Returns comprehensive assembly overview with attendance and agreement counts';

-- ============================================================================
-- ATTENDANCE LIST VIEW
-- ============================================================================

-- View for easy attendance listing
CREATE OR REPLACE VIEW assembly_attendance_list AS
SELECT
  att.id,
  att.assembly_id,
  a.assembly_number,
  a.title AS assembly_title,
  att.unit_id,
  u.unit_number,
  att.coefficient,
  att.attendee_type,
  att.resident_id,
  r.full_name AS resident_name,
  att.attendee_name AS external_name,
  COALESCE(r.full_name, att.attendee_name) AS display_name,
  att.is_proxy,
  att.proxy_grantor_id,
  pg.full_name AS proxy_grantor_name,
  att.checked_in_at,
  att.checked_out_at,
  att.arrived_at_convocatoria,
  CASE
    WHEN att.checked_out_at IS NOT NULL THEN 'checked_out'
    ELSE 'present'
  END AS attendance_status
FROM assembly_attendance att
JOIN assemblies a ON a.id = att.assembly_id
JOIN units u ON u.id = att.unit_id
LEFT JOIN residents r ON r.id = att.resident_id
LEFT JOIN residents pg ON pg.id = att.proxy_grantor_id
WHERE a.deleted_at IS NULL;

COMMENT ON VIEW assembly_attendance_list IS 'Denormalized view of assembly attendance with names resolved';
