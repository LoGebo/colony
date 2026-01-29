---
phase: 04-financial-engine
plan: 01
subsystem: database
tags: [postgres, accounting, double-entry, ledger, hoa]

# Dependency graph
requires:
  - 01-01 (UUID v7, audit triggers, RLS helpers)
  - 01-02 (communities table)
  - 02-01 (units table)
  - 02-02 (residents table)
provides:
  - account_category and account_subtype enums
  - accounts table with hierarchical chart of accounts
  - create_standard_chart_of_accounts() function
  - transaction_type and transaction_status enums
  - transactions table with immutability on posted
  - ledger_entries table (append-only, trigger-enforced)
  - update_account_balance() trigger for running balances
  - account_ledger view for reporting
affects:
  - 04-02 (fee structures will use accounts for income/receivable)
  - 04-03 (payments will create transactions and ledger entries)
  - 04-04 (reconciliation will match bank statements to ledger)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Double-entry bookkeeping (debits=positive, credits=negative, sum=0)
    - Append-only ledger with trigger-enforced immutability
    - Running balance on accounts updated by ledger entry trigger
    - balance_after column for O(1) historical balance lookups
    - State machine for transactions (pending->posted immutable)

key-files:
  created:
    - supabase/migrations/20260129185859_account_enums.sql
    - supabase/migrations/20260129185900_accounts_table.sql
    - supabase/migrations/20260129190100_transaction_enums.sql
    - supabase/migrations/20260129190101_transactions_table.sql
    - supabase/migrations/20260129190200_ledger_entries_table.sql
  modified: []

key-decisions:
  - "HOA standard account numbering: 1000s assets, 2000s liabilities, 3000s equity, 4000s income, 5000s expenses, 7000s reserve expenses"
  - "is_operating_fund and is_reserve_fund flags for Mexican HOA compliance (fund separation required by law)"
  - "Positive amounts = debits, negative amounts = credits (single amount column, not separate debit/credit)"
  - "balance_after column on ledger_entries enables O(1) point-in-time balance lookups"
  - "Transactions table uses state machine: pending (mutable) -> posted (immutable) or voided"
  - "Posted transactions can only have reversed_by_transaction_id updated (for linking reversals)"
  - "ledger_entries follows same immutability pattern as access_logs (RAISE EXCEPTION on UPDATE/DELETE)"
  - "Running balance maintained by BEFORE INSERT trigger on ledger_entries"

patterns-established:
  - "Pattern: Immutable ledger - prevent_ledger_entry_modification() trigger blocks UPDATE/DELETE"
  - "Pattern: Transaction posting - validate_posted_transaction() checks entries sum to zero"
  - "Pattern: Running balance - update_account_balance() trigger updates accounts.current_balance"
  - "Pattern: Standard chart - create_standard_chart_of_accounts() seeds HOA accounts for new community"

# Metrics
duration: 4min
completed: 2026-01-29
---

# Phase 04 Plan 01: Chart of Accounts & Double-Entry Ledger Summary

**Double-entry accounting foundation with HOA standard chart, immutable ledger entries, and running balance triggers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-29T18:58:55Z
- **Completed:** 2026-01-29T19:03:02Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments

- Created account_category enum (asset, liability, equity, income, expense)
- Created account_subtype enum with 19 HOA-standard classifications
- Created accounts table with hierarchical structure and fund separation
- Created create_standard_chart_of_accounts() function seeding 25 standard accounts
- Created transaction_type enum (charge, payment, adjustment, interest, reversal, transfer)
- Created transaction_status enum (pending, posted, voided)
- Created transactions table with immutability triggers on posted status
- Created ledger_entries table with append-only enforcement (same pattern as access_logs)
- Created update_account_balance() trigger for O(1) balance queries
- Created account_ledger view joining entries with account/transaction details

## Task Commits

Each task was committed atomically:

1. **Task 1: Create account enums and accounts table** - `bfb15cc` (feat)
2. **Task 2: Create transaction enums and transactions table** - `1324836` (feat)
3. **Task 3: Create ledger_entries table with immutability** - `3ac1d83` (feat)

## Files Created/Modified

- `supabase/migrations/20260129185859_account_enums.sql` - account_category and account_subtype enums
- `supabase/migrations/20260129185900_accounts_table.sql` - accounts table with RLS and standard chart function
- `supabase/migrations/20260129190100_transaction_enums.sql` - transaction_type and transaction_status enums
- `supabase/migrations/20260129190101_transactions_table.sql` - transactions table with immutability triggers
- `supabase/migrations/20260129190200_ledger_entries_table.sql` - ledger_entries (append-only) with balance triggers

## Decisions Made

1. **Single amount column with sign convention:** Positive = debit, negative = credit. Simpler than separate debit/credit columns and standard in modern ledger systems.

2. **balance_after column on ledger entries:** Enables O(1) historical balance lookups without scanning. Critical for generating statements at any point in time.

3. **Mexican HOA fund separation:** is_operating_fund and is_reserve_fund flags on accounts. Mexican condominium law requires clear separation of operating and reserve funds.

4. **Transaction state machine:** pending->posted (or voided). Only pending transactions can be modified. Posted transactions are immutable - corrections via reversal only.

5. **Ledger entry immutability pattern:** Same as access_logs (RAISE EXCEPTION on UPDATE/DELETE). Financial audit trail must be permanent.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all migrations applied successfully.

## Key Database Objects Created

### Enums
- `account_category`: asset, liability, equity, income, expense
- `account_subtype`: 19 values (cash, accounts_receivable, prepaid, fixed_asset, accounts_payable, security_deposits, loans, deferred_income, retained_earnings, reserves, maintenance_fees, special_assessments, late_fees, other_income, utilities, maintenance, administrative, insurance, taxes, reserve_contribution)
- `transaction_type`: charge, payment, adjustment, interest, reversal, transfer
- `transaction_status`: pending, posted, voided

### Tables
- `accounts`: Chart of accounts with hierarchy, fund flags, running balance
- `transactions`: Transaction headers with state machine
- `ledger_entries`: Immutable double-entry entries

### Functions
- `create_standard_chart_of_accounts(community_id)`: Seeds 25 standard HOA accounts
- `prevent_posted_transaction_modification()`: Blocks modification of posted transactions
- `validate_posted_transaction()`: Validates entries sum to zero before posting
- `prevent_ledger_entry_modification()`: Blocks UPDATE/DELETE on ledger entries
- `update_account_balance()`: Updates account running balance on entry insert

### Views
- `account_ledger`: Ledger entries with account and transaction details

## Next Phase Readiness

**Ready for:**
- Phase 04 Plan 02: Fee structures can reference accounts for income/receivable accounts
- Phase 04 Plan 03: Payments can create transactions with balanced ledger entries
- Phase 04 Plan 04: Bank reconciliation can match statement lines to ledger entries

**No blockers identified.**

---
*Phase: 04-financial-engine*
*Completed: 2026-01-29*
