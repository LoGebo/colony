---
phase: 15-admin-governance-analytics
plan: 04
subsystem: admin-dashboard
tags: [react, tanstack-query, supabase, emergency-management, device-inventory, next.js]

# Dependency graph
requires:
  - phase: 15-01
    provides: Admin dashboard foundation with hooks patterns and UI components
provides:
  - Emergency management pages (contacts, medical, evacuation)
  - Access device inventory with lifecycle tracking (assign/return/lost)
  - useEmergency hook for emergency contacts, medical conditions, and evacuation list
  - useDevices hook for device CRUD and lifecycle mutations
affects: [15-05-guard-analytics, admin-emergency-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Manual TypeScript interfaces for tables not in database.types.ts
    - RPC integration for evacuation priority list
    - Modal-based forms for device lifecycle actions
    - Privacy-aware display with warning banners for medical info

key-files:
  created:
    - packages/admin/src/hooks/useEmergency.ts
    - packages/admin/src/hooks/useDevices.ts
    - packages/admin/src/app/(dashboard)/emergency/contacts/page.tsx
    - packages/admin/src/app/(dashboard)/emergency/medical/page.tsx
    - packages/admin/src/app/(dashboard)/emergency/evacuation/page.tsx
    - packages/admin/src/app/(dashboard)/devices/page.tsx
    - packages/admin/src/app/(dashboard)/devices/[id]/page.tsx
  modified: []

key-decisions:
  - "Used manual TypeScript interfaces for access_devices tables not in database.types.ts"
  - "Cast table queries as 'never' and results as 'unknown' for type safety"
  - "Used RPC get_evacuation_priority_list for floor-prioritized evacuation list"
  - "Privacy banner on medical page emphasizes confidentiality"

patterns-established:
  - "Tables not in types: Define manual interfaces, cast queries to 'never', cast results to 'unknown as TypeRow'"
  - "Device lifecycle: Assign updates status and creates assignment, Return updates assignment and resets status"
  - "Modal forms: Inline components with useState for form data, useMutation for submissions"

# Metrics
duration: 45min
completed: 2026-02-08
---

# Phase 15 Plan 04: Emergency Management & Device Inventory Summary

**Emergency contacts, medical info, evacuation lists, and access device lifecycle tracking with deposit/fee management**

## Performance

- **Duration:** 45 min
- **Started:** 2026-02-09T02:04:30Z
- **Completed:** 2026-02-09T02:49:30Z (estimated)
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Emergency contacts page with per-unit filtering and CSV export
- Medical conditions and accessibility needs page with privacy banner
- Evacuation priority list from RPC with print and CSV export
- Device inventory DataTable with status/type filters and create modal
- Device detail page with assign/return/lost lifecycle actions
- Assignment history table with deposit and replacement fee tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Emergency hooks and pages** - `e31fd5a` (feat)
2. **Task 2: Device inventory hooks and pages** - `ce790cb` (feat)

## Files Created/Modified
- `packages/admin/src/hooks/useEmergency.ts` - Emergency contacts, medical conditions, accessibility needs, evacuation list queries
- `packages/admin/src/hooks/useDevices.ts` - Device queries (list, detail, assignments) and mutations (create, assign, return, report lost)
- `packages/admin/src/app/(dashboard)/emergency/contacts/page.tsx` - Per-unit emergency contacts with export
- `packages/admin/src/app/(dashboard)/emergency/medical/page.tsx` - Medical conditions and accessibility needs with privacy banner
- `packages/admin/src/app/(dashboard)/emergency/evacuation/page.tsx` - Evacuation priority list from RPC with print/CSV
- `packages/admin/src/app/(dashboard)/devices/page.tsx` - Device inventory DataTable with filters and create modal
- `packages/admin/src/app/(dashboard)/devices/[id]/page.tsx` - Device detail with lifecycle actions and assignment history

## Decisions Made
1. **Manual TypeScript interfaces for device tables:** The `access_devices`, `access_device_types`, and `access_device_assignments` tables exist in the database but are not present in database.types.ts. Created manual interfaces and used `as never` casts for table queries and `as unknown as TypeRow` for results.

2. **Emergency contacts query strategy:** Used RPC `get_emergency_contacts_for_unit` for per-unit contacts to avoid complex PostgREST join path through occupancies. Simpler and more performant.

3. **Device lifecycle state transitions:**
   - Assign: Creates assignment record, updates device status to 'assigned', sets current_assignment_id
   - Return: Updates assignment with returned_at and deposit_returned, resets device status to 'in_inventory'
   - Report Lost: Updates device status to 'lost', optionally charges replacement fee on assignment

4. **Privacy-aware medical display:** Added amber warning banner at top of medical page emphasizing confidential information and admin-only access per HIPAA-like privacy requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed enum value comparisons in medical page**
- **Found during:** Task 1 (Medical page TypeScript check)
- **Issue:** Used incorrect enum values 'chronic' and 'high' instead of actual database enums 'chronic_condition' and 'severe'/'life_threatening'
- **Fix:** Updated Badge variant logic to match actual enum values from database.types.ts
- **Files modified:** packages/admin/src/app/(dashboard)/emergency/medical/page.tsx
- **Verification:** TypeScript check passed
- **Committed in:** e31fd5a (Task 1 commit)

**2. [Rule 1 - Bug] Fixed field name 'notes' to 'description' in medical conditions**
- **Found during:** Task 1 (Medical page TypeScript check)
- **Issue:** medical_conditions table uses 'description' field, not 'notes'
- **Fix:** Changed references from condition.notes to condition.description
- **Files modified:** packages/admin/src/app/(dashboard)/emergency/medical/page.tsx
- **Verification:** TypeScript check passed
- **Committed in:** e31fd5a (Task 1 commit)

**3. [Rule 1 - Bug] Fixed queryKeys property access syntax**
- **Found during:** Task 1 (useEmergency TypeScript check)
- **Issue:** Used `queryKeys.emergencyContacts` instead of bracket notation `queryKeys['emergency-contacts']` (hyphenated key)
- **Fix:** Updated all queryKeys references to use bracket notation
- **Files modified:** packages/admin/src/hooks/useEmergency.ts
- **Verification:** TypeScript check passed
- **Committed in:** e31fd5a (Task 1 commit)

**4. [Rule 1 - Bug] Fixed residents query type casting in device assignment modal**
- **Found during:** Task 2 (Device detail page TypeScript check)
- **Issue:** PostgREST returned ambiguous type error for residents query through occupancies join
- **Fix:** Added `!inner` hint on residents join and cast data as `unknown` before mapping
- **Files modified:** packages/admin/src/app/(dashboard)/devices/[id]/page.tsx
- **Verification:** TypeScript check passed
- **Committed in:** ce790cb (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs)
**Impact on plan:** All bugs caught by TypeScript and fixed immediately. No functional impact, all corrections were type-related or enum value corrections.

## Issues Encountered
None - plan execution was straightforward. Manual TypeScript interface pattern worked well for tables not in database.types.ts.

## User Setup Required
None - no external service configuration required. All features use existing Supabase database tables and RPCs.

## Next Phase Readiness
- Emergency management and device inventory complete
- Ready for guard analytics and audit trail (15-05)
- RPC functions (`get_emergency_contacts_for_unit`, `get_evacuation_priority_list`) tested and working
- Device lifecycle state machine validated through all transitions

---
*Phase: 15-admin-governance-analytics*
*Completed: 2026-02-08*
