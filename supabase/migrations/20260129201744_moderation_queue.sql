-- ============================================
-- MODERATION QUEUE WITH SKIP LOCKED PATTERN
-- ============================================
-- Phase 5 Plan 5: Efficient concurrent moderation processing
-- Uses PostgreSQL FOR UPDATE SKIP LOCKED for safe multi-moderator claiming

-- ============================================
-- MODERATION_QUEUE TABLE
-- ============================================
-- Polymorphic queue for content requiring moderation review
-- Supports listings, posts, comments, and other content types

CREATE TABLE IF NOT EXISTS moderation_queue (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Polymorphic reference to the item being moderated
  -- Content type determines which table to look up
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,

  -- Queue priority (higher = review first)
  priority INTEGER NOT NULL DEFAULT 0,

  -- Queue timestamps
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Moderator assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution TEXT, -- 'approved' or 'rejected'
  resolution_notes TEXT,

  -- Constraints
  CONSTRAINT moderation_queue_item_type_check CHECK (item_type IN ('listing', 'post', 'comment')),
  CONSTRAINT moderation_queue_resolution_check CHECK (resolution IS NULL OR resolution IN ('approved', 'rejected')),
  CONSTRAINT moderation_queue_item_unique UNIQUE (item_type, item_id)
);

-- Comments explaining the FOR UPDATE SKIP LOCKED pattern
COMMENT ON TABLE moderation_queue IS
  'Content moderation queue using PostgreSQL FOR UPDATE SKIP LOCKED pattern.

   HOW IT WORKS:
   1. Items are added to queue when content is created (via triggers)
   2. Moderators call claim_moderation_item() to get next item
   3. FOR UPDATE SKIP LOCKED ensures no two moderators get same item
   4. If a row is locked by another transaction, it is skipped
   5. This enables horizontal scaling of moderator workers

   CONCURRENCY SAFETY:
   - Without SKIP LOCKED: Moderator B waits for Moderator A lock
   - With SKIP LOCKED: Moderator B gets next unlocked item instantly
   - No blocking, no duplicate claims, efficient distribution

   PRIORITY ORDERING:
   - Higher priority numbers = reviewed first
   - Same priority = older items first (FIFO)
   - New sellers can be given higher priority for closer review';

COMMENT ON COLUMN moderation_queue.item_type IS
  'Type of content being moderated: listing, post, or comment.
   Used to look up the actual content in the appropriate table.';

COMMENT ON COLUMN moderation_queue.priority IS
  'Queue priority. Higher values = reviewed first.
   Suggestions: 0=normal, 5=new user first post, 10=flagged content, 20=urgent';

COMMENT ON COLUMN moderation_queue.assigned_to IS
  'Moderator who claimed this item. NULL = available for claiming.
   Set by claim_moderation_item() function.';

COMMENT ON COLUMN moderation_queue.assigned_at IS
  'When the item was claimed. Used by release_stale_claims() to
   release items claimed too long ago without resolution.';

-- ============================================
-- INDEXES
-- ============================================

-- Primary index for efficient queue claiming
-- Covers: community_id filter, priority DESC order, queued_at ASC tiebreaker
-- Only for unclaimed, unresolved items
CREATE INDEX IF NOT EXISTS idx_moderation_queue_pending
  ON moderation_queue(community_id, priority DESC, queued_at ASC)
  WHERE assigned_to IS NULL AND resolved_at IS NULL;

-- Index for moderator's claimed items (their work queue)
CREATE INDEX IF NOT EXISTS idx_moderation_queue_assigned
  ON moderation_queue(assigned_to, assigned_at)
  WHERE resolved_at IS NULL;

-- Index for finding stale claims to release
CREATE INDEX IF NOT EXISTS idx_moderation_queue_stale
  ON moderation_queue(assigned_at)
  WHERE assigned_to IS NOT NULL AND resolved_at IS NULL;

-- Index for audit/reporting (resolved items by date)
CREATE INDEX IF NOT EXISTS idx_moderation_queue_resolved
  ON moderation_queue(community_id, resolved_at DESC)
  WHERE resolved_at IS NOT NULL;

-- ============================================
-- CLAIM MODERATION ITEM FUNCTION
-- ============================================
-- Claims the next available item for the calling moderator
-- Uses FOR UPDATE SKIP LOCKED to prevent concurrent claim conflicts

CREATE OR REPLACE FUNCTION claim_moderation_item(p_community_id UUID)
RETURNS TABLE(queue_id UUID, item_type TEXT, item_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed RECORD;
BEGIN
  -- FOR UPDATE SKIP LOCKED is the key pattern here:
  -- - FOR UPDATE: Lock the selected row to prevent concurrent modification
  -- - SKIP LOCKED: If a row is already locked by another transaction, skip it
  --
  -- This means multiple moderators can call this function simultaneously,
  -- and each will get a different item without blocking each other.

  SELECT mq.* INTO claimed
  FROM public.moderation_queue mq
  WHERE mq.community_id = p_community_id
    AND mq.assigned_to IS NULL
    AND mq.resolved_at IS NULL
  ORDER BY mq.priority DESC, mq.queued_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- No available items in queue
    RETURN;
  END IF;

  -- Claim the item by assigning it to the current user
  UPDATE public.moderation_queue
  SET assigned_to = auth.uid(),
      assigned_at = now()
  WHERE id = claimed.id;

  -- Return the claimed item info
  RETURN QUERY SELECT claimed.id, claimed.item_type, claimed.item_id;
END;
$$;

COMMENT ON FUNCTION claim_moderation_item IS
  'Claims the next available moderation item for the calling moderator.

   Uses FOR UPDATE SKIP LOCKED pattern to safely handle concurrent claims:
   - If another moderator is claiming an item, it is skipped
   - Each moderator gets a different item without blocking
   - Prevents duplicate work and reduces contention

   Parameters:
   - p_community_id: Community to claim item from

   Returns:
   - queue_id: UUID of the moderation queue entry
   - item_type: Type of content (listing, post, comment)
   - item_id: UUID of the content to review

   Priority ordering:
   1. Higher priority number first
   2. Older items first (FIFO within same priority)';

-- ============================================
-- RESOLVE MODERATION FUNCTION
-- ============================================
-- Resolves a moderation item and updates the source content

CREATE OR REPLACE FUNCTION resolve_moderation(
  p_queue_id UUID,
  p_resolution TEXT,  -- 'approved' or 'rejected'
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  q RECORD;
BEGIN
  -- Validate resolution
  IF p_resolution NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid resolution. Must be approved or rejected.';
  END IF;

  -- Get the queue item
  SELECT * INTO q
  FROM public.moderation_queue
  WHERE id = p_queue_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Verify the caller is the assigned moderator
  IF q.assigned_to IS NULL OR q.assigned_to != auth.uid() THEN
    RAISE EXCEPTION 'Item not assigned to you. Claim it first with claim_moderation_item().';
  END IF;

  -- Verify not already resolved
  IF q.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Item already resolved.';
  END IF;

  -- Update the queue entry
  UPDATE public.moderation_queue
  SET resolved_at = now(),
      resolution = p_resolution,
      resolution_notes = p_notes
  WHERE id = p_queue_id;

  -- Update the source content based on item_type
  IF q.item_type = 'listing' THEN
    UPDATE public.marketplace_listings
    SET moderation_status = p_resolution::moderation_status,
        moderated_by = auth.uid(),
        moderated_at = now(),
        rejection_reason = CASE
          WHEN p_resolution = 'rejected' THEN p_notes
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = q.item_id;

  ELSIF q.item_type = 'post' THEN
    -- For posts, 'rejected' means hidden
    UPDATE public.posts
    SET is_hidden = (p_resolution = 'rejected'),
        hidden_reason = CASE
          WHEN p_resolution = 'rejected' THEN p_notes
          ELSE NULL
        END,
        hidden_by = CASE
          WHEN p_resolution = 'rejected' THEN auth.uid()
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = q.item_id;

  ELSIF q.item_type = 'comment' THEN
    -- For comments, 'rejected' means hidden
    UPDATE public.post_comments
    SET is_hidden = (p_resolution = 'rejected'),
        hidden_reason = CASE
          WHEN p_resolution = 'rejected' THEN p_notes
          ELSE NULL
        END,
        hidden_by = CASE
          WHEN p_resolution = 'rejected' THEN auth.uid()
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = q.item_id;
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION resolve_moderation IS
  'Resolves a moderation item as approved or rejected.

   Only the moderator who claimed the item can resolve it.
   Updates both the queue entry and the source content:
   - listing: Sets moderation_status, moderated_by, moderated_at, rejection_reason
   - post: Sets is_hidden=TRUE if rejected
   - comment: Sets is_hidden=TRUE if rejected

   Parameters:
   - p_queue_id: UUID of the moderation queue entry
   - p_resolution: "approved" or "rejected"
   - p_notes: Optional notes (stored as rejection_reason if rejected)

   Returns TRUE on success, FALSE if item not found.
   Raises exception if not assigned to caller or already resolved.';

-- ============================================
-- RELEASE STALE CLAIMS FUNCTION
-- ============================================
-- Releases items that were claimed but not resolved within timeout

CREATE OR REPLACE FUNCTION release_stale_claims(
  p_timeout_minutes INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  released_count INTEGER;
BEGIN
  -- Find and release items claimed more than p_timeout_minutes ago
  -- that haven't been resolved
  UPDATE public.moderation_queue
  SET assigned_to = NULL,
      assigned_at = NULL
  WHERE assigned_to IS NOT NULL
    AND resolved_at IS NULL
    AND assigned_at < now() - (p_timeout_minutes || ' minutes')::INTERVAL;

  GET DIAGNOSTICS released_count = ROW_COUNT;

  RETURN released_count;
END;
$$;

COMMENT ON FUNCTION release_stale_claims IS
  'Releases moderation items that were claimed but not resolved within timeout.

   Use case: Moderator claims item, then closes browser without resolving.
   This function returns those items to the queue for other moderators.

   Should be called periodically by a cron job (e.g., pg_cron every 5 minutes).

   Parameters:
   - p_timeout_minutes: Minutes before a claimed item is considered stale (default 30)

   Returns the number of items released back to the queue.';

-- ============================================
-- QUEUE LISTING FOR MODERATION TRIGGER
-- ============================================
-- Automatically queues new listings for moderation

CREATE OR REPLACE FUNCTION queue_listing_for_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_priority INTEGER := 0;
  v_seller_listing_count INTEGER;
BEGIN
  -- Calculate priority based on seller history
  -- New sellers get higher priority for closer review
  SELECT COUNT(*) INTO v_seller_listing_count
  FROM public.marketplace_listings
  WHERE seller_id = NEW.seller_id
    AND id != NEW.id
    AND moderation_status = 'approved';

  IF v_seller_listing_count = 0 THEN
    -- First-time seller: higher priority for review
    v_priority := 5;
  ELSIF v_seller_listing_count < 3 THEN
    -- New seller (1-2 approved listings): moderate priority
    v_priority := 3;
  ELSE
    -- Established seller: normal priority
    v_priority := 0;
  END IF;

  -- Insert into moderation queue
  INSERT INTO public.moderation_queue (
    community_id, item_type, item_id, priority
  )
  VALUES (
    NEW.community_id, 'listing', NEW.id, v_priority
  )
  ON CONFLICT (item_type, item_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION queue_listing_for_moderation IS
  'Trigger function that queues new listings for moderation.

   Priority based on seller history:
   - First-time seller: priority 5 (reviewed sooner)
   - New seller (1-2 approved): priority 3
   - Established seller (3+): priority 0

   This helps focus review effort on new community members.';

-- Attach trigger to marketplace_listings
DROP TRIGGER IF EXISTS marketplace_listings_queue_moderation ON marketplace_listings;
CREATE TRIGGER marketplace_listings_queue_moderation
  AFTER INSERT ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION queue_listing_for_moderation();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
DROP POLICY IF EXISTS super_admin_all_moderation ON moderation_queue;
CREATE POLICY super_admin_all_moderation ON moderation_queue
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Moderators (admin/manager) can view queue in their community
DROP POLICY IF EXISTS moderators_view_queue ON moderation_queue;
CREATE POLICY moderators_view_queue ON moderation_queue
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Moderators can update queue items (claim, resolve) via functions
-- The functions are SECURITY DEFINER so they bypass RLS
-- This policy allows direct UPDATE for edge cases
DROP POLICY IF EXISTS moderators_update_queue ON moderation_queue;
CREATE POLICY moderators_update_queue ON moderation_queue
  FOR UPDATE
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- NOTES ON FOR UPDATE SKIP LOCKED
-- ============================================
-- This pattern is the standard PostgreSQL approach for job queues.
--
-- ALTERNATIVES CONSIDERED:
-- 1. Advisory locks - More complex, requires explicit unlock
-- 2. SELECT ... NOWAIT - Fails instead of skipping, requires retry logic
-- 3. Application-level locking - Race conditions, requires distributed locks
--
-- WHY SKIP LOCKED WINS:
-- - Native PostgreSQL feature (no extensions needed)
-- - Automatic lock release on transaction commit/rollback
-- - Zero contention - workers never block each other
-- - Scales horizontally with number of moderators
-- - ACID compliant - no lost updates or double processing
--
-- PERFORMANCE:
-- - Uses the idx_moderation_queue_pending index efficiently
-- - Lock held only during UPDATE (milliseconds)
-- - Hundreds of concurrent workers supported
