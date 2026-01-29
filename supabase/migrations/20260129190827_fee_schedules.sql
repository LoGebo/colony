-- ============================================
-- FEE SCHEDULES TABLE AND CALCULATE_FEE_AMOUNT FUNCTION
-- ============================================
-- Phase 4 Plan 02: Fee Structures & Charges
--
-- fee_schedules: Links fee structures to specific units
-- calculate_fee_amount(): Computes fee amount based on unit coefficient
-- get_unit_fee_amount(): Wrapper that checks for overrides first

-- ============================================
-- FEE SCHEDULES TABLE
-- ============================================
-- Junction table linking fee structures to units with optional overrides

CREATE TABLE fee_schedules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,

  -- Override the calculated amount if needed (null = use calculated)
  override_amount money_amount,
  override_reason TEXT,

  -- Effective dates for this schedule
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique fee per unit per effective date
  CONSTRAINT fee_schedules_unique UNIQUE (fee_structure_id, unit_id, effective_from)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE fee_schedules IS
  'Links fee structures to specific units.
   Allows overriding calculated amounts for special cases (discounts, exemptions).
   Effective dates enable fee changes without losing history.';

COMMENT ON COLUMN fee_schedules.override_amount IS
  'If set, this amount is used instead of the calculated amount from fee_structure.
   Use for special arrangements, discounts, or exemptions.';

COMMENT ON COLUMN fee_schedules.override_reason IS
  'Documentation for why an override was set (e.g., "Board-approved discount", "Exempt per bylaws Article 5")';

COMMENT ON COLUMN fee_schedules.effective_from IS
  'Date when this fee schedule becomes active for the unit';

COMMENT ON COLUMN fee_schedules.effective_until IS
  'Date when this fee schedule ends. NULL means indefinitely active.';

-- ============================================
-- INDEXES
-- ============================================

-- Unit fee lookup (most common query)
CREATE INDEX idx_fee_schedules_unit_active
  ON fee_schedules(unit_id, is_active)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Fee structure lookup
CREATE INDEX idx_fee_schedules_fee_structure
  ON fee_schedules(fee_structure_id)
  WHERE deleted_at IS NULL;

-- Community-wide queries
CREATE INDEX idx_fee_schedules_community
  ON fee_schedules(community_id, effective_from)
  WHERE deleted_at IS NULL;

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER fee_schedules_audit
  BEFORE INSERT OR UPDATE ON fee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_fee_schedules" ON fee_schedules FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's fee schedules
CREATE POLICY "users_view_fee_schedules" ON fee_schedules FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can manage fee schedules
CREATE POLICY "admins_manage_fee_schedules" ON fee_schedules FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- CALCULATE_FEE_AMOUNT FUNCTION
-- ============================================
-- Calculates fee amount for a unit based on the fee structure's formula
-- Uses the Mexican indiviso coefficient pattern

CREATE OR REPLACE FUNCTION calculate_fee_amount(
  p_fee_structure_id UUID,
  p_unit_id UUID
)
RETURNS money_amount
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fee RECORD;
  v_unit RECORD;
  v_calculated_amount NUMERIC(15, 4);
BEGIN
  -- Get fee structure
  SELECT
    calculation_type,
    base_amount,
    coefficient_amount
  INTO v_fee
  FROM public.fee_structures
  WHERE id = p_fee_structure_id
    AND deleted_at IS NULL
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee structure % not found or not active', p_fee_structure_id;
  END IF;

  -- Get unit with coefficient
  SELECT coefficient
  INTO v_unit
  FROM public.units
  WHERE id = p_unit_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit % not found', p_unit_id;
  END IF;

  -- Calculate based on calculation_type
  CASE v_fee.calculation_type
    WHEN 'fixed' THEN
      -- Same amount for all units
      v_calculated_amount := v_fee.base_amount;

    WHEN 'coefficient' THEN
      -- Proportional to unit coefficient (Mexican indiviso)
      -- coefficient is stored as percentage (e.g., 1.5 for 1.5%)
      -- base_amount is the total community budget portion
      -- Result: base_amount * (coefficient / 100)
      v_calculated_amount := v_fee.base_amount * (v_unit.coefficient / 100.0);

    WHEN 'hybrid' THEN
      -- Fixed base + coefficient portion
      -- Total = base_amount + (coefficient_amount * coefficient / 100)
      v_calculated_amount := v_fee.base_amount +
        (COALESCE(v_fee.coefficient_amount, 0) * (v_unit.coefficient / 100.0));

    WHEN 'tiered' THEN
      -- Tiered calculation (simplified - use base_amount)
      -- Future: could look up tier based on unit_type or area
      v_calculated_amount := v_fee.base_amount;

    WHEN 'custom' THEN
      -- Custom formula (simplified - use base_amount)
      -- Future: could evaluate custom_formula JSONB
      v_calculated_amount := v_fee.base_amount;

    ELSE
      v_calculated_amount := v_fee.base_amount;
  END CASE;

  -- Round to 2 decimal places for currency precision
  RETURN ROUND(v_calculated_amount, 2);
END;
$$;

COMMENT ON FUNCTION calculate_fee_amount IS
  'Calculates fee amount for a unit based on fee structure formula.
   Uses Mexican indiviso coefficient for proportional calculations.

   Calculation types:
   - fixed: returns base_amount directly
   - coefficient: base_amount * (unit.coefficient / 100)
   - hybrid: base_amount + (coefficient_amount * unit.coefficient / 100)
   - tiered/custom: simplified to base_amount (extend as needed)

   Example: $10000 base * 1.5% coefficient = $150';

-- ============================================
-- GET_UNIT_FEE_AMOUNT FUNCTION
-- ============================================
-- Wrapper that checks for override_amount first, then falls back to calculation

CREATE OR REPLACE FUNCTION get_unit_fee_amount(
  p_unit_id UUID,
  p_fee_structure_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS money_amount
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_override_amount NUMERIC(15, 4);
  v_calculated_amount NUMERIC(15, 4);
BEGIN
  -- Check for active fee schedule with override
  SELECT fs.override_amount INTO v_override_amount
  FROM public.fee_schedules fs
  WHERE fs.fee_structure_id = p_fee_structure_id
    AND fs.unit_id = p_unit_id
    AND fs.is_active = TRUE
    AND fs.deleted_at IS NULL
    AND fs.effective_from <= p_as_of_date
    AND (fs.effective_until IS NULL OR fs.effective_until >= p_as_of_date)
  ORDER BY fs.effective_from DESC
  LIMIT 1;

  -- If override exists, return it
  IF v_override_amount IS NOT NULL THEN
    RETURN v_override_amount;
  END IF;

  -- Otherwise calculate the fee amount
  RETURN public.calculate_fee_amount(p_fee_structure_id, p_unit_id);
END;
$$;

COMMENT ON FUNCTION get_unit_fee_amount IS
  'Returns the fee amount for a unit, checking for overrides first.

   Priority:
   1. If active fee_schedule has override_amount, return that
   2. Otherwise, calculate using calculate_fee_amount()

   Use this function when generating charges to respect special arrangements.';
