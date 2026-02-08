# Roadmap: UPOE Frontend Applications

## Milestones

- **v1.0 Database Architecture** - Phases 1-8 (shipped 2026-01-30)
- **v2.0 Frontend Applications** - Phases 9-16 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 Database Architecture (Phases 1-8) - SHIPPED 2026-01-30</summary>

- [x] **Phase 1: Foundation & Multi-Tenant Security** - Core tables, RLS patterns, audit infrastructure
- [x] **Phase 2: Identity & CRM** - Units, residents, vehicles, pets, onboarding
- [x] **Phase 3: Access Control & Security** - Gates, guards, visitors, patrols, emergencies
- [x] **Phase 4: Financial Engine** - Double-entry ledger, fees, payments, reconciliation
- [x] **Phase 5: Amenities, Communication & Marketplace** - Reservations, social wall, listings
- [x] **Phase 6: Maintenance, Chat, Documents & Notifications** - Tickets, messaging, files, alerts
- [x] **Phase 7: Operations & Compliance** - Packages, providers, moves, audit, config
- [x] **Phase 8: Governance & Analytics** - Incidents, voting, parking, keys, violations, metrics, integrations

**Total:** 38/38 plans - PROJECT COMPLETE

</details>

### v2.0 Frontend Applications (Phases 9-16)

**Milestone Goal:** Build React Native (Expo) mobile app and Next.js admin dashboard consuming the complete Supabase backend, delivering working applications for residents, guards, and administrators.

- [x] **Phase 9: Auth & Shared Infrastructure** - Monorepo config, typed clients, auth flows for all roles on both platforms
- [x] **Phase 10: Mobile Core — Resident Visitors/Payments + Guard Gate** - Daily-use resident features and tightly coupled guard gate operations
- [x] **Phase 11: Admin Dashboard Financial Core** - Financial KPIs, payment approval, charge generation, resident/unit management
- [x] **Phase 12: Admin Dashboard Operations** - Maintenance tickets, announcements, access logs, documents, amenity management
- [x] **Phase 13: Advanced Resident Features** - Social wall, amenity reservations, documents, profile, marketplace
- [ ] **Phase 14: Guard Advanced + Admin Providers/Parking/Moves** - Patrol, incidents, handover, provider/parking/move management, marketplace moderation
- [ ] **Phase 15: Admin Governance & Analytics** - Elections, assemblies, surveys, violations, emergency info, keys/devices, guard metrics, audit trail
- [ ] **Phase 16: Push Notifications & Real-time Polish** - Push registration, notification delivery, real-time subscriptions, notification preferences

## Phase Details

### Phase 9: Auth & Shared Infrastructure
**Goal**: All user roles can authenticate on their respective platform (mobile or web) and see role-appropriate navigation, with shared infrastructure (typed client, query hooks, validators) supporting all subsequent feature development
**Depends on**: v1.0 backend (auth triggers, RLS policies, seed data)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. Invited resident can sign up on mobile, see resident tab navigation, and persist session across app restarts
  2. Invited guard can sign up on mobile, see guard tab navigation, and persist session across app restarts
  3. New admin can sign up on web, complete onboarding (create org + community), and see admin sidebar navigation
  4. User can log in, log out, and reset password on both mobile and web platforms
  5. Shared package provides typed Supabase client, TanStack Query hooks skeleton, Zod validators, and file upload utility usable by both platforms
**Plans**: 5 plans

Plans:
- [x] 09-01-PLAN.md - Shared package: typed Supabase client factories, query key factories, Zod validators, constants
- [x] 09-02-PLAN.md - Mobile Expo Router setup: file-based routing, role-based route groups, auth storage with expo-sqlite
- [x] 09-03-PLAN.md - Admin Next.js setup: App Router, middleware token refresh, @supabase/ssr, sidebar layout
- [x] 09-04-PLAN.md - Auth screens: sign-in, sign-up, password reset, onboarding flows (both platforms)
- [x] 09-05-PLAN.md - Shared hooks: TanStack Query provider, file upload utility, role navigation guards

### Phase 10: Mobile Core — Resident Visitors/Payments + Guard Gate
**Goal**: Residents can manage visitors with QR codes and view their financial status, while guards can verify visitors and manage gate operations — the tightly coupled daily-use workflows
**Depends on**: Phase 9 (auth, navigation, shared hooks)
**Requirements**: RHOME-01, RHOME-02, RHOME-03, RVIS-01, RVIS-02, RVIS-03, RVIS-04, RVIS-05, RVIS-06, RVIS-07, RVIS-08, RPAY-01, RPAY-02, RPAY-03, RPAY-04, RPAY-05, GGATE-01, GGATE-02, GGATE-03, GGATE-04, GGATE-05, GGATE-06, GGATE-07, GGATE-08, GGATE-09, GPKG-01, GPKG-02, GPKG-03, GPKG-04
**Success Criteria** (what must be TRUE):
  1. Resident sees home dashboard with summary cards (balance, visitors, announcements, maintenance) that link to detail screens
  2. Resident can create single-use and recurring visitor invitations, generate QR codes, share via WhatsApp, and cancel pending invitations
  3. Resident can view account balance, payment history, upload payment proof photo, and see proof approval status
  4. Guard can start shift, view expected visitors queue, scan QR codes for instant verification, and manually check in walk-in visitors
  5. Guard can log entry/exit, search residents by unit or name, search vehicles by plate, see blacklist alerts, and capture visitor photos
**Plans**: 5 plans

Plans:
- [x] 10-01-PLAN.md - Resident home dashboard with summary cards and community branding
- [x] 10-02-PLAN.md - Resident visitor management: invitations, QR generation, WhatsApp sharing, visitor list and history
- [x] 10-03-PLAN.md - Resident payments: balance view, payment history, proof upload with status tracking
- [x] 10-04-PLAN.md - Guard gate operations: shift start, expected visitors, QR scanner, manual check-in, entry/exit logging
- [x] 10-05-PLAN.md - Guard directory and packages: resident search, vehicle search, blacklist alerts, package reception and pickup

### Phase 11: Admin Dashboard Financial Core
**Goal**: Administrators can oversee community finances with KPI dashboards, approve payments, generate charges, and manage residents and units
**Depends on**: Phase 9 (admin auth, Next.js layout), Phase 10 (payment proofs submitted by residents)
**Requirements**: AFIN-01, AFIN-02, AFIN-03, AFIN-04, AFIN-05, AFIN-06, AFIN-07, AFIN-08, ARES-01, ARES-02, ARES-03, ARES-04, ARES-05, ACONF-01, ACONF-02
**Success Criteria** (what must be TRUE):
  1. Admin sees financial overview with KPI cards (collection rate, delinquency rate, total collected) and charts (monthly collection, delinquency trend, expense breakdown)
  2. Admin can view unit-by-unit balance report with sorting, filtering, and Excel export
  3. Admin can approve or reject payment proofs individually and in bulk, and generate monthly charges with preview
  4. Admin can create, edit, deactivate residents, invite via email, and manage unit-resident occupancy assignments
  5. Admin can configure community settings (name, branding, hours, rules) and manage feature flags
**Plans**: 4 plans

Plans:
- [x] 11-01-PLAN.md - Financial KPI dashboard: overview cards, collection/delinquency charts, income vs expense reports
- [x] 11-02-PLAN.md - Payment operations: proof approval queue with bulk ops, charge generation with preview, balance reports with export
- [x] 11-03-PLAN.md - Resident and unit management: CRUD, invite workflow, occupancy assignments, role management
- [x] 11-04-PLAN.md - Community configuration: settings editor, branding, feature flags

### Phase 12: Admin Dashboard Operations
**Goal**: Administrators can manage day-to-day operations including maintenance tickets, announcements, access logs, documents, and amenities
**Depends on**: Phase 11 (admin dashboard layout, resident management), Phase 10 (maintenance tickets and access logs created by mobile users)
**Requirements**: AOPS-01, AOPS-02, AOPS-03, AOPS-04, AOPS-05, AOPS-06, AOPS-07, AOPS-08, AOPS-09, AOPS-10, RMAINT-01, RMAINT-02, RMAINT-03, RMAINT-04, RCOMM-01, RCOMM-02, RCOMM-03
**Success Criteria** (what must be TRUE):
  1. Admin can view maintenance tickets in table or kanban view, assign to staff/providers, update status, and see SLA metrics
  2. Admin can create and schedule announcements with targeting (all, building, delinquent), and view read receipts
  3. Admin can view access log reports with date range and gate filters, and export to CSV
  4. Admin can manage document repository (upload, categorize, set visibility) and manage amenities (create, edit, rules, schedules, utilization reports)
  5. Resident can submit maintenance requests with photos, view ticket status timeline, add comments, and view/read announcements with push notifications
**Plans**: 4 plans

Plans:
- [x] 12-01-PLAN.md - Shared query keys, sidebar children, admin ticket hooks/components, ticket table/kanban page, ticket detail with assignment/SLA
- [x] 12-02-PLAN.md - Mobile resident maintenance: ticket list, create with photos, detail with timeline and comments
- [x] 12-03-PLAN.md - Admin announcement management with targeting and read receipts; mobile announcement feed with auto-read
- [x] 12-04-PLAN.md - Admin access logs with CSV export, document repository with upload, amenity CRUD with utilization charts

### Phase 13: Advanced Resident Features
**Goal**: Residents can engage with community through social wall, reserve amenities, access documents, manage their profile, and use the marketplace
**Depends on**: Phase 12 (admin amenity management, document repository, announcements)
**Requirements**: RCOMM-04, RCOMM-05, RCOMM-06, RAMEN-01, RAMEN-02, RAMEN-03, RAMEN-04, RAMEN-05, RDOC-01, RDOC-02, RPROF-01, RPROF-02, RPROF-03, RPROF-04, RMRKT-01, RMRKT-02, RMRKT-03, RMRKT-04
**Success Criteria** (what must be TRUE):
  1. Resident can view, post on, react to, and comment on the community social wall
  2. Resident can browse amenity catalog, view availability calendar, make and cancel reservations, and receive booking confirmations via push
  3. Resident can view community documents, sign regulations, and participate in surveys
  4. Resident can edit profile (phone, photo, emergency contacts), view unit assignment, manage vehicles, and view package notifications
  5. Resident can create marketplace listings with photos, browse/search by category, contact sellers, and mark as sold
**Plans**: 4 plans

Plans:
- [x] 13-01-PLAN.md -- RLS identity fix migration, query key factories, community tab layout, social wall feed with posts/reactions/comments/polls
- [x] 13-02-PLAN.md -- Amenity reservations: catalog grid, availability calendar (react-native-calendars), booking via create_reservation RPC, my reservations, cancellation
- [x] 13-03-PLAN.md -- More tab layout, documents (get_accessible_documents RPC, regulation signing via capture_signature), profile editor, vehicles CRUD, packages with pickup codes
- [x] 13-04-PLAN.md -- Marketplace: listing creation with photo upload, category browse, listing detail, WhatsApp seller contact, mark as sold

### Phase 14: Guard Advanced + Admin Providers/Parking/Moves
**Goal**: Guards can conduct patrols, report incidents, and perform shift handovers, while admins can manage providers, parking, moves, and marketplace moderation
**Depends on**: Phase 10 (guard gate operations foundation), Phase 11 (admin dashboard foundation)
**Requirements**: GPATR-01, GPATR-02, GPATR-03, GINC-01, GINC-02, GINC-03, GEMRG-01, GEMRG-02, GEMRG-03, GEMRG-04, APROV-01, APROV-02, APROV-03, APROV-04, APROV-05, APARK-01, APARK-02, APARK-03, APARK-04, AMOVE-01, AMOVE-02, AMOVE-03, AMOVE-04, AMRKT-01, AMRKT-02, AMRKT-03
**Success Criteria** (what must be TRUE):
  1. Guard can view active patrol route, scan NFC checkpoints, and see patrol progress (scanned vs remaining)
  2. Guard can create incident reports with type, severity, photos/video, view incident timeline, add follow-ups, and leave shift handover notes
  3. Guard has persistent emergency panic button accessible from any screen that triggers alerts and generates incident records with emergency type selection
  4. Admin can manage providers (companies, documentation, personnel, access schedules, work orders) and verify provider authorization
  5. Admin can manage parking inventory and assignments, view visitor parking and violations, manage moves (requests, checklists, deposits, sign-off), and moderate marketplace listings
**Plans**: 6 plans

Plans:
- [x] 14-01-PLAN.md -- Foundation: migrations (shift_handovers, provider_work_orders), native deps (NFC, GPS, haptics), query key factories, guard tab + admin sidebar updates
- [ ] 14-02-PLAN.md -- Guard patrol: route display, NFC checkpoint scanning, GPS validation, progress tracking
- [ ] 14-03-PLAN.md -- Guard incidents and handover: incident reports with media, timeline, follow-ups, shift handover notes
- [ ] 14-04-PLAN.md -- Guard emergency: persistent panic button, emergency type selection, alert dispatch, provider verification
- [ ] 14-05-PLAN.md -- Admin providers and work orders: company CRUD, documentation tracking, personnel, access schedules, work orders
- [ ] 14-06-PLAN.md -- Admin parking, moves, marketplace moderation: parking inventory, move workflow, deposit management, moderation queue

### Phase 15: Admin Governance & Analytics
**Goal**: Administrators can manage community governance (elections, assemblies, surveys), track violations, access emergency information, manage keys/devices, view guard performance, and review audit trails
**Depends on**: Phase 12 (admin operations foundation), Phase 14 (guard data for performance metrics)
**Requirements**: AGOV-01, AGOV-02, AGOV-03, AGOV-04, AGOV-05, ACONF-03, ACONF-04, ACONF-05, AVIOL-01, AVIOL-02, AVIOL-03, AVIOL-04, AEMRG-01, AEMRG-02, AEMRG-03, AKEY-01, AKEY-02, AKEY-03, AKEY-04
**Success Criteria** (what must be TRUE):
  1. Admin can create elections with voting rules, open/close voting, view real-time results with quorum tracking, and manage assemblies with coefficient-weighted attendance
  2. Admin can create surveys, view responses, and record assembly agreements and action items
  3. Admin can create violation records with evidence, issue warnings/sanctions, manage appeals, and view violation history with repeat offender tracking
  4. Admin can manage emergency contacts, view medical conditions and accessibility needs, generate evacuation priority lists, and manage access device inventory with assignments and lifecycle tracking
  5. Admin can view guard performance metrics (patrol completion, response times), view audit trail of administrative actions, and perform bulk operations (charge generation, notification sending)
**Plans**: 4 plans

Plans:
- [ ] 15-01-PLAN.md - Governance: elections with voting, assemblies with quorum, surveys, agreements
- [ ] 15-02-PLAN.md - Violations: records with evidence, warnings/sanctions, appeals, repeat offender tracking
- [ ] 15-03-PLAN.md - Emergency and keys: emergency contacts, medical info, evacuation lists, device inventory, assignments, lifecycle
- [ ] 15-04-PLAN.md - Analytics and audit: guard performance metrics, audit trail viewer, bulk operations

### Phase 16: Push Notifications & Real-time Polish
**Goal**: Users receive timely push notifications for all relevant events and see real-time updates for time-sensitive data like visitor arrivals and guard queues
**Depends on**: All previous phases (notification triggers exist across all features)
**Requirements**: PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05
**Success Criteria** (what must be TRUE):
  1. Mobile app registers for push notifications (FCM/APNs) on login and stores token correctly
  2. Users receive push notifications for visitor arrivals, payment status changes, maintenance updates, announcements, and package deliveries
  3. Visitor status updates (gate entry/exit) and guard expected visitors queue update in real-time via Supabase Realtime without page refresh
  4. Users can manage their notification preferences (which events, which channels)
**Plans**: 3 plans

Plans:
- [ ] 16-01-PLAN.md - Push notification infrastructure: FCM/APNs registration, token management, send-push edge function integration
- [ ] 16-02-PLAN.md - Notification delivery: event-driven push for all modules (visitors, payments, maintenance, announcements, packages)
- [ ] 16-03-PLAN.md - Real-time subscriptions and preferences: Supabase Realtime for visitor/guard queues, notification preference management

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Multi-Tenant Security | v1.0 | 3/3 | Complete | 2026-01-29 |
| 2. Identity & CRM | v1.0 | 3/3 | Complete | 2026-01-29 |
| 3. Access Control & Security | v1.0 | 4/4 | Complete | 2026-01-29 |
| 4. Financial Engine | v1.0 | 4/4 | Complete | 2026-01-29 |
| 5. Amenities, Communication & Marketplace | v1.0 | 5/5 | Complete | 2026-01-29 |
| 6. Maintenance, Chat, Documents & Notifications | v1.0 | 5/5 | Complete | 2026-01-30 |
| 7. Operations & Compliance | v1.0 | 5/5 | Complete | 2026-01-30 |
| 8. Governance & Analytics | v1.0 | 9/9 | Complete | 2026-01-30 |
| 9. Auth & Shared Infrastructure | v2.0 | 5/5 | Complete | 2026-02-08 |
| 10. Mobile Core — Resident Visitors/Payments + Guard Gate | v2.0 | 5/5 | Complete | 2026-02-08 |
| 11. Admin Dashboard Financial Core | v2.0 | 4/4 | Complete | 2026-02-08 |
| 12. Admin Dashboard Operations | v2.0 | 4/4 | Complete | 2026-02-08 |
| 13. Advanced Resident Features | v2.0 | 4/4 | Complete | 2026-02-08 |
| 14. Guard Advanced + Admin Providers/Parking/Moves | v2.0 | 1/6 | In progress | - |
| 15. Admin Governance & Analytics | v2.0 | 0/4 | Not started | - |
| 16. Push Notifications & Real-time Polish | v2.0 | 0/3 | Not started | - |

**v1.0 Total:** 38/38 plans -- COMPLETE
**v2.0 Total:** 23/35 plans

---
*Roadmap created: 2026-01-29*
*v2.0 phases added: 2026-02-07*
*Last updated: 2026-02-08*
