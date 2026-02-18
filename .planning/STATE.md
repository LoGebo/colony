# Project State

## Current Phase
Phase 02: Stripe Infrastructure (DB + Edge Functions)

## Completed Phases
- Phase 01: Fix record_payment + Webhook Base (COMPLETE)

## Current Position
Phase: 02 of unknown (Stripe Infrastructure)
Plan: 01 of unknown in phase
Status: In progress
Last activity: 2026-02-18 - Completed 02-01-PLAN.md (Stripe DB Tables)

Progress: Phase 01 complete, Phase 02 plan 01 complete
░░░░░░░░░░░░░░░░░░░░ (ongoing)

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

## Known Issues
- record_charge has mutable search_path (WARN, not blocking)
- Fee structure points to old accounts (1200, 4100) vs standard (1100, 4010)
- ~60 functions have mutable search_path (batch fix planned later)

## Key IDs (Demo Data)
- Community: 00000000-0000-0000-0000-000000000010 (Residencial Las Palmas)
- Unit Casa 1: 00000000-0000-0000-0000-000000000101
- Admin user: 9410b0e0-b589-4421-b5a2-634e4a407ee2 (admin@demo.upoe.mx)
- Resident Carlos: 3b25ca26-68c9-49a2-8be1-383d8dbefb5b (carlos@demo.upoe.mx)
- Fee Structure: a0000000-0000-0000-0000-000000000001 (Cuota Mantenimiento $1,500)

## Session Continuity
Last session: 2026-02-18
Stopped at: Completed 02-01-PLAN.md
Resume file: None
