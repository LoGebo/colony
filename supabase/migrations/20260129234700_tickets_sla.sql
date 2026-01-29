-- ============================================================================
-- SLA DEFINITIONS AND TICKETS TABLE
-- Phase 6, Plan 1: Maintenance Ticketing Foundation
-- ============================================================================
-- SLA matrix: category + priority -> response_minutes, resolution_minutes
-- Tickets: state machine with transition validation trigger
-- Due dates auto-computed on insert, recomputed on priority change
-- Breach detection via check_sla_breaches() with pg_notify for alerts
-- ============================================================================

--------------------------------------------------------------------------------
-- SLA_DEFINITIONS TABLE
--------------------------------------------------------------------------------

CREATE TABLE sla_definitions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Category can be NULL for catch-all/default SLA
  category_id UUID REFERENCES ticket_categories(id) ON DELETE CASCADE,
  priority ticket_priority NOT NULL,

  -- Time limits (in minutes for precision)
  response_minutes INTEGER NOT NULL,       -- Time to first response
  resolution_minutes INTEGER NOT NULL,     -- Time to resolution

  -- Business hours handling
  business_hours_only BOOLEAN NOT NULL DEFAULT TRUE,

  -- Escalation settings
  escalate_on_breach BOOLEAN NOT NULL DEFAULT TRUE,
  escalate_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- One SLA per category+priority combination per community
  -- NULL category uses COALESCE for unique constraint
  CONSTRAINT sla_unique_category_priority
    UNIQUE NULLS NOT DISTINCT (community_id, category_id, priority)
);

-- Comments
COMMENT ON TABLE sla_definitions IS 'SLA matrix: response and resolution times per category+priority combination';
COMMENT ON COLUMN sla_definitions.category_id IS 'NULL means this SLA applies to all categories without specific SLA';
COMMENT ON COLUMN sla_definitions.response_minutes IS 'Maximum time to first response (status change from open)';
COMMENT ON COLUMN sla_definitions.resolution_minutes IS 'Maximum time to resolution (status change to resolved)';
COMMENT ON COLUMN sla_definitions.business_hours_only IS 'If true, SLA clock pauses outside business hours (future feature)';

-- Index for SLA lookup
CREATE INDEX idx_sla_definitions_lookup
  ON sla_definitions(community_id, category_id, priority)
  WHERE is_active = TRUE AND deleted_at IS NULL;

-- Audit trigger
CREATE TRIGGER sla_definitions_audit_trigger
  BEFORE INSERT OR UPDATE ON sla_definitions
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

--------------------------------------------------------------------------------
-- COMPUTE_SLA_DUE_DATES FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION compute_sla_due_dates(
  p_community_id UUID,
  p_category_id UUID,
  p_priority public.ticket_priority,
  p_created_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(response_due TIMESTAMPTZ, resolution_due TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sla RECORD;
BEGIN
  -- Find matching SLA (specific category first, then NULL category fallback)
  SELECT * INTO sla
  FROM public.sla_definitions
  WHERE community_id = p_community_id
    AND (category_id = p_category_id OR category_id IS NULL)
    AND priority = p_priority
    AND is_active = TRUE
    AND deleted_at IS NULL
  ORDER BY category_id NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    -- Default SLAs if none defined:
    -- low: 72h response, 7d resolution
    -- medium: 24h response, 3d resolution
    -- high: 4h response, 24h resolution
    -- urgent: 1h response, 4h resolution
    RETURN QUERY SELECT
      CASE p_priority
        WHEN 'low' THEN p_created_at + INTERVAL '72 hours'
        WHEN 'medium' THEN p_created_at + INTERVAL '24 hours'
        WHEN 'high' THEN p_created_at + INTERVAL '4 hours'
        WHEN 'urgent' THEN p_created_at + INTERVAL '1 hour'
        ELSE p_created_at + INTERVAL '24 hours'
      END,
      CASE p_priority
        WHEN 'low' THEN p_created_at + INTERVAL '7 days'
        WHEN 'medium' THEN p_created_at + INTERVAL '3 days'
        WHEN 'high' THEN p_created_at + INTERVAL '24 hours'
        WHEN 'urgent' THEN p_created_at + INTERVAL '4 hours'
        ELSE p_created_at + INTERVAL '7 days'
      END;
    RETURN;
  END IF;

  -- TODO: For business_hours_only, implement business hours calculation
  -- For now, use simple interval addition
  RETURN QUERY SELECT
    p_created_at + (sla.response_minutes || ' minutes')::INTERVAL,
    p_created_at + (sla.resolution_minutes || ' minutes')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION compute_sla_due_dates IS 'Computes SLA due dates based on category+priority matrix with defaults';

--------------------------------------------------------------------------------
-- TICKETS TABLE
--------------------------------------------------------------------------------

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Reporter
  reported_by UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  -- Classification
  category_id UUID NOT NULL REFERENCES ticket_categories(id) ON DELETE RESTRICT,
  priority ticket_priority NOT NULL DEFAULT 'medium',

  -- Description
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,                          -- Specific location within community

  -- State machine
  status ticket_status NOT NULL DEFAULT 'open',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- SLA tracking (computed on creation/priority change)
  response_due_at TIMESTAMPTZ,
  resolution_due_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,         -- When status first changed from 'open'
  resolved_at TIMESTAMPTZ,                -- When status became 'resolved'

  -- SLA breach flags
  response_breached BOOLEAN NOT NULL DEFAULT FALSE,
  resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- Asset/schedule references (FKs added in plan 06-02)
  asset_id UUID,
  preventive_schedule_id UUID,

  -- Metadata
  tags TEXT[],
  custom_fields JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Comments
COMMENT ON TABLE tickets IS 'Maintenance tickets with state machine validation and SLA tracking';
COMMENT ON COLUMN tickets.status IS 'Current ticket state, transitions enforced by validate_ticket_transition trigger';
COMMENT ON COLUMN tickets.first_responded_at IS 'Timestamp when ticket first left open status (not to cancelled)';
COMMENT ON COLUMN tickets.response_breached IS 'Set to true when response_due_at is exceeded while in open status';
COMMENT ON COLUMN tickets.resolution_breached IS 'Set to true when resolution_due_at is exceeded before resolution';

--------------------------------------------------------------------------------
-- VALIDATE_TICKET_TRANSITION TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_ticket_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_transitions public.ticket_status[];
BEGIN
  -- Only validate on status change
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions per current state
  CASE OLD.status
    WHEN 'open' THEN
      valid_transitions := ARRAY['assigned', 'cancelled']::public.ticket_status[];
    WHEN 'assigned' THEN
      valid_transitions := ARRAY['in_progress', 'open', 'cancelled']::public.ticket_status[];
    WHEN 'in_progress' THEN
      valid_transitions := ARRAY['pending_parts', 'pending_resident', 'resolved', 'assigned']::public.ticket_status[];
    WHEN 'pending_parts' THEN
      valid_transitions := ARRAY['in_progress', 'cancelled']::public.ticket_status[];
    WHEN 'pending_resident' THEN
      valid_transitions := ARRAY['in_progress', 'resolved', 'cancelled']::public.ticket_status[];
    WHEN 'resolved' THEN
      valid_transitions := ARRAY['closed', 'in_progress']::public.ticket_status[];  -- Reopen if not satisfied
    WHEN 'closed' THEN
      valid_transitions := ARRAY[]::public.ticket_status[];  -- Terminal state
    WHEN 'cancelled' THEN
      valid_transitions := ARRAY[]::public.ticket_status[];  -- Terminal state
    ELSE
      valid_transitions := ARRAY[]::public.ticket_status[];
  END CASE;

  -- Check if transition is valid
  IF NOT (NEW.status = ANY(valid_transitions)) THEN
    RAISE EXCEPTION 'Invalid ticket status transition from % to %', OLD.status, NEW.status
      USING HINT = 'Valid transitions from ' || OLD.status || ': ' || array_to_string(valid_transitions, ', ');
  END IF;

  -- Track status change time
  NEW.status_changed_at := now();

  -- Track first response time (when leaving 'open' to any non-cancelled state)
  IF OLD.status = 'open' AND NEW.status != 'cancelled' AND OLD.first_responded_at IS NULL THEN
    NEW.first_responded_at := now();
  END IF;

  -- Track resolution time
  IF NEW.status = 'resolved' AND OLD.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_ticket_transition IS 'Enforces valid ticket state machine transitions';

CREATE TRIGGER ticket_transition_trigger
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_ticket_transition();

--------------------------------------------------------------------------------
-- SET_TICKET_SLA_DATES TRIGGER FUNCTION (BEFORE INSERT)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_ticket_sla_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  due_dates RECORD;
BEGIN
  SELECT * INTO due_dates
  FROM public.compute_sla_due_dates(
    NEW.community_id,
    NEW.category_id,
    NEW.priority,
    COALESCE(NEW.created_at, now())
  );

  NEW.response_due_at := due_dates.response_due;
  NEW.resolution_due_at := due_dates.resolution_due;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_ticket_sla_dates IS 'Auto-computes SLA due dates on ticket creation';

CREATE TRIGGER ticket_sla_dates_trigger
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_sla_dates();

--------------------------------------------------------------------------------
-- RECOMPUTE_SLA_ON_PRIORITY_CHANGE TRIGGER FUNCTION (BEFORE UPDATE)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION recompute_sla_on_priority_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  due_dates RECORD;
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    SELECT * INTO due_dates
    FROM public.compute_sla_due_dates(
      NEW.community_id,
      NEW.category_id,
      NEW.priority,
      NEW.created_at
    );

    NEW.response_due_at := due_dates.response_due;
    NEW.resolution_due_at := due_dates.resolution_due;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION recompute_sla_on_priority_change IS 'Recomputes SLA due dates when ticket priority changes';

CREATE TRIGGER ticket_priority_change_trigger
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  WHEN (OLD.priority IS DISTINCT FROM NEW.priority)
  EXECUTE FUNCTION recompute_sla_on_priority_change();

--------------------------------------------------------------------------------
-- CHECK_SLA_BREACHES FUNCTION (for periodic execution)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS TABLE(
  ticket_id UUID,
  breach_type TEXT,
  community_id UUID,
  escalate_to UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Find and flag response breaches
  RETURN QUERY
  WITH response_breaches AS (
    UPDATE public.tickets t
    SET response_breached = TRUE
    WHERE t.status = 'open'
      AND t.response_due_at < now()
      AND t.response_breached = FALSE
      AND t.deleted_at IS NULL
    RETURNING t.id, t.community_id, t.category_id, t.priority
  )
  SELECT
    rb.id,
    'response'::TEXT,
    rb.community_id,
    s.escalate_to
  FROM response_breaches rb
  LEFT JOIN public.sla_definitions s ON
    s.community_id = rb.community_id
    AND (s.category_id = rb.category_id OR s.category_id IS NULL)
    AND s.priority = rb.priority
    AND s.is_active = TRUE
    AND s.deleted_at IS NULL;

  -- Find and flag resolution breaches
  RETURN QUERY
  WITH resolution_breaches AS (
    UPDATE public.tickets t
    SET resolution_breached = TRUE
    WHERE t.status NOT IN ('resolved', 'closed', 'cancelled')
      AND t.resolution_due_at < now()
      AND t.resolution_breached = FALSE
      AND t.deleted_at IS NULL
    RETURNING t.id, t.community_id, t.category_id, t.priority
  )
  SELECT
    rb.id,
    'resolution'::TEXT,
    rb.community_id,
    s.escalate_to
  FROM resolution_breaches rb
  LEFT JOIN public.sla_definitions s ON
    s.community_id = rb.community_id
    AND (s.category_id = rb.category_id OR s.category_id IS NULL)
    AND s.priority = rb.priority
    AND s.is_active = TRUE
    AND s.deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION check_sla_breaches IS 'Flags SLA breaches and returns affected tickets for escalation (run via pg_cron or Edge Function)';

--------------------------------------------------------------------------------
-- NOTIFY_SLA_BREACH TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_sla_breach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.response_breached = TRUE AND OLD.response_breached = FALSE THEN
    PERFORM pg_notify(
      'sla_breach',
      json_build_object(
        'ticket_id', NEW.id,
        'community_id', NEW.community_id,
        'breach_type', 'response',
        'title', NEW.title,
        'priority', NEW.priority,
        'breached_at', now()
      )::TEXT
    );
  END IF;

  IF NEW.resolution_breached = TRUE AND OLD.resolution_breached = FALSE THEN
    PERFORM pg_notify(
      'sla_breach',
      json_build_object(
        'ticket_id', NEW.id,
        'community_id', NEW.community_id,
        'breach_type', 'resolution',
        'title', NEW.title,
        'priority', NEW.priority,
        'breached_at', now()
      )::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_sla_breach IS 'Sends pg_notify on SLA breach for real-time alerting';

CREATE TRIGGER ticket_sla_breach_notify
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (
    (NEW.response_breached = TRUE AND OLD.response_breached = FALSE) OR
    (NEW.resolution_breached = TRUE AND OLD.resolution_breached = FALSE)
  )
  EXECUTE FUNCTION notify_sla_breach();

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

-- Open ticket list by community
CREATE INDEX idx_tickets_community_status
  ON tickets(community_id, status)
  WHERE deleted_at IS NULL;

-- My assigned tickets
CREATE INDEX idx_tickets_assigned_status
  ON tickets(assigned_to, status)
  WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

-- Breach monitoring (for check_sla_breaches performance)
CREATE INDEX idx_tickets_response_due
  ON tickets(response_due_at)
  WHERE response_breached = FALSE AND status = 'open' AND deleted_at IS NULL;

CREATE INDEX idx_tickets_resolution_due
  ON tickets(resolution_due_at)
  WHERE resolution_breached = FALSE
    AND status NOT IN ('resolved', 'closed', 'cancelled')
    AND deleted_at IS NULL;

-- Reporter's tickets
CREATE INDEX idx_tickets_reported_by
  ON tickets(reported_by, created_at DESC)
  WHERE deleted_at IS NULL;

-- Unit tickets
CREATE INDEX idx_tickets_unit
  ON tickets(unit_id, created_at DESC)
  WHERE unit_id IS NOT NULL AND deleted_at IS NULL;

--------------------------------------------------------------------------------
-- AUDIT TRIGGER
--------------------------------------------------------------------------------

CREATE TRIGGER tickets_audit_trigger
  BEFORE INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

ALTER TABLE sla_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- SLA Definitions: Super admin
CREATE POLICY super_admin_all_sla_definitions ON sla_definitions
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- SLA Definitions: Community admins can manage
CREATE POLICY admins_manage_sla_definitions ON sla_definitions
  FOR ALL
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- Tickets: Super admin
CREATE POLICY super_admin_all_tickets ON tickets
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Tickets: Community members can view their community's tickets
CREATE POLICY users_view_community_tickets ON tickets
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND deleted_at IS NULL
  );

-- Tickets: Residents can create tickets
CREATE POLICY residents_create_tickets ON tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
  );

-- Tickets: Admins can manage all aspects
CREATE POLICY admins_manage_tickets ON tickets
  FOR ALL
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- Tickets: Assigned staff can update their tickets
CREATE POLICY assignees_update_tickets ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND assigned_to = auth.uid()
  );

-- Tickets: Reporters can update their own tickets (e.g., add info, cancel)
CREATE POLICY reporters_update_own_tickets ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND reported_by = (
      SELECT id FROM public.residents
      WHERE id = auth.uid()
      AND community_id = (SELECT public.get_current_community_id())
      LIMIT 1
    )
  )
  WITH CHECK (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
  );
