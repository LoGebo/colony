# UPOE - Unified Property Operations Ecosystem

## What This Is

A multi-tenant SaaS platform for managing gated residential communities (fraccionamientos, condominios, parques logisticos, desarrollos mixtos). Unifies security operations, financial management, resident services, community communication, amenities, marketplace, and maintenance into a single ecosystem with offline-first architecture.

## Core Value

**Symbiosis operativa total:** Security feeds administration with real-time data, administration defines rules that govern security, community generates information that enriches both flows, and local commerce is empowered with trust infrastructure.

## Current Milestone: v2.0 Frontend Applications

**Goal:** Build the React Native (Expo) mobile app and Next.js admin dashboard that consume the complete Supabase backend, delivering working applications for residents, guards, and administrators.

**Target features:**
- Auth flows (sign up, login, onboarding) for all user roles
- Resident mobile experience (dashboard, visitors, payments, amenities, community)
- Guard mobile experience (access control, visitor verification, patrols, incidents)
- Admin web dashboard (community management, financial overview, reports, configuration)
- Real-time notifications and push alerts
- Shared UI component library across apps

**Technical foundation (already in place):**
- Monorepo: `packages/shared` (types, Supabase client), `packages/mobile` (Expo 54), `packages/admin` (Next.js 16)
- Supabase backend: 116 tables, 399 RLS policies, 206 functions, 8 storage buckets, 3 edge functions
- Auth triggers: `handle_new_user`, `complete_admin_onboarding`
- Generated TypeScript types (393KB database.types.ts)

**Design approach:** Use `frontend-design` skill for all UI/screen designs to ensure distinctive, production-grade interfaces.

## Requirements

### Validated

- ✓ Multi-tenant schema with Row Level Security (RLS) — v1.0 DB milestone
- ✓ Community/property isolation with shared infrastructure — v1.0
- ✓ Complete entity model for all modules (116 tables) — v1.0
- ✓ Offline-sync compatible data structures — v1.0
- ✓ Audit trail and soft-delete patterns — v1.0
- ✓ Guard profiles, shifts, assignments — v1.0
- ✓ Access points, visitor invitations, QR signatures — v1.0
- ✓ Access logs, blacklist, patrol routes, emergency alerts — v1.0
- ✓ Units, residents, vehicles, pets, onboarding — v1.0
- ✓ Fee structures, charges, payments, double-entry ledger — v1.0
- ✓ Bank reconciliation, payment proofs, delinquency — v1.0
- ✓ Amenity catalog, reservations, booking rules, waitlist — v1.0
- ✓ Social wall, forums, announcements, surveys — v1.0
- ✓ Marketplace listings, exchange zones, moderation — v1.0
- ✓ Maintenance tickets, SLA tracking, assets, providers — v1.0
- ✓ Document repository, signatures, assembly minutes — v1.0
- ✓ Chat/messaging, notifications, push tokens — v1.0
- ✓ Package management, parking, keys/devices — v1.0
- ✓ Incidents, elections, assemblies, violations — v1.0
- ✓ Analytics KPIs, integrations, webhooks, API keys — v1.0
- ✓ Auth triggers (handle_new_user, complete_admin_onboarding) — v1.0
- ✓ Storage buckets with RLS (8 buckets) — v1.0
- ✓ Edge functions (verify-qr, send-push, payment-webhook) — v1.0
- ✓ Seed data (demo org, community, units, residents, guards) — v1.0

### Active

**Frontend Applications (Current Focus):**
- [ ] React Native (Expo) mobile app for residents, guards, admins
- [ ] Next.js admin web dashboard
- [ ] Shared component library and design system
- [ ] Auth flows for all user roles
- [ ] Real-time features (notifications, push, live updates)

### Out of Scope

- IoT hardware integration code — DB schema only for now
- AI/ML model training — schema supports it, implementation later
- PowerSync offline-first sync — future milestone, online-first for v2.0
- Payment gateway integration (Stripe) — schema exists, gateway later
- LPR camera integration — hardware partnership needed
- White-label theming engine — basic branding only
- Multi-language i18n — single language (Spanish) first

## Context

**Technical Environment:**
- Supabase as backend (Postgres + Auth + Storage + Edge Functions)
- Supabase auto-API (PostgREST) — no custom API needed
- Monorepo with pnpm workspaces
- @upoe/shared package with typed Supabase client, constants, type helpers
- React Native with Expo 54 (managed workflow)
- Next.js 16 with Tailwind CSS 4
- 393KB auto-generated TypeScript types from 116-table schema

**Backend State (fully configured):**
- 128+ migrations applied
- 399 RLS policies enforcing community_id isolation
- 206 database functions for business logic
- Auth: handle_new_user trigger, complete_admin_onboarding RPC
- Storage: 8 buckets with folder-based RLS
- Edge Functions: verify-qr, send-push, payment-webhook
- Seed data: Demo org + community + 10 units + 5 residents + 2 guards + 2 access points

**Auth Flows:**
- Invited resident: admin creates resident record -> user signs up -> handle_new_user links via email
- Invited guard: admin creates guard record -> user signs up -> handle_new_user links via email
- New admin: signs up -> pending_setup -> calls complete_admin_onboarding() -> creates org + community
- JWT app_metadata: community_id, role, resident_id/guard_id, organization_id

**User Roles:**
- Super Admin (platform level)
- Admin (community level)
- Guard (security operations)
- Resident (self-service)
- Manager/Gestor (maintenance, partial admin)

## Constraints

- **Platform**: Supabase auto-API + Edge Functions (no custom backend)
- **Mobile**: React Native with Expo 54 (managed workflow, no bare)
- **Web**: Next.js 16 with App Router + Tailwind CSS 4
- **Monorepo**: pnpm workspaces (packages/shared, packages/mobile, packages/admin)
- **Types**: Auto-generated from Supabase schema (database.types.ts)
- **Design**: Use frontend-design skill for all UI implementations
- **Spanish context**: UI in Spanish, domain reflects Mexican property management
- **Auth**: Supabase Auth with JWT app_metadata for role/community

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Row-level multi-tenancy | Simpler ops, Supabase RLS native support | ✓ Good |
| UUIDs for all PKs | Offline-first sync without conflicts | ✓ Good |
| Soft deletes everywhere | Audit requirements, sync compatibility | ✓ Good |
| Supabase auto-API (not custom) | 206 DB functions + RLS already handle logic | ✓ Good |
| React Native + Expo | Standard 2026 mobile framework, managed workflow | — Pending |
| Next.js for admin | SSR, App Router, Tailwind integration | — Pending |
| Monorepo with pnpm | Shared types (393KB), single source of truth | ✓ Good |
| frontend-design skill for UI | Distinctive, production-grade interfaces | — Pending |
| residents.user_id (not .id) for auth | Business ID separate from auth user link | ✓ Good |
| Separate audit tables | Keep main tables lean, compliance needs | ✓ Good |

---
*Last updated: 2026-02-06 after milestone v2.0 initialization*
