---
phase: 02-stripe-infrastructure
plan: 03
subsystem: payments
tags: [stripe, webhooks, deno, edge-functions, hmac, idempotency, record_payment, push-notifications]

# Dependency graph
requires:
  - phase: 02-01
    provides: "webhook_events table (idempotency), payment_intents table (status tracking), stripe_customers table"
  - phase: 01-fix-record-payment
    provides: "record_payment() RPC function, double-entry ledger infrastructure"
provides:
  - "payment-webhook Deno Edge Function: production-ready Stripe webhook handler"
  - "HMAC-SHA256 signature verification with timing-safe comparison"
  - "Idempotent event processing via webhook_events deduplication"
  - "Automatic ledger recording via record_payment() on payment_intent.succeeded"
  - "Push notification dispatch on successful payment"
affects:
  - 02-04-mobile-payment-sheet
  - admin-payment-dashboard
  - phase-07-refund-handling

# Tech tracking
tech-stack:
  added:
    - "jsr:@std/crypto/timing-safe-equal (Deno standard library for HMAC comparison)"
    - "jsr:@supabase/supabase-js@2 (service-role client in Edge Function)"
  patterns:
    - "Timing-safe HMAC comparison via timingSafeEqual (NOT crypto.subtle.timingSafeEqual which does not exist in Deno)"
    - "Raw body read before JSON parse for Stripe HMAC verification (req.text() not req.json())"
    - "SELECT-then-INSERT idempotency with 23505 unique_violation race guard"
    - "Non-critical side effects (push notifications) wrapped in try/catch"
    - "Always return 200 to Stripe after valid signature to prevent retry storms"
    - "Centavos-to-pesos conversion: Stripe amount / 100 for record_payment()"

key-files:
  created:
    - supabase/functions/payment-webhook/index.ts
  modified: []

key-decisions:
  - "timingSafeEqual from jsr:@std/crypto (not crypto.subtle): crypto.subtle.timingSafeEqual does not exist in Deno; Deno standard library provides the correct implementation"
  - "Always return 200 after valid signature: non-200 would trigger Stripe retry loop; failures are logged in webhook_events.error_message instead"
  - "p_created_by = metadata.resident_id: required for audit trail in record_payment(); edge function looks up residents.user_id separately only for push notification"
  - "p_payment_method_id = null: Stripe is not a row in the payment_methods table (which stores bank accounts, cash, etc.); Stripe identity is captured in payment_intents.stripe_payment_intent_id"
  - "charge.refunded is stub: full ledger reversal (credit note, A/R reversal) is Phase 07 scope; event is logged with transaction_id reference for traceability"
  - "Push notification is non-critical: wrapped in try/catch; payment success is recorded regardless of notification delivery"

patterns-established:
  - "Stripe webhook HMAC verification pattern: parse t=/v1= header fields, compute HMAC-SHA256(timestamp.payload), timingSafeEqual comparison"
  - "Webhook idempotency: SELECT before INSERT, catch 23505 on INSERT, update status to completed/failed after processing"
  - "Service-role-only Edge Function: no JWT required for webhook; Stripe authenticates via HMAC not bearer token"

# Metrics
duration: 15min
completed: 2026-02-18
---

# Phase 02 Plan 03: Payment Webhook Edge Function Summary

**Production-ready Stripe payment-webhook Deno Edge Function with timing-safe HMAC verification, idempotent event processing via webhook_events, record_payment() RPC call on succeeded events, and non-critical push notifications**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2/2 completed
- **Files created:** 1

## Accomplishments

- `supabase/functions/payment-webhook/index.ts` - 453-line production-ready Deno Edge Function
- HMAC-SHA256 signature verification using `jsr:@std/crypto/timing-safe-equal` (NOT `crypto.subtle.timingSafeEqual` which does not exist in Deno)
- 5-minute timestamp tolerance rejects replay attacks
- Idempotent event processing: SELECT existing event first, INSERT as "processing", catch PostgreSQL 23505 unique_violation for race conditions
- Routes 5 Stripe event types: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.requires_action`, `charge.refunded`
- On `payment_intent.succeeded`: updates payment_intents status, calls `record_payment()` with centavos/100 conversion and `p_created_by=residentId`, stores returned `transaction_id` back in `payment_intents`, dispatches push notification via `send-push`
- On failure events: updates payment_intents status only
- On `charge.refunded`: logs event with transaction_id reference (full reversal is Phase 07 scope)
- Always returns HTTP 200 after valid signature to prevent Stripe retry storms

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Implement full payment-webhook Edge Function** - `aca6fb6` (feat)

**Plan metadata:** see final commit (docs)

## Files Created/Modified

- `supabase/functions/payment-webhook/index.ts` - Complete Deno Edge Function: HMAC verification, idempotency, 5 event handlers, record_payment() RPC, push notifications

## Decisions Made

- **`timingSafeEqual` from `jsr:@std/crypto`**: `crypto.subtle.timingSafeEqual` does not exist in Deno's Web Crypto API. The correct import is `import { timingSafeEqual } from "jsr:@std/crypto/timing-safe-equal"` and it is called as a standalone function (not as a method on crypto.subtle).
- **Always return 200 after valid signature**: If processing fails, the error is recorded in `webhook_events.error_message` and logged. Returning non-200 would cause Stripe to retry the webhook on an exponential backoff, potentially creating duplicate records. The idempotency guard handles the retry correctly.
- **`p_created_by = metadata.resident_id`**: The `record_payment()` function requires `p_created_by` as a UUID for audit trail. The resident's business ID (from `metadata.resident_id`) is the correct value. The resident's `user_id` (auth UUID) is only looked up separately for the push notification target.
- **`p_payment_method_id = null`**: The `payment_methods` table contains community-configured methods (bank transfer, cash, OXXO at admin). Stripe card payments are identified by `stripe_payment_intent_id` and don't have a corresponding row in `payment_methods`.
- **`charge.refunded` is a stub**: The event is received, the corresponding payment_intent is looked up, and the transaction_id is logged. Full ledger reversal (debit bank account, credit A/R, create credit note transaction) is deferred to Phase 07 scope to avoid premature complexity.
- **Push notification non-critical**: Network errors, invalid user_id, or send-push function failures must not prevent payment recording. The entire push dispatch is wrapped in `try/catch`.

## Deviations from Plan

None - plan executed exactly as written. Tasks 1 and 2 were combined into a single commit since Task 2 adds handlers to the same file created in Task 1 (no intermediate state that warranted a separate commit).

## Verification Results

All 10 verification criteria pass:
1. File exists: `supabase/functions/payment-webhook/index.ts`
2. Import: `jsr:@std/crypto/timing-safe-equal` (line 3)
3. Signature verification: HMAC-SHA256 with `timingSafeEqual` (lines 50-76)
4. Timestamp tolerance: 300 seconds / 5 minutes (line 24)
5. Idempotency: SELECT then INSERT with 23505 race guard (lines 361-398)
6. Event routing: all 5 event types in switch statement (lines 410-427)
7. `record_payment`: `amount/100`, `p_created_by=residentId??null`, `p_payment_method_id=null` (lines 136-147)
8. Transaction ID: non-null check + stored in payment_intents (lines 154-168)
9. Push notification: `send-push` invoked in try/catch (lines 171-199)
10. Response: always 200 after valid signature (line 450)

## User Setup Required

- `STRIPE_WEBHOOK_SECRET` environment variable must be set in Supabase Edge Function secrets (Stripe Dashboard -> Webhooks -> Signing secret)
- Stripe webhook endpoint must be configured to deliver: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.requires_action`, `charge.refunded`

## Next Phase Readiness

- Plan 02-04 (mobile PaymentSheet) can now create PaymentIntents knowing the webhook will handle completion
- The `metadata` passed to Stripe when creating a PaymentIntent must include: `community_id`, `unit_id`, `resident_id` (as documented in this function's `handlePaymentIntentSucceeded`)
- No blockers for subsequent plans

---
*Phase: 02-stripe-infrastructure*
*Completed: 2026-02-18*
