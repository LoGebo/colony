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
**Status:** COMPLETE
**Goal:** Admin can generate monthly charges safely without duplicates
**Completed:** 2026-02-18
- [x] charge_runs + charge_run_items tables with UNIQUE(community_id, fee_structure_id, period_start)
- [x] generate_monthly_charges() DB function wrapping record_charge() with batch tracking
- [x] Admin UI using atomic batch RPC (replaces N individual calls)
- [x] Charge run history table on charges page (date, period, fee, units, total, status)
- [x] Duplicate prevention: friendly error when same period+fee already charged

### Phase 06: Digital Receipts and Notifications
**Status:** COMPLETE
**Goal:** Automatic receipt generation after every payment
**Completed:** 2026-02-18
- [x] receipts table + generate_receipt_number() + RLS policies
- [x] Webhook auto-creates receipt after record_payment() succeeds (idempotent)
- [x] Mobile receipts screen (FlatList, payment method icons, pull-to-refresh)
- [x] "My Receipts" action card on payments dashboard
- [x] notify_charge_run() function for in-app + push notifications on charge generation
- [x] Admin charge generation triggers resident notifications

### Phase 07: Admin Financial Dashboard Improvements
**Status:** COMPLETE
**Goal:** Complete financial visibility for administrators
**Completed:** 2026-02-18
- [x] PaymentIntent tracking view with status filtering (succeeded, failed, pending, processing, canceled)
- [x] Failed webhook alerts dashboard (top of Stripe Payments page)
- [x] Collection reports by payment method with progress bars + month/year filter
- [x] Receipt Excel export (full year, all receipts with unit info)
- [x] PaymentIntent Excel export (filtered by status)
- [x] Navigation: Cobranza + Pagos Stripe added to Finanzas sidebar

### Phase 08: Additional Payment Methods
**Status:** COMPLETE
**Goal:** Apple Pay, Google Pay, SPEI bank transfers, and MSI installments
**Completed:** 2026-02-18
- [x] Apple Pay config in PaymentSheet (merchantCountryCode: MX)
- [x] Google Pay enabled in app.json + PaymentSheet config (testEnv for dev)
- [x] SPEI bank transfers via Stripe customer_balance + mx_bank_transfer
- [x] SPEI instructions screen (CLABE, bank name, reference with selectable text)
- [x] MSI installments (card.installments.enabled on PaymentIntent)
- [x] create-payment-intent edge function v6: SPEI + MSI support deployed
- [x] payment-webhook v6: SPEI description + receipt label handling deployed
- [x] SPEI and MSI action cards on payments dashboard
- [x] Dynamic checkout header titles per payment method

### Phase 09: Comprehensive QA Testing
**Status:** COMPLETE
**Goal:** Exhaustive quality assurance across entire payment system
**Completed:** 2026-02-18
- [x] Security audit: 3 parallel agents across edge functions, mobile, admin + DB
- [x] Edge function audit: auth ordering, HMAC timing-safe, input validation, Stripe error handling
- [x] Mobile UX audit: all 8 payment states, disabled states, navigation, gesture safety
- [x] Admin audit: query types, export correctness, navigation roles, filter controls
- [x] DB audit: RLS policies, receipt number thread-safety, UNIQUE constraints
- [x] **8 bugs fixed**: amount/100 display, OXXO email ordering, payment date, receipt race, gesture-back, ADMIN_ROLES, SPEI labels, idempotency msg
- [x] **Deployed**: create-payment-intent v7, payment-webhook v7, receipt race fix migration
- [x] **Remaining low-priority (documented)**: SPEI clipboard copy button, upload error feedback, query key registry, charge preview N+1

### Phase 10: Future Extensions (Deferred)
**Status:** Not started
**Goal:** Advanced payment features requiring external integrations
- CFDI integration (Facturapi) — electronic invoicing
- Stripe Connect for multi-community platform
- Domiciliacion bancaria (recurring direct debit)
