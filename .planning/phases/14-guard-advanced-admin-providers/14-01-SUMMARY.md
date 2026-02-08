---
phase: 14-guard-advanced-admin-providers
plan: 01
subsystem: infra
tags: [nfc, gps, patrol, incidents, providers, parking, moves, moderation, migrations, query-keys]

# Dependency graph
requires:
  - phase: 13-advanced-resident
    provides: "Established query key factory pattern, mobile tab layout conventions"
provides:
  - "shift_handovers table migration for guard handover notes"
  - "provider_work_orders table migration with auto-numbering and cost tracking"
  - "NFC, GPS, and haptics native dependencies for guard features"
  - "9 query key factories for all Phase 14 domains"
  - "Guard tab layout with Ronda and Incidentes tabs plus PanicButton slot"
  - "Admin sidebar with Proveedores, Estacionamiento, Mudanzas, Marketplace sections"
affects: [14-02, 14-03, 14-04, 14-05, 14-06]

# Tech tracking
tech-stack:
  added: [react-native-nfc-manager@3.17.2, expo-location@19.0.8, expo-haptics@15.0.8]
  patterns: [guard-tab-extension, admin-sidebar-extension, panic-button-slot-pattern]

key-files:
  created:
    - ".pending_migrations/20260208220000_shift_handovers.sql"
    - ".pending_migrations/20260208220100_provider_work_orders.sql"
  modified:
    - "packages/shared/src/queries/keys.ts"
    - "packages/mobile/app/(guard)/_layout.tsx"
    - "packages/admin/src/app/(dashboard)/layout.tsx"
    - "packages/mobile/package.json"
    - "packages/mobile/app.json"

key-decisions:
  - "PanicButton rendered outside Tabs in wrapper View (persistent across all guard screens)"
  - "Settings section kept last in admin sidebar (new sections inserted before it)"
  - "Heroicons outline SVG for new admin sidebar icons (truck, car, archive-box, shopping-bag)"

patterns-established:
  - "Guard tab layout extension: wrap Tabs in View for floating overlay components"
  - "Admin sidebar extension: add NavItem entries with icon cases in NavIcon switch"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 14 Plan 01: Foundations Summary

**Database migrations for shift_handovers and provider_work_orders, NFC/GPS/haptics native deps, 9 query key factories, guard tab layout with patrol/incidents tabs, admin sidebar with 4 new sections**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08T22:10:05Z
- **Completed:** 2026-02-08T22:14:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created shift_handovers migration with guard FK, community FK, priority levels, pending_items JSONB, acknowledgment tracking, 3 RLS policies, 3 indexes, and audit trigger
- Created provider_work_orders migration with auto-numbered WO-YYYY-NNNNN format, cost tracking (NUMERIC 15,4), status workflow (7 states), rating 1-5, provider stats update trigger, 3 RLS policies, 3 indexes, audit and soft-delete triggers
- Installed react-native-nfc-manager (3.17.2), expo-location (19.0.8), expo-haptics (15.0.8) and configured app.json plugins
- Added 9 query key factories (patrols, incidents, emergencies, handovers, providers, workOrders, parking, moves, moderation) and registered all in mergeQueryKeys
- Extended guard layout to 5 visible tabs (Caseta, Directorio, Paquetes, Ronda, Incidentes) with PanicButton placeholder slot
- Extended admin sidebar with Proveedores (+ Ordenes de Trabajo), Estacionamiento (+ Infracciones), Mudanzas, Marketplace (+ Categorias) sections with inline Heroicon SVGs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migrations and install native dependencies** - `cc154f2` (feat)
2. **Task 2: Add query key factories and update navigation layouts** - `4d7f149` (feat)

## Files Created/Modified
- `.pending_migrations/20260208220000_shift_handovers.sql` - Guard shift handover notes table with RLS, indexes, audit trigger
- `.pending_migrations/20260208220100_provider_work_orders.sql` - Provider work orders with auto-numbering, cost tracking, stats triggers
- `packages/shared/src/queries/keys.ts` - 9 new query key factories + mergeQueryKeys registration
- `packages/mobile/app/(guard)/_layout.tsx` - 2 new tabs (Ronda, Incidentes), View wrapper for PanicButton
- `packages/admin/src/app/(dashboard)/layout.tsx` - 4 new sidebar sections with Heroicon SVGs
- `packages/mobile/package.json` - 3 new native dependencies
- `packages/mobile/app.json` - NFC and location plugin configuration

## Decisions Made
- PanicButton rendered outside Tabs in a wrapper View for persistent visibility across all guard screens
- Settings section kept as last item in admin sidebar (new sections inserted before it)
- Used inline Heroicons outline SVGs for new sidebar icons (truck, car, archive-box, shopping-bag) matching existing pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 14 foundations in place: migrations ready, native deps installed, query keys registered, layouts extended
- Plans 14-02 through 14-06 are unblocked and can proceed
- Migrations need to be applied to live Supabase instance before handover and work order features work
- NFC testing requires EAS Build development client (not Expo Go)

---
*Phase: 14-guard-advanced-admin-providers*
*Completed: 2026-02-08*
