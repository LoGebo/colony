# Payment System Roadmap

## Milestone 1: Complete Payment System

### Phase 01: Fix record_payment + Webhook Base
**Status:** COMPLETE
**Goal:** Enable manual payment flow (proof upload -> approval -> ledger entry)
- Created record_payment() function with double-entry accounting
- Seeded standard chart of accounts for demo community
- Verified E2E: charge -> payment proof -> approval -> balance update

### Phase 02: Stripe Infrastructure (DB + Edge Functions)
**Status:** Planning complete
**Goal:** Tables for Stripe integration + Edge Functions ready to process payments
**Plans:** 4 plans

Plans:
- [ ] 02-01-PLAN.md -- DB tables (stripe_customers, webhook_events, payment_intents) + RLS policies
- [ ] 02-02-PLAN.md -- Edge Function: create-payment-intent (JWT auth, amount validation, Stripe PI creation)
- [ ] 02-03-PLAN.md -- Edge Function: payment-webhook upgrade (HMAC verification, idempotency, record_payment)
- [ ] 02-04-PLAN.md -- Deploy migrations, Edge Functions, configure Stripe secrets + webhook endpoint

### Phase 03: Mobile Payment Screen (Card)
**Status:** Not started
**Goal:** Resident can pay with credit/debit card from the app
- Install @stripe/stripe-react-native with Expo config plugin
- Add StripeProvider to root layout
- Create checkout screen with PaymentSheet integration
- Realtime subscription for payment confirmation
- E2E: pay with test card -> webhook -> balance updates

### Phase 04: OXXO Payments
**Status:** Not started
**Goal:** Resident can generate OXXO voucher and pay at store
- Enable OXXO in Stripe Dashboard
- Extend create-payment-intent for OXXO method
- Create OXXO voucher screen (barcode, reference, expiration)
- Handle expired vouchers in webhook
- Push notification when OXXO payment processed

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
