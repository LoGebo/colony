# UPOE Colony App - Payment System

## Overview
Payment system for residential community/HOA management app. Enables residents to pay maintenance fees and charges via credit/debit cards, OXXO cash payments, and bank transfers (SPEI). Built on Stripe Mexico with existing double-entry accounting infrastructure.

## Stack
- **Backend**: Supabase (PostgreSQL, Edge Functions, Storage, Realtime)
- **Mobile**: React Native (Expo) with @stripe/stripe-react-native
- **Admin**: Next.js dashboard
- **Payments**: Stripe Mexico (cards, OXXO, SPEI)
- **Monorepo**: packages/shared, packages/mobile, packages/admin

## Key Decisions
- **Stripe** selected over Conekta, OpenPay, NetPay (best SDK, Expo support, existing webhook)
- **PaymentSheet** for PCI compliance (zero card data on our servers)
- **Webhook-driven** state management with idempotency
- **Double-entry accounting** already in place (immutable ledger)

## Current State
- 128+ migrations, 116+ tables, 399 RLS policies
- Financial infrastructure exists: accounts, transactions, ledger_entries, fee_structures, payment_proofs
- Phase 1 complete: record_payment() function deployed and tested
- Standard chart of accounts seeded for demo community
