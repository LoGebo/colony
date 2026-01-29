-- ============================================
-- CHANNEL AND POST ENUMS
-- Phase 5 Plan 3: Community Discussion Infrastructure
-- ============================================

-- ============================================
-- CHANNEL TYPE ENUM
-- ============================================
-- Types of community discussion channels

CREATE TYPE channel_type AS ENUM (
  'general',       -- Open discussion
  'building',      -- Building-specific channels
  'committee',     -- Committee discussions
  'announcements', -- Admin-only posting
  'marketplace'    -- Buy/sell/trade
);

COMMENT ON TYPE channel_type IS
  'Types of community discussion channels. announcements restricts posting to admins.';

-- ============================================
-- POST TYPE ENUM
-- ============================================
-- Types of posts within channels

CREATE TYPE post_type AS ENUM (
  'discussion',    -- General discussion
  'question',      -- Q&A format
  'event',         -- Event announcement
  'poll'           -- Simple poll with options
);

COMMENT ON TYPE post_type IS
  'Types of posts within channels. poll enables poll_options and poll_ends_at fields.';
