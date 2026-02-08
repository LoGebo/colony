---
phase: 11-admin-dashboard-financial-core
plan: 03
subsystem: ui
tags: [residents, units, occupancies, invite, crud, server-actions]

# Dependency graph
requires:
  - phase: 11-admin-dashboard-financial-core
    plan: 01
    provides: UI primitives, formatters, DataTable
provides:
  - Resident list with search, pagination, create, edit, deactivate
  - Email invite workflow with server action (creates resident + sends Supabase invite)
  - Unit catalog with search, pagination, and detail view
  - Occupancy management (assign/remove residents to/from units)
affects: []

key-files:
  created:
    - packages/admin/src/hooks/useResidents.ts
    - packages/admin/src/hooks/useUnits.ts
    - packages/admin/src/hooks/useOccupancies.ts
    - packages/admin/src/components/residents/ResidentForm.tsx
    - packages/admin/src/components/residents/OccupancyManager.tsx
    - packages/admin/src/app/(dashboard)/residents/page.tsx
    - packages/admin/src/app/(dashboard)/residents/[id]/page.tsx
    - packages/admin/src/app/(dashboard)/residents/invite/page.tsx
    - packages/admin/src/app/(dashboard)/residents/invite/actions.ts
    - packages/admin/src/app/(dashboard)/units/page.tsx
    - packages/admin/src/app/(dashboard)/units/[id]/page.tsx

key-decisions:
  - "Used PostgREST FK hints (occupancies!occupancies_unit_id_fkey, residents!occupancies_resident_id_fkey) for nested selects"
  - "Server Action for invite flow uses admin client to create auth user, avoids exposing service_role key"
  - "OccupancyManager fetches available residents and filters out already-assigned ones"

# Metrics
duration: ~15min
completed: 2026-02-08
---

# Phase 11 Plan 03: Resident & Unit Management Summary

**Resident CRUD with email invite workflow, unit catalog, and occupancy assignment management**

## Accomplishments
- Built resident list at `/residents` with search, pagination, create modal, and deactivate confirmation
- Built resident detail at `/residents/[id]` with edit modal and occupancy display
- Built email invite at `/residents/invite` with server action creating resident record + Supabase auth invite
- Built unit catalog at `/units` with search, pagination, and type/status badges
- Built unit detail at `/units/[id]` with inline edit and OccupancyManager component
- Built OccupancyManager for assigning/removing residents with occupancy type selection

## Task Commits

1. **Task 1: Resident hooks, list, detail, invite** - `7faed6e`
2. **Task 2: Unit catalog and occupancy management** - `6f3baab`

## Files Created
- `packages/admin/src/hooks/useResidents.ts` - 5 hooks: list, detail, create, update, deactivate
- `packages/admin/src/hooks/useUnits.ts` - 4 hooks: list, detail, update, options dropdown
- `packages/admin/src/hooks/useOccupancies.ts` - 2 mutations: create occupancy, remove occupancy
- `packages/admin/src/components/residents/ResidentForm.tsx` - Reusable form with validation
- `packages/admin/src/components/residents/OccupancyManager.tsx` - Assign/remove residents with type picker
- `packages/admin/src/app/(dashboard)/residents/page.tsx` - Resident list with DataTable
- `packages/admin/src/app/(dashboard)/residents/[id]/page.tsx` - Resident detail with edit
- `packages/admin/src/app/(dashboard)/residents/invite/page.tsx` - Invite form with unit assignment
- `packages/admin/src/app/(dashboard)/residents/invite/actions.ts` - Server action for invite flow
- `packages/admin/src/app/(dashboard)/units/page.tsx` - Unit catalog with DataTable
- `packages/admin/src/app/(dashboard)/units/[id]/page.tsx` - Unit detail with OccupancyManager

---
*Phase: 11-admin-dashboard-financial-core*
*Completed: 2026-02-08*
