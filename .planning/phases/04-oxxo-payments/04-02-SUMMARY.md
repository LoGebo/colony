---
phase: 04-oxxo-payments
plan: 02
subsystem: payments
tags: [stripe, oxxo, react-native, expo-router, tanstack-query, supabase]

# Dependency graph
requires:
  - phase: 04-01
    provides: payment-webhook OXXO lifecycle handling (requires_action, charge.succeeded, voucher_invalidated)
  - phase: 03-mobile-payment-screen
    provides: checkout.tsx base screen with PaymentSheet card flow + Realtime subscription
provides:
  - OXXO branch in checkout.tsx using confirmPayment() with paymentMethodType 'Oxxo'
  - voucher_generated PaymentState with "Voucher Generado" success screen
  - usePendingOxxoVoucher hook querying non-expired OXXO vouchers with status requires_action
  - CreatePaymentIntentInput.payment_method_type extended to 'card' | 'oxxo'
affects:
  - 04-03 (dashboard OXXO pending voucher card uses usePendingOxxoVoucher)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-branch checkout: isOxxo flag gates confirmPayment vs PaymentSheet"
    - "OXXO billing details from useResidentProfile (first_name + paternal_surname) + useAuth (email)"
    - "No Realtime subscription or timeout after OXXO — settles hours/days later"
    - "paymentMethodType: 'Oxxo' (capital O) in confirmPayment call — SDK-verified casing"

key-files:
  created: []
  modified:
    - packages/mobile/src/hooks/usePayments.ts
    - packages/mobile/app/(resident)/payments/checkout.tsx

key-decisions:
  - "confirmPayment uses paymentMethodType: 'Oxxo' (capital O) as required by @stripe/stripe-react-native SDK"
  - "OXXO flow does NOT start Realtime subscription or 10-second timeout — payment settles hours to days later"
  - "Billing details sourced from useResidentProfile (name) and useAuth (email) — no additional prompt to user"
  - "voucher_generated state is distinct from success/timeout — shows receipt icon and Spanish instructions"
  - "Unused Linking import removed to avoid lint warnings — hostedVoucherUrl display deferred to future plan"

patterns-established:
  - "isOxxo flag: derive from paymentMethodType route param at screen top, gate all OXXO logic behind it"
  - "Card flow: zero changes when isOxxo is false — isolation via conditional return inside handlePay"

# Metrics
duration: 15min
completed: 2026-02-18
---

# Phase 04 Plan 02: OXXO Checkout Flow Summary

**OXXO payment branch in checkout.tsx using confirmPayment() + billingDetails, with voucher_generated state and usePendingOxxoVoucher hook for dashboard integration**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-18T00:00:00Z
- **Completed:** 2026-02-18T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `CreatePaymentIntentInput.payment_method_type` to accept `'card' | 'oxxo'`, enabling the edge function to create OXXO PaymentIntents
- Added `usePendingOxxoVoucher` hook that queries `payment_intents` for non-expired OXXO vouchers with `status=requires_action` — used by the dashboard (Plan 03)
- Added OXXO branch in checkout's `handlePay`: calls `confirmPayment()` with `paymentMethodType: 'Oxxo'` and billing details from resident profile; ends in `voucher_generated` state (no Realtime or timeout)
- Card flow is 100% unchanged — all OXXO logic is gated behind `if (isOxxo)` check

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend usePayments.ts with OXXO type and pending voucher hook** - `a3a5fee` (feat)
2. **Task 2: Add OXXO branch to checkout screen** - `92634dd` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/mobile/src/hooks/usePayments.ts` - Changed `payment_method_type: 'card'` to `'card' | 'oxxo'`; added `PendingOxxoVoucher` interface and `usePendingOxxoVoucher` hook
- `packages/mobile/app/(resident)/payments/checkout.tsx` - Added `useLocalSearchParams`, `confirmPayment`, `useResidentProfile`, `useAuth`; added OXXO branch in `handlePay`; added `voucher_generated` render state; dynamic header title and pay button text

## Decisions Made

- `confirmPayment` uses `paymentMethodType: 'Oxxo'` (capital O) — verified from @stripe/stripe-react-native SDK source
- OXXO flow intentionally does NOT start Realtime subscription or 10-second timeout — OXXO payments settle at the physical store hours to days after voucher generation
- Billing details are sourced silently from `useResidentProfile` (name) and `useAuth` (email) — no user prompt needed
- `voucher_generated` is a distinct PaymentState (not reusing `success`) to show OXXO-specific messaging in Spanish

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused Linking import**
- **Found during:** Task 2 (Add OXXO branch to checkout screen)
- **Issue:** Plan spec listed `Linking` as an import to add, but no code in the OXXO flow calls `Linking.openURL()`. Unused imports cause lint warnings and TypeScript noise.
- **Fix:** Did not include `Linking` in the final import. The plan also explicitly says to avoid `oxxoDisplayDetails.hostedVoucherUrl`, confirming no URL-opening is needed.
- **Files modified:** packages/mobile/app/(resident)/payments/checkout.tsx
- **Verification:** No `Linking` reference in the file; all OXXO logic works without it.
- **Committed in:** `92634dd` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - unused import removed)
**Impact on plan:** Minimal cleanup only. No scope change.

## Issues Encountered

None - plan executed exactly as specified. The dual-branch checkout architecture (card vs. OXXO) was clean to implement via the `isOxxo` flag pattern.

## User Setup Required

None - no external service configuration required for this plan. OXXO payment flow requires the Stripe publishable key (set in Phase 03) and a test OXXO PaymentIntent from the create-payment-intent edge function.

## Next Phase Readiness

- `usePendingOxxoVoucher` hook is ready for Plan 03 (dashboard OXXO pending voucher card)
- Checkout screen correctly branches card vs. OXXO — ready for E2E testing with Stripe test keys
- OXXO flow ends in `voucher_generated` state; the webhook (Plan 01) handles the `payment_intent.succeeded` event when user pays at OXXO store

---
*Phase: 04-oxxo-payments*
*Completed: 2026-02-18*
