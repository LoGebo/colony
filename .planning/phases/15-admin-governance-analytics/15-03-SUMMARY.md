---
phase: 15-admin-governance-analytics
plan: 03
subsystem: governance
tags: [violations, sanctions, appeals, tanstack-query, datatable]

# Dependency graph
requires:
  - phase: 15-01
    provides: Query key factories and navigation structure
provides:
  - Violations management UI with list, detail, create flows
  - Sanctions issuance and tracking interface
  - Appeals resolution workflow
  - Repeat offender tracking via offense_number display
affects: [admin-residents, admin-units]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy Supabase client in queryFn for violations queries
    - Inline forms in detail pages for sanctions and appeals
    - Modal-based create flows with unit/type dropdowns
    - Badge variant mapping for severity/status/sanction types

key-files:
  created:
    - packages/admin/src/hooks/useViolations.ts
    - packages/admin/src/app/(dashboard)/violations/page.tsx
    - packages/admin/src/app/(dashboard)/violations/[id]/page.tsx
  modified: []

key-decisions:
  - "Badge variants: severity (minor=info, moderate=warning, serious/critical=danger), status (open=warning, under_review=info, resolved=success, dismissed=neutral)"
  - "Inline sanction and appeal forms in detail page (not separate modals) for faster workflow"
  - "Photo URLs as text inputs (not file upload) - upload infrastructure out of scope"
  - "Witness names as comma-separated text input split into array on submit"

patterns-established:
  - "Repeat offender highlighting: red text if offense_number > 1"
  - "Evidence gallery: 3-column grid for photos, link list for videos"
  - "Sanction form conditional fields: fine_amount shown if fine, suspension dates shown if suspension"
  - "Appeal resolve form conditional fields: fine_reduced_to shown only for partially_approved decision"

# Metrics
duration: 6min
completed: 2026-02-08
---

# Phase 15 Plan 03: Violations Management Summary

**Violations CRUD with sanctions workflow, appeals resolution, and repeat offender tracking via offense_number highlighting**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T20:03:34Z
- **Completed:** 2026-02-08T20:09:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Violations list with DataTable showing severity, status, unit, type, reincidencia columns
- Violations detail with info card, evidence gallery, sanctions timeline, appeals workflow
- Create violation modal with unit/type/severity/description/evidence inputs
- Inline sanction form: issue verbal warning, written warning, fine, suspension, access restriction
- Inline appeal resolve form: approve/reject/partially approve with decision notes and reduced fine
- Repeat offender tracking: offense_number displayed and highlighted red if > 1

## Task Commits

Each task was committed atomically:

1. **Task 1: Create violations hooks** - `9e388a9` (feat)
2. **Task 2: Create violations list and detail pages** - `56f1202` (feat)

## Files Created/Modified
- `packages/admin/src/hooks/useViolations.ts` - 10 TanStack Query hooks for violations CRUD, sanctions, appeals. Types: ViolationRow, SanctionRow, AppealRow, ViolationType. Mutations: create violation, create sanction, update status, resolve appeal.
- `packages/admin/src/app/(dashboard)/violations/page.tsx` - Violations list with DataTable, filters (severity, status, type), create modal, row navigation to detail
- `packages/admin/src/app/(dashboard)/violations/[id]/page.tsx` - Violation detail with info card, evidence gallery, sanctions list + inline add form, appeals list + inline resolve form, resolve/dismiss status actions

## Decisions Made
- **Badge variants:** Severity (minor=info, moderate=warning, serious/critical=danger), status (open=warning, under_review=info, resolved=success, dismissed=neutral), sanction type (verbal=info, written=warning, fine/suspension/restriction=danger), appeal status (pending=warning, approved=success, rejected=danger, partially_approved=info)
- **Inline forms:** Sanction and appeal forms embedded in detail page (not separate modals) for faster workflow
- **Photo URLs:** Text inputs for now - file upload infrastructure deferred to future phase
- **Witness names:** Comma-separated text input split into array on submit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Violations management UI complete, ready for emergency management (15-04) and analytics (15-05)
- Evidence upload to storage bucket can be added in future enhancement
- Violation types management UI can be added if needed (currently admin creates via SQL)

---
*Phase: 15-admin-governance-analytics*
*Completed: 2026-02-08*
