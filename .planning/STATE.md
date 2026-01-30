# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Phase 6 (Maintenance, Chat, Documents & Notifications) - COMPLETE

## Current Position

Phase: 6 of 8 (Maintenance, Chat, Documents & Notifications) - COMPLETE
Plan: 5 of 5 complete (06-05 Push Notifications complete)
Status: Phase complete
Last activity: 2026-01-30 - Completed 06-05-PLAN.md (Push Notifications)

Progress: [####################] 87.5%

## Performance Metrics

**Velocity:**
- Total plans completed: 24
- Average duration: 5.5 min
- Total execution time: 131 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 12 min | 4 min |
| 02-identity-crm | 3 | 9 min | 3 min |
| 03-access-control | 4 | 15 min | 4 min |
| 04-financial-engine | 4 | 27 min | 7 min |
| 05-amenities | 5 | 32 min | 6.4 min |
| 06-maintenance | 5 | 55 min | 11 min |

**Recent Trend:**
- Last 5 plans: 06-01 (9 min), 06-02 (est), 06-03 (19 min), 06-04 (14 min), 06-05 (6 min)
- Trend: Phase 6 complete with comprehensive maintenance, chat, document, and notification systems

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
- 18 notification types covering all domains: maintenance, chat, documents, general
- DND bypassed only by emergency_alert for safety-critical notifications
- Template lookup: community-specific first, then system default (NULLS LAST)
- pg_notify('notification_created') for Edge Function async delivery
- 30-day staleness threshold for push token cleanup
- Token UPSERT on (user_id, device_id, platform) for seamless token refresh

### Pending Todos

None yet.

### Blockers/Concerns

- RESOLVED: Phase 5 (Amenities) exclusion constraint implemented with btree_gist
- RESOLVED: Phase 4 double-entry patterns researched and implemented
- RESOLVED: Phase 5 comment hierarchy and reaction counter patterns implemented
- RESOLVED: Phase 5 announcement fan-out and survey voting patterns implemented
- RESOLVED: Phase 6 document versioning and signature immutability patterns implemented
- RESOLVED: Phase 6 notification infrastructure with multi-channel delivery

## Session Continuity

Last session: 2026-01-30 00:13 UTC
Stopped at: Completed 06-05-PLAN.md (Push Notifications) - Phase 6 COMPLETE
Resume file: None

## Next Steps

**Recommended:** Begin Phase 7 (Operations & Analytics)

Phase 6 COMPLETE:
- 06-01: Ticket Enums, Categories, SLA & Workflow DONE
- 06-02: Assets & Preventive Maintenance DONE
- 06-03: Chat & Messaging DONE
- 06-04: Documents & Signatures DONE
- 06-05: Push Notifications DONE

Notification infrastructure available:
- notification_channel enum (push, email, sms, in_app)
- notification_type enum (18 types across 4 domains)
- push_platform enum (fcm_android, fcm_ios, apns, web_push)
- push_tokens table with staleness tracking and cleanup
- notification_preferences with JSONB per-type settings
- notifications table with multi-channel delivery tracking
- notification_deliveries for per-channel status
- notification_templates with 18 Spanish defaults
- register_push_token(), mark_token_invalid(), cleanup_stale_push_tokens()
- get_notification_channels() with DND support (emergency_alert bypasses)
- create_notification() integrates preferences, templates, pg_notify
- mark_notification_read(), get_unread_notifications()
- record_delivery_status() updates delivery tracking
