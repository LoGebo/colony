-- ============================================================================
-- TICKET ASSIGNMENTS AND COMMENTS
-- Phase 6, Plan 1: Maintenance Ticketing Foundation
-- ============================================================================
-- ticket_assignments: Historical assignment tracking with auto-sync to tickets
-- ticket_comments: Updates, photos, and system-generated entries for audit trail
-- ============================================================================

--------------------------------------------------------------------------------
-- TICKET_ASSIGNMENTS TABLE
--------------------------------------------------------------------------------

CREATE TABLE ticket_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,

  -- Who is assigned
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timing
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,               -- NULL if current assignee

  -- Notes
  notes TEXT                               -- Reason for assignment
);

-- Comments
COMMENT ON TABLE ticket_assignments IS 'Historical tracking of ticket assignments, allowing audit of who worked on what';
COMMENT ON COLUMN ticket_assignments.unassigned_at IS 'NULL indicates current assignee; set when reassigned';
COMMENT ON COLUMN ticket_assignments.notes IS 'Optional reason for assignment or reassignment';

--------------------------------------------------------------------------------
-- UPDATE_TICKET_ASSIGNED_TO TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_ticket_assigned_to()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark previous assignment as ended
  UPDATE ticket_assignments
  SET unassigned_at = now()
  WHERE ticket_id = NEW.ticket_id
    AND unassigned_at IS NULL
    AND id != NEW.id;

  -- Update tickets.assigned_to and assigned_at
  UPDATE tickets
  SET assigned_to = NEW.assigned_to,
      assigned_at = NEW.assigned_at
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_ticket_assigned_to IS 'Syncs ticket assignment to tickets table and ends previous assignment';

CREATE TRIGGER ticket_assignment_sync_trigger
  AFTER INSERT ON ticket_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_assigned_to();

--------------------------------------------------------------------------------
-- INDEXES FOR TICKET_ASSIGNMENTS
--------------------------------------------------------------------------------

-- Assignment history for a ticket
CREATE INDEX idx_ticket_assignments_ticket
  ON ticket_assignments(ticket_id, assigned_at DESC);

-- Current assignments for a user
CREATE INDEX idx_ticket_assignments_user_current
  ON ticket_assignments(assigned_to, assigned_at DESC)
  WHERE unassigned_at IS NULL;

--------------------------------------------------------------------------------
-- TICKET_COMMENTS TABLE
--------------------------------------------------------------------------------

CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,

  -- Author
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL,               -- 'reporter', 'assignee', 'admin', 'system'

  -- Content
  content TEXT,                            -- NULL for system-only comments

  -- Media attachments
  photo_urls TEXT[],

  -- Status change tracking (for system comments)
  status_from public.ticket_status,
  status_to public.ticket_status,

  -- Visibility flags
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,  -- Only visible to staff
  is_system BOOLEAN NOT NULL DEFAULT FALSE,    -- Auto-generated comment

  -- System comment metadata
  system_action TEXT,                      -- 'status_changed', 'assigned', 'priority_changed', 'sla_breached'
  system_data JSONB,                       -- Additional context for system action

  -- Timestamp (no updated_at - comments are immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE ticket_comments IS 'Ticket updates, photos, and system-generated entries forming the ticket timeline';
COMMENT ON COLUMN ticket_comments.author_role IS 'Role of author at time of comment: reporter, assignee, admin, or system';
COMMENT ON COLUMN ticket_comments.is_internal IS 'Internal notes only visible to staff, not reporters';
COMMENT ON COLUMN ticket_comments.is_system IS 'True for auto-generated comments (status changes, assignments, etc.)';
COMMENT ON COLUMN ticket_comments.system_action IS 'Type of system event: status_changed, assigned, priority_changed, sla_breached';

--------------------------------------------------------------------------------
-- AUTO_COMMENT_ON_STATUS_CHANGE TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_comment_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create comment if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_comments (
      ticket_id,
      author_id,
      author_role,
      content,
      status_from,
      status_to,
      is_system,
      system_action,
      system_data
    ) VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.assigned_to, NEW.created_by),
      'system',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      OLD.status,
      NEW.status,
      TRUE,
      'status_changed',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'changed_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_comment_on_status_change IS 'Creates system comment when ticket status changes for audit trail';

CREATE TRIGGER ticket_status_comment_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_comment_on_status_change();

--------------------------------------------------------------------------------
-- AUTO_COMMENT_ON_ASSIGNMENT TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_comment_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_name TEXT;
BEGIN
  -- Only create comment if assigned_to actually changed
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    -- Try to get assignee display name
    SELECT COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      email
    ) INTO assignee_name
    FROM auth.users
    WHERE id = NEW.assigned_to;

    INSERT INTO ticket_comments (
      ticket_id,
      author_id,
      author_role,
      content,
      is_system,
      system_action,
      system_data
    ) VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.created_by),
      'system',
      'Ticket assigned to ' || COALESCE(assignee_name, NEW.assigned_to::TEXT),
      TRUE,
      'assigned',
      jsonb_build_object(
        'assigned_to', NEW.assigned_to,
        'assigned_to_name', assignee_name,
        'previous_assignee', OLD.assigned_to,
        'assigned_at', NEW.assigned_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_comment_on_assignment IS 'Creates system comment when ticket is assigned for audit trail';

CREATE TRIGGER ticket_assignment_comment_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  EXECUTE FUNCTION auto_comment_on_assignment();

--------------------------------------------------------------------------------
-- AUTO_COMMENT_ON_PRIORITY_CHANGE TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_comment_on_priority_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_comments (
      ticket_id,
      author_id,
      author_role,
      content,
      is_system,
      system_action,
      system_data
    ) VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.created_by),
      'system',
      'Priority changed from ' || OLD.priority || ' to ' || NEW.priority,
      TRUE,
      'priority_changed',
      jsonb_build_object(
        'from', OLD.priority,
        'to', NEW.priority,
        'changed_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_comment_on_priority_change IS 'Creates system comment when ticket priority changes';

CREATE TRIGGER ticket_priority_comment_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (OLD.priority IS DISTINCT FROM NEW.priority)
  EXECUTE FUNCTION auto_comment_on_priority_change();

--------------------------------------------------------------------------------
-- INDEXES FOR TICKET_COMMENTS
--------------------------------------------------------------------------------

-- Ticket timeline
CREATE INDEX idx_ticket_comments_timeline
  ON ticket_comments(ticket_id, created_at DESC);

-- System comments for audit
CREATE INDEX idx_ticket_comments_system
  ON ticket_comments(ticket_id, system_action)
  WHERE is_system = TRUE;

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

ALTER TABLE ticket_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- Ticket Assignments: Super admin
CREATE POLICY super_admin_all_ticket_assignments ON ticket_assignments
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Ticket Assignments: Community members can view
CREATE POLICY users_view_ticket_assignments ON ticket_assignments
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.community_id = (SELECT get_current_community_id())
    )
  );

-- Ticket Assignments: Admins can manage
CREATE POLICY admins_manage_ticket_assignments ON ticket_assignments
  FOR ALL
  TO authenticated
  USING (
    NOT is_super_admin()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.community_id = (SELECT get_current_community_id())
    )
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    NOT is_super_admin()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.community_id = (SELECT get_current_community_id())
    )
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Ticket Comments: Super admin
CREATE POLICY super_admin_all_ticket_comments ON ticket_comments
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Ticket Comments: Community members can view (except internal unless staff)
CREATE POLICY users_view_ticket_comments ON ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.community_id = (SELECT get_current_community_id())
    )
    AND (
      is_internal = FALSE
      OR (SELECT get_current_user_role()) IN ('admin', 'manager', 'staff')
    )
  );

-- Ticket Comments: Reporters can add comments to their tickets
CREATE POLICY reporters_create_comments ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.community_id = (SELECT get_current_community_id())
      AND t.reported_by = (
        SELECT id FROM residents
        WHERE id = auth.uid()
        LIMIT 1
      )
    )
    AND is_internal = FALSE
    AND is_system = FALSE
  );

-- Ticket Comments: Staff can add any comments
CREATE POLICY staff_create_comments ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.community_id = (SELECT get_current_community_id())
    )
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'staff')
  );

-- Ticket Comments: Assignees can add comments to their assigned tickets
CREATE POLICY assignees_create_comments ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_super_admin()
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
      AND t.community_id = (SELECT get_current_community_id())
      AND t.assigned_to = auth.uid()
    )
  );
