-- ============================================================================
-- CHAT NOTIFICATIONS AND HELPER FUNCTIONS
-- Real-time notifications via pg_notify and helper functions for chat
-- ============================================================================

-- ============================================================================
-- NOTIFY NEW MESSAGE TRIGGER
-- ============================================================================
-- Sends pg_notify for each participant when a new message arrives
-- Supabase Realtime subscribes to these channels for push notifications

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant RECORD;
  v_sender_name TEXT;
  v_conversation_type conversation_type;
  v_preview TEXT;
BEGIN
  -- Skip system messages for now (they have their own notification logic)
  IF NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Get conversation type
  SELECT conversation_type INTO v_conversation_type
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Get sender name (try residents first, then auth.users email)
  SELECT COALESCE(
    (SELECT full_name FROM residents WHERE id = NEW.sender_id),
    (SELECT email FROM auth.users WHERE id = NEW.sender_id),
    'Unknown'
  ) INTO v_sender_name;

  -- Build preview
  v_preview := LEFT(COALESCE(NEW.content, '[Media]'), 100);

  -- Notify each participant (except sender) who is not muted
  FOR v_participant IN
    SELECT cp.user_id
    FROM conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id != NEW.sender_id
      AND cp.left_at IS NULL
      AND cp.is_muted = false
      AND (cp.muted_until IS NULL OR cp.muted_until < now())
  LOOP
    PERFORM pg_notify(
      'new_message',
      json_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'recipient_id', v_participant.user_id,
        'preview', v_preview,
        'conversation_type', v_conversation_type,
        'sender_name', v_sender_name,
        'created_at', NEW.created_at
      )::TEXT
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_message_trigger ON messages;
CREATE TRIGGER notify_new_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();

COMMENT ON FUNCTION notify_new_message IS
  'Sends pg_notify for new messages to non-muted participants. Supabase Realtime subscribes to these.';

-- ============================================================================
-- NOTIFY TYPING FUNCTION (Called via RPC)
-- ============================================================================
-- Client calls this to broadcast typing indicator
-- Typing indicators are ephemeral (via Presence) not persisted

CREATE OR REPLACE FUNCTION notify_typing(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- Validate caller is participant
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  -- Get user name
  SELECT COALESCE(
    (SELECT full_name FROM residents WHERE id = auth.uid()),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'Unknown'
  ) INTO v_user_name;

  -- Broadcast typing indicator
  PERFORM pg_notify(
    'typing',
    json_build_object(
      'conversation_id', p_conversation_id,
      'user_id', auth.uid(),
      'user_name', v_user_name,
      'timestamp', now()
    )::TEXT
  );
END;
$$;

COMMENT ON FUNCTION notify_typing IS
  'Broadcasts typing indicator for a conversation. Called by client via RPC.';

-- ============================================================================
-- GET UNREAD CONVERSATIONS COUNT
-- ============================================================================
-- Returns count of conversations with unread messages for badge display

CREATE OR REPLACE FUNCTION get_unread_conversations_count(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM conversation_participants
  WHERE user_id = v_user_id
    AND left_at IS NULL
    AND unread_count > 0;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_unread_conversations_count IS
  'Returns count of conversations with unread messages for badge display';

-- ============================================================================
-- GET CONVERSATION LIST
-- ============================================================================
-- Returns conversations for a user with unread counts and last message preview

CREATE OR REPLACE FUNCTION get_conversation_list(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  conversation_id UUID,
  conversation_type conversation_type,
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  is_archived BOOLEAN,
  participant_count INTEGER,
  message_count INTEGER,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER,
  is_muted BOOLEAN,
  other_participant_name TEXT,  -- For direct conversations
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    c.conversation_type,
    c.name,
    c.description,
    c.avatar_url,
    c.is_archived,
    c.participant_count,
    c.message_count,
    c.last_message_at,
    c.last_message_preview,
    cp.unread_count,
    cp.is_muted,
    -- For direct conversations, get the other participant's name
    CASE
      WHEN c.conversation_type = 'direct' THEN (
        SELECT COALESCE(r.full_name, u.email, 'Unknown')
        FROM conversation_participants cp2
        LEFT JOIN residents r ON r.id = cp2.user_id
        LEFT JOIN auth.users u ON u.id = cp2.user_id
        WHERE cp2.conversation_id = c.id
          AND cp2.user_id != v_user_id
          AND cp2.left_at IS NULL
        LIMIT 1
      )
      ELSE NULL
    END AS other_participant_name,
    c.created_at
  FROM conversations c
  JOIN conversation_participants cp ON cp.conversation_id = c.id
  WHERE cp.user_id = v_user_id
    AND cp.left_at IS NULL
    AND c.deleted_at IS NULL
  ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_conversation_list IS
  'Returns conversations for a user ordered by last activity with unread counts';

-- ============================================================================
-- SEARCH MESSAGES
-- ============================================================================
-- Full-text search across user's conversations

CREATE OR REPLACE FUNCTION search_messages(
  p_user_id UUID DEFAULT NULL,
  p_query TEXT DEFAULT '',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  conversation_name TEXT,
  conversation_type conversation_type,
  sender_id UUID,
  sender_name TEXT,
  content TEXT,
  content_highlight TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tsquery tsquery;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Convert search query to tsquery
  v_tsquery := plainto_tsquery('spanish', p_query);

  RETURN QUERY
  SELECT
    m.id AS message_id,
    m.conversation_id,
    c.name AS conversation_name,
    c.conversation_type,
    m.sender_id,
    COALESCE(r.full_name, u.email, 'Unknown') AS sender_name,
    m.content,
    ts_headline('spanish', m.content, v_tsquery, 'StartSel=<mark>, StopSel=</mark>') AS content_highlight,
    m.created_at
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
  LEFT JOIN residents r ON r.id = m.sender_id
  LEFT JOIN auth.users u ON u.id = m.sender_id
  WHERE cp.user_id = v_user_id
    AND cp.left_at IS NULL
    AND m.is_deleted = false
    AND m.content IS NOT NULL
    AND to_tsvector('spanish', m.content) @@ v_tsquery
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_messages IS
  'Full-text search across user conversations with Spanish stemming';

-- ============================================================================
-- TEXT SEARCH INDEX
-- ============================================================================
-- Spanish dictionary for Mexican Spanish stemming

CREATE INDEX IF NOT EXISTS idx_messages_content_search
  ON messages USING GIN (to_tsvector('spanish', content))
  WHERE content IS NOT NULL AND is_deleted = false;

COMMENT ON INDEX idx_messages_content_search IS
  'GIN index for Spanish full-text search on message content';

-- ============================================================================
-- DOCUMENTATION COMMENTS
-- ============================================================================
-- Real-time notification pattern:
-- 1. Client subscribes to Supabase Realtime channel for their user_id
-- 2. When message arrives, notify_new_message trigger fires
-- 3. pg_notify sends event to Postgres LISTEN channel
-- 4. Supabase Realtime broadcasts to WebSocket subscribers
-- 5. Client receives push and updates UI
--
-- Typing indicators use Supabase Presence (ephemeral, not persisted):
-- 1. Client calls notify_typing() RPC when user types
-- 2. pg_notify broadcasts to 'typing' channel
-- 3. Other clients in conversation receive typing event
-- 4. Typing indicator shown for ~3 seconds then clears

-- ============================================================================
-- ADDITIONAL INDEX FOR EFFICIENT QUERIES
-- ============================================================================

-- Index for unread message detection
CREATE INDEX IF NOT EXISTS idx_participants_unread
  ON conversation_participants(user_id, unread_count)
  WHERE left_at IS NULL AND unread_count > 0;
