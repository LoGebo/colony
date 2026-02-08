---
phase: 12-admin-dashboard-operations
plan: 03
subsystem: announcements
tags: [announcements, targeting, read-receipts, feed, mark-read, rpc]
depends_on:
  requires: [12-01]
  provides: [admin-announcement-hooks, admin-announcement-pages, mobile-announcement-feed, mobile-announcement-detail]
  affects: [12-04, 16-push-notifications]
tech-stack:
  added: []
  patterns: [two-step-mutation-with-rpc, auto-mark-read-on-mount, recipient-expansion-via-rpc]
key-files:
  created:
    - packages/admin/src/hooks/useAnnouncements.ts
    - packages/admin/src/components/announcements/AnnouncementForm.tsx
    - packages/admin/src/components/announcements/RecipientTable.tsx
    - packages/admin/src/app/(dashboard)/operations/announcements/page.tsx
    - packages/admin/src/app/(dashboard)/operations/announcements/[id]/page.tsx
    - packages/mobile/src/hooks/useAnnouncements.ts
    - packages/mobile/app/(resident)/announcements/_layout.tsx
    - packages/mobile/app/(resident)/announcements/index.tsx
    - packages/mobile/app/(resident)/announcements/[id].tsx
  modified: []
decisions:
  - id: D12-03-01
    description: "Two-step create mutation: insert announcement then call expand_announcement_recipients RPC explicitly"
  - id: D12-03-02
    description: "Auto-mark announcement as read on detail screen mount using useEffect with ref guard"
  - id: D12-03-03
    description: "Use 'as never' cast for RPC call and target_segment enum insert (types not regenerated)"
metrics:
  duration: ~4min
  completed: 2026-02-08
---

# Phase 12 Plan 03: Announcements Management & Feed Summary

**One-liner:** Admin announcement CRUD with targeting and read receipts, plus mobile announcement feed with auto-mark-read and acknowledge flow

## What Was Built

### Admin Announcement Hooks (useAnnouncements.ts)
- `useAnnouncements(filters)` -- paginated list with search (title ilike), ordered by created_at desc
- `useAnnouncement(id)` -- single announcement detail with all fields
- `useAnnouncementRecipients(announcementId, page, pageSize)` -- paginated recipients with resident join, read/acknowledged status
- `useCreateAnnouncement()` -- two-step mutation: (1) insert announcement, (2) call `expand_announcement_recipients` RPC to generate recipient records; toast shows recipient count
- `useDeleteAnnouncement()` -- soft-delete via deleted_at timestamp

### Admin Announcement Components
- `AnnouncementForm` -- form with title, body (textarea), target segment dropdown (all/owners/tenants/building/delinquent/role), conditional building/role inputs, schedule datetime, urgency toggle, acknowledgment toggle
- `RecipientTable` -- paginated DataTable showing resident name, email, read status (Badge), optional acknowledged status; summary row with read count and percentage

### Admin Announcement Pages
- `/operations/announcements` -- list page with search, create form card, DataTable with title link, segment badge, publish date, recipients, read percentage, urgency badge
- `/operations/announcements/[id]` -- detail page with back link, header badges, body card (whitespace-pre-wrap), 4 stats cards (recipients, read, percentage, created), RecipientTable

### Mobile Announcement Hooks (useAnnouncements.ts)
- `useAnnouncementFeed()` -- queries announcement_recipients joined with announcements for current resident; filters to published and non-deleted
- `useAnnouncementDetail(id)` -- single announcement by id
- `useMarkAnnouncementRead()` -- updates read_at where null for current resident; invalidates feed
- `useAcknowledgeAnnouncement()` -- updates acknowledged_at for current resident; invalidates feed and detail

### Mobile Announcement Screens
- `_layout.tsx` -- Stack layout with index and [id] screens
- `index.tsx` -- feed screen with FlatList, unread blue dot indicator, urgency badge, relative time, pull-to-refresh, empty state
- `[id].tsx` -- detail screen with auto-mark-read on mount (useEffect + ref guard), full body text, acknowledge button with success state

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` passes for packages/admin (0 errors)
- `npx tsc --noEmit` passes for packages/mobile (0 errors)
- All 9 files created compile without errors
- Admin list page has search, pagination, create form with targeting
- Create mutation calls expand_announcement_recipients RPC after insert
- Detail page shows read receipts table with status badges
- Mobile feed shows announcements with unread dot indicators
- Mobile detail auto-marks read on mount
- Acknowledge button available for announcements requiring confirmation

## Commits

| Hash | Message |
|------|---------|
| 9aa7cdd | feat(12-03): admin announcement hooks, components, and pages |
| 885c11b | feat(12-03): mobile announcement feed and detail screens |

## Next Phase Readiness

Plan 12-04 (Documents) can proceed -- announcement infrastructure is complete. Push notifications for high-priority announcements (RCOMM-03) deferred to Phase 16.
