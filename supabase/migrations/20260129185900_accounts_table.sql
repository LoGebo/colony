-- ============================================
-- ACCOUNTS TABLE (CHART OF ACCOUNTS)
-- ============================================
-- Phase 4 Plan 01: Chart of Accounts & Double-Entry Ledger
--
-- Hierarchical chart of accounts with:
-- - HOA standard numbering (1000s-7000s)
-- - Operating vs Reserve fund separation (Mexican law requirement)
-- - Running balance updated by ledger entry triggers
-- - Parent/child relationships for sub-accounts

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Account identification
  account_number TEXT NOT NULL,             -- e.g., "1010", "4100"
  name TEXT NOT NULL,                       -- e.g., "Operating Bank Account"
  description TEXT,

  -- Classification
  category account_category NOT NULL,
  subtype account_subtype NOT NULL,

  -- Hierarchy (for sub-accounts)
  parent_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  depth INTEGER NOT NULL DEFAULT 0,

  -- Operating vs Reserve fund separation (CRITICAL for Mexican HOA compliance)
  is_operating_fund BOOLEAN NOT NULL DEFAULT TRUE,
  is_reserve_fund BOOLEAN NOT NULL DEFAULT FALSE,

  -- Current balance (updated by ledger entry trigger)
  current_balance money_amount_signed NOT NULL DEFAULT 0,
  balance_as_of TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Normal balance determines how debits/credits affect this account
  -- Debit increases: asset, expense
  -- Credit increases: liability, equity, income
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_system_account BOOLEAN NOT NULL DEFAULT FALSE,  -- Cannot delete system accounts

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT accounts_number_unique UNIQUE (community_id, account_number),
  CONSTRAINT accounts_fund_type CHECK (
    NOT (is_operating_fund AND is_reserve_fund)  -- Can't be both, but can be neither
  )
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE accounts IS
  'Chart of accounts for double-entry bookkeeping.
   Each community has its own chart following HOA standard numbering.
   Mexican law requires operating/reserve fund separation.';

COMMENT ON COLUMN accounts.account_number IS
  'HOA standard numbering: 1000s assets, 2000s liabilities, 3000s equity, 4000s income, 5000s expenses';
COMMENT ON COLUMN accounts.is_operating_fund IS
  'True for operating fund accounts. Mexican HOA law requires separation of operating and reserve funds.';
COMMENT ON COLUMN accounts.is_reserve_fund IS
  'True for reserve fund accounts. Must track separately for compliance.';
COMMENT ON COLUMN accounts.current_balance IS
  'Running balance updated by ledger entry trigger. Positive for debit balances, negative for credit balances.';
COMMENT ON COLUMN accounts.normal_balance IS
  'debit for assets/expenses (increases with debits), credit for liabilities/equity/income (increases with credits)';
COMMENT ON COLUMN accounts.is_system_account IS
  'System accounts are auto-created and cannot be deleted by users.';

-- ============================================
-- INDEXES
-- ============================================

-- Parent lookup for hierarchy queries
CREATE INDEX idx_accounts_parent ON accounts(parent_account_id)
  WHERE parent_account_id IS NOT NULL;

-- Category + active for reporting queries
CREATE INDEX idx_accounts_category_active ON accounts(community_id, category, is_active)
  WHERE deleted_at IS NULL;

-- Fund type separation queries
CREATE INDEX idx_accounts_operating ON accounts(community_id, is_operating_fund)
  WHERE deleted_at IS NULL AND is_operating_fund = TRUE;

CREATE INDEX idx_accounts_reserve ON accounts(community_id, is_reserve_fund)
  WHERE deleted_at IS NULL AND is_reserve_fund = TRUE;

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER accounts_audit
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_accounts" ON accounts FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's accounts
CREATE POLICY "users_view_accounts" ON accounts FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can manage accounts (INSERT/UPDATE/DELETE)
CREATE POLICY "admins_manage_accounts" ON accounts FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- STANDARD CHART OF ACCOUNTS FUNCTION
-- ============================================
-- Creates the standard HOA chart of accounts for a new community

CREATE OR REPLACE FUNCTION create_standard_chart_of_accounts(p_community_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  accounts_created INTEGER := 0;
BEGIN
  -- Assets (1000s)
  INSERT INTO public.accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance, is_system_account)
  VALUES
    (p_community_id, '1010', 'Operating Bank Account', 'asset', 'cash', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '1020', 'Reserve Bank Account', 'asset', 'cash', FALSE, TRUE, 'debit', TRUE),
    (p_community_id, '1030', 'Petty Cash', 'asset', 'cash', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '1100', 'Accounts Receivable - Maintenance', 'asset', 'accounts_receivable', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '1110', 'Accounts Receivable - Special', 'asset', 'accounts_receivable', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '1120', 'Accounts Receivable - Interest', 'asset', 'accounts_receivable', TRUE, FALSE, 'debit', TRUE);

  -- Liabilities (2000s)
  INSERT INTO public.accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance, is_system_account)
  VALUES
    (p_community_id, '2010', 'Accounts Payable', 'liability', 'accounts_payable', TRUE, FALSE, 'credit', TRUE),
    (p_community_id, '2020', 'Security Deposits Held', 'liability', 'security_deposits', TRUE, FALSE, 'credit', TRUE),
    (p_community_id, '2030', 'Prepaid Fees', 'liability', 'deferred_income', TRUE, FALSE, 'credit', TRUE);

  -- Equity (3000s)
  INSERT INTO public.accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance, is_system_account)
  VALUES
    (p_community_id, '3010', 'Retained Earnings - Operating', 'equity', 'retained_earnings', TRUE, FALSE, 'credit', TRUE),
    (p_community_id, '3100', 'Reserve Fund Balance', 'equity', 'reserves', FALSE, TRUE, 'credit', TRUE);

  -- Income (4000s)
  INSERT INTO public.accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance, is_system_account)
  VALUES
    (p_community_id, '4010', 'Maintenance Fee Income', 'income', 'maintenance_fees', TRUE, FALSE, 'credit', TRUE),
    (p_community_id, '4020', 'Special Assessment Income', 'income', 'special_assessments', TRUE, FALSE, 'credit', TRUE),
    (p_community_id, '4030', 'Late Fee Income', 'income', 'late_fees', TRUE, FALSE, 'credit', TRUE),
    (p_community_id, '4040', 'Interest Income', 'income', 'other_income', TRUE, FALSE, 'credit', TRUE),
    (p_community_id, '4050', 'Amenity Fee Income', 'income', 'other_income', TRUE, FALSE, 'credit', TRUE);

  -- Expenses (5000s)
  INSERT INTO public.accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance, is_system_account)
  VALUES
    (p_community_id, '5010', 'Utilities - Water', 'expense', 'utilities', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '5020', 'Utilities - Electricity', 'expense', 'utilities', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '5030', 'Maintenance & Repairs', 'expense', 'maintenance', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '5040', 'Landscaping', 'expense', 'maintenance', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '5050', 'Security Services', 'expense', 'administrative', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '5060', 'Management Fees', 'expense', 'administrative', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '5070', 'Insurance', 'expense', 'insurance', TRUE, FALSE, 'debit', TRUE),
    (p_community_id, '5080', 'Legal & Professional', 'expense', 'administrative', TRUE, FALSE, 'debit', TRUE);

  -- Reserve Expenses (7000s)
  INSERT INTO public.accounts (community_id, account_number, name, category, subtype, is_operating_fund, is_reserve_fund, normal_balance, is_system_account)
  VALUES
    (p_community_id, '7010', 'Reserve - Major Repairs', 'expense', 'reserve_contribution', FALSE, TRUE, 'debit', TRUE),
    (p_community_id, '7020', 'Reserve - Equipment Replacement', 'expense', 'reserve_contribution', FALSE, TRUE, 'debit', TRUE);

  -- Count total accounts created
  SELECT COUNT(*) INTO accounts_created
  FROM public.accounts
  WHERE community_id = p_community_id AND is_system_account = TRUE;

  RETURN accounts_created;
END;
$$;

COMMENT ON FUNCTION create_standard_chart_of_accounts IS
  'Creates the standard HOA chart of accounts for a new community.
   Returns the number of accounts created.
   Uses HOA standard numbering: 1000s assets, 2000s liabilities, 3000s equity, 4000s income, 5000s expenses, 7000s reserve expenses.';
