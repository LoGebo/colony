-- ============================================
-- PAYMENT METHODS TABLE
-- ============================================
-- Phase 4 Plan 02: Fee Structures & Charges
--
-- Common payment methods for Mexican HOAs:
-- - SPEI (interbank electronic transfers)
-- - Bank transfers
-- - Cash
-- - Card payments
-- - Checks

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  name TEXT NOT NULL,                       -- "SPEI Transfer", "Cash", "Credit Card"
  code TEXT NOT NULL,                       -- spei, transfer, cash, card, check

  -- Payment method characteristics
  is_electronic BOOLEAN NOT NULL DEFAULT TRUE,
  requires_proof BOOLEAN NOT NULL DEFAULT TRUE,  -- SPEI/transfer needs proof upload

  -- Bank account for electronic payments (nullable, for future bank_accounts table)
  -- bank_account_id UUID REFERENCES bank_accounts(id),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique code per community
  CONSTRAINT payment_methods_code_unique UNIQUE (community_id, code)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE payment_methods IS
  'Payment methods available for each community.
   Common Mexican methods: SPEI (interbank), transfer, cash, card, check.
   is_electronic indicates if payment is traceable.
   requires_proof indicates if admin needs to verify payment (e.g., SPEI receipt).';

COMMENT ON COLUMN payment_methods.code IS
  'Short code for the payment method: spei, transfer, cash, card, check';

COMMENT ON COLUMN payment_methods.is_electronic IS
  'True for electronic payments (SPEI, transfer, card). False for cash/check.';

COMMENT ON COLUMN payment_methods.requires_proof IS
  'True if payment requires proof upload (transfer receipts, SPEI confirmations).';

COMMENT ON COLUMN payment_methods.display_order IS
  'Order to display in payment method dropdown (lower = first)';

-- ============================================
-- INDEXES
-- ============================================

-- Active methods for a community (for dropdown)
CREATE INDEX idx_payment_methods_community_active
  ON payment_methods(community_id, display_order)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER payment_methods_audit
  BEFORE INSERT OR UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_payment_methods" ON payment_methods FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's payment methods
CREATE POLICY "users_view_payment_methods" ON payment_methods FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can manage payment methods
CREATE POLICY "admins_manage_payment_methods" ON payment_methods FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- SEED DEFAULT PAYMENT METHODS FUNCTION
-- ============================================
-- Creates standard payment methods for a new community

CREATE OR REPLACE FUNCTION create_default_payment_methods(p_community_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO public.payment_methods (community_id, name, code, is_electronic, requires_proof, display_order)
  VALUES
    (p_community_id, 'SPEI', 'spei', TRUE, TRUE, 1),
    (p_community_id, 'Transferencia Bancaria', 'transfer', TRUE, TRUE, 2),
    (p_community_id, 'Efectivo', 'cash', FALSE, FALSE, 3),
    (p_community_id, 'Tarjeta de Crédito/Débito', 'card', TRUE, FALSE, 4),
    (p_community_id, 'Cheque', 'check', FALSE, TRUE, 5)
  ON CONFLICT (community_id, code) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION create_default_payment_methods IS
  'Creates standard Mexican payment methods for a new community.
   Call this when setting up a new community.
   Methods: SPEI, Transferencia, Efectivo, Tarjeta, Cheque.';
