---
phase: "03-mobile-payment-screen"
plan: "01"
subsystem: "payments-infrastructure"
tags: ["stripe", "realtime", "expo", "react-native", "payment-intent"]
dependency-graph:
  requires: ["02-stripe-infrastructure"]
  provides: ["stripe-sdk-installed", "stripe-provider-in-layout", "realtime-payment-intents", "stripe-id-index"]
  affects: ["03-02", "03-03"]
tech-stack:
  added: ["@stripe/stripe-react-native@0.50.3"]
  patterns: ["StripeProvider context wrapper", "Supabase Realtime publication"]
key-files:
  created:
    - "supabase/migrations/20260218180000_add_payment_intents_to_realtime.sql"
  modified:
    - "packages/mobile/app.json"
    - "packages/mobile/app/_layout.tsx"
    - "packages/mobile/.env"
    - "packages/mobile/.env.example"
    - "packages/mobile/package.json"
    - "pnpm-lock.yaml"
decisions:
  - id: "stripe-sdk-version"
    decision: "Installed @stripe/stripe-react-native@0.50.3 (Expo SDK 54 compatible)"
    rationale: "npx expo install resolved the compatible version automatically"
  - id: "stripe-provider-placement"
    decision: "StripeProvider placed outside SessionProvider, inside QueryProvider"
    rationale: "Stripe context must be available to all screens; doesn't need auth state; QueryProvider wraps everything for React Query"
  - id: "realtime-publication"
    decision: "payment_intents added to supabase_realtime publication via Management API"
    rationale: "Local migration drift prevented db push; direct API execution ensured remote DB is correct"
metrics:
  duration: "~15 minutes"
  completed: "2026-02-18"
---

# Phase 03 Plan 01: Stripe Payment Infrastructure Setup Summary

**One-liner:** Stripe React Native SDK 0.50.3 installed with StripeProvider in root layout, payment_intents added to Realtime publication with stripe_payment_intent_id index.

## What Was Done

### Task 1: Database Migration for Realtime + Index
- Added `payment_intents` table to `supabase_realtime` publication for mobile subscription to status changes
- Created `idx_payment_intents_stripe_id` index on `payment_intents(stripe_payment_intent_id)` for efficient Realtime filtering
- Migration applied via Supabase Management API (direct SQL execution) due to local/remote migration drift
- Local migration file created at `supabase/migrations/20260218180000_add_payment_intents_to_realtime.sql` for record-keeping
- Verified: Both SQL verification queries returned exactly 1 row each

### Task 2: Stripe SDK Installation + Configuration
- Installed `@stripe/stripe-react-native@0.50.3` via `npx expo install` (Expo SDK 54 compatible)
- Updated `app.json` plugins array with Stripe config plugin including `merchantIdentifier: "merchant.com.upoe"` and `enableGooglePay: false`
- Added `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env` (placeholder value) and `.env.example`
- Added `StripeProvider` wrapper to `app/_layout.tsx`:
  - Imported from `@stripe/stripe-react-native`
  - Placed OUTSIDE `SessionProvider` but INSIDE `QueryProvider`
  - Uses `process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` for the publishable key
  - Includes `merchantIdentifier="merchant.com.upoe"`

## Verification Results

| Check | Result |
|-------|--------|
| payment_intents in supabase_realtime publication | 1 row returned |
| idx_payment_intents_stripe_id index exists | 1 row returned |
| @stripe/stripe-react-native in package.json | 0.50.3 (>= 0.38 minimum) |
| Stripe plugin in app.json | Present with merchantIdentifier |
| EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env | Present |
| EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.example | Present |
| StripeProvider import in _layout.tsx | Present |
| StripeProvider wrapper in _layout.tsx | Outside SessionProvider, inside QueryProvider |

## Deviations from Plan

None - plan executed exactly as written.

**Note:** The migration was applied via Supabase Management API instead of MCP tools (which were not available in the tool set). The SQL was identical to what the plan specified. A local migration file was also created for documentation.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| @stripe/stripe-react-native@0.50.3 | Expo SDK 54 compatible version resolved by `npx expo install` |
| StripeProvider outside SessionProvider, inside QueryProvider | Stripe context doesn't depend on auth; must be available to all payment screens |
| Migration via Management API | Local/remote migration drift prevented `supabase db push`; direct API ensured correctness |
| merchantIdentifier = "merchant.com.upoe" | Apple Pay merchant ID for future Apple Pay support |

## Next Phase Readiness

All infrastructure for Phase 03 Plans 02 and 03 is now in place:
- `useStripe()` hook available in any descendant component via StripeProvider
- Realtime subscriptions can filter on `payment_intents.stripe_payment_intent_id`
- `.env` has placeholder for Stripe publishable key (user must replace with real key for testing)

### Blockers
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set to `pk_test_placeholder` - user must replace with real Stripe test publishable key before testing payment flows
