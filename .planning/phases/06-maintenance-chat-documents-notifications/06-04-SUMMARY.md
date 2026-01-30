---
phase: 06-maintenance-chat-documents-notifications
plan: 04
subsystem: documents
tags: [postgresql, versioning, signatures, esign, copy-on-write]
dependency-graph:
  requires: [01-01, 02-01, 02-03]
  provides: [document-versioning, digital-signatures, permission-system]
  affects: [06-05]
tech-stack:
  added: []
  patterns: [copy-on-write-versioning, sha256-tamper-detection, immutable-audit-records]
key-files:
  created:
    - supabase/migrations/20260129235139_document_enums.sql
    - supabase/migrations/20260129235140_documents.sql
    - supabase/migrations/20260129235654_document_permissions.sql
    - supabase/migrations/20260129235751_signatures.sql
  modified: []
decisions:
  - id: doc-versioning-pattern
    choice: copy-on-write with current_version_id pointer
    why: O(1) access to latest version, full version history preserved
  - id: signature-immutability
    choice: trigger-enforced immutability (no UPDATE/DELETE)
    why: ESIGN/UETA compliance requires permanent, unmodifiable records
  - id: permission-targeting
    choice: user/unit/role with exactly-one constraint
    why: Flexible access control - grant to individual, household, or role group
  - id: signature-hash
    choice: SHA-256 of checksum+resident+timestamp+ip
    why: Tamper detection without storing sensitive data in hash
metrics:
  duration: 14 min
  completed: 2026-01-29
---

# Phase 6 Plan 04: Document Management with Versioning and Signatures Summary

Copy-on-write document versioning with granular permissions and legally-compliant digital signatures using SHA-256 tamper detection and trigger-enforced immutability.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Document enums and base tables | e5086bd | 20260129235139_document_enums.sql, 20260129235140_documents.sql |
| 2 | Document permissions | e5086bd | 20260129235654_document_permissions.sql |
| 3 | Regulation signatures | e5086bd | 20260129235751_signatures.sql |

## What Was Built

### Document Category Enum
- 5 categories with Spanish context examples
- legal: reglamento, acta constitutiva, escrituras
- assembly: actas de asamblea, minutas, acuerdos
- financial: estados financieros, presupuestos, auditorias
- operational: manuales, procedimientos, instructivos
- communication: circulares, avisos, boletines

### Documents Table
- UUID v7 primary key with community_id FK
- current_version_id pointer for O(1) latest access
- is_public flag for all-resident visibility
- required_role for role-based access hierarchy
- requires_signature and signature_deadline for signature workflows
- tags array for categorization
- Standard audit columns with soft delete

### Document Versions Table
- Copy-on-write versioning pattern
- Auto-incrementing version_number per document
- Storage path and bucket for Supabase Storage integration
- File metadata: file_name, file_size_bytes, mime_type
- checksum for SHA-256 integrity verification
- previous_version_id links for version chain traversal
- Triggers:
  - set_document_version(): Auto-sets version_number and previous_version_id
  - update_document_current_version(): Updates parent document pointer

### Helper Functions
- upload_document_version(): Inserts new version with auto-computed fields
- get_document_history(): Returns all versions with uploader info

### Document Permissions Table
- Granular access control by user, unit, or role
- CHECK constraint ensures exactly one target type set
- can_view, can_download, can_edit permission levels
- expires_at for temporary access grants
- Unique indexes prevent duplicate grants

### Permission Functions
- check_document_access(p_document_id, p_user_id, p_permission): Evaluates access based on:
  1. is_public flag
  2. required_role hierarchy
  3. Explicit document_permissions entries
- get_accessible_documents(p_user_id): Returns all documents user can access with access_source

### Regulation Signatures Table
- ESIGN/UETA-compliant metadata capture:
  - signed_at timestamp with timezone
  - ip_address (INET supports IPv4/IPv6)
  - user_agent, device_type, browser, os
  - screen_resolution, device_id, device_model
  - Optional geolocation (latitude, longitude, accuracy)
- consent_text: Verbatim legal text signer agreed to
- signature_hash: SHA-256 for tamper detection
- NO deleted_at or updated_at (permanent, immutable records)

### Signature Functions
- compute_signature_hash(): Creates SHA-256 from checksum+resident+timestamp+ip
- set_signature_hash(): BEFORE INSERT trigger auto-computes hash
- prevent_signature_modification(): BEFORE UPDATE OR DELETE raises exception
- verify_signature_hash(): Recomputes hash to detect tampering
- capture_signature(): Validates and records signature with full metadata
- get_pending_signatures(): Documents requiring user signature
- get_document_signatures(): All signatures for document (admin view)

## Key Patterns

### Copy-on-Write Versioning
```sql
-- Each edit creates new version, old versions preserved
INSERT INTO document_versions (document_id, ...)
-- Trigger auto-sets version_number and updates document.current_version_id
```

### Role Hierarchy for Access
```sql
-- admin > manager > guard > resident > provider > visitor
CASE user_role
  WHEN 'admin' THEN required_role IN ('admin', 'manager', ...)
  WHEN 'manager' THEN required_role IN ('manager', 'guard', ...)
  ...
END
```

### Signature Immutability
```sql
CREATE TRIGGER signature_immutable_trigger
  BEFORE UPDATE OR DELETE ON regulation_signatures
  EXECUTE FUNCTION prevent_signature_modification();
-- Raises exception: "Regulation signatures cannot be modified or deleted"
```

## Indexes Created

### Documents
- idx_documents_community_category: Document list by category
- idx_documents_requires_signature: Pending signatures query
- idx_documents_public: Public document listing
- idx_documents_tags: GIN index for tag search

### Document Versions
- idx_document_versions_document: Version history lookup

### Document Permissions
- Unique indexes for user/unit/role per document
- Lookup indexes by user_id, unit_id, role

### Regulation Signatures
- idx_signatures_document_version: Who signed what
- idx_signatures_resident: My signatures
- idx_signatures_community_signed: Audit queries
- idx_signatures_unique_resident_version: One signature per resident per version

## RLS Policies

### Documents
- super_admins_full_access_documents: All operations
- admins_manage_community_documents: Community admin management
- users_view_documents_via_permission: Uses check_document_access()

### Document Versions
- super_admins_full_access_document_versions: All operations
- users_view_document_versions: Access if parent document accessible
- admins_insert_document_versions: Admin upload capability

### Document Permissions
- super_admins_full_access_document_permissions: All operations
- admins_manage_document_permissions: Community admin management
- users_view_document_permissions: View if can access document

### Regulation Signatures
- super_admins_view_signatures: Read-only access
- residents_view_own_signatures: Own signature history
- admins_view_community_signatures: Community audit view
- No UPDATE/DELETE policies (immutable by design)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. document_category enum created with 5 values
2. documents table created with current_version_id pointer
3. document_versions table created with auto-incrementing version_number
4. document_permissions table created with user/unit/role targeting
5. regulation_signatures table created with full ESIGN metadata
6. Immutability trigger prevents signature modification
7. SHA-256 hash computed on signature creation
8. All RLS policies in place

## Next Phase Readiness

Ready for Phase 6 Plan 05 (Push Notifications):
- Document signature events can trigger notifications
- get_pending_signatures() provides data for signature reminders
- Document publish events can notify relevant residents
