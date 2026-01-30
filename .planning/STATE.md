# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Phase 7 (Operations & Compliance) - In Progress

## Current Position

Phase: 7 of 8 (Operations & Compliance)
Plan: 3 of 4 complete (07-03 Move Coordination complete)
Status: In progress
Last activity: 2026-01-30 - Completed 07-03-PLAN.md (Move Coordination)

Progress: [#########################.] 96.4%

## Performance Metrics

**Velocity:**
- Total plans completed: 27
- Average duration: 5.6 min
- Total execution time: 151 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 12 min | 4 min |
| 02-identity-crm | 3 | 9 min | 3 min |
| 03-access-control | 4 | 15 min | 4 min |
| 04-financial-engine | 4 | 27 min | 7 min |
| 05-amenities | 5 | 32 min | 6.4 min |
| 06-maintenance | 5 | 55 min | 11 min |
| 07-operations | 3 | 20 min | 6.7 min |

**Recent Trend:**
- Last 5 plans: 06-05 (6 min), 07-01 (4 min), 07-02 (8 min), 07-03 (8 min)
- Trend: Phase 7 progressing with operations infrastructure

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
- JSONB schedule format: {day: {open, close}} for amenity operating hours
- Rule evaluation uses priority DESC ordering so blackouts override quotas
- Partial unique index for one default rule per amenity per type
- Exception handling in validate_booking_rules() for graceful handling when reservations table doesn't exist
- btree_gist extension enables exclusion constraints combining UUID + tstzrange
- Exclusion constraint WHERE clause limits to status=confirmed AND deleted_at IS NULL
- '[)' bounds critical for adjacent slots (14:00-15:00, 15:00-16:00) to NOT conflict
- Waitlist uses requested_date column with trigger (lower() on tstzrange not IMMUTABLE)
- FOR UPDATE SKIP LOCKED prevents race conditions in waitlist promotion
- pg_notify('waitlist_promotion') enables real-time mobile/web notifications
- Reservation fees link to transactions table for double-entry compliance
- Adjacency list over ltree for comments - simpler for dynamic trees with frequent edits
- Denormalized reaction_counts JSONB + trigger for O(1) reads vs O(n) COUNT(*)
- depth <= 20 CHECK constraint prevents excessive comment nesting
- root_comment_id enables efficient thread fetching without recursive parent walks
- UNIQUE (post_id, resident_id) for reactions enforces one reaction per user per post
- Listings expire after 30 days by default (expires_at configurable)
- New sellers get higher moderation priority (5 for first-timer, 3 for 1-2 listings, 0 for established)
- FOR UPDATE SKIP LOCKED pattern enables horizontal scaling of moderators
- Polymorphic moderation_queue with item_type + item_id references any content type
- Dual confirmation required for exchange completion (seller_confirmed AND buyer_confirmed)
- Stale moderation claims released after 30 minutes (configurable via release_stale_claims)
- Fan-out pattern for announcement_recipients - enables per-resident delivery/read tracking
- JSONB target_criteria for segment targeting - flexible filtering without schema changes
- Coefficient snapshot at vote time - vote_weight captures unit coefficient for historical accuracy
- One vote per unit via UNIQUE(survey_id, unit_id) - fair HOA representation
- pg_notify for real-time notifications - Supabase Realtime subscription for instant push
- Service notifications are permanent records (no deleted_at) - audit trail requirement
- ENUM-based state machine with trigger validation for ticket status transitions
- SLA matrix lookup table with category+priority combination and NULL category fallback
- System comments auto-generated for status/assignment/priority changes (audit trail)
- Copy-on-write document versioning with current_version_id pointer for O(1) latest access
- Signature immutability enforced via prevent_signature_modification() trigger
- Permission targeting: exactly one of user_id, unit_id, role per document_permissions row
- SHA-256 signature hash from checksum+resident+timestamp+ip for tamper detection
- Denormalized counts via triggers for chat (participant_count, message_count, unread_count)
- pg_notify for real-time message delivery to Supabase Realtime subscribers
- Spanish full-text search with GIN index for message content
- Guard booth conversations per access_point + date for shift continuity
- 5-state asset lifecycle: operational, degraded, maintenance, out_of_service, retired
- MVP RRULE parser for DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL and BYMONTHDAY
- 24-hour escalation cooldown prevents notification spam while allowing re-escalation
- Generated total_cost column on maintenance history (labor_cost + parts_cost)
- 18 notification types covering all domains: maintenance, chat, documents, general
- DND bypassed only by emergency_alert for safety-critical notifications
- Template lookup: community-specific first, then system default (NULLS LAST)
- pg_notify('notification_created') for Edge Function async delivery
- 30-day staleness threshold for push token cleanup
- Token UPSERT on (user_id, device_id, platform) for seamless token refresh
- 8-state package lifecycle with trigger-validated transitions (received->stored->notified->pending_pickup->picked_up)
- Mexican carrier enum includes local carriers (Estafeta, Redpack) and e-commerce (Mercado Libre, Amazon)
- Pickup codes reuse Phase 3 HMAC-SHA256 pattern for offline verification
- Storage location current_count maintained by trigger for real-time capacity tracking
- Package signatures are immutable (trigger-enforced) for chain of custody compliance
- Provider status workflow: pending_approval -> active -> suspended/inactive
- Document status workflow: pending_verification -> verified/rejected, verified -> expired
- GENERATED columns for is_expired and days_until_expiry - always current, no stale data
- Expiry alert tracking with 30d/14d/7d boolean flags prevents duplicate notifications
- provider_documents_expiring view groups by urgency_level: expired, critical, warning, upcoming
- Personnel full_name is GENERATED from Mexican name format
- Access schedules use day-of-week array (0=Sunday, 6=Saturday) with time windows
- is_provider_access_allowed() enables real-time access checks at guard checkpoints
- 7 validations for move_out (debt_free, keys_returned, vehicles_updated, pets_updated, parking_cleared, inspection_scheduled, deposit_review)
- 2 validations for move_in (documentation_signed, deposit_review)
- GENERATED ALWAYS refund_amount for computed deposit refund after deductions
- check_debt_free() queries unit_balances view from Phase 4
- Validation waiver requires waiver_reason (CHECK constraint enforced)
- Deposit workflow functions: process/approve/complete sequence with status validation

### Pending Todos

None yet.

### Blockers/Concerns

- RESOLVED: Phase 5 (Amenities) exclusion constraint implemented with btree_gist
- RESOLVED: Phase 4 double-entry patterns researched and implemented
- RESOLVED: Phase 5 comment hierarchy and reaction counter patterns implemented
- RESOLVED: Phase 5 announcement fan-out and survey voting patterns implemented
- RESOLVED: Phase 6 document versioning and signature immutability patterns implemented
- RESOLVED: Phase 6 notification infrastructure with multi-channel delivery
- RESOLVED: Phase 7 HMAC pattern reused from Phase 3 for pickup codes
- RESOLVED: Bug fix - packages_table referenced non-existent update_updated_at() function

## Session Continuity

Last session: 2026-01-30 01:17 UTC
Stopped at: Completed 07-03-PLAN.md (Move Coordination)
Resume file: None

## Next Steps

**Recommended:** Continue Phase 7 with 07-04 (Audit & Compliance)

Phase 7 Progress:
- 07-01: Package Management Schema DONE
- 07-02: Provider Management DONE
- 07-03: Move Coordination DONE
- 07-04: Audit Logs & Compliance Reports TODO

Move coordination infrastructure available:
- move_type, move_status, validation_status, deposit_status enums
- move_requests table with scheduling, moving company, facility reservations
- move_validations table with auto-generated checklists (7 for move_out, 2 for move_in)
- create_move_validations() trigger for auto-generation
- update_validation_summary() trigger for all_validations_passed flag
- check_debt_free() function queries unit_balances view
- move_deposits table with GENERATED refund_amount column
- Workflow functions: process_deposit_refund, approve_deposit_refund, complete_deposit_refund, forfeit_deposit
