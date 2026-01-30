-- ============================================================================
-- NOTIFICATION ENUMS
-- ============================================================================
-- Purpose: Define notification channel, type, and push platform enumerations
-- for the UPOE notification system supporting FCM/APNs/Web Push delivery.
--
-- Notification channels determine HOW a notification is delivered.
-- Notification types determine WHAT triggered the notification.
-- Push platforms identify the push notification service to use.
-- ============================================================================

-- ============================================================================
-- NOTIFICATION_CHANNEL ENUM
-- ============================================================================
-- The delivery mechanism for notifications.
-- Users can configure preferred channels per notification type.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE notification_channel AS ENUM (
            'push',     -- Mobile push notification via FCM or APNs
            'email',    -- Email delivery (immediate or digest)
            'sms',      -- SMS text message for urgent notifications
            'in_app'    -- In-app notification center (always available)
        );

        COMMENT ON TYPE notification_channel IS
            'Delivery mechanism for notifications. Users configure preferred channels per notification type.';
    END IF;
END$$;


-- ============================================================================
-- NOTIFICATION_TYPE ENUM
-- ============================================================================
-- Categories of notifications based on what triggered them.
-- Each type can have different default channels and priority.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM (
            -- Maintenance/Ticket notifications
            'ticket_created',          -- Trigger: New ticket submitted
            'ticket_assigned',         -- Trigger: Ticket assigned to technician
            'ticket_status_changed',   -- Trigger: Ticket status updated (e.g., in_progress, resolved)
            'ticket_comment_added',    -- Trigger: Comment added to ticket by any party
            'sla_warning',             -- Trigger: SLA approaching breach (75% of time elapsed)
            'sla_breach',              -- Trigger: SLA breached (response or resolution exceeded)

            -- Chat/Messaging notifications
            'new_message',             -- Trigger: New message in conversation
            'message_reaction',        -- Trigger: Someone reacted to your message
            'conversation_mention',    -- Trigger: @mentioned in conversation (future feature)

            -- Document notifications
            'document_published',      -- Trigger: New community document published
            'signature_required',      -- Trigger: Document requires your signature
            'signature_reminder',      -- Trigger: Reminder for pending signature (3 days, 7 days)

            -- General notifications
            'announcement',            -- Trigger: Community announcement posted
            'survey_published',        -- Trigger: New survey/vote available
            'payment_due',             -- Trigger: Upcoming payment due (5 days before)
            'payment_received',        -- Trigger: Payment confirmed
            'visitor_arrived',         -- Trigger: Visitor checked in at gate
            'package_arrived',         -- Trigger: Package received at guardhouse
            'emergency_alert'          -- Trigger: Emergency alert (panic, fire, intrusion)
        );

        COMMENT ON TYPE notification_type IS
            'Categories of notifications. Each type has specific triggers, defaults, and priority levels.';
    END IF;
END$$;


-- ============================================================================
-- PUSH_PLATFORM ENUM
-- ============================================================================
-- The push notification service/platform used for delivery.
-- Determines how the token is used and which API to call.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'push_platform') THEN
        CREATE TYPE push_platform AS ENUM (
            'fcm_android',  -- Firebase Cloud Messaging for Android devices
            'fcm_ios',      -- Firebase Cloud Messaging for iOS devices
            'apns',         -- Apple Push Notification Service direct (for enterprise apps)
            'web_push'      -- Web Push API for PWA/browser notifications
        );

        COMMENT ON TYPE push_platform IS
            'Push notification service platform. Determines API endpoint and payload format.';
    END IF;
END$$;
