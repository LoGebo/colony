---
phase: "03-mobile-payment-screen"
plan: "03"
subsystem: "mobile-payments"
tags: ["navigation", "checkout", "payment-dashboard", "react-native"]

dependency_graph:
  requires: ["03-02"]
  provides: ["checkout navigation from payment dashboard"]
  affects: []

tech_stack:
  added: []
  patterns: ["dual-navigation-paths", "action-card-pattern"]

key_files:
  created: []
  modified:
    - packages/mobile/app/(resident)/payments/index.tsx

decisions:
  - id: "pay-now-to-checkout"
    decision: "Pay Now button in balance card navigates to checkout instead of upload-proof"
    rationale: "Primary CTA should lead to card payment (Stripe), upload-proof is secondary action"
  - id: "dual-card-actions"
    decision: "Two action cards in PAYMENT ACTIONS: Pay with Card (first) and Upload Transfer Receipt (second)"
    rationale: "Card payment is the primary flow; bank transfer receipt upload is the fallback for residents without cards"

metrics:
  completed: "2026-02-18"
---

# Phase 03 Plan 03: Wire Checkout Navigation Summary

**One-liner:** Connect Pay Now button and new Pay with Card action card to the Stripe checkout screen, preserving upload-proof paths for bank transfer receipts.

## What Was Done

### Task 1: Wire checkout navigation into payment dashboard
- Updated the "Pay Now" `TouchableOpacity` in the balance card to navigate to `/(resident)/payments/checkout` instead of `/(resident)/payments/upload-proof`
- Added a new "Pay with Card" action card in the PAYMENT ACTIONS section with `card-outline` Ionicons icon, navigating to `/(resident)/payments/checkout`
- Added a `spacing.lg` height spacer between the two action cards for visual separation
- Preserved the existing "Upload Transfer Receipt" action card navigating to `/(resident)/payments/upload-proof`
- Preserved the upload icon button (cloud-upload-outline) in the balance card still navigating to `/(resident)/payments/upload-proof`

**Navigation paths after this change:**
| Element | Target | Purpose |
|---------|--------|---------|
| Pay Now button (balance card) | /checkout | Primary card payment |
| Pay with Card action card | /checkout | Explicit card payment option |
| Upload icon button (balance card) | /upload-proof | Quick upload shortcut |
| Upload Transfer Receipt action card | /upload-proof | Bank transfer proof upload |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| "checkout" appears >= 2 times in file | PASS (2 occurrences: lines 85, 104) |
| "Pay with Card" text exists | PASS (line 111) |
| "card-outline" icon exists | PASS (line 108) |
| "Upload Transfer Receipt" still exists | PASS (line 129) |
| Upload Transfer Receipt still navigates to upload-proof | PASS (line 122) |
| Upload icon button still navigates to upload-proof | PASS (line 91) |

## Commits

| Hash | Message |
|------|---------|
| a627c1b | feat(03-03): wire Pay with Card and Pay Now to checkout screen |

## Next Phase Readiness

Phase 03 (mobile payment screen) is now complete. The full payment flow is wired end-to-end:
1. Edge function `create-payment-intent` (03-01)
2. Checkout screen with PaymentSheet + Realtime confirmation (03-02)
3. Navigation from payment dashboard to checkout (03-03)

Residents can now tap "Pay Now" or "Pay with Card" to reach the Stripe checkout, or use the upload flow for bank transfer receipts.
