# Phase 03: Mobile Payment Screen (Card) - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Resident-facing mobile checkout flow to pay outstanding unit balance with credit/debit card via Stripe PaymentSheet. Includes balance display, amount selection, Stripe PaymentSheet integration, success/failure states, and real-time balance updates. OXXO payments are Phase 04. Receipts are Phase 06.

</domain>

<decisions>
## Implementation Decisions

### Checkout Flow
- Entry point lives in **two places**: Balance summary card on Home screen (quick shortcut) + dedicated Payments screen with full history
- **Single-step checkout**: one screen shows balance, amount selection, and Pay button. Tapping Pay opens Stripe PaymentSheet directly
- **Multi-unit support**: Payment screen lists all units with balances. Resident taps which unit to pay. Single-unit residents see it pre-selected
- Amount selection: **predefined quick-selects + custom input**. Quick-selects are: full balance, 50% of balance, and last individual charge amount

### Payment Screen Layout
- **Total + breakdown**: Total balance displayed prominently, with collapsible breakdown showing individual charges (e.g., "Maintenance Jan $1,500")
- **Payment history**: Collapsible section at bottom, collapsed by default. Shows recent payments (date, amount, status) for reference
- Quick-select amount chips: Full balance, 50%, last charge. Plus custom amount input field
- Big "Pay" CTA button at bottom

### Success & Failure States
- **Success**: Full-screen animated success state with checkmark, amount paid, updated balance. "View Receipt" button (Phase 06 placeholder) + "Done" button
- **Failure**: Claude's discretion on error UX pattern (inline vs bottom sheet), matching existing app conventions
- **Cancel** (PaymentSheet dismissed): Silently return to payment screen, amount preserved, no confirmation dialog
- **Processing state**: Brief "Processing payment..." spinner (up to 10 seconds) while Realtime subscription waits for webhook confirmation
- **Timeout fallback**: After 10 seconds, show optimistic success based on Stripe's response with note "Your payment was received. Balance will update shortly"

### Real-time Updates
- **Supabase Realtime subscription** on payment_intents table. When status changes to 'succeeded', refresh balance everywhere
- **Home screen balance card** has its own Realtime subscription — updates automatically when any payment is processed
- **Push notification** sent for every payment confirmation, even when user is in-app. Provides persistent record in notification center

### Claude's Discretion
- Visual style of payment screen (match existing app design language)
- Error state UX pattern (inline vs bottom sheet)
- Loading skeleton design
- Exact spacing, typography, and animation details
- Stripe PaymentSheet theme customization

</decisions>

<specifics>
## Specific Ideas

- Home screen balance card should be a prominent, tappable element — not buried in a list
- Checkout should feel like Uber/Rappi: minimal steps, clear amount, one tap to pay
- Processing spinner should feel responsive — user should never wonder "did it work?"
- The "View Receipt" button on success screen is a placeholder for Phase 06 (can show a simple transaction summary for now)

</specifics>

<deferred>
## Deferred Ideas

- OXXO payment method — Phase 04
- Digital receipt generation (PDF) — Phase 06
- Payment history export — Phase 07
- Apple Pay / Google Pay — Phase 08
- Meses sin intereses (MSI) — Phase 08

</deferred>

---

*Phase: 03-mobile-payment-screen*
*Context gathered: 2026-02-18*
