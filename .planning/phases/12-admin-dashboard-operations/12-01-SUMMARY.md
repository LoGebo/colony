---
phase: 12-admin-dashboard-operations
plan: 01
subsystem: admin-operations
tags: [tickets, kanban, sla, query-keys, sidebar-nav]
depends_on:
  requires: [11-admin-dashboard-financial]
  provides: [shared-query-keys, ticket-hooks, ticket-pages, operations-sidebar]
  affects: [12-02, 12-03, 12-04]
tech-stack:
  added: []
  patterns: [kanban-board, sla-indicators, status-workflow, query-key-factories]
key-files:
  created:
    - packages/admin/src/hooks/useTickets.ts
    - packages/admin/src/components/tickets/TicketStatusBadge.tsx
    - packages/admin/src/components/tickets/TicketKanbanBoard.tsx
    - packages/admin/src/components/tickets/TicketSLAIndicator.tsx
    - packages/admin/src/app/(dashboard)/operations/page.tsx
    - packages/admin/src/app/(dashboard)/operations/tickets/page.tsx
    - packages/admin/src/app/(dashboard)/operations/tickets/[id]/page.tsx
  modified:
    - packages/shared/src/queries/keys.ts
    - packages/admin/src/app/(dashboard)/layout.tsx
decisions:
  - id: D12-01-01
    description: "Use 'as never' cast for dynamic status/priority filter values (matches established DB type pattern)"
  - id: D12-01-02
    description: "Non-null assertion on user.id for mutations (admin must be authenticated to perform mutations)"
metrics:
  duration: ~5min
  completed: 2026-02-08
---

# Phase 12 Plan 01: Ticket Dashboard & Shared Infrastructure Summary

**One-liner:** Ticket dashboard with table/kanban views, SLA metrics, status workflow, and shared query key factories for Phase 12

## What Was Built

### Shared Query Key Factories (packages/shared/src/queries/keys.ts)
- Added `tickets` factory: all, list, detail, comments, slaMetrics
- Added `announcements` factory: all, list, detail, recipients, feed
- Added `documents` factory: all, list, detail, versions
- Updated `mergeQueryKeys` to include all three new factories

### Operations Sidebar Navigation (layout.tsx)
- Replaced flat "Operaciones" nav with expandable children submenu
- 5 sub-routes: Tickets, Avisos, Accesos, Documentos, Amenidades
- Follows same pattern as existing Finanzas children nav

### Ticket Hooks (useTickets.ts)
- `useTickets(filters)` -- paginated list with search, status, priority filters
- `useTicket(id)` -- single ticket with assignments and comments
- `useTicketCategories()` -- active categories for community
- `useAssignTicket()` -- assign staff, auto-transition open->assigned
- `useUpdateTicketStatus()` -- DB trigger validates transitions
- `useAddTicketComment()` -- admin comments with internal note flag
- `computeSLAMetrics(tickets)` -- aggregate SLA calculations
- `VALID_TRANSITIONS` constant for client-side transition UI

### Ticket Components
- `TicketStatusBadge` -- maps 8 statuses to Badge variants with Spanish labels
- `TicketKanbanBoard` -- 6-column grid (open through resolved), clickable cards with priority, reporter, relative time
- `TicketSLAIndicator` -- dual response/resolution SLA chips with color-coded status (green/yellow/red/gray)

### Ticket Pages
- `/operations` -- redirect to `/operations/tickets`
- `/operations/tickets` -- list page with table/kanban toggle, 4 SLA summary cards, search/status/priority filters, paginated DataTable
- `/operations/tickets/[id]` -- detail page with description, comment timeline, info sidebar, assignment form, status workflow buttons

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript strict enum types for Supabase filters**
- **Found during:** Task 2
- **Issue:** Generated Database types use string literal unions for status/priority columns; passing plain `string` to `.eq()` fails type checking
- **Fix:** Applied `as never` cast on dynamic filter values (established project pattern from Phase 11)
- **Files modified:** packages/admin/src/hooks/useTickets.ts
- **Commit:** 3229d9f

**2. [Rule 3 - Blocking] Non-nullable assigned_by and author_id columns**
- **Found during:** Task 2
- **Issue:** DB types require `assigned_by: string` (not nullable) for ticket_assignments and `author_id: string` for ticket_comments
- **Fix:** Used non-null assertion `user!.id` since admin must be authenticated to perform these mutations
- **Files modified:** packages/admin/src/hooks/useTickets.ts
- **Commit:** 3229d9f

## Verification Results

- `npx tsc --noEmit` passes for packages/shared
- `npx tsc --noEmit` passes for packages/admin
- All 9 files created/modified compile without errors
- Sidebar nav has 5 children under Operaciones
- `/operations` redirects to `/operations/tickets`
- Ticket list page supports table/kanban toggle, filters, SLA cards
- Ticket detail page has assignment, status workflow, comment timeline

## Commits

| Hash | Message |
|------|---------|
| cdb9775 | feat(12-01): add query key factories and expand operations sidebar nav |
| 3229d9f | feat(12-01): add ticket hooks, components, and page routes |

## Next Phase Readiness

Plan 12-02 (Announcements) can proceed -- shared query keys and sidebar nav are in place. The `queryKeys.announcements` factory is ready. The expandable sidebar pattern under Operaciones is established for all subsequent sub-routes.
