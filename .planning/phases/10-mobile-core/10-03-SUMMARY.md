---
phase: 10-mobile-core
plan: 03
subsystem: mobile-payments
tags: [react-native, payments, supabase, tanstack-query, infinite-scroll]
depends_on:
  requires: [10-01]
  provides: [resident-payment-screens, payment-hooks, payment-components]
  affects: [10-04, 10-05]
tech-stack:
  added: []
  patterns: [useInfiniteQuery-pagination, rpc-balance-query, image-upload-proof]
key-files:
  created:
    - packages/mobile/src/hooks/usePayments.ts
    - packages/mobile/src/components/payments/BalanceCard.tsx
    - packages/mobile/src/components/payments/TransactionRow.tsx
    - packages/mobile/src/components/payments/PaymentProofCard.tsx
    - packages/mobile/app/(resident)/payments/index.tsx
    - packages/mobile/app/(resident)/payments/history.tsx
    - packages/mobile/app/(resident)/payments/upload-proof.tsx
  modified: []
decisions:
  - Adapted BalanceCard to actual get_unit_balance RPC shape (no total_interest/oldest_unpaid_date fields)
  - Third breakdown column shows days_overdue count instead of total_interest amount
  - proof_type defaults to 'bank_transfer' for upload form
metrics:
  duration: 4.0 min
  completed: 2026-02-08
---

# Phase 10 Plan 03: Resident Payments Summary

**Unit balance overview, transaction history with infinite scroll, payment proof upload with status tracking using get_unit_balance RPC and payment_proofs table.**

## What Was Built

### Data Layer (usePayments.ts)
- **useUnitBalance(unitId?)** -- Calls `get_unit_balance` RPC, extracts first result from array response. Returns `current_balance`, `total_charges`, `total_payments`, `days_overdue`, `last_charge_date`, `last_payment_date`.
- **useTransactions(unitId?, pageSize)** -- `useInfiniteQuery` on `transactions` table with cursor-based pagination via `.range()`. Filters to `pending`/`posted` status, soft-delete aware.
- **usePaymentProofs(unitId?)** -- `useQuery` fetching latest 50 proofs from `payment_proofs` table.
- **useUploadPaymentProof()** -- `useMutation` inserting into `payment_proofs`, uses `user.id` (auth UID) for `submitted_by`. Invalidates both `payments._def` and `['payment-proofs']` query keys on success.

### Reusable Components
- **BalanceCard** -- Large card with balance amount (green/red based on positive/negative), overdue status text, three-column breakdown (charges/payments/days overdue), last payment date.
- **TransactionRow** -- `React.memo` wrapped row with type-based color coding: charges (red), payments (green), interest (orange), adjustment (blue), reversal (gray), transfer (purple).
- **PaymentProofCard** -- Card with custom StatusBadge variants (En revision/Aprobado/Rechazado), amount, payment date, reference, bank name, and rejection reason section for rejected proofs.

### Screens
- **payments/index.tsx** -- Overview with ScrollView + RefreshControl. BalanceCard at top, upload button, recent proofs (max 3), recent transactions (max 5) with "Ver historial" link.
- **payments/history.tsx** -- Full transaction list with FlatList infinite scroll, pull-to-refresh, empty state, loading footer.
- **payments/upload-proof.tsx** -- Image picker via `pickAndUploadImage`, form fields (amount decimal-pad, date, reference, bank), KeyboardAvoidingView, validation with Alerts, submit mutation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted to actual get_unit_balance RPC return shape**
- **Found during:** Task 1
- **Issue:** Plan specified `total_interest` and `oldest_unpaid_date` fields, but the actual RPC returns `last_charge_date` instead and has no `total_interest` field.
- **Fix:** Used actual database schema fields. Replaced third breakdown column from "Intereses" to "Vencido" (days overdue count).
- **Files modified:** BalanceCard.tsx, usePayments.ts

## Verification

- TypeScript: `npx tsc --noEmit` passes with zero errors after both tasks.

## Next Phase Readiness

All payment screens are functional. The `_layout.tsx` was already pre-created with routes for `index`, `history`, and `upload-proof`. Ready for guard gate screens in 10-04.
