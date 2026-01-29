---
phase: 03-access-control-security
plan: 01
subsystem: access-control
tags: [access-points, guards, shifts, security-infrastructure]
dependency-graph:
  requires: [01-01, 01-02, 01-03]
  provides: [access_points_table, guards_tables, shift_management]
  affects: [03-02, 03-03, 03-04]
tech-stack:
  added: []
  patterns: [generated-columns, midnight-crossing-shifts, mexican-name-format]
key-files:
  created:
    - supabase/migrations/20260129121923_access_point_enums.sql
    - supabase/migrations/20260129122127_access_points_table.sql
    - supabase/migrations/20260129122207_guards_tables.sql
  modified: []
decisions:
  - "Guards separate from residents to support third-party security companies"
  - "Generated column for midnight-crossing shift detection"
  - "Shift assignments use date ranges with NULL effective_until for ongoing"
metrics:
  duration: 4 min
  completed: 2026-01-29
---

# Phase 3 Plan 01: Access Points & Guards Summary

Access control infrastructure with physical entry points and complete guard workforce management.

## One-Liner

Access point enums and table with hardware capabilities; guards, certifications, shifts, and assignments with midnight-crossing shift logic.

## What Was Built

### Enum Types (2)

1. **access_point_type** - 6 values for physical entry points:
   - vehicular_gate, pedestrian_gate, turnstile, barrier, door, elevator

2. **access_point_direction** - 3 values for traffic flow:
   - entry, exit, bidirectional

### Tables (5)

1. **access_points** - Physical entry/exit points
   - Hardware capability flags (LPR, camera, intercom, NFC, QR scanner)
   - Device IDs for future IoT integration
   - Operating hours support (NULL = 24/7)
   - Location with lat/lng for mapping
   - Unique name constraint per community

2. **guards** - Security personnel profiles
   - Mexican name format (first_name, paternal_surname, maternal_surname with generated full_name)
   - Optional user_id link for app access
   - Mexican ID fields (INE number, CURP)
   - Employment tracking (employee_number, hired_at, employment_status)

3. **guard_certifications** - Training and certification records
   - Certification type (security_license, first_aid, fire_safety, etc.)
   - Expiry tracking with indexed expires_at
   - Document URL for certificate storage

4. **guard_shifts** - Shift templates
   - Start/end times with applicable_days array (0=Sun through 6=Sat)
   - Generated `crosses_midnight` column for night shifts
   - Unique name per community

5. **shift_assignments** - Guard-shift-access point linkage
   - Date range with effective_from/effective_until
   - Prevents double-booking via unique constraint

### Functions (1)

- **get_guards_on_duty(access_point_id, check_time)** - Returns guards currently on duty
  - Handles midnight-crossing shifts correctly
  - Filters by applicable days of week
  - Checks date ranges and employment status

### RLS Policies (12 total, 3 per table)

All 4 main tables have consistent RLS pattern:
- super_admin_all_* - Platform admins see everything
- users_view_own_community_* - Users see their community's records
- admins_manage_* - Admin/manager roles can INSERT/UPDATE/DELETE

### Indexes (9)

Strategic indexes for common query patterns:
- Community lookups (all tables)
- Guard by user_id (for app authentication)
- Guard status filtering
- Certification expiry tracking
- Shift assignment by access point

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Guards separate from residents | Third-party security companies may staff guards who are not residents |
| Generated crosses_midnight column | Automatic detection of night shifts (22:00-06:00) for correct duty queries |
| NULL effective_until for ongoing | Indefinite assignments don't require end date |
| Device ID fields (lpr, camera, barrier) | Future-proofed for IoT hardware integration |
| Mexican ID fields on guards | INE and CURP required for security personnel verification |

## Deviations from Plan

None - plan executed exactly as written.

## Commit History

| Commit | Message | Files |
|--------|---------|-------|
| 3f7b251 | feat(03-01): create access point enum types | 20260129121923_access_point_enums.sql |
| 9736584 | feat(03-01): create access_points table with RLS | 20260129122127_access_points_table.sql |
| 76fb094 | feat(03-01): create guards and shift management tables | 20260129122207_guards_tables.sql |

## Success Criteria Verification

- [x] access_point_type enum has 6 values
- [x] access_point_direction enum has 3 values
- [x] access_points table with community_id FK, type, direction, capabilities
- [x] guards table with Mexican name format and optional user_id link
- [x] guard_certifications table with expiry tracking
- [x] guard_shifts table with crosses_midnight generated column
- [x] shift_assignments links guards to shifts at access_points
- [x] All 5 tables have RLS enabled with 3-policy pattern
- [x] get_guards_on_duty() function handles midnight-crossing shifts

## Next Phase Readiness

**Ready for 03-02 (Invitations & QR):**
- access_points table available for invitation destination
- Guard profiles ready for access log attribution

**Dependencies satisfied:**
- communities table (from 01-02)
- auth.users (Supabase built-in)
- set_audit_fields() function (from 01-01)
- generate_uuid_v7() function (from 01-01)
- general_status enum (from 01-01)
- phone_number domain (from 01-01)

## Files Created

```
supabase/migrations/
  20260129121923_access_point_enums.sql      (45 lines)
  20260129122127_access_points_table.sql    (127 lines)
  20260129122207_guards_tables.sql          (377 lines)
```

Total: 549 lines of SQL
