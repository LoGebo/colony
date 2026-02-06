# Feature Research: Frontend Applications for Property Management

**Domain:** Gated Community Management Mobile App + Admin Dashboard (Mexico)
**Researched:** 2026-02-06
**Confidence:** MEDIUM-HIGH (Cross-referenced from 15+ competitor platforms, industry reports, and Mexico-market apps)

---

## Context

This research maps the **frontend feature landscape** for UPOE's v2.0 milestone. The backend (116 tables, 24 domains) is fully built. The question is: which features need frontend screens for MVP, what UX patterns work, and what can be deferred?

Three distinct applications are being built:
1. **React Native (Expo) mobile app** -- serving residents, guards, and mobile-admin roles
2. **Next.js admin dashboard** -- serving community administrators and super admins

Each user role has fundamentally different needs, screen layouts, and interaction patterns.

---

## Part 1: Mobile App -- Resident Experience

### Table Stakes (Residents Will Not Adopt Without These)

Features every competing app (ComunidadFeliz, Neivor, CondoVive, TownSq, Condo Control) already ships. Missing any of these means the app feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Auth + Onboarding** | Cannot use app without it | MEDIUM | Email invite flow, sign up, profile setup. Must handle the invited-resident flow (admin creates record, user links via email). Show community branding on first launch. |
| **Home Dashboard** | Entry point, orientation | MEDIUM | Summary cards: balance due, upcoming visitors, next reservation, unread announcements. This is the "at a glance" screen. Every competitor has it. |
| **Account Balance & Payment History** | Primary financial concern for residents | MEDIUM | Show current balance, charges breakdown, payment history. Residents in Mexico check this obsessively. ComunidadFeliz, Neivor, and CondoVive all lead with this. |
| **Payment Submission (Proof Upload)** | How residents pay HOA fees | MEDIUM | Upload bank transfer receipt (comprobante), SPEI reference, or mark as paid. Mexico is heavily bank-transfer based, not credit-card. Payment proof workflow (pending -> approved/rejected) is critical. |
| **Visitor Pre-Registration** | Core security feature | MEDIUM | Create invitation with name, date, time window. Generate QR code. Share via WhatsApp (critical in Mexico). Single-use and recurring types. This is the #1 daily-use feature for residents. |
| **Active Visitors List** | Know who is coming/has arrived | LOW | View pending, checked-in, and completed visits. Real-time status updates when guard processes entry. |
| **Maintenance Request Submission** | Universal resident need | MEDIUM | Category selection, description, photo upload, location. Track status updates. Every competitor has this. |
| **Maintenance Ticket Status** | Follow up on requests | LOW | Timeline view of ticket progress. Notification when status changes. Residents want to know "is it being worked on?" |
| **Announcements / Notices Feed** | Community communication baseline | LOW | Read-only feed of admin announcements. Mark as read. Priority flagging. Every HOA app has this. |
| **Push Notifications** | Real-time awareness | MEDIUM | Visitor arrived, payment received, maintenance update, new announcement. Without push, the app feels dead. |
| **Profile Management** | Basic account control | LOW | Edit phone, emergency contacts, profile photo. View unit assignment. |

### Differentiators (Competitive Advantage for Residents)

Features that most Mexico-market competitors do NOT have or do poorly. These create "wow" moments.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **QR Code Sharing via WhatsApp** | Frictionless visitor invitation | LOW | Deep integration with WhatsApp share sheet. Mexico runs on WhatsApp. Most competitors just show QR on screen; sharing it directly to the visitor via WhatsApp is a UX differentiator. |
| **Amenity Reservation with Calendar** | Self-service booking | MEDIUM | Visual calendar showing available slots, tap-to-book. Most Mexican apps have rudimentary booking. A clean calendar UI with instant confirmation sets UPOE apart. |
| **Real-time Visitor Status** | Peace of mind | MEDIUM | Live updates: "Your visitor Juan arrived at Gate A at 3:42 PM." Supabase Realtime makes this achievable. Most competitors show status after refresh. |
| **Community Social Wall** | Engagement beyond transactions | MEDIUM | Posts, reactions, comments. Neighborhood news. Lost-and-found. This creates daily engagement beyond "pay and forget." TownSq succeeds specifically because of this. |
| **In-App Chat with Admin** | Direct communication | HIGH | 1:1 messaging with admin/manager. Avoids WhatsApp groups chaos. Most competitors rely on email or external WhatsApp. |
| **Marketplace Listings** | Community commerce | MEDIUM | Buy/sell/offer services within community. Trust infrastructure (same community = trusted). Unique differentiator in Mexico market. |
| **Document Access** | Transparency | LOW | View community bylaws, assembly minutes, financial reports. Most Mexican HOA admins keep these hidden. Making them accessible builds trust. |
| **Survey & Voting Participation** | Governance engagement | MEDIUM | Vote on community decisions from phone. Weighted by coefficient (Mexican law). Few competitors offer this. |
| **Package Notification** | Convenience | LOW | "You have a package at the guardhouse." Pickup confirmation with code. Reduces guard-resident friction. |

### Anti-Features for Resident App (Do NOT Build Yet)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Full Financial Ledger View** | "I want to see all transactions" | Double-entry ledger is admin complexity; residents just need balance + charges + payments | Show simplified "My Account" with balance, charges list, payments list. No journal entries. |
| **In-App Payment Gateway** | "Pay with credit card in the app" | Stripe/payment integration is a separate milestone. Mexico uses SPEI bank transfers predominantly. Gateway adds compliance burden (PCI). | Payment proof upload (comprobante) covers 90% of Mexican HOA payments. Gateway is v3.0. |
| **Offline-First Sync** | "Works without internet" | PowerSync/offline sync is massive complexity for first release. Guards need it more than residents. | Online-first with graceful degradation (cached last state, queue actions). Offline is a future milestone per PROJECT.md. |
| **AI Chatbot** | "Ask questions to an AI" | Premature. Need real usage data first. AI without good data gives bad answers. | Search function over announcements + FAQ section. |
| **Biometric Access Control** | "Unlock gate with fingerprint" | Requires hardware integration, IoT partnerships. Out of scope per PROJECT.md. | QR code-based access is the proven pattern. |
| **Multi-Community Switching** | "I own units in 2 communities" | Edge case for v1. Adds navigation complexity. | Support single community per login. Multi-community is v3.0. |
| **Complex Report Generation** | "Show me graphs of my payments" | Residents don't need analytics. Admins do. | Simple payment history list with totals. |

---

## Part 2: Mobile App -- Guard Experience

### Table Stakes (Guards Cannot Work Without These)

The guard app is a **work tool**, not a consumer app. It must be fast, operable with one hand while standing at a gate, and work under pressure. UX must prioritize speed and clarity over aesthetics.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Auth + Shift Start** | Guard must clock in | LOW | Login, select active access point (gate). Start shift. Simple and fast -- guards change shifts every 8-12 hours. |
| **Expected Visitors Queue** | Primary work screen | MEDIUM | List of visitors expected TODAY at THIS gate, sorted by time. Show visitor name, host resident, unit, vehicle info, time window. One-tap to start check-in. This is the guard's "inbox." |
| **QR Code Scanner** | Primary verification method | MEDIUM | Camera-based QR scan. Validates against invitation. Shows green (approved) or red (denied) with visitor details. Must work in < 2 seconds. Guard scans, gate opens. This is the #1 interaction. |
| **Manual Visitor Check-In** | Walk-in visitors without QR | MEDIUM | Quick form: name, who visiting (unit search), vehicle plate, photo. Call resident for authorization. Log entry. About 30-40% of visits are walk-ins. |
| **Entry/Exit Logging** | Security audit trail | LOW | Record entry and exit with timestamp, gate, method (QR, manual, vehicle). Immutable log. Guards need this for liability. |
| **Resident Directory Lookup** | "Who lives in unit 42?" | LOW | Search by unit number, resident name, or phone. Show basic contact info. Guards need this dozens of times per shift. |
| **Vehicle Quick Search** | Identify vehicles by plate | LOW | Search by license plate. Show registered owner/unit. Flag if blacklisted. |
| **Package Reception** | Deliveries are constant | MEDIUM | Log incoming package: carrier, recipient unit, photo of label. Notify resident. Track storage location. Generate pickup code. |
| **Emergency Panic Button** | Safety critical | LOW | One-tap emergency alert. Types: panic, fire, medical. Notifies admin, other guards, and generates incident. Must be accessible from ANY screen. |

### Differentiators (Competitive Advantage for Guards)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Blacklist Alert on Check-In** | Prevent prohibited entry | MEDIUM | Automatic cross-check during visitor check-in. Loud visual/audio alert if match. Shows reason and protocol. Most competitor guard apps lack real-time blacklist checks. |
| **NFC Patrol Checkpoint Scanning** | Prove patrol completion | MEDIUM | Guard taps NFC tag at checkpoints during patrol rounds. Logs time, location, sequence. Supervisors see completion status. QR-Patrol and similar apps show this is expected in professional security. |
| **Incident Reporting with Media** | Document events in real-time | MEDIUM | Quick incident creation: type, severity, photo/video, location, description. Timeline auto-generated. Much better than paper logbooks. |
| **Shift Handover Notes** | Continuity between shifts | LOW | Outgoing guard leaves notes for incoming guard. "Vehicle in lot 3 has flat tire." "Expecting large delivery at unit 12." |
| **Visitor Photo Capture** | Visual verification record | LOW | Camera capture during check-in. Stored in access log. Valuable for security disputes. |
| **Provider/Contractor Verification** | Validate service providers | MEDIUM | Scan provider ID, check against authorized provider schedule (days/hours). Verify insurance/certification status. |
| **Guard-to-Guard Chat** | Inter-gate coordination | MEDIUM | Simple messaging between guards on duty. "Sending a resident's visitor to Gate B." Lightweight, not full chat. |

### Anti-Features for Guard App (Do NOT Build Yet)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **LPR Camera Integration** | "Auto-read license plates" | Requires hardware (cameras), computer vision pipeline, IoT integration. Out of scope per PROJECT.md. | Manual plate entry with quick-search. LPR is v3.0+. |
| **Facial Recognition** | "Identify visitors by face" | Privacy concerns, ML infrastructure, hardware requirements. Disproportionate complexity. | Photo capture + manual verification. |
| **Full Admin Functions** | "Guard should manage everything" | Guards need a focused tool, not a Swiss army knife. Admin functions distract from primary duty. | Guard sees their domain only: visitors, patrols, incidents, packages. |
| **Complex Reporting** | "Guards generate reports" | Guards report incidents; admins generate reports FROM incidents. Different workflows. | Simple incident creation. Reports are admin-web territory. |
| **Offline-First Full Sync** | "What if internet is down?" | Full offline sync is a future milestone. | Cache last-loaded expected visitors list. Queue check-ins for upload. Graceful degradation, not full offline. |

---

## Part 3: Mobile App -- Admin (Mobile Subset)

### Table Stakes (Admin Needs on Mobile)

Admins use mobile for quick checks and approvals, not full management. The web dashboard is the primary admin tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Dashboard Overview** | Quick health check | LOW | Financial summary (collected vs owed), today's visitors count, open maintenance tickets, recent incidents. Glanceable. |
| **Payment Proof Approval** | Time-sensitive workflow | MEDIUM | View pending payment proofs, approve/reject with one tap. This is the admin's most frequent mobile action. Residents get frustrated waiting for approval. |
| **Announcement Publishing** | Quick communication | LOW | Create and send announcement to all residents or specific segments. |
| **Maintenance Ticket Management** | Assign and track | MEDIUM | View tickets, assign to staff/provider, update status. Comment. |
| **Push Notification Management** | See what was sent | LOW | View sent notifications log. |

### Differentiators for Mobile Admin

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Visitor Activity Feed** | Real-time security awareness | LOW | Live feed of all gate entries/exits. Admin knows what is happening at the gates. |
| **Quick Resident Lookup** | Answer questions fast | LOW | Search residents, see their balance, unit, vehicles. Admin gets calls constantly asking about resident info. |
| **Incident Acknowledgment** | Responsive management | LOW | View incidents reported by guards, acknowledge, add notes. |

---

## Part 4: Web Admin Dashboard

### Table Stakes (Admin Dashboard Must-Haves)

These are features every property management admin platform provides. Without them, the admin will use spreadsheets instead.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Financial Overview Dashboard** | #1 admin concern | HIGH | Total collected, total owed, delinquency rate, collection rate, month-over-month trends. Charts: bar (collected vs charged by month), pie (delinquency distribution), table (unit-by-unit balances). This is the home screen. |
| **Unit-by-Unit Balance Report** | Who owes what | MEDIUM | Table of all units with: current balance, months delinquent, last payment date, contact info. Sortable, filterable, exportable to Excel. Mexican admins live in this report. |
| **Payment Management** | Process payments | MEDIUM | View incoming payment proofs, approve/reject, match to charges. Bulk operations. Filter by status. |
| **Charge Generation** | Bill residents | HIGH | Generate monthly fees for all units. Support coefficient-based, fixed, and hybrid formulas. Preview before applying. Schedule auto-generation. |
| **Resident Management** | CRUD residents | MEDIUM | Add/edit/deactivate residents. Link to units. Manage occupancy types (owner/tenant). Invite via email. View per-resident history. |
| **Unit Management** | Property registry | LOW | List all units with type, area, coefficient, current occupant(s). Edit unit details. |
| **Maintenance Ticket Dashboard** | Operational oversight | MEDIUM | All tickets by status (kanban or table view). Assign, prioritize, track SLA. Response time metrics. |
| **Announcements Manager** | Community communication | LOW | Create, schedule, target (all residents, specific buildings, delinquent units). View read receipts. |
| **Visitor/Access Log Report** | Security oversight | MEDIUM | Filterable log of all entries/exits. Date range, gate, visitor type. Export capability. |
| **Document Repository** | Legal compliance | LOW | Upload/organize community documents (bylaws, minutes, financial reports). Set visibility (public to residents or admin-only). |
| **User & Role Management** | Access control | MEDIUM | Manage admin users, guards, managers. Assign roles and permissions. Invite new users. |
| **Community Settings** | Configuration | MEDIUM | Community name, address, branding (logo, colors). Business hours. Feature flags. Rules configuration. |

### Differentiators for Admin Dashboard

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Delinquency Analytics** | Collection strategy | HIGH | Aging analysis (30/60/90/120+ days). Delinquency trends over time. Per-building breakdown. Automated collection letter generation. Mexican HOAs fight delinquency constantly -- good analytics is a competitive weapon. |
| **Financial Reports Suite** | Accounting transparency | HIGH | Income vs expense report, balance sheet, cash flow, budget vs actual. Mexican law requires annual financial reports for assemblies. Exportable to PDF/Excel. |
| **Guard Performance Dashboard** | Security management | MEDIUM | Patrol completion rates, average visitor processing time, incident response time, shift coverage. Most competitors have zero guard analytics. |
| **Amenity Utilization Reports** | Justify investments | MEDIUM | Booking rates by amenity, peak hours, cancellation rates. Helps justify amenity maintenance budgets. |
| **Bulk Operations** | Admin efficiency | MEDIUM | Bulk charge generation, bulk payment import (bank statement reconciliation), bulk notification sending. Admins managing 200+ units need bulk tools. |
| **Audit Trail Viewer** | Compliance and disputes | MEDIUM | Searchable log of all administrative actions. Who changed what, when. Useful for board disputes. |
| **Election/Assembly Management** | Governance | HIGH | Create elections, define options, open voting, track quorum (by coefficient per Mexican law), declare results. Assembly attendance tracking with proxy delegation. |
| **Integration Configuration** | Extensibility | MEDIUM | Configure webhook endpoints, manage API keys, view integration status. Future-proofs the platform. |

### Anti-Features for Admin Dashboard (Do NOT Build Yet)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Full Accounting System** | "Replace our accountant software" | UPOE is property management, not QuickBooks. Building a full general ledger UI with trial balance, journal entry creation, etc. is a multi-month effort. | Show financial summaries and reports. Export to Excel for accountants. Integrate with accounting software later. |
| **CRM for Prospective Buyers/Renters** | "Manage unit sales" | Sales/rental CRM is a different product. Scope creep. | Resident registry covers current occupants. Sales CRM is not property management. |
| **White-Label Theme Editor** | "Each community wants custom branding" | Visual theme editor is complex. Per PROJECT.md, basic branding only for v2.0. | Logo + primary color per community. Full theming is v3.0+. |
| **Real-Time Video Monitoring** | "Show camera feeds in dashboard" | Requires video infrastructure, RTSP streaming, massive bandwidth. | Link out to camera vendor's own dashboard. UPOE manages data, not video streams. |
| **IoT Device Management** | "Manage smart locks, sensors" | Hardware integration is out of scope per PROJECT.md. | Database schema supports it. UI for IoT is a future milestone. |
| **AI-Powered Insights** | "Predict delinquency, suggest actions" | Needs historical data that does not exist yet for a new platform. | Start with rule-based alerts (e.g., "unit delinquent > 60 days"). ML comes after data accumulation. |
| **Multi-Language i18n** | "English version too" | Per PROJECT.md, Spanish first. i18n infrastructure adds overhead to every screen. | Ship in Spanish. Add i18n infrastructure in v3.0 when expanding beyond Mexico. |

---

## Part 5: UX Patterns and Screen Architecture

### Mobile App Navigation (Resident)

**Recommended: 5-tab bottom navigation.** Research shows 3-5 tabs with odd numbers produce the best UX. Studies show a 65% increase in daily active users when switching from hamburger menu to bottom tabs.

```
Bottom Tab Bar (Resident):
[Home]  [Visitors]  [Payments]  [Community]  [More]

Home:        Dashboard with summary cards
Visitors:    Create invitation, active visitors, history
Payments:    Balance, payment history, upload proof
Community:   Announcements, social wall, amenities, marketplace
More:        Maintenance, documents, surveys, profile, settings
```

**Rationale:** The first three tabs (Home, Visitors, Payments) are daily-use features. Community covers engagement. "More" groups less-frequent features to avoid tab overflow.

### Mobile App Navigation (Guard)

**Recommended: 4-tab bottom navigation.** Guards need fewer, more focused screens. Speed is everything.

```
Bottom Tab Bar (Guard):
[Gate]  [Packages]  [Patrol]  [Alerts]

Gate:        Expected visitors queue, QR scanner button (FAB), manual check-in
Packages:    Receive package, pending pickups, confirm pickup
Patrol:      Active route, NFC scan, checkpoint status
Alerts:      Emergency button, incidents, shift notes
```

**Rationale:** "Gate" is the primary screen -- guards spend 80% of their time here. Packages are the second most frequent activity. Patrol is periodic. Alerts is always accessible. The QR scanner should be a floating action button on the Gate screen, always one tap away.

### Guard UX Critical Patterns

Based on research from QR-Patrol, GuardWatch, GateHouse Solutions, and Belfry:

| Pattern | Implementation | Why |
|---------|---------------|-----|
| **Large tap targets** | Minimum 48dp buttons, prefer 56dp+ | Guards wear gloves, use in rain/sun, operate one-handed |
| **High contrast mode** | Dark text on light background, or vice versa | Outdoor use in bright sunlight or at night |
| **Minimal text input** | Dropdowns, quick-select, photo over typing | Speed. Guards process a visitor every 2-3 minutes at peak |
| **Persistent emergency button** | FAB or header button on every screen | Safety-critical. Must be reachable in < 1 second |
| **Audio/haptic feedback** | Sound + vibration on QR scan success/failure | Guard may not be looking at screen during scan |
| **Auto-advance workflow** | After QR scan success, auto-show entry confirmation | Reduce taps. Scan -> Confirm -> Done in 2 taps max |

### Admin Dashboard UX Patterns

Based on research from Condo Control (40+ modules), CINC Systems, Buildium, and property management dashboard templates:

| Pattern | Implementation | Why |
|---------|---------------|-----|
| **Sidebar navigation** | Collapsible sidebar with module groupings | Admin dashboard has 15+ sections. Bottom tabs do not scale. Sidebar with groups (Financial, Security, Community, Operations, Settings) is standard. |
| **KPI cards on home** | 4-6 summary cards at top of dashboard | Occupancy rate, collection rate, delinquency rate, open tickets, today's visitors, pending approvals |
| **Data tables with filters** | Sortable, filterable tables for all list views | Admins managing 100+ units need table views with search, sort, date filters, status filters, and export |
| **Kanban for tickets** | Drag-drop columns: Open -> In Progress -> Resolved | Maintenance workflow visualization. Alternative: table view toggle. |
| **Chart dashboard** | Bar charts (monthly collection), line charts (delinquency trend), pie charts (expense breakdown) | Financial overview needs visual representation. Mexican admins present these at assemblies. |
| **Bulk action toolbars** | Select multiple rows, apply action | Charge generation, payment approval, notification sending |

---

## Part 6: Feature Dependencies

```
Authentication & Onboarding
    |
    +-- Resident App
    |     +-- Home Dashboard
    |     |     requires: Balance data, Visitors data, Announcements data
    |     |
    |     +-- Visitor Management
    |     |     requires: Auth (host identity), Unit assignment
    |     |     enhances: Push notifications (visitor arrived)
    |     |     enhances: Guard QR Scanner (verification target)
    |     |
    |     +-- Payment Management
    |     |     requires: Auth, Unit assignment, Charge data
    |     |     enhances: Admin payment approval workflow
    |     |
    |     +-- Maintenance Requests
    |     |     requires: Auth, Unit assignment
    |     |     enhances: Admin ticket dashboard, Push notifications
    |     |
    |     +-- Announcements (read-only)
    |     |     requires: Auth
    |     |
    |     +-- Amenity Reservations
    |     |     requires: Auth, Amenity catalog (admin-created)
    |     |
    |     +-- Community Wall
    |     |     requires: Auth
    |     |
    |     +-- Marketplace
    |           requires: Auth, Community Wall patterns (shared components)
    |
    +-- Guard App
    |     +-- Gate Operations (expected visitors + QR scan + manual check-in)
    |     |     requires: Auth, Visitor invitations data, Access points config
    |     |     THIS IS THE CORE -- build first
    |     |
    |     +-- Package Management
    |     |     requires: Auth, Unit directory
    |     |
    |     +-- Patrol System
    |     |     requires: Auth, NFC hardware access, Patrol routes (admin-created)
    |     |
    |     +-- Incident Reporting
    |           requires: Auth, Camera access
    |
    +-- Admin Dashboard
          +-- Financial Module (charges, payments, reports)
          |     requires: Auth, Unit data, Resident data
          |     THIS IS THE CORE -- build first
          |
          +-- Resident Management
          |     requires: Auth
          |     enables: Everything else (residents must exist)
          |
          +-- Visitor/Access Reports
          |     requires: Guard app generating data
          |
          +-- Maintenance Dashboard
          |     requires: Residents submitting tickets
          |
          +-- Community Tools (announcements, surveys, elections)
          |     requires: Resident data
          |
          +-- Configuration (settings, roles, features)
                requires: Auth
                enables: Everything else
```

### Dependency Notes

- **Auth + Onboarding is the universal prerequisite:** Nothing works without it. Build first, for all three roles.
- **Visitor Management (resident) and Gate Operations (guard) are tightly coupled:** The resident creates the invitation; the guard verifies it. Both must be built in the same phase.
- **Payment proof upload (resident) and Payment approval (admin) are tightly coupled:** Same phase.
- **Maintenance submission (resident) and Maintenance dashboard (admin) are tightly coupled:** Same phase.
- **Amenity reservations require admin to have created amenities first.** Admin amenity management before resident booking.
- **Guard patrol requires admin to have created routes/checkpoints first.** Admin patrol configuration before guard patrol screen.
- **Analytics/reports require data to exist.** Build data-entry features before reporting features.

---

## Part 7: MVP Definition

### Launch With (v2.0 MVP)

The minimum frontend to deliver a **usable product** that replaces WhatsApp groups + spreadsheets.

**Resident Mobile App:**
- [ ] Auth + onboarding (invited resident flow) -- gate to everything
- [ ] Home dashboard (balance, visitors, announcements summary) -- orientation
- [ ] Visitor pre-registration with QR + WhatsApp sharing -- #1 daily use feature
- [ ] Account balance + charge history view -- #1 financial concern
- [ ] Payment proof upload -- how they pay
- [ ] Maintenance request submission + status tracking -- basic operational need
- [ ] Announcements feed -- communication baseline
- [ ] Push notifications (visitor arrived, payment status, announcements) -- app feels alive
- [ ] Profile management -- basic self-service

**Guard Mobile App:**
- [ ] Auth + shift selection -- start of every shift
- [ ] Expected visitors queue -- the primary work screen
- [ ] QR code scanner with instant verification -- core access control
- [ ] Manual visitor check-in -- walk-in visitors
- [ ] Entry/exit logging -- audit trail
- [ ] Resident/unit directory search -- "who lives in unit X?"
- [ ] Package reception + notification -- constant daily activity
- [ ] Emergency panic button -- safety critical, must be on every screen

**Admin Web Dashboard:**
- [ ] Auth + community setup -- gate to everything
- [ ] Financial overview dashboard (collection rate, delinquency, charts) -- admin's home screen
- [ ] Unit-by-unit balance report -- the most-used report
- [ ] Payment proof approval/rejection -- time-sensitive workflow
- [ ] Charge generation (monthly fees) -- billing engine
- [ ] Resident management (CRUD, invite, deactivate) -- data foundation
- [ ] Unit management -- property registry
- [ ] Maintenance ticket dashboard (list + assign + status) -- operational oversight
- [ ] Announcement creator -- communication tool
- [ ] Access log report -- security oversight
- [ ] Community settings + branding -- configuration

### Add After MVP Validation (v2.1 - v2.3)

Features to add once the core works and real users provide feedback.

- [ ] **Amenity reservations** (resident) + **amenity management** (admin) -- trigger: admin requests it
- [ ] **Community social wall** (resident) -- trigger: admins want to replace WhatsApp groups
- [ ] **Guard patrol with NFC** -- trigger: communities with large perimeters request it
- [ ] **Incident reporting with media** (guard) -- trigger: guards are actively using the app
- [ ] **Document repository** (resident read, admin manage) -- trigger: assembly season
- [ ] **Delinquency analytics** (admin) -- trigger: admin sees basic financials working
- [ ] **Vehicle quick-search** (guard) -- trigger: communities with vehicle-heavy access
- [ ] **Blacklist alerts** (guard) -- trigger: communities with security concerns
- [ ] **Survey/voting** (resident) + **election management** (admin) -- trigger: assembly season
- [ ] **Shift handover notes** (guard) -- trigger: multi-guard communities
- [ ] **Bulk charge import / bank reconciliation** (admin) -- trigger: admin volume needs it

### Future Consideration (v3.0+)

Features to defer until product-market fit is established.

- [ ] **Marketplace** -- needs active community engagement first
- [ ] **In-app chat** (resident-to-admin, guard-to-guard) -- high complexity, needs Supabase Realtime patterns
- [ ] **Financial reports suite** (income statement, balance sheet) -- accounting-grade complexity
- [ ] **Guard performance analytics** -- needs data accumulation
- [ ] **Provider/contractor management** -- operational complexity
- [ ] **Parking management** -- community-specific need
- [ ] **Violation tracking workflow** -- needs guard/admin experience first
- [ ] **Integration configuration** (webhooks, API keys) -- platform maturity feature
- [ ] **Payment gateway integration** (Stripe/SPEI) -- compliance and partnership
- [ ] **Offline-first sync** -- PowerSync integration, major infrastructure
- [ ] **Multi-language i18n** -- expansion beyond Mexico
- [ ] **White-label theming** -- enterprise feature

---

## Part 8: Feature Prioritization Matrix

### Resident App Features

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Auth + Onboarding | HIGH | MEDIUM | P1 | MVP |
| Home Dashboard | HIGH | MEDIUM | P1 | MVP |
| Visitor Pre-Registration + QR | HIGH | MEDIUM | P1 | MVP |
| Account Balance + History | HIGH | LOW | P1 | MVP |
| Payment Proof Upload | HIGH | MEDIUM | P1 | MVP |
| Maintenance Request | HIGH | MEDIUM | P1 | MVP |
| Announcements Feed | HIGH | LOW | P1 | MVP |
| Push Notifications | HIGH | MEDIUM | P1 | MVP |
| Profile Management | MEDIUM | LOW | P1 | MVP |
| Amenity Reservations | MEDIUM | MEDIUM | P2 | v2.1 |
| Community Social Wall | MEDIUM | MEDIUM | P2 | v2.2 |
| Document Access | MEDIUM | LOW | P2 | v2.2 |
| Survey/Voting | MEDIUM | MEDIUM | P2 | v2.3 |
| Package Notifications | LOW | LOW | P2 | v2.1 |
| Marketplace | LOW | MEDIUM | P3 | v3.0 |
| In-App Chat | MEDIUM | HIGH | P3 | v3.0 |

### Guard App Features

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Auth + Shift Selection | HIGH | LOW | P1 | MVP |
| Expected Visitors Queue | HIGH | MEDIUM | P1 | MVP |
| QR Code Scanner | HIGH | MEDIUM | P1 | MVP |
| Manual Check-In | HIGH | MEDIUM | P1 | MVP |
| Entry/Exit Logging | HIGH | LOW | P1 | MVP |
| Resident Directory Search | HIGH | LOW | P1 | MVP |
| Package Reception | HIGH | MEDIUM | P1 | MVP |
| Emergency Panic Button | HIGH | LOW | P1 | MVP |
| Vehicle Quick-Search | MEDIUM | LOW | P2 | v2.1 |
| Blacklist Alerts | MEDIUM | MEDIUM | P2 | v2.1 |
| NFC Patrol Checkpoints | MEDIUM | MEDIUM | P2 | v2.2 |
| Incident Reporting | MEDIUM | MEDIUM | P2 | v2.2 |
| Shift Handover Notes | LOW | LOW | P2 | v2.2 |
| Provider Verification | LOW | MEDIUM | P3 | v3.0 |
| Guard-to-Guard Chat | LOW | HIGH | P3 | v3.0 |

### Admin Dashboard Features

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Auth + Setup | HIGH | MEDIUM | P1 | MVP |
| Financial Overview Dashboard | HIGH | HIGH | P1 | MVP |
| Unit Balance Report | HIGH | MEDIUM | P1 | MVP |
| Payment Approval | HIGH | MEDIUM | P1 | MVP |
| Charge Generation | HIGH | HIGH | P1 | MVP |
| Resident Management | HIGH | MEDIUM | P1 | MVP |
| Unit Management | HIGH | LOW | P1 | MVP |
| Maintenance Dashboard | HIGH | MEDIUM | P1 | MVP |
| Announcement Creator | MEDIUM | LOW | P1 | MVP |
| Access Log Report | MEDIUM | MEDIUM | P1 | MVP |
| Community Settings | MEDIUM | MEDIUM | P1 | MVP |
| Amenity Management | MEDIUM | MEDIUM | P2 | v2.1 |
| Delinquency Analytics | MEDIUM | HIGH | P2 | v2.2 |
| Document Management | MEDIUM | LOW | P2 | v2.2 |
| Bulk Operations | MEDIUM | MEDIUM | P2 | v2.2 |
| Survey/Election Management | MEDIUM | HIGH | P2 | v2.3 |
| Audit Trail Viewer | LOW | MEDIUM | P2 | v2.3 |
| Guard Performance Dashboard | LOW | MEDIUM | P3 | v3.0 |
| Financial Reports Suite | MEDIUM | HIGH | P3 | v3.0 |
| Integration Configuration | LOW | MEDIUM | P3 | v3.0 |

**Priority key:**
- P1: Must have for launch -- app is broken without it
- P2: Should have, add based on user feedback triggers
- P3: Nice to have, future milestones

---

## Part 9: Competitor Feature Analysis

### Mexico Market Competitors

| Feature | ComunidadFeliz | Neivor | CondoVive | TownSq | UPOE (Plan) |
|---------|---------------|--------|-----------|--------|-------------|
| Resident Mobile App | Yes (basic) | Yes | Yes | Yes (strong) | Yes -- aim for best-in-class |
| Guard Mobile App | Minimal | Basic access control | No | No | Yes -- major differentiator |
| Admin Web Dashboard | Yes | Yes | Yes | Yes | Yes |
| Visitor QR Codes | Basic | Yes | Yes | No | Yes + WhatsApp sharing |
| Payment Proof Upload | Yes | Yes | Yes | No | Yes |
| Online Payment Gateway | Yes (WebPay) | Yes | Partial | No | Deferred to v3.0 |
| Maintenance Tickets | Yes | Yes | Basic | Basic | Yes + SLA tracking |
| Social Wall | No | Basic | No | Yes (core feature) | Yes |
| Marketplace | No | No | No | No | Yes (differentiator) |
| Amenity Booking | Basic | Yes | Basic | No | Yes + calendar UI |
| Financial Reports | Basic | Yes | Basic | No | Strong (differentiator) |
| Guard Patrol System | No | No | No | No | Yes (major differentiator) |
| Incident Management | No | Minimal | No | No | Yes (differentiator) |
| Elections/Voting | No | No | No | No | Yes (differentiator) |
| Package Management | No | No | No | No | Yes (differentiator) |
| Double-Entry Ledger | No (simple) | No (simple) | No (simple) | N/A | Yes (accuracy differentiator) |
| Multi-tenant SaaS | Yes | Yes | Partial | Yes | Yes |

### Key Competitive Insights

1. **Guard app is the biggest gap in the market.** No major Mexico competitor offers a dedicated, feature-rich guard mobile app. ComunidadFeliz and Neivor have basic access logging, but nothing approaching a real guard workstation app.

2. **TownSq wins on community engagement** (social wall, events). UPOE should match this with social wall + marketplace for stickiness.

3. **ComunidadFeliz leads on financial features** in Mexico. UPOE's double-entry ledger is technically superior but must translate into clear, simple financial reports that admins can present at assemblies.

4. **No competitor offers package management, patrol systems, or incident management** in the Mexico market. These are clear differentiators.

5. **WhatsApp integration is critical.** Mexican residents share everything via WhatsApp. QR codes for visitors MUST be shareable via WhatsApp. Notifications should deep-link back to the app.

---

## Sources

**Competitor Platforms Analyzed:**
- [ComunidadFeliz](https://www.comunidadfeliz.mx/) - Mexico's leading HOA management platform
- [Neivor](https://blog.neivor.com/9-apps-administracion-de-condominios-en-mexico) - Mexico market overview and competitor analysis
- [Condo Control](https://www.condocontrol.com/blog/top-5-hoa-management-software/) - 40+ module feature comparison
- [TownSq](https://www.townsq.io) - Community engagement-focused platform
- [Buildium](https://www.buildium.com/blog/best-hoa-management-software-platforms/) - HOA management software review

**Guard/Security App Patterns:**
- [EntranceIQ - Guard Gate Apps](https://www.entranceiq.net/blog/2025/the-complete-guide-to-guard-gate-apps-security-system.html)
- [QR-Patrol](https://www.qrpatrol.com/mobile-app) - Guard patrol app with QR/NFC
- [Belfry Software - Guard Patrol](https://www.belfrysoftware.com/blog/guard-patrol-app) - Guard app selection guide
- [GateHouse Solutions](https://www.gatehousesolutions.com/) - Visitor management software
- [Proptia](https://www.proptia.com/visitor-management/) - Gated community visitor management

**Property Management KPIs and Dashboards:**
- [Revela - 12 Property Management KPIs for 2026](https://www.revela.co/resources/property-management-kpis)
- [Second Nature - Property Management Dashboards 2025](https://www.secondnature.com/blog/property-management-dashboard)
- [DataBrain - PM Dashboard Template](https://www.usedatabrain.com/blog/property-management-dashboard)

**UX Patterns:**
- [AppMySite - Bottom Navigation Bar Guide 2025](https://blog.appmysite.com/bottom-navigation-bar-in-mobile-apps-heres-all-you-need-to-know/)
- [React Navigation - Bottom Tabs](https://reactnavigation.org/docs/bottom-tab-navigator/)

**Industry Reports:**
- [Capterra - Best HOA Software 2026](https://www.capterra.com/hoa-software/)
- [DoorLoop - Best Property Management Apps 2026](https://www.doorloop.com/blog/best-property-management-apps)
- [Guesty - Must-Have PM Software Features 2026](https://www.guesty.com/blog/must-have-property-management-software-features/)

---
*Feature research for: UPOE Frontend Applications (Gated Community Management)*
*Researched: 2026-02-06*
