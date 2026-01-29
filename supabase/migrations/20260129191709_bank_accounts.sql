-- ============================================
-- BANK ACCOUNTS TABLE
-- ============================================
-- Phase 4 Plan 04: Bank Reconciliation
--
-- SECURITY: Only last 4 digits of account numbers stored in plaintext.
-- Full account number is hashed (SHA-256) for matching purposes.
-- This prevents exposure of full account numbers in case of data breach.

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Bank information
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,             -- Last 4 digits only for display
  account_number_hash TEXT NOT NULL,        -- SHA-256 of full account number for matching
  clabe TEXT,                               -- Mexican CLABE 18-digit interbank code (last 4)
  clabe_hash TEXT,                          -- SHA-256 of full CLABE for matching

  -- Account classification
  account_type TEXT NOT NULL DEFAULT 'checking'
    CHECK (account_type IN ('checking', 'savings')),
  currency currency_code NOT NULL DEFAULT 'MXN',

  -- Link to chart of accounts (bank = asset account)
  gl_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  -- Statement tracking
  last_statement_balance money_amount,
  last_statement_date DATE,

  -- Status flags
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE bank_accounts IS
  'Bank accounts for treasury operations.
   SECURITY: Only last 4 digits stored in plaintext, full number is hashed.
   Each bank account links to a GL account (asset) in the chart of accounts.';

COMMENT ON COLUMN bank_accounts.account_number IS
  'Last 4 digits only for display (e.g., "****1234"). Full number never stored.';
COMMENT ON COLUMN bank_accounts.account_number_hash IS
  'SHA-256 hash of full account number. Used for matching imported statements.';
COMMENT ON COLUMN bank_accounts.clabe IS
  'Mexican CLABE 18-digit code (last 4 digits only). Used for SPEI transfers.';
COMMENT ON COLUMN bank_accounts.clabe_hash IS
  'SHA-256 hash of full CLABE. Used for matching SPEI transfers.';
COMMENT ON COLUMN bank_accounts.gl_account_id IS
  'Links to accounts table - must be an asset account (bank/cash type).';
COMMENT ON COLUMN bank_accounts.is_primary IS
  'Primary account for receiving payments. Only one per community should be true.';

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER bank_accounts_audit
  BEFORE INSERT OR UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- INDEXES
-- ============================================

-- Community + active status for listing
CREATE INDEX idx_bank_accounts_community_active
  ON bank_accounts(community_id, is_active)
  WHERE deleted_at IS NULL;

-- Hash lookup for statement import matching
CREATE INDEX idx_bank_accounts_number_hash
  ON bank_accounts(account_number_hash)
  WHERE deleted_at IS NULL;

-- CLABE hash lookup for SPEI matching
CREATE INDEX idx_bank_accounts_clabe_hash
  ON bank_accounts(clabe_hash)
  WHERE clabe_hash IS NOT NULL AND deleted_at IS NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_bank_accounts" ON bank_accounts FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's bank accounts (last 4 digits only)
CREATE POLICY "users_view_community_bank_accounts" ON bank_accounts FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Only admins can manage bank accounts
CREATE POLICY "admins_manage_bank_accounts" ON bank_accounts FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );
