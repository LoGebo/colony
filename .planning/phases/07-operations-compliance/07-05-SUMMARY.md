---
phase: 07-operations-compliance
plan: 05
subsystem: configuration
tags: [feature-flags, rbac, permissions, community-settings, roles]
depends_on:
  requires: [01-foundation, 02-identity-crm]
  provides: [community-configuration, rbac-system, feature-toggles]
  affects: [all-phases]
tech-stack:
  added: []
  patterns: [jsonb-feature-flags, hybrid-rbac, permission-checking]
key-files:
  created:
    - supabase/migrations/20260130012100_community_settings.sql
    - supabase/migrations/20260130012500_roles_permissions.sql
  modified: []
decisions:
  - id: JSONB-FEATURE-FLAGS
    choice: JSONB column on community_settings for feature toggles
    rationale: Flexible per-tenant configuration without schema migrations
  - id: HYBRID-RBAC
    choice: Database permissions with JWT for common checks
    rationale: JWT for performance, database for fine-grained control and audit
  - id: SYSTEM-ROLES
    choice: 6 system roles with NULL community_id
    rationale: Shared across all communities, cannot be deleted
  - id: GENERATE-UUID-FIX
    choice: Fixed generate_uuid_v7() to use extensions.gen_random_bytes
    rationale: pgcrypto installed in extensions schema, not public
metrics:
  duration: 9 min
  completed: 2026-01-30
---

# Phase 7 Plan 5: Community Settings & RBAC Summary

**One-liner:** JSONB feature flags with GIN index and hybrid RBAC system with 6 system roles and 24 permissions

## What Was Built

### Task 1: Community Settings with Feature Flags
Created `community_settings` table for per-community configuration:

**Table Structure:**
- Operating hours: `office_hours_start`, `office_hours_end`, `office_days[]`
- Contact info: `management_email`, `management_phone`, `emergency_phone`
- Branding: `logo_url`, `primary_color`, `secondary_color`
- Locale: `timezone`, `locale`, `currency`
- Feature flags: `feature_flags JSONB` with GIN index
- Rules: `guest_parking_allowed`, `max_vehicles_per_unit`, `pet_policy`, quiet hours
- Package settings: `package_retention_days`, `package_notification_channels[]`
- Custom rules: `custom_rules JSONB`

**Functions:**
- `is_feature_enabled(community_id, feature_name)` - Check if feature is on
- `get_feature_config(community_id, feature_name)` - Get feature configuration
- `create_default_community_settings(community_id)` - Initialize with defaults

**Default Feature Flags:**
```json
{
  "digital_mailroom": { "enabled": true, "config": {} },
  "provider_management": { "enabled": true, "config": {} },
  "move_coordination": { "enabled": true, "config": {} },
  "marketplace": { "enabled": false, "config": {} },
  "voting": { "enabled": true, "config": {} },
  "chat": { "enabled": true, "config": {} }
}
```

### Task 2: Roles and Permissions RBAC System
Created complete RBAC infrastructure:

**Tables:**
1. `roles` - Role definitions (system and community-specific)
2. `permissions` - Permission definitions (resource + action)
3. `role_permissions` - Role-to-permission mapping with conditions
4. `user_roles` - User role assignments per community

**System Roles (6):**
| Role | Display Name | Description |
|------|--------------|-------------|
| super_admin | Super Administrador | Platform-level administrator |
| community_admin | Administrador | Community administrator |
| manager | Gestor | Operations manager |
| guard | Guardia | Security guard |
| resident | Residente | Property owner/tenant |
| provider | Proveedor | Service provider |

**Permissions (24):**
- Operations: packages.read/create/update/pickup, providers.read/create/update/approve, moves.read/create/approve
- Security: audit.read, security.read/manage, roles.read/manage
- Configuration: settings.read/update, residents.read/create/update
- Financial: financial.read/create/approve

**RBAC Functions:**
- `has_permission(user_id, community_id, permission_name)` - Check permission
- `get_user_permissions(user_id, community_id)` - List all permissions
- `assign_role(user_id, role_id, community_id)` - Assign role
- `revoke_role(user_id, role_id, community_id)` - Revoke role
- `get_user_roles(user_id, community_id)` - List user's roles

**Default Role Permissions:**
- `community_admin` + `super_admin`: All 24 permissions
- `manager`: 13 permissions (packages, providers, moves, settings.read, residents, financial.read)
- `guard`: 7 permissions (packages.read/create/pickup, providers.read, moves.read, security.read, residents.read)
- `resident`: 4 permissions (packages.read, moves.read/create, settings.read)
- `provider`: 1 permission (settings.read)

## Technical Decisions

1. **JSONB Feature Flags with GIN Index**
   - Enables `@>` containment queries for feature filtering
   - No schema changes needed to add new features
   - Config object per feature for granular control

2. **Fixed generate_uuid_v7() for pgcrypto Schema**
   - pgcrypto is in `extensions` schema on Supabase
   - Changed `gen_random_bytes(10)` to `extensions.gen_random_bytes(10)`
   - Required for all UUID generation to work

3. **Hybrid RBAC Approach**
   - JWT claims for common role checks (fast, no DB query)
   - Database permissions for fine-grained checks (audit trail)
   - `has_permission()` function is SECURITY DEFINER for bypass

4. **Role-Permission Conditions**
   - `conditions JSONB` on role_permissions allows fine-grained rules
   - Example: `{"own_unit_only": true}` or `{"max_amount": 1000}`

5. **User Role Validity Periods**
   - `valid_from` and `valid_until` on user_roles
   - Support time-limited role assignments (e.g., temporary manager)

## Commits

| Hash | Message |
|------|---------|
| 69acfb2 | feat(07-05): add community_settings table with JSONB feature flags |
| fe404dc | feat(07-05): add roles, permissions, and RBAC functions |

## Files Changed

**Created:**
- `supabase/migrations/20260130012100_community_settings.sql` (238 lines)
- `supabase/migrations/20260130012500_roles_permissions.sql` (664 lines)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed generate_uuid_v7() for pgcrypto schema**
- **Found during:** Task 2 migration push
- **Issue:** `gen_random_bytes()` function not found despite pgcrypto being enabled
- **Root cause:** pgcrypto installed in `extensions` schema, not `public`
- **Fix:** Updated `generate_uuid_v7()` to use `extensions.gen_random_bytes(10)`
- **Files modified:** 20260130012500_roles_permissions.sql
- **Impact:** All future migrations using generate_uuid_v7() will work correctly

## Verification Results

### Feature Flags
- community_settings table created with all columns
- GIN index on feature_flags JSONB column
- is_feature_enabled() returns TRUE for enabled features
- is_feature_enabled() returns FALSE for disabled features
- get_feature_config() returns config object
- create_default_community_settings() creates with 6 default features

### RBAC System
- 6 system roles seeded (community_id = NULL)
- 24 permissions seeded across 4 categories
- role_permissions populated with default assignments
- has_permission() correctly checks through role chain
- get_user_permissions() returns all permissions
- assign_role() and revoke_role() work with ON CONFLICT

## Integration Points

### Immediate Use
- `is_feature_enabled()` can be called in RLS policies
- `has_permission()` can be called in RLS policies
- Feature flags control which modules are active per community

### Future Integration
- Phase 8: Settings API to manage community_settings
- Phase 8: Admin UI for role management
- All phases: Feature flag checks before module access

## Next Phase Readiness

Phase 7 complete with all 5 plans executed:
- 07-01: Package Management Schema
- 07-02: Provider Management
- 07-03: Move Coordination
- 07-04: Audit Logs & Compliance
- 07-05: Community Settings & RBAC

**Ready for Phase 8 (Dashboard & Integration)** with:
- Complete RBAC infrastructure for admin dashboard
- Feature flags for module control
- Audit logging for all sensitive operations
