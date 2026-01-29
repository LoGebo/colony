# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Phase 2 - Identity & CRM

## Current Position

Phase: 2 of 8 (Identity & CRM)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-01-29 - Completed 02-02-PLAN.md (Residents, Occupancies, Vehicles, Pets)

Progress: [#####               ] 17%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 4 min
- Total execution time: 18 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 12 min | 4 min |
| 02-identity-crm | 2 | 6 min | 3 min |

**Recent Trend:**
- Last 5 plans: 01-02 (2 min), 01-03 (5 min), 02-01 (2 min), 02-02 (4 min)
- Trend: Fast execution

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

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Phase 4 (Financial) needs deeper research on double-entry patterns for property management
- Research flag: Phase 5 (Amenities) needs exclusion constraint performance testing with RLS

## Session Continuity

Last session: 2026-01-29T11:01:00Z
Stopped at: Completed 02-02-PLAN.md (Residents, Occupancies, Vehicles, Pets)
Resume file: None
