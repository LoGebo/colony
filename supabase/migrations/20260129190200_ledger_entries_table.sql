-- ============================================
-- LEDGER ENTRIES TABLE (IMMUTABLE)
-- ============================================
-- Phase 4 Plan 01: Chart of Accounts & Double-Entry Ledger
--
-- CRITICAL: This table is APPEND-ONLY (same pattern as access_logs)
-- - NO deleted_at column (entries are never deleted)
-- - NO updated_at column (entries are never updated)
-- - Triggers PREVENT UPDATE and DELETE operations
-- - Each transaction's entries MUST sum to zero (validated on posting)
--
-- Double-entry bookkeeping:
-- - Positive amount = DEBIT (increases assets/expenses)
-- - Negative amount = CREDIT (increases liabilities/equity/income)
-- - Sum of all entries per transaction MUST equal zero

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  -- Debit is positive, credit is negative
  -- Sum of all entries in a transaction MUST equal zero
  amount money_amount_signed NOT NULL,

  -- Running balance after this entry (for O(1) historical lookups)
  balance_after money_amount_signed,

  -- Order within transaction
  entry_sequence INTEGER NOT NULL,

  -- Audit - NO updated_at (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: no zero-amount entries
  CONSTRAINT ledger_entries_nonzero CHECK (amount != 0)

  -- NO deleted_at column - ledger entries are never deleted
  -- NO updated_at column - ledger entries are never updated
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ledger_entries IS
  'Immutable double-entry ledger. UPDATE and DELETE are blocked by triggers.
   Positive amounts = debits, negative amounts = credits.
   Sum of entries per transaction must equal zero (validated on posting).
   This is the permanent audit trail for all financial activity.';

COMMENT ON COLUMN ledger_entries.amount IS
  'Positive = debit (increases assets/expenses), negative = credit (increases liabilities/equity/income)';
COMMENT ON COLUMN ledger_entries.balance_after IS
  'Running balance on the account after this entry. Enables O(1) point-in-time balance lookups.';
COMMENT ON COLUMN ledger_entries.entry_sequence IS
  'Order of entry within the transaction (1, 2, 3...)';
COMMENT ON COLUMN ledger_entries.created_at IS
  'Timestamp of entry creation. This is the only time field (no updated_at - immutable).';

-- ============================================
-- IMMUTABILITY ENFORCEMENT
-- ============================================
-- CRITICAL: These triggers RAISE EXCEPTION on UPDATE/DELETE
-- Same pattern as access_logs table from Phase 3

CREATE OR REPLACE FUNCTION prevent_ledger_entry_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % operations are not allowed', TG_OP;
END;
$$;

COMMENT ON FUNCTION prevent_ledger_entry_modification IS
  'Trigger function that prevents UPDATE and DELETE on ledger_entries table.
   Financial ledger entries are permanent audit records.';

-- Block UPDATE operations
CREATE TRIGGER ledger_entries_immutable_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_entry_modification();

-- Block DELETE operations
CREATE TRIGGER ledger_entries_immutable_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_entry_modification();

-- ============================================
-- ACCOUNT BALANCE UPDATE TRIGGER
-- ============================================
-- Updates the running balance on accounts table when entries are inserted

CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance NUMERIC(15, 4);
BEGIN
  -- Get current balance and lock the row
  SELECT current_balance INTO v_current_balance
  FROM accounts
  WHERE id = NEW.account_id
  FOR UPDATE;

  -- Calculate new balance
  NEW.balance_after := v_current_balance + NEW.amount;

  -- Update account's running balance
  UPDATE accounts
  SET current_balance = NEW.balance_after,
      balance_as_of = now()
  WHERE id = NEW.account_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_account_balance IS
  'Updates account running balance when ledger entry is inserted.
   Also sets balance_after on the entry for historical queries.';

CREATE TRIGGER ledger_entries_update_balance
  BEFORE INSERT ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance();

-- ============================================
-- INDEXES
-- ============================================

-- Transaction detail queries
CREATE INDEX idx_ledger_entries_transaction
  ON ledger_entries(transaction_id, entry_sequence);

-- Account history (most recent first)
CREATE INDEX idx_ledger_entries_account_history
  ON ledger_entries(account_id, created_at DESC);

-- Community audit queries
CREATE INDEX idx_ledger_entries_community
  ON ledger_entries(community_id, created_at DESC);

-- BRIN index for time-series queries (1000x smaller than B-tree)
CREATE INDEX idx_ledger_entries_timestamp_brin
  ON ledger_entries USING BRIN (created_at)
  WITH (pages_per_range = 32);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Similar to access_logs - immutable audit trail

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- Super admins can view all entries and insert (still can't UPDATE/DELETE due to triggers)
CREATE POLICY "super_admin_all_ledger_entries" ON ledger_entries FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's ledger entries
CREATE POLICY "users_view_community_ledger" ON ledger_entries FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can insert new entries (but not UPDATE/DELETE - triggers block that)
CREATE POLICY "admins_insert_ledger" ON ledger_entries FOR INSERT TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- HELPER VIEW: Account Ledger with Transaction Details
-- ============================================

CREATE OR REPLACE VIEW account_ledger AS
SELECT
  le.id,
  le.community_id,
  le.transaction_id,
  le.account_id,
  a.account_number,
  a.name AS account_name,
  a.category,
  t.reference_number,
  t.description AS transaction_description,
  t.transaction_type,
  t.status AS transaction_status,
  t.effective_date,
  le.amount,
  le.balance_after,
  le.entry_sequence,
  le.created_at
FROM ledger_entries le
JOIN accounts a ON a.id = le.account_id
JOIN transactions t ON t.id = le.transaction_id
WHERE a.deleted_at IS NULL;

COMMENT ON VIEW account_ledger IS
  'Ledger entries with account and transaction details for reporting.
   Shows account name, transaction reference, and running balance.';
