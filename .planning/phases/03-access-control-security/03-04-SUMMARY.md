---
phase: 03-access-control-security
plan: 04
subsystem: database
tags: [qr-codes, hmac, pgcrypto, emergency-alerts, sla-tracking, dispatch-workflow]

# Dependency graph
requires:
  - phase: 03-01
    provides: access_points table, guards table
  - phase: 03-02
    provides: invitations table, access_logs table
  - phase: 01-02
    provides: emergency_type and priority_level enums
provides:
  - qr_status and emergency_status enum types
  - qr_codes table with HMAC-SHA256 signature support
  - generate_qr_payload() and verify_qr_payload() functions for offline verification
  - burn_qr_code() function for single-use code consumption
  - emergency_alerts table with SLA timestamp tracking
  - emergency_responders junction table for guard dispatch
  - set_emergency_priority() trigger for auto-priority
  - get_emergency_sla_metrics() function for reporting
affects: [phase-4-financial, phase-5-amenities, mobile-app, guard-app]

# Tech tracking
tech-stack:
  added: [pgcrypto]
  patterns: [hmac-sha256-signatures, offline-verifiable-tokens, state-machine-workflow, sla-tracking]

key-files:
  created:
    - supabase/migrations/20260129183045_qr_status_enum.sql
    - supabase/migrations/20260129183233_qr_codes_table.sql
    - supabase/migrations/20260129183348_emergency_alerts_tables.sql
  modified:
    - supabase/migrations/20260129182511_access_logs_table.sql

key-decisions:
  - "HMAC-SHA256 for QR signatures enables offline verification on guard devices"
  - "QR payload format: {id}|{community_id}|{expiry_epoch}|{signature} for compact encoding"
  - "Emergency alerts are permanent audit trail (no soft delete)"
  - "Auto-priority based on emergency_type: panic/fire/disaster=critical, medical=urgent, intrusion=high"
  - "Responder timeline updates propagate to alert timestamps via trigger"

patterns-established:
  - "HMAC signatures with secret_key from Vault, not regular tables"
  - "State machine columns with timestamp tracking for SLA metrics"
  - "Junction tables with individual timing for dispatch workflows"
  - "Trigger-computed columns when GENERATED ALWAYS requires non-immutable expressions"

# Metrics
duration: 5min
completed: 2026-01-29
---

# Phase 3 Plan 4: Emergency Alerts & QR Codes Summary

**QR code system with HMAC-SHA256 offline verification and emergency dispatch workflow with SLA timestamp tracking**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-29T18:30:32Z
- **Completed:** 2026-01-29T18:35:10Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- QR codes with cryptographic HMAC-SHA256 signatures for offline verification on guard devices
- Emergency alert state machine (triggered -> acknowledged -> responding -> on_scene -> resolved)
- SLA tracking with timestamps at each workflow stage
- Auto-priority assignment based on emergency type (panic/fire=critical, medical=urgent)
- Responder timeline propagation to alert via triggers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create QR and emergency status enum types** - `b6329e0` (feat)
2. **Task 2: Create qr_codes table with signature functions** - `4472f24` (feat)
3. **Task 3: Create emergency_alerts and emergency_responders tables** - `46c9f51` (feat)

## Files Created/Modified

- `supabase/migrations/20260129183045_qr_status_enum.sql` - qr_status and emergency_status enums, pgcrypto extension
- `supabase/migrations/20260129183233_qr_codes_table.sql` - qr_codes table, generate/verify/burn functions
- `supabase/migrations/20260129183348_emergency_alerts_tables.sql` - emergency_alerts, emergency_responders, triggers, SLA function
- `supabase/migrations/20260129182511_access_logs_table.sql` - Fixed hash column from GENERATED to trigger-computed

## Decisions Made

1. **HMAC-SHA256 for offline verification** - Allows guard devices with PowerSync to verify QR codes without network connectivity
2. **QR payload format standardized** - `{id}|{community_id}|{expiry_epoch}|{signature}` is compact and parseable
3. **Emergency records are permanent** - No deleted_at column; these are legal audit records
4. **Responder timeline triggers** - Individual guard timestamps propagate to alert-level timestamps automatically
5. **Trigger-computed hash instead of GENERATED column** - PostgreSQL requires IMMUTABLE expressions for GENERATED columns, but `now()` is not immutable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed access_logs entry_hash column**
- **Found during:** Task 1 (applying migrations)
- **Issue:** GENERATED ALWAYS column used `logged_at` which defaults to `now()` - PostgreSQL requires IMMUTABLE expressions for generated columns
- **Fix:** Changed entry_hash from GENERATED ALWAYS to regular column, added `compute_access_log_hash()` trigger function
- **Files modified:** supabase/migrations/20260129182511_access_logs_table.sql
- **Verification:** Migration applied successfully
- **Committed in:** b6329e0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking issue preventing migration)
**Impact on plan:** Essential fix for migration to apply. Same hash computation logic, different implementation approach.

## Issues Encountered

None beyond the blocking issue documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 3 Complete:**
- All access control tables created (access_points, guards, shifts, invitations, access_logs, blacklist, patrol routes, QR codes, emergency alerts)
- Ready for Phase 4 (Financial) to add payment and billing tables
- Emergency alerts integrate with future notification system (Phase 7)

**Ready for mobile app development:**
- QR signature functions ready for PowerSync offline verification
- Emergency panic button can trigger alerts from any authenticated user
- Guard dispatch workflow supports real-time status updates

---
*Phase: 03-access-control-security*
*Completed: 2026-01-29*
