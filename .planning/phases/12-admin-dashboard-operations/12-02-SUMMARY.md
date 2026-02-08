---
phase: 12-admin-dashboard-operations
plan: 02
subsystem: mobile-maintenance
tags: [react-native, expo-router, tanstack-query, supabase-storage, tickets, nativewind]
depends_on: ["12-01"]
provides:
  - Mobile ticket hooks (list, detail, categories, create, add comment)
  - Maintenance stack layout with 3 screens
  - Ticket list with status badges and priority indicators
  - Ticket creation form with category picker, priority, photo upload
  - Ticket detail with SLA info, comment timeline, add comment
affects: ["12-03", "12-04", "16"]
tech-stack:
  added: []
  patterns:
    - Photo upload to Supabase Storage with comment attachment pattern
    - Inline validation with per-field error state
    - Horizontal category chip picker for form selection
    - Fixed-bottom comment input bar for detail screens
key-files:
  created:
    - packages/mobile/src/hooks/useTickets.ts
    - packages/mobile/app/(resident)/maintenance/_layout.tsx
    - packages/mobile/app/(resident)/maintenance/index.tsx
    - packages/mobile/app/(resident)/maintenance/create.tsx
    - packages/mobile/app/(resident)/maintenance/[id].tsx
  modified: []
decisions:
  - Photo attachments stored as ticket_comments with photo_urls array (not ticket fields)
  - reported_by uses residentId from app_metadata (not auth.uid())
  - Category picker uses horizontal ScrollView with chip selection
  - Comment form fixed at bottom of detail screen (not inline in scroll)
  - Internal comments (is_internal=true) filtered out in resident view
metrics:
  duration: 3.6 min
  completed: 2026-02-08
---

# Phase 12 Plan 02: Mobile Maintenance Screens Summary

Mobile ticket hooks and 3 maintenance screens for the resident app -- ticket list, creation with photo attachments, and detail with status timeline and comments.

## What Was Built

### Task 1: Mobile Ticket Hooks (`useTickets.ts`)

5 hooks following the same pattern as `useVisitors.ts`:

- **useMyTickets()** - Lists resident's own tickets filtered by `reported_by = residentId` (NOT `auth.uid()`). Selects title, status, priority, created_at, and joined category info. Ordered by created_at descending.
- **useTicketDetail(id)** - Single ticket with full fields plus joined `ticket_categories` and `ticket_comments` (including status_from/status_to for timeline display).
- **useTicketCategories()** - Active categories for the community, used in the create form's category picker.
- **useCreateTicket()** - Inserts ticket with `reported_by = residentId` and `unit_id` from `useResidentUnit`. If photos were uploaded, attaches them as a `ticket_comments` record with `photo_urls` array.
- **useAddComment()** - Inserts a reporter comment on a ticket. Invalidates the detail query on success.

### Task 2: Maintenance Screens

**`_layout.tsx`** - Stack navigator with 3 routes (index, create, [id]), all with `headerShown: false`.

**`index.tsx`** - Ticket list screen:
- Header with "Mantenimiento" title and "+ Nuevo" button
- FlatList of ticket cards showing title, status badge (8 statuses with Spanish labels), priority dot (color-coded), category with icon, and relative time
- Pull-to-refresh, empty state with wrench icon
- Each card navigates to detail screen

**`create.tsx`** - Ticket creation form:
- Back/cancel button in header
- Horizontal ScrollView category chip picker (loads from `useTicketCategories`)
- Title input (min 5 chars), description multiline input (min 10 chars)
- Priority chips (Baja/Media/Alta/Urgente) defaulting to Media
- Optional location input
- Photo section: up to 5 photos via `pickAndUploadImage` to `ticket-attachments` bucket, with preview thumbnails and remove button
- Inline validation errors per field
- Submit button with loading state, navigates back on success

**`[id].tsx`** - Ticket detail screen:
- Back button, ticket title, status/priority/category badges
- SLA card showing response and resolution due dates (red if breached)
- Description card with optional location
- Comment timeline: system comments in gray/italic, user comments in white cards with role label, photo thumbnails for photo comments
- Fixed-bottom comment input bar with send button (hidden for closed/cancelled tickets)

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

1. `npx tsc --noEmit` passes for packages/mobile -- zero errors
2. Ticket list filters by `reported_by = residentId` (not auth.uid())
3. Create screen validates inputs, uploads photos to `ticket-attachments` bucket
4. Detail screen shows comment timeline including system-generated comments
5. Add comment form invalidates detail query on success
6. All screens use NativeWind className patterns consistent with visitors/payments screens

## Success Criteria Met

- RMAINT-01: Resident can submit maintenance request with category, description, and photos -- COVERED
- RMAINT-02: Resident can view status timeline of their tickets -- COVERED
- RMAINT-04: Resident can add comments to their tickets -- COVERED
- RMAINT-03: Push notifications on status changes -- DEFERRED to Phase 16
