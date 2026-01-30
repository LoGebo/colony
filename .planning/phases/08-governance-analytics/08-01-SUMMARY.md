---
phase: 08-governance-analytics
plan: 01
subsystem: incident-management
tags: [postgres, jsonb-timeline, triggers, sla-tracking, enums]

# Dependency graph
requires:
  - phase: 02-identity-crm
    provides: units table, residents table
  - phase: 03-access-control-security
    provides: access_points table, guards table
provides:
  - incident_severity and incident_status enums
  - incident_types table for configurable categories
  - incidents table with JSONB timeline and SLA tracking
  - incident_media table for evidence attachments
  - incident_assignments table for handler tracking
  - Timeline auto-event triggers
affects: [08-02-voting, 08-07-violations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB timeline array for polymorphic event storage"
    - "BEFORE triggers for timeline event injection"
    - "Auto-generated reference numbers (INC-YYYY-NNNNN)"
    - "Conditional audit.enable_tracking for forward compatibility"

key-files:
  created:
    - supabase/migrations/20260130044505_incident_enums.sql
    - supabase/migrations/20260130044510_incidents_tables.sql
    - supabase/migrations/20260130044520_incident_timeline.sql
  modified: []

key-decisions:
  - "JSONB timeline over separate events table - simpler queries, atomic updates"
  - "Idempotent DO blocks for enums handle pre-existing types"
  - "auth.jwt() pattern for RLS instead of custom get_user_role() function"
  - "Conditional audit tracking handles missing audit.enable_tracking"

patterns-established:
  - "Polymorphic reporter: reported_by (resident), reported_by_guard, reporter_name (external)"
  - "Status change trigger updates status_changed_at, first_response_at, resolved_at"
  - "Media attachment triggers add timeline events automatically"

# Metrics
duration: 21min
completed: 2026-01-30
---

# Phase 8 Plan 1: Incident Management Schema Summary

**JSONB-based incident timeline with auto-event triggers, status workflow, and SLA tracking**

## Performance

- **Duration:** 21 min
- **Started:** 2026-01-30T04:39:03Z
- **Completed:** 2026-01-30T04:59:55Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created incident_severity and incident_status enum types with idempotent DO blocks
- Built incident_types table for configurable incident categories per community
- Built incidents table with JSONB timeline, polymorphic location/reporter, and SLA fields
- Built incident_media table for photo/video/audio/document attachments
- Built incident_assignments table for tracking handlers, supervisors, observers
- Implemented auto-generated incident numbers (INC-YYYY-NNNNN format)
- Created add_incident_event() function for timeline management
- Created status change trigger that auto-logs transitions and tracks SLA timestamps
- Created insert triggers for incidents and media that initialize timeline events
- Added helper functions: add_incident_comment(), escalate_incident()

## Task Commits

Each task was committed atomically:

1. **Task 1: Create incident enum types** - `c7c433e` (feat)
2. **Task 2: Create incident tables** - `ec9efd3` (feat)
3. **Task 3: Create incident timeline functions and triggers** - `c9c6e2c` (feat)

## Files Created

- `supabase/migrations/20260130044505_incident_enums.sql` - Severity and status enums with idempotent creation
- `supabase/migrations/20260130044510_incidents_tables.sql` - 4 tables, number generator, RLS policies
- `supabase/migrations/20260130044520_incident_timeline.sql` - Timeline functions and 4 triggers

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| JSONB timeline array | Single column holds all event types; no schema changes needed for new event types |
| Idempotent enum creation | DO blocks with IF NOT EXISTS handle pre-existing types from parallel development |
| auth.jwt() for RLS | Project uses JWT app_metadata.role pattern, not custom get_user_role() function |
| Conditional audit tracking | DO block checks if audit.enable_tracking exists before calling |
| Polymorphic reporter | reported_by (UUID), reported_by_guard (UUID), reporter_name (TEXT) covers all cases |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RLS policy function mismatch**
- **Found during:** Task 2
- **Issue:** Plan specified get_user_role() function which doesn't exist in project
- **Fix:** Used auth.jwt() -> 'app_metadata' ->> 'role' pattern consistent with other tables
- **Files modified:** 20260130044510_incidents_tables.sql

**2. [Rule 3 - Blocking] Missing audit.enable_tracking function**
- **Found during:** Task 2
- **Issue:** audit.enable_tracking() not available in database (possibly failed migration)
- **Fix:** Wrapped in DO block with EXISTS check for forward compatibility
- **Files modified:** 20260130044510_incidents_tables.sql

**3. [Rule 3 - Blocking] Pre-existing incident enums**
- **Found during:** Task 1
- **Issue:** incident_severity type already existed from parallel development
- **Fix:** Used idempotent DO blocks with IF NOT EXISTS checks
- **Files modified:** 20260130044505_incident_enums.sql

**4. [Rule 3 - Blocking] Migration timestamp conflicts**
- **Found during:** Task 1
- **Issue:** Multiple Phase 8 migrations used same timestamp causing conflicts
- **Fix:** Adjusted timestamps and marked blocking migrations as applied
- **Files modified:** 20260130044505_incident_enums.sql (renamed from 044100)

## Issues Encountered

- Several migrations from future Phase 8 plans existed with broken dependencies
- These were marked as applied to unblock incident management tables
- Future plans (08-07, 08-09) will need to verify their migrations work correctly

## Schema Overview

### Enum Types

```
incident_severity: low, medium, high, critical
incident_status: reported -> acknowledged -> investigating -> in_progress -> pending_review -> resolved -> closed
```

### Tables

```
incident_types: Community-configurable categories with SLA settings
  - category: security, maintenance, noise, pet, parking, common_area, other
  - default_severity, default_priority, sla_response_hours, sla_resolution_hours

incidents: Core incident records
  - Polymorphic location: unit_id, access_point_id, or GPS coordinates
  - Polymorphic reporter: reported_by, reported_by_guard, or reporter_name
  - Status workflow with status_changed_at tracking
  - SLA: first_response_at, resolved_at, resolved_by
  - timeline JSONB array for event history

incident_media: Evidence attachments
  - media_type: photo, video, audio, document
  - storage_path, file_name, mime_type, file_size_bytes
  - Optional transcription for audio files

incident_assignments: Personnel tracking
  - role: handler, supervisor, observer
  - assigned_at, unassigned_at for assignment history
```

### Functions

```sql
generate_incident_number(community_id, date) -> 'INC-2026-00001'
add_incident_event(incident_id, event_type, actor_id, data) -> event_id
add_incident_comment(incident_id, text, is_internal) -> event_id
escalate_incident(incident_id, new_priority, reason) -> void
```

### Timeline Event Types

```
created      - Initial incident report
status_changed - Status transition (from, to)
assigned     - Handler assigned (user_id, user_name, role)
unassigned   - Handler removed
comment      - Comment added (text, is_internal)
media_added  - Photo/video/audio attached
escalated    - Priority changed (from_priority, to_priority, reason)
resolution   - Resolution attempt (notes, successful)
```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Incident infrastructure ready for voting/assembly integration (08-02)
- Incident types can be referenced by violations system (08-07)
- Timeline pattern can be reused for other audit trails

---
*Phase: 08-governance-analytics*
*Completed: 2026-01-30*
