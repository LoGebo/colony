-- Migration: interest_rules
-- Phase 4 Plan 03: Interest rules and calculate_interest function
-- Purpose: Configurable late payment interest rules per community with assembly approval tracking

-- =====================================================
-- interest_rules TABLE
-- =====================================================
-- Moratorium (late payment interest) rules configurable per community
-- Mexico has no federal limit on condominium moratorium rates
-- Rates must be approved by the General Assembly

CREATE TABLE interest_rules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Rule identification
  name TEXT NOT NULL,                                    -- e.g., "Moratorio 2% Mensual"
  description TEXT,

  -- When to apply
  grace_period_days INTEGER NOT NULL DEFAULT 0,          -- Days after due before interest starts
  applies_after_days INTEGER NOT NULL DEFAULT 1,         -- Days overdue to trigger this rule

  -- Calculation method
  calculation_method interest_calculation_method NOT NULL DEFAULT 'simple',
  rate_percentage NUMERIC(5,2) NOT NULL,                 -- e.g., 2.00 for 2%
  rate_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (rate_period IN ('daily', 'monthly', 'annual')),

  -- Caps (optional but recommended)
  max_rate_percentage NUMERIC(5,2),                      -- Cap on cumulative percentage
  max_amount money_amount,                               -- Cap on interest amount

  -- For flat_fee method
  flat_fee_amount money_amount,                          -- Fixed fee per period

  -- Priority for rule selection (lower = applied first)
  priority INTEGER NOT NULL DEFAULT 1,

  -- Status and effective dates
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Assembly approval tracking (legally required for rate changes)
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  assembly_minute_reference TEXT,                        -- Link to assembly minutes document

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT interest_rules_rate_positive CHECK (rate_percentage > 0),
  CONSTRAINT interest_rules_grace_period_non_negative CHECK (grace_period_days >= 0),
  CONSTRAINT interest_rules_applies_after_positive CHECK (applies_after_days >= 0),
  CONSTRAINT interest_rules_max_rate_positive CHECK (max_rate_percentage IS NULL OR max_rate_percentage > 0),
  CONSTRAINT interest_rules_flat_fee_method CHECK (
    calculation_method != 'flat_fee' OR flat_fee_amount IS NOT NULL
  )
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Primary lookup: active rules for a community
CREATE INDEX idx_interest_rules_community_active ON interest_rules(community_id, is_active)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Rule selection: by priority and days
CREATE INDEX idx_interest_rules_lookup ON interest_rules(
  community_id, priority, applies_after_days
) WHERE deleted_at IS NULL AND is_active = TRUE;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Audit fields (created_at, updated_at, created_by)
CREATE TRIGGER set_interest_rules_audit
  BEFORE INSERT OR UPDATE ON interest_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete support
CREATE TRIGGER interest_rules_soft_delete
  BEFORE DELETE ON interest_rules
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- =====================================================
-- calculate_interest() FUNCTION
-- =====================================================
-- Calculates interest amount based on principal and days overdue
-- Parameters:
--   p_community_id: Community to look up rules for
--   p_principal: Principal amount (positive value)
--   p_days_overdue: Number of days past due (positive value)
--   p_as_of_date: Date to evaluate effective rules (defaults to today)
-- Returns: Calculated interest amount (rounded to 4 decimal places)

CREATE OR REPLACE FUNCTION calculate_interest(
  p_community_id UUID,
  p_principal money_amount,
  p_days_overdue INTEGER,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS money_amount
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rule RECORD;
  v_interest_amount NUMERIC(15, 4) := 0;
  v_daily_rate NUMERIC(12, 10);
  v_applicable_days INTEGER;
BEGIN
  -- Validate inputs
  IF p_principal <= 0 OR p_days_overdue <= 0 THEN
    RETURN 0;
  END IF;

  -- Find applicable interest rule
  -- Order by priority (lower first), then by applies_after_days (highest matching first)
  SELECT * INTO v_rule
  FROM interest_rules
  WHERE community_id = p_community_id
    AND is_active = TRUE
    AND deleted_at IS NULL
    AND effective_from <= p_as_of_date
    AND (effective_until IS NULL OR effective_until >= p_as_of_date)
    AND applies_after_days <= p_days_overdue
  ORDER BY priority ASC, applies_after_days DESC
  LIMIT 1;

  -- No applicable rule found
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate applicable days (subtract grace period)
  v_applicable_days := GREATEST(0, p_days_overdue - v_rule.grace_period_days);

  -- No interest during grace period
  IF v_applicable_days <= 0 THEN
    RETURN 0;
  END IF;

  -- Calculate interest based on method
  CASE v_rule.calculation_method
    WHEN 'flat_fee' THEN
      -- Fixed fee regardless of principal or time
      v_interest_amount := COALESCE(v_rule.flat_fee_amount, 0);

    WHEN 'simple' THEN
      -- Simple interest: principal * rate * time
      CASE v_rule.rate_period
        WHEN 'daily' THEN
          v_interest_amount := p_principal * (v_rule.rate_percentage / 100.0) * v_applicable_days;
        WHEN 'monthly' THEN
          v_interest_amount := p_principal * (v_rule.rate_percentage / 100.0) * (v_applicable_days / 30.0);
        WHEN 'annual' THEN
          v_interest_amount := p_principal * (v_rule.rate_percentage / 100.0) * (v_applicable_days / 365.0);
      END CASE;

    WHEN 'compound_monthly' THEN
      -- Compound monthly: principal * (POWER(1 + rate, days/30) - 1)
      v_interest_amount := p_principal * (POWER(1 + (v_rule.rate_percentage / 100.0), v_applicable_days / 30.0) - 1);

    WHEN 'compound_daily' THEN
      -- Compound daily: principal * (POWER(1 + rate/365, days) - 1)
      v_daily_rate := v_rule.rate_percentage / 100.0 / 365.0;
      v_interest_amount := p_principal * (POWER(1 + v_daily_rate, v_applicable_days) - 1);
  END CASE;

  -- Apply caps
  IF v_rule.max_rate_percentage IS NOT NULL THEN
    v_interest_amount := LEAST(
      v_interest_amount,
      p_principal * (v_rule.max_rate_percentage / 100.0)
    );
  END IF;

  IF v_rule.max_amount IS NOT NULL THEN
    v_interest_amount := LEAST(v_interest_amount, v_rule.max_amount);
  END IF;

  RETURN ROUND(v_interest_amount, 4);
END;
$$;

COMMENT ON FUNCTION calculate_interest IS
  'Calculates late payment interest (moratorios) based on community rules.
   Finds the highest-priority applicable rule for the given days overdue.
   Respects grace period, applies calculation method, and enforces caps.
   Returns 0 if no applicable rule or within grace period.';

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE interest_rules ENABLE ROW LEVEL SECURITY;

-- Super admins can access all interest rules
CREATE POLICY super_admin_all_interest_rules ON interest_rules
  FOR ALL
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'super_admin');

-- Users can view active interest rules for their community
CREATE POLICY users_view_interest_rules ON interest_rules
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Admins can manage interest rules for their community
CREATE POLICY admins_manage_interest_rules ON interest_rules
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE interest_rules IS
  'Moratorium (late payment interest) rules configurable per community.
   Mexico has no federal limit on condominium moratorium rates.
   Rates must be approved by the General Assembly (tracked via approved_at, approved_by, assembly_minute_reference).
   Typical rule: 2% monthly simple interest after 1 day grace period, capped at 50% of principal.';

COMMENT ON COLUMN interest_rules.grace_period_days IS
  'Days after due date before interest starts accruing. Common values: 0-15 days.';

COMMENT ON COLUMN interest_rules.applies_after_days IS
  'Minimum days overdue for this rule to apply. Allows tiered rules (e.g., 2% after 1 day, 3% after 60 days).';

COMMENT ON COLUMN interest_rules.rate_period IS
  'Time period for the rate: daily, monthly, or annual. Monthly is most common for Mexican HOAs.';

COMMENT ON COLUMN interest_rules.max_rate_percentage IS
  'Maximum cumulative interest as percentage of principal. Prevents runaway interest.';

COMMENT ON COLUMN interest_rules.max_amount IS
  'Maximum interest amount in currency. Alternative cap method.';

COMMENT ON COLUMN interest_rules.assembly_minute_reference IS
  'Reference to assembly meeting minutes where rate was approved. Required for legal compliance.';
