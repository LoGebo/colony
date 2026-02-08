-- ============================================
-- DEPLOY RECORD_PAYMENT AND RECORD_CHARGE FUNCTIONS
-- ============================================
-- Phase 11 Plan 01: Deploy missing financial functions
-- These were defined in 20260129191023_record_payment_charge.sql
-- but are not present in the live database.
-- Using CREATE OR REPLACE to be idempotent.

-- ============================================
-- HELPER: GENERATE TRANSACTION REFERENCE
-- ============================================

CREATE OR REPLACE FUNCTION generate_transaction_reference(
  p_community_id UUID,
  p_prefix TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_reference TEXT;
BEGIN
  v_year := TO_CHAR(p_date, 'YYYY');

  -- Get next sequence number for this community/prefix/year
  SELECT COALESCE(
    MAX(
      NULLIF(
        REGEXP_REPLACE(reference_number, '^' || p_prefix || '-' || v_year || '-', ''),
        reference_number
      )::INTEGER
    ),
    0
  ) + 1
  INTO v_sequence
  FROM public.transactions
  WHERE community_id = p_community_id
    AND reference_number LIKE p_prefix || '-' || v_year || '-%';

  -- Format: PREFIX-YYYY-NNNNN (e.g., PAY-2026-00001)
  v_reference := p_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');

  RETURN v_reference;
END;
$$;

COMMENT ON FUNCTION generate_transaction_reference IS
  'Generates sequential transaction reference numbers.
   Format: PREFIX-YYYY-NNNNN (e.g., PAY-2026-00001, CHG-2026-00001)
   Sequence resets each year per community.';

-- ============================================
-- RECORD_PAYMENT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION record_payment(
  p_community_id UUID,
  p_unit_id UUID,
  p_amount money_amount,
  p_payment_date DATE,
  p_description TEXT,
  p_payment_method_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transaction_id UUID;
  v_reference TEXT;
  v_bank_account_id UUID;
  v_receivable_account_id UUID;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive: %', p_amount;
  END IF;

  -- Get Operating Bank Account (1010)
  SELECT id INTO v_bank_account_id
  FROM public.accounts
  WHERE community_id = p_community_id
    AND account_number = '1010'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operating Bank Account (1010) not found for community %', p_community_id;
  END IF;

  -- Get Accounts Receivable - Maintenance (1100)
  SELECT id INTO v_receivable_account_id
  FROM public.accounts
  WHERE community_id = p_community_id
    AND account_number = '1100'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accounts Receivable (1100) not found for community %', p_community_id;
  END IF;

  -- Generate reference number
  v_reference := public.generate_transaction_reference(p_community_id, 'PAY', p_payment_date);

  -- Create transaction
  INSERT INTO public.transactions (
    community_id,
    transaction_type,
    reference_number,
    description,
    unit_id,
    amount,
    status,
    effective_date,
    created_by
  ) VALUES (
    p_community_id,
    'payment',
    v_reference,
    p_description,
    p_unit_id,
    p_amount,
    'pending',
    p_payment_date,
    p_created_by
  ) RETURNING id INTO v_transaction_id;

  -- Create ledger entries (double-entry)
  -- Entry 1: Debit Operating Bank Account (increase asset)
  INSERT INTO public.ledger_entries (
    community_id,
    transaction_id,
    account_id,
    amount,
    entry_sequence
  ) VALUES (
    p_community_id,
    v_transaction_id,
    v_bank_account_id,
    p_amount,  -- Positive = Debit
    1
  );

  -- Entry 2: Credit Accounts Receivable (decrease asset)
  INSERT INTO public.ledger_entries (
    community_id,
    transaction_id,
    account_id,
    amount,
    entry_sequence
  ) VALUES (
    p_community_id,
    v_transaction_id,
    v_receivable_account_id,
    -p_amount,  -- Negative = Credit
    2
  );

  -- Post the transaction (validates balance = 0)
  UPDATE public.transactions
  SET status = 'posted', posted_by = p_created_by
  WHERE id = v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION record_payment IS
  'Records a payment received from a unit with proper double-entry.

   Double-entry entries:
   - Debit (increase): Operating Bank Account (1010) +amount
   - Credit (decrease): Accounts Receivable (1100) -amount

   Creates transaction in pending status, inserts ledger entries,
   then posts the transaction (validates entries sum to zero).

   Returns the transaction_id.';

-- ============================================
-- RECORD_CHARGE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION record_charge(
  p_community_id UUID,
  p_unit_id UUID,
  p_amount money_amount,
  p_charge_date DATE,
  p_description TEXT,
  p_fee_structure_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transaction_id UUID;
  v_reference TEXT;
  v_receivable_account_id UUID;
  v_income_account_id UUID;
  v_fee_structure RECORD;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Charge amount must be positive: %', p_amount;
  END IF;

  -- Get accounts from fee_structure if provided, otherwise use defaults
  IF p_fee_structure_id IS NOT NULL THEN
    SELECT
      receivable_account_id,
      income_account_id
    INTO v_fee_structure
    FROM public.fee_structures
    WHERE id = p_fee_structure_id
      AND deleted_at IS NULL;

    IF FOUND THEN
      v_receivable_account_id := v_fee_structure.receivable_account_id;
      v_income_account_id := v_fee_structure.income_account_id;
    END IF;
  END IF;

  -- Fall back to default accounts if not from fee_structure
  IF v_receivable_account_id IS NULL THEN
    SELECT id INTO v_receivable_account_id
    FROM public.accounts
    WHERE community_id = p_community_id
      AND account_number = '1100'  -- Accounts Receivable - Maintenance
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Accounts Receivable (1100) not found for community %', p_community_id;
    END IF;
  END IF;

  IF v_income_account_id IS NULL THEN
    SELECT id INTO v_income_account_id
    FROM public.accounts
    WHERE community_id = p_community_id
      AND account_number = '4010'  -- Maintenance Fee Income
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Maintenance Fee Income (4010) not found for community %', p_community_id;
    END IF;
  END IF;

  -- Generate reference number
  v_reference := public.generate_transaction_reference(p_community_id, 'CHG', p_charge_date);

  -- Create transaction
  INSERT INTO public.transactions (
    community_id,
    transaction_type,
    reference_number,
    description,
    unit_id,
    amount,
    status,
    effective_date,
    created_by
  ) VALUES (
    p_community_id,
    'charge',
    v_reference,
    p_description,
    p_unit_id,
    p_amount,
    'pending',
    p_charge_date,
    p_created_by
  ) RETURNING id INTO v_transaction_id;

  -- Create ledger entries (double-entry)
  -- Entry 1: Debit Accounts Receivable (increase asset - unit owes money)
  INSERT INTO public.ledger_entries (
    community_id,
    transaction_id,
    account_id,
    amount,
    entry_sequence
  ) VALUES (
    p_community_id,
    v_transaction_id,
    v_receivable_account_id,
    p_amount,  -- Positive = Debit
    1
  );

  -- Entry 2: Credit Income Account (increase income)
  INSERT INTO public.ledger_entries (
    community_id,
    transaction_id,
    account_id,
    amount,
    entry_sequence
  ) VALUES (
    p_community_id,
    v_transaction_id,
    v_income_account_id,
    -p_amount,  -- Negative = Credit
    2
  );

  -- Post the transaction (validates balance = 0)
  UPDATE public.transactions
  SET status = 'posted', posted_by = p_created_by
  WHERE id = v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION record_charge IS
  'Records a charge to a unit with proper double-entry.

   Double-entry entries:
   - Debit (increase): Accounts Receivable +amount
   - Credit (increase): Income Account -amount

   If fee_structure_id is provided, uses its income and receivable accounts.
   Otherwise uses defaults: 1100 (AR-Maintenance) and 4010 (Maintenance Fee Income).

   Creates transaction in pending status, inserts ledger entries,
   then posts the transaction (validates entries sum to zero).

   Returns the transaction_id.';
