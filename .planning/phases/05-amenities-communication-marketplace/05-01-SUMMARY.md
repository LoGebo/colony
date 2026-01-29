---
phase: 05-amenities-communication-marketplace
plan: 01
subsystem: database
tags: [postgres, enums, jsonb, rls, booking-rules, amenities]

# Dependency graph
requires:
  - phase: 01-foundation-multi-tenant-security
    provides: generate_uuid_v7(), set_audit_fields(), soft_delete(), RLS helpers
  - phase: 02-identity-crm
    provides: communities, units, residents, occupancies tables
provides:
  - amenity_type enum (pool, gym, salon, rooftop, bbq, court, room, parking, other)
  - rule_type enum (10 booking rule types)
  - reservation_status enum (pending, confirmed, cancelled, completed, no_show)
  - waitlist_status enum (waiting, promoted, expired, cancelled)
  - amenities table with JSONB schedules and booking configuration
  - amenity_rules table with priority-ordered rule validation
  - validate_booking_rules() function for rule enforcement
  - is_amenity_open() helper for schedule checking
  - create_default_amenity_rules() helper for new amenity setup
affects:
  - 05-02-reservations (uses amenities, amenity_rules, validate_booking_rules)
  - 05-03-communication (may reference amenities for discussion topics)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSONB schedule format for operating hours (day abbreviations with open/close times)
    - JSONB rule_value configuration per rule_type
    - Priority-ordered rule evaluation (higher priority checked first)
    - Partial unique index for one default rule per amenity per type
    - Exception handling for optional table dependencies

key-files:
  created:
    - supabase/migrations/20260129200933_amenity_enums.sql
    - supabase/migrations/20260129201212_amenities_table.sql
    - supabase/migrations/20260129201406_amenity_rules.sql
  modified: []

key-decisions:
  - "JSONB schedule format: {day: {open, close}} allows flexible per-day hours"
  - "Rule evaluation uses priority DESC ordering so blackouts can override quotas"
  - "Partial unique index allows seasonal rules while enforcing one default per type"
  - "Exception handling in validate_booking_rules() for graceful handling when reservations table doesn't exist yet"

patterns-established:
  - "Pattern: JSONB operating hours - {mon: {open: '06:00', close: '22:00'}, ...}"
  - "Pattern: Rule priority ordering - higher priority rules checked first (blackouts=100, quotas=10)"
  - "Pattern: Partial unique index for conditional uniqueness constraints"

# Metrics
duration: 7min
completed: 2026-01-29
---

# Phase 05 Plan 01: Amenity Definitions & Booking Rules Summary

**Amenity enums, tables with JSONB schedules, and data-driven booking rules engine with validate_booking_rules() function**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-29T20:09:28Z
- **Completed:** 2026-01-29T20:16:44Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created 4 new enum types for amenity management: amenity_type (9 values), rule_type (10 values), reservation_status (5 values), waitlist_status (4 values)
- Built amenities table with JSONB schedule format for flexible operating hours per day of week
- Implemented amenity_rules table with priority-ordered, data-driven rule configuration
- Created validate_booking_rules() function that evaluates all active rules against proposed reservations
- Added is_amenity_open() helper function for schedule checking
- All tables have RLS policies with community isolation via get_current_community_id()

## Task Commits

Each task was committed atomically:

1. **Task 1: Create amenity and reservation enums** - `2d739b7` (feat)
2. **Task 2: Create amenities table with schedules** - `6b79136` (feat)
3. **Task 3: Create amenity_rules table and validation function** - `b4197de` (feat)

## Files Created/Modified

- `supabase/migrations/20260129200933_amenity_enums.sql` - 4 enum types with comprehensive comments
- `supabase/migrations/20260129201212_amenities_table.sql` - Amenities table, RLS, is_amenity_open() function
- `supabase/migrations/20260129201406_amenity_rules.sql` - Rules table, validate_booking_rules(), create_default_amenity_rules()

## Decisions Made

1. **JSONB schedule format:** Used `{day: {open, close}}` structure with 3-letter day abbreviations (mon, tue, wed, thu, fri, sat, sun). Closed days can be omitted or set `{closed: true}`. This allows flexible per-day hours without schema changes.

2. **Priority-based rule evaluation:** Rules are evaluated in DESC priority order so that blackout dates (priority 100) can override normal quota rules (priority 10). First violation stops evaluation and returns immediately.

3. **Partial unique index for default rules:** Used `CREATE UNIQUE INDEX ... WHERE effective_from IS NULL AND deleted_at IS NULL` to enforce one default rule per amenity per type while allowing multiple seasonal rules with different effective dates.

4. **Exception handling for future tables:** The validate_booking_rules() function uses `EXCEPTION WHEN undefined_table` to gracefully handle quota rules when the reservations table doesn't exist yet (created in Plan 05-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed partial unique constraint syntax**
- **Found during:** Task 3 (amenity_rules table creation)
- **Issue:** PostgreSQL doesn't support `CONSTRAINT ... WHERE` syntax inline with table definition
- **Fix:** Changed to `CREATE UNIQUE INDEX idx_amenity_rules_one_default_per_type ... WHERE ...`
- **Files modified:** supabase/migrations/20260129201406_amenity_rules.sql
- **Verification:** Migration applied successfully
- **Committed in:** b4197de (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Syntax correction necessary for PostgreSQL compatibility. No scope change.

## Issues Encountered

1. **Previous migrations from other plans:** Several migration files from Plans 05-03 (channels) and 05-05 (marketplace) were already in the migrations folder and some had been applied to the remote database. These were from a previous incomplete session. Handled by:
   - Repairing migration history for conflicting entries
   - Continuing with 05-01 specific migrations
   - Extra files were committed alongside Task 2 (channel_enums.sql, channels_table.sql)

2. **Duplicate table creation error:** marketplace_listings table already existed in database. Repaired migration history using `supabase migration repair --status reverted 20260129201006`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Plan 05-02: Reservations table can now use amenities FK, validate_booking_rules() for booking validation
- btree_gist extension for exclusion constraints on reservation time ranges
- Plan 05-02 will need to CREATE OR REPLACE validate_booking_rules() to remove exception handling once reservations table exists

**No blockers identified.**

---
*Phase: 05-amenities-communication-marketplace*
*Completed: 2026-01-29*
