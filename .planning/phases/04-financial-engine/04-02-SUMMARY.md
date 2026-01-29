---
phase: 04-financial-engine
plan: 02
subsystem: database
tags: [postgres, accounting, fees, payments, double-entry, hoa, mexican-indiviso]

# Dependency graph
requires:
  - 04-01 (accounts table, transactions, ledger_entries, double-entry infrastructure)
  - 02-01 (units table with coefficient for fee calculation)
  - 01-02 (communities table)
provides:
  - fee_calculation_type enum (fixed, coefficient, hybrid, tiered, custom)
  - fee_frequency enum (monthly, bimonthly, quarterly, semiannual, annual, one_time)
  - fee_structures table with formula configuration
  - fee_schedules table linking fees to units
  - calculate_fee_amount() function using unit coefficient
  - get_unit_fee_amount() wrapper checking overrides
  - payment_methods table with Mexican payment types
  - create_default_payment_methods() seed function
  - record_payment() function creating double-entry transactions
  - record_charge() function creating double-entry transactions
  - generate_transaction_reference() helper function
affects:
  - 04-03 (billing batch processing will use fee_schedules and record_charge)
  - 04-04 (bank reconciliation will match to payments recorded via record_payment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Mexican indiviso coefficient calculation (base_amount * coefficient / 100)
    - Hybrid fee formula (fixed base + proportional coefficient portion)
    - Double-entry payment recording (Debit bank, Credit receivable)
    - Double-entry charge recording (Debit receivable, Credit income)
    - Override pattern for fee exceptions (override_amount on schedules)
    - Transaction reference generation (PREFIX-YYYY-NNNNN format)

key-files:
  created:
    - supabase/migrations/20260129190520_fee_enums.sql
    - supabase/migrations/20260129190545_fee_structures_table.sql
    - supabase/migrations/20260129190827_fee_schedules.sql
    - supabase/migrations/20260129190953_payment_methods.sql
    - supabase/migrations/20260129191023_record_payment_charge.sql
  modified: []

key-decisions:
  - "Coefficient calculation divides by 100 (coefficient stored as percentage 1.5 = 1.5%)"
  - "Fee schedules allow override_amount for special arrangements without changing fee structure"
  - "Payment methods include requires_proof flag for SPEI/transfer verification workflow"
  - "record_payment/record_charge auto-post transactions after creating balanced entries"
  - "Transaction references use PREFIX-YYYY-NNNNN format (PAY/CHG sequences per community per year)"
  - "Default payment methods: SPEI, Transferencia, Efectivo, Tarjeta, Cheque"

patterns-established:
  - "Pattern: Mexican indiviso - base_amount * (unit.coefficient / 100) for proportional fees"
  - "Pattern: Hybrid fees - base_amount + (coefficient_amount * unit.coefficient / 100)"
  - "Pattern: Fee schedule override - check override_amount before calculating"
  - "Pattern: Transaction reference - generate_transaction_reference(community, prefix, date)"
  - "Pattern: Record transaction - create pending, insert entries, post (validates sum=0)"

# Metrics
duration: 8min
completed: 2026-01-29
---

# Phase 04 Plan 02: Fee Structures & Charges Summary

**Fee structures with Mexican indiviso coefficient calculation, fee schedules with override support, and record_payment/record_charge functions creating balanced double-entry transactions**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-29T19:04:58Z
- **Completed:** 2026-01-29T19:12:41Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments

- Created fee_calculation_type enum supporting 5 calculation methods (fixed, coefficient, hybrid, tiered, custom)
- Created fee_structures table with formula configuration linking to income and receivable accounts
- Created fee_schedules junction table with override support for special arrangements
- Created calculate_fee_amount() function implementing Mexican indiviso coefficient formula
- Created get_unit_fee_amount() wrapper that checks overrides before calculating
- Created payment_methods table with 5 standard Mexican payment types
- Created record_payment() function that creates balanced double-entry (Debit bank, Credit receivable)
- Created record_charge() function that creates balanced double-entry (Debit receivable, Credit income)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create fee enums and fee_structures table** - `9c1a857` (feat)
2. **Task 2: Create fee_schedules and calculate_fee_amount function** - `1a724dd` (feat)
3. **Task 3: Create payment_methods and payment/charge recording functions** - `3edae81` (feat)

## Files Created/Modified

- `supabase/migrations/20260129190520_fee_enums.sql` - fee_calculation_type and fee_frequency enums
- `supabase/migrations/20260129190545_fee_structures_table.sql` - fee_structures table with RLS
- `supabase/migrations/20260129190827_fee_schedules.sql` - fee_schedules table and calculate_fee_amount functions
- `supabase/migrations/20260129190953_payment_methods.sql` - payment_methods table and seed function
- `supabase/migrations/20260129191023_record_payment_charge.sql` - record_payment and record_charge functions

## Decisions Made

1. **Coefficient stored as percentage:** Unit coefficient of 1.5 means 1.5% of total budget. Formula: base_amount * (coefficient / 100).

2. **Override pattern on fee_schedules:** Allow override_amount with override_reason for special cases (discounts, exemptions) without modifying the fee structure template.

3. **Payment method requires_proof flag:** SPEI and bank transfers require proof upload for verification. Cash payments do not.

4. **Auto-post pattern:** record_payment() and record_charge() create transaction in pending state, insert ledger entries, then post. Posting validates entries sum to zero.

5. **Reference number format:** PREFIX-YYYY-NNNNN (e.g., PAY-2026-00001, CHG-2026-00001). Sequence resets per year per community.

6. **Default Mexican payment methods:** SPEI (most common electronic), Transferencia Bancaria, Efectivo, Tarjeta, Cheque - ordered by typical usage.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1. **Stale migration files from previous session:** Found interest_rules and delinquency migrations in local filesystem that had been partially applied. Repaired migration history and removed conflicting files before proceeding.

## User Setup Required

None - no external service configuration required.

## Key Database Objects Created

### Enums
- `fee_calculation_type`: fixed, coefficient, hybrid, tiered, custom
- `fee_frequency`: monthly, bimonthly, quarterly, semiannual, annual, one_time

### Tables
- `fee_structures`: Fee templates with formula configuration and account links
- `fee_schedules`: Junction linking fees to units with override support
- `payment_methods`: Available payment types per community

### Functions
- `calculate_fee_amount(fee_structure_id, unit_id)`: Core coefficient calculation
- `get_unit_fee_amount(unit_id, fee_structure_id, as_of_date)`: Wrapper checking overrides
- `generate_transaction_reference(community_id, prefix, date)`: Reference number generator
- `record_payment(...)`: Creates payment transaction with double-entry
- `record_charge(...)`: Creates charge transaction with double-entry
- `create_default_payment_methods(community_id)`: Seeds standard Mexican payment methods

## Next Phase Readiness

**Ready for:**
- Phase 04 Plan 03: Billing batch can use fee_schedules to iterate units and record_charge() for each
- Phase 04 Plan 04: Bank reconciliation can match statement lines to payments created via record_payment()

**No blockers identified.**

---
*Phase: 04-financial-engine*
*Completed: 2026-01-29*
