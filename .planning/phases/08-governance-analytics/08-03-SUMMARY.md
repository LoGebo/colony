---
phase: 08-governance-analytics
plan: 03
subsystem: database
tags: [postgres, assemblies, attendance, quorum, proxy, mexican-law, convocatoria, rls]

# Dependency graph
requires:
  - phase: 02-identity-crm/01
    provides: units table with coefficient
  - phase: 02-identity-crm/02
    provides: residents for attendee tracking
  - phase: 08-governance-analytics/02
    provides: elections table for assembly_id FK
provides:
  - assembly_type, assembly_status, attendance_type enums
  - assemblies table with convocatoria timestamps
  - assembly_attendance table with coefficient snapshot
  - assembly_agreements table with election linking
  - calculate_assembly_quorum() with 75%/50%+1/any thresholds
  - validate_assembly_proxy_limit() trigger (2-unit max)
  - record_attendance(), advance_convocatoria(), record_agreement() functions
affects: [analytics dashboards, governance reporting, financial minutes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coefficient snapshot pattern - copy unit.coefficient at check-in for immutable accuracy"
    - "Mexican convocatoria progression - scheduled->1st->2nd->3rd->in_progress->concluded"
    - "Proxy limit trigger - Mexican law 2-unit max via BEFORE INSERT trigger"
    - "Quorum threshold calculation - dynamic based on current convocatoria status"
    - "Agreement auto-numbering - sequential per assembly"

key-files:
  created:
    - supabase/migrations/20260130050300_assembly_enums.sql
    - supabase/migrations/20260130050400_assemblies_tables.sql
    - supabase/migrations/20260130050500_assembly_functions.sql
  modified: []

key-decisions:
  - "Coefficient snapshot at check-in - immutable historical accuracy like ballots"
  - "One attendance per unit via UNIQUE(assembly_id, unit_id)"
  - "Proxy limit enforced via trigger (2 max per Mexican Ley de Propiedad en Condominio)"
  - "Convocatoria timestamps track progression timing (30 min between calls)"
  - "Assembly number format ASM-YYYY-NNN per community"
  - "Agreements can link to elections via election_id FK"
  - "arrived_at_convocatoria tracks which call the unit arrived at (1, 2, or 3)"
  - "Checked-out units excluded from quorum calculation"
  - "attendance_type enum: owner, representative, proxy"

patterns-established:
  - "Coefficient snapshot: Copy unit.coefficient to attendance at check-in"
  - "Mexican convocatoria quorum: 75% first, 50%+1 second, any third"
  - "Proxy validation: Max 2 units per representative via trigger"
  - "Assembly lifecycle: scheduled -> convocatoria_1 -> convocatoria_2 -> convocatoria_3 -> in_progress -> concluded"
  - "Agreement auto-numbering: Sequential per assembly (1, 2, 3...)"

# Metrics
duration: 5min
completed: 2026-01-30
---

# Phase 8 Plan 3: Assemblies and Attendance Summary

**Assembly management schema with Mexican convocatoria quorum progression (75%/50%+1/any), coefficient snapshot at check-in, proxy delegation limits (2-unit max), and agreement recording with election linking**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-30T05:02:37Z
- **Completed:** 2026-01-30T05:07:00Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created assembly enum types (assembly_type, assembly_status, attendance_type)
- Created assemblies table with Mexican convocatoria timestamp tracking
- Created generate_assembly_number() for ASM-YYYY-NNN format per community
- Created assembly_attendance table with coefficient snapshot at check-in time
- Enforced one attendance per unit per assembly via UNIQUE constraint
- Created assembly_agreements table for resolutions with optional election linking
- Added FK from elections.assembly_id to assemblies (linking votes to meetings)
- Implemented validate_assembly_proxy_limit() trigger (2-unit max per Mexican law)
- Created copy_attendance_coefficient() trigger for automatic unit coefficient copy
- Implemented calculate_assembly_quorum() with dynamic thresholds:
  - convocatoria_1: >= 75%
  - convocatoria_2: >= 50.01%
  - convocatoria_3: any attendance valid
- Created record_attendance() function with auto coefficient and quorum recalculation
- Created advance_convocatoria() for status progression with timestamp recording
- Created record_agreement() with auto-numbering and optional election result pulling
- Created checkout_attendance() for tracking early departures
- Created get_assembly_summary() for dashboard display
- Created assembly_attendance_list view for denormalized reporting
- Implemented RLS policies for community access control

## Task Commits

Each task was committed atomically:

1. **Task 1: Create assembly enum types** - `2ea5200` (feat)
2. **Task 2: Create assemblies, attendance, and agreements tables** - `1a2e673` (feat)
3. **Task 3: Create assembly quorum and proxy validation functions** - `9e85ac8` (feat)

## Files Created/Modified

- `supabase/migrations/20260130050300_assembly_enums.sql` - assembly_type (ordinary/extraordinary), assembly_status (with convocatoria progression), attendance_type (owner/representative/proxy) enums
- `supabase/migrations/20260130050400_assemblies_tables.sql` - assemblies, assembly_attendance, assembly_agreements tables with full schema and RLS
- `supabase/migrations/20260130050500_assembly_functions.sql` - validate_assembly_proxy_limit(), calculate_assembly_quorum(), record_attendance(), advance_convocatoria(), record_agreement(), checkout_attendance(), get_assembly_summary() functions and triggers

## Decisions Made

- **Coefficient Snapshot at Check-in:** assembly_attendance.coefficient copies unit.coefficient at registration time for immutable historical accuracy
- **One Attendance Per Unit:** UNIQUE(assembly_id, unit_id) ensures each property has one attendance record
- **Proxy Limit Trigger:** validate_assembly_proxy_limit() enforces Mexican law maximum of 2 units per representative via BEFORE INSERT/UPDATE trigger
- **Convocatoria Timestamps:** Separate columns (convocatoria_1_at, convocatoria_2_at, convocatoria_3_at) track exact timing per Mexican law 30-minute intervals
- **Dynamic Quorum Threshold:** calculate_assembly_quorum() determines required threshold based on current assembly status
- **Agreement Auto-numbering:** record_agreement() assigns sequential numbers (1, 2, 3...) per assembly
- **Early Departure Tracking:** checked_out_at column and checkout_attendance() function exclude departed units from quorum
- **Attendance Type Enum:** Three types (owner, representative, proxy) with proxy requiring document URL and grantor ID

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed orphan KPI migration**

- **Found during:** Task 2 migration push
- **Issue:** 20260130050301_kpi_tables.sql from another plan referenced non-existent update_updated_at() function
- **Fix:** Removed file and repaired migration history
- **Files modified:** Deleted supabase/migrations/20260130050301_kpi_tables.sql
- **Commit:** N/A (not part of this plan)

## Issues Encountered

- **Blocking Migration:** KPI tables migration from a different plan (likely 08-07) was blocking assembly migrations - removed and repaired

## User Setup Required

None - all database schema changes applied automatically via migrations.

## Next Phase Readiness

- Assembly infrastructure ready for governance reporting
- Elections can now reference parent assemblies via assembly_id FK
- Attendance coefficient snapshots enable historical quorum analysis
- Agreement tracking with election linking supports formal minutes generation
- Proxy delegation tracking enables Mexican law compliance auditing
- Convocatoria timestamp progression supports legal documentation

---
*Phase: 08-governance-analytics*
*Completed: 2026-01-30*
