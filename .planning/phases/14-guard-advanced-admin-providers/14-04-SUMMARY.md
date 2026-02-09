---
phase: 14-guard-advanced-admin-providers
plan: 04
subsystem: emergency
tags: [emergency-alerts, panic-button, nfc, gps, provider-verification, expo-location, expo-haptics]

# Dependency graph
requires:
  - phase: 14-01
    provides: Guard tab layout with patrol/incidents tabs, emergency query keys
provides:
  - Persistent panic button on all guard screens
  - Emergency alert creation with GPS capture
  - Provider access verification
  - Emergency type selection (panic, medical, fire, intrusion)
affects: [admin-emergency-dashboard, emergency-notifications, provider-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Long-press activation with haptic feedback
    - Absolute positioning for persistent UI elements
    - GPS capture via expo-location at trigger time
    - RPC-based access authorization checks

key-files:
  created:
    - packages/mobile/src/hooks/useEmergency.ts
    - packages/mobile/src/components/guard/PanicButton.tsx
    - packages/mobile/src/components/guard/EmergencyTypeSheet.tsx
    - packages/mobile/src/components/guard/ProviderVerification.tsx
  modified:
    - packages/mobile/app/(guard)/_layout.tsx

key-decisions:
  - "PanicButton rendered outside Tabs component with absolute positioning for persistence across all screens"
  - "Long-press 2000ms delay prevents accidental emergency triggers"
  - "GPS capture is best-effort (continues without coordinates if permission denied)"
  - "Provider access check uses is_provider_access_allowed RPC (not client-side schedule logic)"

patterns-established:
  - "Floating persistent UI via absolute positioning in tab layout wrapper"
  - "Emergency type selection via bottom sheet modal (not separate screen)"
  - "Haptic feedback for critical actions (heavy impact on emergency activation)"

# Metrics
duration: 8min
completed: 2026-02-08
---

# Phase 14 Plan 04: Guard Emergency Summary

**Persistent panic button with GPS-enabled emergency alerts, provider access verification, and 4-type emergency classification**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-08T22:15:00Z
- **Completed:** 2026-02-08T22:23:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Persistent floating panic button accessible from all guard screens (absolute positioned outside Tabs)
- Emergency alert creation with automatic GPS coordinate capture via expo-location
- 4-type emergency classification (panic, medical, fire, intrusion) via bottom sheet selection
- Provider personnel search and access authorization verification via is_provider_access_allowed RPC
- Long-press activation (2000ms) with pulsing animation and haptic feedback to prevent accidental triggers

## Task Commits

Each task was committed atomically:

1. **Task 1: Emergency hooks and panic button components** - `a05276e` (feat)
2. **Task 2: Wire panic button into guard layout** - `5983ec7` (feat)

**Plan metadata:** (pending in final commit)

## Files Created/Modified

**Created:**
- `packages/mobile/src/hooks/useEmergency.ts` - Emergency hooks (trigger, active list, provider access check, personnel search)
- `packages/mobile/src/components/guard/PanicButton.tsx` - Floating panic button with long-press activation
- `packages/mobile/src/components/guard/EmergencyTypeSheet.tsx` - Emergency type selection modal
- `packages/mobile/src/components/guard/ProviderVerification.tsx` - Provider personnel search and access verification

**Modified:**
- `packages/mobile/app/(guard)/_layout.tsx` - Added PanicButton import and render (outside Tabs, inside wrapper View)

## Decisions Made

1. **PanicButton positioning:** Rendered outside Tabs component but inside wrapper View with absolute positioning (bottom: 90 to clear tab bar, right: 16). This ensures the button floats above all tab content and remains accessible on every guard screen.

2. **Long-press activation:** 2000ms delay with visual pulsing animation prevents accidental emergency triggers. Short press shows tooltip instructing user to hold.

3. **GPS capture strategy:** Best-effort GPS via expo-location getCurrentPositionAsync at trigger time. If permission denied or GPS unavailable, emergency alert continues without coordinates (location_lat/location_lng nullable).

4. **Provider access verification:** Uses is_provider_access_allowed RPC (not client-side schedule logic) to check if provider is within authorized time window. Search uses provider_personnel table with join to providers for company name.

5. **Emergency type flow:** Bottom sheet modal (not separate screen) for type selection. After selection, shows green confirmation for 2s then auto-closes sheet.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next plan (14-05: Admin Providers).**

Emergency system complete on guard mobile side. Admin dashboard provider management can now reference the provider access verification patterns built here.

**Technical notes for future work:**
- Emergency responders junction table exists but not yet used (future: assign responders, track response SLA)
- Emergency priority auto-set by DB trigger based on type (panic/fire → critical, medical → high, intrusion → medium)
- Emergency timeline auto-updated by triggers when responder status changes
- ProviderVerification component can be used as modal/sheet from gate screen (not integrated in this plan)

---
*Phase: 14-guard-advanced-admin-providers*
*Completed: 2026-02-08*
