# Phase 4: Financial Engine - Research

**Researched:** 2026-01-29
**Domain:** Double-entry accounting, property management fees, payments, reconciliation, and delinquency management for Mexican condominiums
**Confidence:** HIGH

## Summary

This phase implements the financial backbone for UPOE: a double-entry accounting system tailored for Mexican residential communities (condominios). The research focused on seven key questions: (1) double-entry patterns for property management, (2) fee calculation formulas using the Mexican "indiviso" coefficient, (3) Mexican SAT/CFDI compliance considerations, (4) interest/penalty calculation patterns (moratorios), (5) bank reconciliation workflows, (6) transaction immutability vs adjustment patterns, and (7) balance calculation strategies.

The standard approach uses append-only ledger entries with trigger-enforced immutability, a hierarchical chart of accounts following HOA/property management standards (1000s-5000s numbering), fee structures supporting fixed, coefficient-based (indiviso), and hybrid formulas, and configurable interest rules per community (since Mexico has no federal limit on moratorium interest). Corrections are handled via reversing entries rather than mutations. Balance calculations use a hybrid approach: running totals on accounts for real-time queries with periodic materialized view refresh for reporting.

**Primary recommendation:** Build an immutable double-entry ledger with separate account types for operating funds and reserve funds. Use the existing money_amount NUMERIC(15,4) domain. Enforce balance (debits = credits) via database constraints. Model fee structures as templates that generate periodic charges. Handle all corrections through reversing entries, never mutations.

## Standard Stack

This phase is pure PostgreSQL/Supabase schema work, continuing from Phase 1-3 patterns.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15+ | Double-entry ledger with triggers, constraints | Supabase default, ACID guarantees essential for financial data |
| money_amount domain | From Phase 1 | NUMERIC(15,4) for all monetary values | Already established, GAAP-compliant precision |
| money_amount_signed domain | From Phase 1 | NUMERIC(15,4) allowing negative values | For debit/credit entries |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| CHECK constraints | Enforce debit/credit balance | Every transaction must sum to zero |
| Triggers | Enforce immutability, auto-generate entries | Prevent mutations on posted entries |
| Materialized views | Balance reporting, statement generation | Periodic refresh for performance |
| BRIN indexes | Time-series queries on ledger entries | Tables > 100K rows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single ledger table | Separate debit/credit tables | Single table chosen: simpler queries, standard double-entry pattern |
| Materialized view balances | Trigger-updated balance columns | Hybrid chosen: running balance on accounts + periodic materialized views for reports |
| ISO 20022 statement import | Custom CSV parsing | Start with CSV/simple formats, add ISO 20022 later if needed |

## Architecture Patterns

### Recommended Schema Structure

```
public/
  -- Chart of Accounts
  account_types (asset, liability, equity, income, expense)
  accounts (hierarchical chart of accounts per community)

  -- Core Ledger
  transactions (immutable transaction headers - payments, charges, adjustments)
  ledger_entries (immutable debit/credit entries linked to transactions)

  -- Fee Management
  fee_structures (templates: fixed, coefficient, hybrid)
  fee_schedules (which units pay which fees, when)
  charges (generated periodic charges from fee structures)

  -- Payments
  payment_methods (bank transfer, card, cash, SPEI)
  payments (actual payments received)
  payment_proofs (uploaded proof images with validation workflow)

  -- Interest & Delinquency
  interest_rules (configurable per community)
  delinquency_triggers (days overdue -> action mapping)
  delinquency_actions (generated actions: reminder, penalty, suspension)

  -- Bank Reconciliation
  bank_accounts (community bank accounts)
  bank_statements (imported statement headers)
  bank_statement_lines (individual statement transactions)
  reconciliation_matches (matched statement lines to ledger entries)
```

### Pattern 1: Immutable Double-Entry Ledger with Trigger Enforcement

**What:** Append-only ledger entries that block UPDATE and DELETE at database level
**When to use:** Any financial audit trail requiring legal/compliance immutability
**Why:** Database-enforced immutability cannot be bypassed by application bugs

```sql
-- Source: Modern Treasury patterns + Square Books implementation
CREATE TYPE transaction_type AS ENUM (
  'charge',           -- Fee charged to unit
  'payment',          -- Payment received
  'adjustment',       -- Correction entry
  'interest',         -- Interest/penalty applied
  'reversal',         -- Reverses a prior transaction
  'transfer'          -- Internal transfer between accounts
);

CREATE TYPE transaction_status AS ENUM (
  'pending',          -- Mutable while processing
  'posted',           -- Immutable, finalized
  'voided'            -- Cancelled (via reversal, not deletion)
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Transaction identification
  transaction_type transaction_type NOT NULL,
  reference_number TEXT NOT NULL,           -- Human-readable: PAY-2026-00001
  description TEXT NOT NULL,

  -- Related entities
  unit_id UUID REFERENCES units(id),        -- Which unit this affects
  resident_id UUID REFERENCES residents(id),-- Who is responsible

  -- Total amount (sum of entries must equal this for validation)
  amount money_amount NOT NULL,
  currency currency_code NOT NULL DEFAULT 'MXN',

  -- Status (mutable only while pending)
  status transaction_status NOT NULL DEFAULT 'pending',
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),

  -- Reversal tracking
  reverses_transaction_id UUID REFERENCES transactions(id),
  reversed_by_transaction_id UUID REFERENCES transactions(id),

  -- Effective date (when it counts for accounting)
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Unique reference per community
  CONSTRAINT transactions_ref_unique UNIQUE (community_id, reference_number)
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id),

  -- Debit is positive, credit is negative
  -- Sum of all entries in a transaction MUST equal zero
  amount money_amount_signed NOT NULL,

  -- Running balance after this entry (for historical queries)
  balance_after money_amount_signed,
  entry_sequence INTEGER NOT NULL,         -- Order within transaction

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Enforce entries sum to zero per transaction
  -- (validated by trigger, not constraint - constraints can't span rows)
  CONSTRAINT ledger_entries_nonzero CHECK (amount != 0)
);

-- CRITICAL: Enforce immutability on posted transactions
CREATE OR REPLACE FUNCTION prevent_posted_transaction_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Cannot delete posted transaction %', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'posted' THEN
      -- Only allow updating reversed_by_transaction_id on posted transactions
      IF NEW.status != OLD.status OR NEW.amount != OLD.amount OR
         NEW.transaction_type != OLD.transaction_type THEN
        RAISE EXCEPTION 'Cannot modify posted transaction %. Create a reversal instead.', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_immutable
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_transaction_modification();

-- Ledger entries are ALWAYS immutable (even for pending transactions)
CREATE OR REPLACE FUNCTION prevent_ledger_entry_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % operations are not allowed', TG_OP;
END;
$$;

CREATE TRIGGER ledger_entries_immutable_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_entry_modification();

CREATE TRIGGER ledger_entries_immutable_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_entry_modification();

-- Validate transaction balance on insert
CREATE OR REPLACE FUNCTION validate_transaction_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  entry_sum NUMERIC(15, 4);
BEGIN
  -- Calculate sum of all entries for this transaction
  SELECT COALESCE(SUM(amount), 0) INTO entry_sum
  FROM ledger_entries
  WHERE transaction_id = NEW.transaction_id;

  -- Add the new entry
  entry_sum := entry_sum + NEW.amount;

  -- Note: We allow non-zero during entry creation
  -- Final validation happens when posting the transaction
  RETURN NEW;
END;
$$;

-- Validate balance when posting transaction
CREATE OR REPLACE FUNCTION validate_posted_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  entry_sum NUMERIC(15, 4);
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'pending' THEN
    SELECT COALESCE(SUM(amount), 0) INTO entry_sum
    FROM ledger_entries
    WHERE transaction_id = NEW.id;

    IF entry_sum != 0 THEN
      RAISE EXCEPTION 'Cannot post transaction %: entries sum to % (must be 0)',
        NEW.id, entry_sum;
    END IF;

    NEW.posted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_transaction_on_post
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_posted_transaction();
```

### Pattern 2: Hierarchical Chart of Accounts with HOA Standard Numbering

**What:** Account hierarchy following property management industry standards
**When to use:** All communities need standardized account categorization
**Why:** Enables proper reporting, comparisons, and compliance

```sql
-- Source: DoorLoop property management chart of accounts + HOA standards
CREATE TYPE account_category AS ENUM (
  'asset',            -- 1000-1999: What we own
  'liability',        -- 2000-2999: What we owe
  'equity',           -- 3000-3999: Net worth
  'income',           -- 4000-4999: Revenue
  'expense'           -- 5000-5999: Costs
);

CREATE TYPE account_subtype AS ENUM (
  -- Assets
  'cash',                   -- Bank accounts, petty cash
  'accounts_receivable',    -- Money owed by residents
  'prepaid',                -- Prepaid expenses
  'fixed_asset',            -- Property, equipment

  -- Liabilities
  'accounts_payable',       -- Money we owe vendors
  'security_deposits',      -- Resident deposits held
  'loans',                  -- Mortgages, credit lines
  'deferred_income',        -- Prepaid fees

  -- Equity
  'retained_earnings',      -- Accumulated surplus
  'reserves',               -- Reserve fund (critical for HOAs)

  -- Income
  'maintenance_fees',       -- Regular cuotas
  'special_assessments',    -- One-time charges
  'late_fees',              -- Moratorios, penalties
  'other_income',           -- Interest earned, amenity fees

  -- Expenses
  'utilities',              -- Water, electricity, gas
  'maintenance',            -- Repairs, upkeep
  'administrative',         -- Management, legal, accounting
  'insurance',              -- Property insurance
  'taxes',                  -- Property taxes
  'reserve_contribution'    -- Transfer to reserves
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Account identification
  account_number TEXT NOT NULL,             -- "1010", "4100"
  name TEXT NOT NULL,                       -- "Operating Bank Account"
  description TEXT,

  -- Classification
  category account_category NOT NULL,
  subtype account_subtype NOT NULL,

  -- Hierarchy (for sub-accounts)
  parent_account_id UUID REFERENCES accounts(id),
  depth INTEGER NOT NULL DEFAULT 0,

  -- Operating vs Reserve fund separation (critical for HOAs)
  is_operating_fund BOOLEAN NOT NULL DEFAULT TRUE,
  is_reserve_fund BOOLEAN NOT NULL DEFAULT FALSE,

  -- Current balance (updated by trigger)
  current_balance money_amount_signed NOT NULL DEFAULT 0,
  balance_as_of TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- For reporting
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system_account BOOLEAN NOT NULL DEFAULT FALSE,  -- Cannot delete

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique account number per community
  CONSTRAINT accounts_number_unique UNIQUE (community_id, account_number),

  -- Operating and reserve are mutually exclusive or both false
  CONSTRAINT accounts_fund_type CHECK (
    NOT (is_operating_fund AND is_reserve_fund)
  )
);

-- Standard accounts template (created for each community)
-- 1010 - Operating Bank Account (asset/cash)
-- 1020 - Reserve Bank Account (asset/cash)
-- 1100 - Accounts Receivable - Maintenance (asset/accounts_receivable)
-- 1110 - Accounts Receivable - Special Assessments (asset/accounts_receivable)
-- 2010 - Security Deposits Held (liability/security_deposits)
-- 3010 - Retained Earnings (equity/retained_earnings)
-- 3100 - Reserve Fund Balance (equity/reserves)
-- 4010 - Maintenance Fee Income (income/maintenance_fees)
-- 4020 - Special Assessment Income (income/special_assessments)
-- 4030 - Late Fee Income (income/late_fees)
-- 5010 - Utilities Expense (expense/utilities)
-- 5020 - Maintenance & Repairs (expense/maintenance)
-- 5030 - Administrative Expense (expense/administrative)
-- 7010 - Reserve Contribution (expense/reserve_contribution)

COMMENT ON COLUMN accounts.is_operating_fund IS
  'True for operating fund accounts. Mexican HOA law requires separation of operating and reserve funds.';
COMMENT ON COLUMN accounts.is_reserve_fund IS
  'True for reserve fund accounts. Must track separately for compliance.';
```

### Pattern 3: Fee Structures with Coefficient-Based Calculation

**What:** Fee templates supporting fixed, coefficient (indiviso), and hybrid formulas
**When to use:** Mexican condominiums where fees are proportional to unit coefficient
**Why:** The "indiviso" coefficient is legally mandated for proportional fee allocation

```sql
-- Source: Mexican condominium law + HOA fee calculation patterns
CREATE TYPE fee_calculation_type AS ENUM (
  'fixed',            -- Same amount for all units
  'coefficient',      -- Proportional to unit coefficient (indiviso)
  'hybrid',           -- Fixed base + coefficient portion
  'tiered',           -- Based on unit type or size tiers
  'custom'            -- Formula stored in JSONB
);

CREATE TYPE fee_frequency AS ENUM (
  'monthly',
  'bimonthly',
  'quarterly',
  'semiannual',
  'annual',
  'one_time'
);

CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  name TEXT NOT NULL,                       -- "Cuota de Mantenimiento Ordinaria"
  description TEXT,
  code TEXT,                                -- "MAINT-ORD"

  -- Calculation method
  calculation_type fee_calculation_type NOT NULL,

  -- For fixed: this is the amount
  -- For coefficient: this is the base amount that gets multiplied by coefficient
  -- For hybrid: this is the fixed portion
  base_amount money_amount NOT NULL,

  -- For hybrid: coefficient-based portion
  coefficient_amount money_amount DEFAULT 0,

  -- Formula for custom calculations (JSONB)
  -- Example: {"formula": "base + (coefficient * rate)", "rate": 50.00}
  custom_formula JSONB,

  -- Billing
  frequency fee_frequency NOT NULL,
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28),

  -- Accounts affected
  income_account_id UUID NOT NULL REFERENCES accounts(id),
  receivable_account_id UUID NOT NULL REFERENCES accounts(id),

  -- Which unit types this applies to
  applicable_unit_types unit_type[] DEFAULT ARRAY['casa', 'departamento']::unit_type[],

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Function to calculate fee amount for a unit
CREATE OR REPLACE FUNCTION calculate_fee_amount(
  p_fee_structure_id UUID,
  p_unit_id UUID
)
RETURNS money_amount
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  fee RECORD;
  unit RECORD;
  calculated_amount NUMERIC(15, 4);
BEGIN
  SELECT * INTO fee FROM fee_structures WHERE id = p_fee_structure_id;
  SELECT * INTO unit FROM units WHERE id = p_unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee structure or unit not found';
  END IF;

  CASE fee.calculation_type
    WHEN 'fixed' THEN
      calculated_amount := fee.base_amount;

    WHEN 'coefficient' THEN
      -- coefficient is stored as percentage (e.g., 1.5 for 1.5%)
      -- base_amount is the total community budget portion
      calculated_amount := fee.base_amount * (unit.coefficient / 100.0);

    WHEN 'hybrid' THEN
      calculated_amount := fee.base_amount +
        (fee.coefficient_amount * (unit.coefficient / 100.0));

    WHEN 'tiered' THEN
      -- Look up tier based on unit_type or area
      -- Simplified: use base_amount
      calculated_amount := fee.base_amount;

    WHEN 'custom' THEN
      -- Parse JSONB formula (simplified)
      calculated_amount := fee.base_amount;
  END CASE;

  -- Round to 2 decimal places for display, keep 4 for storage
  RETURN ROUND(calculated_amount, 2);
END;
$$;

-- Table to track which fees apply to which units
CREATE TABLE fee_schedules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id),
  unit_id UUID NOT NULL REFERENCES units(id),

  -- Override base calculation if needed
  override_amount money_amount,
  override_reason TEXT,

  -- Effective dates
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique fee per unit
  CONSTRAINT fee_schedules_unique UNIQUE (fee_structure_id, unit_id, effective_from)
);

COMMENT ON TABLE fee_structures IS
  'Fee templates defining how charges are calculated.
   Mexican indiviso coefficient stored on units table is used for proportional calculations.';
COMMENT ON COLUMN fee_structures.calculation_type IS
  'fixed=same for all, coefficient=proportional to unit coefficient,
   hybrid=fixed base + proportional, tiered=by unit type, custom=JSONB formula';
```

### Pattern 4: Interest/Penalty Rules (Moratorios) per Community

**What:** Configurable interest rules since Mexico has no federal limit
**When to use:** Each community assembly sets their own moratorium rates
**Why:** Mexican law allows condominiums to set penalty rates in their bylaws

```sql
-- Source: Mexican condominium law research
CREATE TYPE interest_calculation_method AS ENUM (
  'simple',           -- Simple interest: principal * rate * time
  'compound_monthly', -- Compound monthly
  'compound_daily',   -- Compound daily
  'flat_fee'          -- Fixed fee per period
);

CREATE TABLE interest_rules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,

  -- When to apply
  grace_period_days INTEGER NOT NULL DEFAULT 0,   -- Days after due before interest starts
  applies_after_days INTEGER NOT NULL DEFAULT 1,  -- Days overdue to trigger this rule

  -- Calculation
  calculation_method interest_calculation_method NOT NULL DEFAULT 'simple',
  rate_percentage NUMERIC(5, 2) NOT NULL,         -- e.g., 2.00 for 2%
  rate_period TEXT NOT NULL DEFAULT 'monthly' CHECK (rate_period IN ('daily', 'monthly', 'annual')),

  -- Caps (optional)
  max_rate_percentage NUMERIC(5, 2),              -- Maximum cumulative percentage
  max_amount money_amount,                        -- Maximum interest amount

  -- Flat fee option
  flat_fee_amount money_amount,

  -- Priority (lower = applied first)
  priority INTEGER NOT NULL DEFAULT 1,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Approval tracking (assembly must approve rates)
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  assembly_minute_reference TEXT,              -- Reference to assembly minutes

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Function to calculate interest for overdue amount
CREATE OR REPLACE FUNCTION calculate_interest(
  p_community_id UUID,
  p_principal money_amount,
  p_days_overdue INTEGER,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS money_amount
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rule RECORD;
  interest_amount NUMERIC(15, 4) := 0;
  daily_rate NUMERIC(10, 8);
  applicable_days INTEGER;
BEGIN
  -- Find applicable interest rule
  SELECT * INTO rule
  FROM interest_rules
  WHERE community_id = p_community_id
    AND is_active = TRUE
    AND deleted_at IS NULL
    AND effective_from <= p_as_of_date
    AND (effective_until IS NULL OR effective_until >= p_as_of_date)
    AND applies_after_days <= p_days_overdue
  ORDER BY priority, applies_after_days DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Skip grace period
  applicable_days := GREATEST(0, p_days_overdue - rule.grace_period_days);

  IF applicable_days <= 0 THEN
    RETURN 0;
  END IF;

  CASE rule.calculation_method
    WHEN 'flat_fee' THEN
      interest_amount := COALESCE(rule.flat_fee_amount, 0);

    WHEN 'simple' THEN
      CASE rule.rate_period
        WHEN 'daily' THEN
          interest_amount := p_principal * (rule.rate_percentage / 100.0) * applicable_days;
        WHEN 'monthly' THEN
          interest_amount := p_principal * (rule.rate_percentage / 100.0) * (applicable_days / 30.0);
        WHEN 'annual' THEN
          interest_amount := p_principal * (rule.rate_percentage / 100.0) * (applicable_days / 365.0);
      END CASE;

    WHEN 'compound_monthly' THEN
      daily_rate := POWER(1 + (rule.rate_percentage / 100.0), 1.0/30.0) - 1;
      interest_amount := p_principal * (POWER(1 + daily_rate, applicable_days) - 1);

    WHEN 'compound_daily' THEN
      daily_rate := rule.rate_percentage / 100.0 / 365.0;
      interest_amount := p_principal * (POWER(1 + daily_rate, applicable_days) - 1);
  END CASE;

  -- Apply caps
  IF rule.max_rate_percentage IS NOT NULL THEN
    interest_amount := LEAST(interest_amount, p_principal * (rule.max_rate_percentage / 100.0));
  END IF;

  IF rule.max_amount IS NOT NULL THEN
    interest_amount := LEAST(interest_amount, rule.max_amount);
  END IF;

  RETURN ROUND(interest_amount, 4);
END;
$$;

COMMENT ON TABLE interest_rules IS
  'Moratorium (late payment interest) rules configurable per community.
   Mexico has no federal limit on condominium moratorium rates.
   Rates must be approved by the General Assembly.';
```

### Pattern 5: Delinquency Triggers with Automated Actions

**What:** Configurable escalation based on days overdue
**When to use:** Automating reminder, penalty, and suspension workflows
**Why:** Consistent enforcement, audit trail of collection attempts

```sql
-- Source: Delinquency management best practices
CREATE TYPE delinquency_action_type AS ENUM (
  'reminder_email',
  'reminder_sms',
  'late_fee',
  'interest_charge',
  'service_restriction',  -- e.g., no amenity access
  'payment_plan_offer',
  'legal_warning',
  'collection_referral',
  'service_suspension'
);

CREATE TABLE delinquency_triggers (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Trigger condition
  days_overdue INTEGER NOT NULL,            -- Trigger at this many days overdue
  min_amount money_amount DEFAULT 0,        -- Only trigger if balance >= this amount

  -- Action to take
  action_type delinquency_action_type NOT NULL,
  action_config JSONB DEFAULT '{}',         -- Action-specific configuration

  -- Template references
  notification_template_id UUID,            -- For email/SMS actions

  -- Fee/charge details (for late_fee, interest_charge actions)
  fee_amount money_amount,
  fee_percentage NUMERIC(5, 2),
  fee_description TEXT,

  -- Repeat behavior
  is_one_time BOOLEAN NOT NULL DEFAULT TRUE,
  repeat_interval_days INTEGER,             -- If not one-time, repeat every N days

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 1,      -- Lower = higher priority

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique trigger per community/days
  CONSTRAINT delinquency_triggers_unique UNIQUE (community_id, days_overdue, action_type)
);

-- Log of actions taken
CREATE TABLE delinquency_actions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  trigger_id UUID REFERENCES delinquency_triggers(id),
  unit_id UUID NOT NULL REFERENCES units(id),

  -- What was done
  action_type delinquency_action_type NOT NULL,
  action_description TEXT NOT NULL,

  -- Related records
  related_transaction_id UUID REFERENCES transactions(id),  -- If fee was charged
  related_notification_id UUID,                             -- If notification sent

  -- Balance at time of action
  balance_at_action money_amount NOT NULL,
  days_overdue_at_action INTEGER NOT NULL,

  -- Result
  status TEXT NOT NULL DEFAULT 'executed' CHECK (status IN ('executed', 'failed', 'skipped')),
  failure_reason TEXT,

  -- Audit
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by UUID REFERENCES auth.users(id)
);

-- Indexes for delinquency queries
CREATE INDEX idx_delinquency_actions_unit ON delinquency_actions(unit_id, executed_at DESC);
CREATE INDEX idx_delinquency_triggers_active ON delinquency_triggers(community_id, days_overdue)
  WHERE is_active = TRUE AND deleted_at IS NULL;

COMMENT ON TABLE delinquency_triggers IS
  'Configurable escalation rules: days overdue -> action.
   Typical progression: 1 day (reminder), 15 days (late fee), 30 days (interest),
   60 days (restriction), 90 days (legal warning), 180 days (legal action).';
```

### Pattern 6: Bank Reconciliation Workflow

**What:** Statement imports, automatic matching, manual reconciliation
**When to use:** Matching bank statements to ledger transactions
**Why:** Critical for financial accuracy and audit compliance

```sql
-- Source: Microsoft Dynamics/Oracle reconciliation patterns
CREATE TYPE statement_line_status AS ENUM (
  'unmatched',        -- Not yet matched to any transaction
  'matched',          -- Automatically matched
  'manually_matched', -- Manually matched by user
  'excluded',         -- Excluded from reconciliation (e.g., bank fees)
  'disputed'          -- Under review
);

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Bank details
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,             -- Last 4 digits for display
  account_number_hash TEXT NOT NULL,        -- Hashed full number for matching
  clabe TEXT,                               -- Mexican CLABE (18 digits)
  account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings')),

  -- Currency
  currency currency_code NOT NULL DEFAULT 'MXN',

  -- Linked GL account
  gl_account_id UUID NOT NULL REFERENCES accounts(id),

  -- Current balance (from last statement)
  last_statement_balance money_amount,
  last_statement_date DATE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE bank_statements (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),

  -- Statement period
  statement_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Balances
  opening_balance money_amount NOT NULL,
  closing_balance money_amount NOT NULL,

  -- Totals
  total_credits money_amount NOT NULL DEFAULT 0,
  total_debits money_amount NOT NULL DEFAULT 0,
  line_count INTEGER NOT NULL DEFAULT 0,

  -- Import details
  import_format TEXT,                       -- 'csv', 'ofx', 'mt940'
  original_filename TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),

  -- Reconciliation status
  is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  lines_matched INTEGER DEFAULT 0,
  lines_unmatched INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,

  -- Line details
  line_number INTEGER NOT NULL,
  transaction_date DATE NOT NULL,
  value_date DATE,                          -- Settlement date
  description TEXT NOT NULL,
  reference TEXT,                           -- Bank reference number

  -- Amount (positive for credits/deposits, negative for debits/withdrawals)
  amount money_amount_signed NOT NULL,

  -- Matching
  status statement_line_status NOT NULL DEFAULT 'unmatched',
  matched_transaction_id UUID REFERENCES transactions(id),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES auth.users(id),
  match_confidence NUMERIC(3, 2),           -- 0.00 to 1.00

  -- For manual matching notes
  notes TEXT,

  -- Unique line per statement
  CONSTRAINT statement_lines_unique UNIQUE (statement_id, line_number)
);

-- Matching rules for automatic reconciliation
CREATE TABLE reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  name TEXT NOT NULL,
  description TEXT,

  -- Match criteria (JSONB for flexibility)
  -- Example: {"description_contains": "SPEI", "amount_tolerance": 0.01}
  criteria JSONB NOT NULL,

  -- Priority (lower = checked first)
  priority INTEGER NOT NULL DEFAULT 100,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for reconciliation
CREATE INDEX idx_statement_lines_unmatched ON bank_statement_lines(statement_id, status)
  WHERE status = 'unmatched';
CREATE INDEX idx_statement_lines_date ON bank_statement_lines(community_id, transaction_date);

COMMENT ON TABLE bank_statements IS
  'Imported bank statements for reconciliation.
   Supports CSV and common banking formats.
   Reconciliation validates ledger accuracy.';
```

### Pattern 7: Payment Proofs with Validation Workflow

**What:** Payment proof images with approval workflow
**When to use:** Manual payment verification (SPEI transfers, deposits)
**Why:** Many payments in Mexico are bank transfers requiring proof validation

```sql
-- Uses existing approval_status enum from Phase 1
CREATE TABLE payment_proofs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Related payment (may be created after approval)
  payment_id UUID REFERENCES transactions(id),
  unit_id UUID NOT NULL REFERENCES units(id),

  -- Proof details
  proof_type TEXT NOT NULL CHECK (proof_type IN ('transfer_receipt', 'deposit_slip', 'spei_confirmation', 'other')),
  amount money_amount NOT NULL,
  payment_date DATE NOT NULL,
  reference_number TEXT,
  bank_name TEXT,

  -- Document
  document_url TEXT NOT NULL,               -- Supabase Storage path
  document_filename TEXT,
  document_size_bytes INTEGER,

  -- Validation workflow
  status approval_status NOT NULL DEFAULT 'pending',

  -- Submitted by
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Notes
  submitter_notes TEXT,
  reviewer_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to create payment transaction when proof is approved
CREATE OR REPLACE FUNCTION on_payment_proof_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id UUID;
  v_reference TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Generate reference number
    v_reference := 'PAY-' || TO_CHAR(now(), 'YYYY') || '-' ||
      LPAD((SELECT COUNT(*) + 1 FROM transactions WHERE community_id = NEW.community_id AND transaction_type = 'payment')::TEXT, 5, '0');

    -- Create payment transaction
    INSERT INTO transactions (
      community_id, transaction_type, reference_number, description,
      unit_id, amount, status, effective_date, created_by
    ) VALUES (
      NEW.community_id, 'payment', v_reference,
      'Payment via ' || NEW.proof_type || ' - Proof #' || NEW.id,
      NEW.unit_id, NEW.amount, 'pending', NEW.payment_date, NEW.reviewed_by
    ) RETURNING id INTO v_transaction_id;

    -- Link proof to transaction
    NEW.payment_id := v_transaction_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_proof_approved
  BEFORE UPDATE ON payment_proofs
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION on_payment_proof_approved();

-- Indexes
CREATE INDEX idx_payment_proofs_pending ON payment_proofs(community_id, status)
  WHERE status = 'pending';
CREATE INDEX idx_payment_proofs_unit ON payment_proofs(unit_id, submitted_at DESC);

COMMENT ON TABLE payment_proofs IS
  'Uploaded payment proof images with validation workflow.
   Common in Mexico where SPEI transfers require manual verification.
   Status: pending -> approved/rejected';
```

### Anti-Patterns to Avoid

- **Mutable ledger entries:** Never UPDATE or DELETE posted entries - create reversals
- **Storing balances without audit trail:** Always derive balances from entry history
- **Single account for operating and reserves:** Mexican law requires separation
- **Hard-coding interest rates:** Must be configurable per community assembly
- **Skipping transaction balance validation:** Every transaction MUST sum to zero
- **Storing full bank account numbers:** Hash or encrypt, show only last 4 digits

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interest calculation | Custom per-charge logic | Centralized calculate_interest() function | Consistent rules, easy to audit and change |
| Balance calculation | SUM on every query | Running balance on accounts + periodic reconciliation | Performance at scale |
| Fee amount calculation | Inline formulas | calculate_fee_amount() function | Coefficient logic is complex, needs testing |
| Transaction immutability | Application-level checks | Database triggers | Cannot be bypassed |
| Reference number generation | Random strings | Structured format (PAY-YYYY-NNNNN) | Human-readable, sortable, traceable |
| Bank statement parsing | Custom per-bank parsers | Standard formats (CSV with mapping) | Maintainability |

**Key insight:** Financial systems require database-level enforcement of invariants. Application bugs must not be able to corrupt the ledger.

## Common Pitfalls

### Pitfall 1: Allowing Ledger Entry Modifications

**What goes wrong:** Audit trail becomes unreliable, balance discrepancies undetectable
**Why it happens:** Convenience of "just fixing" an entry vs. creating reversal
**How to avoid:**
- Create BEFORE UPDATE/DELETE triggers that RAISE EXCEPTION on ledger_entries
- Status column on transactions: pending (mutable) -> posted (immutable)
- All corrections via reversing entries
**Warning signs:** Missing triggers on ledger tables, UPDATE grants on ledger_entries

### Pitfall 2: Not Validating Transaction Balance

**What goes wrong:** Transactions where debits != credits corrupt the ledger
**Why it happens:** Assuming application always sends balanced entries
**How to avoid:**
- Check SUM(entries) = 0 before posting any transaction
- Use trigger on status change to pending -> posted
- Reject any transaction that doesn't balance
**Warning signs:** Transactions without validation trigger, imbalanced ledger reports

### Pitfall 3: Mixing Operating and Reserve Funds

**What goes wrong:** Compliance violations, inability to prove reserves weren't used for operations
**Why it happens:** Single bank account or chart of accounts for everything
**How to avoid:**
- Separate bank accounts for operating vs. reserve
- Separate GL accounts with is_operating_fund / is_reserve_fund flags
- Reports showing fund separation
**Warning signs:** Single "Bank" account, no reserve-specific accounts in chart

### Pitfall 4: Hardcoding Interest Rates

**What goes wrong:** Can't comply with different community bylaws, no assembly approval trail
**Why it happens:** Developer assumes one rate for all
**How to avoid:**
- interest_rules table with per-community configuration
- Track assembly approval (approved_at, assembly_minute_reference)
- Allow rule changes without code deployment
**Warning signs:** Interest rate in application code or environment variables

### Pitfall 5: Real-Time Balance Calculation at Scale

**What goes wrong:** Slow queries as ledger grows, timeouts on balance reports
**Why it happens:** SUM(entries) query on every balance request
**How to avoid:**
- Store running balance on accounts table (updated by trigger)
- Use materialized views for period-end reporting
- BRIN indexes on timestamp columns
**Warning signs:** Slow account balance queries, no indexes on ledger_entries

### Pitfall 6: No Reconciliation Workflow

**What goes wrong:** Discrepancies between bank and ledger go undetected for months
**Why it happens:** Assuming all payments are entered correctly
**How to avoid:**
- Regular bank statement imports
- Matching workflow (automatic + manual)
- Monthly reconciliation requirement before closing period
**Warning signs:** No bank_statements table, reconciliation done in spreadsheets

## Code Examples

### Complete Account Creation with Standard Chart

```sql
-- Function to create standard chart of accounts for new community
CREATE OR REPLACE FUNCTION create_standard_chart_of_accounts(p_community_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  accounts_created INTEGER := 0;
BEGIN
  -- Assets (1000s)
  INSERT INTO accounts (community_id, account_number, name, category, subtype, is_operating_fund, normal_balance)
  VALUES
    (p_community_id, '1010', 'Operating Bank Account', 'asset', 'cash', TRUE, 'debit'),
    (p_community_id, '1020', 'Reserve Bank Account', 'asset', 'cash', FALSE, 'debit'),
    (p_community_id, '1030', 'Petty Cash', 'asset', 'cash', TRUE, 'debit'),
    (p_community_id, '1100', 'Accounts Receivable - Maintenance', 'asset', 'accounts_receivable', TRUE, 'debit'),
    (p_community_id, '1110', 'Accounts Receivable - Special', 'asset', 'accounts_receivable', TRUE, 'debit'),
    (p_community_id, '1120', 'Accounts Receivable - Interest', 'asset', 'accounts_receivable', TRUE, 'debit');

  -- Liabilities (2000s)
  INSERT INTO accounts (community_id, account_number, name, category, subtype, is_operating_fund, normal_balance)
  VALUES
    (p_community_id, '2010', 'Accounts Payable', 'liability', 'accounts_payable', TRUE, 'credit'),
    (p_community_id, '2020', 'Security Deposits Held', 'liability', 'security_deposits', TRUE, 'credit'),
    (p_community_id, '2030', 'Prepaid Fees', 'liability', 'deferred_income', TRUE, 'credit');

  -- Equity (3000s)
  INSERT INTO accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance)
  VALUES
    (p_community_id, '3010', 'Retained Earnings - Operating', 'equity', 'retained_earnings', TRUE, FALSE, 'credit'),
    (p_community_id, '3100', 'Reserve Fund Balance', 'equity', 'reserves', FALSE, TRUE, 'credit');

  -- Income (4000s)
  INSERT INTO accounts (community_id, account_number, name, category, subtype, is_operating_fund, normal_balance)
  VALUES
    (p_community_id, '4010', 'Maintenance Fee Income', 'income', 'maintenance_fees', TRUE, 'credit'),
    (p_community_id, '4020', 'Special Assessment Income', 'income', 'special_assessments', TRUE, 'credit'),
    (p_community_id, '4030', 'Late Fee Income', 'income', 'late_fees', TRUE, 'credit'),
    (p_community_id, '4040', 'Interest Income', 'income', 'other_income', TRUE, 'credit'),
    (p_community_id, '4050', 'Amenity Fee Income', 'income', 'other_income', TRUE, 'credit');

  -- Expenses (5000s)
  INSERT INTO accounts (community_id, account_number, name, category, subtype, is_operating_fund, normal_balance)
  VALUES
    (p_community_id, '5010', 'Utilities - Water', 'expense', 'utilities', TRUE, 'debit'),
    (p_community_id, '5020', 'Utilities - Electricity', 'expense', 'utilities', TRUE, 'debit'),
    (p_community_id, '5030', 'Maintenance & Repairs', 'expense', 'maintenance', TRUE, 'debit'),
    (p_community_id, '5040', 'Landscaping', 'expense', 'maintenance', TRUE, 'debit'),
    (p_community_id, '5050', 'Security Services', 'expense', 'administrative', TRUE, 'debit'),
    (p_community_id, '5060', 'Management Fees', 'expense', 'administrative', TRUE, 'debit'),
    (p_community_id, '5070', 'Insurance', 'expense', 'insurance', TRUE, 'debit'),
    (p_community_id, '5080', 'Legal & Professional', 'expense', 'administrative', TRUE, 'debit');

  -- Reserve Expenses (7000s)
  INSERT INTO accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance)
  VALUES
    (p_community_id, '7010', 'Reserve - Major Repairs', 'expense', 'reserve_contribution', FALSE, TRUE, 'debit'),
    (p_community_id, '7020', 'Reserve - Equipment Replacement', 'expense', 'reserve_contribution', FALSE, TRUE, 'debit');

  GET DIAGNOSTICS accounts_created = ROW_COUNT;
  RETURN accounts_created;
END;
$$;
```

### Complete Payment Recording with Double-Entry

```sql
-- Function to record a payment with proper double-entry
CREATE OR REPLACE FUNCTION record_payment(
  p_community_id UUID,
  p_unit_id UUID,
  p_amount money_amount,
  p_payment_date DATE,
  p_description TEXT,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id UUID;
  v_reference TEXT;
  v_cash_account_id UUID;
  v_receivable_account_id UUID;
BEGIN
  -- Get account IDs
  SELECT id INTO v_cash_account_id
  FROM accounts
  WHERE community_id = p_community_id AND account_number = '1010';

  SELECT id INTO v_receivable_account_id
  FROM accounts
  WHERE community_id = p_community_id AND account_number = '1100';

  -- Generate reference
  v_reference := 'PAY-' || TO_CHAR(p_payment_date, 'YYYY') || '-' ||
    LPAD((SELECT COALESCE(MAX(SUBSTRING(reference_number FROM 10)::INTEGER), 0) + 1
          FROM transactions
          WHERE community_id = p_community_id
            AND transaction_type = 'payment'
            AND reference_number LIKE 'PAY-' || TO_CHAR(p_payment_date, 'YYYY') || '-%')::TEXT, 5, '0');

  -- Create transaction
  INSERT INTO transactions (
    community_id, transaction_type, reference_number, description,
    unit_id, amount, status, effective_date, created_by
  ) VALUES (
    p_community_id, 'payment', v_reference, p_description,
    p_unit_id, p_amount, 'pending', p_payment_date, p_created_by
  ) RETURNING id INTO v_transaction_id;

  -- Create ledger entries (debit bank, credit receivable)
  -- Debit = positive, Credit = negative
  INSERT INTO ledger_entries (community_id, transaction_id, account_id, amount, entry_sequence)
  VALUES
    (p_community_id, v_transaction_id, v_cash_account_id, p_amount, 1),       -- Debit bank (increase)
    (p_community_id, v_transaction_id, v_receivable_account_id, -p_amount, 2); -- Credit receivable (decrease)

  -- Post the transaction
  UPDATE transactions SET status = 'posted' WHERE id = v_transaction_id;

  RETURN v_transaction_id;
END;
$$;
```

### Unit Balance View

```sql
-- View for unit account balances
CREATE OR REPLACE VIEW unit_balances AS
SELECT
  u.id AS unit_id,
  u.community_id,
  u.unit_number,
  COALESCE(SUM(
    CASE WHEN a.subtype = 'accounts_receivable' THEN le.amount ELSE 0 END
  ), 0) AS total_receivable,
  COALESCE(SUM(
    CASE WHEN t.transaction_type = 'charge' AND t.status = 'posted' THEN t.amount ELSE 0 END
  ), 0) AS total_charges,
  COALESCE(SUM(
    CASE WHEN t.transaction_type = 'payment' AND t.status = 'posted' THEN t.amount ELSE 0 END
  ), 0) AS total_payments,
  COALESCE(SUM(
    CASE WHEN t.transaction_type = 'interest' AND t.status = 'posted' THEN t.amount ELSE 0 END
  ), 0) AS total_interest,
  MAX(
    CASE WHEN t.transaction_type = 'payment' AND t.status = 'posted' THEN t.effective_date END
  ) AS last_payment_date,
  MAX(
    CASE WHEN t.transaction_type = 'charge' AND t.status = 'posted' THEN t.effective_date END
  ) AS last_charge_date
FROM units u
LEFT JOIN transactions t ON t.unit_id = u.id AND t.status = 'posted'
LEFT JOIN ledger_entries le ON le.transaction_id = t.id
LEFT JOIN accounts a ON a.id = le.account_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.community_id, u.unit_number;

COMMENT ON VIEW unit_balances IS
  'Summary of financial position per unit.
   total_receivable is the current balance owed (positive = owes money).';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mutable ledger entries | Append-only with reversals | Always best practice | Audit integrity |
| Single fund accounting | Operating + Reserve separation | HOA standards | Compliance |
| Application-level immutability | Database triggers | Modern patterns | Cannot bypass |
| Recalculate balance on query | Running balance + periodic refresh | Performance requirement | Scalability |
| Single interest rate | Per-community configurable rules | Regulatory requirement | Flexibility |

**Deprecated/outdated:**
- Updating entries to "fix" errors: Use reversing entries
- Storing full bank account numbers unencrypted: Hash or use last 4 digits
- Single account for all income types: Proper chart of accounts required
- Manual spreadsheet reconciliation: Database-driven workflow

## Open Questions

### 1. CFDI Integration Scope

**What we know:** Mexican SAT/CFDI requirements are complex; maintenance fees are generally exempt from CFDI
**What's unclear:** Whether any community requires CFDI for fees, integration with PAC providers
**Recommendation:** Design for CFDI metadata storage (folio, UUID, XML reference) but defer actual integration. Most HOAs don't require CFDI for maintenance fees per SAT ruling 27/CFF/2017.

### 2. Multi-Currency Support

**What we know:** Schema supports currency_code, some expat communities may use USD
**What's unclear:** Whether any UPOE communities need multi-currency accounting
**Recommendation:** Design for single currency per community initially. money_amount domain and currency_code column support future multi-currency if needed.

### 3. Offline Payment Recording

**What we know:** PowerSync enables offline-first; financial data needs conflict resolution
**What's unclear:** Exact conflict patterns for concurrent payment recording
**Recommendation:** Payments are typically entered by admin, not concurrent. Use last-write-wins for payment proof submission, but payment transactions should only be created server-side after proof approval. Never create ledger entries offline.

### 4. Historical Balance Reconstruction

**What we know:** Immutable entries enable point-in-time balance calculation
**What's unclear:** Performance requirements for historical queries
**Recommendation:** Store balance_after on each ledger entry for O(1) historical lookups. Can reconstruct any point-in-time balance by finding last entry before that date.

## Sources

### Primary (HIGH confidence)
- [NYKevin PostgreSQL Double-Entry Gist](https://gist.github.com/NYKevin/9433376) - Basic schema patterns
- [pgledger Implementation](https://github.com/pgr0ss/pgledger) - Production PostgreSQL ledger patterns
- [Modern Treasury - Enforcing Immutability](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger) - Immutability patterns
- [Square Books Implementation](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/) - Append-only ledger design

### Secondary (MEDIUM confidence)
- [DoorLoop Property Management Chart of Accounts](https://www.doorloop.com/blog/property-management-chart-of-accounts) - HOA account structure
- [HOA Start Chart of Accounts Guide](https://hoastart.com/hoa-chart-of-accounts/) - Industry standard numbering
- [Mexican Condominium Law Guide](https://www.mexicolawyerhelp.com/guides/condo-hoa-mexico-regimen-de-propiedad-en-condominio/) - Legal framework
- [SAT CFDI Condominium Requirements](https://www.comunidadfeliz.mx/post/se-puede-facturar-la-cuota-de-mantenimiento-de-condominio-ante-el-sat) - CFDI exemptions
- [Microsoft Dynamics Bank Reconciliation](https://learn.microsoft.com/en-us/dynamics365/finance/cash-bank-management/advanced-bank-reconciliation-overview) - Reconciliation workflow patterns

### Tertiary (LOW confidence)
- Mexican interest rate limits research - General patterns, specific limits vary by state
- PowerSync financial data patterns - General sync patterns, not financial-specific

## Metadata

**Confidence breakdown:**
- Double-entry ledger patterns: HIGH - Well-documented PostgreSQL implementations
- Fee calculation formulas: HIGH - Mexican indiviso coefficient is legally defined
- Chart of accounts structure: HIGH - Industry standard (1000s-5000s)
- Interest/penalty rules: MEDIUM - Mexico allows per-community rules, no federal limit
- Bank reconciliation: MEDIUM - Based on enterprise ERP patterns
- SAT/CFDI compliance: MEDIUM - Maintenance fees generally exempt, but complex area
- PowerSync financial sync: LOW - General patterns apply, specific edge cases unclear

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable domain, accounting patterns don't change frequently)
