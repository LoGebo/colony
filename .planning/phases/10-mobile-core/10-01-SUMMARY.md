---
phase: 10-mobile-core
plan: 01
subsystem: mobile-foundation
tags: [react-native, expo, dashboard, hooks, ui-components, date-utils, navigation]
depends_on:
  requires: [phase-09]
  provides: [shared-ui-components, date-utilities, community-hook, occupancy-hook, resident-dashboard, guard-dashboard, navigation-layouts]
  affects: [10-02, 10-03, 10-04, 10-05]
tech_stack:
  added: [expo-camera, expo-sharing, expo-file-system, react-native-qrcode-svg, date-fns]
  patterns: [query-key-factories, dashboard-cards, stack-navigators, react-memo-flatlist]
key_files:
  created:
    - packages/mobile/src/lib/dates.ts
    - packages/mobile/src/hooks/useCommunity.ts
    - packages/mobile/src/hooks/useOccupancy.ts
    - packages/mobile/src/components/ui/Card.tsx
    - packages/mobile/src/components/ui/Badge.tsx
    - packages/mobile/src/components/ui/EmptyState.tsx
    - packages/mobile/src/components/ui/LoadingSpinner.tsx
    - packages/mobile/app/(resident)/visitors/_layout.tsx
    - packages/mobile/app/(resident)/payments/_layout.tsx
    - packages/mobile/app/(guard)/gate/_layout.tsx
    - packages/mobile/app/(guard)/directory/_layout.tsx
    - packages/mobile/app/(guard)/packages/_layout.tsx
  modified:
    - packages/mobile/package.json
    - packages/mobile/app.json
    - packages/shared/src/queries/keys.ts
    - packages/mobile/app/(resident)/index.tsx
    - packages/mobile/app/(guard)/_layout.tsx
    - packages/mobile/app/(guard)/index.tsx
decisions:
  - id: occupancy-primary-resolution
    decision: "Use occupancy_type='owner' priority instead of is_primary column (which does not exist on occupancies table)"
    rationale: "Plan referenced is_primary on occupancies but DB schema has occupancy_type enum (owner/tenant/authorized/employee). Owner takes priority."
metrics:
  duration: 6.5 min
  completed: 2026-02-08
---

# Phase 10 Plan 01: Foundation, Dashboards & Navigation Summary

**One-liner:** Shared UI primitives (Card, Badge, EmptyState, LoadingSpinner), date-fns Spanish utilities, community/occupancy hooks, resident balance+visitors dashboard, guard gate dashboard with QR scan and manual check-in buttons, plus 5 Stack navigators for sub-routes.

## What Was Done

### Task 1: Install dependencies, configure plugins, create shared utilities and UI components

- Installed 5 new Expo/RN dependencies: expo-camera, expo-sharing, expo-file-system, react-native-qrcode-svg, date-fns
- Updated app.json with expo-camera plugin and Spanish camera permission message
- Created `dates.ts` with 8 exports: formatDate, formatDateTime, formatTime, formatRelative, formatCurrency, isExpired, isUpcoming, DAY_LABELS
- Created 4 shared UI components: DashboardCard, SectionCard, StatusBadge, EmptyState, LoadingSpinner
- Added packages, occupancies, shifts query key factories to shared keys.ts

### Task 2: Create data hooks, navigation layouts, and implement both dashboards

- Created `useCommunityBranding` hook: queries communities table for name, logo, colors
- Created `useResidentOccupancy` + `useResidentUnit` hooks: resolves resident's primary unit via occupancy_type priority
- Created 5 Stack navigator layouts: visitors, payments, gate, directory, packages
- Updated guard tab layout: Caseta, Directorio, Paquetes (removed visitors/patrol/incidents tabs)
- Implemented resident dashboard: community name header, balance DashboardCard (with overdue indicator), active visitors count card, pull-to-refresh, router.push navigation
- Implemented guard dashboard: community name + "Caseta" header, two action buttons (Escanear QR, Registro Manual), expected visitors FlatList with React.memo rows, EmptyState fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] occupancies table lacks is_primary column**

- **Found during:** Task 2 (useOccupancy hook creation)
- **Issue:** Plan specified `.order('is_primary', { ascending: false })` but the occupancies table has no `is_primary` column. It uses `occupancy_type` enum (owner/tenant/authorized/employee) instead.
- **Fix:** Changed query to order by `start_date` descending and use `occupancy_type === 'owner'` as priority selection in `useResidentUnit()`.
- **Files modified:** packages/mobile/src/hooks/useOccupancy.ts

## Verification Results

| Check | Status |
|-------|--------|
| `cd packages/mobile && npx tsc --noEmit` | PASSED |
| `cd packages/shared && npx tsc --noEmit` | PASSED |
| UI components export DashboardCard, SectionCard, StatusBadge, EmptyState, LoadingSpinner | PASSED |
| Date utilities export 8 items (formatDate, formatDateTime, formatTime, formatRelative, formatCurrency, isExpired, isUpcoming, DAY_LABELS) | PASSED |
| useCommunityBranding queries communities with enabled guard | PASSED |
| useResidentOccupancy queries occupancies with enabled guard | PASSED |
| Resident dashboard uses DashboardCard, useCommunityBranding, useResidentUnit, formatCurrency, router.push | PASSED |
| Guard dashboard uses EmptyState, router.push for gate ops, FlatList for visitors | PASSED |
| Guard _layout.tsx has 3 tabs: Caseta, Directorio, Paquetes | PASSED |
| 5 Stack navigators exist | PASSED |

## Commits

| Hash | Message |
|------|---------|
| f4043d0 | feat(10-01): install dependencies, create shared UI components and date utilities |
| 266f0f8 | feat(10-01): implement dashboards, data hooks, and navigation layouts |

## Next Phase Readiness

All shared infrastructure is in place for downstream plans:
- **10-02** (Visitor Invitations): Can use visitors Stack layout, DashboardCard, StatusBadge, date utilities, useCommunityBranding
- **10-03** (Payments): Can use payments Stack layout, DashboardCard, formatCurrency, useResidentUnit
- **10-04** (Guard Gate): Can use gate Stack layout, expo-camera, EmptyState, LoadingSpinner
- **10-05** (Directory/Packages): Can use directory + packages Stack layouts, query key factories
