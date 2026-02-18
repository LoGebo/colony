# Plan 02-04: Deploy + Configure Stripe Secrets

## Status: PARTIAL (Checkpoint Pending)

## Task 1: Deploy migrations and Edge Functions - COMPLETE

### What was deployed:

**Database tables (applied via MCP in plan 02-01):**
- `stripe_customers` - 3 RLS policies, 2 UNIQUE constraints
- `webhook_events` - 2 RLS policies, 1 UNIQUE constraint, 1 CHECK constraint
- `payment_intents` - 3 RLS policies, 2 UNIQUE constraints, 2 CHECK constraints

**Edge Functions (deployed via MCP):**
- `create-payment-intent` v1 - ACTIVE, verify_jwt=true
- `payment-webhook` v2 - ACTIVE, verify_jwt=false (public webhook)

**Verification:**
- All 3 tables confirmed in public schema
- All 8 RLS policies confirmed
- All 8 constraints confirmed (UNIQUE + CHECK)
- 4 Edge Functions active (verify-qr, send-push, payment-webhook, create-payment-intent)

## Task 2: Configure Stripe Secrets - CHECKPOINT PENDING

**User action required:**

1. **Set Supabase secrets:**
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY --project-ref qbaiviuluiqdbaymgxhq
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET --project-ref qbaiviuluiqdbaymgxhq
   ```
   Or via Supabase Dashboard > Edge Functions > Secrets

2. **Register webhook endpoint in Stripe Dashboard:**
   - URL: `https://qbaiviuluiqdbaymgxhq.supabase.co/functions/v1/payment-webhook`
   - Events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, payment_intent.requires_action, charge.refunded

3. **Get secrets from:**
   - STRIPE_SECRET_KEY: Stripe Dashboard > Developers > API keys > Secret key (sk_test_...)
   - STRIPE_WEBHOOK_SECRET: Stripe Dashboard > Developers > Webhooks > Endpoint > Signing secret (whsec_...)

## Commits
- Deployment done via MCP (no local commit needed - infrastructure-only changes)

## Issues
- None (deployment successful, checkpoint pending user action)
