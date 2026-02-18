---
phase: "03-mobile-payment-screen"
plan: "02"
subsystem: "mobile-payments"
tags: ["stripe", "paymentsheet", "realtime", "checkout", "react-native"]

dependency_graph:
  requires: ["03-01"]
  provides: ["useCreatePaymentIntent hook", "checkout screen with PaymentSheet flow"]
  affects: ["03-03"]

tech_stack:
  added: []
  patterns: ["edge-function-via-fetch", "realtime-payment-confirmation", "paymentsheet-flow", "idempotent-payment-creation"]

key_files:
  created:
    - packages/mobile/app/(resident)/payments/checkout.tsx
  modified:
    - packages/mobile/src/hooks/usePayments.ts
    - packages/mobile/app/(resident)/payments/_layout.tsx

decisions:
  - id: "fetch-not-invoke"
    decision: "Use fetch() directly for edge function calls, NOT supabase.functions.invoke()"
    rationale: "supabase.functions.invoke() does not correctly forward user JWT for verify_jwt: true edge functions (Pitfall 2)"
  - id: "idempotency-per-tap"
    decision: "Generate new crypto.randomUUID() per Pay button tap, not on screen mount"
    rationale: "Prevents Pitfall 6 where retries after failure reuse stale idempotency key and get cached error response"
  - id: "timeout-optimistic-success"
    decision: "10-second timeout with optimistic success if Realtime update not received"
    rationale: "Webhook may be delayed; user already confirmed via PaymentSheet so payment is likely succeeded"
  - id: "amount-in-pesos"
    decision: "Amount sent to edge function is in MXN pesos, not centavos"
    rationale: "Edge function handles centavo conversion internally"

metrics:
  completed: "2026-02-18"
---

# Phase 03 Plan 02: Checkout Screen with PaymentSheet + Realtime Summary

**One-liner:** Stripe PaymentSheet checkout flow with balance display, amount selection, edge function integration, Realtime confirmation, and animated success/failure states.

## What Was Done

### Task 1: useCreatePaymentIntent Hook
- Added `CreatePaymentIntentResponse` and `CreatePaymentIntentInput` type interfaces
- Implemented `useCreatePaymentIntent()` mutation using direct `fetch()` with JWT `Authorization: Bearer` header and `apikey` header
- Calls `create-payment-intent` edge function at `EXPO_PUBLIC_SUPABASE_URL/functions/v1/create-payment-intent`
- Returns `clientSecret`, `paymentIntentId`, `customerId`, `status`
- All existing hooks (`useUnitBalance`, `useTransactions`, `usePaymentProofs`, `useUploadPaymentProof`) left completely unchanged

### Task 2: Checkout Screen + Layout
- Added `<Stack.Screen name="checkout" />` to payments `_layout.tsx`
- Created full checkout screen at `/(resident)/payments/checkout` with:
  - **Balance display**: Shows outstanding balance from `useUnitBalance`
  - **Quick-select chips**: Full Balance and 50% options
  - **Custom amount input**: With `$10 min` / `currentBalance max` validation and inline error messages
  - **Pay flow**: `handlePay` -> edge function call -> `initPaymentSheet` -> `presentPaymentSheet` -> Realtime wait
  - **Cancel handling**: `presentError.code === 'Canceled'` silently returns to idle state
  - **Realtime subscription**: Watches `payment_intents` table filtered by `stripe_payment_intent_id` for status updates
  - **10-second timeout**: Fallback to optimistic success if webhook/Realtime is delayed
  - **Success state**: BounceIn checkmark, FadeInDown title/amount, Done button
  - **Timeout state**: Same as success but with "Payment Submitted" title and processing message
  - **Failed state**: Inline error banner with retry option
  - **Processing state**: Spinner in Pay button with "Confirming payment..." label
  - **Idempotency**: New `crypto.randomUUID()` generated per Pay button tap
  - **returnURL**: `upoe://payment-sheet` matching app scheme

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| useCreatePaymentIntent uses fetch() with JWT | PASS |
| checkout.tsx has complete PaymentSheet flow | PASS |
| _layout.tsx has checkout as Stack.Screen | PASS |
| Cancel from PaymentSheet returns to idle | PASS |
| 10-second timeout fallback exists | PASS |
| Idempotency key per Pay tap | PASS |
| returnURL is upoe://payment-sheet | PASS |
| Amount validation: min $10, max = balance | PASS |
| Success state with animated checkmark | PASS |
| All styles use Lumina design tokens | PASS |

## Commits

| Hash | Message |
|------|---------|
| d8b9cdc | feat(03-02): add useCreatePaymentIntent hook |
| 1e72b05 | feat(03-02): build checkout screen with PaymentSheet + Realtime |

## Next Phase Readiness

Plan 03-03 can proceed. The checkout screen is fully wired to the backend edge functions (create-payment-intent) and uses Realtime for payment confirmation. The remaining work is connecting the payment dashboard "Pay with Card" button to navigate to this checkout screen, and any additional polish/testing.
