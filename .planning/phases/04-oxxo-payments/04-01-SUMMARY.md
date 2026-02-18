---
phase: 04-oxxo-payments
plan: 01
subsystem: payments
tags: [stripe, oxxo, webhook, edge-functions, push-notifications, supabase, deno]

# Dependency graph
requires:
  - phase: 03-mobile-payment-screen
    provides: create-payment-intent edge function with OXXO support, payment_intents table with metadata JSONB
  - phase: 02-stripe-infrastructure
    provides: payment-webhook base implementation, webhook_events idempotency pattern, record_payment RPC

provides:
  - payment_intent.processing event handler (OXXO bank settlement in-progress)
  - JSONB-merge storage of hosted_voucher_url in payment_intents.metadata on requires_action
  - OXXO expiry push notification via send-push on payment_failed
  - Dynamic ledger description (Pago OXXO vs Pago con tarjeta) in payment_intent.succeeded

affects:
  - 04-02 (mobile OXXO flow reads hosted_voucher_url from payment_intents.metadata)
  - 04-03 (admin OXXO monitoring reads processing/failed status)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSONB merge pattern (fetch existing -> spread -> add new fields) to safely update metadata
    - Non-critical try/catch wrapping for push notifications in webhook handlers
    - DB-first payment_method_type lookup in webhook (avoids trusting Stripe event metadata)

key-files:
  created: []
  modified:
    - supabase/functions/payment-webhook/index.ts

key-decisions:
  - "JSONB metadata merge in requires_action handler to preserve stripe_created and payment_method_types fields"
  - "DB lookup for payment_method_type in failed and succeeded handlers (not Stripe event) for consistency"
  - "OXXO expiry push wrapped in try/catch — non-critical, must not fail the webhook response"
  - "create-payment-intent confirmed fully correct for OXXO — no changes needed"

patterns-established:
  - "JSONB merge pattern: always fetch existing record, spread into new object, then update"
  - "Non-critical side effects (push notifications) always wrapped in try/catch in webhook handlers"

# Metrics
duration: 15min
completed: 2026-02-18
---

# Phase 04 Plan 01: OXXO Webhook Lifecycle Upgrades Summary

**Payment-webhook upgraded with 4 OXXO-specific changes: processing handler, hosted_voucher_url JSONB merge on requires_action, expiry push notification on failed, and dynamic "Pago OXXO via Stripe" ledger description on succeeded.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2 (1 code change, 1 verification)
- **Files modified:** 1

## Accomplishments

- Added `handlePaymentIntentProcessing` handler — the 6th event handler in payment-webhook, wired into the switch statement under `payment_intent.processing`
- Upgraded `handlePaymentIntentRequiresAction` to safely MERGE `hosted_voucher_url` into JSONB metadata (preserving `stripe_created` and `payment_method_types` from create-payment-intent)
- Upgraded `handlePaymentIntentFailed` to send OXXO-specific expiry push notification via `send-push` edge function, conditional on `payment_method_type === 'oxxo'`, wrapped in try/catch
- Upgraded `handlePaymentIntentSucceeded` to use dynamic description based on `payment_method_type` from local DB record: `"Pago OXXO via Stripe - {piId}"` vs `"Pago con tarjeta via Stripe - {piId}"`
- Confirmed `create-payment-intent` edge function already fully supports OXXO (payment_method_types, expires_after_days, expires_at, validation) — no changes needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade payment-webhook for OXXO lifecycle** - `1406162` (feat)
2. **Task 2: Confirm create-payment-intent OXXO support** - no commit (verification only, no code changes)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/functions/payment-webhook/index.ts` - 4 OXXO lifecycle upgrades (processing handler, requires_action JSONB merge, failed push, succeeded description)

## Decisions Made

- **JSONB merge pattern used in requires_action handler:** When storing `hosted_voucher_url`, we first fetch the existing `metadata` record and spread it, then add the new field. This preserves `stripe_created` and `payment_method_types` set by create-payment-intent. Never overwrite JSONB directly.

- **DB lookup for `payment_method_type` in failed and succeeded handlers:** Rather than extracting from the Stripe event payload (which has different structure for different events), we query the local `payment_intents` table. This is safer and avoids parsing nested event payloads.

- **OXXO expiry push is non-critical:** Failure to send the push notification must not fail the webhook response (which would cause Stripe to retry and potentially re-process the payment). Wrapped in try/catch.

- **create-payment-intent confirmed no changes needed:** All OXXO backend logic (payment_method_types array, expires_after_days: 2, expires_at calculation, 'oxxo' validation) was already implemented in Phase 03. The plan correctly identified this as a verification task only.

## Deviations from Plan

None - plan executed exactly as written. All 4 webhook changes implemented as specified. Task 2 confirmed as verification-only with no code changes required.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this plan. The webhook changes take effect on next Supabase deploy.

## Next Phase Readiness

- `hosted_voucher_url` is now stored in `payment_intents.metadata` — Plan 04-02 (mobile OXXO flow) can read it via Realtime subscription or direct query
- `payment_intent.processing` status correctly handled — mobile UI can display "processing" state
- OXXO expiry notifications will fire automatically when voucher expires (Stripe sends `payment_intent.payment_failed` for OXXO timeout)
- Ledger entries will correctly show "Pago OXXO via Stripe" for OXXO payments

---
*Phase: 04-oxxo-payments*
*Completed: 2026-02-18*
