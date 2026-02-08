---
phase: 10-mobile-core
plan: 02
subsystem: mobile-visitors
tags: [react-native, visitors, qr-code, expo-sharing, tanstack-query, infinite-scroll]
depends_on:
  requires: ["10-01"]
  provides: ["visitor-hooks", "visitor-screens", "qr-display-component"]
  affects: ["10-03", "10-04"]
tech-stack:
  added: []
  patterns: ["useInfiniteQuery for paginated lists", "expo-file-system v19 File/Paths API", "client-side QR fallback payload"]
key-files:
  created:
    - packages/mobile/src/hooks/useVisitors.ts
    - packages/mobile/src/components/visitors/VisitorStatusBadge.tsx
    - packages/mobile/src/components/visitors/InvitationCard.tsx
    - packages/mobile/src/components/visitors/QRCodeDisplay.tsx
    - packages/mobile/app/(resident)/visitors/index.tsx
    - packages/mobile/app/(resident)/visitors/create.tsx
    - packages/mobile/app/(resident)/visitors/[id].tsx
    - packages/mobile/app/(resident)/visitors/history.tsx
  modified: []
decisions:
  - id: "10-02-01"
    decision: "Use expo-file-system v19 new File/Paths API instead of legacy cacheDirectory/writeAsStringAsync"
    reason: "expo-file-system v19 deprecated legacy API; new File(Paths.cache, name).write(base64, {encoding:'base64'}) is the correct approach"
  - id: "10-02-02"
    decision: "Client-side fallback QR payload until HMAC secret is configured"
    reason: "generate_qr_payload RPC requires secret_key param; unsigned JSON payload used temporarily"
  - id: "10-02-03"
    decision: "qr_codes insert requires both payload and signature fields (non-nullable)"
    reason: "Database schema requires signature field; used 'unsigned' placeholder"
metrics:
  duration: "4.5 min"
  completed: "2026-02-08"
---

# Phase 10 Plan 02: Resident Visitor Management Summary

**TL;DR:** Complete visitor flow with 5 TanStack Query hooks, 3 reusable components, and 4 Expo Router screens -- active list, create form (single-use + recurring), QR detail with share-to-WhatsApp, and paginated history with infinite scroll.

## What Was Built

### Data Hooks (useVisitors.ts)

- **useActiveInvitations()** -- Fetches pending/approved invitations for the current resident with qr_codes and units relations, ordered by valid_from ASC
- **useInvitationDetail(id)** -- Single invitation with full qr_codes(*) and units relations
- **useCreateInvitation()** -- Mutation that inserts invitation, checks for trigger-generated QR code, creates one manually if missing (with client-side fallback payload), invalidates all visitor queries
- **useCancelInvitation()** -- Mutation that sets status=cancelled and cancelled_at timestamp
- **useVisitorHistory(pageSize)** -- useInfiniteQuery with range-based pagination, exact count for getNextPageParam

### Reusable Components

- **VisitorStatusBadge** -- Wraps StatusBadge with Spanish labels (Pendiente, Aprobada, Cancelada, Expirada, Rechazada)
- **InvitationCard** -- React.memo FlatList item with visitor name, status badge, datetime, type label, unit number
- **QRCodeDisplay** -- react-native-qrcode-svg rendering + expo-file-system v19 File API for base64 write + expo-sharing share sheet with WhatsApp fallback

### Screens

- **visitors/index.tsx** -- Active list with FlatList, pull-to-refresh, "Nueva Invitacion" and "Historial" navigation
- **visitors/create.tsx** -- Segmented control for single_use/recurring, day-of-week chips, KeyboardAvoidingView, form validation
- **visitors/[id].tsx** -- QR display, detail card, recurring days/times, cancel button with Alert confirmation
- **visitors/history.tsx** -- Infinite scroll FlatList with onEndReached pagination and footer loading spinner

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 10-02-01 | expo-file-system v19 File/Paths API | Legacy cacheDirectory/writeAsStringAsync deprecated and throws at runtime; new API uses `new File(Paths.cache, name).write()` |
| 10-02-02 | Client-side fallback QR payload | generate_qr_payload RPC needs secret_key; JSON.stringify({invitation_id, community_id, created_at}) used until HMAC configured |
| 10-02-03 | 'unsigned' placeholder for qr_codes.signature | Database requires non-nullable signature field; placeholder marks rows as needing HMAC signing |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] expo-file-system v19 API change**
- **Found during:** Task 1
- **Issue:** Plan specified `FileSystem.cacheDirectory` and `FileSystem.writeAsStringAsync` which are deprecated/removed in expo-file-system v19. TypeScript errors TS2339: `cacheDirectory` and `EncodingType` don't exist.
- **Fix:** Used new v19 API: `import { File, Paths } from 'expo-file-system'` with `new File(Paths.cache, 'qr-invitation.png').write(base64, { encoding: 'base64' })`.
- **Files modified:** packages/mobile/src/components/visitors/QRCodeDisplay.tsx
- **Commit:** 47da330

## Verification Results

- `tsc --noEmit`: Zero errors
- All 8 files created and present
- 5 hooks exported from useVisitors.ts
- QRCodeDisplay uses expo-file-system v19 + expo-sharing
- InvitationCard wrapped in React.memo for FlatList performance
- History screen uses useInfiniteQuery with getNextPageParam
- Create form supports single_use and recurring with validation
- Detail screen shows cancel button only for pending/approved status

## Next Phase Readiness

- Visitor hooks and screens are complete and ready for integration
- QR payload is unsigned; will need HMAC signing when QR_HMAC_SECRET is configured in a future plan
- Guard gate screen (10-03/10-04) can consume qr_codes data via the same Supabase queries
