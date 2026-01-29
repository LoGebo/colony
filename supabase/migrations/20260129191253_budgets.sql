-- Migration: budgets
-- Phase 4 Plan 03: Budget tracking for financial planning
-- Purpose: Track planned vs actual spending by account and fiscal period

-- =====================================================
-- budget_status ENUM
-- =====================================================

CREATE TYPE budget_status AS ENUM (
  'draft',      -- Being prepared, not yet approved
  'approved',   -- Approved by assembly, awaiting activation
  'active',     -- Currently active fiscal period
  'closed'      -- Fiscal period ended
);

COMMENT ON TYPE budget_status IS
  'Budget workflow states: draft -> approved -> active -> closed.
   Only one budget can be active per community at a time.';

-- =====================================================
-- budgets TABLE
-- =====================================================
-- Annual/periodic budget for a community

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Budget identification
  name TEXT NOT NULL,                                    -- e.g., "Presupuesto 2026"
  description TEXT,

  -- Fiscal period
  fiscal_year INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Status workflow
  status budget_status NOT NULL DEFAULT 'draft',

  -- Budget totals (auto-calculated by trigger from budget_lines)
  total_income money_amount NOT NULL DEFAULT 0,
  total_expense money_amount NOT NULL DEFAULT 0,

  -- Approval tracking (assembly must approve annual budget)
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  assembly_minute_reference TEXT,                        -- Link to assembly minutes

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique fiscal year per community
  CONSTRAINT budgets_community_year_unique UNIQUE (community_id, fiscal_year),

  -- Period validation
  CONSTRAINT budgets_period_valid CHECK (period_end > period_start),

  -- Approval required for active status
  CONSTRAINT budgets_approval_required CHECK (
    status NOT IN ('approved', 'active') OR approved_at IS NOT NULL
  )
);

-- =====================================================
-- budget_lines TABLE
-- =====================================================
-- Individual budget line items linked to chart of accounts

CREATE TABLE budget_lines (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  -- Line description (optional override of account name)
  line_description TEXT,

  -- Budget amounts
  budgeted_amount money_amount NOT NULL,
  actual_amount money_amount NOT NULL DEFAULT 0,         -- Updated by trigger or batch job

  -- Computed variance (actual - budgeted)
  variance money_amount GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED,

  -- Notes for explaining variances
  notes TEXT,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique account per budget
  CONSTRAINT budget_lines_unique UNIQUE (budget_id, account_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- budgets: community + fiscal year lookup
CREATE INDEX idx_budgets_community_year ON budgets(community_id, fiscal_year)
  WHERE deleted_at IS NULL;

-- budgets: active budget for a community
CREATE INDEX idx_budgets_community_active ON budgets(community_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

-- budget_lines: budget detail queries
CREATE INDEX idx_budget_lines_budget ON budget_lines(budget_id)
  WHERE deleted_at IS NULL;

-- budget_lines: account budget lookup (cross-budget analysis)
CREATE INDEX idx_budget_lines_account ON budget_lines(account_id)
  WHERE deleted_at IS NULL;

-- budget_lines: variance analysis (find over/under budget items)
CREATE INDEX idx_budget_lines_variance ON budget_lines(budget_id, variance)
  WHERE deleted_at IS NULL;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- budgets: Audit fields
CREATE TRIGGER set_budgets_audit
  BEFORE INSERT OR UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- budgets: Soft delete
CREATE TRIGGER budgets_soft_delete
  BEFORE DELETE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- budget_lines: Audit fields
CREATE TRIGGER set_budget_lines_audit
  BEFORE INSERT OR UPDATE ON budget_lines
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- budget_lines: Soft delete
CREATE TRIGGER budget_lines_soft_delete
  BEFORE DELETE ON budget_lines
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- =====================================================
-- update_budget_totals() TRIGGER FUNCTION
-- =====================================================
-- Auto-update budget totals when lines change

CREATE OR REPLACE FUNCTION update_budget_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget_id UUID;
  v_total_income NUMERIC(15,4);
  v_total_expense NUMERIC(15,4);
BEGIN
  -- Determine which budget to update
  IF TG_OP = 'DELETE' THEN
    v_budget_id := OLD.budget_id;
  ELSE
    v_budget_id := NEW.budget_id;
  END IF;

  -- Calculate totals from budget_lines joined with accounts
  -- Income accounts (category = 'income') contribute to total_income
  -- Expense accounts (category = 'expense') contribute to total_expense
  SELECT
    COALESCE(SUM(CASE WHEN a.category = 'income' THEN bl.budgeted_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN a.category = 'expense' THEN bl.budgeted_amount ELSE 0 END), 0)
  INTO v_total_income, v_total_expense
  FROM budget_lines bl
  JOIN accounts a ON a.id = bl.account_id
  WHERE bl.budget_id = v_budget_id
    AND bl.deleted_at IS NULL;

  -- Update the budget
  UPDATE budgets
  SET total_income = v_total_income,
      total_expense = v_total_expense
  WHERE id = v_budget_id;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

-- Attach trigger to budget_lines
CREATE TRIGGER update_budget_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON budget_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_totals();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;

-- Super admins can access all
CREATE POLICY super_admin_all_budgets ON budgets
  FOR ALL
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'super_admin');

CREATE POLICY super_admin_all_budget_lines ON budget_lines
  FOR ALL
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'super_admin');

-- Users can view approved/active budgets for their community
CREATE POLICY users_view_budgets ON budgets
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND status IN ('approved', 'active', 'closed')  -- Residents can see finalized budgets
  );

CREATE POLICY users_view_budget_lines ON budget_lines
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND budget_id IN (
      SELECT id FROM budgets
      WHERE status IN ('approved', 'active', 'closed')
        AND deleted_at IS NULL
    )
  );

-- Admins can manage all budgets for their community
CREATE POLICY admins_manage_budgets ON budgets
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  );

CREATE POLICY admins_manage_budget_lines ON budget_lines
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE budgets IS
  'Annual or periodic budgets for community financial planning.
   Mexican HOA assemblies must approve annual budgets before implementation.
   total_income and total_expense are auto-calculated from budget_lines.
   Typical fiscal year: January 1 - December 31.';

COMMENT ON COLUMN budgets.total_income IS
  'Sum of budgeted_amount for all income account lines. Auto-calculated by trigger.';

COMMENT ON COLUMN budgets.total_expense IS
  'Sum of budgeted_amount for all expense account lines. Auto-calculated by trigger.';

COMMENT ON COLUMN budgets.assembly_minute_reference IS
  'Reference to assembly meeting minutes where budget was approved. Required for compliance.';

COMMENT ON TABLE budget_lines IS
  'Individual line items in a budget, linked to chart of accounts.
   Each line tracks budgeted vs actual amounts for variance analysis.
   variance column is auto-computed: positive = over budget, negative = under budget.';

COMMENT ON COLUMN budget_lines.actual_amount IS
  'Actual spending/income for this account during the budget period.
   Updated by scheduled job or manually by admin.
   Can be derived from ledger_entries sum for the account during period.';

COMMENT ON COLUMN budget_lines.variance IS
  'Computed column: actual_amount - budgeted_amount.
   Positive variance on expenses = over budget (bad).
   Positive variance on income = exceeded expectations (good).';
