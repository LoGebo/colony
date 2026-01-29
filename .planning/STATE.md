# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Phase 4 (Financial Engine) - COMPLETE

## Current Position

Phase: 4 of 8 (Financial Engine) - COMPLETE
Plan: 4 of 4 complete
Status: Phase complete
Last activity: 2026-01-29 - Completed 04-04-PLAN.md (Bank Reconciliation)

Progress: [#############       ] 54%

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 4.5 min
- Total execution time: 63 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 12 min | 4 min |
| 02-identity-crm | 3 | 9 min | 3 min |
| 03-access-control | 4 | 15 min | 4 min |
| 04-financial-engine | 4 | 27 min | 7 min |

**Recent Trend:**
- Last 5 plans: 04-01 (4 min), 04-02 (8 min), 04-03 (10 min), 04-04 (5 min)
- Trend: Financial engine phase complete, averaging 7 min per plan due to complexity

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Row-level multi-tenancy with community_id (CONFIRMED - get_current_community_id() RLS helper created)
- UUIDs for all PKs for offline-sync (CONFIRMED - generate_uuid_v7() function created)
- Soft deletes everywhere for audit/sync (CONFIRMED - soft_delete() and perform_soft_delete() created)
- NUMERIC(15,4) for financial amounts (CONFIRMED - money_amount domain created)
- Spanish unit types for Mexican market (casa, departamento, etc.)
- ON DELETE RESTRICT for communities.organization_id to prevent orphan communities
- Denormalized unit_count/resident_count on communities for dashboard performance
- RLS policies use (SELECT func()) pattern for JWT caching performance
- Coefficient NUMERIC(7,4) allows 4 decimal precision for Mexican indiviso percentages
- Units use ON DELETE RESTRICT from communities to prevent orphan data
- Residents 1:1 link to auth.users via id (PK is FK with ON DELETE CASCADE)
- Mexican name format: first_name, paternal_surname, maternal_surname with generated full_name
- Occupancies allow same resident multiple roles in same unit via unique(unit_id, resident_id, occupancy_type)
- Plate normalization via GENERATED ALWAYS column for LPR matching
- Pet vaccinations in separate table for time-series queries and expiry tracking
- 10MB file limit for resident documents (sufficient for ID scans and contracts)
- Partial unique index allows document re-upload after rejection
- Storage path convention: {community_id}/{resident_id}/{document_type}/{filename}
- Guards separate from residents to support third-party security companies
- Generated crosses_midnight column for automatic night shift detection
- Shift assignments use NULL effective_until for ongoing/indefinite assignments
- Polymorphic invitations with CHECK constraints enforce type-specific fields
- access_logs is append-only with trigger-enforced immutability (no deleted_at/updated_at)
- Hash chain column for tamper detection in access_logs (trigger-computed, not GENERATED)
- Blacklist supports deny_entry, alert_only, call_police protocols
- NFC serial stored as TEXT not UUID (factory-assigned, tamper-evident)
- Haversine formula for GPS distance calculation (accurate for short distances)
- Patrol logs are audit records without soft delete
- Progress auto-updated via trigger when checkpoints scanned
- HMAC-SHA256 for QR signatures enables offline verification on guard devices
- QR payload format: {id}|{community_id}|{expiry_epoch}|{signature} for compact encoding
- Emergency alerts are permanent audit trail (no soft delete)
- Auto-priority based on emergency_type: panic/fire/disaster=critical, medical=urgent, intrusion=high
- HOA standard account numbering: 1000s assets, 2000s liabilities, 3000s equity, 4000s income, 5000s expenses, 7000s reserve
- is_operating_fund/is_reserve_fund flags for Mexican HOA fund separation compliance
- Positive amounts = debits, negative amounts = credits (single amount column in ledger)
- balance_after column on ledger_entries for O(1) historical balance lookups
- ledger_entries is append-only with same immutability pattern as access_logs
- Transactions use pending->posted state machine (posted is immutable)
- Coefficient calculation: base_amount * (unit.coefficient / 100) for Mexican indiviso
- Fee schedules allow override_amount for special arrangements without changing fee structure
- Payment method requires_proof flag for SPEI/transfer verification workflow
- record_payment/record_charge auto-post transactions after creating balanced entries
- Transaction references use PREFIX-YYYY-NNNNN format (PAY/CHG sequences per community)
- Interest rules require assembly approval tracking (approved_at, approved_by, assembly_minute_reference)
- calculate_interest() supports 4 methods: simple, compound_monthly, compound_daily, flat_fee
- Delinquency actions are immutable audit trail (prevent_delinquency_action_modification trigger)
- Delinquency triggers have UNIQUE constraint on (community_id, days_overdue, action_type)
- Budget variance is GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED
- Budget totals auto-calculated by update_budget_totals() AFTER trigger on budget_lines
- Bank account numbers stored as last 4 digits + SHA-256 hash (secure PII pattern)
- Statement line status workflow: unmatched->matched/manually_matched/excluded/disputed
- Payment proof approval triggers record_payment() for double-entry compliance
- unit_balances view aggregates from ledger_entries on accounts_receivable subtype

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 5 (Amenities) needs exclusion constraint performance testing with RLS
- RESOLVED: Phase 4 double-entry patterns researched and implemented

## Session Continuity

Last session: 2026-01-29 19:22 UTC
Stopped at: Completed 04-04-PLAN.md (Bank Reconciliation) - PHASE 4 COMPLETE
Resume file: None

## Next Steps

**Recommended:** Begin Phase 5 (Amenities)

Phase 4 Financial Engine deliverables complete:
- Chart of accounts with standard HOA numbering
- Double-entry ledger with immutable entries
- Fee structures with Mexican indiviso coefficient calculation
- Payment/charge recording with auto-posting
- Interest calculation with 4 methods
- Delinquency triggers and action tracking
- Budgets with variance tracking
- Bank accounts with secure storage
- Bank statements and reconciliation workflow
- Payment proofs with approval trigger
- unit_balances view for real-time financial position
- Helper functions for balance queries and delinquency processing
