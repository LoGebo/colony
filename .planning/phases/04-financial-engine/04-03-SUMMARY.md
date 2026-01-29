---
phase: 04-financial-engine
plan: 03
subsystem: database
tags: [postgres, interest, delinquency, budgets, hoa, financial-planning]

# Dependency graph
requires:
  - 01-01 (UUID v7, audit triggers, RLS helpers)
  - 01-02 (communities table)
  - 02-01 (units table)
  - 04-01 (accounts table with account_category enum, transactions table)
provides:
  - interest_calculation_method enum
  - interest_rules table with per-community configurable rates
  - calculate_interest() function for overdue amounts
  - delinquency_action_type enum
  - delinquency_triggers table mapping days overdue to actions
  - delinquency_actions audit log table (immutable)
  - budget_status enum
  - budgets table with assembly approval tracking
  - budget_lines table with GENERATED variance column
  - update_budget_totals() trigger for auto-totals
affects:
  - 04-04 (payments will use interest calculation for overdue charges)
  - Future delinquency workflow automation
  - Future budget reporting and variance analysis

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-community configurable financial rules (interest rates approved by assembly)
    - Immutable audit log pattern for delinquency_actions (same as access_logs)
    - GENERATED column for computed variance (actual - budgeted)
    - AFTER trigger for cascading totals update on budget_lines

key-files:
  created:
    - supabase/migrations/20260129190703_interest_enums.sql
    - supabase/migrations/20260129190708_interest_rules.sql
    - supabase/migrations/20260129190922_delinquency_enums.sql
    - supabase/migrations/20260129190930_delinquency_triggers.sql
    - supabase/migrations/20260129191253_budgets.sql
  modified: []

key-decisions:
  - "Interest rules require assembly approval tracking (approved_at, approved_by, assembly_minute_reference)"
  - "calculate_interest() supports 4 methods: simple, compound_monthly, compound_daily, flat_fee"
  - "Delinquency actions are immutable audit trail (prevent_delinquency_action_modification trigger)"
  - "Delinquency triggers have UNIQUE constraint on (community_id, days_overdue, action_type)"
  - "Budget variance is GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED"
  - "Budget totals auto-calculated by update_budget_totals() AFTER trigger on budget_lines"

patterns-established:
  - "Pattern: Assembly approval - approved_at, approved_by, assembly_minute_reference for rate/budget changes"
  - "Pattern: Configurable escalation - days_overdue threshold triggers automated actions"
  - "Pattern: Balance snapshot - delinquency_actions captures balance_at_action for audit"
  - "Pattern: GENERATED column - variance computed at storage time, not query time"

# Metrics
duration: 10min
completed: 2026-01-29
---

# Phase 04 Plan 03: Interest Rules & Delinquency Summary

**Configurable interest calculation with assembly approval, automated delinquency escalation, and budget tracking with GENERATED variance column**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-29T19:04:51Z
- **Completed:** 2026-01-29T19:14:50Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments

- Created interest_calculation_method enum with 4 calculation types (simple, compound_monthly, compound_daily, flat_fee)
- Created interest_rules table with per-community configurable rates and assembly approval tracking
- Created calculate_interest() function supporting all methods with grace period and caps
- Created delinquency_action_type enum with 9 action types for escalation workflow
- Created delinquency_triggers table mapping days overdue to automated actions
- Created delinquency_actions table as immutable audit log (same pattern as access_logs)
- Created budget_status enum with 4 states (draft, approved, active, closed)
- Created budgets and budget_lines tables with GENERATED variance column
- Created update_budget_totals() trigger for auto-calculating income/expense totals

## Task Commits

Each task was committed atomically:

1. **Task 1: Create interest rules and calculate_interest function** - `3d1318c` (feat)
2. **Task 2: Create delinquency triggers and actions tables** - `cb3a80c` (feat)
3. **Task 3: Create budgets and budget_lines tables** - `78d0295` (committed with 04-02 summary due to timing)

## Files Created/Modified

- `supabase/migrations/20260129190703_interest_enums.sql` - interest_calculation_method enum
- `supabase/migrations/20260129190708_interest_rules.sql` - interest_rules table and calculate_interest() function
- `supabase/migrations/20260129190922_delinquency_enums.sql` - delinquency_action_type enum
- `supabase/migrations/20260129190930_delinquency_triggers.sql` - delinquency_triggers and delinquency_actions tables
- `supabase/migrations/20260129191253_budgets.sql` - budget_status enum, budgets table, budget_lines table

## Decisions Made

1. **Assembly approval tracking:** Interest rules and budgets require approval tracking (approved_at, approved_by, assembly_minute_reference) per Mexican HOA law requirement.

2. **Interest calculation caps:** Both max_rate_percentage and max_amount caps supported to prevent runaway interest accumulation.

3. **Immutable delinquency actions:** delinquency_actions uses same immutability pattern as access_logs and ledger_entries - RAISE EXCEPTION on UPDATE/DELETE via trigger.

4. **GENERATED variance column:** budget_lines.variance is computed as `actual_amount - budgeted_amount` and stored (not computed at query time) for performance.

5. **AFTER trigger for totals:** update_budget_totals() runs AFTER INSERT/UPDATE/DELETE on budget_lines to maintain budgets.total_income and total_expense.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed incorrect trigger function name**
- **Found during:** Task 1 (interest_rules migration)
- **Issue:** Used `update_updated_at()` which doesn't exist; project uses `set_audit_fields()`
- **Fix:** Changed trigger to use `set_audit_fields()` matching existing pattern
- **Files modified:** supabase/migrations/20260129190708_interest_rules.sql
- **Verification:** Migration applied successfully
- **Committed in:** 3d1318c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor - trigger function naming convention corrected. No scope creep.

## Issues Encountered

- **Task 3 commit timing:** The budgets migration was inadvertently committed alongside 04-02-SUMMARY.md due to file timing overlap. The migration is correctly applied and tracked; commit attribution is suboptimal but functionality is complete.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Phase 04 Plan 04: Bank reconciliation can use interest calculation for statement matching
- Future delinquency automation workflow can trigger actions based on delinquency_triggers
- Budget variance reporting can query budget_lines with pre-computed variance

**No blockers identified.**

## Key Database Objects Created

### Enums
- `interest_calculation_method`: simple, compound_monthly, compound_daily, flat_fee
- `delinquency_action_type`: 9 values (reminder_email, reminder_sms, late_fee, interest_charge, service_restriction, payment_plan_offer, legal_warning, collection_referral, service_suspension)
- `budget_status`: draft, approved, active, closed

### Tables
- `interest_rules`: Per-community configurable interest rates with assembly approval
- `delinquency_triggers`: Maps days overdue to automated actions
- `delinquency_actions`: Immutable audit log of enforcement actions
- `budgets`: Annual/periodic budgets with auto-calculated totals
- `budget_lines`: Links budget to chart of accounts with GENERATED variance

### Functions
- `calculate_interest(community_id, principal, days_overdue, as_of_date)`: Computes interest based on applicable rule
- `update_budget_totals()`: Trigger function that sums income/expense from budget_lines
- `prevent_delinquency_action_modification()`: Enforces immutability on delinquency_actions

---
*Phase: 04-financial-engine*
*Completed: 2026-01-29*
