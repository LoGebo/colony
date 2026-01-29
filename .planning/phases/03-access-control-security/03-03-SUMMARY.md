---
phase: 03-access-control-security
plan: 03
subsystem: access-control
tags: [patrol, nfc, gps, haversine, checkpoints, routes, progress-tracking]
dependency-graph:
  requires: [03-01]
  provides: [patrol_checkpoints_table, patrol_routes_table, patrol_logs_tables, gps_validation]
  affects: [03-04]
tech-stack:
  added: []
  patterns: [nfc-serial-text, checkpoint-sequence-array, haversine-gps-distance, progress-trigger]
key-files:
  created:
    - supabase/migrations/20260129182458_patrol_checkpoints_table.sql
    - supabase/migrations/20260129182606_patrol_routes_table.sql
    - supabase/migrations/20260129182644_patrol_logs_tables.sql
  modified: []
decisions:
  - "NFC serial stored as TEXT not UUID (factory-assigned, tamper-evident)"
  - "Haversine formula for GPS distance calculation (accurate for short distances)"
  - "Patrol logs are audit records without soft delete"
  - "Progress auto-updated via trigger when checkpoints scanned"
metrics:
  duration: 3 min
  completed: 2026-01-29
---

# Phase 3 Plan 03: Patrol Routes & Checkpoints Summary

**NFC checkpoint management with factory serial numbers, ordered patrol routes, and GPS-validated patrol logging with automatic progress tracking.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T18:24:51Z
- **Completed:** 2026-01-29T18:28:07Z
- **Tasks:** 3/3
- **Files created:** 3

## Accomplishments

- patrol_checkpoints table with NFC serial TEXT (factory-assigned, not UUID)
- patrol_routes table with checkpoint_sequence UUID[] for ordered waypoints
- patrol_logs and patrol_checkpoint_logs with progress tracking trigger
- GPS validation using Haversine formula with configurable tolerance

## Task Commits

Each task was committed atomically:

1. **Task 1: Create patrol_checkpoints table** - `559ff9f` (feat)
2. **Task 2: Create patrol_routes table** - `1318255` (feat)
3. **Task 3: Create patrol_logs tables** - `27afa38` (feat)

## Files Created

- `supabase/migrations/20260129182458_patrol_checkpoints_table.sql` - NFC checkpoint locations with GPS coordinates (74 lines)
- `supabase/migrations/20260129182606_patrol_routes_table.sql` - Patrol routes with checkpoint sequence validation (97 lines)
- `supabase/migrations/20260129182644_patrol_logs_tables.sql` - Patrol and checkpoint logs with progress trigger (204 lines)

## Tables Created (4)

### patrol_checkpoints
- NFC tag locations with factory serial numbers (TEXT)
- GPS coordinates (lat/lng) with tolerance_meters for validation
- UNIQUE constraint on (community_id, nfc_serial)
- Physical location fields (building, floor, area)

### patrol_routes
- Ordered checkpoint sequences (UUID[])
- Schedule configuration (frequency_minutes, applicable_shifts)
- Validation trigger ensures all checkpoints exist in community
- Unique name per community

### patrol_logs
- Guard patrol sessions with progress counters
- checkpoints_total and checkpoints_visited (updated by trigger)
- Status: in_progress, completed, abandoned
- No soft delete (audit records)

### patrol_checkpoint_logs
- Individual NFC scans with GPS coordinates
- nfc_serial_scanned for verification
- gps_within_tolerance auto-calculated via trigger
- ON DELETE CASCADE from patrol_logs

## Functions Created (4)

1. **validate_patrol_route_checkpoints()** - Ensures checkpoint_sequence references valid checkpoints
2. **update_patrol_progress()** - Auto-increments checkpoints_visited on scan
3. **calculate_gps_distance_meters()** - Haversine formula for GPS distance
4. **validate_checkpoint_gps()** - Auto-sets gps_within_tolerance on insert

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| NFC serial as TEXT | Factory-assigned serial numbers are tamper-evident; NFC readers return serial directly |
| Haversine formula | Accurate for short distances (< 10km); simpler than full geodesic calculation |
| No deleted_at on patrol_logs | Patrol logs are immutable audit records |
| Trigger-based progress | Automatic completion when all checkpoints visited; prevents inconsistent state |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all migrations written successfully.

## Success Criteria Verification

- [x] patrol_checkpoints table has nfc_serial TEXT (not UUID) column
- [x] patrol_checkpoints has UNIQUE (community_id, nfc_serial) constraint
- [x] patrol_routes table has checkpoint_sequence UUID[] column
- [x] patrol_routes has validation trigger ensuring all checkpoints exist in community
- [x] patrol_logs tracks checkpoints_total and checkpoints_visited
- [x] patrol_checkpoint_logs has ON DELETE CASCADE from patrol_logs
- [x] update_patrol_progress() trigger auto-increments visited count
- [x] calculate_gps_distance_meters() function exists for GPS validation
- [x] gps_within_tolerance is auto-calculated on checkpoint scan
- [x] All 4 tables have RLS enabled with appropriate policies

## Next Phase Readiness

**Ready for 03-04 (Emergency Alerts):**
- Patrol infrastructure complete for guard monitoring
- GPS validation ready for emergency location tracking

**Dependencies satisfied:**
- guards table (from 03-01)
- communities table (from 01-02)
- generate_uuid_v7() function (from 01-01)
- set_audit_fields() function (from 01-01)
- general_status enum (from 01-01)

---
*Phase: 03-access-control-security*
*Completed: 2026-01-29*
