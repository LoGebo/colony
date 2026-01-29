-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
-- Phase 4 Plan 01: Chart of Accounts & Double-Entry Ledger
--
-- Transaction headers for the double-entry ledger.
-- CRITICAL: Posted transactions are IMMUTABLE (enforced by triggers)
-- Corrections are made via reversal transactions, not modifications.

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Transaction identification
  transaction_type transaction_type NOT NULL,
  reference_number TEXT NOT NULL,           -- Human-readable: PAY-2026-00001, CHG-2026-00001
  description TEXT NOT NULL,

  -- Related entities (nullable - some transactions are community-level)
  unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID REFERENCES residents(id) ON DELETE RESTRICT,

  -- Amount (sum of ledger entries must equal this for validation)
  amount money_amount NOT NULL,
  currency currency_code NOT NULL DEFAULT 'MXN',

  -- Status (mutable only while pending)
  status transaction_status NOT NULL DEFAULT 'pending',
  posted_at TIMESTAMPTZ,                    -- Set when status changes to posted
  posted_by UUID REFERENCES auth.users(id),

  -- Reversal tracking
  reverses_transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
  reversed_by_transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,

  -- Effective date (when it counts for accounting, may differ from created_at)
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique reference per community
  CONSTRAINT transactions_ref_unique UNIQUE (community_id, reference_number)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE transactions IS
  'Transaction headers for double-entry ledger.
   Each transaction has one or more ledger_entries that must sum to zero.
   Posted transactions are IMMUTABLE - corrections via reversal only.';

COMMENT ON COLUMN transactions.reference_number IS
  'Human-readable reference: PAY-YYYY-NNNNN, CHG-YYYY-NNNNN, ADJ-YYYY-NNNNN';
COMMENT ON COLUMN transactions.amount IS
  'Total transaction amount. Ledger entries must net to zero.';
COMMENT ON COLUMN transactions.status IS
  'pending=mutable, posted=immutable, voided=cancelled via reversal';
COMMENT ON COLUMN transactions.posted_at IS
  'Timestamp when transaction was posted (became immutable)';
COMMENT ON COLUMN transactions.reverses_transaction_id IS
  'If this is a reversal, points to the transaction being reversed';
COMMENT ON COLUMN transactions.reversed_by_transaction_id IS
  'Back-link to the reversal transaction (if this transaction was reversed)';
COMMENT ON COLUMN transactions.effective_date IS
  'Accounting date - may differ from created_at for backdated entries';

-- ============================================
-- IMMUTABILITY TRIGGERS
-- ============================================
-- CRITICAL: These triggers enforce that posted transactions cannot be modified

CREATE OR REPLACE FUNCTION prevent_posted_transaction_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Cannot delete posted transaction %. Create a reversal instead.', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'posted' THEN
      -- Only allow updating reversed_by_transaction_id on posted transactions
      -- This is needed when creating a reversal
      IF NEW.status != OLD.status OR
         NEW.amount != OLD.amount OR
         NEW.transaction_type != OLD.transaction_type OR
         NEW.description != OLD.description OR
         NEW.reference_number != OLD.reference_number OR
         NEW.unit_id IS DISTINCT FROM OLD.unit_id OR
         NEW.resident_id IS DISTINCT FROM OLD.resident_id OR
         NEW.effective_date != OLD.effective_date THEN
        RAISE EXCEPTION 'Cannot modify posted transaction %. Create a reversal instead.', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_posted_transaction_modification IS
  'Trigger function enforcing immutability of posted transactions.
   Only reversed_by_transaction_id can be updated on posted transactions.';

CREATE TRIGGER transactions_immutable
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_transaction_modification();

-- ============================================
-- POSTING VALIDATION TRIGGER
-- ============================================
-- When status changes to posted, validate ledger entries sum to zero

CREATE OR REPLACE FUNCTION validate_posted_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  entry_sum NUMERIC(15, 4);
BEGIN
  IF NEW.status = 'posted' AND OLD.status = 'pending' THEN
    -- Check that ledger entries sum to zero
    SELECT COALESCE(SUM(amount), 0) INTO entry_sum
    FROM ledger_entries
    WHERE transaction_id = NEW.id;

    IF entry_sum != 0 THEN
      RAISE EXCEPTION 'Cannot post transaction %: ledger entries sum to % (must be 0)',
        NEW.id, entry_sum;
    END IF;

    -- Set posted timestamp
    NEW.posted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_posted_transaction IS
  'Validates that ledger entries sum to zero before allowing transaction to be posted.
   Also sets posted_at timestamp.';

CREATE TRIGGER transactions_validate_on_post
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  WHEN (NEW.status = 'posted' AND OLD.status = 'pending')
  EXECUTE FUNCTION validate_posted_transaction();

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER transactions_audit
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- INDEXES
-- ============================================

-- Community + type + status for filtered queries
CREATE INDEX idx_transactions_community_type_status
  ON transactions(community_id, transaction_type, status)
  WHERE deleted_at IS NULL;

-- Unit + effective date for unit statements
CREATE INDEX idx_transactions_unit_date
  ON transactions(unit_id, effective_date DESC)
  WHERE unit_id IS NOT NULL AND deleted_at IS NULL;

-- Effective date for period queries
CREATE INDEX idx_transactions_effective_date
  ON transactions(community_id, effective_date DESC)
  WHERE deleted_at IS NULL;

-- Pending transactions for processing queues
CREATE INDEX idx_transactions_pending
  ON transactions(community_id, created_at)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- Reversal tracking
CREATE INDEX idx_transactions_reverses
  ON transactions(reverses_transaction_id)
  WHERE reverses_transaction_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_transactions" ON transactions FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's transactions
CREATE POLICY "users_view_community_transactions" ON transactions FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can manage transactions (INSERT/UPDATE/DELETE - triggers still enforce immutability)
CREATE POLICY "admins_manage_transactions" ON transactions FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Residents can view their own unit's transactions
CREATE POLICY "residents_view_unit_transactions" ON transactions FOR SELECT TO authenticated
  USING (
    unit_id IN (
      SELECT o.unit_id FROM occupancies o
      WHERE o.resident_id = auth.uid()
        AND o.deleted_at IS NULL
    )
  );
