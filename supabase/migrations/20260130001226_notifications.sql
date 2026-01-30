-- ============================================================================
-- NOTIFICATIONS, DELIVERIES, AND TEMPLATES TABLES
-- ============================================================================
-- Purpose: Multi-channel notification delivery system with template support.
--
-- Tables:
-- - notifications: Main notification records with user targeting
-- - notification_deliveries: Per-channel delivery status tracking
-- - notification_templates: Customizable message templates with variable substitution
--
-- Flow:
-- 1. create_notification() looks up user preferences and templates
-- 2. Renders title/body from template with variables
-- 3. Creates notification record
-- 4. Creates delivery records for each requested channel
-- 5. Fires pg_notify for Edge Function pickup
-- ============================================================================

-- ============================================================================
-- NOTIFICATION_TEMPLATES TABLE
-- ============================================================================
-- Templates are looked up by: (community_id, notification_type, channel, locale)
-- NULL community_id = system-wide default templates

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

    -- Community scoping (NULL = system default)
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

    -- Template identification
    notification_type notification_type NOT NULL,
    channel notification_channel NOT NULL,
    locale TEXT NOT NULL DEFAULT 'es-MX',

    -- Template content
    title_template TEXT NOT NULL,       -- Supports {{variable}} placeholders
    body_template TEXT NOT NULL,        -- Supports {{variable}} placeholders

    -- Channel-specific options
    options JSONB NOT NULL DEFAULT '{}',  -- {"sound": "default", "badge": true, "priority": "high"}

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT notification_templates_unique UNIQUE (community_id, notification_type, channel, locale)
);

-- Comments
COMMENT ON TABLE notification_templates IS
    'Customizable notification message templates with variable substitution. NULL community_id = system defaults.';

COMMENT ON COLUMN notification_templates.title_template IS
    'Template for notification title. Use {{variable}} for substitution, e.g., "Nuevo ticket #{{ticket_number}}"';

COMMENT ON COLUMN notification_templates.body_template IS
    'Template for notification body. Use {{variable}} for substitution.';

COMMENT ON COLUMN notification_templates.options IS
    'Channel-specific options. Push: {sound, badge, priority}. Email: {from_name}. SMS: {sender_id}.';


-- Updated at trigger
CREATE TRIGGER notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

    -- Scoping
    community_id UUID REFERENCES communities(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Notification type and content
    notification_type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,

    -- Action handling (what happens when user taps notification)
    action_type TEXT,                   -- 'open_ticket', 'open_conversation', 'open_document', 'open_payment'
    action_data JSONB,                  -- {"ticket_id": "uuid", "conversation_id": "uuid"}

    -- Source tracking (what triggered this notification)
    source_type TEXT,                   -- 'ticket', 'message', 'document', 'payment', 'announcement'
    source_id UUID,

    -- Channel tracking
    channels_requested notification_channel[] NOT NULL,
    channels_delivered notification_channel[] NOT NULL DEFAULT ARRAY[]::notification_channel[],

    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    -- Scheduling
    scheduled_for TIMESTAMPTZ,          -- NULL = immediate delivery

    -- Lifecycle
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ              -- For auto-cleanup of old notifications
);

-- Comments
COMMENT ON TABLE notifications IS
    'User notifications with multi-channel delivery tracking. Each record represents one notification to one user.';

COMMENT ON COLUMN notifications.action_type IS
    'Deep link action when user taps notification. App routes to appropriate screen.';

COMMENT ON COLUMN notifications.action_data IS
    'Parameters for action_type. Contains IDs needed to open the target screen.';

COMMENT ON COLUMN notifications.channels_delivered IS
    'Array of channels that successfully delivered. Updated by record_delivery_status().';


-- ============================================================================
-- NOTIFICATION_DELIVERIES TABLE
-- ============================================================================
-- Tracks per-channel delivery status for retry logic and analytics

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

    -- Parent notification
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,

    -- Channel and status
    channel notification_channel NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'delivered', 'failed', 'bounced'

    -- Retry tracking
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_attempted_at TIMESTAMPTZ,
    last_attempted_at TIMESTAMPTZ,

    -- Success tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,           -- Confirmed delivery (if available from provider)

    -- Failure tracking
    failure_reason TEXT,

    -- Provider tracking
    provider_message_id TEXT,           -- FCM message ID, SES message ID, etc.

    -- Constraints
    CONSTRAINT notification_deliveries_unique UNIQUE (notification_id, channel),
    CONSTRAINT notification_deliveries_status_valid CHECK (
        status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')
    )
);

-- Comments
COMMENT ON TABLE notification_deliveries IS
    'Per-channel delivery status tracking. One record per channel per notification.';

COMMENT ON COLUMN notification_deliveries.provider_message_id IS
    'Message ID from delivery provider. Used for tracking delivery callbacks.';


-- ============================================================================
-- INDEXES
-- ============================================================================

-- Notifications: User's unread list (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC)
    WHERE is_read = FALSE;

-- Notifications: Community analytics
CREATE INDEX IF NOT EXISTS idx_notifications_community_type
    ON notifications(community_id, notification_type);

-- Notifications: Scheduled delivery queue
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled
    ON notifications(scheduled_for)
    WHERE scheduled_for IS NOT NULL;

-- Notification deliveries: Pending queue for workers
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending
    ON notification_deliveries(status, notification_id)
    WHERE status = 'pending';

-- Templates: Lookup by type/channel/locale
CREATE INDEX IF NOT EXISTS idx_notification_templates_lookup
    ON notification_templates(notification_type, channel, locale)
    WHERE is_active = TRUE;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can view their own
CREATE POLICY notifications_select_own ON notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Notification deliveries: Users can view their own notifications' deliveries
CREATE POLICY notification_deliveries_select_own ON notification_deliveries
    FOR SELECT
    USING (
        notification_id IN (
            SELECT id FROM notifications WHERE user_id = auth.uid()
        )
    );

-- Templates: All authenticated users can view active templates
CREATE POLICY notification_templates_select ON notification_templates
    FOR SELECT
    USING (is_active = TRUE);

-- Templates: Community admins can manage their community's templates
-- (TODO: Integrate with community_members role check once available)
CREATE POLICY notification_templates_admin ON notification_templates
    FOR ALL
    USING (TRUE)  -- Will be refined with proper role check
    WITH CHECK (TRUE);


-- ============================================================================
-- DEFAULT SPANISH TEMPLATES
-- ============================================================================
-- System-wide defaults (community_id = NULL)

INSERT INTO notification_templates (community_id, notification_type, channel, locale, title_template, body_template, options)
VALUES
    -- Ticket notifications
    (NULL, 'ticket_created', 'push', 'es-MX',
     'Nuevo ticket #{{ticket_number}}',
     '{{reporter_name}} reporto: {{ticket_title}}',
     '{"sound": "default", "badge": true}'),

    (NULL, 'ticket_assigned', 'push', 'es-MX',
     'Ticket asignado',
     'Se te asigno el ticket #{{ticket_number}}: {{ticket_title}}',
     '{"sound": "default", "badge": true}'),

    (NULL, 'ticket_status_changed', 'push', 'es-MX',
     'Ticket actualizado',
     'El ticket #{{ticket_number}} cambio a {{new_status}}',
     '{"sound": "default"}'),

    (NULL, 'ticket_comment_added', 'push', 'es-MX',
     'Nuevo comentario',
     '{{commenter_name}} comento en ticket #{{ticket_number}}',
     '{"sound": "default"}'),

    (NULL, 'sla_warning', 'push', 'es-MX',
     'SLA proximo a vencer',
     'El ticket #{{ticket_number}} tiene {{time_remaining}} para {{breach_type}}',
     '{"sound": "alert", "priority": "high"}'),

    (NULL, 'sla_breach', 'push', 'es-MX',
     'SLA Vencido',
     'El ticket #{{ticket_number}} excedio su tiempo de {{breach_type}}',
     '{"sound": "alert", "priority": "high"}'),

    -- Chat notifications
    (NULL, 'new_message', 'push', 'es-MX',
     'Nuevo mensaje',
     '{{sender_name}}: {{message_preview}}',
     '{"sound": "message", "badge": true}'),

    (NULL, 'message_reaction', 'push', 'es-MX',
     'Reaccion a tu mensaje',
     '{{reactor_name}} reacciono {{emoji}} a tu mensaje',
     '{"sound": "default"}'),

    (NULL, 'conversation_mention', 'push', 'es-MX',
     'Te mencionaron',
     '{{mentioner_name}} te menciono en {{conversation_name}}',
     '{"sound": "message", "badge": true}'),

    -- Document notifications
    (NULL, 'document_published', 'push', 'es-MX',
     'Nuevo documento',
     'Se publico: {{document_name}}',
     '{"sound": "default"}'),

    (NULL, 'signature_required', 'push', 'es-MX',
     'Firma requerida',
     'El documento {{document_name}} requiere tu firma',
     '{"sound": "default", "badge": true}'),

    (NULL, 'signature_reminder', 'push', 'es-MX',
     'Recordatorio de firma',
     'Tienes {{days_remaining}} dias para firmar {{document_name}}',
     '{"sound": "default"}'),

    -- General notifications
    (NULL, 'announcement', 'push', 'es-MX',
     '{{announcement_title}}',
     '{{announcement_preview}}',
     '{"sound": "default", "badge": true}'),

    (NULL, 'survey_published', 'push', 'es-MX',
     'Nueva encuesta',
     '{{survey_title}} - Tu voto es importante',
     '{"sound": "default", "badge": true}'),

    (NULL, 'payment_due', 'push', 'es-MX',
     'Pago proximo',
     'Tu cuota de {{amount}} vence el {{due_date}}',
     '{"sound": "default"}'),

    (NULL, 'payment_received', 'push', 'es-MX',
     'Pago recibido',
     'Se registro tu pago de {{amount}}. Gracias!',
     '{"sound": "success"}'),

    (NULL, 'visitor_arrived', 'push', 'es-MX',
     'Visita en caseta',
     '{{visitor_name}} llego a visitarte',
     '{"sound": "doorbell", "badge": true}'),

    (NULL, 'package_arrived', 'push', 'es-MX',
     'Paquete recibido',
     'Tienes un paquete de {{carrier}} en caseta',
     '{"sound": "default", "badge": true}'),

    (NULL, 'emergency_alert', 'push', 'es-MX',
     'ALERTA DE EMERGENCIA',
     '{{alert_type}}: {{location}}',
     '{"sound": "emergency", "priority": "critical", "badge": true}')
ON CONFLICT (community_id, notification_type, channel, locale) DO NOTHING;


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Render a notification template with variables
CREATE OR REPLACE FUNCTION render_notification_template(
    p_template_id UUID,
    p_variables JSONB
)
RETURNS TABLE (title TEXT, body TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_title TEXT;
    v_body TEXT;
    v_key TEXT;
    v_value TEXT;
BEGIN
    -- Get template
    SELECT title_template, body_template
    INTO v_title, v_body
    FROM notification_templates
    WHERE id = p_template_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Replace each variable in title and body
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
    LOOP
        v_title := replace(v_title, '{{' || v_key || '}}', COALESCE(v_value, ''));
        v_body := replace(v_body, '{{' || v_key || '}}', COALESCE(v_value, ''));
    END LOOP;

    RETURN QUERY SELECT v_title, v_body;
END;
$$;

COMMENT ON FUNCTION render_notification_template IS
    'Render a notification template with variable substitution. Replaces {{variable}} placeholders with values from JSONB.';


-- Create a notification with automatic preference lookup and template rendering
CREATE OR REPLACE FUNCTION create_notification(
    p_community_id UUID,
    p_user_id UUID,
    p_notification_type notification_type,
    p_variables JSONB,
    p_source_type TEXT DEFAULT NULL,
    p_source_id UUID DEFAULT NULL,
    p_action_type TEXT DEFAULT NULL,
    p_action_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_channels notification_channel[];
    v_template_id UUID;
    v_title TEXT;
    v_body TEXT;
    v_notification_id UUID;
    v_channel notification_channel;
BEGIN
    -- Get user's preferred channels for this notification type
    v_channels := get_notification_channels(p_user_id, p_notification_type);

    -- If no channels (disabled), return NULL
    IF array_length(v_channels, 1) IS NULL OR array_length(v_channels, 1) = 0 THEN
        RETURN NULL;
    END IF;

    -- Find template (community-specific first, then system default)
    SELECT id INTO v_template_id
    FROM notification_templates
    WHERE notification_type = p_notification_type
      AND channel = 'push'  -- Use push template as primary for title/body
      AND locale = 'es-MX'
      AND is_active = TRUE
      AND (community_id = p_community_id OR community_id IS NULL)
    ORDER BY community_id NULLS LAST  -- Prefer community-specific
    LIMIT 1;

    -- Render template (or use fallback)
    IF v_template_id IS NOT NULL THEN
        SELECT title, body INTO v_title, v_body
        FROM render_notification_template(v_template_id, p_variables);
    ELSE
        -- Fallback if no template found
        v_title := p_notification_type::TEXT;
        v_body := COALESCE(p_variables ->> 'message', 'New notification');
    END IF;

    -- Create notification record
    INSERT INTO notifications (
        community_id,
        user_id,
        notification_type,
        title,
        body,
        action_type,
        action_data,
        source_type,
        source_id,
        channels_requested
    )
    VALUES (
        p_community_id,
        p_user_id,
        p_notification_type,
        v_title,
        v_body,
        p_action_type,
        p_action_data,
        p_source_type,
        p_source_id,
        v_channels
    )
    RETURNING id INTO v_notification_id;

    -- Create delivery records for each channel
    FOREACH v_channel IN ARRAY v_channels
    LOOP
        INSERT INTO notification_deliveries (
            notification_id,
            channel,
            status
        )
        VALUES (
            v_notification_id,
            v_channel,
            'pending'
        );
    END LOOP;

    -- Fire pg_notify for Edge Function pickup
    PERFORM pg_notify(
        'notification_created',
        jsonb_build_object(
            'notification_id', v_notification_id,
            'user_id', p_user_id,
            'notification_type', p_notification_type,
            'channels', v_channels
        )::TEXT
    );

    RETURN v_notification_id;
END;
$$;

COMMENT ON FUNCTION create_notification IS
    'Create a notification with automatic preference lookup, template rendering, and pg_notify for async delivery.';


-- Mark a notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE notifications
    SET
        is_read = TRUE,
        read_at = now()
    WHERE id = p_notification_id
      AND user_id = auth.uid()
      AND is_read = FALSE;

    v_updated := FOUND;
    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION mark_notification_read IS
    'Mark a notification as read. Only works for the notification owner.';


-- Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
    p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Security check: only allow marking own notifications
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Cannot mark other users notifications as read';
    END IF;

    UPDATE notifications
    SET
        is_read = TRUE,
        read_at = now()
    WHERE user_id = p_user_id
      AND is_read = FALSE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION mark_all_notifications_read IS
    'Mark all unread notifications as read for the calling user.';


-- Get unread notifications for a user
CREATE OR REPLACE FUNCTION get_unread_notifications(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    notification_type notification_type,
    title TEXT,
    body TEXT,
    action_type TEXT,
    action_data JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security check
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Cannot view other users notifications';
    END IF;

    RETURN QUERY
    SELECT
        n.id,
        n.notification_type,
        n.title,
        n.body,
        n.action_type,
        n.action_data,
        n.created_at
    FROM notifications n
    WHERE n.user_id = p_user_id
      AND n.is_read = FALSE
      AND (n.expires_at IS NULL OR n.expires_at > now())
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_unread_notifications IS
    'Get unread notifications for the calling user, ordered by newest first.';


-- Record delivery status for a notification channel
CREATE OR REPLACE FUNCTION record_delivery_status(
    p_notification_id UUID,
    p_channel notification_channel,
    p_status TEXT,
    p_provider_message_id TEXT DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE notification_deliveries
    SET
        status = p_status,
        attempt_count = attempt_count + 1,
        first_attempted_at = COALESCE(first_attempted_at, now()),
        last_attempted_at = now(),
        sent_at = CASE WHEN p_status IN ('sent', 'delivered') THEN COALESCE(sent_at, now()) ELSE sent_at END,
        delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
        provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
        failure_reason = CASE WHEN p_status IN ('failed', 'bounced') THEN p_failure_reason ELSE NULL END
    WHERE notification_id = p_notification_id
      AND channel = p_channel;

    v_updated := FOUND;

    -- If successful delivery, update parent notification
    IF v_updated AND p_status IN ('sent', 'delivered') THEN
        UPDATE notifications
        SET channels_delivered = array_append(
            channels_delivered,
            p_channel
        )
        WHERE id = p_notification_id
          AND NOT (p_channel = ANY(channels_delivered));
    END IF;

    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION record_delivery_status IS
    'Record delivery status for a notification channel. Updates parent notification on successful delivery.';
