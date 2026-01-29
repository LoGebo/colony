---
phase: 03-access-control-security
plan: 02
subsystem: access-control
tags: [invitations, access-logs, blacklist, visitor-management, immutability]
dependency-graph:
  requires: [03-01]
  provides: [invitations_table, access_logs_table, blacklist_table, is_invitation_valid, is_blacklisted]
  affects: [03-03, 03-04]
tech-stack:
  added: []
  patterns: [polymorphic-check-constraints, trigger-enforced-immutability, brin-index, hash-chain-tamper-detection]
key-files:
  created:
    - supabase/migrations/20260129182509_invitation_type_enum.sql
    - supabase/migrations/20260129182510_invitations_table.sql
    - supabase/migrations/20260129182511_access_logs_table.sql
    - supabase/migrations/20260129182512_blacklist_table.sql
  modified: []
decisions:
  - "Polymorphic invitations with CHECK constraints enforce type-specific fields"
  - "access_logs is append-only with trigger-enforced immutability (no deleted_at/updated_at)"
  - "Hash chain column for tamper detection in access_logs"
  - "Blacklist supports deny_entry, alert_only, call_police protocols"
  - "Evidence arrays for Mexican legal compliance"
metrics:
  duration: 3 min
  completed: 2026-01-29
---

# Phase 3 Plan 02: Invitations & Access Logs Summary

Visitor management with polymorphic invitations, immutable access audit trail, and blacklist enforcement.

## One-Liner

Polymorphic invitations with 5 CHECK constraints; append-only access_logs with BRIN index and trigger-enforced immutability; blacklist with evidence arrays and configurable protocols.

## What Was Built

### Enum Types (1)

1. **invitation_type** - 4 values for visitor invitation types:
   - single_use (one-time entry, burns after use)
   - event (valid for specific date/time window)
   - recurring (regular visits with day-of-week pattern)
   - vehicle_preauth (pre-authorized vehicle by plate)

### Tables (3)

1. **invitations** - Visitor invitations with polymorphic validation
   - 5 CHECK constraints enforce type-specific required fields
   - Generated vehicle_plate_normalized for LPR matching
   - Recurring pattern support (days array, time windows)
   - Event guest tracking (max guests, checked in count)
   - Usage tracking (max_uses, times_used, last_used_at)
   - Cancellation workflow support

2. **access_logs** - IMMUTABLE audit trail of all access events
   - NO deleted_at column (logs never deleted)
   - NO updated_at column (logs never modified)
   - Trigger-enforced immutability via prevent_access_log_modification()
   - BRIN index on logged_at for efficient time-series queries
   - Generated entry_hash column for tamper detection
   - Denormalized person_name for historical accuracy

3. **blacklist_entries** - Banned persons/vehicles with protocols
   - Protocol options: deny_entry, alert_only, call_police
   - Evidence arrays for photos and documents (Mexican legal compliance)
   - Expiry date support for temporary bans
   - Lift workflow (lifted_at, lifted_by, lifted_reason)

### Functions (2)

1. **is_invitation_valid(inv_id, check_time)** - Validates invitation at access time
   - Checks status, cancellation, time window, usage limits
   - Type-specific validation for recurring (day/time) and event (guest count)
   - STABLE, SECURITY DEFINER for performance and security

2. **is_blacklisted(community_id, name, document, plate)** - Checks blacklist
   - Fuzzy name matching (ILIKE)
   - Exact document and plate matching
   - Returns blacklist details including protocol

### Trigger Functions (1)

1. **prevent_access_log_modification()** - Enforces immutability
   - RAISES EXCEPTION on UPDATE or DELETE
   - Attached to access_logs via BEFORE triggers

### RLS Policies (10 total)

**invitations (3 policies):**
- super_admin_all_invitations - Platform admins full access
- residents_own_invitations - Residents manage their own, staff can view
- guards_view_invitations - Guards can view for access validation

**access_logs (4 policies):**
- super_admin_all_access_logs - Platform admins can view/insert
- users_view_own_community_logs - Users can view their community's logs
- guards_insert_logs - Guards/admins can insert new logs
- residents_view_visitor_logs - Residents see their visitor's logs

**blacklist_entries (3 policies):**
- super_admin_all_blacklist - Platform admins full access
- staff_view_blacklist - Guards/admins can view active entries
- admins_manage_blacklist - Admins can manage entries

### Indexes (11)

**invitations (4 indexes):**
- Community lookup (partial on deleted_at)
- Resident lookup (partial on deleted_at)
- Valid invitations for access checking (composite)
- Plate lookup for LPR matching (partial)

**access_logs (6 indexes):**
- BRIN on logged_at (pages_per_range=32)
- Access point + logged_at DESC
- Person ID lookup (partial)
- Community + date lookup
- Invitation lookup (partial)
- Plate detected lookup (partial)

**blacklist_entries (4 indexes):**
- Active entries by community (partial)
- Plate lookup for LPR (partial)
- Document lookup (partial)
- Expiring entries for cleanup (partial)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Polymorphic CHECK constraints | Enforce type-specific fields at DB level, not app level |
| Trigger-enforced immutability | RLS can be bypassed; triggers cannot |
| BRIN index for access_logs | 1000x smaller than B-tree for time-series data |
| Hash chain column | Enables tamper detection for audit compliance |
| Evidence arrays | Mexican law requires documented evidence for blacklisting |
| Three blacklist protocols | Different responses: block, allow-but-alert, block-and-call-police |

## Deviations from Plan

None - plan executed exactly as written.

## Commit History

| Commit | Message | Files |
|--------|---------|-------|
| 875535b | feat(03-02): create invitation_type enum and invitations table | 20260129182509_invitation_type_enum.sql, 20260129182510_invitations_table.sql |
| f1e063a | feat(03-02): create immutable access_logs table | 20260129182511_access_logs_table.sql |
| b4f6138 | feat(03-02): create blacklist_entries table with is_blacklisted function | 20260129182512_blacklist_table.sql |

## Success Criteria Verification

- [x] invitation_type enum has 4 values (single_use, event, recurring, vehicle_preauth)
- [x] invitations table has 5 CHECK constraints for polymorphic validation
- [x] invitations.vehicle_plate_normalized is generated column
- [x] is_invitation_valid() function exists and handles all invitation types
- [x] access_logs table has NO deleted_at or updated_at columns
- [x] access_logs has prevent_access_log_modification() trigger blocking UPDATE/DELETE
- [x] access_logs has BRIN index on logged_at
- [x] access_logs.entry_hash is generated column for tamper detection
- [x] blacklist_entries has protocol CHECK constraint (deny_entry, alert_only, call_police)
- [x] is_blacklisted() function checks name, document, and plate
- [x] All 3 tables have RLS enabled with appropriate policies

## Next Phase Readiness

**Ready for 03-03 (Patrol & Emergency):**
- access_logs available for patrol checkpoint logging
- Guards table ready for patrol assignments

**Ready for 03-04 (QR Codes):**
- invitations table ready for QR code generation
- qr_code_id column in access_logs ready for linking

**Dependencies satisfied:**
- access_points table (from 03-01)
- guards table (from 03-01)
- vehicles table (from 02-02)
- residents table (from 02-01)

## Files Created

```
supabase/migrations/
  20260129182509_invitation_type_enum.sql       (17 lines)
  20260129182510_invitations_table.sql         (234 lines)
  20260129182511_access_logs_table.sql         (145 lines)
  20260129182512_blacklist_table.sql           (180 lines)
```

Total: 576 lines of SQL
