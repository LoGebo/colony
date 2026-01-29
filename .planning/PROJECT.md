# UPOE - Unified Property Operations Ecosystem

## What This Is

A multi-tenant SaaS platform for managing gated residential communities (fraccionamientos, condominios, parques logisticos, desarrollos mixtos). Unifies security operations, financial management, resident services, community communication, amenities, marketplace, and maintenance into a single ecosystem with offline-first architecture.

## Core Value

**Symbiosis operativa total:** Security feeds administration with real-time data, administration defines rules that govern security, community generates information that enriches both flows, and local commerce is empowered with trust infrastructure.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Database Architecture (Current Focus):**
- [ ] Multi-tenant schema with Row Level Security (RLS)
- [ ] Community/property isolation with shared infrastructure
- [ ] Complete entity model for all modules
- [ ] Offline-sync compatible data structures
- [ ] Audit trail and soft-delete patterns

**Module: Security & Access Control**
- [ ] Guard profiles, shifts, assignments
- [ ] Access points (gates, barriers) configuration
- [ ] Vehicle registry with LPR data (plates, photos, status)
- [ ] Visitor invitations (single-use, event, recurring, vehicle pre-auth)
- [ ] Dynamic QR with cryptographic signatures
- [ ] Blacklist management with protocols
- [ ] Patrol routes with NFC checkpoints
- [ ] Access logs with photos and timestamps
- [ ] Emergency alerts (panic buttons, types, dispatch)

**Module: CRM & Identity**
- [ ] Units (houses, apartments, commercial) with coefficients
- [ ] Residents with full profiles, photos, KYC status
- [ ] Vehicles linked to units/residents
- [ ] Pets with vaccination records
- [ ] Resident onboarding workflow states
- [ ] Move-in/move-out tracking

**Module: Financial Engine**
- [ ] Fee structures (fixed, coefficient-based, hybrid)
- [ ] Charges, payments, credits, balances
- [ ] Interest and penalty calculation rules
- [ ] Bank reconciliation with smart matching
- [ ] Payment proof validation workflow
- [ ] Delinquency triggers and automated actions

**Module: Amenities**
- [ ] Amenity catalog with photos, capacity, rules
- [ ] Reservation slots with availability
- [ ] Booking rules engine (quotas, windows, restrictions)
- [ ] Waitlist management
- [ ] Usage validation and no-show tracking

**Module: Community & Communication**
- [ ] Social wall with channels and moderation
- [ ] Forums with threaded discussions
- [ ] Official announcements with read receipts
- [ ] Surveys with voting controls
- [ ] Service arrival notifications

**Module: Marketplace**
- [ ] Listings (sale, service, rental, wanted)
- [ ] Safe exchange zones
- [ ] Moderation queue
- [ ] Local business directory

**Module: Maintenance**
- [ ] Tickets with priority, category, assignment
- [ ] SLA tracking and escalation
- [ ] Preventive maintenance schedules
- [ ] Asset registry
- [ ] Provider management with documentation

**Module: Documents**
- [ ] Document repository with categories
- [ ] Regulation signatures with timestamps
- [ ] Assembly minutes and agreements

### Out of Scope

- Frontend implementation (Expo/Next.js) — separate phase after DB
- IoT hardware integration code — DB schema only for now
- AI/ML model training — schema supports it, implementation later
- Payment gateway integration — schema for transactions, not Stripe/etc
- Push notification service — schema for notification records only

## Context

**Technical Environment:**
- Supabase as backend (Postgres + Auth + Storage + Edge Functions)
- Multi-tenant from day one with RLS
- Offline-first architecture requires sync-friendly schema design
- Must support conflict resolution strategies defined in spec

**Key Technical Decisions from Spec:**
- Conflict resolution: Merge cronologico (logs), Prioridad restrictiva (access), Last-write-wins (profiles), First-come-first-served (reservations)
- Local capacity: 30 days of operations, 50K access records, 10K vehicles, 5K residents
- Security: Data at rest encryption, audit trails on all sensitive operations

**User Roles:**
- Super Admin (platform level)
- Admin (community level)
- Guard (security operations)
- Resident (self-service)
- Manager/Gestor (maintenance, partial admin)
- Visitor (temporary access)

## Constraints

- **Platform**: Supabase (Postgres 15+, RLS, Edge Functions)
- **Multi-tenancy**: Row-level with community_id, not schema-per-tenant
- **Sync-friendly**: UUID primary keys, timestamps for sync, soft deletes
- **Audit**: All sensitive tables need created_at, updated_at, deleted_at, created_by
- **Spanish context**: Column names in English, but domain reflects Mexican property management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Row-level multi-tenancy | Simpler ops, Supabase RLS native support | — Pending |
| UUIDs for all PKs | Offline-first sync without conflicts | — Pending |
| Soft deletes everywhere | Audit requirements, sync compatibility | — Pending |
| Denormalized access cache | Guard app needs <200ms offline lookups | — Pending |
| Separate audit tables | Keep main tables lean, compliance needs | — Pending |

---
*Last updated: 2026-01-29 after initialization*
