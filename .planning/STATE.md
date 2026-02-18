# Project State

## Current Phase
Phase 04: COMPLETE (human E2E testing pending Stripe keys + OXXO enabled)

## Completed Phases
- Phase 01: Fix record_payment + Webhook Base (COMPLETE)
- Phase 02: Stripe Infrastructure (COMPLETE - 28/28 automated checks passed)
- Phase 03: Mobile Payment Screen (COMPLETE - 16/16 must-haves verified)
- Phase 04: OXXO Payments (COMPLETE - 17/17 must-haves verified)

## Decisions Made

| Date | Decision | Rationale |
|------|----------|-----------|
| earlier | Stripe Mexico selected as payment processor | - |
| earlier | PaymentSheet for PCI compliance (SAQ A level) | - |
| earlier | Webhook-driven architecture with idempotency via webhook_events table | - |
| earlier | record_payment() uses accounts 1010 (bank) and 1100 (AR) with SET search_path = '' | - |
| earlier | Live record_charge uses simpler pattern (direct posted, UUID reference suffix) | - |
| earlier | unit_balances view aggregates ALL accounts_receivable subtypes | - |
| earlier | Ledger entries are immutable (append-only, DELETE blocked by trigger) | - |
| 2026-02-18 | webhook_events has no community_id | Stripe events arrive globally; community context is in payload |
| 2026-02-18 | webhook_events has no audit trigger | No updated_at column; table is append-only |
| 2026-02-18 | Service-role-only writes on all payment tables | Edge Functions bypass RLS; no client write policies needed |
| 2026-02-18 | Resident payment_intents RLS via occupancies join | occupancies.resident_id is business ID, must join residents.user_id |
| 2026-02-18 | stripe_customer_id on payment_intents is TEXT not FK | Raw ID for direct Stripe API calls without joins |
| 2026-02-18 | expires_at on payment_intents for OXXO voucher expiry | OXXO vouchers expire 48h from creation; NULL for card payments |
| 2026-02-18 | idempotency_key UNIQUE at DB level | First line of defense against double charges, even on Edge Function retry |
| 2026-02-18 | Dual Supabase client in Edge Functions | serviceClient (service_role) for DB writes; userClient (anon+JWT) only for auth.getUser() |
| 2026-02-18 | Partial payment allowed (amount <= total_receivable) | Residents may pay partial balances; equality not enforced |
| 2026-02-18 | client_secret never stored in DB | Security best practice; retrieve from Stripe API on idempotent replay |
| 2026-02-18 | timingSafeEqual from jsr:@std/crypto (not crypto.subtle) | crypto.subtle.timingSafeEqual does not exist in Deno; Deno stdlib provides correct implementation |
| 2026-02-18 | Webhook always returns 200 after valid signature | Non-200 triggers Stripe retry storm; failures recorded in webhook_events.error_message |
| 2026-02-18 | p_payment_method_id = null for Stripe payments | Stripe is not a row in payment_methods table; identity captured via stripe_payment_intent_id |
| 2026-02-18 | charge.refunded is stub (full reversal Phase 07) | Full ledger reversal deferred to Phase 07 scope |
| 2026-02-18 | @stripe/stripe-react-native@0.50.3 for Expo SDK 54 | npx expo install resolved compatible version |
| 2026-02-18 | StripeProvider outside SessionProvider, inside QueryProvider | Stripe context doesn't depend on auth; must be available to all payment screens |
| 2026-02-18 | payment_intents added to supabase_realtime | Enables mobile Realtime subscriptions for payment status updates |
| 2026-02-18 | fetch() not supabase.functions.invoke() for edge functions | invoke() does not correctly forward user JWT for verify_jwt: true functions |
| 2026-02-18 | New idempotency key per Pay tap, not screen mount | Prevents stale cached error response on retry (Pitfall 6) |
| 2026-02-18 | 10-second timeout with optimistic success | Webhook may be delayed; PaymentSheet confirmed so payment likely succeeded |
| 2026-02-18 | JSONB merge pattern in requires_action handler | Preserves stripe_created and payment_method_types from create-payment-intent when adding hosted_voucher_url |
| 2026-02-18 | DB lookup for payment_method_type in webhook handlers | Safer than parsing nested Stripe event payload; consistent source of truth |
| 2026-02-18 | OXXO expiry push wrapped in try/catch (non-critical) | Push failure must not fail webhook response; Stripe would retry and risk double processing |
| 2026-02-18 | create-payment-intent confirmed no changes for OXXO | All OXXO backend logic already present from Phase 03 |
| 2026-02-18 | confirmPayment uses paymentMethodType: 'Oxxo' (capital O) | SDK-verified casing; lowercase 'oxxo' fails silently |
| 2026-02-18 | OXXO checkout does NOT start Realtime or 10s timeout | OXXO settles at physical store hours to days later; only card needs real-time confirmation |
| 2026-02-18 | Billing details for OXXO sourced silently from profile + auth | name from useResidentProfile, email from useAuth — no user prompt needed |
| 2026-02-18 | voucher_generated is a distinct PaymentState from success | Different UX: receipt icon, Spanish text, "Volver a Pagos" vs card flow "Done" |

## Known Issues
- record_charge has mutable search_path (WARN, not blocking)
- Fee structure points to old accounts (1200, 4100) vs standard (1100, 4010)
- ~60 functions have mutable search_path (batch fix planned later)
- STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET not yet configured (user checkpoint)
- Webhook endpoint not yet registered in Stripe Dashboard (user checkpoint)
- EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is pk_test_placeholder (user must replace)

## Key IDs (Demo Data)
- Community: 00000000-0000-0000-0000-000000000010 (Residencial Las Palmas)
- Unit Casa 1: 00000000-0000-0000-0000-000000000101
- Admin user: 9410b0e0-b589-4421-b5a2-634e4a407ee2 (admin@demo.upoe.mx)
- Resident Carlos: 3b25ca26-68c9-49a2-8be1-383d8dbefb5b (carlos@demo.upoe.mx)
- Fee Structure: a0000000-0000-0000-0000-000000000001 (Cuota Mantenimiento $1,500)

## QA Testing (Phase 02)
- **67/69 tests passed** (~97%) across 4 QA rounds
- Round 1: 43/43 DB constraints, FK, RLS, indexes, triggers
- Round 2: 22-finding security code review -> 15 fixes applied
- Round 3: 37/39 edge cases + integration -> 2 bugs found and fixed
- Round 4: 15/15 record_payment() + double-entry accounting
- **P0 bug fixed**: `last_name` -> `paternal_surname` in create-payment-intent
- **RLS fix**: stripe_customers soft-delete filter added
- **Design note**: webhook_events visible to all admins (no community_id by design)

## QA Testing (Phase 03)
- **16/16 must-haves verified** via structural code analysis
- **Exhaustive QA**: 2 parallel agents, 19 issues found (3 P0, 5 P1, 7 P2, 4 P3)
- **All P0 and P1 fixed**: crypto.randomUUID fallback, Realtime callback stability, occupancy status filter, NaN handling, loading skeleton, unitId guard, env types, stale closure
- **P2 fixes applied**: back button disabled during processing, Pay Now disabled at $0, shadow fix, theme tokens
- **Edge function redeployed**: create-payment-intent v4 (occupancy status='active' filter)
- 4 items need human testing with Stripe keys (E2E payment flow, cancel, decline, visual design)

## QA Testing (Phase 04)
- **17/17 must-haves verified** via structural code analysis
- **Exhaustive QA**: 22 issues found (8 P1, 10 P2, 4 P3)
- **All P1 fixed**: SEC-01 (idempotency &&→||), SEC-02 (URL scheme validation), EC-03 (email guard), EC-07 (status update failure), EC-08 (.single→.maybeSingle), INT-01 (query key + invalidation), INT-02 (Stripe timestamp for expires_at)
- **P2 fixes applied**: SEC-04 (OXXO email validation in edge fn), INT-04 (OXXO $10k cap), INT-06 (card disabled at $0), GlassCard style type fix
- Edge functions need redeployment: create-payment-intent v5, payment-webhook v5
- 4 items need human testing with Stripe keys + OXXO enabled in Stripe Dashboard

## Edge Functions (5 deployed)
- `verify-qr` (JWT required) - QR HMAC verification
- `send-push` (JWT required) - FCM push + in-app notifications
- `payment-webhook` v5 (no JWT) - Stripe webhook handler (QA fixes: maybeSingle, status update guard)
- `create-payment-intent` v5 (JWT required) - Stripe PaymentIntent creation (QA fixes: idempotency, email, OXXO cap, Stripe timestamp)

## Session Continuity
Last session: 2026-02-18
Phase 04 QA fixes applied. Proceeding to Phase 05: Automated Charge Generation.
