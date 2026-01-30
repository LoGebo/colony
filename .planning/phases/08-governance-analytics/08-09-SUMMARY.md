---
phase: 08-governance-analytics
plan: 09
subsystem: database
tags: [webhooks, api-keys, integrations, hmac, sha256, exponential-backoff, dead-letter-queue]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: generate_uuid_v7(), update_updated_at(), communities table
  - phase: 03-04
    provides: HMAC-SHA256 pattern with pgcrypto
  - phase: 07-05
    provides: has_permission() RBAC function
provides:
  - webhook_status enum with 6 states (pending, sending, delivered, failed, retrying, dead_letter)
  - webhook_endpoints table for external integration subscriptions
  - webhook_deliveries queue with retry tracking
  - Exponential backoff via calculate_next_retry() (1m, 5m, 15m, 1h, 4h, 24h)
  - queue_webhook() creates deliveries with HMAC-SHA256 signatures
  - get_pending_webhooks() for Edge Function batch processing
  - API key management with hash-only storage (never plaintext)
  - generate_api_key() returns full key ONLY ONCE
  - validate_api_key() with scope checking
  - integration_configs for external service connections
  - integration_sync_logs for sync history
affects: [edge-functions, external-integrations, erp-integration, payment-gateways]

# Tech tracking
tech-stack:
  added: []
  patterns: [webhook-queue-pattern, exponential-backoff, hash-only-api-keys, dead-letter-queue, for-update-skip-locked]

key-files:
  created:
    - supabase/migrations/20260130043900_webhook_tables.sql
    - supabase/migrations/20260130044000_webhook_functions.sql
    - supabase/migrations/20260130044100_api_keys_integrations.sql
  modified: []

key-decisions:
  - id: WEBHOOK-EXPONENTIAL-BACKOFF
    choice: "1m, 5m, 15m, 1h, 4h, 24h retry schedule via calculate_next_retry()"
    rationale: Industry standard exponential backoff prevents overwhelming failing endpoints
  - id: AUTO-DISABLE-AFTER-10
    choice: "Auto-disable endpoint after 10 consecutive failures"
    rationale: Circuit breaker pattern prevents wasted resources on permanently failing endpoints
  - id: DEAD-LETTER-AFTER-6
    choice: "Move to dead_letter status after 6 failed attempts"
    rationale: Configurable max_attempts with manual retry_dead_letter() after fixes
  - id: API-KEY-HASH-ONLY
    choice: "Store only prefix (16 chars) + SHA-256 hash, never full key"
    rationale: Security best practice - keys shown once at creation, never retrievable
  - id: VAULT-SECRET-REFERENCE
    choice: "integration_configs stores vault_secret_id, not credentials"
    rationale: Sensitive credentials stored in Supabase Vault, not in main tables

patterns-established:
  - "Webhook queue pattern: queue_webhook() -> get_pending_webhooks() -> process_webhook_delivery() -> record_webhook_result()"
  - "FOR UPDATE SKIP LOCKED for concurrent webhook processing"
  - "API key validation by hashing input and comparing to stored hash"
  - "Single-return sensitive data (api_key only shown once at creation)"

# Metrics
duration: 5 min
completed: 2026-01-30
---

# Phase 8 Plan 9: External Integrations Summary

**Webhook delivery queue with exponential backoff (1m->5m->15m->1h->4h->24h), API key management with SHA-256 hash-only storage, and integration configuration with Vault references**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-30T04:38:44Z
- **Completed:** 2026-01-30T04:43:16Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Webhook delivery system with exponential backoff retry queue
- Dead letter queue for exhausted retries with manual retry capability
- API key management that stores prefix + SHA-256 hash only (never plaintext)
- Integration configuration with Supabase Vault credential references
- Comprehensive monitoring views for webhook delivery and integration health

## Task Commits

Each task was committed atomically:

1. **Task 1: Create webhook endpoint and delivery tables** - `ca168a9` (feat)
2. **Task 2: Create webhook queue and delivery functions** - `4a60b28` (feat)
3. **Task 3: Create API keys and integration configuration tables** - `902cc46` (feat)

## Files Created

- `supabase/migrations/20260130043900_webhook_tables.sql` (201 lines)
  - webhook_status enum
  - webhook_endpoints table with health tracking
  - webhook_deliveries queue table
  - Indexes for pending deliveries and lookups
  - RLS policies for admin and service role access

- `supabase/migrations/20260130044000_webhook_functions.sql` (349 lines)
  - calculate_next_retry() with exponential backoff schedule
  - queue_webhook() creates deliveries with HMAC-SHA256 signatures
  - process_webhook_delivery() with FOR UPDATE SKIP LOCKED
  - record_webhook_result() handles success/failure/retry/dead-letter
  - get_pending_webhooks() for Edge Function batch processing
  - retry_dead_letter() for manual retry after fixes
  - webhook_delivery_stats view for monitoring

- `supabase/migrations/20260130044100_api_keys_integrations.sql` (657 lines)
  - api_keys table with prefix + SHA-256 hash storage
  - api_key_usage table for rate limiting and auditing
  - integration_configs with vault_secret_id
  - integration_sync_logs for sync history
  - generate_api_key() returns full key ONLY ONCE
  - validate_api_key() with scope checking
  - revoke_api_key() for immediate invalidation
  - check_api_key_rate_limit() and log_api_key_usage()
  - api_key_summary view (excludes key_hash)
  - integration_status view with health indicators

## Decisions Made

1. **Exponential Backoff Schedule**
   - 1m, 5m, 15m, 1h, 4h, 24h progression
   - Industry standard prevents overwhelming failing endpoints
   - calculate_next_retry() is IMMUTABLE for performance

2. **Auto-disable After 10 Consecutive Failures**
   - Circuit breaker pattern
   - Prevents wasted resources on permanently failing endpoints
   - Can be re-enabled via retry_dead_letter()

3. **Dead Letter After 6 Attempts**
   - Configurable via max_attempts column
   - Manual retry_dead_letter() function resets with 3 new attempts
   - Also re-enables auto-disabled endpoints

4. **API Key Hash-Only Storage**
   - Only prefix (16 chars) + SHA-256 hash stored
   - Full key returned ONLY ONCE at creation
   - validate_api_key() hashes input and compares

5. **Vault Secret References**
   - integration_configs stores vault_secret_id
   - Sensitive credentials in Supabase Vault, not main tables
   - Non-sensitive config in JSONB column

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Edge Functions for actual webhook delivery and integration syncs can be built separately.

## Integration Points

### Webhook System
- **queue_webhook()** should be called when events occur (payment received, access granted, incident created)
- **get_pending_webhooks()** polled by Edge Function for batch processing
- **record_webhook_result()** called by Edge Function after HTTP delivery
- pg_notify can be added for real-time webhook processing

### API Keys
- **generate_api_key()** called when creating new integration
- **validate_api_key()** called by API middleware on each request
- **check_api_key_rate_limit()** + **log_api_key_usage()** for rate limiting

### Integrations
- **integration_configs** stores connection details for external systems
- **integration_sync_logs** tracks sync history
- **integration_status** view for health monitoring

## Next Phase Readiness

Plan 08-09 complete. External integrations infrastructure ready:
- Webhook delivery queue with reliable retry
- API key management for third-party access
- Integration configuration for external services

**Ready for:**
- Edge Functions to implement actual HTTP delivery
- Integration sync workers for bank feeds, LPR systems, etc.
- API middleware using validate_api_key()

---
*Phase: 08-governance-analytics*
*Completed: 2026-01-30*
