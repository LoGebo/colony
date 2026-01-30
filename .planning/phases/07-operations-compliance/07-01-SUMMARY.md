---
phase: 07-operations-compliance
plan: 01
subsystem: database
tags: [package-management, mailroom, pickup-codes, hmac, signatures, state-machine]

# Dependency graph
requires:
  - phase: 01-02
    provides: generate_uuid_v7(), update_updated_at() functions
  - phase: 03-04
    provides: HMAC-SHA256 QR verification pattern (pgcrypto)
  - phase: 06-04
    provides: Signature immutability trigger pattern
provides:
  - package_status, package_carrier, pickup_code_type, pickup_code_status enums
  - package_storage_locations table with capacity tracking
  - packages table with 8-state lifecycle and state machine trigger
  - package_pickup_codes table with PIN and QR code support
  - package_signatures table with immutability enforcement
  - HMAC-signed QR payload generation and verification functions
  - Pickup code creation, validation, and usage workflow
affects: [07-02-service-providers, mobile-app, guard-app]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - State machine with trigger-validated transitions
    - HMAC-SHA256 for offline-verifiable pickup codes
    - Automatic status progression on code creation
    - Denormalized storage location counts via trigger
    - Signature immutability with SHA-256 tamper detection

key-files:
  created:
    - supabase/migrations/20260130010800_package_enums.sql
    - supabase/migrations/20260130010900_packages_table.sql
    - supabase/migrations/20260130011000_pickup_codes_signatures.sql

key-decisions:
  - "8-state package lifecycle: received->stored->notified->pending_pickup->picked_up (with returned/forwarded/abandoned branches)"
  - "Mexican carrier enum includes local carriers (Estafeta, Redpack) and e-commerce (Mercado Libre, Amazon)"
  - "Reused Phase 3 HMAC-SHA256 pattern for offline-verifiable QR pickup codes"
  - "Storage location current_count maintained by trigger for real-time capacity tracking"
  - "Package abandonment_date is GENERATED column based on received_at + retention_days"
  - "Pickup code creation auto-transitions package through states to pending_pickup"
  - "Package signatures are immutable (trigger-enforced) for chain of custody compliance"

patterns-established:
  - "State machine transitions validated by CASE statement in trigger"
  - "Multi-step status progression handled by sequential UPDATEs in function"
  - "Vault secret fallback pattern for development environments"
  - "Signature hash computed from package_id + signer + timestamp + IP"

# Metrics
duration: 4min
completed: 2026-01-30
---

# Phase 7 Plan 1: Package Management Schema Summary

**Digital mailroom schema with package tracking, storage locations, HMAC-signed pickup codes, and immutable signature capture for chain of custody**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-30T01:07:53Z
- **Completed:** 2026-01-30T01:12:15Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Package lifecycle management with 8-state machine (received -> picked_up/returned/forwarded/abandoned)
- Storage location tracking with automatic capacity count maintenance
- Pickup codes supporting both 6-digit PINs and HMAC-signed QR codes
- Offline verification capability for guard devices via PowerSync
- Immutable signature capture with ESIGN/UETA compliance metadata
- Full chain of custody audit trail

## Task Commits

Each task was committed atomically:

1. **Task 1: Create package enum types** - `9f4d322` (feat)
   - package_status (8 states)
   - package_carrier (9 Mexican carriers)
   - pickup_code_type (pin, qr)
   - pickup_code_status (active, used, expired, revoked)

2. **Task 2: Create packages and storage locations tables** - `a5f6a25` (feat)
   - package_storage_locations with capacity tracking
   - packages with carrier, recipient, storage, state machine
   - validate_package_transition() trigger
   - update_storage_location_count() trigger
   - abandonment_date GENERATED column

3. **Task 3: Create pickup codes and signatures with HMAC** - `66287ee` (feat)
   - package_pickup_codes table
   - generate_pickup_pin() function
   - generate_pickup_qr_payload() with HMAC-SHA256
   - verify_pickup_qr_payload() for offline verification
   - create_pickup_code() with status auto-progression
   - validate_pickup_code() and use_pickup_code() workflow
   - package_signatures with immutability trigger
   - compute_package_signature_hash() for tamper detection

## Files Created

- `supabase/migrations/20260130010800_package_enums.sql` - 4 package-related enum types
- `supabase/migrations/20260130010900_packages_table.sql` - packages table with state machine, storage locations
- `supabase/migrations/20260130011000_pickup_codes_signatures.sql` - pickup codes with HMAC, immutable signatures

## Decisions Made

1. **8-state lifecycle with validated transitions** - State machine prevents invalid status changes (e.g., received cannot jump to picked_up)
2. **Mexican carrier support** - Includes Estafeta, Redpack, Correos de Mexico, and e-commerce (Mercado Libre, Amazon)
3. **Reused Phase 3 HMAC pattern** - Consistent cryptographic verification across QR codes and pickup codes
4. **Denormalized storage counts** - current_count maintained by trigger for O(1) capacity queries
5. **Auto status progression** - create_pickup_code() transitions through intermediate states automatically
6. **Vault fallback for development** - Functions work in dev without Vault, but production requires proper secrets

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - migrations created successfully.

## User Setup Required

**For production deployment:**
1. Create Vault secret `pickup_qr_secret` with a secure random key
2. Configure storage bucket for package photos (photo_url, label_photo_url)

## Next Phase Readiness

Package management infrastructure complete:
- Guards can receive packages and assign storage locations
- Pickup codes (PIN or QR) can be generated and sent to recipients
- Recipients validate codes for pickup
- Signatures capture chain of custody
- Abandonment tracking enables retention policy enforcement

**Ready for:**
- 07-02: Service Providers & Visitor Management
- Mobile app package pickup flow
- Guard app package receipt workflow
- Notification integration for package arrival

---
*Phase: 07-operations-compliance*
*Completed: 2026-01-30*
