---
phase: 08-governance-analytics
plan: 05
subsystem: access-devices
tags: [access-control, inventory, lifecycle, deposits, audit-trail]
dependency-graph:
  requires: [02-01, 02-02, 03-01, 07-02]
  provides: [access_device_types, access_devices, access_device_assignments, access_device_events]
  affects: [future-billing-integration, future-access-control-ui]
tech-stack:
  added: []
  patterns: [polymorphic-assignee, lifecycle-state-machine, trigger-based-audit, inventory-tracking]
key-files:
  created:
    - supabase/migrations/20260130043837_access_device_enums.sql
    - supabase/migrations/20260130043911_access_devices_tables.sql
    - supabase/migrations/20260130044016_access_device_lifecycle.sql
  modified: []
decisions:
  - id: access-device-polymorphic-assignee
    choice: "Exactly one of unit_id, resident_id, guard_id, provider_personnel_id"
    rationale: "Devices can be assigned to different entity types; CHECK constraint ensures data integrity"
  - id: partial-unique-active-assignment
    choice: "Partial unique index on access_device_id WHERE is_active = true"
    rationale: "Prevents multiple active assignments per device while preserving history"
  - id: device-event-immutability
    choice: "access_device_events is append-only (RLS blocks direct INSERT)"
    rationale: "Complete audit trail for compliance; all events go through log_device_event()"
  - id: trigger-based-status-update
    choice: "Trigger updates device status on assignment INSERT/UPDATE"
    rationale: "Guarantees consistency between assignments and device status"
metrics:
  duration: 5 min
  completed: 2026-01-30
---

# Phase 08 Plan 05: Access Device Lifecycle Summary

Access device inventory management with type definitions, serial number tracking, polymorphic assignments, deposit/replacement fee handling, and complete audit trail via lifecycle events.

## What Was Built

### Enum Types
- **device_type**: rfid_tag, rfid_card, remote, physical_key, transponder, biometric
- **device_status**: in_inventory, assigned, lost, damaged, deactivated, retired

### Tables

**access_device_types**
- Device category definitions per community
- Deposit and replacement fee configuration
- Optional access_point_ids array for restricting which points device can open
- Unique constraint on (community_id, name)

**access_devices**
- Individual device inventory with serial_number and internal_code
- Batch tracking (batch_number, purchased_at, vendor)
- Status lifecycle with status_changed_at timestamp
- Denormalized current_assignment_id for O(1) lookup
- Lost/damaged/deactivation tracking fields

**access_device_assignments**
- Polymorphic assignee (unit, resident, guard, provider_personnel)
- Deposit tracking (collected, amount, returned_at)
- Return condition tracking (good, damaged, lost, not_returned)
- Partial unique index ensures one active assignment per device

**access_device_events**
- Immutable audit trail for all lifecycle events
- Event types: created, assigned, returned, lost, found, damaged, deactivated, reactivated, retired
- JSONB metadata for event-specific details

### Functions

| Function | Purpose |
|----------|---------|
| `assign_device(device_id, unit_id, resident_id, guard_id, provider_personnel_id, collect_deposit)` | Safely assign device with validation, deposit tracking |
| `return_device(assignment_id, condition, notes)` | Process return with condition-based status updates |
| `report_device_lost(device_id, notes)` | Report lost device, auto-charges replacement fee |
| `deactivate_device(device_id, reason)` | Security deactivate (must not be assigned) |
| `reactivate_device(device_id)` | Restore device to inventory |
| `log_device_event(device_id, type, description, metadata)` | Internal helper for event logging |

### Triggers

- **access_device_assignment_status**: Updates device status on assignment/return
- **access_device_created**: Logs 'created' event when device added

### Views

- **access_device_inventory**: Summary by device type with status counts (available, assigned, lost, damaged, deactivated, retired)

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create access device enum types | 8f0b630 | 20260130043837_access_device_enums.sql |
| 2 | Create device inventory tables | 0a8ed3f | 20260130043911_access_devices_tables.sql |
| 3 | Create lifecycle functions | 7f42728 | 20260130044016_access_device_lifecycle.sql |

## Key Design Patterns

### Polymorphic Assignment
```sql
CONSTRAINT assignments_exactly_one_assignee CHECK (
  (unit_id IS NOT NULL)::INT +
  (resident_id IS NOT NULL)::INT +
  (guard_id IS NOT NULL)::INT +
  (provider_personnel_id IS NOT NULL)::INT = 1
)
```
Allows devices to be assigned to different entity types while ensuring exactly one assignee per assignment.

### Lifecycle State Machine
```
in_inventory --[assign]--> assigned --[return good]--> in_inventory
                                   --[return damaged]--> damaged
                                   --[return lost]--> lost
           --[deactivate]--> deactivated --[reactivate]--> in_inventory
lost/damaged --[reactivate]--> in_inventory
any --[retire]--> retired (terminal)
```

### Trigger-Based Consistency
The `update_device_on_assignment()` trigger ensures:
- Device status always matches assignment state
- Events are logged automatically
- Assignment is_active flag is updated on return

## Deviations from Plan

None - plan executed exactly as written.

## Verification Commands

```sql
-- Create device type with deposit
INSERT INTO access_device_types (community_id, device_type, name, deposit_amount, replacement_fee)
VALUES ('community-id', 'remote', 'Main Gate Remote', 500.00, 800.00);

-- Create device
INSERT INTO access_devices (community_id, device_type_id, serial_number, internal_code)
VALUES ('community-id', 'device-type-id', 'RMT-2026-00001', 'RF-ABC123');
-- Verify: status = 'in_inventory', event logged

-- Assign to unit
SELECT assign_device('device-id', p_unit_id := 'unit-id', p_collect_deposit := true);
-- Verify: status = 'assigned', current_assignment_id set, deposit_collected = true

-- Return in good condition
SELECT return_device('assignment-id', 'good', 'Perfect condition');
-- Verify: status = 'in_inventory', deposit_returned_at set

-- Report lost
SELECT assign_device('device-id', p_resident_id := 'resident-id');
SELECT report_device_lost('device-id', 'Stolen from car');
-- Verify: status = 'lost', replacement_fee_charged = true

-- Reactivate
SELECT reactivate_device('device-id');
-- Verify: status = 'in_inventory'

-- Check inventory summary
SELECT * FROM access_device_inventory WHERE community_id = 'community-id';
```

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Dependencies satisfied:**
- units table from 02-01
- residents table from 02-02
- guards table from 03-01
- provider_personnel table from 07-02

**Integration points for future:**
- Device deposit/fee could integrate with financial ledger (Phase 4)
- Lost device reports could trigger notifications (Phase 6)
- Inventory dashboard in governance UI
