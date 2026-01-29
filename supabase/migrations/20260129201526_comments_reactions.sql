-- ============================================
-- POST COMMENTS AND REACTIONS
-- Phase 5 Plan 3: Community Discussion Infrastructure
-- ============================================

-- ============================================
-- POST COMMENTS TABLE (Adjacency List Pattern)
-- ============================================

CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,

  -- Hierarchy tracking (auto-set by trigger)
  depth INTEGER NOT NULL DEFAULT 0,
  root_comment_id UUID,

  -- Author
  author_id UUID REFERENCES residents(id) ON DELETE SET NULL,

  -- Content
  content TEXT NOT NULL,

  -- Moderation
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_reason TEXT,
  hidden_by UUID REFERENCES auth.users(id),

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Prevent excessive nesting
  CONSTRAINT comment_max_depth CHECK (depth <= 20)
);

-- Comments
COMMENT ON TABLE post_comments IS 'Nested comments on posts using adjacency list pattern';
COMMENT ON COLUMN post_comments.parent_comment_id IS 'NULL for top-level comments, references parent for replies';
COMMENT ON COLUMN post_comments.depth IS 'Auto-computed: 0 for top-level, parent.depth + 1 for replies';
COMMENT ON COLUMN post_comments.root_comment_id IS 'Auto-computed: ID of top-level comment in thread';

-- ============================================
-- COMMENT HIERARCHY TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION set_comment_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    -- Top-level comment
    NEW.depth := 0;
    NEW.root_comment_id := NEW.id;
  ELSE
    -- Reply to existing comment
    SELECT
      depth + 1,
      COALESCE(root_comment_id, id)
    INTO
      NEW.depth,
      NEW.root_comment_id
    FROM post_comments
    WHERE id = NEW.parent_comment_id;

    -- If parent not found, error
    IF NEW.depth IS NULL THEN
      RAISE EXCEPTION 'Parent comment not found';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_comment_hierarchy_trigger
  BEFORE INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_comment_hierarchy();

-- ============================================
-- COMMENT COUNT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_comment_count_trigger
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comment_count();

-- ============================================
-- POST COMMENTS INDEXES
-- ============================================

-- Comment feed for a post (chronological)
CREATE INDEX idx_post_comments_feed
  ON post_comments(post_id, created_at)
  WHERE deleted_at IS NULL;

-- Replies to a specific comment
CREATE INDEX idx_post_comments_parent
  ON post_comments(parent_comment_id)
  WHERE parent_comment_id IS NOT NULL AND deleted_at IS NULL;

-- Thread fetch (all comments in a thread)
CREATE INDEX idx_post_comments_root
  ON post_comments(root_comment_id, created_at)
  WHERE deleted_at IS NULL;

-- Author's comments
CREATE INDEX idx_post_comments_author
  ON post_comments(author_id)
  WHERE deleted_at IS NULL;

-- ============================================
-- POST COMMENTS TRIGGERS
-- ============================================

-- Audit trigger
CREATE TRIGGER set_post_comments_audit
  BEFORE INSERT OR UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER post_comments_soft_delete
  BEFORE DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete();

-- ============================================
-- POST COMMENTS RLS
-- ============================================

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY super_admin_all_comments ON post_comments
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users can view comments on posts they can access
CREATE POLICY users_view_comments ON post_comments
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND is_hidden = FALSE
    AND community_id = (SELECT public.get_current_community_id())
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_comments.post_id
        AND p.deleted_at IS NULL
        AND p.is_hidden = FALSE
    )
  );

-- Authors can manage own comments
CREATE POLICY authors_manage_comments ON post_comments
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

-- Users can create comments on posts in unlocked channels
CREATE POLICY users_create_comments ON post_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_comments.post_id
        AND p.deleted_at IS NULL
        AND p.is_locked = FALSE
    )
  );

-- Admins can moderate comments
CREATE POLICY admins_moderate_comments ON post_comments
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

-- ============================================
-- POST REACTIONS TABLE
-- ============================================

CREATE TABLE post_reactions (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Reaction type (emoji or name)
  reaction_type TEXT NOT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One reaction per user per post
  CONSTRAINT reactions_unique_per_user UNIQUE (post_id, resident_id)
);

-- Comments
COMMENT ON TABLE post_reactions IS 'Reactions to posts (one per user per post)';
COMMENT ON COLUMN post_reactions.reaction_type IS 'Reaction type: like, love, laugh, sad, angry, etc.';

-- ============================================
-- REACTION COUNTER TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment counter for the new reaction type
    UPDATE posts
    SET reaction_counts = jsonb_set(
      reaction_counts,
      ARRAY[NEW.reaction_type],
      to_jsonb(COALESCE((reaction_counts->>NEW.reaction_type)::INTEGER, 0) + 1)
    )
    WHERE id = NEW.post_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement counter for the old reaction type
    UPDATE posts
    SET reaction_counts = jsonb_set(
      reaction_counts,
      ARRAY[OLD.reaction_type],
      to_jsonb(GREATEST((reaction_counts->>OLD.reaction_type)::INTEGER - 1, 0))
    )
    WHERE id = OLD.post_id;

  ELSIF TG_OP = 'UPDATE' AND OLD.reaction_type != NEW.reaction_type THEN
    -- User changed reaction: decrement old, increment new
    UPDATE posts
    SET reaction_counts = jsonb_set(
      jsonb_set(
        reaction_counts,
        ARRAY[OLD.reaction_type],
        to_jsonb(GREATEST((reaction_counts->>OLD.reaction_type)::INTEGER - 1, 0))
      ),
      ARRAY[NEW.reaction_type],
      to_jsonb(COALESCE((reaction_counts->>NEW.reaction_type)::INTEGER, 0) + 1)
    )
    WHERE id = NEW.post_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_reaction_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reaction_counts();

-- ============================================
-- POST REACTIONS INDEXES
-- ============================================

-- Reactions for a post
CREATE INDEX idx_post_reactions_post
  ON post_reactions(post_id, reaction_type);

-- User's reactions
CREATE INDEX idx_post_reactions_resident
  ON post_reactions(resident_id);

-- ============================================
-- POST REACTIONS RLS
-- ============================================

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY super_admin_all_reactions ON post_reactions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users can view reactions on posts they can access
CREATE POLICY users_view_reactions ON post_reactions
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_reactions.post_id
        AND p.deleted_at IS NULL
        AND p.is_hidden = FALSE
    )
  );

-- Users can manage their own reactions
CREATE POLICY users_manage_own_reactions ON post_reactions
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND resident_id = auth.uid()
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND resident_id = auth.uid()
  );

-- ============================================
-- HELPER FUNCTION: Get Comment Thread
-- ============================================

CREATE OR REPLACE FUNCTION get_comment_thread(p_post_id UUID)
RETURNS TABLE (
  id UUID,
  parent_comment_id UUID,
  depth INTEGER,
  root_comment_id UUID,
  author_id UUID,
  content TEXT,
  is_hidden BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  path TIMESTAMPTZ[]
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE comment_tree AS (
    -- Base case: top-level comments
    SELECT
      c.id,
      c.parent_comment_id,
      c.depth,
      c.root_comment_id,
      c.author_id,
      c.content,
      c.is_hidden,
      c.created_at,
      c.updated_at,
      ARRAY[c.created_at] as path
    FROM post_comments c
    WHERE c.post_id = p_post_id
      AND c.parent_comment_id IS NULL
      AND c.deleted_at IS NULL

    UNION ALL

    -- Recursive case: replies
    SELECT
      c.id,
      c.parent_comment_id,
      c.depth,
      c.root_comment_id,
      c.author_id,
      c.content,
      c.is_hidden,
      c.created_at,
      c.updated_at,
      ct.path || c.created_at
    FROM post_comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.deleted_at IS NULL
  )
  SELECT * FROM comment_tree
  ORDER BY path;
$$;

COMMENT ON FUNCTION get_comment_thread(UUID) IS
  'Returns all comments for a post in tree order using recursive CTE. Path array enables proper sorting.';
