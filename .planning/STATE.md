# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Phase 8 (Governance & Analytics) - In Progress

## Current Position

Phase: 8 of 8 (Governance & Analytics)
Plan: 4 of 9 complete (08-04 Parking Management complete)
Status: In Progress
Last activity: 2026-01-30 - Completed 08-04-PLAN.md (Parking Management)

Progress: [#################################----] 93%

## Performance Metrics

**Velocity:**
- Total plans completed: 38
- Average duration: 5.9 min
- Total execution time: 240 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 12 min | 4 min |
| 02-identity-crm | 3 | 9 min | 3 min |
| 03-access-control | 4 | 15 min | 4 min |
| 04-financial-engine | 4 | 27 min | 7 min |
| 05-amenities | 5 | 32 min | 6.4 min |
| 06-maintenance | 5 | 55 min | 11 min |
| 07-operations | 5 | 35 min | 7 min |
| 08-governance (partial) | 9 | 79 min | 8.8 min |

**Recent Trend:**
- Last 5 plans: 08-05 (5 min), 08-09 (5 min), 08-02 (13 min), 08-07 (17 min), 08-04 (8 min)
- Trend: Phase 8 parking management with exclusion constraints for reservations

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
- Dedicated audit schema separates audit infrastructure from public tables
- audit.audit_log is append-only with trigger-enforced immutability
- enable_tracking(regclass) dynamically adds audit triggers to any table
- Audit captures old_record, new_record, changed_fields[] for full change history
- Session tracking includes device fingerprint, IP, location, and security flags
- should_block_login() implements rate limiting: 5 attempts per email, 10 per IP, 15-minute window
- Security events are permanent audit trail (no UPDATE/DELETE policies)
- JSONB feature_flags on community_settings with GIN index for per-tenant feature control
- is_feature_enabled() and get_feature_config() for feature flag queries
- 6 system roles seeded (super_admin, community_admin, manager, guard, resident, provider)
- 24 permissions across operations, security, configuration, financial categories
- has_permission() function for database-level permission checking
- Hybrid RBAC: JWT claims for common checks, database for fine-grained control
- Fixed generate_uuid_v7() to use extensions.gen_random_bytes() for pgcrypto schema
- Polymorphic device assignments with CHECK constraint for exactly one assignee type
- Partial unique index ensures one active device assignment per device
- Device events are append-only audit trail (insert via log_device_event() only)
- Trigger-based device status updates maintain consistency with assignments
- Webhook exponential backoff: 1m, 5m, 15m, 1h, 4h, 24h via calculate_next_retry()
- Auto-disable webhook endpoint after 10 consecutive failures (circuit breaker)
- Dead letter after 6 failed attempts with retry_dead_letter() for manual retry
- API key hash-only storage: prefix (16 chars) + SHA-256, never plaintext
- Full API key returned ONLY ONCE at creation via generate_api_key()
- Integration configs use vault_secret_id for credentials in Supabase Vault
- 12-month rolling window for violation offense counting (standard HOA practice)
- Only confirmed/sanctioned/closed violations count toward offense number
- Appeal-granted violations voided (don't count toward future offenses)
- Violation sanctions permanent audit trail (no soft delete)
- issue_sanction() creates financial charge via record_charge() for fines
- Emergency contact priority: lower = call first (1 = primary contact)
- contact_for array categorizes contacts by purpose (medical, security, general, financial)
- share_with_security flag controls guard access to medical conditions
- Evacuation list ordered by floor DESC for fire protocol (higher floors first)
- Guards can view ALL accessibility needs but ONLY security-shared medical conditions
- Parking spot denormalized assigned_unit_id with trigger maintenance
- Partial unique index ensures one active assignment per parking spot
- Time slots stored as DATE + TIME for timezone-aware exclusion constraint
- Parking exclusion constraint with '[)' bounds for adjacent slot compatibility
- Auto vehicle linking in violations via plate_normalized matching
- violation_record_id prepared for Phase 8-07 formal violations integration

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
- RESOLVED: Phase 7 audit infrastructure with immutable audit.audit_log table
- RESOLVED: generate_uuid_v7() fixed to use extensions.gen_random_bytes() (pgcrypto schema issue)

## Session Continuity

Last session: 2026-01-30 04:56 UTC
Stopped at: Completed 08-04-PLAN.md (Parking Management)
Resume file: None

## Next Steps

**Recommended:** Complete Phase 8 final plan (08-08)

Phase 8 Progress:
- 08-01: Violation & Penalty Schema DONE
- 08-02: Election & Voting Schema DONE (Mexican law proxy limits, coefficient weighting)
- 08-03: Parking Management DONE
- 08-04: Incident Reports DONE
- 08-05: Access Device Lifecycle DONE
- 08-06: Emergency Preparedness DONE (contacts, medical, accessibility, evacuation)
- 08-07: Violation Tracking DONE (offense counting, sanctions, appeals)
- 08-08: API Rate Limiting (TODO)
- 08-09: External Integrations DONE

Elections & Voting infrastructure available:
- election_type enum (board_election, bylaw_amendment, extraordinary_expense, general_decision)
- election_status enum (draft, scheduled, open, closed, certified, cancelled)
- elections table with quorum tracking and certification
- election_options table for candidates/choices
- ballots table with vote_weight (coefficient snapshot at vote time)
- cast_vote() function with comprehensive validation
- validate_proxy_limit() trigger (2-unit max per Mexican law)
- check_election_quorum() calculates participation vs total coefficient
- get_election_results() and get_election_summary() helpers

External integrations infrastructure available:
- webhook_status enum (pending, sending, delivered, failed, retrying, dead_letter)
- webhook_endpoints table for external integration subscriptions
- webhook_deliveries queue with retry tracking
- calculate_next_retry() for exponential backoff (1m, 5m, 15m, 1h, 4h, 24h)
- queue_webhook() creates deliveries with HMAC-SHA256 signatures
- get_pending_webhooks() for Edge Function batch processing
- record_webhook_result() handles success/failure/retry/dead-letter
- retry_dead_letter() for manual retry after fixes
- api_keys table with hash-only storage (prefix + SHA-256)
- generate_api_key() returns full key ONLY ONCE
- validate_api_key() with scope checking
- integration_configs with vault_secret_id for credentials
- integration_sync_logs for sync history
- api_key_summary and integration_status views for monitoring

Violation tracking infrastructure available:
- violation_severity enum (minor, moderate, major, severe)
- sanction_type enum (verbal_warning to legal_action)
- violation_types table with configurable penalty schedules
- violations table with automatic offense number calculation
- violation_sanctions table for warnings, fines, suspensions
- violation_appeals table with hearing workflow
- calculate_offense_number() trigger (12-month window)
- update_violation_on_appeal() trigger for status sync
- issue_sanction() function with record_charge() integration
- get_violation_history() for escalation decisions

Emergency preparedness infrastructure available:
- emergency_contact_relationship enum (spouse, parent, child, sibling, friend, doctor, employer, neighbor, other)
- emergency_contacts table with priority ordering (lower = call first)
- contact_for array for categorizing contacts (medical, security, general, financial)
- get_emergency_contacts(resident_id) returns contacts in priority order
- get_emergency_contacts_for_unit(unit_id) for guard booth access
- medical_condition_type enum (allergy, chronic_condition, disability, medication, other)
- medical_severity enum (mild, moderate, severe, life_threatening)
- medical_conditions table with privacy controls (share_with_security, share_with_neighbors)
- accessibility_need_type enum (wheelchair, visual, hearing, cognitive, mobility, respiratory, other)
- mobility_device_type enum (wheelchair, walker, scooter, cane, other)
- accessibility_needs table with evacuation requirements
- security_medical_summary view for guard booth quick access
- get_evacuation_priority_list(community_id) ordered by floor (highest first)

Parking management infrastructure available:
- parking_spot_type enum (assigned, visitor, commercial, disabled, loading, reserved)
- parking_spot_status enum (available, occupied, reserved, maintenance, blocked)
- parking_violation_type enum (6 violation categories)
- parking_violation_status enum (5-state resolution workflow)
- parking_assignment_type enum (ownership, rental, temporary)
- parking_reservation_status enum (5-state reservation workflow)
- parking_spots table with inventory and denormalized assigned_unit_id
- parking_assignments table with partial unique for one active per spot
- parking_reservations table with exclusion constraint preventing overlap
- parking_violations table with evidence storage and auto vehicle linking
- sync_parking_spot_assignment() trigger for denormalized data maintenance
- is_parking_available() for time slot availability checks
- create_parking_reservation() with full validation
- cancel/checkin/checkout functions for reservation lifecycle
- get_todays_parking_reservations() for guard booth dashboard
- report_parking_violation() with auto plate matching
