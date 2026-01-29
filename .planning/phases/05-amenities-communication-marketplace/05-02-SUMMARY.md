---
phase: 05-amenities-communication-marketplace
plan: 02
subsystem: database
tags: [postgres, exclusion-constraints, btree-gist, tstzrange, waitlist, skip-locked]

# Dependency graph
requires:
  - phase: 01-foundation-multi-tenant-security
    provides: generate_uuid_v7(), set_audit_fields(), soft_delete(), RLS helpers
  - phase: 02-identity-crm
    provides: communities, units, residents tables
  - phase: 04-financial-engine
    provides: transactions, record_charge(), record_payment()
  - phase: 05-01
    provides: amenities, amenity_rules, validate_booking_rules(), reservation_status enum, waitlist_status enum
provides:
  - btree_gist extension for exclusion constraints
  - reservations table with EXCLUDE USING GIST double-booking prevention
  - create_reservation() function with rule validation
  - reservation_waitlist table with FIFO positioning
  - add_to_waitlist() and get_next_waitlist_position() functions
  - promote_from_waitlist() trigger with FOR UPDATE SKIP LOCKED
  - fee_type_reservation enum (deposit, usage, no_show, cancellation)
  - reservation_fees table with transaction links
  - charge_reservation_deposit(), refund_reservation_deposit() functions
  - charge_reservation_usage(), charge_no_show_fee() functions
affects:
  - 05-03-communication (may reference reservations for activity feed)
  - Future mobile app (waitlist promotion notifications via pg_notify)

# Tech tracking
tech-stack:
  added:
    - btree_gist (PostgreSQL extension)
  patterns:
    - Exclusion constraint with GIST index for non-overlapping ranges
    - tstzrange with '[)' bounds for adjacent slot compatibility
    - FOR UPDATE SKIP LOCKED for concurrent queue processing
    - pg_notify for real-time promotion alerts
    - Generated column alternative via trigger for IMMUTABLE index requirement

key-files:
  created:
    - supabase/migrations/20260129202224_btree_gist_extension.sql
    - supabase/migrations/20260129202225_reservations_table.sql
    - supabase/migrations/20260129202226_reservation_waitlist.sql
    - supabase/migrations/20260129202227_reservation_fees.sql
  modified: []

key-decisions:
  - "btree_gist extension enables exclusion constraints combining UUID + tstzrange"
  - "Exclusion constraint WHERE clause limits to status=confirmed AND deleted_at IS NULL"
  - "'[)' bounds critical for adjacent slots (14:00-15:00, 15:00-16:00) to NOT conflict"
  - "Waitlist uses requested_date column with trigger instead of generated column (lower() not IMMUTABLE)"
  - "FOR UPDATE SKIP LOCKED prevents race conditions when multiple cancellations promote waitlist"
  - "pg_notify('waitlist_promotion') enables real-time mobile/web notifications"
  - "Reservation fees link to transactions table for double-entry compliance"
  - "Deposit refunds use record_payment() to credit unit account"

patterns-established:
  - "Pattern: Exclusion constraint - EXCLUDE USING GIST (key WITH =, range WITH &&) WHERE conditions"
  - "Pattern: tstzrange bounds - always '[)' for time slots (inclusive start, exclusive end)"
  - "Pattern: Skip locked queue - SELECT ... FOR UPDATE SKIP LOCKED for concurrent processors"
  - "Pattern: pg_notify integration - PERFORM pg_notify(channel, json_payload::TEXT)"
  - "Pattern: Financial integration - charge via record_charge(), refund via record_payment()"

# Metrics
duration: 9min
completed: 2026-01-29
---

# Phase 05 Plan 02: Reservations with Exclusion Constraints Summary

**Database-enforced double-booking prevention using PostgreSQL exclusion constraints, waitlist with FIFO auto-promotion using FOR UPDATE SKIP LOCKED, and financial engine integration for deposits and fees**

## Performance

- **Duration:** 9 min
- **Started:** 2026-01-29T20:22:19Z
- **Completed:** 2026-01-29T20:31:18Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- Enabled btree_gist extension for combining UUID and tstzrange in exclusion constraints
- Created reservations table with EXCLUDE USING GIST constraint preventing double-booking
- Implemented create_reservation() function with validate_booking_rules() integration
- Created reservation_waitlist table with FIFO positioning per amenity per day
- Implemented promote_from_waitlist() trigger using FOR UPDATE SKIP LOCKED for concurrent safety
- Added pg_notify for real-time waitlist promotion notifications
- Created reservation_fees table linking to Phase 4 financial engine
- Implemented deposit charge/refund functions with double-entry compliance
- All tables have RLS policies with community isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable btree_gist and create reservations table** - `8d69998` (feat)
2. **Task 2: Create waitlist with auto-promotion** - `733ac51` (feat)
3. **Task 3: Create reservation fees with financial integration** - `aa661e5` (feat)

## Files Created/Modified

- `supabase/migrations/20260129202224_btree_gist_extension.sql` - btree_gist extension for GIST operator classes
- `supabase/migrations/20260129202225_reservations_table.sql` - Reservations with exclusion constraint, create_reservation()
- `supabase/migrations/20260129202226_reservation_waitlist.sql` - Waitlist table, add_to_waitlist(), promote_from_waitlist()
- `supabase/migrations/20260129202227_reservation_fees.sql` - Fees table, charge/refund functions

## Decisions Made

1. **btree_gist extension:** Required for exclusion constraints that combine scalar types (UUID) with range types (tstzrange). PostgreSQL's GiST index normally doesn't support UUID; btree_gist provides operator classes.

2. **'[)' bounds for tstzrange:** Critical design decision - inclusive start, exclusive end means 14:00-15:00 and 15:00-16:00 are adjacent, NOT overlapping. This allows back-to-back bookings without conflict.

3. **Waitlist requested_date column:** Originally planned as GENERATED ALWAYS column, but `lower()` on tstzrange is not IMMUTABLE in PostgreSQL. Changed to regular column populated by BEFORE INSERT trigger.

4. **FOR UPDATE SKIP LOCKED pattern:** When a reservation is cancelled, the trigger finds the first eligible waitlist entry. SKIP LOCKED ensures that if two cancellations happen simultaneously, each locks a different waitlist row, preventing duplicate promotions.

5. **pg_notify for promotions:** Sends JSON payload to 'waitlist_promotion' channel enabling real-time notifications to Supabase Realtime subscribers without polling.

6. **Financial integration approach:** Deposits charged via record_charge() (debit receivable, credit income), refunds via record_payment() (debit bank, credit receivable). This maintains double-entry compliance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed UNIQUE constraint with expression**
- **Found during:** Task 2 (waitlist table creation)
- **Issue:** PostgreSQL doesn't allow function expressions in inline UNIQUE constraints
- **Fix:** Changed to CREATE UNIQUE INDEX with expression after table creation
- **Files modified:** supabase/migrations/20260129202226_reservation_waitlist.sql
- **Verification:** Migration applied successfully
- **Committed in:** 733ac51 (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed GENERATED ALWAYS with non-IMMUTABLE function**
- **Found during:** Task 2 (waitlist table creation)
- **Issue:** `lower()` on tstzrange is not marked IMMUTABLE, cannot be used in GENERATED column
- **Fix:** Changed to regular column with BEFORE INSERT trigger to populate requested_date
- **Files modified:** supabase/migrations/20260129202226_reservation_waitlist.sql
- **Verification:** Migration applied successfully
- **Committed in:** 733ac51 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Syntax corrections necessary for PostgreSQL compatibility. No scope change.

## Key Database Objects Created

### Extension
- `btree_gist` - GiST operator classes for scalar types

### Enums
- `fee_type_reservation` - deposit, usage, no_show, cancellation

### Tables
- `reservations` - Amenity bookings with exclusion constraint
- `reservation_waitlist` - FIFO queue for overbooked slots
- `reservation_fees` - Fee tracking linked to transactions

### Functions
- `create_reservation(amenity_id, unit_id, resident_id, start, end, notes)` - Create validated reservation
- `get_next_waitlist_position(amenity_id, date)` - Get FIFO position
- `add_to_waitlist(amenity_id, unit_id, resident_id, start, end, expires_hours)` - Join waitlist
- `promote_from_waitlist()` - Trigger function for auto-promotion
- `set_waitlist_requested_date()` - Trigger function for date column
- `charge_reservation_deposit(reservation_id)` - Charge deposit via financial engine
- `refund_reservation_deposit(reservation_id, reason)` - Refund deposit
- `charge_reservation_usage(reservation_id)` - Charge hourly usage fee
- `charge_no_show_fee(reservation_id, penalty_amount)` - Apply no-show penalty

### Triggers
- `reservation_cancellation_promote_waitlist` - AFTER UPDATE on reservations when cancelled
- `set_waitlist_date` - BEFORE INSERT/UPDATE on waitlist for requested_date

### Constraints
- `reservations_no_overlap` - EXCLUDE USING GIST prevents double-booking

## Issues Encountered

1. **Pre-existing reservations table:** The table already existed from a prior session. Handled by marking the migration as applied and verifying structure matches.

2. **PostgreSQL IMMUTABLE requirement:** Two iterations needed to solve the waitlist date indexing problem. First attempted expression index (failed - lower() not IMMUTABLE), then attempted GENERATED column (failed - same reason), finally settled on trigger-populated column.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Plan 05-03: Communication features can reference reservations for activity tracking
- Plan 05-04: Announcements can target users with upcoming reservations
- Mobile app: Can subscribe to pg_notify('waitlist_promotion') for real-time alerts

**Key capabilities available:**
- Book amenities with automatic double-booking prevention
- Join waitlist when slots are full
- Auto-promotion when cancellations occur
- Deposit and usage fee tracking
- Integration with financial ledger

**No blockers identified.**

---
*Phase: 05-amenities-communication-marketplace*
*Completed: 2026-01-29*
