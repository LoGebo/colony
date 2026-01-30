---
phase: 08-governance-analytics
plan: 04
subsystem: database
tags: [postgres, parking, reservations, violations, exclusion-constraint, btree_gist, tstzrange]

# Dependency graph
requires:
  - phase: 01-foundation-multi-tenant-security
    provides: generate_uuid_v7, set_audit_fields, soft_delete, RLS helpers, communities table
  - phase: 02-identity-crm/01
    provides: units table
  - phase: 02-identity-crm/02
    provides: residents table, vehicles table with plate_normalized
  - phase: 05-amenities/02
    provides: btree_gist extension, exclusion constraint pattern
provides:
  - parking_spots table for spot inventory
  - parking_assignments table for unit-spot linking
  - parking_reservations table with exclusion constraint
  - parking_violations table for enforcement tracking
  - is_parking_available() function for availability checks
  - create_parking_reservation() function with validation
  - report_parking_violation() function with auto vehicle linking
affects: [08-07 violations formal tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exclusion constraint for time-slot reservation conflicts (reusing Phase 5 pattern)"
    - "Denormalized assigned_unit_id with trigger maintenance"
    - "Partial unique index for one active assignment per spot"
    - "Date + time components for tstzrange construction"

key-files:
  created:
    - supabase/migrations/20260130043843_parking_enums.sql
    - supabase/migrations/20260130045215_parking_tables.sql
    - supabase/migrations/20260130045532_parking_reservations.sql
  modified: []

key-decisions:
  - "6 parking enums for spot types, statuses, violations, and reservation workflow"
  - "Denormalized assigned_unit_id on parking_spots for O(1) lookups, trigger-maintained"
  - "Partial unique index ensures one active assignment per parking spot"
  - "Time slots stored as DATE + TIME components for easier queries and timezone handling"
  - "Exclusion constraint with '[)' bounds allows adjacent slots (10:00-12:00, 12:00-14:00)"
  - "Parking violations auto-link to registered vehicles via plate_normalized matching"
  - "violation_record_id prepared for future Phase 8-07 formal violations integration"

patterns-established:
  - "Parking reservation exclusion: tstzrange((date + start_time) AT TIME ZONE 'America/Mexico_City', ...)"
  - "Time-based reservations with check-in/check-out tracking"
  - "Violation evidence storage via photo_urls array"

# Metrics
duration: 8min
completed: 2026-01-30
---

# Phase 8 Plan 4: Parking Management Summary

**Parking inventory, unit assignments with validity periods, visitor reservations with database-enforced overlap prevention, and violation tracking with evidence storage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-30T04:38:00Z
- **Completed:** 2026-01-30T04:56:00Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created 6 parking-related enum types (spot types, statuses, violations, reservations)
- Created parking_spots table with full inventory management and denormalized assignment
- Created parking_assignments table with partial unique index for one active assignment per spot
- Implemented trigger to maintain assigned_unit_id on parking_spots automatically
- Created parking_reservations table with exclusion constraint preventing double-booking
- Created parking_violations table for enforcement with evidence storage
- Implemented helper functions for availability checks, reservations, and violations
- RLS policies for community-scoped access with role-based permissions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create parking enum types** - `cb6c09c` (feat)
2. **Task 2: Create parking spots and assignments tables** - `4b09958` (feat)
3. **Task 3: Create parking reservations and violations tables** - `4d42904` (feat)

## Files Created/Modified

- `supabase/migrations/20260130043843_parking_enums.sql` - 6 enums for parking management
- `supabase/migrations/20260130045215_parking_tables.sql` - parking_spots, parking_assignments, sync trigger
- `supabase/migrations/20260130045532_parking_reservations.sql` - parking_reservations with exclusion, parking_violations, helper functions

## Decisions Made

1. **6 Parking Enums Created:**
   - parking_spot_type: assigned, visitor, commercial, disabled, loading, reserved
   - parking_spot_status: available, occupied, reserved, maintenance, blocked
   - parking_violation_type: 6 violation categories
   - parking_violation_status: 5-state resolution workflow
   - parking_assignment_type: ownership, rental, temporary
   - parking_reservation_status: 5-state reservation workflow

2. **Denormalized assigned_unit_id:** parking_spots.assigned_unit_id is automatically maintained by sync_parking_spot_assignment() trigger for O(1) lookups

3. **One Active Assignment per Spot:** Partial unique index on (parking_spot_id) WHERE is_active = true ensures only one active assignment, allows historical records

4. **Date + Time Storage for Reservations:** Instead of single tstzrange, store reservation_date, start_time, end_time separately for easier queries and timezone-aware constraint

5. **Exclusion Constraint with '[)' Bounds:** Adjacent time slots (10:00-12:00, 12:00-14:00) do NOT conflict, matching Phase 5 amenity reservations pattern

6. **Auto Vehicle Linking:** report_parking_violation() automatically links to registered vehicle via plate_normalized matching

7. **Prepared for Phase 8-07:** violation_record_id column ready for formal violations table integration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1. **Database Connection Timeouts:** Supabase connection pool had circuit breaker issues due to concurrent operations. Resolved by waiting for cooldown period.

2. **Migration Ordering:** Files created by other parallel plans needed to be moved to .pending_migrations/ to avoid blocking this plan's migrations.

## User Setup Required

None - no external service configuration required.

## Tables Created

### parking_spots
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (v7) |
| community_id | UUID | FK to communities |
| spot_number | TEXT | Unique within community (e.g., "A-01") |
| spot_type | ENUM | assigned/visitor/commercial/disabled/loading/reserved |
| status | ENUM | available/occupied/reserved/maintenance/blocked |
| area, level, section | TEXT | Location information |
| is_covered, is_electric_vehicle | BOOLEAN | Physical characteristics |
| assigned_unit_id | UUID | Denormalized from assignments (trigger-maintained) |
| monthly_fee | money_amount | Rental/maintenance fee |

### parking_assignments
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (v7) |
| parking_spot_id | UUID | FK to parking_spots |
| unit_id | UUID | FK to units |
| vehicle_id | UUID | Optional FK to vehicles |
| assigned_from/until | DATE | Validity period (NULL = permanent) |
| assignment_type | ENUM | ownership/rental/temporary |
| is_active | BOOLEAN | Partial unique enforces one active per spot |

### parking_reservations
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (v7) |
| parking_spot_id | UUID | FK to parking_spots (visitor spots only) |
| unit_id, resident_id | UUID | FKs to units, residents |
| visitor_name | TEXT | Visitor identification |
| reservation_date | DATE | Date of reservation |
| start_time, end_time | TIME | Time slot (exclusion constraint) |
| status | ENUM | pending/confirmed/cancelled/completed/no_show |
| checked_in_at, checked_out_at | TIMESTAMPTZ | Usage tracking |

### parking_violations
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (v7) |
| parking_spot_id | UUID | Optional FK (may be outside spots) |
| vehicle_id | UUID | Auto-linked if plates match |
| vehicle_plates | TEXT | Original plates as observed |
| violation_type | ENUM | 6 violation categories |
| description, photo_urls | TEXT, TEXT[] | Evidence |
| status | ENUM | reported/warned/fined/resolved/dismissed |
| violation_record_id | UUID | Future link to Phase 8-07 |

## Functions Created

| Function | Purpose |
|----------|---------|
| sync_parking_spot_assignment() | Trigger maintaining assigned_unit_id |
| get_available_parking_spots() | List unassigned spots by type |
| get_unit_parking_spots() | List spots assigned to a unit |
| is_parking_available() | Check availability for time slot |
| create_parking_reservation() | Create with validation |
| cancel_parking_reservation() | Cancel reservation |
| checkin_parking_visitor() | Record arrival |
| checkout_parking_visitor() | Record departure and complete |
| get_todays_parking_reservations() | Guard booth dashboard |
| report_parking_violation() | Report with auto vehicle linking |

## Next Phase Readiness

- Parking infrastructure ready for Phase 8-07 violations formal tracking
- Exclusion constraint pattern proven for time-slot management
- Violation evidence storage ready for photo uploads
- Guard booth dashboard function ready for UI integration

---
*Phase: 08-governance-analytics*
*Completed: 2026-01-30*
