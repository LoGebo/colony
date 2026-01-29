-- ============================================
-- BANK STATEMENTS AND STATEMENT LINES TABLES
-- ============================================
-- Phase 4 Plan 04: Bank Reconciliation
--
-- Supports import of bank statements in various formats (CSV, OFX, MT940).
-- Each statement contains line items that can be matched to transactions.

-- ============================================
-- STATEMENT LINE STATUS ENUM
-- ============================================

CREATE TYPE statement_line_status AS ENUM (
  'unmatched',          -- Not yet reconciled
  'matched',            -- Auto-matched to a transaction
  'manually_matched',   -- Manually matched by user
  'excluded',           -- Intentionally excluded (bank fees, etc.)
  'disputed'            -- Flagged for investigation
);

COMMENT ON TYPE statement_line_status IS
  'Reconciliation status for bank statement lines.
   unmatched: awaiting reconciliation
   matched: auto-matched by system rules
   manually_matched: matched by user intervention
   excluded: intentionally skipped (not a transaction we track)
   disputed: requires investigation';

-- ============================================
-- BANK STATEMENTS TABLE
-- ============================================

CREATE TABLE bank_statements (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,

  -- Statement period
  statement_date DATE NOT NULL,             -- Statement closing date
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Balances
  opening_balance money_amount NOT NULL,
  closing_balance money_amount NOT NULL,
  total_credits money_amount NOT NULL DEFAULT 0,
  total_debits money_amount NOT NULL DEFAULT 0,

  -- Import metadata
  line_count INTEGER NOT NULL DEFAULT 0,
  import_format TEXT,                       -- csv, ofx, mt940
  original_filename TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id),

  -- Reconciliation status
  is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  lines_matched INTEGER NOT NULL DEFAULT 0,
  lines_unmatched INTEGER NOT NULL DEFAULT 0,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Prevent duplicate statement imports
  CONSTRAINT bank_statements_unique_period UNIQUE (bank_account_id, statement_date)
);

-- ============================================
-- BANK STATEMENT LINES TABLE
-- ============================================

CREATE TABLE bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,

  -- Line identification
  line_number INTEGER NOT NULL,

  -- Transaction details from bank
  transaction_date DATE NOT NULL,           -- Transaction date from bank
  value_date DATE,                          -- Settlement date (may differ)
  description TEXT NOT NULL,
  reference TEXT,                           -- Bank reference number

  -- Amount (positive=credit/deposit, negative=debit/withdrawal)
  amount money_amount_signed NOT NULL,

  -- Reconciliation status
  status statement_line_status NOT NULL DEFAULT 'unmatched',
  matched_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES auth.users(id),
  match_confidence NUMERIC(3, 2),           -- 0.00 to 1.00 for auto-match confidence

  -- Notes
  notes TEXT,

  -- Unique line within statement
  CONSTRAINT bank_statement_lines_unique_line UNIQUE (statement_id, line_number),

  -- Confidence must be in valid range
  CONSTRAINT bank_statement_lines_confidence_range
    CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1))
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE bank_statements IS
  'Imported bank statements for reconciliation.
   Each statement has a period and contains multiple line items.
   Reconciliation tracks how many lines are matched vs unmatched.';

COMMENT ON COLUMN bank_statements.statement_date IS
  'Statement closing date (typically end of month).';
COMMENT ON COLUMN bank_statements.import_format IS
  'Format of imported file: csv, ofx (Open Financial Exchange), mt940 (SWIFT).';
COMMENT ON COLUMN bank_statements.is_reconciled IS
  'TRUE when all lines are matched/excluded and differences resolved.';
COMMENT ON COLUMN bank_statements.lines_matched IS
  'Count of lines with status matched, manually_matched, or excluded.';
COMMENT ON COLUMN bank_statements.lines_unmatched IS
  'Count of lines with status unmatched or disputed.';

COMMENT ON TABLE bank_statement_lines IS
  'Individual transactions from bank statements.
   Each line can be matched to a transaction in the ledger.
   Amount sign: positive = credit (deposit), negative = debit (withdrawal).';

COMMENT ON COLUMN bank_statement_lines.value_date IS
  'Settlement date - when funds actually moved (may differ from transaction_date).';
COMMENT ON COLUMN bank_statement_lines.reference IS
  'Bank-provided reference number for the transaction.';
COMMENT ON COLUMN bank_statement_lines.match_confidence IS
  'Auto-match confidence score (0.00-1.00). NULL for manual matches.';

-- ============================================
-- TRIGGER: Update statement counts on line status change
-- ============================================

CREATE OR REPLACE FUNCTION update_statement_line_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE bank_statements
    SET
      lines_matched = (
        SELECT COUNT(*) FROM bank_statement_lines
        WHERE statement_id = NEW.statement_id
          AND status IN ('matched', 'manually_matched', 'excluded')
      ),
      lines_unmatched = (
        SELECT COUNT(*) FROM bank_statement_lines
        WHERE statement_id = NEW.statement_id
          AND status IN ('unmatched', 'disputed')
      )
    WHERE id = NEW.statement_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE bank_statements
    SET
      lines_matched = (
        SELECT COUNT(*) FROM bank_statement_lines
        WHERE statement_id = OLD.statement_id
          AND status IN ('matched', 'manually_matched', 'excluded')
      ),
      lines_unmatched = (
        SELECT COUNT(*) FROM bank_statement_lines
        WHERE statement_id = OLD.statement_id
          AND status IN ('unmatched', 'disputed')
      )
    WHERE id = OLD.statement_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION update_statement_line_counts IS
  'Updates lines_matched and lines_unmatched counts on bank_statements
   when statement lines are inserted, updated, or deleted.';

CREATE TRIGGER bank_statement_lines_update_counts
  AFTER INSERT OR UPDATE OF status OR DELETE ON bank_statement_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_statement_line_counts();

-- ============================================
-- AUDIT TRIGGERS
-- ============================================

CREATE TRIGGER bank_statements_audit
  BEFORE INSERT OR UPDATE ON bank_statements
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Note: bank_statement_lines doesn't need audit trigger - immutable once imported

-- ============================================
-- INDEXES
-- ============================================

-- Bank statements: account + date for listing
CREATE INDEX idx_bank_statements_account_date
  ON bank_statements(bank_account_id, statement_date DESC)
  WHERE deleted_at IS NULL;

-- Bank statements: unreconciled for processing queue
CREATE INDEX idx_bank_statements_unreconciled
  ON bank_statements(community_id, imported_at)
  WHERE is_reconciled = FALSE AND deleted_at IS NULL;

-- Statement lines: by status for reconciliation UI
CREATE INDEX idx_bank_statement_lines_status
  ON bank_statement_lines(statement_id, status);

-- Statement lines: by date for matching queries
CREATE INDEX idx_bank_statement_lines_date
  ON bank_statement_lines(transaction_date);

-- Statement lines: matched transaction lookup
CREATE INDEX idx_bank_statement_lines_matched
  ON bank_statement_lines(matched_transaction_id)
  WHERE matched_transaction_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_lines ENABLE ROW LEVEL SECURITY;

-- Super admins have full access to statements
CREATE POLICY "super_admin_all_bank_statements" ON bank_statements FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's statements
CREATE POLICY "users_view_community_bank_statements" ON bank_statements FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can manage statements
CREATE POLICY "admins_manage_bank_statements" ON bank_statements FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Super admins have full access to statement lines
CREATE POLICY "super_admin_all_bank_statement_lines" ON bank_statement_lines FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's statement lines
CREATE POLICY "users_view_community_bank_statement_lines" ON bank_statement_lines FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can manage statement lines
CREATE POLICY "admins_manage_bank_statement_lines" ON bank_statement_lines FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );
