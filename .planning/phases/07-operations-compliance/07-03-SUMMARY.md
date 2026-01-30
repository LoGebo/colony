---
phase: 07-operations-compliance
plan: 03
subsystem: database
tags: [postgres, move-coordination, validations, deposits, workflow]

# Dependency graph
requires:
  - 01-01 (UUID v7, audit triggers, RLS helpers)
  - 01-02 (communities table)
  - 02-01 (units table)
  - 02-02 (residents table)
  - 04-01 (money_amount domain, unit_balances view)
provides:
  - move_type, move_status, validation_status, deposit_status enums
  - move_requests table with scheduling and validation workflow
  - move_validations table with auto-generation trigger
  - move_deposits table with computed refund_amount
  - Workflow functions for deposit processing
affects:
  - 07-04 (violation tracking may reference move validations)
  - Future resident lifecycle management

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Auto-generated validation checklist via AFTER INSERT trigger
    - Computed column (refund_amount GENERATED ALWAYS AS)
    - Workflow state machine with status enums
    - Summary flag auto-updated by validation changes

key-files:
  created:
    - supabase/migrations/20260130010956_move_enums.sql
    - supabase/migrations/20260130011116_move_requests_validations.sql
    - supabase/migrations/20260130011352_move_deposits.sql
  modified: []

key-decisions:
  - "7 validations for move_out (debt_free, keys_returned, vehicles_updated, pets_updated, parking_cleared, inspection_scheduled, deposit_review)"
  - "2 validations for move_in (documentation_signed, deposit_review)"
  - "GENERATED ALWAYS refund_amount column for computed refund after deductions"
  - "Deposit workflow: collected -> held -> inspection_pending -> deductions_pending -> refund_pending -> refunded"
  - "Validation waiver requires waiver_reason (CHECK constraint enforced)"
  - "check_debt_free() function queries unit_balances view from Phase 4"

patterns-established:
  - "Pattern: Auto-generated checklist - AFTER INSERT trigger creates child records based on parent type"
  - "Pattern: Summary flag - Trigger on child table updates parent flag (all_validations_passed)"
  - "Pattern: Workflow functions - process/approve/complete sequence with status validation"
  - "Pattern: Computed refund - GENERATED ALWAYS AS (amount - deduction_amount) STORED"

# Metrics
duration: 8min
completed: 2026-01-30
---

# Phase 07 Plan 03: Move Coordination Summary

**Move request scheduling with auto-generated validation checklists and damage deposit refund workflow**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-30T01:07:50Z
- **Completed:** 2026-01-30T01:16:43Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created move_type enum (move_in, move_out)
- Created move_status enum with 8-state workflow (requested -> completed/cancelled)
- Created validation_status enum (pending, passed, failed, waived)
- Created deposit_status enum with 7-state lifecycle (collected -> refunded/forfeited)
- Created move_requests table with scheduling, moving company, and facility reservations
- Created move_validations table with auto-generation based on move type
- Created create_move_validations() trigger (7 items for move_out, 2 for move_in)
- Created update_validation_summary() trigger for all_validations_passed flag
- Created check_debt_free() function that queries unit_balances view
- Created move_deposits table with computed refund_amount column
- Created workflow functions: process_deposit_refund, approve_deposit_refund, complete_deposit_refund, forfeit_deposit
- Created RLS policies for community-scoped access

## Task Commits

Each task was committed atomically:

1. **Task 1: Create move-related enum types** - `4da28f5` (feat)
2. **Task 2: Create move requests and validations tables** - `92e093b` (feat)
3. **Task 3: Create move deposits table** - `a584b76` (feat)

## Files Created/Modified

- `supabase/migrations/20260130010956_move_enums.sql` - move_type, move_status, validation_status, deposit_status enums
- `supabase/migrations/20260130011116_move_requests_validations.sql` - move_requests and move_validations tables with triggers
- `supabase/migrations/20260130011352_move_deposits.sql` - move_deposits table with workflow functions

## Decisions Made

1. **7 validation items for move_out:** debt_free, keys_returned, vehicles_updated, pets_updated, parking_cleared, inspection_scheduled, deposit_review. Comprehensive checklist ensures nothing missed during move-out.

2. **2 validation items for move_in:** documentation_signed, deposit_review. Minimal checklist for incoming residents focuses on paperwork and deposit.

3. **GENERATED ALWAYS refund_amount:** Computed column ensures refund calculation is always consistent. `refund_amount = amount - COALESCE(deduction_amount, 0)`.

4. **check_debt_free() queries unit_balances:** Reuses Phase 4's unit_balances view for consistent balance checking. Handles missing view gracefully.

5. **Validation waiver enforcement:** CHECK constraint requires waiver_reason when status = 'waived'. Prevents undocumented overrides.

6. **Workflow functions with status validation:** Each function validates current status before transition. Prevents invalid state changes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1. **Migration timestamp collision:** Initial move_enums migration had same timestamp as provider_enums (20260130010810). Resolved by creating new migration with unique timestamp.

2. **Prior migration failure:** packages_table migration had failed previously, blocking push. Repaired migration history to continue.

## Key Database Objects Created

### Enums
- `move_type`: move_in, move_out
- `move_status`: requested, validating, validation_failed, approved, scheduled, in_progress, completed, cancelled
- `validation_status`: pending, passed, failed, waived
- `deposit_status`: collected, held, inspection_pending, deductions_pending, refund_pending, refunded, forfeited

### Tables
- `move_requests`: Move scheduling with company details and facility reservations
- `move_validations`: Pre-move checklist items with status tracking
- `move_deposits`: Damage deposits with inspection and refund workflow

### Functions
- `create_move_validations()`: Auto-generates validation checklist on move request insert
- `update_validation_summary()`: Updates all_validations_passed flag when validations change
- `check_debt_free(uuid)`: Checks if unit has zero or credit balance
- `auto_check_debt_free()`: Auto-updates debt_free validation status
- `update_move_status_timestamp()`: Updates status_changed_at on status change
- `process_deposit_refund(uuid, numeric, text)`: Sets deductions and moves to deductions_pending
- `approve_deposit_refund(uuid)`: Approves deposit for refund
- `complete_deposit_refund(uuid, text, text)`: Marks deposit as refunded
- `forfeit_deposit(uuid, text)`: Forfeits entire deposit

### Triggers
- `trg_create_move_validations` on move_requests
- `trg_update_validation_summary` on move_validations
- `trg_update_move_status_timestamp` on move_requests
- `trg_auto_check_debt_free` on move_validations
- `trg_update_deposit_status_timestamp` on move_deposits
- Audit triggers on all tables

## Validation Checklist Summary

**Move Out (7 items):**
| Validation Type | Description |
|-----------------|-------------|
| debt_free | No outstanding balance (auto-checked) |
| keys_returned | All keys/access devices returned |
| vehicles_updated | Vehicle registry updated |
| pets_updated | Pet registry updated |
| parking_cleared | Parking spot vacated |
| inspection_scheduled | Final inspection scheduled |
| deposit_review | Damage deposit review complete |

**Move In (2 items):**
| Validation Type | Description |
|-----------------|-------------|
| documentation_signed | Required paperwork signed |
| deposit_review | Damage deposit collected/reviewed |

## Deposit Workflow

```
collected -> held -> inspection_pending -> deductions_pending -> refund_pending -> refunded
                                                              \-> forfeited
```

- `process_deposit_refund()`: held/inspection_pending -> deductions_pending
- `approve_deposit_refund()`: deductions_pending -> refund_pending
- `complete_deposit_refund()`: refund_pending -> refunded
- `forfeit_deposit()`: any non-terminal -> forfeited

## Next Phase Readiness

**Ready for:**
- Phase 07 Plan 04: Violation tracking can reference move validations
- Integration with resident lifecycle management
- Move scheduling dashboard with validation status

**No blockers identified.**

---
*Phase: 07-operations-compliance*
*Completed: 2026-01-30*
