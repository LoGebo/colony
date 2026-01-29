---
phase: 05-amenities-communication-marketplace
plan: 03
subsystem: database
tags: [postgres, channels, posts, comments, reactions, adjacency-list, denormalized-counters, triggers, rls, community-discussion]

# Dependency graph
requires:
  - phase: 01-foundation-multi-tenant-security
    provides: generate_uuid_v7, set_audit_fields, soft_delete, RLS helpers, general_status enum
  - phase: 02-identity-crm
    provides: residents table (author references)
provides:
  - channel_type enum (general, building, committee, announcements, marketplace)
  - post_type enum (discussion, question, event, poll)
  - channels table with access control (is_public, allowed_roles, anyone_can_post)
  - posts table with media, polls, denormalized reaction_counts and comment_count
  - post_comments table with adjacency list hierarchy (parent_comment_id, depth, root_comment_id)
  - post_reactions table with unique constraint per user per post
  - set_comment_hierarchy() trigger for auto depth/root tracking
  - update_post_comment_count() trigger for comment counter maintenance
  - update_reaction_counts() trigger for reaction JSONB counter sync
  - get_comment_thread() recursive CTE function
  - create_default_channels() helper function
  - increment_post_view_count() SECURITY DEFINER function
affects: [05-announcements, 05-surveys, 06-notifications, future-mobile-social-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adjacency list for nested comments with depth/root tracking via BEFORE INSERT trigger"
    - "Denormalized JSONB counters with trigger-maintained sync (reaction_counts)"
    - "Recursive CTE for tree-order comment fetching with path array sorting"
    - "SECURITY DEFINER helper for analytics bypass (view count)"
    - "Channel access control via is_public + allowed_roles array"

key-files:
  created:
    - supabase/migrations/20260129200939_channel_enums.sql
    - supabase/migrations/20260129200940_channels_table.sql
    - supabase/migrations/20260129201431_posts_table.sql
    - supabase/migrations/20260129201526_comments_reactions.sql
  modified: []

key-decisions:
  - "Adjacency list over ltree for comments - simpler, dynamic trees with frequent edits"
  - "Denormalized reaction_counts JSONB + trigger over COUNT(*) - O(1) reads vs O(n)"
  - "depth <= 20 CHECK constraint prevents excessive comment nesting"
  - "root_comment_id enables efficient thread fetching without recursive parent walks"
  - "One reaction per user per post enforced at DB level via UNIQUE constraint"
  - "Channel access via is_public + allowed_roles array for flexible visibility"

patterns-established:
  - "Pattern: Comment hierarchy - adjacency list with depth/root auto-computed via BEFORE INSERT trigger"
  - "Pattern: Engagement counters - JSONB field + AFTER trigger for O(1) display"
  - "Pattern: Thread fetch - recursive CTE with path array for tree-order sorting"
  - "Pattern: Channel access - is_public boolean + allowed_roles array for flexible RLS"

# Metrics
duration: 7min
completed: 2026-01-29
---

# Phase 05 Plan 03: Channels, Posts, Comments & Reactions Summary

**Community discussion infrastructure with channels, posts, nested comments (adjacency list), and reactions (denormalized counters with trigger sync)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-29T20:09:21Z
- **Completed:** 2026-01-29T20:16:50Z
- **Tasks:** 3
- **Files created:** 4 (2 from prior commit, 2 new)

## Accomplishments

- Created channel_type and post_type enums for discussion categorization
- Built channels table with flexible access control (is_public, allowed_roles, anyone_can_post)
- Implemented posts table with media attachments, poll support, and denormalized engagement metrics
- Created post_comments with adjacency list hierarchy pattern and auto-computed depth/root
- Built post_reactions with unique constraint and trigger-maintained counter sync to posts.reaction_counts
- Added recursive CTE function get_comment_thread() for tree-order fetching

## Task Commits

Each task was committed atomically:

1. **Task 1: Create channel and post enums, channels table** - `6b79136` (feat - bundled in 05-01 commit from prior session)
2. **Task 2: Create posts table with engagement metrics** - `fc5391f` (feat)
3. **Task 3: Create comments and reactions with triggers** - `18af8e8` (feat)

## Files Created/Modified

- `supabase/migrations/20260129200939_channel_enums.sql` - channel_type and post_type enums
- `supabase/migrations/20260129200940_channels_table.sql` - channels with access control, create_default_channels()
- `supabase/migrations/20260129201431_posts_table.sql` - posts with media, polls, denormalized counters
- `supabase/migrations/20260129201526_comments_reactions.sql` - comments hierarchy, reactions, triggers

## Decisions Made

1. **Adjacency list over ltree for comments:** Simpler for dynamic trees with frequent replies/edits. ltree better for static hierarchies with complex path queries.

2. **Denormalized JSONB counters + trigger:** reaction_counts JSONB on posts with AFTER trigger on post_reactions. O(1) reads vs O(n) COUNT(*). Tradeoff: slight write overhead, but reads vastly outnumber writes in social features.

3. **depth <= 20 constraint:** Prevents runaway nesting that would slow recursive CTEs. UI typically flattens beyond 3-5 levels anyway.

4. **root_comment_id tracking:** Enables fetching entire thread without recursive parent walks. Single indexed lookup.

5. **UNIQUE (post_id, resident_id) for reactions:** One reaction per user per post at DB level. Allows reaction type changes via UPDATE.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1. **Task 1 pre-committed:** The channel_enums and channels_table migrations were already committed in a prior session (commit 6b79136) bundled with 05-01 amenities. Files existed on disk and remote; no changes needed for Task 1 beyond verification.

2. **Orphaned remote migrations:** Some migrations existed on remote without local files (201005, 201006, 201518). Repaired via `supabase migration repair --status applied` to sync history.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Phase 5 Plan 4 (Announcements): channels infrastructure available
- Phase 5 Plan 5 (Surveys): comment pattern reusable
- Phase 6 (Notifications): posts/comments/reactions can trigger notifications
- Mobile social features: all social infrastructure in place

**Tables available:**
- channels: 5 types with flexible access control
- posts: full content support with polls and media
- post_comments: nested hierarchy up to 20 levels
- post_reactions: one per user with counter sync

**No blockers identified.**

---
*Phase: 05-amenities-communication-marketplace*
*Completed: 2026-01-29*
