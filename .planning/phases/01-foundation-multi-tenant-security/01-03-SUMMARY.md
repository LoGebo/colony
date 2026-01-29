---
phase: 01-foundation-multi-tenant-security
plan: 03
subsystem: database
tags: [postgres, rls, multi-tenant, supabase, uuid-v7, organizations, communities]

# Dependency graph
requires:
  - phase: 01-01
    provides: generate_uuid_v7(), set_audit_fields(), get_current_community_id(), is_super_admin(), get_current_user_role()
  - phase: 01-02
    provides: general_status enum, phone_number domain, timezone_name domain, locale_code domain, currency_code domain
provides:
  - organizations table for platform-level SaaS customers
  - communities table as primary tenant isolation boundary
  - 6 RLS policies for tenant isolation and admin access
  - user_has_community_access() helper function for RLS checks
affects:
  - All future tables will reference communities.id as foreign key
  - All RLS policies will use get_current_community_id() pattern
  - Phase 2 CRM tables will build on this foundation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS policy pattern: (SELECT is_super_admin()) for cached JWT extraction"
    - "RLS policy pattern: id = (SELECT get_current_community_id()) for tenant isolation"
    - "Soft delete pattern: deleted_at IS NULL in all query conditions"
    - "Partial indexes for RLS performance: WHERE deleted_at IS NULL"

key-files:
  created:
    - supabase/migrations/20260129101940_organizations_table.sql
    - supabase/migrations/20260129102227_communities_table.sql
    - supabase/migrations/20260129102335_foundation_rls_policies.sql
  modified: []

key-decisions:
  - "ON DELETE RESTRICT for communities.organization_id to prevent orphan communities"
  - "Unique constraint (organization_id, slug) allows same slug across different orgs"
  - "Denormalized unit_count and resident_count on communities for dashboard performance"
  - "user_has_community_access() helper centralizes access checks for reuse"

patterns-established:
  - "Pattern: Table RLS - enable immediately after CREATE TABLE"
  - "Pattern: Super admin policy - FOR ALL with (SELECT is_super_admin())"
  - "Pattern: User isolation policy - FOR SELECT with id = (SELECT get_current_community_id())"
  - "Pattern: Admin update policy - FOR UPDATE with role IN ('admin', 'manager')"

# Metrics
duration: 5min
completed: 2026-01-29
---

# Phase 01 Plan 03: Organizations and Communities Tables Summary

**Multi-tenant foundation tables with UUID v7 PKs, JSONB settings, and 6 RLS policies for tenant isolation using JWT app_metadata.community_id**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-29T10:19:30Z
- **Completed:** 2026-01-29T10:24:48Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created organizations table as platform-level SaaS customer entity with 18 columns
- Created communities table as primary tenant isolation boundary with 24 columns and FK to organizations
- Implemented 6 RLS policies (3 per table) for secure multi-tenant access control
- Created user_has_community_access() helper function for reusable community membership checks
- All tables have RLS enabled, audit triggers, soft delete support, and performance indexes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create organizations table** - `cd3240a` (feat)
2. **Task 2: Create communities table** - `f089664` (feat)
3. **Task 3: Create RLS policies** - `35c9123` (feat)

## Files Created/Modified

- `supabase/migrations/20260129101940_organizations_table.sql` - Platform-level SaaS customer table with billing, branding, settings
- `supabase/migrations/20260129102227_communities_table.sql` - Gated community table with timezone, locale, currency, denormalized counts
- `supabase/migrations/20260129102335_foundation_rls_policies.sql` - 6 RLS policies + user_has_community_access() helper

## Decisions Made

1. **ON DELETE RESTRICT for FK:** Prevents accidental deletion of organizations that have communities, ensuring data integrity
2. **Composite unique (org_id, slug):** Allows "garden-towers" slug in multiple orgs while ensuring uniqueness within each org
3. **Denormalized counts:** unit_count and resident_count on communities for fast dashboard queries without expensive joins
4. **Separate exclude_deleted policy:** On organizations, explicit policy for clarity; on communities, merged into users_view_own_community

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all migrations applied successfully and verifications passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Phase 01 remains complete: All foundation functions, enums, and core tables in place
- Phase 02 (CRM): Can now create users, units, and other tables with community_id FK
- All new tables should: enable RLS, add community_id FK, use get_current_community_id() in policies

**Database foundation complete:**
- generate_uuid_v7() for all PKs
- set_audit_fields() trigger for all tables
- get_current_community_id() for all RLS policies
- organizations/communities as root tables
- 6 RLS policies demonstrating all access patterns

**No blockers identified.**

---
*Phase: 01-foundation-multi-tenant-security*
*Completed: 2026-01-29*
