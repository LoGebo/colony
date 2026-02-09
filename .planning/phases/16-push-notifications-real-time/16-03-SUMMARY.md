---
phase: 16-push-notifications-real-time
plan: 03
subsystem: realtime
tags: [supabase-realtime, postgres-changes, react-query, notifications, preferences]

# Dependency graph
requires:
  - phase: 16-01
    provides: Push notification infrastructure with edge functions and in-app notifications
provides:
  - Generic useRealtimeSubscription hook for Supabase Realtime postgres_changes
  - Real-time visitor invitation updates for residents
  - Real-time expected visitor queue for guards
  - Notification preferences management (per-type toggles, quiet hours)
  - NotificationPreferences UI component with settings persistence
affects: [visitor-management, guard-operations, notification-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Supabase Realtime subscriptions with TanStack Query invalidation
    - JSON column preferences storage pattern (residents.notification_preferences)
    - Real-time hook composition (wrapping base query with realtime subscriptions)

key-files:
  created:
    - packages/mobile/src/hooks/useRealtimeSubscription.ts
    - packages/mobile/src/hooks/useNotificationPreferences.ts
    - packages/mobile/src/components/notifications/NotificationPreferences.tsx
    - packages/mobile/app/(resident)/more/notification-settings.tsx
  modified:
    - packages/mobile/src/hooks/useVisitors.ts
    - packages/mobile/src/hooks/useGateOps.ts

key-decisions:
  - "Real-time subscriptions use stable channel names (no Date.now()) to prevent re-subscription churn"
  - "Emergency alerts cannot be disabled (always on, enforced in UI)"
  - "Notification preferences stored as JSONB in residents table (flexible, no schema changes needed)"
  - "Separate real-time hooks (useActiveInvitationsRealtime) allow opt-in behavior"

patterns-established:
  - "useRealtimeSubscription: Generic hook for any postgres_changes subscription with automatic query invalidation"
  - "Real-time composition: Wrap base query with useRealtimeSubscription calls for live updates"
  - "Preferences pattern: JSON column + default merge for backward compatibility"

# Metrics
duration: 6min
completed: 2026-02-09
---

# Phase 16 Plan 03: Real-time Subscriptions & Notification Preferences Summary

**Real-time visitor updates via Supabase postgres_changes with automatic TanStack Query invalidation, plus notification preference settings with per-type toggles and quiet hours**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-09T02:46:17Z
- **Completed:** 2026-02-09T02:52:32Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Generic useRealtimeSubscription hook eliminates manual refreshing for time-sensitive data
- Residents see visitor status changes in real-time (invitation updates, access logs)
- Guards see new expected visitors appear instantly (invitations, check-ins)
- Residents can customize notification preferences (10 notification types + quiet hours)
- Emergency alerts always enabled (cannot be disabled for safety)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useRealtimeSubscription hook and wire into visitor/gate hooks** - `c6e709c` (feat)
2. **Task 2: Create notification preferences screen and hooks** - `a1f8a2f` (feat)

## Files Created/Modified

### Created
- `packages/mobile/src/hooks/useRealtimeSubscription.ts` - Generic Supabase Realtime hook with TanStack Query invalidation
- `packages/mobile/src/hooks/useNotificationPreferences.ts` - Load/save notification preferences from residents.notification_preferences JSON
- `packages/mobile/src/components/notifications/NotificationPreferences.tsx` - Settings UI with per-type toggles, master toggle, quiet hours
- `packages/mobile/app/(resident)/more/notification-settings.tsx` - Notification settings route screen

### Modified
- `packages/mobile/src/hooks/useVisitors.ts` - Added useActiveInvitationsRealtime for real-time visitor updates
- `packages/mobile/src/hooks/useGateOps.ts` - Added useExpectedVisitorsRealtime for real-time guard queue

## Decisions Made

**1. Stable channel names for real-time subscriptions**
- Using deterministic channel names like `invitations-${residentId}` instead of `invitations-${Date.now()}`
- Prevents subscription churn (creating new channels on every render)
- Proper cleanup via useEffect return ensures no memory leaks

**2. Separate real-time hooks for opt-in behavior**
- Created `useActiveInvitationsRealtime` alongside existing `useActiveInvitations`
- Screens can opt into real-time by importing the realtime variant
- Preserves backward compatibility, allows gradual adoption

**3. Emergency alerts always enabled**
- `emergency_alert` preference forced to `true` in UI (disabled switch)
- Critical for community safety (fire, evacuation, security threats)
- Cannot be toggled off by residents

**4. JSON column for preferences storage**
- Used `residents.notification_preferences` JSONB column
- Flexible schema: new notification types can be added without migrations
- Default preferences merged with stored preferences for backward compatibility

**5. Notification preferences resident-only for v1**
- Guards table may not have `notification_preferences` column
- Guards receive all notifications (no preferences)
- Can be extended later by adding JSON column to guards table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing TypeScript errors in guard screens**
- Found unrelated type errors in patrol, incidents, provider screens
- Errors due to database schema mismatches (missing columns: `gps_latitude`, `severity_default`, etc.)
- Did not fix (outside scope of this plan)
- New code compiles without errors

## Next Phase Readiness

**Real-time infrastructure complete:**
- Generic `useRealtimeSubscription` hook can be reused for any table
- Visitor and guard queues update live
- No manual refresh needed for time-sensitive data

**Notification system complete:**
- Push notifications (16-01)
- In-app notification list (16-01)
- Real-time updates (16-03)
- User preferences (16-03)

**Ready for phase completion and production testing**

---
*Phase: 16-push-notifications-real-time*
*Completed: 2026-02-09*
