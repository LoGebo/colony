---
phase: 02-identity-crm
plan: 02
subsystem: database
tags: [postgres, rls, residents, occupancies, vehicles, pets, lpr, crm, mexican-name-format, kyc]

# Dependency graph
requires:
  - phase: 01-foundation-multi-tenant-security
    provides: generate_uuid_v7, set_audit_fields, general_status enum, approval_status enum, communities table, RLS helpers
  - phase: 02-identity-crm/01
    provides: units table, onboarding_status enum, pet_species enum
provides:
  - residents table linked 1:1 to auth.users
  - occupancies junction table (resident-unit relationships with roles)
  - vehicles table with LPR-ready normalized plates
  - pets table with pet_species enum
  - pet_vaccinations table with expiry tracking
  - pet_incidents table with resolution workflow
affects: [02-03 documents, 03-access-control, 04-financial, 06-guards-operations]

# Tech tracking
tech-stack:
  added:
    - pg_trgm extension (fuzzy text search)
    - unaccent extension (accent-insensitive search)
  patterns:
    - "Generated columns for normalized data (plate_normalized, full_name)"
    - "1:1 FK to auth.users using id as both PK and FK"
    - "Junction table with role in unique constraint (unit_id, resident_id, occupancy_type)"
    - "Time-series child tables (pet_vaccinations separate from pets)"

key-files:
  created:
    - supabase/migrations/20260129105732_residents_table.sql
    - supabase/migrations/20260129105903_occupancies_table.sql
    - supabase/migrations/20260129105942_vehicles_table.sql
    - supabase/migrations/20260129110021_pets_tables.sql
  modified: []

key-decisions:
  - "Residents 1:1 link to auth.users via id (PK is FK with ON DELETE CASCADE)"
  - "Mexican name format: first_name, paternal_surname, maternal_surname with generated full_name"
  - "Occupancies allow same resident multiple roles in same unit via unique(unit_id, resident_id, occupancy_type)"
  - "Plate normalization via GENERATED ALWAYS column for LPR matching"
  - "Pet vaccinations in separate table for time-series queries and expiry tracking"

patterns-established:
  - "Auth user profile pattern: 1:1 table with id as both PK and FK to auth.users"
  - "LPR plate normalization: UPPER(REGEXP_REPLACE(plate, '[^A-Z0-9]', '', 'gi'))"
  - "Generated search columns: full_name with pg_trgm GIN index"
  - "Junction table with role: allows multiple relationships between same entities"

# Metrics
duration: 4min
completed: 2026-01-29
---

# Phase 2 Plan 2: Residents, Occupancies, Vehicles, and Pets Summary

**CRM core tables: residents (auth.users 1:1 with Mexican name format/KYC), occupancies junction, vehicles (LPR-ready plates), pets with vaccinations and incident tracking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-29T10:57:23Z
- **Completed:** 2026-01-29T11:01:00Z
- **Tasks:** 4
- **Files created:** 4

## Accomplishments
- Created residents table linked 1:1 to auth.users with Mexican name format and KYC verification fields
- Created occupancies junction table allowing multiple roles per resident per unit
- Created vehicles table with generated plate_normalized column for LPR matching
- Created pets, pet_vaccinations, and pet_incidents tables with full workflow support
- Enabled pg_trgm extension for fuzzy name search
- Implemented RLS on all 6 tables with appropriate policies

## Task Commits

Each task was committed atomically:

1. **Task 1: Create residents table linked to auth.users** - `2ba39b7` (feat)
2. **Task 2: Create occupancies junction table** - `55c0e94` (feat)
3. **Task 3: Create vehicles table with LPR-ready plate storage** - `60a9a44` (feat)
4. **Task 4: Create pets, pet_vaccinations, pet_incidents tables** - `60df6b9` (feat)

## Files Created/Modified
- `supabase/migrations/20260129105732_residents_table.sql` - Residents with auth.users link, Mexican name format, KYC, onboarding workflow
- `supabase/migrations/20260129105903_occupancies_table.sql` - Junction table with occupancy_type role, unique constraint
- `supabase/migrations/20260129105942_vehicles_table.sql` - Vehicles with generated plate_normalized, LPR fields
- `supabase/migrations/20260129110021_pets_tables.sql` - Pets, vaccinations (time-series), incidents (resolution workflow)

## Decisions Made
- Residents id is BOTH primary key AND foreign key to auth.users (1:1 pattern with ON DELETE CASCADE)
- Mexican name format supports paternal_surname (required) + maternal_surname (optional)
- Generated full_name column enables efficient search with pg_trgm GIN index
- Occupancies unique constraint includes occupancy_type, allowing same person to be both owner AND authorized
- Vehicle plate normalization strips non-alphanumeric and uppercases for consistent LPR matching
- Pet vaccinations in separate table enables time-series queries and batch_number tracking for recalls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all migrations applied successfully to remote database.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Residents table ready for document storage (02-03)
- Occupancies enables unit-based access control queries (Phase 3)
- Vehicles table ready for LPR integration (Phase 3/6)
- Pet vaccination expiry tracking ready for notification system (Phase 6+)
- All CRM core data model complete for Phase 2

---
*Phase: 02-identity-crm*
*Completed: 2026-01-29*
