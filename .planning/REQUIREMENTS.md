# Requirements: UPOE Database Architecture

**Defined:** 2026-01-29
**Core Value:** Symbiosis operativa total — security, administration, community, and commerce unified in one ecosystem

## v1 Requirements

Requirements for the complete Supabase database schema. Each maps to roadmap phases.

### 1. Foundation & Multi-Tenant Security

- [ ] **FOUND-01**: Organizations table (platform-level SaaS owner)
- [ ] **FOUND-02**: Communities table with settings, timezone, locale, branding
- [ ] **FOUND-03**: RLS policies on ALL tables using `community_id` from JWT app_metadata
- [ ] **FOUND-04**: Audit columns on all tables (created_at, updated_at, deleted_at, created_by)
- [ ] **FOUND-05**: UUID v7 primary keys for offline-sync compatibility
- [ ] **FOUND-06**: Soft delete pattern with deleted_at timestamps
- [ ] **FOUND-07**: Base types and enums for status fields

### 2. Identity & CRM

- [ ] **CRM-01**: Units table (casa, departamento, local, bodega) with area and coefficient
- [ ] **CRM-02**: Residents table with full profiles, photos, KYC verification status
- [ ] **CRM-03**: Unit-Resident occupancy junction (owner/tenant/authorized with dates)
- [ ] **CRM-04**: Vehicles table with plates, photos, make/model/color, sticker, LPR data
- [ ] **CRM-05**: Pets table with species, breed, vaccination records, incident history
- [ ] **CRM-06**: Onboarding workflow states (invited, registered, verified, active)
- [ ] **CRM-07**: Resident documents (INE, contracts, etc.)

### 3. Access Control & Security

- [ ] **ACC-01**: Access points table (gates, barriers, doors, turnstiles)
- [ ] **ACC-02**: Invitations table (single-use, event, recurring, vehicle pre-auth)
- [ ] **ACC-03**: Access logs (immutable, photos, timestamps, method, result)
- [ ] **ACC-04**: Blacklist table with protocols, evidence, expiration
- [ ] **ACC-05**: Guards table with profiles, certifications
- [ ] **ACC-06**: Guard shifts and assignments per access point
- [ ] **ACC-07**: Patrol routes with checkpoint sequences
- [ ] **ACC-08**: Patrol checkpoints with NFC tag IDs and GPS coordinates
- [ ] **ACC-09**: Patrol logs with timestamp, GPS, photo evidence
- [ ] **ACC-10**: Emergency alerts (panic, fire, medical) with dispatch status
- [ ] **ACC-11**: QR codes table with cryptographic signatures and burn status

### 4. Financial Engine

- [ ] **FIN-01**: Fee structures (fixed, by coefficient, by rooms, hybrid formulas)
- [ ] **FIN-02**: Chart of accounts (for double-entry ledger)
- [ ] **FIN-03**: Ledger entries (debit/credit with account references)
- [ ] **FIN-04**: Transactions (payments, charges, adjustments, reversals)
- [ ] **FIN-05**: Interest and penalty rules configuration per community
- [ ] **FIN-06**: Delinquency triggers (days -> action: notify, block amenities, block access)
- [ ] **FIN-07**: Bank accounts for reconciliation
- [ ] **FIN-08**: Bank statement imports with matching patterns
- [ ] **FIN-09**: Payment proofs with validation workflow (pending, approved, rejected)
- [ ] **FIN-10**: Budgets and expense categories
- [ ] **FIN-11**: Invoices/statements generation history

### 5. Amenities & Reservations

- [ ] **AMEN-01**: Amenities catalog (photos, description, capacity, rules document)
- [ ] **AMEN-02**: Amenity schedules (operating hours, maintenance days)
- [ ] **AMEN-03**: Reservation slots with exclusion constraints (no double-booking)
- [ ] **AMEN-04**: Booking rules engine (quotas per period, advance window, restrictions)
- [ ] **AMEN-05**: Waitlist entries with auto-promotion logic
- [ ] **AMEN-06**: Reservation fees and deposits
- [ ] **AMEN-07**: No-show tracking and penalties

### 6. Community & Communication

- [ ] **COMM-01**: Channels table (general, ventas, servicios, mascotas, etc.)
- [ ] **COMM-02**: Posts with content, media, moderation status
- [ ] **COMM-03**: Post reactions and comments (nested)
- [ ] **COMM-04**: Announcements with priority, channels (push/email/SMS), segments
- [ ] **COMM-05**: Announcement read receipts
- [ ] **COMM-06**: Surveys with question types and options
- [ ] **COMM-07**: Survey responses with one-vote-per-unit enforcement
- [ ] **COMM-08**: Forum categories and threads
- [ ] **COMM-09**: Service arrival notifications (garbage, water, gas trucks)

### 7. Marketplace

- [ ] **MRKT-01**: Listings (sale, service, rental, wanted) with photos and pricing
- [ ] **MRKT-02**: Listing categories and tags
- [ ] **MRKT-03**: Safe exchange zones with availability
- [ ] **MRKT-04**: Exchange appointments
- [ ] **MRKT-05**: Moderation queue with reasons
- [ ] **MRKT-06**: Seller/service ratings and reviews
- [ ] **MRKT-07**: Local business directory

### 8. Maintenance

- [ ] **MAINT-01**: Ticket categories (plumbing, electrical, gardening, etc.)
- [ ] **MAINT-02**: Tickets with priority, status, SLA tracking
- [ ] **MAINT-03**: Ticket assignments and reassignments
- [ ] **MAINT-04**: Ticket comments and status updates
- [ ] **MAINT-05**: Ticket photos (before/after)
- [ ] **MAINT-06**: Assets registry (pumps, elevators, generators, etc.)
- [ ] **MAINT-07**: Preventive maintenance schedules
- [ ] **MAINT-08**: Auto-generated tickets from schedules
- [ ] **MAINT-09**: SLA definitions per category and priority
- [ ] **MAINT-10**: Escalation rules

### 9. Messaging & Chat

- [ ] **CHAT-01**: Conversations (direct 1:1, group chats, resident-guard)
- [ ] **CHAT-02**: Conversation participants with roles
- [ ] **CHAT-03**: Messages with text, media, read receipts
- [ ] **CHAT-04**: Message reactions
- [ ] **CHAT-05**: Guard booth chat (per-shift conversation with residents)
- [ ] **CHAT-06**: Quick responses (canned messages for guards)

### 10. Documents & Files

- [ ] **DOCS-01**: Document categories (legal, assembly, financial, operational)
- [ ] **DOCS-02**: Documents with versioning
- [ ] **DOCS-03**: Document access permissions
- [ ] **DOCS-04**: Regulation signatures (timestamp, IP, device)
- [ ] **DOCS-05**: Assembly minutes with attendance and agreements
- [ ] **DOCS-06**: Generic attachments table (polymorphic links to any entity)

### 11. Notifications

- [ ] **NOTIF-01**: Notifications table (type, channel, recipient, status)
- [ ] **NOTIF-02**: Push tokens (FCM/APNs device registration)
- [ ] **NOTIF-03**: User notification preferences (what and how)
- [ ] **NOTIF-04**: Notification templates per community
- [ ] **NOTIF-05**: Notification batching rules
- [ ] **NOTIF-06**: Delivery status tracking (sent, delivered, read, failed)

### 12. Package Management (Digital Mailroom)

- [ ] **PKG-01**: Packages with carrier, tracking, recipient, status
- [ ] **PKG-02**: Package photos (intake condition)
- [ ] **PKG-03**: Storage locations (shelf, row)
- [ ] **PKG-04**: Pickup codes (PIN/QR)
- [ ] **PKG-05**: Pickup signatures
- [ ] **PKG-06**: Abandoned package alerts and disposal

### 13. Provider Management

- [ ] **PROV-01**: Provider companies with contact, specialties, coverage
- [ ] **PROV-02**: Provider documentation (insurance, certifications) with expiration
- [ ] **PROV-03**: Provider employees (authorized personnel with photos)
- [ ] **PROV-04**: Provider access schedules (allowed days/hours)
- [ ] **PROV-05**: Provider ratings and performance history
- [ ] **PROV-06**: Provider work orders

### 14. Move-in/Move-out

- [ ] **MOVE-01**: Move requests (type, date, time window, moving company)
- [ ] **MOVE-02**: Pre-move validations checklist (debt-free, keys, vehicles)
- [ ] **MOVE-03**: Damage deposits with refund workflow
- [ ] **MOVE-04**: Move completion sign-off
- [ ] **MOVE-05**: Elevator/loading dock reservations for moves

### 15. Audit & Security

- [ ] **AUDIT-01**: Comprehensive audit log (entity, action, actor, before/after)
- [ ] **AUDIT-02**: User sessions with device info, IP, location
- [ ] **AUDIT-03**: Failed login attempts
- [ ] **AUDIT-04**: Security events (blocked access, blacklist hits, alerts)
- [ ] **AUDIT-05**: Data export/download logs

### 16. Configuration

- [ ] **CONFIG-01**: Community settings (hours, rules, branding, contact)
- [ ] **CONFIG-02**: User preferences (theme, language, notifications)
- [ ] **CONFIG-03**: Feature flags per community
- [ ] **CONFIG-04**: Custom fields definitions (extensible attributes)
- [ ] **CONFIG-05**: Roles and permissions matrix

### 17. Incident Reports

- [ ] **INC-01**: Incident types and categories
- [ ] **INC-02**: Incidents (type, severity, location, description, status)
- [ ] **INC-03**: Incident media (photos, videos, audio transcriptions)
- [ ] **INC-04**: Incident timeline and follow-up comments
- [ ] **INC-05**: Incident assignments and escalations
- [ ] **INC-06**: Incident resolution and closure

### 18. Voting & Assemblies

- [ ] **VOTE-01**: Elections (board elections, extraordinary decisions)
- [ ] **VOTE-02**: Election candidates/options
- [ ] **VOTE-03**: Ballots with weighted voting by coefficient
- [ ] **VOTE-04**: Quorum tracking and validation
- [ ] **VOTE-05**: Assembly events (virtual/in-person)
- [ ] **VOTE-06**: Assembly attendance with proxy delegation
- [ ] **VOTE-07**: Assembly agreements and action items

### 19. Parking

- [ ] **PARK-01**: Parking spots inventory (type: assigned, visitor, commercial, disabled)
- [ ] **PARK-02**: Parking assignments per unit
- [ ] **PARK-03**: Visitor parking reservations
- [ ] **PARK-04**: Parking violations with evidence
- [ ] **PARK-05**: Parking fees and passes

### 20. Keys & Access Devices

- [ ] **KEY-01**: Access device types (tag, remote, key, card)
- [ ] **KEY-02**: Device inventory with serial numbers
- [ ] **KEY-03**: Device assignments (unit, resident, provider)
- [ ] **KEY-04**: Device returns and transfers
- [ ] **KEY-05**: Lost device reports and deactivation
- [ ] **KEY-06**: Device replacement fees

### 21. Emergency Contacts & Medical

- [ ] **EMERG-01**: Emergency contacts per resident (relationship, priority)
- [ ] **EMERG-02**: Medical conditions registry (allergies, conditions)
- [ ] **EMERG-03**: Special needs/accessibility requirements
- [ ] **EMERG-04**: Authorized emergency responders

### 22. Violations & Sanctions

- [ ] **VIOL-01**: Violation types with default penalties
- [ ] **VIOL-02**: Violation records with evidence, location
- [ ] **VIOL-03**: Warnings and formal sanctions
- [ ] **VIOL-04**: Appeals and resolutions
- [ ] **VIOL-05**: Violation-triggered financial penalties
- [ ] **VIOL-06**: Repeat offender tracking

### 23. Analytics & Metrics

- [ ] **ANLY-01**: Pre-computed daily/weekly/monthly KPIs
- [ ] **ANLY-02**: Access pattern summaries (peak hours, trends)
- [ ] **ANLY-03**: Financial summaries (collection rate, delinquency)
- [ ] **ANLY-04**: Security metrics (incidents by zone/shift)
- [ ] **ANLY-05**: Amenity utilization stats
- [ ] **ANLY-06**: Communication engagement metrics

### 24. Integrations

- [ ] **INTG-01**: Integration configurations (type, credentials, status)
- [ ] **INTG-02**: Bank feed connections
- [ ] **INTG-03**: LPR/CCTV hardware endpoints
- [ ] **INTG-04**: Webhook endpoints for external systems
- [ ] **INTG-05**: API keys for third-party access
- [ ] **INTG-06**: Sync status and error logs per integration

## v2 Requirements

Deferred to future releases. Not in current roadmap.

### AI/ML Features
- **AI-01**: Sentiment analysis for moderation
- **AI-02**: Predictive delinquency scoring
- **AI-03**: Anomaly detection in access patterns
- **AI-04**: Smart matching for bank reconciliation ML

### Advanced IoT
- **IOT-01**: Real-time sensor data (water, electricity meters)
- **IOT-02**: Smart lock integrations
- **IOT-03**: Environmental monitoring (air quality, noise)

### Mobile Wallet
- **WALLET-01**: Apple Wallet credential provisioning
- **WALLET-02**: Google Wallet credential provisioning

## Out of Scope

| Feature | Reason |
|---------|--------|
| Frontend implementation | Separate phase after DB complete |
| Payment gateway integration | Schema only, no Stripe/PayPal code |
| Push notification service | Schema for records, not FCM/APNs implementation |
| LPR ML model training | Schema supports it, training is separate |
| Multi-language content | Single language first, i18n later |
| White-label theming engine | Basic branding only in v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 to FOUND-07 | Phase 1 | Pending |
| CRM-01 to CRM-07 | Phase 2 | Pending |
| ACC-01 to ACC-11 | Phase 3 | Pending |
| FIN-01 to FIN-11 | Phase 4 | Pending |
| AMEN-01 to AMEN-07 | Phase 5 | Pending |
| COMM-01 to COMM-09 | Phase 5 | Pending |
| MRKT-01 to MRKT-07 | Phase 5 | Pending |
| MAINT-01 to MAINT-10 | Phase 6 | Pending |
| CHAT-01 to CHAT-06 | Phase 6 | Pending |
| DOCS-01 to DOCS-06 | Phase 6 | Pending |
| NOTIF-01 to NOTIF-06 | Phase 6 | Pending |
| PKG-01 to PKG-06 | Phase 7 | Pending |
| PROV-01 to PROV-06 | Phase 7 | Pending |
| MOVE-01 to MOVE-05 | Phase 7 | Pending |
| AUDIT-01 to AUDIT-05 | Phase 7 | Pending |
| CONFIG-01 to CONFIG-05 | Phase 7 | Pending |
| INC-01 to INC-06 | Phase 8 | Pending |
| VOTE-01 to VOTE-07 | Phase 8 | Pending |
| PARK-01 to PARK-05 | Phase 8 | Pending |
| KEY-01 to KEY-06 | Phase 8 | Pending |
| EMERG-01 to EMERG-04 | Phase 8 | Pending |
| VIOL-01 to VIOL-06 | Phase 8 | Pending |
| ANLY-01 to ANLY-06 | Phase 8 | Pending |
| INTG-01 to INTG-06 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 147 total
- Mapped to phases: 147
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after initial definition*
