---
phase: 05-amenities-communication-marketplace
plan: 04
subsystem: database
tags: [postgres, announcements, surveys, notifications, fan-out, weighted-voting, pg_notify, real-time, rls, communication]

# Dependency graph
requires:
  - phase: 01-foundation-multi-tenant-security
    provides: generate_uuid_v7, set_audit_fields, general_status enum, RLS helpers
  - phase: 02-identity-crm
    provides: residents table, occupancies table, units table with coefficient
provides:
  - announcement_segment enum (7 targeting options)
  - announcements table with denormalized read/acknowledgment counters
  - announcement_recipients fan-out table with delivery tracking
  - expand_announcement_recipients() function for batch recipient expansion
  - update_announcement_read_count() trigger for counter sync
  - surveys table with simple and coefficient voting methods
  - survey_votes table with UNIQUE (survey_id, unit_id) one-per-unit constraint
  - cast_survey_vote() function with authorization validation
  - close_survey() function for result computation
  - notification_type_service enum (5 notification types)
  - service_notifications table with delivery and action tracking
  - send_service_notification() function with pg_notify broadcast
  - mark_notification_read() and record_notification_action() helpers
affects: [06-notifications, mobile-apps, admin-dashboard, guard-apps]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fan-out pattern for announcements - one recipient record per resident for tracking"
    - "Coefficient snapshot pattern - vote_weight captured at vote time for weighted voting"
    - "pg_notify for real-time push notifications via Supabase Realtime"
    - "One-vote-per-unit constraint for fair HOA voting"
    - "Segment targeting via JSONB criteria for flexible recipient selection"

key-files:
  created:
    - supabase/migrations/20260129202206_announcement_enums.sql
    - supabase/migrations/20260129202229_announcements_table.sql
    - supabase/migrations/20260129202433_surveys_table.sql
    - supabase/migrations/20260129202602_service_notifications.sql
  modified: []

key-decisions:
  - "Fan-out pattern for announcement_recipients - enables per-resident delivery/read tracking"
  - "Segment targeting via JSONB criteria - flexible filtering without schema changes"
  - "Coefficient snapshot at vote time - historical accuracy even if coefficient changes"
  - "One vote per unit via UNIQUE constraint - fair HOA representation"
  - "pg_notify for real-time - Supabase Realtime can subscribe for instant push"
  - "Service notifications are permanent records (no deleted_at) - audit trail requirement"

patterns-established:
  - "Pattern: Fan-out for notifications - create recipient records for tracking, not just broadcast"
  - "Pattern: Snapshot captured values - store coefficient at vote time, not just FK reference"
  - "Pattern: UNIQUE constraint voting - database-enforced one-per-entity voting"
  - "Pattern: Real-time via pg_notify - function calls PERFORM pg_notify() for Supabase Realtime"
  - "Pattern: JSONB criteria targeting - flexible segment rules without enum explosion"

# Metrics
duration: 6min
completed: 2026-01-29
---

# Phase 05 Plan 04: Announcements, Surveys & Service Notifications Summary

**Targeted announcements with fan-out recipients, coefficient-weighted surveys with one-vote-per-unit, and real-time service notifications via pg_notify**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-29T20:21:44Z
- **Completed:** 2026-01-29T20:27:35Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- Created announcements with 7-segment targeting (all, owners, tenants, building, unit_type, delinquent, role)
- Built announcement_recipients fan-out table with delivery and read tracking, trigger-maintained counters
- Implemented surveys with simple and coefficient-weighted voting methods for Mexican HOA decisions
- Enforced one-vote-per-unit via UNIQUE constraint with coefficient snapshot at vote time
- Created service_notifications with pg_notify broadcast for real-time push to resident apps

## Task Commits

Each task was committed atomically:

1. **Task 1: Create announcements with segment targeting** - `5332fa9` (feat)
2. **Task 2: Create surveys with one-vote-per-unit** - `9264a37` (feat)
3. **Task 3: Create service notifications for arrivals** - `86c1bbe` (feat)

## Files Created/Modified

- `supabase/migrations/20260129202206_announcement_enums.sql` - announcement_segment enum with 7 values
- `supabase/migrations/20260129202229_announcements_table.sql` - announcements, recipients, expand function, triggers
- `supabase/migrations/20260129202433_surveys_table.sql` - surveys, survey_votes, cast_survey_vote, close_survey
- `supabase/migrations/20260129202602_service_notifications.sql` - notification enum, table, send/mark functions

## Decisions Made

1. **Fan-out pattern for announcements:** Creating individual recipient records (vs. just targeting query) enables per-resident delivery tracking, read receipts, and acknowledgment flow. Tradeoff: more storage, but essential for engagement analytics.

2. **JSONB target_criteria for segments:** Instead of separate columns for each segment type (buildings[], types[], min_balance), using JSONB allows flexible targeting without schema changes for new segment types.

3. **Coefficient snapshot at vote time:** Survey votes store `vote_weight` as a snapshot of the unit's coefficient when voting, not a live FK. This ensures historical accuracy - if a unit's coefficient changes after voting, past vote weights remain accurate.

4. **One-vote-per-unit constraint:** UNIQUE(survey_id, unit_id) enforces fair HOA voting where each unit gets exactly one vote. cast_survey_vote() uses ON CONFLICT DO UPDATE to allow vote changes before survey closes.

5. **pg_notify for real-time:** send_service_notification() calls `PERFORM pg_notify('service_notification', payload)` enabling Supabase Realtime subscriptions in mobile apps for instant push notifications.

6. **Service notifications are permanent:** No deleted_at column - notifications serve as an audit trail of guard-to-resident communications and shouldn't be soft-deleted.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1. **Orphaned reservations migration:** The reservations table migration (20260129202225) from plan 05-02 was already applied to remote but missing from local tracking. Repaired with `supabase migration repair --status applied` to sync history before applying service_notifications migration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Communication infrastructure complete:**
- Announcements: Admins can create targeted announcements, expand to recipients, track reads
- Surveys: Coefficient-weighted voting for HOA decisions with one-per-unit enforcement
- Service notifications: Guards can notify residents of arrivals with real-time push

**Phase 5 Status:**
- 05-01: Amenities with booking rules COMPLETE
- 05-02: Reservations with exclusion constraints COMPLETE
- 05-03: Channels, Posts, Comments, Reactions COMPLETE
- 05-04: Announcements, Surveys, Notifications COMPLETE
- 05-05: Marketplace, Exchange Zones, Moderation Queue COMPLETE

**Phase 5 Complete - Ready for Phase 6 (Mobile Apps / Guards / Operations)**

**No blockers identified.**

---
*Phase: 05-amenities-communication-marketplace*
*Completed: 2026-01-29*
