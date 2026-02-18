# Project State

## Current Phase
Phase 02: COMPLETE (Stripe secrets pending user configuration)

## Completed Phases
- Phase 01: Fix record_payment + Webhook Base (COMPLETE)
- Phase 02: Stripe Infrastructure (COMPLETE - 28/28 automated checks passed)

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

## Known Issues
- record_charge has mutable search_path (WARN, not blocking)
- Fee structure points to old accounts (1200, 4100) vs standard (1100, 4010)
- ~60 functions have mutable search_path (batch fix planned later)
- STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET not yet configured (user checkpoint)
- Webhook endpoint not yet registered in Stripe Dashboard (user checkpoint)

## Key IDs (Demo Data)
- Community: 00000000-0000-0000-0000-000000000010 (Residencial Las Palmas)
- Unit Casa 1: 00000000-0000-0000-0000-000000000101
- Admin user: 9410b0e0-b589-4421-b5a2-634e4a407ee2 (admin@demo.upoe.mx)
- Resident Carlos: 3b25ca26-68c9-49a2-8be1-383d8dbefb5b (carlos@demo.upoe.mx)
- Fee Structure: a0000000-0000-0000-0000-000000000001 (Cuota Mantenimiento $1,500)

## Edge Functions (5 deployed)
- `verify-qr` (JWT required) - QR HMAC verification
- `send-push` (JWT required) - FCM push + in-app notifications
- `payment-webhook` (no JWT) - Stripe webhook handler v2
- `create-payment-intent` (JWT required) - Stripe PaymentIntent creation

## Session Continuity
Last session: 2026-02-18
Phase 02 execution complete. QA testing in progress.
