# Phase 13 Plan 01: Community Social Wall + RLS Fix Summary

**One-liner:** Fixed 20 broken RLS policies across 12 tables (resident_id != auth.uid() mismatch), added 4 query key factories, and built complete social wall with channel tabs, post creation, reactions, comments, and inline polls.

## What Was Built

### RLS Identity Mismatch Fix (Migration 20260208210500)
- **Root cause:** RLS policies compared `resident_id = auth.uid()` but `resident_id` FKs to `residents.id` (a business UUID), not `auth.users.id`. The link is `residents.user_id -> auth.users.id`.
- **Fix pattern:** Replaced `auth.uid()` with `(SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)` in all affected policies.
- **Tables fixed:** post_reactions, vehicles, emergency_contacts (4 policies), marketplace_listings (4 policies), reservations (2 policies), regulation_signatures, packages, package_pickup_codes, reservation_waitlist (2 policies), ballots (2 policies), posts, post_comments, package_signatures.
- **Total:** 20 policies fixed across 12 tables.

### Query Key Factories (packages/shared/src/queries/keys.ts)
- Added: `posts`, `marketplace`, `vehicles`, `elections` query key factories
- Updated `mergeQueryKeys` to include all 4 new factories
- These factories are used by all Phase 13 plans for cache management

### Community Social Wall
- **Stack layout** (`community/_layout.tsx`): Declares routes for index, post/create, post/[id], plus future amenity/reservation screens
- **Feed screen** (`community/index.tsx`): Horizontal channel filter tabs, FlatList of PostCard items, pull-to-refresh, FAB for new post creation
- **Post creation** (`post/create.tsx`): Channel selection, post type selector (discussion/question/event/poll), title input, multiline content, media upload via pickAndUploadImage, poll option builder (2-10 options)
- **Post detail** (`post/[id].tsx`): Full content display, interactive poll voting, ReactionBar, threaded comment list with reply support, comment input with keyboard avoidance
- **Hooks** (`usePosts.ts`): useChannels, usePosts, usePostDetail, usePostComments, useCreatePost, useToggleReaction, useCreateComment, useVotePoll -- 8 hooks total
- **Components:** PostCard (author, content, media, poll, reactions), ReactionBar (like toggle, comment count), CommentItem (threaded with depth indent, reply button)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Fix all 20 RLS policies in one migration | Comprehensive fix unblocks all Phase 13 plans; mechanical pattern replacement |
| Use `as never` cast for enum values in post creation | Database types not regenerated after schema changes |
| Client-side poll voting via direct post update | Simple polls use posts.poll_results jsonb; formal governance uses elections/cast_vote RPC |
| Store post media in community-assets bucket | Public bucket appropriate for community-visible post images |
| Max 3 levels of comment thread indent (72px) | Prevents deep nesting from breaking mobile layout |

## Deviations from Plan

None - plan executed exactly as written.

## Commit Log

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8adec8a | Fix 20 RLS policies + add 4 query key factories |
| 2 | 180441b | Community social wall with posts, reactions, comments, polls |

## Files Created/Modified

### Created
- `supabase/migrations/20260208210500_fix_resident_rls_identity_mismatch.sql`
- `packages/mobile/app/(resident)/community/_layout.tsx`
- `packages/mobile/app/(resident)/community/index.tsx`
- `packages/mobile/app/(resident)/community/post/create.tsx`
- `packages/mobile/app/(resident)/community/post/[id].tsx`
- `packages/mobile/src/hooks/usePosts.ts`
- `packages/mobile/src/components/posts/PostCard.tsx`
- `packages/mobile/src/components/posts/CommentItem.tsx`
- `packages/mobile/src/components/posts/ReactionBar.tsx`

### Modified
- `packages/shared/src/queries/keys.ts`

## Verification Results

- TypeScript compilation passes in packages/shared (no errors)
- TypeScript compilation passes in packages/mobile (no errors)
- Community tab route group created with Stack layout
- 8 required files all present and accounted for
- All query key factories exported and included in mergeQueryKeys
- RLS migration covers all 20 policies from research Pitfall 1

## Next Phase Readiness

- **Plan 13-02** (Amenities + Reservations): Community layout already declares amenity screens; RLS fix enables reservation queries
- **Plan 13-03** (Profile + Documents + Marketplace): RLS fix enables vehicles, emergency_contacts, marketplace_listings, packages, regulation_signatures queries
- **Plan 13-04** (Surveys/Voting): RLS fix enables ballots queries; elections query key factory ready
- **Blocker:** Migration 20260208210500 must be applied to live Supabase before resident features work in production

## Metrics

- **Duration:** ~5 min
- **Completed:** 2026-02-08
- **Tasks:** 2/2
