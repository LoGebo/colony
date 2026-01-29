-- ============================================
-- MARKETPLACE ENUMS
-- ============================================
-- Phase 5 Plan 5: Marketplace listings, exchange zones, and moderation queue
-- Enums for listing categories and moderation status

-- ============================================
-- LISTING CATEGORY ENUM
-- ============================================
-- Categories of marketplace listings
-- Supports buying, selling, renting, and service offerings

DO $$ BEGIN
  CREATE TYPE listing_category AS ENUM (
    'sale',       -- Item for sale
    'service',    -- Service offered (tutoring, repair, etc.)
    'rental',     -- Item for rent (tools, equipment, etc.)
    'wanted'      -- Looking for item or service
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE listing_category IS
  'Marketplace listing categories.
   - sale: Item for sale (furniture, electronics, etc.)
   - service: Service offered (tutoring, repair, cleaning)
   - rental: Item available for temporary use
   - wanted: Buyer seeking item or service';

-- ============================================
-- MODERATION STATUS ENUM
-- ============================================
-- Content moderation workflow states
-- Used for marketplace listings, posts, and comments

DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM (
    'pending',    -- Awaiting review (initial state)
    'in_review',  -- Claimed by a moderator
    'approved',   -- Published and visible
    'rejected',   -- Blocked from publication
    'flagged'     -- Reported by users, needs re-review
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE moderation_status IS
  'Content moderation workflow states.
   Flow: pending -> in_review -> approved/rejected
   Users can flag approved content -> flagged -> in_review
   Only approved content is publicly visible.';
