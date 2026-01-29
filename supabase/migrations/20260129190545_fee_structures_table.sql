-- ============================================
-- FEE STRUCTURES TABLE
-- ============================================
-- Phase 4 Plan 02: Fee Structures & Charges
--
-- Fee templates defining how charges are calculated.
-- Supports fixed, coefficient-based (Mexican indiviso), hybrid, tiered, and custom formulas.
-- Links to accounts for proper double-entry posting.

CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  name TEXT NOT NULL,                       -- "Cuota de Mantenimiento Ordinaria"
  description TEXT,
  code TEXT,                                -- "MAINT-ORD" for reference

  -- Calculation method
  calculation_type fee_calculation_type NOT NULL,

  -- For fixed: this is the amount
  -- For coefficient: this is the base amount that gets multiplied by coefficient
  -- For hybrid: this is the fixed portion
  base_amount money_amount NOT NULL,

  -- For hybrid: coefficient-based portion added to base_amount
  coefficient_amount money_amount DEFAULT 0,

  -- For custom calculations (JSONB formula)
  -- Example: {"formula": "base + (coefficient * rate)", "rate": 50.00}
  custom_formula JSONB,

  -- Billing configuration
  frequency fee_frequency NOT NULL,
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28),

  -- Accounts for double-entry posting
  -- When charging: Debit receivable_account_id, Credit income_account_id
  income_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  receivable_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

  -- Which unit types this fee applies to
  applicable_unit_types unit_type[] DEFAULT ARRAY['casa', 'departamento']::unit_type[],

  -- Status and effective dates
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique code within community (allows null codes)
  CONSTRAINT fee_structures_code_unique UNIQUE NULLS NOT DISTINCT (community_id, code)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE fee_structures IS
  'Fee templates defining how charges are calculated.
   Mexican indiviso coefficient (stored on units table) is used for proportional calculations.
   Each fee structure links to income and receivable accounts for double-entry posting.';

COMMENT ON COLUMN fee_structures.calculation_type IS
  'fixed=same for all units, coefficient=proportional to unit coefficient,
   hybrid=fixed base + proportional portion, tiered=by unit type, custom=JSONB formula';

COMMENT ON COLUMN fee_structures.base_amount IS
  'For fixed: the fee amount. For coefficient: total budget that gets proportioned.
   For hybrid: fixed portion. Example: $10000 base * 1.5% coefficient = $150';

COMMENT ON COLUMN fee_structures.coefficient_amount IS
  'For hybrid calculation: the amount multiplied by coefficient/100 and added to base_amount.
   Hybrid total = base_amount + (coefficient_amount * unit.coefficient / 100)';

COMMENT ON COLUMN fee_structures.day_of_month IS
  'Day of month when fee is due (1-28 to avoid month-end issues)';

COMMENT ON COLUMN fee_structures.income_account_id IS
  'Income account credited when charging this fee (e.g., 4010 Maintenance Fee Income)';

COMMENT ON COLUMN fee_structures.receivable_account_id IS
  'Receivable account debited when charging this fee (e.g., 1100 Accounts Receivable)';

COMMENT ON COLUMN fee_structures.applicable_unit_types IS
  'Array of unit types this fee applies to. Defaults to casa and departamento.';

-- ============================================
-- INDEXES
-- ============================================

-- Active fees for a community
CREATE INDEX idx_fee_structures_community_active
  ON fee_structures(community_id, is_active)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Account references for FK lookups
CREATE INDEX idx_fee_structures_income_account
  ON fee_structures(income_account_id);

CREATE INDEX idx_fee_structures_receivable_account
  ON fee_structures(receivable_account_id);

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER fee_structures_audit
  BEFORE INSERT OR UPDATE ON fee_structures
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_fee_structures" ON fee_structures FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's fee structures
CREATE POLICY "users_view_fee_structures" ON fee_structures FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Admins can manage fee structures
CREATE POLICY "admins_manage_fee_structures" ON fee_structures FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );
