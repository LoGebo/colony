---
phase: 14-guard-advanced-admin-providers
plan: 05
subsystem: admin
tags: [providers, work-orders, tanstack-table, supabase-hooks, admin-pages]

# Dependency graph
requires:
  - phase: 14-01
    provides: "Query key factories for providers and workOrders, admin sidebar with Proveedores section"
provides:
  - "Provider data hooks (14 hooks: list, detail, CRUD, documents, personnel, schedules, expiring docs)"
  - "Work order data hooks (6 hooks: list, detail, CRUD, rate, by-provider)"
  - "Provider list page with status filters, create form, expiring docs alert"
  - "Provider detail page with 4 tabs (Info, Documentos, Personal, Horarios)"
  - "Work order list page with status filters and create form"
  - "Work order detail page with status workflow, cost tracking, rating system"
affects: [14-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-document-verification, work-order-status-workflow, personnel-active-toggle, schedule-management]

key-files:
  created:
    - "packages/admin/src/hooks/useProviders.ts"
    - "packages/admin/src/hooks/useWorkOrders.ts"
    - "packages/admin/src/app/(dashboard)/providers/page.tsx"
    - "packages/admin/src/app/(dashboard)/providers/[id]/page.tsx"
    - "packages/admin/src/app/(dashboard)/providers/work-orders/page.tsx"
    - "packages/admin/src/app/(dashboard)/providers/work-orders/[id]/page.tsx"
  modified: []

key-decisions:
  - "Provider documents track metadata only (file_url exists but upload deferred to later phase)"
  - "Work order status workflow: draft→submitted→approved→scheduled→in_progress→completed (plus cancel from any)"
  - "Provider personnel use active/inactive toggle (soft enable/disable, no deletion)"
  - "Work order rating visible only after completion (1-5 stars with notes)"
  - "Expiring documents alert at top of provider list (30-day window)"

patterns-established:
  - "Provider CRUD: lazy Supabase client in queryFn, 'as never' casts, queryKeys from @upoe/shared"
  - "Multi-tab detail page: state-based tab switching (no routing), each tab has CRUD forms"
  - "Document verification workflow: pending→verified/rejected/expired with color-coded badges"
  - "Status workflow with conditional forms: scheduled needs date, completed needs cost+notes"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 14 Plan 05: Admin Providers + Work Orders Summary

**Provider management (company CRUD, document tracking, personnel, schedules) and work order management (creation, status workflow, cost tracking, rating) with 20 hooks and 4 admin pages**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08T19:05:00Z
- **Completed:** 2026-02-08T19:10:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created 14 provider hooks: list (with status filter), detail, CRUD, document management (list, create, update), personnel management (list, create, toggle active), schedule management (list, create, delete), expiring documents view
- Created 6 work order hooks: list (with status filter, joined to providers/units), detail, CRUD, rate (post-completion), by-provider
- Built provider list page with status filter dropdown, DataTable, create form, expiring documents alert banner (30-day window)
- Built provider detail page with 4 tabs: Info (editable fields, status change, work orders summary), Documentos (list with verification actions), Personal (card grid with active toggle), Horarios (weekly schedule table with CRUD)
- Built work order list page with status filter, DataTable showing WO number/title/provider/unit/status/dates/costs/rating, create form with provider/unit dropdowns
- Built work order detail page with status workflow buttons, scheduling form, completion form (cost+notes), rating section (1-5 stars), admin/provider notes sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Provider and work order data hooks** - `82e8157` (feat)
2. **Task 2: Admin provider list, provider detail, work order list, and work order detail pages** - `8987f43` (feat)

**Plan metadata:** (to be committed)

## Files Created/Modified
- `packages/admin/src/hooks/useProviders.ts` - 14 hooks for provider CRUD, documents, personnel, schedules
- `packages/admin/src/hooks/useWorkOrders.ts` - 6 hooks for work order lifecycle management
- `packages/admin/src/app/(dashboard)/providers/page.tsx` - Provider list with filters, create form, expiring docs alert
- `packages/admin/src/app/(dashboard)/providers/[id]/page.tsx` - 4-tab detail page (Info, Documentos, Personal, Horarios)
- `packages/admin/src/app/(dashboard)/providers/work-orders/page.tsx` - Work order list with status filter and create form
- `packages/admin/src/app/(dashboard)/providers/work-orders/[id]/page.tsx` - Work order detail with status workflow, cost tracking, rating

## Decisions Made
- **Document metadata only:** Provider documents track type, number, dates, status - file upload deferred to later (file_url column exists but not used yet)
- **Status workflow:** Work orders follow draft→submitted→approved→scheduled→in_progress→completed path, with cancel available from any state
- **Personnel toggle pattern:** Provider personnel use is_active toggle (no deletion) - soft enable/disable for access control
- **Post-completion rating:** Rating section (1-5 stars + notes) only visible when work order status = completed
- **Expiring docs prominence:** Alert banner at top of provider list shows count of documents expiring within 30 days (from useExpiringDocuments hook)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Provider and work order management complete. Ready for:
- Phase 14-06: Guard patrol features (checkpoint scanning, incident reporting, emergency handling)
- Guard mobile app can now verify providers at access points using data from admin provider management
- Work orders can be created and tracked for provider access requests

---
*Phase: 14-guard-advanced-admin-providers*
*Completed: 2026-02-08*
