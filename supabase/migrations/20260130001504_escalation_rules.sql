-- ============================================================================
-- ESCALATION RULES
-- Phase 6, Plan 2: Assets & Preventive Maintenance
-- ============================================================================
-- Configurable escalation rules triggered when SLA thresholds are crossed.
-- Supports multiple trigger types: response/resolution warnings/breaches, status stuck.
-- Actions include: notify, reassign, upgrade_priority, or combinations.
-- Full audit trail via ticket_escalations table.
-- ============================================================================

--------------------------------------------------------------------------------
-- ESCALATION_RULES TABLE
--------------------------------------------------------------------------------

CREATE TABLE escalation_rules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Rule identification
  name TEXT NOT NULL,                       -- e.g., 'Urgent Response Escalation'
  description TEXT,

  -- Trigger conditions
  trigger_type TEXT NOT NULL,               -- response_warning, response_breach, resolution_warning, resolution_breach, status_stuck
  trigger_threshold INTEGER NOT NULL,       -- For warnings: percentage (80 = 80%). For breach: 0. For status_stuck: hours.

  -- Filter conditions (NULL = applies to all)
  applies_to_category_id UUID REFERENCES ticket_categories(id) ON DELETE CASCADE,
  applies_to_priority ticket_priority[],    -- Array of priorities; NULL = all

  -- Action configuration
  action_type TEXT NOT NULL,                -- notify, reassign, upgrade_priority, notify_and_reassign
  action_target UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Who to notify/reassign to
  notification_template TEXT,               -- Message template for notifications

  -- Status and priority
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,      -- Higher = checked first

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Unique rule names per community
  CONSTRAINT escalation_rules_unique_name UNIQUE (community_id, name),

  -- Valid trigger types
  CONSTRAINT escalation_rules_valid_trigger CHECK (
    trigger_type IN ('response_warning', 'response_breach', 'resolution_warning', 'resolution_breach', 'status_stuck')
  ),

  -- Valid action types
  CONSTRAINT escalation_rules_valid_action CHECK (
    action_type IN ('notify', 'reassign', 'upgrade_priority', 'notify_and_reassign')
  )
);

-- Comments
COMMENT ON TABLE escalation_rules IS 'Configurable escalation triggers and actions for SLA enforcement';
COMMENT ON COLUMN escalation_rules.trigger_type IS 'Type: response_warning, response_breach, resolution_warning, resolution_breach, status_stuck';
COMMENT ON COLUMN escalation_rules.trigger_threshold IS 'For warnings: % of SLA elapsed (80 = 80%). For breach: 0. For status_stuck: hours in same status';
COMMENT ON COLUMN escalation_rules.action_type IS 'Action: notify (send notification), reassign (change assignee), upgrade_priority (increase priority), notify_and_reassign';
COMMENT ON COLUMN escalation_rules.priority IS 'Rule evaluation order; higher priority rules evaluated first';

--------------------------------------------------------------------------------
-- TICKET_ESCALATIONS TABLE (Audit Trail)
--------------------------------------------------------------------------------

CREATE TABLE ticket_escalations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES escalation_rules(id) ON DELETE SET NULL,

  -- When and what happened
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action_taken TEXT NOT NULL,               -- Description of action performed

  -- State before/after (for audit)
  previous_priority ticket_priority,
  new_priority ticket_priority,
  previous_assignee UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  new_assignee UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Additional context
  notes TEXT
);

-- Comments
COMMENT ON TABLE ticket_escalations IS 'Audit trail of all escalation actions performed on tickets';
COMMENT ON COLUMN ticket_escalations.action_taken IS 'Human-readable description of the escalation action';

--------------------------------------------------------------------------------
-- CHECK_ESCALATION_TRIGGERS FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_escalation_triggers()
RETURNS TABLE(
  ticket_id UUID,
  rule_id UUID,
  action_type TEXT,
  action_target UUID,
  trigger_type TEXT,
  notification_template TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_ticket RECORD;
  v_threshold_pct NUMERIC;
  v_elapsed_minutes NUMERIC;
  v_total_minutes NUMERIC;
BEGIN
  -- Loop through active escalation rules by priority
  FOR v_rule IN
    SELECT *
    FROM public.escalation_rules er
    WHERE er.is_active = TRUE
      AND er.deleted_at IS NULL
    ORDER BY er.priority DESC, er.created_at
  LOOP
    -- Find tickets matching this rule
    FOR v_ticket IN
      SELECT t.*
      FROM public.tickets t
      WHERE t.community_id = v_rule.community_id
        AND t.deleted_at IS NULL
        AND t.status NOT IN ('closed', 'cancelled')
        -- Category filter
        AND (v_rule.applies_to_category_id IS NULL OR t.category_id = v_rule.applies_to_category_id)
        -- Priority filter
        AND (v_rule.applies_to_priority IS NULL OR t.priority = ANY(v_rule.applies_to_priority))
        -- Not already escalated by this rule (check in ticket_escalations)
        AND NOT EXISTS (
          SELECT 1 FROM public.ticket_escalations te
          WHERE te.ticket_id = t.id
            AND te.rule_id = v_rule.id
            AND te.triggered_at > now() - INTERVAL '24 hours'  -- Allow re-escalation after 24h
        )
    LOOP
      -- Check trigger condition based on type
      CASE v_rule.trigger_type
        WHEN 'response_warning' THEN
          -- Check if we're past threshold % of response SLA
          IF v_ticket.status = 'open' AND v_ticket.response_breached = FALSE THEN
            v_total_minutes := EXTRACT(EPOCH FROM (v_ticket.response_due_at - v_ticket.created_at)) / 60;
            v_elapsed_minutes := EXTRACT(EPOCH FROM (now() - v_ticket.created_at)) / 60;
            v_threshold_pct := (v_elapsed_minutes / NULLIF(v_total_minutes, 0)) * 100;

            IF v_threshold_pct >= v_rule.trigger_threshold THEN
              ticket_id := v_ticket.id;
              rule_id := v_rule.id;
              action_type := v_rule.action_type;
              action_target := v_rule.action_target;
              trigger_type := v_rule.trigger_type;
              notification_template := v_rule.notification_template;
              RETURN NEXT;
            END IF;
          END IF;

        WHEN 'response_breach' THEN
          -- Ticket has breached response SLA
          IF v_ticket.response_breached = TRUE AND v_ticket.first_responded_at IS NULL THEN
            ticket_id := v_ticket.id;
            rule_id := v_rule.id;
            action_type := v_rule.action_type;
            action_target := v_rule.action_target;
            trigger_type := v_rule.trigger_type;
            notification_template := v_rule.notification_template;
            RETURN NEXT;
          END IF;

        WHEN 'resolution_warning' THEN
          -- Check if we're past threshold % of resolution SLA
          IF v_ticket.status NOT IN ('resolved', 'closed', 'cancelled') AND v_ticket.resolution_breached = FALSE THEN
            v_total_minutes := EXTRACT(EPOCH FROM (v_ticket.resolution_due_at - v_ticket.created_at)) / 60;
            v_elapsed_minutes := EXTRACT(EPOCH FROM (now() - v_ticket.created_at)) / 60;
            v_threshold_pct := (v_elapsed_minutes / NULLIF(v_total_minutes, 0)) * 100;

            IF v_threshold_pct >= v_rule.trigger_threshold THEN
              ticket_id := v_ticket.id;
              rule_id := v_rule.id;
              action_type := v_rule.action_type;
              action_target := v_rule.action_target;
              trigger_type := v_rule.trigger_type;
              notification_template := v_rule.notification_template;
              RETURN NEXT;
            END IF;
          END IF;

        WHEN 'resolution_breach' THEN
          -- Ticket has breached resolution SLA
          IF v_ticket.resolution_breached = TRUE AND v_ticket.resolved_at IS NULL THEN
            ticket_id := v_ticket.id;
            rule_id := v_rule.id;
            action_type := v_rule.action_type;
            action_target := v_rule.action_target;
            trigger_type := v_rule.trigger_type;
            notification_template := v_rule.notification_template;
            RETURN NEXT;
          END IF;

        WHEN 'status_stuck' THEN
          -- Ticket has been in same status for too long
          IF v_ticket.status NOT IN ('closed', 'cancelled') THEN
            v_elapsed_minutes := EXTRACT(EPOCH FROM (now() - v_ticket.status_changed_at)) / 60;
            IF v_elapsed_minutes >= (v_rule.trigger_threshold * 60) THEN  -- threshold is in hours
              ticket_id := v_ticket.id;
              rule_id := v_rule.id;
              action_type := v_rule.action_type;
              action_target := v_rule.action_target;
              trigger_type := v_rule.trigger_type;
              notification_template := v_rule.notification_template;
              RETURN NEXT;
            END IF;
          END IF;
      END CASE;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION check_escalation_triggers IS 'Returns tickets matching escalation rules. Run via pg_cron or Edge Function to execute escalations.';

--------------------------------------------------------------------------------
-- EXECUTE_ESCALATION FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION execute_escalation(
  p_ticket_id UUID,
  p_rule_id UUID
)
RETURNS UUID  -- Returns escalation record ID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_ticket RECORD;
  v_escalation_id UUID;
  v_action_taken TEXT;
  v_previous_priority public.ticket_priority;
  v_new_priority public.ticket_priority;
  v_previous_assignee UUID;
  v_new_assignee UUID;
BEGIN
  -- Get the rule
  SELECT * INTO v_rule
  FROM public.escalation_rules
  WHERE id = p_rule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escalation rule % not found', p_rule_id;
  END IF;

  -- Get the ticket
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % not found', p_ticket_id;
  END IF;

  -- Store previous state
  v_previous_priority := v_ticket.priority;
  v_previous_assignee := v_ticket.assigned_to;

  -- Execute action based on action_type
  CASE v_rule.action_type
    WHEN 'notify' THEN
      -- Send notification via pg_notify
      PERFORM pg_notify(
        'escalation',
        json_build_object(
          'ticket_id', p_ticket_id,
          'rule_id', p_rule_id,
          'target_user', v_rule.action_target,
          'community_id', v_ticket.community_id,
          'title', v_ticket.title,
          'trigger_type', v_rule.trigger_type,
          'message', COALESCE(v_rule.notification_template, 'Ticket requires attention: ' || v_ticket.title)
        )::TEXT
      );
      v_action_taken := 'Notification sent to user ' || COALESCE(v_rule.action_target::TEXT, 'community admins');

    WHEN 'reassign' THEN
      -- Reassign ticket
      v_new_assignee := v_rule.action_target;
      UPDATE public.tickets
      SET
        assigned_to = v_new_assignee,
        assigned_at = now()
      WHERE id = p_ticket_id;
      v_action_taken := 'Ticket reassigned from ' || COALESCE(v_previous_assignee::TEXT, 'unassigned') || ' to ' || COALESCE(v_new_assignee::TEXT, 'unassigned');

    WHEN 'upgrade_priority' THEN
      -- Upgrade priority (low->medium->high->urgent)
      v_new_priority := CASE v_ticket.priority
        WHEN 'low' THEN 'medium'::public.ticket_priority
        WHEN 'medium' THEN 'high'::public.ticket_priority
        WHEN 'high' THEN 'urgent'::public.ticket_priority
        WHEN 'urgent' THEN 'urgent'::public.ticket_priority  -- Already max
      END;
      UPDATE public.tickets
      SET priority = v_new_priority
      WHERE id = p_ticket_id;
      v_action_taken := 'Priority upgraded from ' || v_previous_priority || ' to ' || v_new_priority;

    WHEN 'notify_and_reassign' THEN
      -- Both notify and reassign
      v_new_assignee := v_rule.action_target;
      UPDATE public.tickets
      SET
        assigned_to = v_new_assignee,
        assigned_at = now()
      WHERE id = p_ticket_id;

      PERFORM pg_notify(
        'escalation',
        json_build_object(
          'ticket_id', p_ticket_id,
          'rule_id', p_rule_id,
          'target_user', v_rule.action_target,
          'community_id', v_ticket.community_id,
          'title', v_ticket.title,
          'trigger_type', v_rule.trigger_type,
          'message', COALESCE(v_rule.notification_template, 'Ticket escalated and reassigned: ' || v_ticket.title)
        )::TEXT
      );
      v_action_taken := 'Ticket reassigned and notification sent to ' || COALESCE(v_new_assignee::TEXT, 'unassigned');
  END CASE;

  -- Record escalation in audit table
  INSERT INTO public.ticket_escalations (
    ticket_id,
    rule_id,
    action_taken,
    previous_priority,
    new_priority,
    previous_assignee,
    new_assignee,
    notes
  ) VALUES (
    p_ticket_id,
    p_rule_id,
    v_action_taken,
    v_previous_priority,
    v_new_priority,
    v_previous_assignee,
    v_new_assignee,
    'Triggered by: ' || v_rule.trigger_type || ', Rule: ' || v_rule.name
  )
  RETURNING id INTO v_escalation_id;

  -- Add system comment to ticket
  INSERT INTO public.ticket_comments (
    ticket_id,
    author_id,
    author_role,
    content,
    is_system,
    system_action,
    system_data
  ) VALUES (
    p_ticket_id,
    v_rule.action_target,  -- May be NULL for system
    'system',
    'Ticket escalated: ' || v_action_taken,
    TRUE,
    'escalated',
    json_build_object(
      'rule_id', p_rule_id,
      'rule_name', v_rule.name,
      'trigger_type', v_rule.trigger_type,
      'action_type', v_rule.action_type
    )
  );

  RETURN v_escalation_id;
END;
$$;

COMMENT ON FUNCTION execute_escalation IS 'Executes escalation action for a ticket/rule, records audit trail and system comment';

--------------------------------------------------------------------------------
-- PROCESS_ESCALATIONS FUNCTION (convenience wrapper)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_escalations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Process all triggered escalations
  FOR v_trigger IN SELECT * FROM check_escalation_triggers() LOOP
    PERFORM execute_escalation(v_trigger.ticket_id, v_trigger.rule_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION process_escalations IS 'Convenience function: checks all triggers and executes escalations. Run via pg_cron.';

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

-- Active rules by community
CREATE INDEX idx_escalation_rules_community_active
  ON escalation_rules(community_id, is_active, priority DESC)
  WHERE is_active = TRUE AND deleted_at IS NULL;

-- Escalation history by ticket
CREATE INDEX idx_ticket_escalations_ticket
  ON ticket_escalations(ticket_id, triggered_at DESC);

-- Escalation history by rule (for rule effectiveness analysis)
CREATE INDEX idx_ticket_escalations_rule
  ON ticket_escalations(rule_id, triggered_at DESC)
  WHERE rule_id IS NOT NULL;

--------------------------------------------------------------------------------
-- AUDIT TRIGGER
--------------------------------------------------------------------------------

CREATE TRIGGER escalation_rules_audit_trigger
  BEFORE INSERT OR UPDATE ON escalation_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_escalations ENABLE ROW LEVEL SECURITY;

-- Escalation Rules: Super admin
CREATE POLICY super_admin_all_escalation_rules ON escalation_rules
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Escalation Rules: Community admins manage
CREATE POLICY admins_manage_escalation_rules ON escalation_rules
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

-- Escalation Rules: Users can view
CREATE POLICY users_view_escalation_rules ON escalation_rules
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND deleted_at IS NULL
  );

-- Ticket Escalations: Super admin
CREATE POLICY super_admin_all_ticket_escalations ON ticket_escalations
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Ticket Escalations: Users can view (read-only audit trail)
CREATE POLICY users_view_ticket_escalations ON ticket_escalations
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND ticket_id IN (
      SELECT id FROM public.tickets
      WHERE community_id = (SELECT public.get_current_community_id())
    )
  );

-- Ticket Escalations: Insert only via functions (SECURITY DEFINER)
-- No INSERT policy for regular users; inserts happen through execute_escalation()
