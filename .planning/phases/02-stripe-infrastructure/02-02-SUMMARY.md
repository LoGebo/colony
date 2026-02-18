---
phase: 02-stripe-infrastructure
plan: 02
subsystem: payments
tags: [stripe, edge-function, deno, supabase, payments, oxxo, idempotency]

# Dependency graph
requires:
  - phase: 02-01
    provides: "stripe_customers table, payment_intents table, webhook_events table"
  - phase: 01-fix-record-payment
    provides: "record_payment() function, unit_balances view (total_receivable)"
provides:
  - "create-payment-intent Edge Function (POST /functions/v1/create-payment-intent)"
  - "Server-side entry point for all mobile Stripe payments"
  - "Get-or-create Stripe Customer pattern per resident+unit"
  - "Idempotent PaymentIntent creation with DB-level deduplication"
affects:
  - 02-03-payment-webhook
  - mobile-payments (PaymentSheet integration)
  - admin-payment-dashboard

# Tech tracking
tech-stack:
  added:
    - "npm:stripe@17 (Deno import)"
    - "jsr:@supabase/supabase-js@2 (Deno import)"
  patterns:
    - "Dual Supabase client pattern: serviceClient (service_role, bypasses RLS) + userClient (anon key + JWT, for auth only)"
    - "3-step resident authorization: getUser() -> residents.user_id lookup -> occupancies.resident_id check"
    - "Amount validation against unit_balances.total_receivable view"
    - "Race condition handling on stripe_customers INSERT (23505 -> retry SELECT)"
    - "DB-level idempotency on payment_intents.idempotency_key (23505 -> retrieve existing PI)"
    - "Stripe error type discrimination (RateLimitError->429, CardError->400, AuthError->500)"
    - "OXXO: expires_after_days:2 in Stripe + expires_at NOW()+48h in DB"

key-files:
  created:
    - supabase/functions/create-payment-intent/index.ts
  modified: []

key-decisions:
  - "Dual client pattern: service_role client for DB reads/writes (bypasses RLS), anon+JWT client only for auth.getUser(). This ensures no resident can access other residents' data through the function."
  - "Amount validation allows partial payment (amount <= total_receivable, not == total_receivable). This supports making a partial payment toward a balance."
  - "unit_balances query uses .single() - if unit has no transactions, this returns no row. totalReceivable defaults to 0, which means any amount > 0 would fail validation. This is correct: you can't pay if nothing is owed."
  - "Idempotency key passed to both Stripe (idempotencyKey option) and stored in DB (UNIQUE constraint). DB check fires first on retry before reaching Stripe API."
  - "client_secret not stored in DB (security best practice). On duplicate idempotency_key, function retrieves PI from Stripe to return current client_secret."
  - "payment_method_types uses array form (not payment_method_configuration) to support both card and OXXO explicitly."

patterns-established:
  - "Edge Function CORS: OPTIONS->200 with wildcard origin, all subsequent errors/successes include CORS headers via jsonResponse() helper"
  - "No secrets in error responses: Stripe auth/config errors log to console.error but return generic '500 Payment service configuration error'"

# Metrics
duration: 15min
completed: 2026-02-18
---

# Phase 02 Plan 02: create-payment-intent Edge Function Summary

**Deno Edge Function that authenticates the resident, validates their unit occupancy, checks amount against outstanding balance, creates or reuses a Stripe Customer, creates a Stripe PaymentIntent with idempotency, persists to payment_intents table, and returns the clientSecret for the mobile PaymentSheet**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 1/1 completed
- **Files modified:** 1 (created)

## Accomplishments

- `supabase/functions/create-payment-intent/index.ts` - Full implementation of the Edge Function
- CORS preflight handling (OPTIONS -> 200)
- JWT authentication via dual-client pattern
- 3-step resident authorization: auth.getUser() + residents.user_id + occupancies.resident_id
- Amount validation against `unit_balances.total_receivable` (not `current_balance`)
- Get-or-create Stripe Customer with race condition handling on UNIQUE(resident_id, unit_id)
- Stripe PaymentIntent creation with idempotency key passed to Stripe API
- DB insert with UNIQUE(idempotency_key) second line of defense against double charges
- Duplicate idempotency_key handled gracefully: retrieves existing PI and returns current clientSecret
- OXXO support: `expires_after_days: 2` in Stripe + `expires_at NOW()+48h` in payment_intents
- Stripe error discrimination: RateLimitError->429, CardError/InvalidRequest->400, AuthError->500, generic->500
- Response: `{ clientSecret, paymentIntentId, customerId, status }` with HTTP 201

## Task Commits

1. **Task 1: Create the create-payment-intent Edge Function** - `b252d7d` (feat)

## Files Created/Modified

- `supabase/functions/create-payment-intent/index.ts` - Deno Edge Function (369 lines)
  - Imports: `jsr:@supabase/functions-js/edge-runtime.d.ts`, `jsr:@supabase/supabase-js@2`, `npm:stripe@17`
  - Handles: CORS, auth, validation, customer management, PaymentIntent creation, DB persistence

## Decisions Made

- **Dual Supabase client pattern**: `serviceClient` (service_role) for all DB operations; `userClient` (anon+JWT) only for `auth.getUser()`. Ensures Edge Function always has write access via service_role while correctly verifying the caller's identity.
- **Partial payment allowed**: `amount <= total_receivable` (not strict equality). Residents can make partial payments toward their balance.
- **No client_secret storage**: Stripe recommends never persisting client_secret. On idempotent replay, the function calls `stripe.paymentIntents.retrieve()` to get the current secret.
- **Race condition on stripe_customers**: If two requests simultaneously create a Stripe Customer for the same resident+unit, the second INSERT will fail with 23505. The function catches this and does a SELECT to get the winner's customer ID.

## Deviations from Plan

None - plan executed exactly as written. All 12 implementation steps completed as specified. Additional robustness added:
- Race condition handling on stripe_customers INSERT (Rule 2 - Missing Critical: prevents 500 error under concurrent requests)
- Idempotent response for duplicate payment_intents inserts (Rule 2 - Missing Critical: prevents data loss if client retries after timeout)
- Early authHeader null check before creating userClient (Rule 2 - Missing Critical: cleaner 401 before any client initialization)

## Deployment Note

The `mcp__supabase__deploy_edge_function` MCP tool was not available in this session. The function is written to disk at `supabase/functions/create-payment-intent/index.ts` for version control. Manual deployment via Supabase dashboard or CLI is required before mobile clients can call this endpoint.

Required environment variables in Supabase Edge Function secrets:
- `STRIPE_SECRET_KEY` - Stripe secret key (sk_live_xxx or sk_test_xxx)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` - auto-provided by Supabase runtime

## Next Phase Readiness

- Plan 02-03 (payment-webhook) can reference payment_intents table by stripe_payment_intent_id
- Mobile clients can call POST /functions/v1/create-payment-intent with JWT + body to get clientSecret
- No blockers for remaining plans

---
*Phase: 02-stripe-infrastructure*
*Completed: 2026-02-18*
