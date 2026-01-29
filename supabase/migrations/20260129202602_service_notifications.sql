-- Service notifications for visitor/delivery arrivals and alerts
-- Migration: 20260129202602_service_notifications.sql
--
-- Real-time notification flow:
-- 1. Guard app calls send_service_notification() when visitor arrives
-- 2. Function creates notification records for all unit residents
-- 3. pg_notify() broadcasts to Supabase Realtime channel
-- 4. Resident apps receive push notification via Supabase Realtime subscription

--------------------------------------------------------------------------------
-- SERVICE NOTIFICATION TYPE ENUM
--------------------------------------------------------------------------------

CREATE TYPE notification_type_service AS ENUM (
  'visitor_arrival',     -- Visitor at gate requesting entry
  'delivery_arrival',    -- Package/delivery arrived
  'service_provider',    -- Scheduled service person arrived (plumber, etc.)
  'guest_departure',     -- Guest has left the premises
  'emergency_alert'      -- Forwarded emergency notification
);

COMMENT ON TYPE notification_type_service IS 'Service notification types for guard-to-resident communication';

--------------------------------------------------------------------------------
-- SERVICE_NOTIFICATIONS TABLE
--------------------------------------------------------------------------------

CREATE TABLE service_notifications (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Notification content
  notification_type notification_type_service NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Related entity (visitor, invitation, package, etc.)
  related_entity_type TEXT,           -- 'visitor', 'invitation', 'package'
  related_entity_id UUID,

  -- Delivery tracking
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  delivery_channel TEXT,              -- push, sms, in_app

  -- Read status
  read_at TIMESTAMPTZ,

  -- Action tracking (resident response)
  action_taken TEXT,                  -- allowed, denied, called_back
  action_at TIMESTAMPTZ,

  -- Expiry (notification relevance window)
  expires_at TIMESTAMPTZ,

  -- Audit columns (no deleted_at - archive pattern, notifications are permanent records)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE service_notifications ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_service_notifications_audit
  BEFORE INSERT OR UPDATE ON service_notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_service_notifications_resident_unread
  ON service_notifications(resident_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX idx_service_notifications_unit_sent
  ON service_notifications(unit_id, sent_at DESC);

CREATE INDEX idx_service_notifications_type_sent
  ON service_notifications(notification_type, sent_at DESC);

CREATE INDEX idx_service_notifications_expires
  ON service_notifications(expires_at)
  WHERE expires_at IS NOT NULL AND read_at IS NULL;

--------------------------------------------------------------------------------
-- SEND_SERVICE_NOTIFICATION FUNCTION
--------------------------------------------------------------------------------

-- Creates notifications for all active residents of a unit and broadcasts via pg_notify
CREATE OR REPLACE FUNCTION send_service_notification(
  p_unit_id UUID,
  p_notification_type notification_type_service,
  p_title TEXT,
  p_body TEXT,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_notification_ids UUID[] := ARRAY[]::UUID[];
  v_resident RECORD;
  v_new_id UUID;
  v_payload JSONB;
BEGIN
  -- Get community from unit
  SELECT community_id INTO v_community_id
  FROM units
  WHERE id = p_unit_id AND deleted_at IS NULL;

  IF v_community_id IS NULL THEN
    RAISE EXCEPTION 'Unit not found: %', p_unit_id;
  END IF;

  -- Create notification for each active resident of the unit
  FOR v_resident IN
    SELECT DISTINCT r.id as resident_id
    FROM residents r
    JOIN occupancies o ON o.resident_id = r.id
      AND o.deleted_at IS NULL
      AND o.status = 'active'
    WHERE o.unit_id = p_unit_id
      AND r.deleted_at IS NULL
      AND r.onboarding_status IN ('verified', 'active')
  LOOP
    -- Generate UUID for new notification
    v_new_id := generate_uuid_v7();

    -- Insert notification
    INSERT INTO service_notifications (
      id,
      community_id,
      unit_id,
      resident_id,
      notification_type,
      title,
      body,
      related_entity_type,
      related_entity_id,
      expires_at
    ) VALUES (
      v_new_id,
      v_community_id,
      p_unit_id,
      v_resident.resident_id,
      p_notification_type,
      p_title,
      p_body,
      p_related_entity_type,
      p_related_entity_id,
      p_expires_at
    );

    v_notification_ids := array_append(v_notification_ids, v_new_id);

    -- Broadcast via pg_notify for real-time push
    -- Supabase Realtime can subscribe to this channel
    v_payload := jsonb_build_object(
      'id', v_new_id,
      'resident_id', v_resident.resident_id,
      'unit_id', p_unit_id,
      'notification_type', p_notification_type,
      'title', p_title,
      'body', p_body,
      'sent_at', now()
    );

    PERFORM pg_notify('service_notification', v_payload::TEXT);
  END LOOP;

  RETURN v_notification_ids;
END;
$$;

COMMENT ON FUNCTION send_service_notification(UUID, notification_type_service, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ)
  IS 'Create notification for all unit residents and broadcast via pg_notify for real-time push';

--------------------------------------------------------------------------------
-- MARK_NOTIFICATION_READ FUNCTION
--------------------------------------------------------------------------------

-- Mark a notification as read (only for the authenticated user)
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE service_notifications
  SET read_at = now(),
      updated_at = now()
  WHERE id = p_notification_id
    AND resident_id = auth.uid()
    AND read_at IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION mark_notification_read(UUID) IS 'Mark notification as read for the authenticated user';

--------------------------------------------------------------------------------
-- RECORD_NOTIFICATION_ACTION FUNCTION
--------------------------------------------------------------------------------

-- Record the action taken by resident (allowed, denied, called_back)
CREATE OR REPLACE FUNCTION record_notification_action(
  p_notification_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate action
  IF p_action NOT IN ('allowed', 'denied', 'called_back') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be allowed, denied, or called_back', p_action;
  END IF;

  UPDATE service_notifications
  SET action_taken = p_action,
      action_at = now(),
      read_at = COALESCE(read_at, now()),  -- Also mark as read
      updated_at = now()
  WHERE id = p_notification_id
    AND resident_id = auth.uid();

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION record_notification_action(UUID, TEXT) IS 'Record resident action on notification (allowed, denied, called_back)';

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

-- Super admins full access
CREATE POLICY "super_admins_full_access_service_notifications"
  ON service_notifications
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can view their own notifications
CREATE POLICY "users_view_own_notifications"
  ON service_notifications
  FOR SELECT
  TO authenticated
  USING (resident_id = auth.uid());

-- Guards can create notifications (INSERT only)
CREATE POLICY "guards_create_notifications"
  ON service_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT get_current_user_role()) IN ('guard', 'admin', 'manager')
  );

-- Users can update read_at and action on their own notifications
CREATE POLICY "users_update_own_notifications"
  ON service_notifications
  FOR UPDATE
  TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

-- Admins can view all notifications in their community
CREATE POLICY "admins_view_community_notifications"
  ON service_notifications
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

--------------------------------------------------------------------------------
-- COMMENTS
--------------------------------------------------------------------------------

COMMENT ON TABLE service_notifications IS 'Real-time notifications from guards to residents for arrivals/alerts';
COMMENT ON COLUMN service_notifications.delivery_channel IS 'How notification was delivered: push, sms, in_app';
COMMENT ON COLUMN service_notifications.action_taken IS 'Resident response: allowed (let in), denied (turn away), called_back (will respond)';
COMMENT ON COLUMN service_notifications.expires_at IS 'When notification is no longer relevant (for cleanup jobs)';
