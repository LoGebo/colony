# Payment System Roadmap

## Milestone 1: Complete Payment System

### Phase 01: Fix record_payment + Webhook Base
**Status:** COMPLETE
**Goal:** Enable manual payment flow (proof upload -> approval -> ledger entry)
- Created record_payment() function with double-entry accounting
- Seeded standard chart of accounts for demo community
- Verified E2E: charge -> payment proof -> approval -> balance update

### Phase 02: Stripe Infrastructure (DB + Edge Functions)
**Status:** COMPLETE (Stripe secrets pending user configuration)
**Goal:** Tables for Stripe integration + Edge Functions ready to process payments
**Completed:** 2026-02-18
- [x] 02-01: DB tables (stripe_customers, webhook_events, payment_intents) + RLS policies
- [x] 02-02: Edge Function create-payment-intent (JWT auth, amount validation, Stripe PI creation)
- [x] 02-03: Edge Function payment-webhook (HMAC verification, idempotency, record_payment)
- [x] 02-04: Deploy migrations + Edge Functions (Stripe secrets = user checkpoint)
- Verification: 28/28 automated checks passed, 3 items need user action (Stripe secrets)

### Phase 03: Mobile Payment Screen (Card)
**Status:** COMPLETE (human E2E testing pending Stripe keys)
**Goal:** Resident can pay with credit/debit card from the app
**Completed:** 2026-02-18
- [x] 03-01: DB migration (Realtime + index) + Stripe SDK v0.50.3 + StripeProvider
- [x] 03-02: useCreatePaymentIntent hook + Checkout screen (PaymentSheet + Realtime + success/failure)
- [x] 03-03: Dashboard wiring (Pay Now + Pay with Card entry points)
- Verification: 16/16 must-haves passed, 4 items need human testing with Stripe keys

### Phase 04: OXXO Payments
**Status:** COMPLETE (human E2E testing pending Stripe keys + OXXO enabled)
**Goal:** Resident can generate OXXO voucher and pay at any OXXO convenience store
**Completed:** 2026-02-18
- [x] 04-01: Webhook OXXO lifecycle (processing handler, voucher URL storage, expiry push, description differentiation)
- [x] 04-02: Checkout OXXO branch (confirmPayment flow, voucher_generated state, usePendingOxxoVoucher hook)
- [x] 04-03: Dashboard OXXO UI (action card, pending voucher section, disable logic)
- Verification: 17/17 must-haves passed, 4 items need human testing with Stripe keys + OXXO enabled

### Phase 05: Automated Charge Generation
**Status:** Not started
**Goal:** Admin can generate monthly charges safely without duplicates
- Create charge_runs and charge_run_items tables
- Create generate_monthly_charges() function with UNIQUE constraint
- Admin UI for charge generation with preview + confirmation
- Charge run history with per-unit detail

### Phase 06: Digital Receipts and Notifications
**Status:** Not started
**Goal:** Automatic receipt generation after every payment
- Edge Function generate-receipt (PDF with pdf-lib)
- Post-payment trigger for receipt generation + Storage upload
- Mobile screen to view/download receipts
- Push notifications for payment confirmation and new charges

### Phase 07: Admin Financial Dashboard Improvements
**Status:** Not started
**Goal:** Complete financial visibility for administrators
- PaymentIntent tracking view (succeeded, failed, pending)
- Stripe vs internal ledger reconciliation
- Collection reports by payment method
- Failed webhook alerts
- CSV/Excel transaction export

### Phase 08: Future Extensions
**Status:** Not started
**Goal:** Advanced payment features (deferred)
- SPEI via Stripe
- Meses sin intereses (MSI)
- Domiciliacion bancaria
- CFDI integration (Facturapi)
- Stripe Connect for multi-community platform
- Apple Pay / Google Pay
