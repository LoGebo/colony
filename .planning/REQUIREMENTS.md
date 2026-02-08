# Requirements: UPOE v2.0 Frontend Applications

**Defined:** 2026-02-06
**Core Value:** Symbiosis operativa total — security, administration, community, and commerce unified in one ecosystem

## v1 Requirements

Requirements for React Native (Expo) mobile app + Next.js admin dashboard. Each maps to roadmap phases.

### 1. Auth & Onboarding

- [ ] **AUTH-01**: Invited resident can sign up via email link and create account
- [ ] **AUTH-02**: Invited guard can sign up via email link and create account
- [ ] **AUTH-03**: New admin can sign up, create organization and community via complete_admin_onboarding
- [ ] **AUTH-04**: User can log in with email and password on mobile and web
- [ ] **AUTH-05**: User session persists across app restart (mobile) and browser refresh (web)
- [ ] **AUTH-06**: JWT token auto-refreshes before expiry on both platforms
- [ ] **AUTH-07**: User sees role-appropriate navigation after login (resident tabs, guard tabs, admin sidebar)
- [ ] **AUTH-08**: User can log out from any screen
- [ ] **AUTH-09**: User can reset password via email link
- [ ] **AUTH-10**: Admin can invite residents and guards via email from dashboard

### 2. Resident — Home & Dashboard

- [ ] **RHOME-01**: Resident sees home dashboard with summary cards (balance, visitors, announcements, maintenance)
- [ ] **RHOME-02**: Dashboard cards link to their respective detail screens
- [ ] **RHOME-03**: Resident sees community branding (logo, name) on dashboard

### 3. Resident — Visitor Management

- [ ] **RVIS-01**: Resident can create single-use visitor invitation with name, date, time window
- [ ] **RVIS-02**: Resident can create recurring visitor invitation (e.g., housekeeper every Tuesday)
- [ ] **RVIS-03**: System generates QR code for each invitation
- [ ] **RVIS-04**: Resident can share QR invitation via WhatsApp
- [ ] **RVIS-05**: Resident sees list of active/pending visitors with real-time status updates
- [ ] **RVIS-06**: Resident receives push notification when visitor arrives at gate
- [ ] **RVIS-07**: Resident can cancel a pending invitation
- [ ] **RVIS-08**: Resident can view visitor history

### 4. Resident — Payments & Finance

- [ ] **RPAY-01**: Resident can view current account balance and charges breakdown
- [ ] **RPAY-02**: Resident can view payment history with dates and amounts
- [ ] **RPAY-03**: Resident can upload payment proof (photo of bank transfer receipt)
- [ ] **RPAY-04**: Resident can see payment proof status (pending, approved, rejected)
- [ ] **RPAY-05**: Resident receives push notification when payment is approved or rejected

### 5. Resident — Maintenance

- [ ] **RMAINT-01**: Resident can submit maintenance request with category, description, and photos
- [ ] **RMAINT-02**: Resident can view status timeline of their tickets
- [ ] **RMAINT-03**: Resident receives push notification on ticket status changes
- [ ] **RMAINT-04**: Resident can add comments to their tickets

### 6. Resident — Communication

- [ ] **RCOMM-01**: Resident can view announcements feed sorted by date
- [ ] **RCOMM-02**: Resident can mark announcements as read
- [ ] **RCOMM-03**: Resident receives push notification for new high-priority announcements
- [ ] **RCOMM-04**: Resident can view and post on community social wall
- [ ] **RCOMM-05**: Resident can react to and comment on social wall posts
- [ ] **RCOMM-06**: Resident can participate in surveys and vote on community decisions

### 7. Resident — Amenities

- [ ] **RAMEN-01**: Resident can browse amenity catalog with photos and rules
- [ ] **RAMEN-02**: Resident can view amenity availability on a calendar
- [ ] **RAMEN-03**: Resident can make a reservation for an available slot
- [ ] **RAMEN-04**: Resident can cancel a reservation
- [ ] **RAMEN-05**: Resident receives push notification for booking confirmation and reminders

### 8. Resident — Documents & Profile

- [ ] **RDOC-01**: Resident can view community documents (bylaws, minutes, reports)
- [ ] **RDOC-02**: Resident can view and sign regulations requiring signature
- [ ] **RPROF-01**: Resident can edit profile (phone, photo, emergency contacts)
- [ ] **RPROF-02**: Resident can view their unit assignment and occupancy details
- [ ] **RPROF-03**: Resident can manage their registered vehicles
- [ ] **RPROF-04**: Resident can view package notifications and pickup codes

### 9. Guard — Gate Operations

- [ ] **GGATE-01**: Guard can start shift and select active access point (gate)
- [ ] **GGATE-02**: Guard sees expected visitors queue for today at their gate, sorted by time
- [ ] **GGATE-03**: Guard can scan QR code and see instant verification result (approved/denied with details)
- [ ] **GGATE-04**: Guard can manually check in walk-in visitors (name, unit, vehicle, call resident)
- [ ] **GGATE-05**: Guard can log entry and exit with timestamp and method
- [ ] **GGATE-06**: Guard can search resident directory by unit number or name
- [ ] **GGATE-07**: Guard can search vehicles by license plate
- [ ] **GGATE-08**: Guard sees blacklist alert during visitor check-in if name/plate matches
- [ ] **GGATE-09**: Guard can capture visitor photo during check-in

### 10. Guard — Packages

- [ ] **GPKG-01**: Guard can log incoming package (carrier, recipient unit, photo of label)
- [ ] **GPKG-02**: System sends push notification to resident when package is received
- [ ] **GPKG-03**: Guard can verify pickup code and confirm package delivery
- [ ] **GPKG-04**: Guard can view pending packages list sorted by unit

### 11. Guard — Patrol & Incidents

- [ ] **GPATR-01**: Guard can view active patrol route with checkpoint sequence
- [ ] **GPATR-02**: Guard can scan NFC checkpoint tags during patrol
- [ ] **GPATR-03**: Guard can see patrol progress (scanned vs remaining checkpoints)
- [ ] **GINC-01**: Guard can create incident report with type, severity, description, and photos/video
- [ ] **GINC-02**: Guard can view incident timeline and add follow-up comments
- [ ] **GINC-03**: Guard can leave shift handover notes for incoming guard

### 12. Guard — Emergency & Safety

- [ ] **GEMRG-01**: Guard has persistent emergency panic button accessible from any screen
- [ ] **GEMRG-02**: Panic button triggers alert to admin, other guards, and generates incident record
- [ ] **GEMRG-03**: Guard can select emergency type (panic, fire, medical, intrusion)
- [ ] **GEMRG-04**: Guard can verify service providers against authorized schedules

### 13. Admin Dashboard — Financial

- [ ] **AFIN-01**: Admin sees financial overview dashboard with KPI cards (collection rate, delinquency rate, total collected, total owed)
- [ ] **AFIN-02**: Admin sees financial charts (monthly collection bar chart, delinquency trend line, expense pie chart)
- [ ] **AFIN-03**: Admin can view unit-by-unit balance report with sorting, filtering, and Excel export
- [ ] **AFIN-04**: Admin can approve or reject payment proofs with bulk operations
- [ ] **AFIN-05**: Admin can generate monthly charges for all units (coefficient-based, fixed, hybrid)
- [ ] **AFIN-06**: Admin can preview charge generation before applying
- [ ] **AFIN-07**: Admin can view delinquency analytics (30/60/90/120+ day aging, per-building breakdown, trends)
- [ ] **AFIN-08**: Admin can generate financial reports (income vs expense, budget vs actual)

### 14. Admin Dashboard — Residents & Units

- [ ] **ARES-01**: Admin can view, create, edit, and deactivate residents
- [ ] **ARES-02**: Admin can invite residents via email
- [ ] **ARES-03**: Admin can manage unit-resident occupancy (owner, tenant, authorized)
- [ ] **ARES-04**: Admin can view and manage all units with type, area, coefficient
- [ ] **ARES-05**: Admin can manage user roles and permissions

### 15. Admin Dashboard — Operations

- [ ] **AOPS-01**: Admin can view maintenance tickets in table or kanban view
- [ ] **AOPS-02**: Admin can assign tickets to staff or providers and update status
- [ ] **AOPS-03**: Admin can view SLA metrics (response time, resolution time)
- [ ] **AOPS-04**: Admin can create and schedule announcements with targeting (all, building, delinquent)
- [ ] **AOPS-05**: Admin can view announcement read receipts
- [ ] **AOPS-06**: Admin can view access log reports with date range and gate filters
- [ ] **AOPS-07**: Admin can export access logs to CSV
- [ ] **AOPS-08**: Admin can manage document repository (upload, categorize, set visibility)
- [ ] **AOPS-09**: Admin can manage amenities (create, edit, set rules and schedules)
- [ ] **AOPS-10**: Admin can view amenity utilization reports (booking rates, peak hours)

### 16. Admin Dashboard — Governance

- [ ] **AGOV-01**: Admin can create elections with options and voting rules
- [ ] **AGOV-02**: Admin can open/close voting and view real-time results with quorum tracking
- [ ] **AGOV-03**: Admin can manage assemblies (schedule, track attendance with coefficient-weighted quorum)
- [ ] **AGOV-04**: Admin can create surveys and view responses
- [ ] **AGOV-05**: Admin can record assembly agreements and action items

### 17. Admin Dashboard — Analytics & Configuration

- [ ] **ACONF-01**: Admin can configure community settings (name, branding, hours, rules)
- [ ] **ACONF-02**: Admin can manage feature flags per community
- [ ] **ACONF-03**: Admin can view guard performance metrics (patrol completion, response times)
- [ ] **ACONF-04**: Admin can view audit trail of administrative actions
- [ ] **ACONF-05**: Admin can perform bulk charge generation and bulk notification sending

### 18. Resident — Marketplace

- [ ] **RMRKT-01**: Resident can create listing (sale, service, rental, wanted) with photos and price
- [ ] **RMRKT-02**: Resident can browse and search marketplace listings by category
- [ ] **RMRKT-03**: Resident can view listing details and contact seller
- [ ] **RMRKT-04**: Resident can mark listing as sold/completed

### 19. Admin Dashboard — Marketplace Moderation

- [ ] **AMRKT-01**: Admin can view moderation queue of new/reported listings
- [ ] **AMRKT-02**: Admin can approve, reject, or remove listings
- [ ] **AMRKT-03**: Admin can manage marketplace categories

### 20. Admin Dashboard — Parking Management

- [ ] **APARK-01**: Admin can manage parking spot inventory (type, location, assigned unit)
- [ ] **APARK-02**: Admin can assign/unassign parking spots to units
- [ ] **APARK-03**: Admin can view visitor parking reservations
- [ ] **APARK-04**: Admin can view and manage parking violations

### 21. Admin Dashboard — Provider Management

- [ ] **APROV-01**: Admin can manage provider companies (contact, specialties, status)
- [ ] **APROV-02**: Admin can manage provider documentation (insurance, certifications, expiry tracking)
- [ ] **APROV-03**: Admin can manage provider personnel (authorized employees with photos)
- [ ] **APROV-04**: Admin can configure provider access schedules (allowed days/hours)
- [ ] **APROV-05**: Admin can create and track work orders

### 22. Admin Dashboard — Move-in/Move-out

- [ ] **AMOVE-01**: Admin can create and manage move requests (type, date, moving company)
- [ ] **AMOVE-02**: Admin can track pre-move validation checklist (debt-free, keys, vehicles)
- [ ] **AMOVE-03**: Admin can manage damage deposits (collection, deductions, refund)
- [ ] **AMOVE-04**: Admin can sign off move completion

### 23. Admin Dashboard — Keys & Devices

- [ ] **AKEY-01**: Admin can manage access device inventory (tags, remotes, keys, cards)
- [ ] **AKEY-02**: Admin can assign and track device assignments to units/residents
- [ ] **AKEY-03**: Admin can process device returns, transfers, and lost reports
- [ ] **AKEY-04**: Admin can track device replacement fees

### 24. Admin Dashboard — Violations & Emergency

- [ ] **AVIOL-01**: Admin can create and manage violation records with evidence
- [ ] **AVIOL-02**: Admin can issue warnings and sanctions (verbal, written, fine, suspension)
- [ ] **AVIOL-03**: Admin can manage violation appeals and resolutions
- [ ] **AVIOL-04**: Admin can view violation history with repeat offender tracking
- [ ] **AEMRG-01**: Admin can manage emergency contacts per resident
- [ ] **AEMRG-02**: Admin can view medical conditions and accessibility needs (privacy-controlled)
- [ ] **AEMRG-03**: Admin can generate evacuation priority list

### 25. Push Notifications & Real-time

- [ ] **PUSH-01**: Mobile app registers for push notifications (FCM/APNs) on login
- [ ] **PUSH-02**: User receives push for: visitor arrived, payment status, maintenance updates, announcements, packages
- [ ] **PUSH-03**: Real-time updates for visitor status (gate entry/exit) via Supabase Realtime
- [ ] **PUSH-04**: Real-time updates for guard expected visitors queue
- [ ] **PUSH-05**: User can manage notification preferences

### 26. Shared Infrastructure

- [ ] **INFRA-01**: Monorepo shared package provides typed Supabase client, query key factories, and Zod validators
- [ ] **INFRA-02**: Mobile app uses Expo Router with role-based navigation (resident/guard/admin tab groups)
- [ ] **INFRA-03**: Admin dashboard uses Next.js App Router with sidebar navigation and role-based layouts
- [ ] **INFRA-04**: Both apps share TanStack Query hooks for data fetching with caching and optimistic updates
- [ ] **INFRA-05**: File upload utility for photos (payment proofs, incidents, packages, profiles) using Supabase Storage
- [ ] **INFRA-06**: All UI designs use frontend-design skill for distinctive, production-grade interfaces

## v2 Requirements

Deferred to future milestones. Not in current roadmap.

### In-App Chat
- **CHAT-01**: Resident-to-admin direct messaging
- **CHAT-02**: Guard-to-guard coordination chat
- **CHAT-03**: Guard booth shift chat

### Offline & Sync
- **OFFL-01**: Guard app works offline with cached visitor data
- **OFFL-02**: PowerSync integration for offline-first sync
- **OFFL-03**: Offline mutation queue with conflict resolution

### Payment Gateway
- **PGWY-01**: In-app payment via Stripe/SPEI
- **PGWY-02**: Automatic payment matching

### Advanced Features
- **ADV-01**: Biometric authentication (Face ID / Touch ID)
- **ADV-02**: Multi-community switching
- **ADV-03**: Financial reports suite (balance sheet, cash flow)
- **ADV-04**: White-label theming engine
- **ADV-05**: Multi-language i18n

## Out of Scope

| Feature | Reason |
|---------|--------|
| LPR camera integration | Requires hardware partnerships, IoT scope |
| Facial recognition | Privacy concerns, ML infrastructure |
| AI chatbot / ML predictions | Needs usage data first, premature |
| Full accounting system | UPOE is property management, not QuickBooks |
| Real-time video monitoring | Requires video infrastructure, RTSP streaming |
| IoT device management (smart locks) | Hardware integration, separate milestone |
| CRM for sales/rentals | Different product category |

## Traceability

Updated during roadmap creation. Phase numbers continue from v1.0 (phases 1-8).

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 9 | Pending |
| AUTH-02 | Phase 9 | Pending |
| AUTH-03 | Phase 9 | Pending |
| AUTH-04 | Phase 9 | Pending |
| AUTH-05 | Phase 9 | Pending |
| AUTH-06 | Phase 9 | Pending |
| AUTH-07 | Phase 9 | Pending |
| AUTH-08 | Phase 9 | Pending |
| AUTH-09 | Phase 9 | Pending |
| AUTH-10 | Phase 9 | Pending |
| INFRA-01 | Phase 9 | Pending |
| INFRA-02 | Phase 9 | Pending |
| INFRA-03 | Phase 9 | Pending |
| INFRA-04 | Phase 9 | Pending |
| INFRA-05 | Phase 9 | Pending |
| INFRA-06 | Phase 9 | Pending |
| RHOME-01 | Phase 10 | Pending |
| RHOME-02 | Phase 10 | Pending |
| RHOME-03 | Phase 10 | Pending |
| RVIS-01 | Phase 10 | Pending |
| RVIS-02 | Phase 10 | Pending |
| RVIS-03 | Phase 10 | Pending |
| RVIS-04 | Phase 10 | Pending |
| RVIS-05 | Phase 10 | Pending |
| RVIS-06 | Phase 10 | Pending |
| RVIS-07 | Phase 10 | Pending |
| RVIS-08 | Phase 10 | Pending |
| RPAY-01 | Phase 10 | Pending |
| RPAY-02 | Phase 10 | Pending |
| RPAY-03 | Phase 10 | Pending |
| RPAY-04 | Phase 10 | Pending |
| RPAY-05 | Phase 10 | Pending |
| GGATE-01 | Phase 10 | Pending |
| GGATE-02 | Phase 10 | Pending |
| GGATE-03 | Phase 10 | Pending |
| GGATE-04 | Phase 10 | Pending |
| GGATE-05 | Phase 10 | Pending |
| GGATE-06 | Phase 10 | Pending |
| GGATE-07 | Phase 10 | Pending |
| GGATE-08 | Phase 10 | Pending |
| GGATE-09 | Phase 10 | Pending |
| GPKG-01 | Phase 10 | Pending |
| GPKG-02 | Phase 10 | Pending |
| GPKG-03 | Phase 10 | Pending |
| GPKG-04 | Phase 10 | Pending |
| AFIN-01 | Phase 11 | Pending |
| AFIN-02 | Phase 11 | Pending |
| AFIN-03 | Phase 11 | Pending |
| AFIN-04 | Phase 11 | Pending |
| AFIN-05 | Phase 11 | Pending |
| AFIN-06 | Phase 11 | Pending |
| AFIN-07 | Phase 11 | Pending |
| AFIN-08 | Phase 11 | Pending |
| ARES-01 | Phase 11 | Pending |
| ARES-02 | Phase 11 | Pending |
| ARES-03 | Phase 11 | Pending |
| ARES-04 | Phase 11 | Pending |
| ARES-05 | Phase 11 | Pending |
| ACONF-01 | Phase 11 | Pending |
| ACONF-02 | Phase 11 | Pending |
| AOPS-01 | Phase 12 | Pending |
| AOPS-02 | Phase 12 | Pending |
| AOPS-03 | Phase 12 | Pending |
| AOPS-04 | Phase 12 | Pending |
| AOPS-05 | Phase 12 | Pending |
| AOPS-06 | Phase 12 | Pending |
| AOPS-07 | Phase 12 | Pending |
| AOPS-08 | Phase 12 | Pending |
| AOPS-09 | Phase 12 | Pending |
| AOPS-10 | Phase 12 | Pending |
| RMAINT-01 | Phase 12 | Pending |
| RMAINT-02 | Phase 12 | Pending |
| RMAINT-03 | Phase 12 | Pending |
| RMAINT-04 | Phase 12 | Pending |
| RCOMM-01 | Phase 12 | Pending |
| RCOMM-02 | Phase 12 | Pending |
| RCOMM-03 | Phase 12 | Pending |
| RCOMM-04 | Phase 13 | Pending |
| RCOMM-05 | Phase 13 | Pending |
| RCOMM-06 | Phase 13 | Pending |
| RAMEN-01 | Phase 13 | Pending |
| RAMEN-02 | Phase 13 | Pending |
| RAMEN-03 | Phase 13 | Pending |
| RAMEN-04 | Phase 13 | Pending |
| RAMEN-05 | Phase 13 | Pending |
| RDOC-01 | Phase 13 | Pending |
| RDOC-02 | Phase 13 | Pending |
| RPROF-01 | Phase 13 | Pending |
| RPROF-02 | Phase 13 | Pending |
| RPROF-03 | Phase 13 | Pending |
| RPROF-04 | Phase 13 | Pending |
| RMRKT-01 | Phase 13 | Pending |
| RMRKT-02 | Phase 13 | Pending |
| RMRKT-03 | Phase 13 | Pending |
| RMRKT-04 | Phase 13 | Pending |
| GPATR-01 | Phase 14 | Pending |
| GPATR-02 | Phase 14 | Pending |
| GPATR-03 | Phase 14 | Pending |
| GINC-01 | Phase 14 | Pending |
| GINC-02 | Phase 14 | Pending |
| GINC-03 | Phase 14 | Pending |
| GEMRG-01 | Phase 14 | Pending |
| GEMRG-02 | Phase 14 | Pending |
| GEMRG-03 | Phase 14 | Pending |
| GEMRG-04 | Phase 14 | Pending |
| APROV-01 | Phase 14 | Pending |
| APROV-02 | Phase 14 | Pending |
| APROV-03 | Phase 14 | Pending |
| APROV-04 | Phase 14 | Pending |
| APROV-05 | Phase 14 | Pending |
| APARK-01 | Phase 14 | Pending |
| APARK-02 | Phase 14 | Pending |
| APARK-03 | Phase 14 | Pending |
| APARK-04 | Phase 14 | Pending |
| AMOVE-01 | Phase 14 | Pending |
| AMOVE-02 | Phase 14 | Pending |
| AMOVE-03 | Phase 14 | Pending |
| AMOVE-04 | Phase 14 | Pending |
| AMRKT-01 | Phase 14 | Pending |
| AMRKT-02 | Phase 14 | Pending |
| AMRKT-03 | Phase 14 | Pending |
| AGOV-01 | Phase 15 | Pending |
| AGOV-02 | Phase 15 | Pending |
| AGOV-03 | Phase 15 | Pending |
| AGOV-04 | Phase 15 | Pending |
| AGOV-05 | Phase 15 | Pending |
| ACONF-03 | Phase 15 | Pending |
| ACONF-04 | Phase 15 | Pending |
| ACONF-05 | Phase 15 | Pending |
| AVIOL-01 | Phase 15 | Pending |
| AVIOL-02 | Phase 15 | Pending |
| AVIOL-03 | Phase 15 | Pending |
| AVIOL-04 | Phase 15 | Pending |
| AEMRG-01 | Phase 15 | Pending |
| AEMRG-02 | Phase 15 | Pending |
| AEMRG-03 | Phase 15 | Pending |
| AKEY-01 | Phase 15 | Pending |
| AKEY-02 | Phase 15 | Pending |
| AKEY-03 | Phase 15 | Pending |
| AKEY-04 | Phase 15 | Pending |
| PUSH-01 | Phase 16 | Pending |
| PUSH-02 | Phase 16 | Pending |
| PUSH-03 | Phase 16 | Pending |
| PUSH-04 | Phase 16 | Pending |
| PUSH-05 | Phase 16 | Pending |

**Coverage:**
- v1 requirements: 145 total
- Mapped to phases: 145
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-07 -- traceability complete, all 145 requirements mapped*
