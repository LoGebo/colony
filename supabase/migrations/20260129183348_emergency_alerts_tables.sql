-- Migration: Emergency Alerts and Responders Tables
-- Plan: 03-04 (Emergency Alerts & QR Codes)
-- Creates emergency dispatch workflow with SLA tracking

CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Alert type (uses emergency_type enum from Phase 1: panic, medical, fire, intrusion, natural_disaster)
  emergency_type emergency_type NOT NULL,
  priority priority_level NOT NULL DEFAULT 'critical',

  -- Who triggered the alert
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_by_name TEXT,                  -- Denormalized for reports
  triggered_by_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  -- Location information
  location_description TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  access_point_id UUID REFERENCES access_points(id) ON DELETE SET NULL,

  -- Current status (state machine)
  status emergency_status NOT NULL DEFAULT 'triggered',

  -- Timestamps for SLA tracking
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES guards(id) ON DELETE SET NULL,
  response_started_at TIMESTAMPTZ,         -- When first responder departed
  on_scene_at TIMESTAMPTZ,                 -- When first responder arrived
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Resolution details
  resolution_type TEXT CHECK (resolution_type IS NULL OR resolution_type IN ('handled', 'false_alarm', 'escalated_911', 'escalated_other')),
  resolution_notes TEXT,

  -- External escalation
  escalated_to_911 BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_at TIMESTAMPTZ,
  external_reference TEXT,                 -- Police report number, incident number, etc.

  -- Evidence
  photos TEXT[],                           -- Array of Storage URLs
  audio_recording_url TEXT,                -- If panic button records audio

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No deleted_at - emergency records are permanent audit trail
);

-- Responders assigned to an emergency (junction table for many-to-many)
CREATE TABLE emergency_responders (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  emergency_alert_id UUID NOT NULL REFERENCES emergency_alerts(id) ON DELETE CASCADE,

  guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE RESTRICT,

  -- Assignment details
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Response tracking (individual guard times)
  acknowledged_at TIMESTAMPTZ,             -- When this guard acknowledged
  departed_at TIMESTAMPTZ,                 -- When this guard started moving
  arrived_at TIMESTAMPTZ,                  -- When this guard arrived on scene

  -- Status of this responder
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'en_route', 'on_scene', 'completed')),

  notes TEXT,

  -- Prevent same guard assigned twice to same emergency
  CONSTRAINT responder_unique UNIQUE (emergency_alert_id, guard_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_emergencies_community ON emergency_alerts(community_id);
CREATE INDEX idx_emergencies_active ON emergency_alerts(community_id, status, triggered_at DESC)
  WHERE status NOT IN ('resolved', 'false_alarm');
CREATE INDEX idx_emergencies_status ON emergency_alerts(status, triggered_at DESC);
CREATE INDEX idx_emergencies_type ON emergency_alerts(community_id, emergency_type, triggered_at DESC);

CREATE INDEX idx_emergency_responders_alert ON emergency_responders(emergency_alert_id);
CREATE INDEX idx_emergency_responders_guard ON emergency_responders(guard_id);

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER emergency_alerts_audit
  BEFORE INSERT OR UPDATE ON emergency_alerts
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- AUTO-SET PRIORITY TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION set_emergency_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set if not explicitly provided or on INSERT
  IF NEW.priority IS NULL OR TG_OP = 'INSERT' THEN
    NEW.priority := CASE NEW.emergency_type
      WHEN 'panic' THEN 'critical'::priority_level
      WHEN 'fire' THEN 'critical'::priority_level
      WHEN 'natural_disaster' THEN 'critical'::priority_level
      WHEN 'medical' THEN 'urgent'::priority_level
      WHEN 'intrusion' THEN 'high'::priority_level
      ELSE 'high'::priority_level
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER emergency_set_priority
  BEFORE INSERT ON emergency_alerts
  FOR EACH ROW
  EXECUTE FUNCTION set_emergency_priority();

-- ============================================
-- TIMELINE UPDATE TRIGGER
-- ============================================
-- Updates emergency_alerts timestamps based on responder status changes

CREATE OR REPLACE FUNCTION update_emergency_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update response_started_at when first responder departs
  IF NEW.departed_at IS NOT NULL AND OLD.departed_at IS NULL THEN
    UPDATE emergency_alerts
    SET response_started_at = COALESCE(response_started_at, NEW.departed_at)
    WHERE id = NEW.emergency_alert_id;
  END IF;

  -- Update on_scene_at when first responder arrives
  IF NEW.arrived_at IS NOT NULL AND OLD.arrived_at IS NULL THEN
    UPDATE emergency_alerts
    SET on_scene_at = COALESCE(on_scene_at, NEW.arrived_at),
        status = CASE WHEN status = 'responding' THEN 'on_scene'::emergency_status ELSE status END
    WHERE id = NEW.emergency_alert_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER emergency_responder_timeline
  AFTER UPDATE ON emergency_responders
  FOR EACH ROW
  EXECUTE FUNCTION update_emergency_timeline();

-- ============================================
-- SLA METRICS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_emergency_sla_metrics(p_emergency_id UUID)
RETURNS TABLE (
  time_to_acknowledge INTERVAL,
  time_to_respond INTERVAL,
  time_to_arrive INTERVAL,
  time_to_resolve INTERVAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    acknowledged_at - triggered_at AS time_to_acknowledge,
    response_started_at - triggered_at AS time_to_respond,
    on_scene_at - triggered_at AS time_to_arrive,
    resolved_at - triggered_at AS time_to_resolve
  FROM public.emergency_alerts
  WHERE id = p_emergency_id;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_responders ENABLE ROW LEVEL SECURITY;

-- Emergency alerts RLS
CREATE POLICY "super_admin_all_emergencies" ON emergency_alerts FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "users_view_own_community_emergencies" ON emergency_alerts FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Any authenticated user can trigger emergency (panic button)
CREATE POLICY "users_trigger_emergencies" ON emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (community_id = (SELECT get_current_community_id()));

-- Guards and admins can update emergency status
CREATE POLICY "staff_update_emergencies" ON emergency_alerts FOR UPDATE TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- Emergency responders RLS
CREATE POLICY "super_admin_all_responders" ON emergency_responders FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "users_view_responders" ON emergency_responders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM emergency_alerts ea
    WHERE ea.id = emergency_responders.emergency_alert_id
    AND ea.community_id = (SELECT get_current_community_id())
  ));

CREATE POLICY "staff_manage_responders" ON emergency_responders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM emergency_alerts ea
      WHERE ea.id = emergency_responders.emergency_alert_id
      AND ea.community_id = (SELECT get_current_community_id())
      AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM emergency_alerts ea
      WHERE ea.id = emergency_responders.emergency_alert_id
      AND ea.community_id = (SELECT get_current_community_id())
      AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE emergency_alerts IS 'Emergency incidents with state machine workflow and SLA tracking';
COMMENT ON TABLE emergency_responders IS 'Guards assigned to respond to emergencies with individual timing';
COMMENT ON COLUMN emergency_alerts.status IS 'State machine: triggered -> acknowledged -> responding -> on_scene -> resolved/false_alarm/escalated';
COMMENT ON FUNCTION set_emergency_priority IS 'Auto-sets priority based on emergency type: panic/fire/disaster=critical, medical=urgent, intrusion=high';
COMMENT ON FUNCTION update_emergency_timeline IS 'Updates alert timestamps when responders update their status';
COMMENT ON FUNCTION get_emergency_sla_metrics IS 'Returns SLA intervals for reporting (time to acknowledge, respond, arrive, resolve)';
