# Phase 10 Plan 05: Guard Directory & Package Management Summary

Guard directory search (residents by name/unit, vehicles by plate with blacklist alerts) and package management (pending list, log new package, pickup verification with code).

## Completed Tasks

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create directory and package data hooks and PackageCard component | b072f46 | useDirectory.ts, usePackages.ts, PackageCard.tsx |
| 2 | Implement directory screens and package screens | 7388ad2 | directory/index.tsx, directory/vehicles.tsx, packages/index.tsx, packages/log.tsx, packages/[id].tsx |

## What Was Built

### Directory Hooks (useDirectory.ts)
- **useResidentSearch**: PostgREST search on residents table with name ilike filter, joins occupancies->units via FK hint
- **useUnitSearch**: Unit number ilike search with nested occupancies->residents joins
- **useVehicleSearch**: Normalized plate search on vehicles with residents->occupancies->units chain
- **useBlacklistCheck**: Calls `is_blacklisted` RPC with optional person name, document, or plate

### Package Hooks (usePackages.ts)
- **usePendingPackages**: Fetches packages in received/stored/notified/pending_pickup statuses, client-side sorted by unit_number
- **usePackageDetail**: Single package with unit, resident, and pickup code relations
- **useLogPackage**: Insert mutation with carrier enum, guard received_by, auto-timestamp
- **useConfirmPickup**: Validates pickup code against package_pickup_codes table, marks used, updates package status

### PackageCard Component
- Memo'd pressable card showing carrier label, status badge, recipient, unit, package count, oversized indicator, relative time

### Directory Screens
- **Resident directory**: Debounced search (500ms), mode toggle (name/unit), blacklist alert, vehicle search link
- **Vehicle search**: Plate input with auto-capitalize, normalized search, access status badge, owner and unit info

### Package Screens
- **Pending list**: FlatList with unit section headers, pull-to-refresh, "Registrar Paquete" button
- **Log form**: Carrier chip picker (9 enum values), unit search dropdown with auto-fill, label photo upload, oversized toggle
- **Detail/pickup**: Package info card, photo display, 4-step timeline, pickup code input when required, confirm delivery button

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PostgREST FK hint for ambiguous occupancies relationship**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `occupancies` table has two FKs to `residents` (`resident_id` and `authorized_by`), causing PostgREST `SelectQueryError` when joining without hints
- **Fix:** Added `!occupancies_resident_id_fkey` FK hints in all nested select strings
- **Files modified:** packages/mobile/src/hooks/useDirectory.ts
- **Commit:** 7388ad2

**2. [Rule 2 - Missing Critical] Inline BlacklistAlert component**
- **Found during:** Task 2
- **Issue:** BlacklistAlert from 10-04 (parallel wave) not available; useGateOps.ts does not exist yet
- **Fix:** Created local BlacklistAlert component inline in directory screens and useBlacklistCheck hook in useDirectory.ts
- **Files modified:** useDirectory.ts, directory/index.tsx, directory/vehicles.tsx

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| FK hints in PostgREST select strings | Required to disambiguate occupancies->residents when authorized_by also references residents |
| Client-side sort for packages by unit | PostgREST cannot ORDER BY a joined table column; sort after fetch for unit grouping |
| Inline BlacklistAlert in screens | 10-04 runs in parallel; will be refactored to shared component when 10-04 merges |
| Local useBlacklistCheck hook | Same parallel wave reason; can be consolidated with useGateOps later |

## Verification

- [x] `npx tsc --noEmit` passes with zero errors
- [x] useResidentSearch returns residents with occupancies and unit details
- [x] useUnitSearch returns units with resident occupants
- [x] useVehicleSearch returns vehicles with owner and unit info
- [x] Directory search debounces input by 500ms before triggering query
- [x] BlacklistAlert appears inline when search name/plate matches blacklist
- [x] usePendingPackages returns packages sorted by unit_number
- [x] useLogPackage inserts package with received_by = guardId
- [x] useConfirmPickup validates pickup code before marking as picked_up
- [x] Package detail shows timeline and appropriate action buttons based on status

## Performance

- **Duration:** ~6.3 min
- **Completed:** 2026-02-08
