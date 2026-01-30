-- ============================================
-- INCIDENT TIMELINE FUNCTIONS AND TRIGGERS
-- ============================================
-- Phase 8 Plan 01: Incident Management Schema
--
-- Provides automatic timeline event tracking for incidents:
-- - add_incident_event(): Append events to timeline JSONB
-- - Status change trigger: Auto-log status transitions
-- - Created event trigger: Auto-log incident creation
-- - Media added trigger: Auto-log media uploads

-- ============================================
-- ADD INCIDENT EVENT FUNCTION
-- ============================================
-- Appends a timestamped event to an incident's timeline

CREATE OR REPLACE FUNCTION add_incident_event(
  p_incident_id UUID,
  p_event_type TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
  v_actor_name TEXT;
  v_event JSONB;
BEGIN
  -- Generate event ID
  v_event_id := public.generate_uuid_v7();

  -- Look up actor name (try residents first, then guards, then auth.users)
  IF p_actor_id IS NOT NULL THEN
    -- Try residents table
    SELECT full_name INTO v_actor_name
    FROM public.residents
    WHERE id = p_actor_id
    LIMIT 1;

    -- Try guards table if not found
    IF v_actor_name IS NULL THEN
      SELECT full_name INTO v_actor_name
      FROM public.guards
      WHERE id = p_actor_id OR user_id = p_actor_id
      LIMIT 1;
    END IF;

    -- Try auth.users metadata if still not found
    IF v_actor_name IS NULL THEN
      SELECT COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name',
        email
      ) INTO v_actor_name
      FROM auth.users
      WHERE id = p_actor_id
      LIMIT 1;
    END IF;
  END IF;

  -- Build the event object
  v_event := jsonb_build_object(
    'id', v_event_id,
    'type', p_event_type,
    'timestamp', now(),
    'actor_id', p_actor_id,
    'actor_name', COALESCE(v_actor_name, 'System'),
    'data', COALESCE(p_data, '{}'::JSONB)
  );

  -- Append to incident timeline
  UPDATE public.incidents
  SET
    timeline = timeline || v_event,
    updated_at = now()
  WHERE id = p_incident_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION add_incident_event IS
  'Appends a timestamped event to an incident timeline.
   Looks up actor name from residents, guards, or auth.users.
   Event types: created, status_changed, assigned, unassigned, comment, media_added, escalated, resolution
   Returns the event UUID.';

-- ============================================
-- STATUS CHANGE TRIGGER FUNCTION
-- ============================================
-- Automatically logs status transitions and updates tracking fields

CREATE OR REPLACE FUNCTION incident_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_event_data JSONB;
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get current user for attribution
  v_actor_id := auth.uid();

  -- Update status_changed_at
  NEW.status_changed_at := now();

  -- Track first response (when status first changes from 'reported')
  IF OLD.status = 'reported' AND NEW.status != 'reported' THEN
    NEW.first_response_at := now();
  END IF;

  -- Track resolution
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := now();
    NEW.resolved_by := COALESCE(v_actor_id, NEW.resolved_by);
  END IF;

  -- Build event data
  v_event_data := jsonb_build_object(
    'from', OLD.status,
    'to', NEW.status
  );

  -- Append status_changed event to timeline (inline to avoid recursion)
  NEW.timeline := NEW.timeline || jsonb_build_object(
    'id', public.generate_uuid_v7(),
    'type', 'status_changed',
    'timestamp', now(),
    'actor_id', v_actor_id,
    'actor_name', COALESCE(
      (SELECT full_name FROM public.residents WHERE id = v_actor_id),
      (SELECT full_name FROM public.guards WHERE user_id = v_actor_id),
      'System'
    ),
    'data', v_event_data
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_incident_status_changed
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION incident_status_changed();

COMMENT ON FUNCTION incident_status_changed IS
  'BEFORE UPDATE trigger that logs status transitions to timeline.
   Sets first_response_at when moving from reported.
   Sets resolved_at and resolved_by when status becomes resolved.';

-- ============================================
-- INCIDENT CREATED TRIGGER FUNCTION
-- ============================================
-- Adds 'created' event when incident is first inserted

CREATE OR REPLACE FUNCTION incident_created_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_name TEXT;
  v_reporter_info TEXT;
BEGIN
  -- Determine reporter info
  IF NEW.reported_by IS NOT NULL THEN
    v_actor_id := NEW.reported_by;
    SELECT full_name INTO v_actor_name FROM public.residents WHERE id = NEW.reported_by;
    v_reporter_info := 'resident';
  ELSIF NEW.reported_by_guard IS NOT NULL THEN
    v_actor_id := (SELECT user_id FROM public.guards WHERE id = NEW.reported_by_guard);
    SELECT full_name INTO v_actor_name FROM public.guards WHERE id = NEW.reported_by_guard;
    v_reporter_info := 'guard';
  ELSE
    v_actor_name := COALESCE(NEW.reporter_name, 'Anonymous');
    v_reporter_info := 'external';
  END IF;

  -- Create the 'created' event
  NEW.timeline := jsonb_build_array(
    jsonb_build_object(
      'id', public.generate_uuid_v7(),
      'type', 'created',
      'timestamp', now(),
      'actor_id', v_actor_id,
      'actor_name', COALESCE(v_actor_name, 'System'),
      'data', jsonb_build_object(
        'reporter_type', v_reporter_info,
        'severity', NEW.severity,
        'priority', NEW.priority,
        'incident_number', NEW.incident_number
      )
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_incident_created_event
  BEFORE INSERT ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION incident_created_event();

COMMENT ON FUNCTION incident_created_event IS
  'BEFORE INSERT trigger that initializes timeline with created event.
   Captures reporter info (resident, guard, or external).';

-- ============================================
-- MEDIA ADDED TRIGGER FUNCTION
-- ============================================
-- Logs 'media_added' event when media is attached to incident

CREATE OR REPLACE FUNCTION incident_media_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Add media_added event to incident timeline
  PERFORM public.add_incident_event(
    NEW.incident_id,
    'media_added',
    NEW.uploaded_by,
    jsonb_build_object(
      'media_id', NEW.id,
      'media_type', NEW.media_type,
      'file_name', NEW.file_name,
      'caption', NEW.caption
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_incident_media_added
  AFTER INSERT ON incident_media
  FOR EACH ROW
  EXECUTE FUNCTION incident_media_added();

COMMENT ON FUNCTION incident_media_added IS
  'AFTER INSERT trigger on incident_media that logs media_added event to incident timeline.';

-- ============================================
-- ASSIGNMENT CHANGE TRIGGER FUNCTION
-- ============================================
-- Logs 'assigned' event when incident is assigned

CREATE OR REPLACE FUNCTION incident_assignment_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignee_name TEXT;
BEGIN
  -- Look up assignee name
  SELECT COALESCE(
    (SELECT full_name FROM public.residents WHERE id = NEW.assigned_to),
    (SELECT full_name FROM public.guards WHERE user_id = NEW.assigned_to),
    (SELECT COALESCE(raw_user_meta_data->>'full_name', email) FROM auth.users WHERE id = NEW.assigned_to)
  ) INTO v_assignee_name;

  -- Add assigned event
  PERFORM public.add_incident_event(
    NEW.incident_id,
    CASE WHEN NEW.unassigned_at IS NOT NULL THEN 'unassigned' ELSE 'assigned' END,
    NEW.assigned_by,
    jsonb_build_object(
      'assignment_id', NEW.id,
      'user_id', NEW.assigned_to,
      'user_name', v_assignee_name,
      'role', NEW.role,
      'notes', NEW.notes
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_incident_assignment_changed
  AFTER INSERT ON incident_assignments
  FOR EACH ROW
  EXECUTE FUNCTION incident_assignment_changed();

COMMENT ON FUNCTION incident_assignment_changed IS
  'AFTER INSERT trigger on incident_assignments that logs assigned/unassigned events.';

-- ============================================
-- HELPER: ADD COMMENT TO INCIDENT
-- ============================================
-- Convenience function to add comment events

CREATE OR REPLACE FUNCTION add_incident_comment(
  p_incident_id UUID,
  p_text TEXT,
  p_is_internal BOOLEAN DEFAULT false,
  p_actor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.add_incident_event(
    p_incident_id,
    'comment',
    COALESCE(p_actor_id, auth.uid()),
    jsonb_build_object(
      'text', p_text,
      'is_internal', p_is_internal
    )
  );
END;
$$;

COMMENT ON FUNCTION add_incident_comment IS
  'Adds a comment event to an incident timeline.
   is_internal: true for staff-only comments, false for visible to reporter.';

-- ============================================
-- HELPER: ESCALATE INCIDENT
-- ============================================
-- Logs escalation with reason and updates priority

CREATE OR REPLACE FUNCTION escalate_incident(
  p_incident_id UUID,
  p_new_priority INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_priority INTEGER;
BEGIN
  -- Get current priority
  SELECT priority INTO v_old_priority
  FROM public.incidents
  WHERE id = p_incident_id;

  -- Update priority
  UPDATE public.incidents
  SET priority = p_new_priority
  WHERE id = p_incident_id;

  -- Log escalation event
  PERFORM public.add_incident_event(
    p_incident_id,
    'escalated',
    auth.uid(),
    jsonb_build_object(
      'from_priority', v_old_priority,
      'to_priority', p_new_priority,
      'reason', p_reason
    )
  );
END;
$$;

COMMENT ON FUNCTION escalate_incident IS
  'Escalates an incident by changing priority and logging the event.
   Priority 1 = highest, 5 = lowest.';
