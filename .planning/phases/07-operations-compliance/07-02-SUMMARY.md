---
phase: 07-operations-compliance
plan: 02
subsystem: database
tags: [provider-management, credentials, documents, expiration-tracking, access-control, personnel]

# Dependency graph
requires:
  - phase: 01-02
    provides: generate_uuid_v7(), set_audit_fields(), soft_delete() functions
  - phase: 02-01
    provides: phone_number domain
  - phase: 07-01
    provides: Phase 7 infrastructure (package management)
provides:
  - provider_status, document_status enums
  - providers table with status workflow, specialties array, rating
  - provider_documents table with GENERATED is_expired, days_until_expiry
  - provider_documents_expiring view with urgency_level
  - provider_personnel table with photo ID and access restrictions
  - provider_access_schedules table with day/time windows
  - is_provider_access_allowed() function for real-time access check
affects: [07-03-move-coordination, guard-app, admin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - GENERATED ALWAYS columns for computed expiration status
    - GIN index on TEXT[] array for specialty search
    - Time-based access control with day-of-week arrays
    - Expiry alert tracking flags to prevent duplicate notifications
    - View-based urgency level computation

key-files:
  created:
    - supabase/migrations/20260130011029_provider_enums.sql
    - supabase/migrations/20260130011320_providers_table.sql
    - supabase/migrations/20260130011436_provider_documents_personnel.sql

key-decisions:
  - "Provider status workflow: pending_approval -> active -> suspended/inactive"
  - "Document status workflow: pending_verification -> verified/rejected, verified -> expired"
  - "GENERATED columns for is_expired and days_until_expiry - always current, no stale data"
  - "Expiry alert tracking with 30d/14d/7d boolean flags prevents duplicate notifications"
  - "View groups documents by urgency_level: expired, critical (<=7d), warning (<=14d), upcoming (<=30d)"
  - "Personnel full_name is GENERATED from first_name + paternal_surname + maternal_surname (Mexican format)"
  - "Access schedules use day-of-week array (0=Sunday, 6=Saturday) with time windows"
  - "is_provider_access_allowed() enables real-time access checks at guard checkpoints"
  - "Providers can view their own records via provider_id in JWT app_metadata"

patterns-established:
  - "GENERATED ALWAYS for computed expiration tracking"
  - "View-based urgency level computation for alert prioritization"
  - "Day-of-week array + time range for access schedule configuration"

metrics:
  duration: 8 min
  completed: 2026-01-30
---

# Phase 7 Plan 02: Provider Management Summary

**One-liner:** Provider companies with document expiration tracking (GENERATED columns), authorized personnel, and time-based access control via is_provider_access_allowed() function.

## What Was Built

### Enums Created
- **provider_status:** pending_approval, active, suspended, inactive
- **document_status:** pending_verification, verified, expired, rejected

### Tables Created

1. **providers** - Service provider companies
   - Company info (name, legal_name, RFC Mexican tax ID)
   - Contact (name, email, phone, address)
   - Specialties array with GIN index
   - Status workflow with approval tracking
   - Rating (average_rating, total_work_orders)

2. **provider_documents** - Insurance, licenses, certifications
   - Document type CHECK constraint (8 types)
   - GENERATED is_expired column (always current)
   - GENERATED days_until_expiry column
   - Verification workflow (status, verified_at, verified_by)
   - Expiry alert tracking (30d, 14d, 7d flags)

3. **provider_personnel** - Authorized workers
   - Mexican name format (first_name, paternal_surname, maternal_surname)
   - GENERATED full_name column
   - INE number and photo_url for ID verification
   - Authorization period (from/until dates)
   - Access point restrictions (UUID array)

4. **provider_access_schedules** - Time-based access control
   - Day-of-week array (0=Sunday, 6=Saturday)
   - Time windows (start_time, end_time)
   - Effective date range (from/until)

### Views Created
- **provider_documents_expiring** - Documents expiring within 30 days
  - Joins with provider contact info
  - urgency_level: expired, critical, warning, upcoming

### Functions Created
- **is_provider_access_allowed(provider_id, check_time)** - Real-time access check
  - Checks active schedules for day/time match
  - Returns BOOLEAN for guard checkpoint use

### RLS Policies
- Super admins: full access
- Admins/managers: full CRUD for their community
- Guards: view active providers, authorized personnel, active schedules
- Providers: view their own records via JWT provider_id

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed function reference in packages_table migration**
- **Found during:** Task 1 (migration push)
- **Issue:** packages_table referenced update_updated_at() which doesn't exist
- **Fix:** Changed to set_audit_fields() (foundation function)
- **Files modified:** supabase/migrations/20260130010900_packages_table.sql
- **Commit:** Part of bug fixes during execution

**2. [Rule 1 - Bug] Fixed GENERATED column immutability issue**
- **Found during:** Task 1 (migration push)
- **Issue:** abandonment_date GENERATED column used TIMESTAMPTZ::DATE which is not immutable
- **Fix:** Changed to regular column with trigger-based computation
- **Files modified:** supabase/migrations/20260130010900_packages_table.sql
- **Commit:** Part of bug fixes during execution

**3. [Rule 1 - Bug] Fixed move_requests_validations migration**
- **Found during:** Task 1 (migration push)
- **Issue:** Same update_updated_at() function reference
- **Fix:** Changed to set_audit_fields()
- **Files modified:** supabase/migrations/20260130011116_move_requests_validations.sql
- **Commit:** Part of bug fixes during execution

## Verification Results

All tasks verified:
1. Provider enums created and queryable
2. Providers table with status workflow operational
3. Provider documents with GENERATED expiration columns working
4. provider_documents_expiring view returns urgency levels
5. Provider personnel with full_name generation
6. Access schedules with day/time restrictions
7. is_provider_access_allowed() function returns correct results

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 872edb2 | feat | Create provider and document status enums |
| 1749d2c | feat | Create providers table with status workflow |
| c28b8d5 | feat | Create provider documents, personnel, and access schedules |

## Next Phase Readiness

### For 07-03 (Move Coordination)
- Provider system ready for work order integration
- Personnel authorization available for move supervision
- Access schedules can be used for moving company time slots

### For 07-04 (Audit Logging)
- Provider tables ready for audit trail tracking
- Document verification actions should be audited
- Personnel authorization changes need audit logging

### Open Questions
- Should expired documents auto-suspend provider status?
- Provider portal authentication approach (separate from resident app?)
