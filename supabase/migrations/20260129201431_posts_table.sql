-- ============================================
-- POSTS TABLE
-- Phase 5 Plan 3: Community Discussion Infrastructure
-- ============================================

-- ============================================
-- POSTS TABLE
-- ============================================
-- Posts within discussion channels

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id UUID REFERENCES residents(id) ON DELETE SET NULL,

  -- Post content
  post_type post_type NOT NULL DEFAULT 'discussion',
  title TEXT,
  content TEXT NOT NULL,

  -- Media attachments
  media_urls TEXT[],

  -- Poll data (only used when post_type = 'poll')
  poll_options JSONB,
  poll_ends_at TIMESTAMPTZ,
  poll_results JSONB,

  -- Engagement metrics (denormalized)
  reaction_counts JSONB NOT NULL DEFAULT '{}',
  comment_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,

  -- Moderation flags
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_reason TEXT,
  hidden_by UUID REFERENCES auth.users(id),

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- Comments
COMMENT ON TABLE posts IS 'Posts in community discussion channels';
COMMENT ON COLUMN posts.poll_options IS 'JSON array of poll options: [{"id": "opt1", "text": "Yes"}, {"id": "opt2", "text": "No"}]';
COMMENT ON COLUMN posts.poll_results IS 'Computed results after poll ends';
COMMENT ON COLUMN posts.reaction_counts IS 'Denormalized counter: {"like": 5, "love": 2}';
COMMENT ON COLUMN posts.is_pinned IS 'Pinned posts appear at top of channel';
COMMENT ON COLUMN posts.is_locked IS 'If TRUE, no new comments allowed';
COMMENT ON COLUMN posts.is_hidden IS 'Hidden posts not visible to regular users';

-- ============================================
-- INDEXES
-- ============================================

-- Channel feed: pinned first, then by date
CREATE INDEX idx_posts_channel_feed
  ON posts(channel_id, is_pinned DESC, created_at DESC)
  WHERE deleted_at IS NULL AND is_hidden = FALSE;

-- Author's posts
CREATE INDEX idx_posts_author
  ON posts(author_id)
  WHERE deleted_at IS NULL;

-- Community feed (all channels)
CREATE INDEX idx_posts_community_feed
  ON posts(community_id, created_at DESC)
  WHERE deleted_at IS NULL AND is_hidden = FALSE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger
CREATE TRIGGER set_posts_audit
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER posts_soft_delete
  BEFORE DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY super_admin_all_posts ON posts
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users can view posts in channels they can access (not hidden)
CREATE POLICY users_view_posts ON posts
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND is_hidden = FALSE
    AND community_id = (SELECT public.get_current_community_id())
    AND EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = posts.channel_id
        AND c.deleted_at IS NULL
        AND (
          c.is_public = TRUE
          OR (SELECT public.get_current_user_role())::user_role = ANY(c.allowed_roles)
        )
    )
  );

-- Authors can update/delete own posts
CREATE POLICY authors_manage_own_posts ON posts
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND author_id = (SELECT id FROM residents WHERE id = auth.uid())
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND author_id = (SELECT id FROM residents WHERE id = auth.uid())
  );

-- Admins and managers can moderate posts
CREATE POLICY admins_moderate_posts ON posts
  FOR UPDATE
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- Users can create posts in channels where allowed
CREATE POLICY users_create_posts ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = posts.channel_id
        AND c.deleted_at IS NULL
        AND c.community_id = (SELECT public.get_current_community_id())
        AND (
          c.anyone_can_post = TRUE
          OR (SELECT public.get_current_user_role()) IN ('admin', 'manager')
        )
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Increment post view count (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION increment_post_view_count(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE id = p_post_id
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION increment_post_view_count(UUID) IS
  'Atomically increments view count for a post. SECURITY DEFINER to bypass RLS.';
