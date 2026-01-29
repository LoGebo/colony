# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Phase 4 (Financial Engine) - Plan 01 Complete

## Current Position

Phase: 4 of 8 (Financial Engine)
Plan: 1 of 4 complete
Status: In progress
Last activity: 2026-01-29 - Completed 04-01-PLAN.md (Chart of Accounts & Double-Entry Ledger)

Progress: [#########           ] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 4 min
- Total execution time: 40 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 12 min | 4 min |
| 02-identity-crm | 3 | 9 min | 3 min |
| 03-access-control | 4 | 15 min | 4 min |
| 04-financial-engine | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 03-02 (3 min), 03-03 (3 min), 03-04 (5 min), 04-01 (4 min)
- Trend: Consistent fast execution

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

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 5 (Amenities) needs exclusion constraint performance testing with RLS
- RESOLVED: Phase 4 double-entry patterns researched and implemented

## Session Continuity

Last session: 2026-01-29 19:03 UTC
Stopped at: Completed 04-01-PLAN.md (Chart of Accounts & Double-Entry Ledger)
Resume file: None

## Next Steps

**Recommended:** Continue Phase 4 with 04-02-PLAN.md (Fee Structures & Charges)

Phase 4 Plan 01 deliverables ready:
- account_category and account_subtype enums
- accounts table with hierarchical chart of accounts
- create_standard_chart_of_accounts() function
- transaction_type and transaction_status enums
- transactions table with immutability on posted
- ledger_entries table (append-only, trigger-enforced)
- update_account_balance() trigger for running balances
- account_ledger view for reporting
