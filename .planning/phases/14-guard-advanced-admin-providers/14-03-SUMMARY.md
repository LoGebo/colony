---
phase: 14-guard-advanced-admin-providers
plan: 03
subsystem: mobile-guard
tags: [react-native, expo, incidents, handovers, supabase, timeline, media-upload]

# Dependency graph
requires:
  - phase: 14-01
    provides: Guard patrol infrastructure and hooks
provides:
  - Guard incident reporting with photo upload, GPS capture, and JSONB timeline
  - Shift handover notes with priority levels and pending items
  - Incident detail view with media gallery and comment system
  - Handover acknowledgment workflow
affects: [14-05, admin-incidents]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSONB timeline rendering with type-specific event components
    - Media upload to incident-evidence bucket with Storage.upload
    - RPC calls for incident comments (add_incident_comment)
    - Enum casting with 'as never' for severity, priority
    - Floating action button (FAB) for create actions

key-files:
  created:
    - packages/mobile/src/hooks/useIncidents.ts
    - packages/mobile/src/hooks/useHandovers.ts
    - packages/mobile/src/components/guard/IncidentTimelineItem.tsx
    - packages/mobile/src/components/guard/HandoverNoteCard.tsx
    - packages/mobile/app/(guard)/incidents/_layout.tsx
    - packages/mobile/app/(guard)/incidents/index.tsx
    - packages/mobile/app/(guard)/incidents/create.tsx
    - packages/mobile/app/(guard)/incidents/[id].tsx
    - packages/mobile/app/(guard)/incidents/handover.tsx
  modified: []

key-decisions:
  - Use JSONB timeline array from database with client-side sorting for incident history
  - Support up to 5 photos per incident with expo-image-picker
  - GPS coordinates optional (graceful fallback if permission denied)
  - Handover acknowledgment updates timestamp and guard_id directly

patterns-established:
  - Timeline event rendering: IncidentTimelineItem component handles all event types with color coding
  - Handover priority system: normal/important/urgent with visual color accents
  - Pending items as JSONB array with completed boolean flag

# Metrics
duration: 5 min
completed: 2026-02-09
---

# Phase 14 Plan 03: Guard Incidents and Handover Summary

**Guard incident reporting system with photo evidence, GPS tracking, JSONB timeline, and shift handover notes with priority and pending items**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-09T01:13:58Z
- **Completed:** 2026-02-09T01:18:46Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Complete incident management workflow: create with photos/GPS → view detail with timeline → add follow-up comments
- Shift handover notes system with priority levels, pending items checklist, and acknowledgment tracking
- JSONB timeline rendering with 6 event types (created, status_changed, assigned, comment, media_added, escalated)
- Media upload to incident-evidence Storage bucket with up to 5 photos per incident

## Task Commits

Each task was committed atomically:

1. **Task 1: Incident and handover data hooks plus timeline components** - `a26ce0b` (feat)
2. **Task 2: Incident screens (list, create, detail) and handover screen** - `6ddc398` (feat)

## Files Created/Modified

- `packages/mobile/src/hooks/useIncidents.ts` - 6 hooks: types, list, detail, create, comment (RPC), media upload
- `packages/mobile/src/hooks/useHandovers.ts` - 4 hooks: recent, unacknowledged, create, acknowledge
- `packages/mobile/src/components/guard/IncidentTimelineItem.tsx` - Timeline event renderer with type-specific colors
- `packages/mobile/src/components/guard/HandoverNoteCard.tsx` - Handover note display with priority, pending items, acknowledgment
- `packages/mobile/app/(guard)/incidents/_layout.tsx` - Stack layout for incident screens
- `packages/mobile/app/(guard)/incidents/index.tsx` - Incident list with severity/status badges, FAB, handover count badge
- `packages/mobile/app/(guard)/incidents/create.tsx` - Create incident form with photo upload (expo-image-picker), GPS capture (expo-location)
- `packages/mobile/app/(guard)/incidents/[id].tsx` - Incident detail with JSONB timeline, media gallery, comment input
- `packages/mobile/app/(guard)/incidents/handover.tsx` - Shift handover notes with create form and recent notes list

## Decisions Made

- **Timeline rendering approach**: Parse JSONB timeline array from incidents.timeline column and render with client-side sorting. The database stores all events in a single JSONB array which is more efficient than querying a separate events table.
- **Photo upload limit**: Capped at 5 photos per incident to prevent excessive storage usage and improve loading performance. Guards can add more photos via follow-up if needed.
- **GPS optional behavior**: If location permission is denied, incident creation continues without GPS coordinates. GPS is helpful but not critical for incident reporting.
- **Handover acknowledgment**: Updates acknowledged_by and acknowledged_at directly on the shift_handovers row. No separate acknowledgment table needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all existing hooks and components from partial execution were complete and functional.

## Next Phase Readiness

- Incident and handover features ready for guard testing
- Database already has shift_handovers table (created in previous migration)
- RPC functions (add_incident_comment) and triggers (timeline updates) working as expected
- Admin incident management screens can be built next (viewing/managing incidents from dashboard)

---
*Phase: 14-guard-advanced-admin-providers*
*Completed: 2026-02-09*
