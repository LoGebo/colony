# Project Research Summary

**Project:** UPOE - Unified Property Operations Ecosystem
**Domain:** Multi-tenant Property Management SaaS (Gated Communities, HOA, Condos)
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

UPOE is a multi-tenant property management platform serving gated communities and HOAs. Research reveals this domain requires rigorous data isolation, offline-first mobile capabilities for security guards, and audit-grade financial tracking. The optimal architecture combines **Supabase** (backend platform with PostgreSQL, Auth, RLS, Storage, Edge Functions) with **PowerSync** (offline-first sync layer) and **Expo/Next.js** frontends.

The recommended approach prioritizes **database-level security through Row-Level Security (RLS)** for tenant isolation, **double-entry accounting** for financial integrity, and **domain-specific conflict resolution strategies** for offline sync. The key architectural decision is using community_id in JWT app_metadata (not user_metadata) to enforce multi-tenant isolation at the PostgreSQL level, making data leaks architecturally impossible rather than relying on application-layer filtering.

Critical risks include RLS misconfiguration (83% of Supabase breaches involve this), financial data type errors (using float instead of NUMERIC), and offline sync conflicts without defined resolution strategies. These must be addressed in Phase 1 foundation work - they are architectural decisions that become extremely expensive to fix later.

## Key Findings

### Recommended Stack

**Core Platform: Supabase Pro** provides all backend services in a unified platform. For UPOE's scale (50K access records, 10K vehicles, 5K residents per community), Supabase's multi-tenant RLS architecture is battle-tested and production-ready. The Pro tier ($25/mo minimum) is required - Free tier pauses after 7 days inactivity.

**Core technologies:**
- **Supabase (PostgreSQL 17)**: Backend platform with built-in Auth, RLS, Realtime, Storage, Edge Functions - eliminates need for separate backend services, enforces security at database layer
- **PowerSync**: Offline-first sync between Supabase Postgres and client SQLite - purpose-built for Supabase, handles 30-day offline requirement, non-invasive (no schema changes)
- **Expo (SDK 52+)**: Mobile framework with managed workflow - enables true offline-first with local SQLite via PowerSync, requires development builds (not Expo Go) for native modules
- **Next.js 15**: Web framework with App Router - SSR support via @supabase/ssr package, server-side auth token validation
- **PostgreSQL Extensions**: uuid-ossp (primary keys), pg_cron (scheduled jobs), pg_trgm (fuzzy search), pgcrypto (encryption), postgis (geospatial), pg_net (webhooks)

**Critical version requirements:**
- @supabase/supabase-js: 2.90.1+ (latest security patches)
- @powersync/react-native: 1.28.1+ (Rust-based sync client)
- PostgreSQL: Use v17 for latest features (v15 minimum)

### Expected Features

Research across property management systems (Buildium, Vantaca, Wild Apricot) and visitor management platforms (Proptia, EntranceIQ, GateHouse) reveals clear feature expectations.

**Must have (table stakes):**
- Unit/Property Registry with hierarchy (Community → Building → Unit) - foundation for everything
- Resident Profiles with KYC status tracking - users need accounts with document verification
- Ownership/Tenancy Tracking - support both property owners and tenants in same unit
- Monthly Fee Management with charge generation - primary HOA revenue mechanism
- Payment Recording with balance tracking - money-in functionality with aging reports
- Basic Visitor Pre-registration - name, date, QR code for security baseline
- Visitor Entry/Exit Logging - immutable audit trail of who came when
- Maintenance Request Workflow - submit, track, assign, resolve cycle
- Basic Announcements - broadcast messages to community members
- Document Storage - bylaws, meeting minutes, HOA policies
- Multi-tenant Data Isolation - row-level security is non-negotiable for SaaS
- Soft Deletes - deleted_at pattern required for offline sync (clients need deletion notifications)

**Should have (competitive advantage):**
- Double-Entry Accounting Ledger - most competitors use simple ledger, this provides audit-grade financial accuracy
- Offline-First with 30-Day Sync - critical differentiator for guards at gates without internet
- Real-time QR Validation - instant visitor verification vs code-based systems
- SLA-tracked Maintenance - accountability with response/resolution deadlines vs basic ticketing
- Smart Notifications - context-aware alerts delivered at right time
- Complex Amenity Booking Rules - flexible rules engine (advance days, max duration, deposits) beyond simple calendars
- Recurring Visitor Patterns - convenience for housekeepers, family ("every Tuesday" rules)
- Vehicle LPR Integration - automated entry via license plate recognition (requires hardware partnerships)

**Defer to v2+ (not essential for launch):**
- Financial Reconciliation - bank statement matching (accounting-grade, high complexity)
- Community Marketplace - buy/sell/services engagement feature
- AI-Assisted Ticket Categorization - efficiency feature, not core functionality
- Violation Workflow - rule enforcement with track/warn/penalize cycle
- API for External Integrations - ecosystem play, wait until core is proven

### Architecture Approach

The architecture uses **Row-Level Security (RLS) with community_id isolation** combined with **PowerSync offline-first sync**. Every table includes community_id FK, and RLS policies enforce (SELECT (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID) tenant filtering at PostgreSQL level. This centralizes isolation logic - application code cannot accidentally leak data.

**Major components:**
1. **Mobile App (Expo + SQLite)** - UI components, PowerSync client for offline sync, local SQLite database with write queue, network detection for sync coordination
2. **Web App (Next.js)** - Admin dashboard, resident portal, uses @supabase/ssr for server-side auth, direct Supabase client queries (online-only)
3. **Supabase Backend** - PostgreSQL with RLS policies per table, Edge Functions for business logic, Realtime for live updates (Broadcast for ephemeral, Postgres Changes for persistence), PostgREST API with RLS enforcement
4. **PowerSync Service** - Bucket definitions (per-community data partitions), logical replication from Postgres, sync rules for partial data distribution, checkpoint management for resume-after-disconnect
5. **Conflict Resolution Layer** - Domain-specific strategies: chronological merge (access logs), restrictive priority (access states), LWW with history (profiles), first-come-first-served (reservations), merge with dedup (emergencies)

**Key architectural decisions:**
- **JWT claims over subqueries**: RLS policies use community_id from app_metadata (evaluated once) instead of SELECT FROM profiles WHERE user_id = auth.uid() (evaluated per-row)
- **Soft deletes required**: deleted_at TIMESTAMPTZ on all synced tables - hard deletes cause offline clients to re-sync records as if they still exist
- **SECURITY DEFINER functions for performance**: Cache results of complex permission checks instead of repeating in RLS policies
- **PowerSync buckets for data partitioning**: Each user syncs only their community's data, not entire database
- **Edge Functions for conflict resolution**: Server-side business logic prevents different app versions from resolving conflicts differently

### Critical Pitfalls

**1. RLS Disabled or Misconfigured** - 83% of Supabase breaches involve RLS issues. Tables created without ENABLE ROW LEVEL SECURITY expose all tenant data. Enabling RLS without policies blocks ALL access. Must create policies immediately with tenant_id checks. January 2025 CVE-2025-48757 exposed 170+ apps. **Prevention:** ALTER TABLE X ENABLE ROW LEVEL SECURITY and restrictive policies in every migration, never skip during prototyping.

**2. Using user_metadata for Tenant ID** - Storing community_id in user_metadata (user-editable) instead of app_metadata (server-only) allows privilege escalation. Users can modify their tenant association and access other tenants' data. **Prevention:** Always use auth.jwt()->'app_metadata'->>'community_id' in RLS policies, set via supabaseAdmin.auth.admin.updateUserById() only.

**3. Financial Data Type Errors** - Using float/real/double/money types for currency causes rounding errors that compound over time. Accounts don't balance, legal/compliance issues arise. **Prevention:** Use NUMERIC(15,4) for all financial amounts (GAAP requires 4 decimal places), or store as BIGINT cents.

**4. RLS Performance Degradation** - Complex RLS policies with subqueries/joins execute per-row, causing 1000+ join operations. Queries slow from milliseconds to seconds. Database ignores indexes when RLS evaluates function calls per-row. **Prevention:** Index all tenant_id columns, wrap auth functions in SELECT for caching, use SECURITY DEFINER functions, flip subquery direction (tenant_id IN (SELECT ...) not uid IN (SELECT ...)).

**5. Offline Sync Conflicts Without Strategy** - Last-write-wins is wrong for business data. Multiple devices modifying same data offline leads to lost payments, overwritten resident data, conflicting guard reports. **Prevention:** Define domain-specific conflict resolution before building: server-wins (payments), last-modified-merge (profiles), append-only (logs), manual-review (documents). Implement in Edge Functions, not just client.

**Additional critical pitfalls:**
- **Views bypassing RLS** - Views run with SECURITY DEFINER (creator's privileges) by default in PostgreSQL, exposing data. Use WITH (security_invoker = true) on all views.
- **Service role key in client code** - Bypasses all RLS. One leaked key = full database compromise. Only use in Edge Functions/server code, never in frontend environment variables.
- **Schema drift between environments** - Manual production changes cause migration failures. Always use supabase db diff + supabase db push, never modify via dashboard.
- **Realtime subscriptions breaking silently** - Auto-disconnect when tab hidden, RLS blocks DELETE events, channel name conflicts cause duplicates. Build self-healing subscriptions with reconnect logic.
- **Storage RLS policy violations** - Separate storage.objects table has own RLS, requires SELECT+INSERT+UPDATE policies for upsert. File path convention critical: /{tenant_id}/{entity_type}/{entity_id}/{filename}.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes architectural foundations that are expensive to change later, then builds features incrementally with offline-first from start.

### Phase 1: Foundation & Multi-Tenant Security
**Rationale:** RLS, auth architecture, and data type decisions are irreversible without rewrites. 83% of Supabase breaches stem from Phase 1 mistakes. Financial data types cannot be changed after production data exists.

**Delivers:**
- PostgreSQL schema with community_id on all tables
- RLS policies with app_metadata-based tenant isolation
- JWT auth with community_id in app_metadata
- NUMERIC(15,4) for all financial fields
- Migration workflow (supabase CLI + CI/CD)
- Soft delete pattern (deleted_at) on all tables

**Addresses features:**
- Multi-tenant Data Isolation (table stakes)
- Property hierarchy (Community → Building → Unit)
- Resident Profiles foundation
- User authentication

**Avoids pitfalls:**
- Pitfall #1 (RLS misconfiguration)
- Pitfall #2 (user_metadata for tenant_id)
- Pitfall #3 (financial data types)
- Pitfall #7 (service role key exposure)
- Pitfall #10 (schema drift)

**Research flag:** SKIP RESEARCH - well-documented patterns, official Supabase RLS guides sufficient.

### Phase 2: Offline-First Sync Architecture
**Rationale:** PowerSync integration requires schema changes (updated_at, deleted_at) and conflict resolution strategies. Must be designed before building features that rely on offline access. Guards need offline capability from day one.

**Delivers:**
- PowerSync bucket definitions for per-community sync
- Conflict resolution strategies per entity type
- Local SQLite setup via @powersync/react-native
- Expo development build configuration (native modules)
- Background sync with network detection
- Write queue for offline operations

**Uses:**
- PowerSync React Native SDK 1.28.1+
- op-sqlite adapter with encryption
- Expo background tasks for sync

**Implements:**
- Offline-First with 30-Day Sync (competitive advantage)
- Domain-specific conflict resolution (access logs: merge, access states: restrictive priority, profiles: LWW with history, reservations: first-come, emergencies: merge with dedup)

**Avoids pitfalls:**
- Pitfall #8 (offline sync conflict failures)
- Pitfall #15 (PowerSync WAL overhead)

**Research flag:** NEEDS RESEARCH - Conflict resolution strategies need domain-specific design per entity type during phase planning. PowerSync bucket configuration requires understanding access patterns.

### Phase 3: Core Property Management
**Rationale:** Foundation and sync established. Now build table-stakes features that residents/admins expect. These are well-understood CRUD operations with standard patterns.

**Delivers:**
- Unit/Property Registry with hierarchy
- Resident Profiles with KYC status
- Ownership/Tenancy tracking (many-to-many via unit_occupancies)
- Vehicle registry with license plates
- Pet registry
- Document storage (Supabase Storage with RLS)
- Basic announcements

**Addresses features:**
- Unit/Property Registry (must-have)
- Resident Profiles (must-have)
- Ownership/Tenancy Tracking (must-have)
- Document Storage (must-have)

**Avoids pitfalls:**
- Pitfall #9 (Storage RLS policy violations) - establish file path convention early
- Pitfall #5 (views bypassing RLS) - if creating any summary views

**Research flag:** SKIP RESEARCH - Standard CRUD patterns, Supabase Storage docs sufficient.

### Phase 4: Financial Management with Double-Entry
**Rationale:** Financial accuracy is competitive advantage. Double-entry ledger prevents "money from nowhere" bugs and provides audit trail. More complex than simple ledger, but research shows this is industry standard for real financial systems.

**Delivers:**
- Chart of accounts (hierarchical)
- Double-entry transaction/journal_entry tables (immutable)
- Account balances (materialized view)
- Fee definitions (configurable per community)
- Monthly charge generation
- Payment recording
- Balance inquiry and aging reports
- Reversing entries for corrections (never update/delete)

**Uses:**
- NUMERIC(15,4) data types from Phase 1
- Immutable transaction pattern (append-only)

**Addresses features:**
- Monthly Fee Management (must-have)
- Payment Recording (must-have)
- Outstanding Balance View (must-have)
- Double-Entry Accounting (competitive advantage)

**Avoids pitfalls:**
- Pitfall #3 (financial data types already addressed in Phase 1)
- Pitfall #8 (conflict resolution: payments are server-wins, require online)

**Research flag:** NEEDS RESEARCH - Double-entry accounting patterns need deeper study during phase planning. Chart of accounts structure for property management domain requires examples.

### Phase 5: Access Control & Visitor Management
**Rationale:** Guards are primary mobile users. Offline-first from Phase 2 critical here. Visitor management is core value proposition. QR code generation and real-time validation differentiate from competitors.

**Delivers:**
- Visitor pre-registration with QR codes
- Access code generation
- Visitor entry/exit logging (immutable)
- Blacklist with pattern matching
- Real-time visitor validation
- Vehicle tracking at entry points
- Guard mobile app workflows

**Uses:**
- PowerSync offline capability from Phase 2
- Supabase Realtime for instant notifications
- Conflict resolution: logs are append-only (no conflicts)

**Addresses features:**
- Basic Visitor Pre-registration (must-have)
- Visitor Entry Logging (must-have)
- Real-time QR Validation (competitive advantage)
- Recurring Visitor Patterns (competitive advantage)

**Avoids pitfalls:**
- Pitfall #7 (Realtime subscriptions) - build self-healing subscriptions for guard alerts
- Pitfall #11 (Edge Function cold starts) - keep-warm for critical validation endpoints

**Research flag:** NEEDS RESEARCH - QR code generation/validation patterns, LPR integration points need investigation during phase planning.

### Phase 6: Maintenance & SLA Tracking
**Rationale:** Maintenance requests are table-stakes, but SLA tracking is competitive advantage. SLA calculation logic lives in Edge Functions (not database triggers per Pitfall #12).

**Delivers:**
- Maintenance ticket submission
- Category hierarchy with default SLAs
- SLA policy definitions (response time, resolution time)
- Ticket assignment workflow
- Status tracking with history
- SLA breach detection
- Escalation rules
- Comment/attachment threading

**Uses:**
- Edge Functions for SLA calculation (not database triggers)
- pg_cron for periodic SLA check jobs

**Addresses features:**
- Maintenance Requests (must-have)
- SLA-tracked Maintenance (competitive advantage)

**Avoids pitfalls:**
- Pitfall #12 (over-engineering in database) - SLA logic in Edge Functions, testable

**Research flag:** SKIP RESEARCH - Standard ticketing patterns with SLA extensions, well-documented.

### Phase 7: Amenity Reservations
**Rationale:** Complex booking rules are competitive advantage. PostgreSQL exclusion constraints prevent double-booking at database level (tstzrange overlap checks).

**Delivers:**
- Amenity definitions with capacity
- Booking rules engine (JSONB for flexibility)
- Time slot management
- Reservation workflow with approval
- Conflict detection via exclusion constraints
- Waitlist for high-demand amenities
- Deposit tracking

**Uses:**
- PostgreSQL tstzrange type for time ranges
- Exclusion constraints: EXCLUDE USING gist (amenity_id WITH =, tstzrange(start, end) WITH &&)

**Addresses features:**
- Amenity definitions (phase 5)
- Basic reservations (phase 5)
- Complex Amenity Booking Rules (competitive advantage)

**Avoids pitfalls:**
- Pitfall #8 (conflict resolution: reservations are first-come-first-served, server rejects on overlap)

**Research flag:** NEEDS RESEARCH - Booking rule patterns, exclusion constraint performance with RLS, calendar visualization approaches need phase-specific research.

### Phase 8: Communication & Real-time Features
**Rationale:** Builds on Realtime infrastructure. Broadcast for ephemeral events (panic button), Postgres Changes for persistent data (new announcements).

**Delivers:**
- Announcements with rich media
- Emergency alerts (panic button)
- Push notifications (via Edge Functions)
- Real-time presence (guard duty status)
- In-app messaging

**Uses:**
- Supabase Realtime Broadcast (ephemeral)
- Supabase Realtime Postgres Changes (persistent)
- Edge Functions for notification dispatch
- pg_net for webhook calls

**Addresses features:**
- Basic Announcements (must-have)
- Smart Notifications (competitive advantage)

**Avoids pitfalls:**
- Pitfall #7 (Realtime subscriptions) - filter by community_id, use Broadcast for high-volume scenarios

**Research flag:** SKIP RESEARCH - Standard real-time patterns, Supabase Realtime docs sufficient.

### Phase Ordering Rationale

**Why this order:**
1. **Foundation first** - RLS, auth, data types are architectural decisions that require rewrites if wrong. CVE-2025-48757 showed 83% of breaches stem from Phase 1 mistakes.
2. **Offline before features** - PowerSync requires schema changes (updated_at, deleted_at). Adding later means migrating existing tables and handling data already in production without soft deletes.
3. **Financial early** - Double-entry is harder to retrofit. Once you have transactions in simple ledger, migrating to double-entry means replaying history or losing audit trail.
4. **Access control before amenities** - Visitor management and guard workflows inform authentication patterns. Amenities depend on resident identity already being established.
5. **Communication last** - Realtime features depend on data models being stable. Easier to add notifications after entities exist than to build entities around notifications.

**Dependency chains identified:**
- Auth → Residents → Vehicles/Pets/Documents (identity first)
- Property Hierarchy → Financial (need units before charging fees)
- Residents → Visitors (need hosts before guests)
- Amenities → Reservations (need things before booking them)
- All features → RLS (security cannot be added later)
- All mobile features → PowerSync (offline requires sync infrastructure)

**Pitfall avoidance strategy:**
- Critical pitfalls (#1-5) all addressed in Phase 1-2
- Moderate pitfalls (#7-12) addressed in phases where relevant features are built
- Minor pitfalls (#13-15) handled through configuration and monitoring

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Offline Sync)** - Conflict resolution strategies need domain-specific design per entity type. PowerSync bucket configuration requires understanding data access patterns and volumes. Research deliverables: conflict resolution decision tree, bucket partition strategy, sync performance estimates.
- **Phase 4 (Financial)** - Double-entry accounting patterns for property management domain need examples. Chart of accounts structure varies by jurisdiction. Research deliverables: sample chart of accounts, transaction patterns for common scenarios (fee charge, payment, refund, adjustment), reconciliation approaches.
- **Phase 5 (Access Control)** - QR code generation/validation patterns, LPR hardware integration points, blacklist matching algorithms. Research deliverables: QR format specification, LPR API integration patterns, vehicle pattern matching strategies.
- **Phase 7 (Amenities)** - Booking rule patterns (advance notice, max duration, cancellation policies), PostgreSQL exclusion constraint performance with RLS at scale, calendar visualization for complex availability. Research deliverables: booking rule schema design, index strategies for time-range queries with RLS, UI patterns for availability display.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation)** - RLS patterns well-documented in official Supabase guides, multi-tenant architectures are established patterns
- **Phase 3 (Core Property)** - Standard CRUD operations, Supabase Storage with RLS is documented
- **Phase 6 (Maintenance)** - Ticketing systems are well-understood, SLA calculation patterns established
- **Phase 8 (Communication)** - Realtime notification patterns documented in Supabase guides

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Supabase docs, PowerSync integration guides, 8-month production review (Hackceleration 2026), verified version numbers |
| Features | MEDIUM-HIGH | Multiple authoritative sources (Buildium, Vantaca, Wild Apricot, Proptia, EntranceIQ) cross-referenced, feature categorization based on industry standards |
| Architecture | HIGH | Official Supabase RLS patterns, PowerSync architectural diagrams, multi-tenant patterns validated by AWS/Crunchy Data, conflict resolution strategies from EDB/CRDT research |
| Pitfalls | HIGH | CVE-2025-48757 documented, official Supabase troubleshooting guides, GitHub discussions with verified solutions, November 2025 outage incident report |

**Overall confidence:** HIGH

Research is comprehensive with primary sources (official documentation, verified production reports, CVE references). Feature landscape validated across multiple platforms. Architecture patterns supported by database vendor documentation. Pitfalls verified through incident reports and official troubleshooting guides.

### Gaps to Address

**1. LPR Integration Specifics** - Research identified that Vehicle LPR is a competitive advantage requiring hardware partnerships, but specific vendor APIs, camera protocols, and integration patterns need investigation. **How to handle:** Defer LPR research until Phase 5 planning (access control). May warrant separate /gsd:research-phase for hardware integration if pursuing this feature in MVP.

**2. Jurisdiction-Specific Chart of Accounts** - Financial research established double-entry as best practice, but chart of accounts structure varies by state/country property management regulations. Sample provided is generic HOA. **How to handle:** During Phase 4 planning, research property management accounting standards for target markets. May need configurable chart of accounts per jurisdiction.

**3. Booking Rule Complexity Limits** - Amenity reservation research shows complex rules are differentiator, but performance implications of JSONB rule evaluation at scale unknown. **How to handle:** During Phase 7 planning, load test booking rule evaluation with 1000+ amenities and 10K+ reservations. May need rule precompilation or caching strategy.

**4. PowerSync Pricing at Scale** - PowerSync offers Free/Pro tiers but research didn't uncover pricing details for 100+ communities with 1000+ concurrent users. **How to handle:** Contact PowerSync during Phase 2 planning for enterprise pricing. Budget estimates needed before committing to architecture.

**5. Edge Function Regional Latency** - Supabase self-hosts Deno (not Deno Deploy), but regional distribution strategy unclear. Critical for guard alerts requiring sub-200ms response. **How to handle:** During Phase 5 planning, test Edge Function latency from target deployment regions. May need alternative for latency-critical operations.

**6. Soft Delete Cleanup Strategy** - All tables use deleted_at for offline sync, but no research found on cleanup/archival patterns. Over time, deleted records accumulate. **How to handle:** During Phase 1, design archival strategy (e.g., partition by deleted_at, archive to cold storage after 90 days, retain for audit period).

**7. Conflict Resolution Testing** - Domain-specific strategies identified, but no research on testing offline sync conflicts systematically. **How to handle:** During Phase 2, build offline sync test harness (simulate multiple devices offline, create conflicts, verify resolution). Critical for confidence in production.

## Sources

### Primary (HIGH confidence)
- [Supabase Official Documentation](https://supabase.com/docs) - RLS guides, Auth patterns, Realtime benchmarks, Storage access control, Edge Functions limits
- [PowerSync Official Docs](https://docs.powersync.com) - React Native SDK, Supabase integration, custom conflict resolution, bucket definitions
- [PostgreSQL Official Documentation](https://www.postgresql.org/docs) - NUMERIC type, Row-Level Security, Exclusion constraints, Triggers
- [Supabase Review 2026 (Hackceleration)](https://hackceleration.com/supabase-review/) - 8-month production testing across 6 projects
- [CVE-2025-48757](https://vibeappscanner.com/supabase-row-level-security) - 170+ exposed Supabase databases, 83% RLS misconfigurations
- [Supabase Status History](https://status.supabase.com/history) - November 2025 outage incident report

### Secondary (MEDIUM confidence)
- [Buildium Blog](https://www.buildium.com/blog/best-hoa-management-software-platforms/) - HOA feature expectations
- [Wild Apricot](https://www.wildapricot.com/blog/hoa-software) - Property management software comparisons
- [Proptia Visitor Management](https://www.proptia.com/visitor-management/) - Access control features
- [EntranceIQ](https://www.entranceiq.net/blog/2025/what-is-a-gated-community-visitor-software-how-does-it-work.html) - Gated community software patterns
- [Square Engineering - Books](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/) - Double-entry accounting patterns
- [Journalize.io](https://blog.journalize.io/posts/an-elegant-db-schema-for-double-entry-accounting/) - Accounting schema design
- [Anvil](https://anvil.works/blog/double-entry-accounting-for-engineers) - Engineer's guide to double-entry
- [AWS Multi-Tenant RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) - RLS patterns
- [Crunchy Data](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) - PostgreSQL multi-tenancy
- [AntStack Multi-Tenant Guide](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) - Supabase-specific patterns
- [Supabase Best Practices (Leanware)](https://www.leanware.co/insights/supabase-best-practices) - Production recommendations
- [GeeksforGeeks - ER Diagrams for Real Estate](https://www.geeksforgeeks.org/dbms/how-to-design-er-diagrams-for-real-estate-property-management/) - Schema patterns
- [GitHub - Rental Database Project](https://github.com/ashmitan/Rental-Database-Project) - Example schemas

### Tertiary (LOW confidence, needs validation)
- [Medium - Soft Deletes with RLS](https://medium.com/@priyaranjanpatraa/soft-deletes-you-can-trust-row-level-archiving-with-spring-boot-jpa-postgresql-2c3544255e26) - Implementation patterns
- [DEV - PostgreSQL Soft Delete Strategies](https://dev.to/oddcoder/postgresql-soft-delete-strategies-balancing-data-retention-50lo) - Tradeoff discussions
- [LogVault - Audit Logs Anti-Pattern](https://www.logvault.app/blog/audit-logs-table-anti-pattern) - What not to do
- [Andy Atkinson - Avoid UUID v4](https://andyatkinson.com/avoid-uuid-version-4-primary-keys) - UUID v7 recommendation
- [Maciej Walkowiak - PostgreSQL UUID](https://maciejwalkowiak.com/blog/postgres-uuid-primary-key/) - Performance analysis

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*
