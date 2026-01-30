-- ============================================================================
-- PREVENTIVE MAINTENANCE SCHEDULES
-- Phase 6, Plan 2: Assets & Preventive Maintenance
-- ============================================================================
-- Recurring maintenance schedules using iCalendar RFC 5545 RRULE strings
-- Auto-generates tickets based on schedule via generate_preventive_tickets()
--
-- RRULE Examples:
--   FREQ=WEEKLY;BYDAY=MO               -> Every Monday
--   FREQ=MONTHLY;BYMONTHDAY=1          -> First of each month
--   FREQ=MONTHLY;INTERVAL=3            -> Every 3 months
--   FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15 -> June 15 yearly
-- ============================================================================

--------------------------------------------------------------------------------
-- PREVENTIVE_SCHEDULES TABLE
--------------------------------------------------------------------------------

CREATE TABLE preventive_schedules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Schedule identification
  name TEXT NOT NULL,                       -- e.g., 'Mantenimiento Mensual Elevadores'
  description TEXT,

  -- RRULE recurrence (RFC 5545 iCalendar format)
  rrule TEXT NOT NULL,                      -- e.g., 'FREQ=MONTHLY;BYMONTHDAY=15'
  dtstart TIMESTAMPTZ NOT NULL,             -- Start date for recurrence calculation

  -- Ticket template
  category_id UUID NOT NULL REFERENCES ticket_categories(id) ON DELETE RESTRICT,
  priority ticket_priority NOT NULL DEFAULT 'low',
  title_template TEXT NOT NULL,             -- Supports {asset_name}, {date} placeholders
  description_template TEXT,

  -- Optional asset association
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,

  -- Generation settings
  generate_days_ahead INTEGER NOT NULL DEFAULT 7,  -- Create ticket N days before due
  auto_assign_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Scheduling state
  last_generated_at TIMESTAMPTZ,            -- Last time a ticket was generated
  next_occurrence_at TIMESTAMPTZ,           -- Pre-computed next occurrence

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Comments
COMMENT ON TABLE preventive_schedules IS 'Recurring maintenance schedules with RRULE recurrence and auto ticket generation';
COMMENT ON COLUMN preventive_schedules.rrule IS 'RFC 5545 RRULE string: FREQ=WEEKLY|MONTHLY|YEARLY;INTERVAL=N;BYDAY=MO,TU;BYMONTHDAY=1,15;BYMONTH=1,6';
COMMENT ON COLUMN preventive_schedules.dtstart IS 'Start date for recurrence pattern; first occurrence anchored to this date';
COMMENT ON COLUMN preventive_schedules.title_template IS 'Template with placeholders: {asset_name}, {date} e.g., "Mantenimiento {asset_name} - {date}"';
COMMENT ON COLUMN preventive_schedules.generate_days_ahead IS 'Days before occurrence to generate ticket (allows prep time)';

--------------------------------------------------------------------------------
-- COMPUTE_NEXT_RRULE_OCCURRENCE FUNCTION
--------------------------------------------------------------------------------
-- MVP implementation for common RRULE patterns.
-- For full RFC 5545 compliance, consider pg_rrule extension in production.

CREATE OR REPLACE FUNCTION compute_next_rrule_occurrence(
  p_rrule TEXT,
  p_dtstart TIMESTAMPTZ,
  p_after TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_freq TEXT;
  v_interval INTEGER := 1;
  v_bymonthday INTEGER;
  v_next TIMESTAMPTZ;
  v_part TEXT;
  v_parts TEXT[];
BEGIN
  -- Parse RRULE components
  v_parts := string_to_array(p_rrule, ';');

  FOREACH v_part IN ARRAY v_parts LOOP
    IF v_part LIKE 'FREQ=%' THEN
      v_freq := substring(v_part FROM 6);
    ELSIF v_part LIKE 'INTERVAL=%' THEN
      v_interval := substring(v_part FROM 10)::INTEGER;
    ELSIF v_part LIKE 'BYMONTHDAY=%' THEN
      v_bymonthday := substring(v_part FROM 12)::INTEGER;
    END IF;
  END LOOP;

  -- Start from the later of dtstart or after
  v_next := GREATEST(p_dtstart, p_after);

  -- Compute next occurrence based on frequency
  CASE v_freq
    WHEN 'DAILY' THEN
      -- Add days until we're past p_after
      WHILE v_next <= p_after LOOP
        v_next := v_next + (v_interval || ' days')::INTERVAL;
      END LOOP;

    WHEN 'WEEKLY' THEN
      -- Add weeks until we're past p_after
      WHILE v_next <= p_after LOOP
        v_next := v_next + (v_interval * 7 || ' days')::INTERVAL;
      END LOOP;

    WHEN 'MONTHLY' THEN
      -- For monthly, consider BYMONTHDAY
      IF v_bymonthday IS NOT NULL THEN
        -- Move to next occurrence of bymonthday
        v_next := date_trunc('month', p_after) + ((v_bymonthday - 1) || ' days')::INTERVAL
                  + (p_dtstart - date_trunc('day', p_dtstart));
        IF v_next <= p_after THEN
          v_next := v_next + (v_interval || ' months')::INTERVAL;
        END IF;
      ELSE
        -- Use same day of month as dtstart
        WHILE v_next <= p_after LOOP
          v_next := v_next + (v_interval || ' months')::INTERVAL;
        END LOOP;
      END IF;

    WHEN 'YEARLY' THEN
      -- Add years until we're past p_after
      WHILE v_next <= p_after LOOP
        v_next := v_next + (v_interval || ' years')::INTERVAL;
      END LOOP;

    ELSE
      -- Unknown frequency, default to monthly
      WHILE v_next <= p_after LOOP
        v_next := v_next + (v_interval || ' months')::INTERVAL;
      END LOOP;
  END CASE;

  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION compute_next_rrule_occurrence IS 'MVP RRULE parser for DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL and BYMONTHDAY support';

--------------------------------------------------------------------------------
-- SET_NEXT_OCCURRENCE TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_next_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Compute next occurrence if rrule or dtstart changed, or on insert
  IF TG_OP = 'INSERT' OR
     OLD.rrule IS DISTINCT FROM NEW.rrule OR
     OLD.dtstart IS DISTINCT FROM NEW.dtstart THEN
    NEW.next_occurrence_at := compute_next_rrule_occurrence(
      NEW.rrule,
      NEW.dtstart,
      COALESCE(NEW.last_generated_at, NEW.dtstart - INTERVAL '1 day')
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_next_occurrence IS 'Auto-computes next_occurrence_at when rrule or dtstart changes';

CREATE TRIGGER preventive_schedules_set_next_occurrence
  BEFORE INSERT OR UPDATE ON preventive_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_next_occurrence();

--------------------------------------------------------------------------------
-- ADD preventive_schedule_id FK TO TICKETS TABLE
--------------------------------------------------------------------------------

-- Add FK constraint to existing column (column was added without FK in 06-01)
ALTER TABLE tickets
  ADD CONSTRAINT tickets_preventive_schedule_id_fkey
  FOREIGN KEY (preventive_schedule_id) REFERENCES preventive_schedules(id) ON DELETE SET NULL;

-- Index for finding tickets from schedules
CREATE INDEX idx_tickets_preventive_schedule
  ON tickets(preventive_schedule_id)
  WHERE preventive_schedule_id IS NOT NULL AND deleted_at IS NULL;

--------------------------------------------------------------------------------
-- GENERATE_PREVENTIVE_TICKETS FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_preventive_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_ticket_id UUID;
  v_title TEXT;
  v_description TEXT;
  v_asset_name TEXT;
  v_date_str TEXT;
  v_system_user UUID;
  v_count INTEGER := 0;
  v_next_occurrence TIMESTAMPTZ;
BEGIN
  -- Find a system user or admin for reported_by (schedules need a reporter)
  -- Try to find a super admin or first admin in the community
  SELECT id INTO v_system_user
  FROM auth.users
  LIMIT 1;

  -- Loop through active schedules due for ticket generation
  FOR v_schedule IN
    SELECT ps.*, a.name AS asset_name
    FROM public.preventive_schedules ps
    LEFT JOIN public.assets a ON a.id = ps.asset_id
    WHERE ps.is_active = TRUE
      AND ps.deleted_at IS NULL
      AND ps.next_occurrence_at IS NOT NULL
      AND ps.next_occurrence_at <= now() + (ps.generate_days_ahead || ' days')::INTERVAL
      -- Don't regenerate if we already generated for this occurrence
      AND (
        ps.last_generated_at IS NULL
        OR ps.last_generated_at < ps.next_occurrence_at - (ps.generate_days_ahead || ' days')::INTERVAL
      )
  LOOP
    -- Format date for template
    v_date_str := to_char(v_schedule.next_occurrence_at, 'YYYY-MM-DD');
    v_asset_name := COALESCE(v_schedule.asset_name, '');

    -- Replace placeholders in title
    v_title := v_schedule.title_template;
    v_title := replace(v_title, '{date}', v_date_str);
    v_title := replace(v_title, '{asset_name}', v_asset_name);

    -- Replace placeholders in description
    v_description := COALESCE(v_schedule.description_template, v_schedule.description, '');
    v_description := replace(v_description, '{date}', v_date_str);
    v_description := replace(v_description, '{asset_name}', v_asset_name);

    -- Find a resident in this community to use as reporter
    -- (Using first resident as system reporter for automated tickets)
    SELECT r.id INTO v_system_user
    FROM public.residents r
    WHERE r.community_id = v_schedule.community_id
      AND r.deleted_at IS NULL
    LIMIT 1;

    -- Create the ticket
    INSERT INTO public.tickets (
      community_id,
      reported_by,
      category_id,
      priority,
      title,
      description,
      asset_id,
      preventive_schedule_id,
      assigned_to,
      assigned_at
    ) VALUES (
      v_schedule.community_id,
      v_system_user,
      v_schedule.category_id,
      v_schedule.priority,
      v_title,
      v_description,
      v_schedule.asset_id,
      v_schedule.id,
      v_schedule.auto_assign_to,
      CASE WHEN v_schedule.auto_assign_to IS NOT NULL THEN now() END
    )
    RETURNING id INTO v_ticket_id;

    -- Compute the NEXT next occurrence
    v_next_occurrence := compute_next_rrule_occurrence(
      v_schedule.rrule,
      v_schedule.dtstart,
      v_schedule.next_occurrence_at
    );

    -- Update the schedule
    UPDATE public.preventive_schedules
    SET
      last_generated_at = now(),
      next_occurrence_at = v_next_occurrence
    WHERE id = v_schedule.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION generate_preventive_tickets IS 'Creates tickets from active preventive schedules within generation window. Run via pg_cron or Edge Function.';

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

-- Active schedules with upcoming occurrences
CREATE INDEX idx_preventive_schedules_active
  ON preventive_schedules(is_active, next_occurrence_at)
  WHERE is_active = TRUE AND deleted_at IS NULL;

-- Schedules by asset
CREATE INDEX idx_preventive_schedules_asset
  ON preventive_schedules(asset_id)
  WHERE asset_id IS NOT NULL AND deleted_at IS NULL;

-- Community schedules
CREATE INDEX idx_preventive_schedules_community
  ON preventive_schedules(community_id)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- AUDIT TRIGGER
--------------------------------------------------------------------------------

CREATE TRIGGER preventive_schedules_audit_trigger
  BEFORE INSERT OR UPDATE ON preventive_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

ALTER TABLE preventive_schedules ENABLE ROW LEVEL SECURITY;

-- Super admin
CREATE POLICY super_admin_all_preventive_schedules ON preventive_schedules
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Community members can view schedules
CREATE POLICY users_view_preventive_schedules ON preventive_schedules
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND deleted_at IS NULL
  );

-- Admins can manage schedules
CREATE POLICY admins_manage_preventive_schedules ON preventive_schedules
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
