-- ============================================================================
-- MESSAGES, READ RECEIPTS, AND REACTIONS TABLES
-- Core messaging infrastructure for UPOE real-time chat
-- ============================================================================

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  content TEXT,                -- NULL for media-only messages

  -- Media attachments
  media_urls TEXT[],           -- Array of storage URLs
  media_types TEXT[],          -- MIME types for each media

  -- Reply reference (threaded replies)
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Message type
  message_type TEXT NOT NULL DEFAULT 'text',  -- 'text', 'image', 'file', 'audio', 'video', 'system'

  -- System message data (for type='system')
  system_data JSONB,  -- e.g., {"action": "user_joined", "user_name": "Juan Garcia"}

  -- Edit tracking
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  original_content TEXT,       -- Preserved on first edit

  -- Soft delete (shows "This message was deleted")
  is_deleted BOOLEAN NOT NULL DEFAULT false,

  -- Timestamp only (no updated_at - edits tracked separately)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- MESSAGE_READ_RECEIPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT message_read_receipts_unique UNIQUE (message_id, user_id)
);

-- ============================================================================
-- MESSAGE_REACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  reaction TEXT NOT NULL,      -- Emoji code: 'thumbs_up', 'heart', 'laugh', etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One reaction per user per reaction type per message
  CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, reaction)
);

-- ============================================================================
-- QUICK_RESPONSES TABLE (for guards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quick_responses (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Content
  title TEXT NOT NULL,         -- Display name: 'Visitor Arrived'
  content TEXT NOT NULL,       -- Message to send

  -- Categorization
  category TEXT,               -- 'greeting', 'visitor', 'delivery', 'emergency', 'other'

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Messages: conversation history ordered by time
CREATE INDEX IF NOT EXISTS idx_messages_conversation_history
  ON messages(conversation_id, created_at);

-- Messages: non-deleted messages only
CREATE INDEX IF NOT EXISTS idx_messages_conversation_active
  ON messages(conversation_id, is_deleted, created_at)
  WHERE is_deleted = false;

-- Messages: replies lookup
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- Read receipts: by message for counting
CREATE INDEX IF NOT EXISTS idx_read_receipts_message
  ON message_read_receipts(message_id);

-- Reactions: by message for aggregation
CREATE INDEX IF NOT EXISTS idx_reactions_message
  ON message_reactions(message_id);

-- Quick responses: community list
CREATE INDEX IF NOT EXISTS idx_quick_responses_community
  ON quick_responses(community_id, is_active, sort_order)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- TRIGGER: UPDATE CONVERSATION ON MESSAGE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update conversation stats
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(COALESCE(NEW.content, '[Media]'), 100),
      message_count = message_count + 1,
      updated_at = now()
  WHERE id = NEW.conversation_id;

  -- Increment unread count for all participants except sender
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_conversation_stats_trigger ON messages;
CREATE TRIGGER message_conversation_stats_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- FUNCTION: MARK MESSAGES READ
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_messages_read(
  p_conversation_id UUID,
  p_user_id UUID,
  p_up_to_message_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_created_at TIMESTAMPTZ;
  v_inserted_count INTEGER;
BEGIN
  -- Get the timestamp of the message being read up to
  SELECT created_at INTO v_message_created_at
  FROM messages
  WHERE id = p_up_to_message_id;

  IF v_message_created_at IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Insert read receipts for all unread messages up to this one
  WITH inserted AS (
    INSERT INTO message_read_receipts (message_id, user_id)
    SELECT m.id, p_user_id
    FROM messages m
    WHERE m.conversation_id = p_conversation_id
      AND m.created_at <= v_message_created_at
      AND m.sender_id != p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM message_read_receipts mrr
        WHERE mrr.message_id = m.id AND mrr.user_id = p_user_id
      )
    ON CONFLICT (message_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_count FROM inserted;

  -- Update participant's last read and reset unread count
  UPDATE conversation_participants
  SET last_read_message_id = p_up_to_message_id,
      last_read_at = now(),
      unread_count = 0
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;

  RETURN v_inserted_count;
END;
$$;

COMMENT ON FUNCTION mark_messages_read IS
  'Marks all messages up to a specified message as read for a user. Resets unread count.';

-- ============================================================================
-- FUNCTION: EDIT MESSAGE
-- ============================================================================
CREATE OR REPLACE FUNCTION edit_message(
  p_message_id UUID,
  p_new_content TEXT
)
RETURNS messages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
BEGIN
  -- Get the message and validate ownership
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;

  IF v_message IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF v_message.sender_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot edit message you did not send';
  END IF;

  IF v_message.is_deleted THEN
    RAISE EXCEPTION 'Cannot edit deleted message';
  END IF;

  -- Preserve original content on first edit
  IF NOT v_message.is_edited THEN
    UPDATE messages
    SET content = p_new_content,
        original_content = v_message.content,
        is_edited = true,
        edited_at = now()
    WHERE id = p_message_id
    RETURNING * INTO v_message;
  ELSE
    UPDATE messages
    SET content = p_new_content,
        edited_at = now()
    WHERE id = p_message_id
    RETURNING * INTO v_message;
  END IF;

  RETURN v_message;
END;
$$;

COMMENT ON FUNCTION edit_message IS
  'Edits a message. Preserves original content on first edit. Only sender can edit.';

-- ============================================================================
-- FUNCTION: DELETE MESSAGE
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_is_admin BOOLEAN;
BEGIN
  -- Get the message
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;

  IF v_message IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Check if user is sender or conversation admin
  v_is_admin := EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = v_message.conversation_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND left_at IS NULL
  );

  IF v_message.sender_id != auth.uid() AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Cannot delete message: not sender or admin';
  END IF;

  -- Soft delete: clear content but keep structure
  UPDATE messages
  SET is_deleted = true,
      content = NULL,
      media_urls = NULL,
      media_types = NULL
  WHERE id = p_message_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION delete_message IS
  'Soft deletes a message. Clears content but keeps record. Sender or admin can delete.';

-- ============================================================================
-- AUDIT TRIGGER FOR QUICK RESPONSES
-- ============================================================================
DROP TRIGGER IF EXISTS quick_responses_audit_trigger ON quick_responses;
CREATE TRIGGER quick_responses_audit_trigger
  BEFORE INSERT OR UPDATE ON quick_responses
  FOR EACH ROW EXECUTE FUNCTION set_audit_fields();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_responses ENABLE ROW LEVEL SECURITY;

-- Messages: Participants can view conversation messages
CREATE POLICY messages_select_participants ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.left_at IS NULL
    )
  );

-- Messages: Platform admins can see all
CREATE POLICY messages_select_super_admin ON messages
  FOR SELECT
  USING (
    (SELECT is_super_admin())
  );

-- Messages: Participants can send messages
CREATE POLICY messages_insert_participants ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.left_at IS NULL
    )
  );

-- Read receipts: Participants can view
CREATE POLICY read_receipts_select ON message_read_receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_read_receipts.message_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.left_at IS NULL
    )
  );

-- Read receipts: Users can insert their own
CREATE POLICY read_receipts_insert ON message_read_receipts
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- Reactions: Participants can view
CREATE POLICY reactions_select ON message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.left_at IS NULL
    )
  );

-- Reactions: Users can insert their own
CREATE POLICY reactions_insert ON message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND cp.user_id = (SELECT auth.uid())
        AND cp.left_at IS NULL
    )
  );

-- Reactions: Users can delete their own
CREATE POLICY reactions_delete ON message_reactions
  FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
  );

-- Quick responses: Community users can view
CREATE POLICY quick_responses_select ON quick_responses
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND is_active = true
    AND deleted_at IS NULL
  );

-- Quick responses: Platform admins can see all
CREATE POLICY quick_responses_select_super_admin ON quick_responses
  FOR SELECT
  USING (
    (SELECT is_super_admin())
  );

-- Quick responses: Admins can manage
CREATE POLICY quick_responses_manage ON quick_responses
  FOR ALL
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE messages IS
  'Chat messages with text, media, replies, and edit/delete tracking';

COMMENT ON TABLE message_read_receipts IS
  'Per-user read tracking for messages. Used for read status indicators.';

COMMENT ON TABLE message_reactions IS
  'Emoji reactions on messages. One reaction type per user per message.';

COMMENT ON TABLE quick_responses IS
  'Canned responses for guards to quickly send common messages';

COMMENT ON COLUMN messages.message_type IS
  'Type of message: text, image, file, audio, video, or system';

COMMENT ON COLUMN messages.system_data IS
  'JSON data for system messages, e.g., {"action": "user_joined", "user_name": "Juan"}';

COMMENT ON COLUMN messages.original_content IS
  'Original content preserved on first edit for audit purposes';
