-- ============================================================================
-- CONVERSATIONS AND PARTICIPANTS TABLES
-- Core conversation infrastructure for UPOE real-time chat
-- ============================================================================

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Conversation type determines behavior and participant patterns
  conversation_type conversation_type NOT NULL,

  -- Metadata for display
  name TEXT,                 -- For group chats; NULL for direct conversations
  description TEXT,          -- Optional description for group chats
  avatar_url TEXT,           -- Group avatar or conversation image

  -- Guard booth specific fields
  access_point_id UUID REFERENCES access_points(id) ON DELETE SET NULL,
  shift_date DATE,           -- Active date for guard_booth

  -- Status
  is_archived BOOLEAN NOT NULL DEFAULT false,

  -- Denormalized counts for efficient queries
  participant_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,

  -- Last activity for conversation list ordering
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,   -- First 100 chars of last message

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Add constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_guard_booth_check'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_guard_booth_check CHECK (
      (conversation_type = 'guard_booth' AND access_point_id IS NOT NULL AND shift_date IS NOT NULL)
      OR conversation_type != 'guard_booth'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_group_name_check'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_group_name_check CHECK (
      (conversation_type = 'group' AND name IS NOT NULL)
      OR conversation_type != 'group'
    );
  END IF;
END
$$;

-- ============================================================================
-- CONVERSATION_PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role in conversation
  role participant_role NOT NULL DEFAULT 'member',

  -- Membership status
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,

  -- Notification settings
  is_muted BOOLEAN NOT NULL DEFAULT false,
  muted_until TIMESTAMPTZ,

  -- Read tracking
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0
);

-- Add unique constraint if doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_unique'
  ) THEN
    ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_unique
      UNIQUE (conversation_id, user_id);
  END IF;
END
$$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Conversations: community-scoped conversation list ordered by activity
CREATE INDEX IF NOT EXISTS idx_conversations_community_list
  ON conversations(community_id, is_archived, last_message_at DESC)
  WHERE deleted_at IS NULL;

-- Conversations: guard booth lookup by gate + date
CREATE INDEX IF NOT EXISTS idx_conversations_guard_booth
  ON conversations(access_point_id, shift_date)
  WHERE conversation_type = 'guard_booth' AND deleted_at IS NULL;

-- Participants: user's active conversations
CREATE INDEX IF NOT EXISTS idx_participants_user_active
  ON conversation_participants(user_id, left_at)
  WHERE left_at IS NULL;

-- Participants: conversation's active members
CREATE INDEX IF NOT EXISTS idx_participants_conversation_active
  ON conversation_participants(conversation_id, left_at)
  WHERE left_at IS NULL;

-- Participants: last_read_message lookup
CREATE INDEX IF NOT EXISTS idx_participants_last_read
  ON conversation_participants(conversation_id, last_read_message_id)
  WHERE left_at IS NULL;

-- ============================================================================
-- AUDIT TRIGGER
-- ============================================================================
DROP TRIGGER IF EXISTS conversations_audit_trigger ON conversations;
CREATE TRIGGER conversations_audit_trigger
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

-- ============================================================================
-- UPDATE PARTICIPANT COUNT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_participant_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.left_at IS NULL THEN
      UPDATE conversations
      SET participant_count = participant_count + 1,
          updated_at = now()
      WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
      UPDATE conversations
      SET participant_count = participant_count - 1,
          updated_at = now()
      WHERE id = NEW.conversation_id;
    ELSIF OLD.left_at IS NOT NULL AND NEW.left_at IS NULL THEN
      UPDATE conversations
      SET participant_count = participant_count + 1,
          updated_at = now()
      WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.left_at IS NULL THEN
      UPDATE conversations
      SET participant_count = participant_count - 1,
          updated_at = now()
      WHERE id = OLD.conversation_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS conversation_participant_count_trigger ON conversation_participants;
CREATE TRIGGER conversation_participant_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON conversation_participants
  FOR EACH ROW EXECUTE FUNCTION update_conversation_participant_count();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Find or create a direct conversation between two users
CREATE OR REPLACE FUNCTION find_or_create_direct_conversation(
  p_community_id UUID,
  p_user_id1 UUID,
  p_user_id2 UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  IF p_user_id1 = p_user_id2 THEN
    RAISE EXCEPTION 'Cannot create direct conversation with yourself';
  END IF;

  -- Try to find existing direct conversation between these two users
  SELECT c.id INTO v_conversation_id
  FROM conversations c
  WHERE c.community_id = p_community_id
    AND c.conversation_type = 'direct'
    AND c.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp1
      WHERE cp1.conversation_id = c.id
        AND cp1.user_id = p_user_id1
        AND cp1.left_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = c.id
        AND cp2.user_id = p_user_id2
        AND cp2.left_at IS NULL
    )
    AND (
      SELECT COUNT(*) FROM conversation_participants cp3
      WHERE cp3.conversation_id = c.id AND cp3.left_at IS NULL
    ) = 2
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations (community_id, conversation_type)
  VALUES (p_community_id, 'direct')
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES
    (v_conversation_id, p_user_id1, 'owner'),
    (v_conversation_id, p_user_id2, 'member');

  RETURN v_conversation_id;
END;
$$;

COMMENT ON FUNCTION find_or_create_direct_conversation IS
  'Finds existing or creates new 1:1 direct conversation between two users';

-- Get or create guard booth conversation for a gate + date
CREATE OR REPLACE FUNCTION get_or_create_guard_booth(
  p_community_id UUID,
  p_access_point_id UUID,
  p_shift_date DATE,
  p_guard_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_access_point_name TEXT;
BEGIN
  SELECT name INTO v_access_point_name
  FROM access_points
  WHERE id = p_access_point_id AND community_id = p_community_id;

  IF v_access_point_name IS NULL THEN
    RAISE EXCEPTION 'Access point not found or not in this community';
  END IF;

  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE community_id = p_community_id
    AND conversation_type = 'guard_booth'
    AND access_point_id = p_access_point_id
    AND shift_date = p_shift_date
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, p_guard_id, 'guard')
    ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET left_at = NULL, role = 'guard';

    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations (
    community_id,
    conversation_type,
    name,
    access_point_id,
    shift_date
  )
  VALUES (
    p_community_id,
    'guard_booth',
    v_access_point_name || ' - ' || p_shift_date::TEXT,
    p_access_point_id,
    p_shift_date
  )
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, user_id, role)
  VALUES (v_conversation_id, p_guard_id, 'guard');

  RETURN v_conversation_id;
END;
$$;

COMMENT ON FUNCTION get_or_create_guard_booth IS
  'Gets existing or creates new guard booth conversation for an access point and date';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS conversations_select_participants ON conversations;
DROP POLICY IF EXISTS conversations_select_super_admin ON conversations;
DROP POLICY IF EXISTS conversations_insert_community ON conversations;
DROP POLICY IF EXISTS conversations_update_admin ON conversations;
DROP POLICY IF EXISTS participants_select_members ON conversation_participants;
DROP POLICY IF EXISTS participants_select_super_admin ON conversation_participants;
DROP POLICY IF EXISTS participants_insert_admin ON conversation_participants;
DROP POLICY IF EXISTS participants_update_self ON conversation_participants;
DROP POLICY IF EXISTS participants_delete_admin ON conversation_participants;

-- Conversations: Users can view conversations they participate in
CREATE POLICY conversations_select_participants ON conversations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.left_at IS NULL
    )
  );

-- Conversations: Platform admins can see all
CREATE POLICY conversations_select_super_admin ON conversations
  FOR SELECT
  USING (
    (SELECT is_super_admin())
  );

-- Conversations: Users can create conversations in their community
CREATE POLICY conversations_insert_community ON conversations
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
  );

-- Conversations: Owners/admins can update their conversations
CREATE POLICY conversations_update_admin ON conversations
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.role IN ('owner', 'admin')
        AND cp.left_at IS NULL
    )
  );

-- Participants: Users can view participants of their conversations
CREATE POLICY participants_select_members ON conversation_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.left_at IS NULL
    )
  );

-- Participants: Platform admins can see all
CREATE POLICY participants_select_super_admin ON conversation_participants
  FOR SELECT
  USING (
    (SELECT is_super_admin())
  );

-- Participants: Owners/admins can add participants
CREATE POLICY participants_insert_admin ON conversation_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.role IN ('owner', 'admin')
        AND cp.left_at IS NULL
    )
    OR (
      conversation_participants.user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_participants.conversation_id
          AND c.conversation_type = 'guard_booth'
          AND c.community_id = (SELECT get_current_community_id())
          AND c.deleted_at IS NULL
      )
    )
  );

-- Participants: Users can update their own participation (mute, etc.)
CREATE POLICY participants_update_self ON conversation_participants
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
  );

-- Participants: Owners/admins can remove participants; users can remove themselves
CREATE POLICY participants_delete_admin ON conversation_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.role IN ('owner', 'admin')
        AND cp.left_at IS NULL
    )
    OR user_id = (SELECT auth.uid())
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE conversations IS
  'Chat conversations supporting direct, group, guard_booth, and support types';

COMMENT ON TABLE conversation_participants IS
  'Participants in chat conversations with roles, mute settings, and read tracking';

COMMENT ON COLUMN conversations.participant_count IS
  'Denormalized count of active participants, updated by trigger';

COMMENT ON COLUMN conversations.message_count IS
  'Denormalized count of total messages, updated by trigger on messages table';

COMMENT ON COLUMN conversations.last_message_preview IS
  'First 100 characters of last message for conversation list display';

COMMENT ON COLUMN conversation_participants.unread_count IS
  'Number of unread messages for this participant, updated by trigger on messages';
