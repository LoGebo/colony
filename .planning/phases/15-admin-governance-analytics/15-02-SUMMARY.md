---
phase: 15-admin-governance-analytics
plan: 02
subsystem: admin-governance-ui
tags: [elections, assemblies, voting, quorum, agreements, governance]
requires: [15-01]
provides: [elections-crud, assemblies-management, attendance-tracking, agreements-tracking, quorum-calculation]
affects: [15-03, 15-04, 15-05]
tech-stack:
  added: [react-hook-form]
  patterns: [multi-step-wizard, inline-forms, real-time-quorum-calculation]
key-files:
  created:
    - packages/admin/src/hooks/useGovernance.ts
    - packages/admin/src/app/(dashboard)/governance/elections/page.tsx
    - packages/admin/src/app/(dashboard)/governance/elections/[id]/page.tsx
    - packages/admin/src/app/(dashboard)/governance/elections/new/page.tsx
    - packages/admin/src/app/(dashboard)/governance/assemblies/page.tsx
    - packages/admin/src/app/(dashboard)/governance/assemblies/[id]/page.tsx
  modified:
    - packages/admin/package.json (added react-hook-form)
decisions:
  - key: "multi-step-election-wizard"
    what: "3-step form wizard for election creation (info → options → schedule)"
    why: "Complex form with dynamic options list and validation dependencies"
    impact: "Better UX, clearer workflow, progressive validation"
  - key: "inline-attendance-forms"
    what: "Toggle inline forms for adding attendees and agreements"
    why: "Avoid modal complexity, keep context visible"
    impact: "Faster data entry, less navigation overhead"
  - key: "real-time-quorum-via-rpc"
    what: "Call calculate_assembly_quorum RPC on assembly detail load"
    why: "Complex quorum calculation with convocatoria requirements"
    impact: "Accurate coefficient-weighted quorum display"
  - key: "agreement-number-as-number"
    what: "agreement_number field is number type (not string)"
    why: "Database schema uses number, auto-increment from max"
    impact: "Must cast as never for insert, calculate max + 1 for new agreements"
metrics:
  duration: 493s
  completed: 2026-02-08
---

# Phase 15 Plan 02: Governance Management UI Summary

**One-liner:** Elections CRUD with voting/quorum tracking and assemblies with coefficient-weighted attendance/agreements management

## Objective

Build the governance management UI: elections with voting/quorum tracking, assemblies with attendance, and agreements management. Fulfills AGOV-01 through AGOV-05.

## Execution Details

### Commits

1. **f2888c1** - feat(15-02): create governance hooks and elections pages
   - Added useGovernance hooks for elections CRUD and status updates
   - Created elections list page with DataTable and status filter
   - Created election detail page with quorum progress bar and results chart
   - Created multi-step election creation wizard with react-hook-form
   - Installed react-hook-form dependency

2. **a865b69** - feat(15-02): create assemblies pages with attendance and agreements
   - Created assemblies list page with DataTable and status filter
   - Created assembly detail page with real-time quorum calculation
   - Added attendance management with unit selector and coefficient tracking
   - Added agreements management with action item tracking
   - Show convocatoria requirements (1ª, 2ª, 3ª) in quorum display

### Tasks Completed

- [x] Task 1: Create governance hooks and elections pages (4 files)
- [x] Task 2: Create assemblies pages with attendance and agreements (2 files)

## What Was Built

### Governance Hooks (useGovernance.ts)

**Elections:**
- `useElections()` - Paginated list with status filter
- `useElectionDetail()` - Single election with options
- `useCreateElection()` - Two-step mutation (insert election + batch insert options)
- `useUpdateElectionStatus()` - Open/close voting

**Assemblies:**
- `useAssemblies()` - Paginated list with status filter
- `useAssemblyDetail()` - Single assembly with attendance and agreements
- `useAssemblyQuorum()` - Real-time quorum calculation via RPC
- `useAddAttendee()` - Insert into assembly_attendance
- `useAddAgreement()` - Insert into assembly_agreements

All hooks follow the lazy Supabase client pattern (client created in queryFn, not hook body) and use established query key factories from @upoe/shared.

### Elections UI

**List Page:**
- DataTable with columns: number, title, type, status, quorum, opens_at, closes_at
- Status filter dropdown (draft, open, closed, cancelled)
- Badge color variants for status and type
- Row click navigation to detail

**Detail Page:**
- Header with title, status badge, type badge, dates
- Action buttons: "Abrir Votación" (draft → open), "Cerrar Votación" (open → closed)
- Quorum progress section with horizontal bar and percentage
- Results chart: Recharts BarChart showing coefficient_total per option
- Options table with votes_count and coefficient_total

**Creation Wizard:**
- Step 1 (Info Básica): title, description, election_type select
- Step 2 (Opciones): dynamic list with add/remove buttons, minimum 2 options
- Step 3 (Programación): opens_at and closes_at with validation (closes > opens)
- Uses react-hook-form with step state management

### Assemblies UI

**List Page:**
- DataTable with columns: number, title, type, status, date/time, location, quorum
- Status filter dropdown (scheduled, in_progress, completed, cancelled)
- Badge color variants for status and type
- Row click navigation to detail

**Detail Page:**
- Header with title, status, type, date/time, location
- **Quorum Card:** Real-time calculation from RPC showing present_coefficient / total_coefficient, progress bar, convocatoria indicators (1ª, 2ª, 3ª)
- **Attendance Card:** Table with unit_number, attendee_name, attendee_type, coefficient, checked_in_at, is_proxy. Inline form to register attendees with unit selector (auto-fills coefficient from units table).
- **Agreements Card:** List of agreements with number, title, description, approved status, action_required indicator. If action_required: show action_description, action_due_date, action_responsible, action_completed_at. Inline form to add agreements with auto-increment agreement_number.

## Decisions Made

1. **Multi-step election wizard** - Complex form with dynamic options list requires progressive workflow
2. **Inline attendance/agreement forms** - Toggle forms inside cards instead of modals for faster data entry
3. **Real-time quorum via RPC** - Call calculate_assembly_quorum for accurate coefficient-weighted calculation
4. **agreement_number as number** - Database schema uses number type, must cast as never and auto-increment from max

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Dependencies Met:**
- 15-01 navigation and query keys foundation ✓
- Elections and assemblies tables exist in database ✓
- calculate_assembly_quorum RPC function exists ✓

**Outputs Available:**
- Elections CRUD UI ready for resident voting implementation (phase 16)
- Assemblies attendance/quorum tracking ready for analytics (15-03)
- Agreements tracking ready for governance reports

## Testing Notes

Manual verification required:
1. Elections list loads with DataTable and status filter
2. Election detail shows quorum progress bar and results chart
3. Open/close voting buttons work and invalidate queries
4. Election creation wizard validates dates (closes > opens) and minimum 2 options
5. Assemblies list loads with DataTable
6. Assembly detail shows real-time quorum calculation from RPC
7. Attendance form auto-fills coefficient when unit selected
8. Agreements form auto-increments agreement_number

## Lessons Learned

1. **Multi-step forms** - react-hook-form + useState for step management works well for complex wizards
2. **Inline forms** - Toggle visibility inside cards instead of modals reduces navigation overhead for rapid data entry
3. **RPC quorum calculation** - Server-side calculation ensures accuracy for complex coefficient-weighted formulas with convocatoria requirements
4. **Number type casting** - agreement_number and display_order are numbers in schema, must use 'as never' cast for insert operations
