-- ============================================================================
-- CHAT ENUMS (IDEMPOTENT)
-- Conversation types and participant roles for UPOE messaging system
-- Uses DO blocks for IF NOT EXISTS pattern since CREATE TYPE doesn't support it
-- ============================================================================

-- ============================================================================
-- CONVERSATION TYPE ENUM
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type') THEN
    CREATE TYPE conversation_type AS ENUM (
      'direct',      -- 1:1 private conversation between two users
      'group',       -- Multi-user conversation with a name/topic
      'guard_booth', -- Resident <-> Guard per shift at a gate
      'support'      -- Resident <-> Admin/Management for help requests
    );
  END IF;
END
$$;

COMMENT ON TYPE conversation_type IS 'Types of conversations in the chat system';

-- ============================================================================
-- PARTICIPANT ROLE ENUM
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_role') THEN
    CREATE TYPE participant_role AS ENUM (
      'owner',  -- Created the conversation, full control
      'admin',  -- Can add/remove members in group conversations
      'member', -- Regular participant
      'guard'   -- Guard role in guard_booth conversations
    );
  END IF;
END
$$;

COMMENT ON TYPE participant_role IS 'Roles for conversation participants determining permissions';
