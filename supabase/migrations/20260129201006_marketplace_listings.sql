-- ============================================
-- MARKETPLACE LISTINGS TABLE
-- ============================================
-- Phase 5 Plan 5: Internal marketplace for community members
-- Enables buying, selling, renting, and services between residents

-- ============================================
-- MARKETPLACE_LISTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Seller information
  seller_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL, -- Seller's unit for trust/verification

  -- Listing details
  category listing_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price money_amount, -- Nullable for service/wanted listings
  price_negotiable BOOLEAN NOT NULL DEFAULT FALSE,

  -- Media (array of Supabase Storage URLs)
  image_urls TEXT[],

  -- Exchange preference (FK added later when exchange_zones table exists)
  preferred_exchange_zone_id UUID,

  -- Moderation workflow
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  auto_flag_reasons TEXT[], -- Auto-detected issues (prohibited keywords, spam patterns)

  -- Engagement metrics
  view_count INTEGER NOT NULL DEFAULT 0,
  inquiry_count INTEGER NOT NULL DEFAULT 0,

  -- Expiry and completion
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  is_sold BOOLEAN NOT NULL DEFAULT FALSE,
  sold_at TIMESTAMPTZ,
  sold_to_resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT marketplace_listings_title_length CHECK (char_length(title) BETWEEN 5 AND 100),
  CONSTRAINT marketplace_listings_description_length CHECK (char_length(description) >= 20),
  CONSTRAINT marketplace_listings_sold_tracking CHECK (
    (is_sold = FALSE AND sold_at IS NULL) OR
    (is_sold = TRUE AND sold_at IS NOT NULL)
  )
);

-- Add audit trigger (with IF NOT EXISTS check)
DO $$ BEGIN
  CREATE TRIGGER marketplace_listings_audit
    BEFORE INSERT OR UPDATE ON marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_fields();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add soft delete trigger (with IF NOT EXISTS check)
DO $$ BEGIN
  CREATE TRIGGER marketplace_listings_soft_delete
    BEFORE DELETE ON marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Comments
COMMENT ON TABLE marketplace_listings IS
  'Internal community marketplace for buying, selling, renting items and offering services.
   All listings require moderation before becoming visible.
   Listings auto-expire after 30 days by default.';

COMMENT ON COLUMN marketplace_listings.unit_id IS
  'Optional seller unit reference for buyer trust/verification.';

COMMENT ON COLUMN marketplace_listings.image_urls IS
  'Array of Supabase Storage URLs for listing images.
   Convention: {community_id}/listings/{listing_id}/{filename}';

COMMENT ON COLUMN marketplace_listings.auto_flag_reasons IS
  'System-detected issues that triggered automatic flagging.
   Examples: prohibited keywords, spam patterns, suspicious pricing.';

COMMENT ON COLUMN marketplace_listings.expires_at IS
  'Listings automatically expire after 30 days.
   Can be renewed by seller before expiration.';

-- ============================================
-- INDEXES
-- ============================================

-- Primary search: approved listings in community, ordered by recency
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_community_approved
  ON marketplace_listings(community_id, created_at DESC)
  WHERE moderation_status = 'approved' AND deleted_at IS NULL AND is_sold = FALSE;

-- Seller's listings (including pending/rejected)
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller
  ON marketplace_listings(seller_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Category + price filtering
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category_price
  ON marketplace_listings(community_id, category, price)
  WHERE moderation_status = 'approved' AND deleted_at IS NULL AND is_sold = FALSE;

-- Expiry cleanup (find expired approved listings)
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_expiry
  ON marketplace_listings(expires_at)
  WHERE moderation_status = 'approved' AND deleted_at IS NULL AND is_sold = FALSE;

-- Moderation queue (pending items)
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_pending
  ON marketplace_listings(community_id, created_at)
  WHERE moderation_status = 'pending' AND deleted_at IS NULL;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Increment view count (for tracking listing popularity)
CREATE OR REPLACE FUNCTION increment_listing_view_count(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.marketplace_listings
  SET view_count = view_count + 1
  WHERE id = p_listing_id
    AND moderation_status = 'approved'
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION increment_listing_view_count IS
  'Increments the view count for an approved listing.
   Only updates approved, non-deleted listings.';

-- Increment inquiry count (when someone contacts seller)
CREATE OR REPLACE FUNCTION increment_listing_inquiry_count(p_listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.marketplace_listings
  SET inquiry_count = inquiry_count + 1
  WHERE id = p_listing_id
    AND moderation_status = 'approved'
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION increment_listing_inquiry_count IS
  'Increments the inquiry count when someone contacts the seller.
   Only updates approved, non-deleted listings.';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Super admin: full access to all listings
DROP POLICY IF EXISTS super_admin_all_listings ON marketplace_listings;
CREATE POLICY super_admin_all_listings ON marketplace_listings
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Users can view approved listings in their community
DROP POLICY IF EXISTS users_view_approved_listings ON marketplace_listings;
CREATE POLICY users_view_approved_listings ON marketplace_listings
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND moderation_status = 'approved'
    AND deleted_at IS NULL
    AND is_sold = FALSE
    AND expires_at > now()
  );

-- Sellers can view ALL their own listings regardless of status
DROP POLICY IF EXISTS sellers_view_own_listings ON marketplace_listings;
CREATE POLICY sellers_view_own_listings ON marketplace_listings
  FOR SELECT
  USING (
    seller_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Sellers can update their own pending/approved listings
DROP POLICY IF EXISTS sellers_update_own_listings ON marketplace_listings;
CREATE POLICY sellers_update_own_listings ON marketplace_listings
  FOR UPDATE
  USING (
    seller_id = auth.uid()
    AND moderation_status IN ('pending', 'approved', 'flagged')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    seller_id = auth.uid()
  );

-- Sellers can delete (soft delete) their own listings
DROP POLICY IF EXISTS sellers_delete_own_listings ON marketplace_listings;
CREATE POLICY sellers_delete_own_listings ON marketplace_listings
  FOR DELETE
  USING (
    seller_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Authenticated residents can create listings in their community
DROP POLICY IF EXISTS users_create_listings ON marketplace_listings;
CREATE POLICY users_create_listings ON marketplace_listings
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND seller_id = auth.uid()
    AND moderation_status = 'pending'  -- New listings must start as pending
  );

-- Admins/managers can view all listings in their community for moderation
DROP POLICY IF EXISTS admins_view_all_listings ON marketplace_listings;
CREATE POLICY admins_view_all_listings ON marketplace_listings
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    AND deleted_at IS NULL
  );

-- Admins/managers can update moderation fields
DROP POLICY IF EXISTS admins_moderate_listings ON marketplace_listings;
CREATE POLICY admins_moderate_listings ON marketplace_listings
  FOR UPDATE
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- AUTO-QUEUE TRIGGER FOR MODERATION
-- ============================================
-- Note: The actual queue_listing_for_moderation trigger will be created
-- in the moderation_queue migration since it depends on that table.
-- This comment documents the intended flow:
--
-- When a new listing is inserted:
-- 1. This trigger fires AFTER INSERT
-- 2. Creates entry in moderation_queue with item_type='listing'
-- 3. Sets priority based on seller history (new sellers = higher priority)
-- 4. Moderators claim items via FOR UPDATE SKIP LOCKED
