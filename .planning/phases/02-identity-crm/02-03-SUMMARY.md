---
phase: 02-identity-crm
plan: 03
subsystem: database
tags: [supabase, storage, rls, documents, verification-workflow]

# Dependency graph
requires:
  - phase: 02-02
    provides: residents table for FK relationship
  - phase: 01-03
    provides: RLS helpers (get_current_community_id, get_current_user_role, is_super_admin)
  - phase: 02-01
    provides: document_type enum
provides:
  - resident_documents table with verification workflow
  - resident-documents storage bucket with RLS isolation
  - Document expiration tracking for KYC compliance
affects: [03-access-control, onboarding-flows, admin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Storage path convention: {community_id}/{resident_id}/{document_type}/{filename}"
    - "Partial unique index for preventing duplicates on non-rejected docs"
    - "Verification workflow: pending -> approved/rejected"

key-files:
  created:
    - supabase/migrations/20260129110311_resident_documents_table.sql
    - supabase/migrations/20260129110459_resident_documents_storage.sql
  modified: []

key-decisions:
  - "10MB file limit per document suitable for ID scans and contracts"
  - "Partial unique index allows re-upload after rejection"
  - "Storage policies use DROP IF EXISTS for idempotency"

patterns-established:
  - "Document verification workflow: pending -> approved or rejected"
  - "Storage bucket isolation by community_id/resident_id path"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 2 Plan 3: Resident Documents and Storage Summary

**Document metadata table with verification workflow (pending/approved/rejected) and private Supabase Storage bucket with community-isolated RLS policies**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T11:02:56Z
- **Completed:** 2026-01-29T11:05:56Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- resident_documents table for KYC document metadata (INE, proof of address, contracts)
- Verification workflow with pending/approved/rejected status and rejection reasons
- Expiration date tracking for document validity reminders
- Partial unique index prevents duplicate active documents per type
- Private storage bucket with 10MB limit, accepting image/pdf types
- 13 total RLS policies (6 on table, 7 on storage) for tenant isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create resident_documents table with verification workflow** - `073baa9` (feat)
2. **Task 2: Create storage bucket with RLS policies for documents** - `6a777ca` (feat)

## Files Created/Modified
- `supabase/migrations/20260129110311_resident_documents_table.sql` - Document metadata table with 6 RLS policies
- `supabase/migrations/20260129110459_resident_documents_storage.sql` - Storage bucket with 7 RLS policies

## Decisions Made
- 10MB file limit chosen as sufficient for ID scans and PDF contracts
- Partial unique index on (resident_id, document_type) WHERE deleted_at IS NULL AND verification_status != 'rejected' - allows re-uploading after rejection
- Storage policies use DROP POLICY IF EXISTS before CREATE for idempotent migrations
- Path structure {community_id}/{resident_id}/{document_type}/{filename} enables RLS enforcement via folder path checks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both migrations applied successfully to remote database.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Identity & CRM foundation complete (users, residents, occupancies, vehicles, pets, documents)
- Ready for Phase 3: Access Control (visitor management, entry logs, QR codes)
- Storage bucket ready for file upload integration in frontend

---
*Phase: 02-identity-crm*
*Completed: 2026-01-29*
