# Phase 13 Plan 03: More Tab (Profile, Documents, Vehicles, Packages) Summary

**One-liner:** Built complete "More" tab with profile management, document browser with regulation signing via capture_signature RPC, vehicle CRUD, unit details viewer, and package list with pickup codes.

## What Was Built

### More Tab Layout (packages/mobile/app/(resident)/more/_layout.tsx)
- Stack navigator with 11 screen routes: index, profile/index, profile/unit, vehicles/index, vehicles/create, documents/index, documents/[id], marketplace/index, marketplace/create, marketplace/[id], packages/index.
- `headerShown: false` consistent with other tab layouts.

### More Menu Screen (packages/mobile/app/(resident)/more/index.tsx)
- Section list with 6 menu items: Mi Perfil, Mi Unidad, Mis Vehiculos, Documentos, Marketplace, Mis Paquetes.
- Pending signature badge on Documentos item (orange count from `usePendingSignatures()`).
- Unit label from `useResidentUnit()` displayed below header.
- "Cerrar Sesion" button at bottom calling `signOut()`.

### Profile Editor (packages/mobile/app/(resident)/more/profile/index.tsx)
- Read-only: name, email.
- Editable: phone, phone_secondary via `useUpdateProfile()`.
- Photo: tappable avatar, changes via `pickAndUploadImage('avatars', ...)`.
- Emergency contacts section: list existing contacts, inline edit, add new via `useUpdateEmergencyContact()`.
- Relationship picker (horizontal scroll with spouse/parent/child/sibling/friend/doctor/employer/neighbor/other).

### Unit Details (packages/mobile/app/(resident)/more/profile/unit.tsx)
- Shows all occupancies for current resident via `useResidentOccupancy()`.
- Each occupancy card: unit_number, building, floor_number, occupancy_type badge (owner/tenant/family_member/authorized).
- Read-only with admin info note.

### Vehicle Management (packages/mobile/app/(resident)/more/vehicles/)
- **List screen:** FlatList of vehicles with plate_number, make/model, color circle, year, plate_state, access_enabled badge. Delete button with confirmation Alert.
- **Create screen:** Form with plate_number, plate_state selector (horizontal scroll of 32 Mexican states), make, model, color, year. Validation for required plate and year range.

### Document Browser (packages/mobile/app/(resident)/more/documents/)
- **List screen:** SectionList grouped by category (regulation, policy, guideline, form, template, report, other). Pending signatures section at top with orange highlight. Pull-to-refresh.
- **Detail screen:** Document name, category badge, description, file version info (name, version number, size, upload date), download button (signed URL for private buckets), signature section.
- **Signature flow:** If unsigned regulation: orange "Firma Requerida" section with deadline. "Firmar Documento" button opens SignatureModal. If signed: green checkmark with signed date.

### Document Components (packages/mobile/src/components/documents/)
- **DocumentCard:** Category badge (7 categories with colors), public indicator, signature status (Firmado green / Firma requerida orange).
- **SignatureModal:** Bottom sheet modal with consent checkbox ("He leido y acepto el contenido de este documento"), Firmar/Cancelar buttons, loading state. Calls `useSignDocument()` mutation.

### Package List (packages/mobile/app/(resident)/more/packages/index.tsx)
- Segmented tabs: Pendientes (all non-picked_up) and Recogidos.
- Package cards: carrier, description, recipient name, tracking number, status badge.
- Pickup code display: prominent blue box with code value and expiry date.
- Received/picked_up timestamps.

### Data Hooks (packages/mobile/src/hooks/)
- **useDocuments.ts:** `useMyDocuments()` via get_accessible_documents RPC, `usePendingSignatures()` via get_pending_signatures RPC, `useDocumentDetail()` with version join + signature check, `useSignDocument()` via capture_signature RPC with device metadata.
- **useProfile.ts:** `useResidentProfile()` with emergency contacts join, `useUpdateProfile()` for phone/photo, `useUpdateEmergencyContact()` upsert with relationship enum cast.
- **useVehicles.ts:** `useMyVehicles()`, `useCreateVehicle()`, `useUpdateVehicle()`, `useDeleteVehicle()` (soft-delete).
- **useMyPackages.ts:** `useMyPackages()` via occupancy-based unit resolution with pickup codes join.

## Schema Corrections Applied

During implementation, several schema mismatches between the plan and actual database types were discovered and fixed:

1. **documents table:** Named `documents` not `community_documents` in PostgREST.
2. **document_versions:** Uses `storage_path`, `storage_bucket`, `file_name`, `file_size_bytes`, `change_summary` -- NOT `file_url`, `file_size`, `uploaded_at`, `change_notes`.
3. **vehicles:** No `vehicle_type` or `is_primary` columns. Has `plate_state` (required), `plate_normalized` (auto-generated). Uses `access_enabled` boolean.
4. **emergency_contacts:** Uses `contact_name` (not `name`), `phone_primary` (not `phone`), `community_id` required on insert. `relationship` is enum (spouse|parent|child|sibling|friend|doctor|employer|neighbor|other).
5. **residents:** No `resident_type` or `status` columns. Uses `onboarding_status` instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema mismatch: community_documents vs documents**
- **Found during:** Task 1
- **Issue:** Plan referenced `community_documents` table but PostgREST types have it as `documents`
- **Fix:** Changed all queries to use `documents` table name
- **Files modified:** useDocuments.ts

**2. [Rule 1 - Bug] Schema mismatch: vehicles missing vehicle_type/is_primary**
- **Found during:** Task 1
- **Issue:** Plan assumed `vehicle_type` and `is_primary` columns exist on vehicles table. Actual schema has neither.
- **Fix:** Removed vehicle_type from insert/update, removed is_primary sort. Added `plate_state` (required) and `access_enabled` to queries.
- **Files modified:** useVehicles.ts, vehicles/index.tsx, vehicles/create.tsx

**3. [Rule 1 - Bug] Schema mismatch: emergency_contacts column names**
- **Found during:** Task 1
- **Issue:** Plan used `name`, `phone`, `is_primary` but actual schema has `contact_name`, `phone_primary`, `priority`. Also requires `community_id` on insert.
- **Fix:** Updated all column references and added community_id from useAuth
- **Files modified:** useProfile.ts, profile/index.tsx

**4. [Rule 1 - Bug] Schema mismatch: residents missing resident_type/status**
- **Found during:** Task 1
- **Issue:** Plan queried `resident_type` and `status` columns that don't exist
- **Fix:** Removed `resident_type`, changed `status` to `onboarding_status`. Used spread operator for return.
- **Files modified:** useProfile.ts

**5. [Rule 1 - Bug] Schema mismatch: document_versions column names**
- **Found during:** Task 1
- **Issue:** Plan used `file_url`, `file_size`, `uploaded_at`, `change_notes` but actual schema has `storage_path`, `storage_bucket`, `file_name`, `file_size_bytes`, `created_at`, `change_summary`
- **Fix:** Updated all column references. Document detail screen generates download URL via Supabase Storage API (public or signed URL).
- **Files modified:** useDocuments.ts, documents/[id].tsx

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use `as never` cast for RPC calls | Types not regenerated after migration deployment (established pattern) |
| Platform.OS for device_type in capture_signature | Avoids expo-device dependency; simple 'phone' heuristic sufficient |
| Signed URL fallback for private bucket downloads | Public URL tried first, signed URL generated for private buckets |
| Mexican state abbreviations for plate_state | 32 state codes in horizontal scroll; CDMX as default |
| Occupancy-based package query | Packages queried via resident's unit IDs from occupancies (not direct resident_id) |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 55ff623 | feat | More tab layout and data hooks (documents, profile, vehicles, packages) |
| d86eb09 | feat | More tab screens (profile, vehicles, documents, packages) |

## Files Created

- `packages/mobile/app/(resident)/more/_layout.tsx`
- `packages/mobile/app/(resident)/more/index.tsx`
- `packages/mobile/app/(resident)/more/profile/index.tsx`
- `packages/mobile/app/(resident)/more/profile/unit.tsx`
- `packages/mobile/app/(resident)/more/vehicles/index.tsx`
- `packages/mobile/app/(resident)/more/vehicles/create.tsx`
- `packages/mobile/app/(resident)/more/documents/index.tsx`
- `packages/mobile/app/(resident)/more/documents/[id].tsx`
- `packages/mobile/app/(resident)/more/packages/index.tsx`
- `packages/mobile/src/hooks/useDocuments.ts`
- `packages/mobile/src/hooks/useProfile.ts`
- `packages/mobile/src/hooks/useVehicles.ts`
- `packages/mobile/src/hooks/useMyPackages.ts`
- `packages/mobile/src/components/documents/DocumentCard.tsx`
- `packages/mobile/src/components/documents/SignatureModal.tsx`

## Metrics

- **Duration:** ~9 min
- **Completed:** 2026-02-08
- **Tasks:** 2/2
- **Files created:** 15
- **Lines of code:** ~1870
