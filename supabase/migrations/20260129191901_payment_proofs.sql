-- ============================================
-- PAYMENT PROOFS TABLE
-- ============================================
-- Phase 4 Plan 04: Bank Reconciliation
--
-- Residents upload payment proofs (transfer receipts, deposit slips, etc.)
-- which go through an approval workflow. When approved, a payment
-- transaction is automatically created via trigger.

CREATE TABLE payment_proofs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Links (payment_id is set by trigger when approved)
  payment_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,

  -- Proof details
  proof_type TEXT NOT NULL
    CHECK (proof_type IN ('transfer_receipt', 'deposit_slip', 'spei_confirmation', 'other')),
  amount money_amount NOT NULL,
  payment_date DATE NOT NULL,
  reference_number TEXT,                    -- Reference from payment proof
  bank_name TEXT,

  -- Document storage (Supabase Storage)
  document_url TEXT NOT NULL,               -- Storage path/URL
  document_filename TEXT,
  document_size_bytes INTEGER,

  -- Approval workflow
  status approval_status NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Notes
  submitter_notes TEXT,
  reviewer_notes TEXT,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Payment ID must be set if approved
  CONSTRAINT payment_proofs_approved_has_payment
    CHECK (status != 'approved' OR payment_id IS NOT NULL)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE payment_proofs IS
  'Payment proof submissions from residents.
   Goes through pending->approved/rejected workflow.
   When approved, trigger creates a payment transaction in the ledger.';

COMMENT ON COLUMN payment_proofs.payment_id IS
  'Auto-linked to created transaction when proof is approved. Set by trigger.';
COMMENT ON COLUMN payment_proofs.proof_type IS
  'Type of proof: transfer_receipt (bank transfer), deposit_slip (cash deposit),
   spei_confirmation (SPEI confirmation), other.';
COMMENT ON COLUMN payment_proofs.document_url IS
  'Path in Supabase Storage (e.g., {community_id}/{unit_id}/proofs/{filename}).';
COMMENT ON COLUMN payment_proofs.status IS
  'Workflow status: pending (awaiting review), approved (payment created),
   rejected (declined), cancelled (withdrawn by user), expired (timed out).';
COMMENT ON COLUMN payment_proofs.rejection_reason IS
  'Reason for rejection (required when rejecting).';

-- ============================================
-- TRIGGER: AUTO-CREATE PAYMENT ON APPROVAL
-- ============================================
-- When a payment proof is approved, automatically create the payment transaction

CREATE OR REPLACE FUNCTION on_payment_proof_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transaction_id UUID;
  v_description TEXT;
BEGIN
  -- Only fire when status changes to approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Build description from proof details
    v_description := 'Payment ' || COALESCE(NEW.proof_type, 'unknown') ||
                     COALESCE(' ref: ' || NEW.reference_number, '') ||
                     COALESCE(' bank: ' || NEW.bank_name, '');

    -- Create the payment transaction using record_payment
    v_transaction_id := public.record_payment(
      p_community_id := NEW.community_id,
      p_unit_id := NEW.unit_id,
      p_amount := NEW.amount,
      p_payment_date := NEW.payment_date,
      p_description := v_description,
      p_payment_method_id := NULL,  -- Could be enhanced to look up based on proof_type
      p_created_by := NEW.reviewed_by
    );

    -- Link the proof to the created transaction
    NEW.payment_id := v_transaction_id;
    NEW.reviewed_at := now();
  END IF;

  -- Set reviewed_at for rejections too
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    NEW.reviewed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_payment_proof_approved IS
  'Trigger function that creates a payment transaction when a proof is approved.
   Uses record_payment() for proper double-entry accounting.
   Links the created transaction back to the payment_proof record.';

CREATE TRIGGER payment_proof_approved
  BEFORE UPDATE ON payment_proofs
  FOR EACH ROW
  WHEN (NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected'))
  EXECUTE FUNCTION on_payment_proof_approved();

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER payment_proofs_audit
  BEFORE INSERT OR UPDATE ON payment_proofs
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- INDEXES
-- ============================================

-- Pending proofs for review queue (most important index)
CREATE INDEX idx_payment_proofs_pending_queue
  ON payment_proofs(community_id, submitted_at)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- Unit's proof history
CREATE INDEX idx_payment_proofs_unit_history
  ON payment_proofs(unit_id, submitted_at DESC)
  WHERE deleted_at IS NULL;

-- User's submissions (for "my proofs" view)
CREATE INDEX idx_payment_proofs_submitted_by
  ON payment_proofs(submitted_by, submitted_at DESC)
  WHERE deleted_at IS NULL;

-- Status filter for reporting
CREATE INDEX idx_payment_proofs_status
  ON payment_proofs(community_id, status)
  WHERE deleted_at IS NULL;

-- Link to created transaction
CREATE INDEX idx_payment_proofs_payment
  ON payment_proofs(payment_id)
  WHERE payment_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_payment_proofs" ON payment_proofs FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Residents can submit proofs for their units
CREATE POLICY "residents_insert_payment_proofs" ON payment_proofs FOR INSERT TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND submitted_by = auth.uid()
    AND unit_id IN (
      SELECT o.unit_id FROM occupancies o
      WHERE o.resident_id = auth.uid()
        AND o.deleted_at IS NULL
    )
  );

-- Residents can view their own submitted proofs
CREATE POLICY "residents_view_own_payment_proofs" ON payment_proofs FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR unit_id IN (
      SELECT o.unit_id FROM occupancies o
      WHERE o.resident_id = auth.uid()
        AND o.deleted_at IS NULL
    )
  );

-- Admins can view all community proofs
CREATE POLICY "admins_view_community_payment_proofs" ON payment_proofs FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Admins can update proofs (approve/reject)
CREATE POLICY "admins_update_payment_proofs" ON payment_proofs FOR UPDATE TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );
