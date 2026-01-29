-- ============================================
-- RESERVATION FEES TABLE AND FINANCIAL INTEGRATION
-- Phase 5 Plan 02 Task 3: Reservation Fees with Transaction Links
-- ============================================
-- Tracks fees associated with reservations (deposits, usage, no-show, cancellation)
-- and integrates with Phase 4 financial engine for double-entry accounting.

-- ============================================
-- FEE TYPE ENUM
-- ============================================

CREATE TYPE fee_type_reservation AS ENUM (
  'deposit',      -- Refundable damage deposit (charged before, refunded after)
  'usage',        -- Hourly or flat usage fee
  'no_show',      -- Penalty for not showing up
  'cancellation'  -- Late cancellation fee
);

COMMENT ON TYPE fee_type_reservation IS
  'Types of fees associated with amenity reservations.
   deposit = refundable damage deposit (held during reservation)
   usage = hourly/flat amenity usage fee
   no_show = penalty when resident does not attend
   cancellation = fee for late cancellation';

-- ============================================
-- RESERVATION_FEES TABLE
-- ============================================

CREATE TABLE reservation_fees (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,

  -- Fee details
  fee_type fee_type_reservation NOT NULL,
  amount money_amount NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'waived')),

  -- Payment tracking
  paid_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES transactions(id),  -- Links to charge transaction

  -- Refund tracking (for deposits)
  refunded_at TIMESTAMPTZ,
  refund_transaction_id UUID REFERENCES transactions(id),  -- Links to refund transaction

  -- Notes
  notes TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- Allow multiple no_show or cancellation fees (theoretical edge cases)
-- But only one deposit and one usage fee per reservation
CREATE UNIQUE INDEX idx_reservation_fees_unique_per_type
  ON reservation_fees(reservation_id, fee_type)
  WHERE fee_type IN ('deposit', 'usage') AND deleted_at IS NULL;

-- ============================================
-- TABLE AND COLUMN COMMENTS
-- ============================================

COMMENT ON TABLE reservation_fees IS
  'Fees associated with amenity reservations.
   Links to Phase 4 financial engine via transaction_id.
   Supports: deposits (refundable), usage fees, no-show penalties, cancellation fees.';

COMMENT ON COLUMN reservation_fees.fee_type IS
  'Type of fee: deposit, usage, no_show, or cancellation';

COMMENT ON COLUMN reservation_fees.amount IS
  'Fee amount in community currency. Uses money_amount domain.';

COMMENT ON COLUMN reservation_fees.status IS
  'Fee status: pending (not yet charged), paid (charged), refunded (deposit returned), waived (forgiven)';

COMMENT ON COLUMN reservation_fees.transaction_id IS
  'Links to transactions table from Phase 4 financial engine.
   Set when fee is charged via record_charge().';

COMMENT ON COLUMN reservation_fees.refund_transaction_id IS
  'Links to refund transaction for deposits.
   Set when deposit is returned via refund_reservation_deposit().';

-- ============================================
-- INDEXES
-- ============================================

-- Lookup fees by reservation
CREATE INDEX idx_reservation_fees_reservation
  ON reservation_fees(reservation_id)
  WHERE deleted_at IS NULL;

-- Pending fees for follow-up
CREATE INDEX idx_reservation_fees_pending
  ON reservation_fees(community_id, status)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- Fee type queries
CREATE INDEX idx_reservation_fees_type
  ON reservation_fees(community_id, fee_type)
  WHERE deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger
CREATE TRIGGER set_reservation_fees_audit
  BEFORE INSERT OR UPDATE ON reservation_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER reservation_fees_soft_delete
  BEFORE DELETE ON reservation_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE reservation_fees ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY super_admin_all_reservation_fees ON reservation_fees
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users: view own fees (via reservation)
CREATE POLICY users_view_own_fees ON reservation_fees
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = reservation_fees.reservation_id
        AND r.resident_id = auth.uid()
    )
  );

-- Admins: manage all fees in community
CREATE POLICY admins_manage_fees ON reservation_fees
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- CHARGE RESERVATION DEPOSIT FUNCTION
-- ============================================
-- Creates a deposit fee and charges it via the financial engine

CREATE OR REPLACE FUNCTION charge_reservation_deposit(p_reservation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fee_id UUID;
  v_transaction_id UUID;
  v_reservation RECORD;
  v_amenity RECORD;
BEGIN
  -- Get reservation details
  SELECT r.*, a.deposit_amount, a.name as amenity_name, a.community_id
  INTO v_reservation
  FROM public.reservations r
  JOIN public.amenities a ON a.id = r.amenity_id
  WHERE r.id = p_reservation_id AND r.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id;
  END IF;

  -- Check if deposit is required
  IF v_reservation.deposit_amount IS NULL OR v_reservation.deposit_amount <= 0 THEN
    -- No deposit required for this amenity
    RETURN NULL;
  END IF;

  -- Check if deposit already exists
  IF EXISTS (
    SELECT 1 FROM public.reservation_fees
    WHERE reservation_id = p_reservation_id
      AND fee_type = 'deposit'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Deposit already charged for reservation %', p_reservation_id;
  END IF;

  -- Create fee record
  INSERT INTO public.reservation_fees (
    community_id,
    reservation_id,
    fee_type,
    amount,
    status,
    notes
  ) VALUES (
    v_reservation.community_id,
    p_reservation_id,
    'deposit',
    v_reservation.deposit_amount,
    'pending',
    'Deposit for ' || v_reservation.amenity_name || ' reservation'
  )
  RETURNING id INTO v_fee_id;

  -- Create transaction via financial engine
  v_transaction_id := public.record_charge(
    v_reservation.community_id,
    v_reservation.unit_id,
    v_reservation.deposit_amount,
    CURRENT_DATE,
    'Amenity deposit: ' || v_reservation.amenity_name,
    NULL,  -- No fee_structure_id (this is a deposit, not recurring fee)
    v_reservation.resident_id
  );

  -- Update fee with transaction link and mark as paid
  UPDATE public.reservation_fees
  SET status = 'paid',
      paid_at = now(),
      transaction_id = v_transaction_id
  WHERE id = v_fee_id;

  RETURN v_fee_id;
END;
$$;

COMMENT ON FUNCTION charge_reservation_deposit IS
  'Charges a deposit for an amenity reservation.

   Process:
   1. Gets reservation and amenity details
   2. Checks if deposit is required (amenity.deposit_amount)
   3. Creates reservation_fees record
   4. Creates transaction via record_charge() from financial engine
   5. Links transaction to fee

   Parameters:
     p_reservation_id: UUID of reservation

   Returns:
     UUID of fee record, or NULL if no deposit required

   Raises:
     - "Reservation not found" if invalid ID
     - "Deposit already charged" if duplicate attempt';

-- ============================================
-- REFUND RESERVATION DEPOSIT FUNCTION
-- ============================================
-- Refunds a previously charged deposit

CREATE OR REPLACE FUNCTION refund_reservation_deposit(
  p_reservation_id UUID,
  p_refund_reason TEXT DEFAULT 'Deposit refund - reservation completed'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fee RECORD;
  v_refund_transaction_id UUID;
BEGIN
  -- Find the deposit fee
  SELECT * INTO v_fee
  FROM public.reservation_fees
  WHERE reservation_id = p_reservation_id
    AND fee_type = 'deposit'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No deposit found for reservation %', p_reservation_id;
  END IF;

  -- Check status
  IF v_fee.status != 'paid' THEN
    RAISE EXCEPTION 'Deposit is not paid (status: %)', v_fee.status;
  END IF;

  IF v_fee.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deposit already refunded for reservation %', p_reservation_id;
  END IF;

  -- Get reservation for unit_id
  DECLARE
    v_reservation RECORD;
  BEGIN
    SELECT * INTO v_reservation
    FROM public.reservations
    WHERE id = p_reservation_id;

    -- Create refund transaction via financial engine
    -- Note: record_payment credits the unit's account (reduces receivable)
    v_refund_transaction_id := public.record_payment(
      v_fee.community_id,
      v_reservation.unit_id,
      v_fee.amount,
      CURRENT_DATE,
      p_refund_reason,
      NULL,  -- No payment_method_id for internal refund
      v_reservation.resident_id
    );
  END;

  -- Update fee record
  UPDATE public.reservation_fees
  SET status = 'refunded',
      refunded_at = now(),
      refund_transaction_id = v_refund_transaction_id,
      notes = COALESCE(notes, '') || E'\nRefunded: ' || p_refund_reason
  WHERE id = v_fee.id;

  RETURN v_refund_transaction_id;
END;
$$;

COMMENT ON FUNCTION refund_reservation_deposit IS
  'Refunds a deposit for a completed/cancelled reservation.

   Process:
   1. Finds the paid deposit fee
   2. Creates refund transaction via record_payment() (credits unit account)
   3. Updates fee status to refunded

   Parameters:
     p_reservation_id: UUID of reservation
     p_refund_reason: Reason for refund (default: "Deposit refund - reservation completed")

   Returns:
     UUID of refund transaction

   Raises:
     - "No deposit found" if no deposit exists
     - "Deposit is not paid" if status is not paid
     - "Deposit already refunded" if already processed';

-- ============================================
-- CHARGE RESERVATION USAGE FEE FUNCTION
-- ============================================
-- Creates a usage fee for an amenity reservation

CREATE OR REPLACE FUNCTION charge_reservation_usage(p_reservation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fee_id UUID;
  v_transaction_id UUID;
  v_reservation RECORD;
  v_amenity RECORD;
  v_duration_hours NUMERIC;
  v_usage_amount NUMERIC;
BEGIN
  -- Get reservation details
  SELECT r.*, a.hourly_rate, a.name as amenity_name, a.community_id
  INTO v_reservation
  FROM public.reservations r
  JOIN public.amenities a ON a.id = r.amenity_id
  WHERE r.id = p_reservation_id AND r.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id;
  END IF;

  -- Check if usage fee applies
  IF v_reservation.hourly_rate IS NULL OR v_reservation.hourly_rate <= 0 THEN
    -- Free amenity
    RETURN NULL;
  END IF;

  -- Check if usage fee already exists
  IF EXISTS (
    SELECT 1 FROM public.reservation_fees
    WHERE reservation_id = p_reservation_id
      AND fee_type = 'usage'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Usage fee already charged for reservation %', p_reservation_id;
  END IF;

  -- Calculate duration in hours
  v_duration_hours := EXTRACT(EPOCH FROM (
    upper(v_reservation.reserved_range) - lower(v_reservation.reserved_range)
  )) / 3600.0;

  -- Calculate usage fee
  v_usage_amount := ROUND(v_reservation.hourly_rate * v_duration_hours, 2);

  -- Create fee record
  INSERT INTO public.reservation_fees (
    community_id,
    reservation_id,
    fee_type,
    amount,
    status,
    notes
  ) VALUES (
    v_reservation.community_id,
    p_reservation_id,
    'usage',
    v_usage_amount,
    'pending',
    format('Usage fee for %s (%s hours @ $%s/hr)',
      v_reservation.amenity_name,
      ROUND(v_duration_hours, 1),
      v_reservation.hourly_rate)
  )
  RETURNING id INTO v_fee_id;

  -- Create transaction via financial engine
  v_transaction_id := public.record_charge(
    v_reservation.community_id,
    v_reservation.unit_id,
    v_usage_amount,
    CURRENT_DATE,
    'Amenity usage: ' || v_reservation.amenity_name,
    NULL,  -- No fee_structure_id
    v_reservation.resident_id
  );

  -- Update fee with transaction link and mark as paid
  UPDATE public.reservation_fees
  SET status = 'paid',
      paid_at = now(),
      transaction_id = v_transaction_id
  WHERE id = v_fee_id;

  RETURN v_fee_id;
END;
$$;

COMMENT ON FUNCTION charge_reservation_usage IS
  'Charges a usage fee for an amenity reservation based on hourly rate.

   Process:
   1. Gets reservation and amenity details
   2. Calculates duration from reserved_range
   3. Computes fee as hourly_rate * duration_hours
   4. Creates reservation_fees record
   5. Creates transaction via record_charge()

   Parameters:
     p_reservation_id: UUID of reservation

   Returns:
     UUID of fee record, or NULL if amenity is free

   Formula: amount = hourly_rate * (end_time - start_time) in hours';

-- ============================================
-- CHARGE NO-SHOW FEE FUNCTION
-- ============================================
-- Applies a no-show penalty when resident doesn't attend

CREATE OR REPLACE FUNCTION charge_no_show_fee(
  p_reservation_id UUID,
  p_penalty_amount money_amount DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fee_id UUID;
  v_transaction_id UUID;
  v_reservation RECORD;
  v_final_amount NUMERIC;
BEGIN
  -- Get reservation details
  SELECT r.*, a.deposit_amount, a.name as amenity_name, a.community_id
  INTO v_reservation
  FROM public.reservations r
  JOIN public.amenities a ON a.id = r.amenity_id
  WHERE r.id = p_reservation_id AND r.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id;
  END IF;

  -- Determine penalty amount (use provided or default to deposit amount or 0)
  v_final_amount := COALESCE(p_penalty_amount, v_reservation.deposit_amount, 0);

  IF v_final_amount <= 0 THEN
    -- No penalty to charge
    RETURN NULL;
  END IF;

  -- Mark reservation as no-show
  UPDATE public.reservations
  SET status = 'no_show',
      no_show_at = now()
  WHERE id = p_reservation_id;

  -- Create fee record
  INSERT INTO public.reservation_fees (
    community_id,
    reservation_id,
    fee_type,
    amount,
    status,
    notes
  ) VALUES (
    v_reservation.community_id,
    p_reservation_id,
    'no_show',
    v_final_amount,
    'pending',
    'No-show penalty for ' || v_reservation.amenity_name
  )
  RETURNING id INTO v_fee_id;

  -- Create transaction via financial engine
  v_transaction_id := public.record_charge(
    v_reservation.community_id,
    v_reservation.unit_id,
    v_final_amount,
    CURRENT_DATE,
    'No-show penalty: ' || v_reservation.amenity_name,
    NULL,
    v_reservation.resident_id
  );

  -- Update fee with transaction link and mark as paid
  UPDATE public.reservation_fees
  SET status = 'paid',
      paid_at = now(),
      transaction_id = v_transaction_id
  WHERE id = v_fee_id;

  RETURN v_fee_id;
END;
$$;

COMMENT ON FUNCTION charge_no_show_fee IS
  'Charges a no-show penalty when resident does not attend reservation.

   Process:
   1. Gets reservation and amenity details
   2. Uses provided penalty or falls back to deposit amount
   3. Updates reservation status to no_show
   4. Creates reservation_fees record
   5. Creates transaction via record_charge()

   Parameters:
     p_reservation_id: UUID of reservation
     p_penalty_amount: Custom penalty (defaults to amenity deposit_amount)

   Returns:
     UUID of fee record, or NULL if no penalty amount';
