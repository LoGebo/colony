-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================
-- Purpose: Store per-user notification preferences with per-type settings.
-- Supports Do-Not-Disturb time windows and email digest configuration.
--
-- JSONB preferences schema:
-- {
--   "ticket_assigned": { "enabled": true, "channels": ["push", "email"] },
--   "new_message": { "enabled": true, "channels": ["push"], "sound": "message.wav" },
--   "payment_due": { "enabled": false },
--   "emergency_alert": { "enabled": true, "channels": ["push", "sms", "in_app"] }
-- }
-- ============================================================================

-- ============================================================================
-- NOTIFICATION_PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

    -- User ownership (one preferences record per user)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Do-Not-Disturb settings
    do_not_disturb BOOLEAN NOT NULL DEFAULT FALSE,
    dnd_start_time TIME,              -- e.g., '22:00' (10 PM)
    dnd_end_time TIME,                -- e.g., '08:00' (8 AM next day)

    -- Per-type notification preferences (JSONB)
    preferences JSONB NOT NULL DEFAULT '{}',

    -- Default channels when type not specified in preferences
    default_channels notification_channel[] NOT NULL DEFAULT ARRAY['push'::notification_channel, 'in_app'::notification_channel],

    -- Email digest settings
    email_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_digest_frequency TEXT NOT NULL DEFAULT 'daily',  -- 'daily', 'weekly'
    email_digest_time TIME NOT NULL DEFAULT '09:00',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT notification_preferences_user_unique UNIQUE (user_id),
    CONSTRAINT notification_preferences_digest_frequency_valid CHECK (
        email_digest_frequency IN ('daily', 'weekly')
    ),
    CONSTRAINT notification_preferences_dnd_valid CHECK (
        (do_not_disturb = FALSE) OR
        (do_not_disturb = TRUE AND dnd_start_time IS NOT NULL AND dnd_end_time IS NOT NULL)
    )
);

-- Comments
COMMENT ON TABLE notification_preferences IS
    'Per-user notification preferences with type-specific settings and Do-Not-Disturb support.';

COMMENT ON COLUMN notification_preferences.preferences IS
    'JSONB object with per-type settings. Schema: { "type": { "enabled": bool, "channels": [], "sound": "" } }';

COMMENT ON COLUMN notification_preferences.dnd_start_time IS
    'Do-Not-Disturb start time. During DND, only in_app notifications are delivered (except emergency_alert which bypasses DND).';

COMMENT ON COLUMN notification_preferences.default_channels IS
    'Default delivery channels when a notification type is not specified in preferences JSONB.';


-- ============================================================================
-- INDEXES
-- ============================================================================

-- GIN index for JSONB queries (e.g., find users with ticket_assigned enabled)
CREATE INDEX IF NOT EXISTS idx_notification_preferences_jsonb
    ON notification_preferences USING GIN (preferences);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated at trigger
CREATE TRIGGER notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY notification_preferences_select_own ON notification_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY notification_preferences_insert_own ON notification_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY notification_preferences_update_own ON notification_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY notification_preferences_delete_own ON notification_preferences
    FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Ensure notification preferences exist for a user (create if not exists)
CREATE OR REPLACE FUNCTION ensure_notification_preferences(
    p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pref_id UUID;
BEGIN
    -- Try to get existing
    SELECT id INTO v_pref_id
    FROM notification_preferences
    WHERE user_id = p_user_id;

    -- Create if not exists
    IF v_pref_id IS NULL THEN
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING id INTO v_pref_id;
    END IF;

    RETURN v_pref_id;
END;
$$;

COMMENT ON FUNCTION ensure_notification_preferences IS
    'Ensure notification preferences record exists for a user. Creates default if not exists.';


-- Get notification channels for a specific type and user
CREATE OR REPLACE FUNCTION get_notification_channels(
    p_user_id UUID,
    p_notification_type notification_type
)
RETURNS notification_channel[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefs RECORD;
    v_type_prefs JSONB;
    v_enabled BOOLEAN;
    v_channels notification_channel[];
    v_current_time TIME;
    v_is_dnd_active BOOLEAN := FALSE;
BEGIN
    -- Load user preferences (use defaults if not found)
    SELECT
        do_not_disturb,
        dnd_start_time,
        dnd_end_time,
        preferences,
        default_channels
    INTO v_prefs
    FROM notification_preferences
    WHERE user_id = p_user_id;

    -- If no preferences record, use defaults
    IF NOT FOUND THEN
        v_prefs := ROW(
            FALSE,                                                      -- do_not_disturb
            NULL::TIME,                                                -- dnd_start_time
            NULL::TIME,                                                -- dnd_end_time
            '{}'::JSONB,                                               -- preferences
            ARRAY['push'::notification_channel, 'in_app'::notification_channel]  -- default_channels
        );
    END IF;

    -- Check Do-Not-Disturb (emergency_alert bypasses DND)
    IF v_prefs.do_not_disturb AND p_notification_type != 'emergency_alert' THEN
        v_current_time := LOCALTIME;

        -- Handle overnight DND (e.g., 22:00 to 08:00)
        IF v_prefs.dnd_start_time > v_prefs.dnd_end_time THEN
            -- DND crosses midnight
            v_is_dnd_active := (v_current_time >= v_prefs.dnd_start_time OR v_current_time < v_prefs.dnd_end_time);
        ELSE
            -- DND within same day
            v_is_dnd_active := (v_current_time >= v_prefs.dnd_start_time AND v_current_time < v_prefs.dnd_end_time);
        END IF;

        IF v_is_dnd_active THEN
            -- During DND, only in_app notifications
            RETURN ARRAY['in_app'::notification_channel];
        END IF;
    END IF;

    -- Get type-specific preferences from JSONB
    v_type_prefs := v_prefs.preferences -> p_notification_type::TEXT;

    -- If type not in JSONB, use default channels
    IF v_type_prefs IS NULL THEN
        RETURN v_prefs.default_channels;
    END IF;

    -- Check if enabled (default TRUE if not specified)
    v_enabled := COALESCE((v_type_prefs ->> 'enabled')::BOOLEAN, TRUE);
    IF NOT v_enabled THEN
        -- Disabled = no notifications
        RETURN ARRAY[]::notification_channel[];
    END IF;

    -- Get channels from type-specific preferences (or use defaults)
    IF v_type_prefs ? 'channels' THEN
        SELECT array_agg(channel::notification_channel)
        INTO v_channels
        FROM jsonb_array_elements_text(v_type_prefs -> 'channels') AS channel;

        RETURN COALESCE(v_channels, ARRAY[]::notification_channel[]);
    ELSE
        RETURN v_prefs.default_channels;
    END IF;
END;
$$;

COMMENT ON FUNCTION get_notification_channels IS
    'Get notification channels for a user and type. Respects DND (except emergency_alert) and per-type settings.';


-- Update notification preferences for a specific type
CREATE OR REPLACE FUNCTION update_notification_preferences(
    p_user_id UUID,
    p_notification_type notification_type,
    p_enabled BOOLEAN,
    p_channels notification_channel[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pref_id UUID;
    v_new_prefs JSONB;
BEGIN
    -- Ensure preferences exist
    v_pref_id := ensure_notification_preferences(p_user_id);

    -- Build new type preferences
    v_new_prefs := jsonb_build_object(
        'enabled', p_enabled,
        'channels', to_jsonb(p_channels)
    );

    -- Update JSONB with surgical insert/update
    UPDATE notification_preferences
    SET preferences = preferences || jsonb_build_object(p_notification_type::TEXT, v_new_prefs)
    WHERE id = v_pref_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION update_notification_preferences IS
    'Update notification preferences for a specific type. Creates preferences record if not exists.';


-- Set Do-Not-Disturb settings
CREATE OR REPLACE FUNCTION set_dnd(
    p_user_id UUID,
    p_enabled BOOLEAN,
    p_start_time TIME DEFAULT NULL,
    p_end_time TIME DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pref_id UUID;
BEGIN
    -- Validate DND settings
    IF p_enabled AND (p_start_time IS NULL OR p_end_time IS NULL) THEN
        RAISE EXCEPTION 'DND start and end times required when enabling DND';
    END IF;

    -- Ensure preferences exist
    v_pref_id := ensure_notification_preferences(p_user_id);

    -- Update DND settings
    UPDATE notification_preferences
    SET
        do_not_disturb = p_enabled,
        dnd_start_time = CASE WHEN p_enabled THEN p_start_time ELSE NULL END,
        dnd_end_time = CASE WHEN p_enabled THEN p_end_time ELSE NULL END
    WHERE id = v_pref_id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION set_dnd IS
    'Set Do-Not-Disturb settings for a user. Start/end times required when enabling.';
