# Project Research Summary

**Project:** UPOE v2.0 - Frontend Applications
**Domain:** Gated Community Property Management (Mobile + Web Admin)
**Researched:** 2026-02-06
**Confidence:** HIGH

## Executive Summary

UPOE v2.0 builds React Native (Expo SDK 54) mobile app and Next.js 16 admin dashboard on top of a fully complete Supabase backend (116 tables, 399 RLS policies, 206 functions). This is a frontend-focused milestone consuming an existing, production-ready backend. The recommended approach leverages Expo Router for role-based mobile navigation (6 roles: resident, guard, admin, manager, provider, super_admin), Next.js App Router with server components for the admin dashboard, and TanStack Query v5 as the universal data layer across both platforms.

The critical architectural decision is **separation of concerns**: The @upoe/shared package provides types, constants, validation schemas, and query key factories, but each platform creates its own Supabase client with platform-specific auth storage (expo-sqlite for mobile, cookies via @supabase/ssr for web). This prevents the single most common pitfall — using the wrong auth configuration across platforms.

The key risk is auth misconfiguration causing session loss. The mitigation strategy is to build auth infrastructure FIRST in both apps before any feature code, verify token persistence across app restarts (mobile) and automatic token refresh via middleware (web), and enforce role-based access via RLS policies (not just frontend route guards).

## Key Findings

### Recommended Stack (from STACK.md)

Mobile and web share data-layer libraries but diverge on platform-specific concerns. The shared foundation (Supabase client, TanStack Query, Zustand, React Hook Form, Zod v4) provides consistency. Platform-specific choices (NativeWind vs shadcn/ui, expo-sqlite vs cookie storage) respect each platform's strengths.

**Core technologies:**
- **Expo SDK 54** with React Native 0.81 and Expo Router v4 — Stable SDK with file-based routing, Stack.Protected for declarative role-based navigation
- **Next.js 16** with React 19.2 and App Router — Server Components for initial data fetching, client components for interactivity
- **TanStack Query v5** — Universal server-state management for both platforms with caching, optimistic updates, background refetch
- **Zustand v5** — Lightweight client state (UI preferences, auth context) to complement TanStack Query
- **NativeWind 4.1** (mobile) + **Tailwind CSS 4** (web) — Shared utility-class vocabulary, divergent implementations
- **shadcn/ui** (web) — Component library built on Radix UI with Tailwind 4 support
- **Zod v4** + **React Hook Form** — Shared validation schemas across platforms with type inference
- **expo-sqlite** (mobile storage) + **@supabase/ssr** (web cookies) — Platform-appropriate auth session persistence

**Critical upgrade:** @supabase/supabase-js from 2.49.1 to 2.95+ in @upoe/shared for latest auth improvements.

### Expected Features (from FEATURES.md)

Research identified feature priorities across three distinct user experiences: resident mobile app, guard mobile app, and admin web dashboard.

**Must have (table stakes for MVP):**
- **Resident app:** Auth + onboarding, home dashboard, visitor pre-registration with QR codes, account balance + payment history, payment proof upload, maintenance requests, announcements feed, push notifications
- **Guard app:** Auth + shift selection, expected visitors queue, QR scanner with instant verification, manual check-in, entry/exit logging, resident directory lookup, package reception, emergency panic button
- **Admin dashboard:** Auth + setup, financial overview with KPIs, unit-by-unit balance report, payment approval workflow, charge generation, resident/unit management, maintenance ticket dashboard, announcement creator, access log reports, community settings

**Should have (competitive differentiators):**
- **QR code WhatsApp sharing** — Deep integration with WhatsApp (dominant in Mexico)
- **Real-time visitor status updates** — Live gate entry notifications via Supabase Realtime
- **Guard performance analytics** — Patrol completion, response times (no Mexico competitor has this)
- **Delinquency analytics** — Aging reports, collection rate trends (Mexican HOA admins need this)
- **Community social wall** — Engagement beyond transactions (inspired by TownSq success pattern)

**Defer (v2.1 - v3.0):**
- Amenity reservations (needs admin amenity management first)
- NFC patrol checkpoints (needs route configuration)
- Survey/voting with coefficient weighting (needs assembly season trigger)
- Marketplace (needs active community engagement baseline)
- Payment gateway integration (Stripe/SPEI compliance)
- Offline-first sync with PowerSync

### Architecture Approach (from ARCHITECTURE.md)

The architecture uses platform-native patterns rather than shared UI abstraction layers.

**Major components:**
1. **@upoe/shared** — Pure TypeScript: Database types (393KB generated), Supabase client constants, role checks, query key factories, Zod validators, i18n translation files. Zero runtime platform dependencies.
2. **@upoe/mobile (Expo)** — File-based routing with role-specific route groups ((auth), (resident), (guard), (admin)). Stack.Protected for declarative auth guards. expo-sqlite for auth storage. TanStack Query hooks for data. Platform-specific Supabase client.
3. **@upoe/admin (Next.js)** — App Router with server/client component split. Server components fetch initial data, client components hydrate with initialData for interactivity. Middleware refreshes JWT on every request. Cookie-based sessions via @supabase/ssr.

**Critical patterns:**
- **Dual auth strategy:** Mobile uses expo-sqlite + AppState listeners for token refresh. Web uses @supabase/ssr middleware with getClaims() (not getSession()) for verified JWT validation.
- **Role-based navigation:** Expo Router's Stack.Protected renders different tab groups based on app_metadata.role from JWT. Next.js uses route group layouts for role gates.
- **State separation:** TanStack Query manages ALL server state (residents, payments, visitors). Zustand manages ONLY client state (UI prefs, form drafts).
- **Realtime with cache invalidation:** Subscribe per-screen, invalidate TanStack Query cache keys on events, clean up with removeChannel() in useEffect return.

### Critical Pitfalls (from PITFALLS.md)

**Top 5 pitfalls that break auth, security, or cause rewrites:**

1. **Using getSession() on server instead of getClaims()/getUser()** — Server code trusts unverified JWT from cookies. Attacker can forge tokens. ALWAYS use getClaims() (fast, locally verified) or getUser() (full server validation) in Next.js Server Components, middleware, and route handlers.

2. **Shared Supabase client with wrong platform config** — Mobile and web require fundamentally different auth configurations (detectSessionInUrl: false for mobile, cookie handlers for web). Each platform MUST create its own client. @upoe/shared provides types only.

3. **Missing Next.js middleware for token refresh** — Without middleware calling getClaims() on every request, tokens expire after 1 hour and users are logged out. Server Components cannot write cookies. Middleware MUST refresh tokens.

4. **Realtime subscription memory leaks** — Channels created in useEffect but not cleaned up. React 19 Strict Mode double-invokes effects. MUST use supabase.removeChannel(channel) in cleanup, not just unsubscribe().

5. **Frontend-only role authorization** — Hiding buttons based on role without enforcing via RLS policies. Attacker with resident JWT can query admin-only data directly. RLS policies MUST check app_metadata.role, not just community_id.

## Implications for Roadmap

Based on combined research, the frontend milestone should be structured into phases that build auth foundation first, then layer features that depend on it.

### Phase 1: Monorepo + Auth Foundation
**Rationale:** Authentication is the universal dependency. Every feature needs to know who the user is and what role they have. Building auth incorrectly forces a complete rewrite. This phase establishes the platform-specific auth patterns that all features will consume.

**Delivers:**
- Monorepo workspace configuration (pnpm workspaces with packages/* and apps/*)
- @upoe/shared package extensions (query keys, Zod validators, type subsets)
- Mobile: Expo Router file-based routing with role-based route groups, expo-sqlite auth storage, AppState token refresh
- Web: Next.js App Router with middleware token refresh, @supabase/ssr server/client setup, route group layouts
- Auth screens: sign-in, sign-up (with OTP verification — more reliable than magic links in Mexico)

**Addresses:**
- Pitfall 1 (getClaims vs getSession) — enforced from day one
- Pitfall 2 (shared client config) — solved by separating client creation per platform
- Pitfall 3 (missing middleware) — middleware is first file created in Next.js app
- Pitfall 5 (frontend-only auth) — audit existing RLS for role enforcement, add missing policies
- Pitfall 8 (SecureStore limit) — use expo-sqlite storage from start

**Research flag:** SKIP — auth patterns well-documented in official Supabase + Expo + Next.js docs

---

### Phase 2: Mobile Core UX (Resident + Guard)
**Rationale:** Visitor management is the #1 daily-use feature for residents and the primary work screen for guards. These are tightly coupled (resident creates invitation, guard verifies it) so they must be built together. This phase delivers immediate value — replacing WhatsApp-based visitor coordination.

**Delivers:**
- Resident screens: Home dashboard, visitor invitation creation with QR generation, active visitor list, payment balance view, maintenance request submission
- Guard screens: Expected visitors queue, QR scanner with instant validation, manual check-in form, resident/unit directory search, emergency panic button (FAB on all screens)
- Shared: TanStack Query hooks (useVisitors, useAccessLogs, useResidents, usePayments), Realtime subscription management utility
- Push notification registration + token storage

**Addresses:**
- Features: Table stakes resident experience + core guard workflow
- Pitfall 4 (Realtime leaks) — build subscription utility with proper cleanup before any feature uses Realtime
- Pitfall 9 (file uploads) — build shared upload utility for QR code generation and profile photos
- Pitfall 10 (deep linking) — configure for push notification deep links

**Research flag:** SKIP — Expo camera, QR generation, TanStack Query patterns are well-documented

---

### Phase 3: Admin Dashboard Financial Core
**Rationale:** Financial oversight is the #1 reason admins use the platform. Residents submit payment proofs in Phase 2; this phase builds the admin approval workflow and KPI dashboards. The database already has KPI summary tables (Phase 8) and double-entry ledger — frontend just needs to visualize them.

**Delivers:**
- Financial overview dashboard with KPIs (collection rate, delinquency rate, charts)
- Unit-by-unit balance report (DataTable with sorting, filtering, export)
- Payment proof approval queue with bulk operations
- Charge generation interface (monthly fees with coefficient support)
- Resident and unit management (CRUD, invite workflow)
- Community settings and branding configuration

**Addresses:**
- Features: Admin table stakes — financial + resident management
- Pitfall 7 (large types file) — create admin-specific type subset with Pick<> for faster TypeScript
- Architecture: Server component data fetching pattern with initialData hydration to client DataTable

**Research flag:** SKIP — shadcn/ui DataTable, Recharts for KPI charts, TanStack Table are well-documented

---

### Phase 4: Admin Dashboard Operations
**Rationale:** With financials working, admins need operational oversight — maintenance tickets, access logs, announcements. These consume data created by mobile users in Phase 2.

**Delivers:**
- Maintenance ticket dashboard (kanban or table view, assignment, status tracking)
- Access log viewer with filters (date range, gate, visitor type, export to CSV)
- Announcement creator with targeting (all residents, specific buildings, delinquent units)
- Document repository (bylaws, assembly minutes, financial reports)
- User and role management (invite guards, assign permissions)

**Addresses:**
- Features: Admin operational tools
- Architecture: Server components for list views, client components for filters/interactions

**Research flag:** SKIP — standard CRUD patterns

---

### Phase 5: Advanced Mobile Features (Resident)
**Rationale:** With core visitor/payment flows working, add engagement features that increase daily usage.

**Delivers:**
- Amenity reservation with calendar UI (after admin amenity management in Phase 4)
- Community social wall (posts, reactions, comments)
- Document access (view community documents uploaded by admin)
- In-app notifications feed (consume push_tokens and notifications tables)
- Profile management (emergency contacts, vehicle registration)

**Addresses:**
- Features: Resident differentiators (social wall, amenities)
- Architecture: Realtime for social wall updates

**Research flag:** MODERATE for social wall — UGC moderation patterns, flagging system, admin review workflow

---

### Phase 6: Guard Advanced Features
**Rationale:** Basic gate operations work in Phase 2. This phase adds patrol and incident management for communities with larger perimeters.

**Delivers:**
- NFC patrol checkpoint scanning (tap-to-log patrol rounds)
- Incident reporting with photo/video capture
- Package management (reception, notification, pickup confirmation)
- Shift handover notes (outgoing guard leaves notes for incoming)
- Vehicle quick-search by license plate
- Blacklist alerts (automatic cross-check during check-in)

**Addresses:**
- Features: Guard differentiators (no Mexico competitor has robust patrol/incident tools)
- Pitfall 9 (file uploads) — incident evidence photos

**Research flag:** LOW for NFC (Expo has expo-nfc, straightforward), HIGH for incident workflow (evidence chain-of-custody, admin review, resolution tracking)

---

### Phase 7: Admin Analytics & Governance
**Rationale:** Data accumulation from Phases 2-6 enables analytics and governance features. These are assembly-season triggers (typically once or twice per year in Mexican HOAs).

**Delivers:**
- Delinquency analytics (aging reports, collection trends, automated letters)
- Guard performance dashboard (patrol completion, response times, shift coverage)
- Amenity utilization reports (booking rates, peak hours, cancellation trends)
- Survey and voting management (create polls, collect votes, calculate quorum with coefficient weighting per Mexican law)
- Assembly attendance tracking with proxy delegation
- Audit trail viewer (admin action log with who/what/when)

**Addresses:**
- Features: Admin differentiators (analytics no competitor offers)
- Architecture: Use pre-computed KPI tables from Phase 8 database

**Research flag:** HIGH for governance — Mexican condominium law requirements for voting (weighted by coefficient), quorum calculation, proxy rules, assembly minutes

---

### Phase 8: Polish & Platform Features
**Rationale:** Core functionality complete. This phase adds platform-specific niceties and prepares for scale.

**Delivers:**
- Biometric authentication (Touch ID / Face ID for mobile)
- Offline support (TanStack Query persistence plugin, mutation queue)
- Deep linking full configuration (notification tap -> specific screen)
- i18n infrastructure (prepare for English expansion, though MVP is Spanish-only)
- Performance optimization (FlashList for large tables, React Compiler for Next.js)
- Admin integration configuration UI (webhooks, API keys for third-party tools)

**Addresses:**
- UX pitfalls: offline indicator, pull-to-refresh
- Performance traps: virtualized lists, paginated queries

**Research flag:** MODERATE for offline — PowerSync integration patterns, conflict resolution strategies

---

### Phase Ordering Rationale

**Why this sequence:**

1. **Auth first (Phase 1)** — Universal dependency. Wrong auth config forces complete rewrite. Research shows this is the #1 failure point.

2. **Mobile before admin dashboard (Phases 2 before 3-4)** — Residents and guards create the data (visitors, payments, incidents). Admins view and approve it. Building admin first creates empty state UI with no data to test against.

3. **Core features before advanced (Phases 2-4 before 5-7)** — Table stakes must work before differentiators. Cannot test amenity reservations without amenity management UI.

4. **Financial before operational (Phase 3 before 4)** — Admin retention depends on financial visibility. Resident retention depends on visitor management. Financial is higher priority per competitor analysis.

5. **Features before analytics (Phases 2-6 before 7)** — Analytics require data accumulation. Guard performance dashboard needs weeks of shift data to visualize.

6. **Polish last (Phase 8)** — Core functionality must be stable before adding offline support or performance optimization.

**Dependency chains identified:**
- Visitor invitation (resident) + QR verification (guard) = same phase
- Payment proof upload (resident) + approval (admin) = consecutive phases
- Amenity creation (admin Phase 4) -> amenity reservation (resident Phase 5)
- Data entry features (Phases 2-6) -> analytics (Phase 7)

### Research Flags

**Phases needing `/gsd:research-phase` during planning:**

- **Phase 5 (Social Wall):** UGC moderation patterns, flagging system, content policies for gated community context
- **Phase 6 (Incidents):** Evidence chain-of-custody, legal requirements for incident documentation in Mexico
- **Phase 7 (Governance):** Mexican condominium law requirements for assemblies, voting, quorum calculation
- **Phase 8 (Offline):** PowerSync vs TanStack Query persistence trade-offs, conflict resolution strategies

**Phases with standard patterns (skip research):**

- **Phase 1 (Auth):** Extensively documented in Supabase + Expo + Next.js official docs
- **Phase 2 (Mobile Core):** Standard CRUD with TanStack Query, well-documented camera/QR patterns
- **Phase 3 (Admin Financial):** Standard dashboard patterns, shadcn/ui DataTable docs are comprehensive
- **Phase 4 (Admin Ops):** Standard CRUD and reporting, no novel patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified via npm registry + official docs. Version compatibility matrix cross-checked. Expo SDK 54 stable, Next.js 16 stable, Supabase SSR 0.8+ stable. |
| Features | HIGH | Cross-referenced 15+ competitor platforms (ComunidadFeliz, Neivor, Condo Control, TownSq). Mexico market patterns validated. Table stakes vs differentiators clearly identified. |
| Architecture | HIGH | Expo Router Stack.Protected, Next.js App Router SSR, TanStack Query patterns all verified in official docs. Monorepo patterns confirmed via byCedric expo-monorepo-example. |
| Pitfalls | HIGH | All 12 critical/moderate pitfalls sourced from official Supabase/Expo/Next.js docs + verified GitHub issues. Recovery strategies tested in community discussions. |

**Overall confidence:** HIGH

### Gaps to Address

**During planning:**

1. **Mexican legal requirements for governance features (Phase 7)** — Assembly voting, quorum rules, proxy delegation are governed by Mexican condominium law. Research during Phase 7 planning will need to consult legal resources, not just technical docs.

2. **Offline conflict resolution strategy (Phase 8)** — PowerSync (native Supabase integration) vs TanStack Query persistence (simpler but less robust). Decision point: How much offline capability is actually needed vs nice-to-have? Guards need more offline capability than residents. May warrant splitting into Guard Offline (Phase 6) and Resident Offline (Phase 8).

3. **Social wall moderation scope (Phase 5)** — UGC in a gated community has different dynamics than public social media. Research needed: Do admins pre-approve posts? Auto-flag keywords? React to reports only? Mexican cultural norms around community discourse?

4. **Payment gateway integration complexity (deferred to v3.0)** — SPEI direct bank transfers dominate Mexican HOA payments (not credit cards). When building payment gateway, research Mexican fintech APIs (Stripe Mexico, Conekta, OpenPay) and PCI compliance for storing bank account info.

**During implementation:**

5. **393KB database types file (Pitfall 7) — Developer experience impact** — While recovery strategy (type subsets with Pick<>) is documented, actual DX impact should be measured in Phase 1. If IDE lag is unacceptable despite subsets, consider generating per-app type files via custom Supabase CLI wrapper.

6. **Guard app offline needs vs resident app offline needs** — Guards working in areas with poor signal need offline more than residents (who are usually on WiFi at home). Consider prioritizing guard offline in Phase 6, deferring resident offline to Phase 8.

## Sources

### Primary (HIGH confidence)

**Stack:**
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [Supabase Next.js SSR Setup](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [TanStack Query React Native Docs](https://tanstack.com/query/v5/docs/framework/react/react-native)
- npm registry verifications for all packages

**Features:**
- [ComunidadFeliz Platform](https://www.comunidadfeliz.mx/)
- [Neivor Mexico Market Analysis](https://blog.neivor.com/9-apps-administracion-de-condominios-en-mexico)
- [Condo Control Feature Comparison](https://www.condocontrol.com/blog/top-5-hoa-management-software/)
- [TownSq Community Engagement Platform](https://www.townsq.io)

**Architecture:**
- [Expo Router Protected Routes](https://docs.expo.dev/router/advanced/protected/)
- [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/)
- [Next.js App Router Layouts](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

**Pitfalls:**
- [getClaims vs getUser Discussion](https://github.com/supabase/supabase/issues/40985)
- [Realtime Memory Leak Issue](https://github.com/supabase/supabase-js/issues/1204)
- [Token Refresh Race Conditions](https://github.com/supabase/supabase/issues/18981)
- [Expo SecureStore Size Limit](https://github.com/expo/expo/issues/1765)

### Secondary (MEDIUM confidence)

- [byCedric expo-monorepo-example](https://github.com/byCedric/expo-monorepo-example) — Monorepo reference architecture
- [Expo SDK 54 Upgrade Experience](https://medium.com/elobyte-software/what-breaks-after-an-expo-54-reactnative-0-81-15cb83cdb248) — Community upgrade report
- [pnpm + Expo Workspaces Config](https://dev.to/isaacaddis/working-expo-pnpm-workspaces-configuration-4k2l) — Working configuration example

### Tertiary (LOW confidence — needs validation)

- [Supabase Middleware Performance](https://github.com/supabase/supabase/issues/30241) — Discussion of middleware latency impact (conflicting opinions)
- [NativeWind + SDK 54 Compatibility](https://medium.com/@matthitachi/nativewind-styling-not-working-with-expo-sdk-54-54488c07c20d) — Anecdotal issue report

---

*Research completed: 2026-02-06*
*Ready for roadmap: yes*
*Files synthesized: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
