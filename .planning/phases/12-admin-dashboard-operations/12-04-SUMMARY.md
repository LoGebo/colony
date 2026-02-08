---
phase: 12-admin-dashboard-operations
plan: 04
subsystem: admin-operations
tags: [access-logs, csv-export, documents, amenities, utilization-chart, storage-upload]
depends_on:
  requires: [12-01]
  provides: [access-log-page, csv-export, document-repository, amenity-management, utilization-reports]
  affects: []
tech-stack:
  added: []
  patterns: [csv-export-via-sheetjs, storage-upload-with-version, utilization-chart, card-grid-layout]
key-files:
  created:
    - packages/admin/src/hooks/useAccessLogs.ts
    - packages/admin/src/hooks/useDocuments.ts
    - packages/admin/src/hooks/useAmenities.ts
    - packages/admin/src/app/(dashboard)/operations/access-logs/page.tsx
    - packages/admin/src/app/(dashboard)/operations/documents/page.tsx
    - packages/admin/src/app/(dashboard)/operations/amenities/page.tsx
    - packages/admin/src/app/(dashboard)/operations/amenities/[id]/page.tsx
    - packages/admin/src/components/charts/AmenityUtilizationChart.tsx
  modified:
    - packages/admin/src/lib/export.ts
decisions:
  - id: doc-schema-adaptation
    decision: "Adapted document hooks/pages to actual DB schema (name not title, is_public not visibility, category as enum, document_versions with storage_path/version_number)"
    rationale: "Generated types revealed real column names differ from plan assumptions"
  - id: amenity-card-grid
    decision: "Used card grid layout for amenities list instead of DataTable"
    rationale: "Amenities are typically fewer items; cards show more info at a glance (description, badges, capacity)"
  - id: utilization-peak-hours
    decision: "Peak hours displayed as horizontal bar list (not chart) below the daily bookings Recharts BarChart"
    rationale: "Simple visual representation for top 5 hours; avoids second full chart component"
metrics:
  duration: 9min
  completed: 2026-02-08
---

# Phase 12 Plan 04: Access Logs, Documents, and Amenities Summary

**One-liner:** Access log reports with CSV export, document repository with storage upload, and amenity CRUD with rules and utilization charts.

## What Was Built

### Access Log Reports (AOPS-06, AOPS-07)
- **useAccessLogs hook** with paginated query supporting date range, gate, person type, and direction filters
- **useAccessPoints hook** for gate filter dropdown
- **useAccessLogsForExport hook** with no pagination (10k limit), disabled by default, triggered on export
- **exportToCSV utility** added to lib/export.ts alongside existing exportToExcel, both using SheetJS
- **Access logs page** with filter bar (date pickers, gate dropdown, person type dropdown, direction dropdown), paginated DataTable with 8 columns, and CSV export button
- Default date range: last 7 days (enforced to prevent unbounded queries on append-only table)

### Document Repository (AOPS-08)
- **useDocuments hook** with paginated list, search by name, category filter (DB enum: legal/assembly/financial/operational/communication)
- **useDocumentCategories hook** for filter dropdown
- **useCreateDocument mutation** with 3-step flow: upload to Supabase Storage (document-files bucket), insert documents record, insert document_versions record (with storage_path, storage_bucket, file_size_bytes, version_number)
- **useUpdateDocumentVisibility** toggles is_public boolean
- **useDeleteDocument** soft-deletes (sets deleted_at)
- **Documents page** with upload form (name, category dropdown, description, public/signature checkboxes, file picker), search bar, category filter, DataTable with visibility toggle per row

### Amenity Management (AOPS-09, AOPS-10)
- **useAmenities hook** lists all community amenities
- **useAmenity hook** fetches single amenity with rules join
- **useAmenityUtilization hook** queries confirmed/completed reservations for date range
- **useCreateAmenity/useUpdateAmenity mutations** for CRUD
- **useCreateAmenityRule/useUpdateAmenityRule mutations** for rule management (includes community_id as required by schema)
- **Amenities list page** with card grid layout, create form, active toggle per card
- **Amenity detail page** with two-column layout:
  - Left: details card with inline edit, rules card with add/toggle functionality
  - Right: utilization report with date range picker, KPI cards (total bookings, daily rate), AmenityUtilizationChart
- **AmenityUtilizationChart** component with Recharts BarChart for daily bookings and horizontal bar list for peak hours

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Document schema mismatch with actual DB types**
- **Found during:** Task 2
- **Issue:** Plan assumed documents table has `title`, `visibility`, `is_mandatory` columns. Actual schema uses `name`, `is_public` (boolean), `requires_signature`, `category` (enum: legal/assembly/financial/operational/communication). document_versions uses `storage_path`/`storage_bucket`/`file_size_bytes`/`version_number` (not `file_path`/`file_size`).
- **Fix:** Rewrote useDocuments hook and documents page to match actual generated types. Used proper column names, enum values for category, and correct document_versions insert fields.
- **Files modified:** useDocuments.ts, documents/page.tsx
- **Commit:** 0a41627

**2. [Rule 2 - Missing Critical] amenity_rules.community_id required**
- **Found during:** Task 2
- **Issue:** amenity_rules table requires `community_id` on insert (not just amenity_id), but plan omitted this field.
- **Fix:** Added `communityId` from useAuth to useCreateAmenityRule mutation and passed it in the insert payload.
- **Files modified:** useAmenities.ts
- **Commit:** 0a41627

**3. [Rule 1 - Bug] rule_value type mismatch**
- **Found during:** Task 2
- **Issue:** `rule_value` column is typed as `Json` in generated types, but `Record<string, unknown>` was not assignable to `Json`.
- **Fix:** Added `as never` cast for rule_value in the insert to match the pattern used throughout the codebase.
- **Files modified:** useAmenities.ts
- **Commit:** 0a41627

## Verification Results

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` passes | PASS |
| Access logs page with filters | PASS (renders with date range, gate, person type, direction) |
| CSV export function | PASS (exportToCSV added to lib/export.ts) |
| Documents page with upload | PASS (upload form, category filter, visibility toggle) |
| Amenities page with create | PASS (card grid, create form, active toggle) |
| Amenity detail with rules + chart | PASS (inline edit, rule CRUD, utilization chart) |
| All 5 operations sub-routes exist | PASS (tickets, announcements, access-logs, documents, amenities) |

## Commits

| Hash | Message |
|------|---------|
| 0df534b | feat(12-04): access log reports with CSV export |
| 0a41627 | feat(12-04): document repository and amenity management pages |

## Success Criteria

- AOPS-06: Admin can view access log reports with date range and gate filters -- COVERED
- AOPS-07: Admin can export access logs to CSV -- COVERED
- AOPS-08: Admin can manage document repository (upload, categorize, set visibility) -- COVERED
- AOPS-09: Admin can manage amenities (create, edit, set rules and schedules) -- COVERED
- AOPS-10: Admin can view amenity utilization reports -- COVERED
