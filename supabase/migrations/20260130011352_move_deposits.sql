-- Migration: Move deposits table
-- Phase: 07-operations-compliance
-- Plan: 03 (Move Coordination)
-- Description: Damage deposit tracking with inspection, deductions, and refund workflow

--------------------------------------------------------------------------------
-- move_deposits table
--------------------------------------------------------------------------------

CREATE TABLE move_deposits (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Link to move request (optional - can be collected before move request exists)
  move_request_id UUID REFERENCES move_requests(id) ON DELETE SET NULL,

  -- Unit and resident
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Deposit details
  deposit_type TEXT NOT NULL DEFAULT 'damage' CHECK (deposit_type IN ('damage', 'move', 'key')),
  amount money_amount NOT NULL,

  -- Collection info
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_by UUID REFERENCES auth.users(id),
  payment_method TEXT,
  receipt_number TEXT,

  -- Status workflow
  status deposit_status NOT NULL DEFAULT 'collected',

  -- Inspection results
  inspection_date DATE,
  inspection_notes TEXT,
  inspection_photos TEXT[],

  -- Deductions
  deduction_amount money_amount DEFAULT 0,
  deduction_reason TEXT,

  -- Computed refund amount
  refund_amount money_amount GENERATED ALWAYS AS (amount - COALESCE(deduction_amount, 0)) STORED,

  -- Refund tracking
  refund_approved_at TIMESTAMPTZ,
  refund_approved_by UUID REFERENCES auth.users(id),
  refund_processed_at TIMESTAMPTZ,
  refund_method TEXT,
  refund_reference TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT move_deposits_deduction_not_exceed_amount CHECK (
    deduction_amount IS NULL OR deduction_amount <= amount
  ),
  CONSTRAINT move_deposits_refund_approval_consistency CHECK (
    (refund_approved_at IS NULL) = (refund_approved_by IS NULL)
  ),
  CONSTRAINT move_deposits_refund_processed_requires_status CHECK (
    refund_processed_at IS NULL OR status = 'refunded'
  )
);

COMMENT ON TABLE move_deposits IS 'Damage/move/key deposits with inspection, deduction, and refund workflow';
COMMENT ON COLUMN move_deposits.refund_amount IS 'Auto-computed as amount - deduction_amount';
COMMENT ON COLUMN move_deposits.inspection_photos IS 'Array of URLs to damage photos in storage bucket';

--------------------------------------------------------------------------------
-- Indexes
--------------------------------------------------------------------------------

CREATE INDEX idx_move_deposits_community_status
  ON move_deposits(community_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_move_deposits_unit
  ON move_deposits(unit_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_move_deposits_resident
  ON move_deposits(resident_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_move_deposits_refund_pending
  ON move_deposits(community_id)
  WHERE status = 'refund_pending' AND deleted_at IS NULL;

--------------------------------------------------------------------------------
-- Workflow function: Process deposit deductions
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_deposit_refund(
  p_deposit_id UUID,
  p_deduction_amount NUMERIC(15,4),
  p_reason TEXT
)
RETURNS move_deposits AS $$
DECLARE
  v_deposit move_deposits;
BEGIN
  -- Validate deposit exists and is in correct state
  SELECT * INTO v_deposit
  FROM move_deposits
  WHERE id = p_deposit_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit not found: %', p_deposit_id;
  END IF;

  IF v_deposit.status NOT IN ('held', 'inspection_pending') THEN
    RAISE EXCEPTION 'Deposit must be in held or inspection_pending status to process deductions. Current: %', v_deposit.status;
  END IF;

  IF p_deduction_amount > v_deposit.amount THEN
    RAISE EXCEPTION 'Deduction amount (%) cannot exceed deposit amount (%)', p_deduction_amount, v_deposit.amount;
  END IF;

  -- Update deposit with deductions
  UPDATE move_deposits
  SET deduction_amount = p_deduction_amount,
      deduction_reason = p_reason,
      status = 'deductions_pending',
      updated_at = now()
  WHERE id = p_deposit_id
  RETURNING * INTO v_deposit;

  RETURN v_deposit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_deposit_refund(UUID, NUMERIC(15,4), TEXT) IS
  'Sets deduction amount and reason, moves deposit to deductions_pending status';

--------------------------------------------------------------------------------
-- Workflow function: Approve deposit refund
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION approve_deposit_refund(p_deposit_id UUID)
RETURNS move_deposits AS $$
DECLARE
  v_deposit move_deposits;
BEGIN
  -- Validate deposit exists and is in correct state
  SELECT * INTO v_deposit
  FROM move_deposits
  WHERE id = p_deposit_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit not found: %', p_deposit_id;
  END IF;

  IF v_deposit.status != 'deductions_pending' THEN
    RAISE EXCEPTION 'Deposit must be in deductions_pending status to approve refund. Current: %', v_deposit.status;
  END IF;

  -- Approve refund
  UPDATE move_deposits
  SET status = 'refund_pending',
      refund_approved_at = now(),
      refund_approved_by = auth.uid(),
      updated_at = now()
  WHERE id = p_deposit_id
  RETURNING * INTO v_deposit;

  RETURN v_deposit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION approve_deposit_refund(UUID) IS
  'Approves deposit for refund, sets refund_approved_at/by, moves to refund_pending status';

--------------------------------------------------------------------------------
-- Workflow function: Complete deposit refund
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION complete_deposit_refund(
  p_deposit_id UUID,
  p_method TEXT,
  p_reference TEXT
)
RETURNS move_deposits AS $$
DECLARE
  v_deposit move_deposits;
BEGIN
  -- Validate deposit exists and is in correct state
  SELECT * INTO v_deposit
  FROM move_deposits
  WHERE id = p_deposit_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit not found: %', p_deposit_id;
  END IF;

  IF v_deposit.status != 'refund_pending' THEN
    RAISE EXCEPTION 'Deposit must be in refund_pending status to complete refund. Current: %', v_deposit.status;
  END IF;

  -- Complete refund
  UPDATE move_deposits
  SET status = 'refunded',
      refund_processed_at = now(),
      refund_method = p_method,
      refund_reference = p_reference,
      updated_at = now()
  WHERE id = p_deposit_id
  RETURNING * INTO v_deposit;

  RETURN v_deposit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_deposit_refund(UUID, TEXT, TEXT) IS
  'Marks deposit as refunded with payment method and reference';

--------------------------------------------------------------------------------
-- Workflow function: Forfeit deposit
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION forfeit_deposit(
  p_deposit_id UUID,
  p_reason TEXT
)
RETURNS move_deposits AS $$
DECLARE
  v_deposit move_deposits;
BEGIN
  -- Validate deposit exists
  SELECT * INTO v_deposit
  FROM move_deposits
  WHERE id = p_deposit_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit not found: %', p_deposit_id;
  END IF;

  IF v_deposit.status IN ('refunded', 'forfeited') THEN
    RAISE EXCEPTION 'Deposit already in terminal status: %', v_deposit.status;
  END IF;

  -- Forfeit entire deposit
  UPDATE move_deposits
  SET status = 'forfeited',
      deduction_amount = amount,
      deduction_reason = p_reason,
      updated_at = now()
  WHERE id = p_deposit_id
  RETURNING * INTO v_deposit;

  RETURN v_deposit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION forfeit_deposit(UUID, TEXT) IS
  'Forfeits entire deposit due to damages/violations. Sets deduction_amount = amount.';

--------------------------------------------------------------------------------
-- RLS Policies
--------------------------------------------------------------------------------

ALTER TABLE move_deposits ENABLE ROW LEVEL SECURITY;

-- Admins full CRUD
CREATE POLICY move_deposits_admin ON move_deposits
  FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
  );

-- Residents can view own deposits
CREATE POLICY move_deposits_resident_select ON move_deposits
  FOR SELECT TO authenticated
  USING (
    resident_id = auth.uid()
    AND deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Audit trigger
--------------------------------------------------------------------------------

CREATE TRIGGER set_move_deposits_audit
  BEFORE INSERT OR UPDATE ON move_deposits
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

--------------------------------------------------------------------------------
-- Status change timestamp trigger
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_deposit_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-update relevant timestamps based on status change
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'inspection_pending' THEN
        -- Move to inspection after hold period
        NULL;
      WHEN 'refunded' THEN
        IF NEW.refund_processed_at IS NULL THEN
          NEW.refund_processed_at := now();
        END IF;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_deposit_status_timestamp
  BEFORE UPDATE ON move_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_status_timestamp();
