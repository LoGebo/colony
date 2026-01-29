-- ============================================
-- FEE CALCULATION TYPE AND FREQUENCY ENUMS
-- ============================================
-- Phase 4 Plan 02: Fee Structures & Charges
--
-- fee_calculation_type: How fees are calculated for units
-- fee_frequency: How often fees are billed

-- Fee calculation types for Mexican HOA patterns
CREATE TYPE fee_calculation_type AS ENUM (
  'fixed',        -- Same amount for all units
  'coefficient',  -- Proportional to unit coefficient (indiviso)
  'hybrid',       -- Fixed base + coefficient portion
  'tiered',       -- Based on unit type or size tiers
  'custom'        -- Formula stored in JSONB
);

COMMENT ON TYPE fee_calculation_type IS
  'How fee amounts are calculated for each unit.
   fixed = same amount for all units
   coefficient = proportional to Mexican indiviso (unit.coefficient / 100)
   hybrid = fixed base_amount + coefficient_amount * (coefficient / 100)
   tiered = based on unit_type or size (use base_amount per tier)
   custom = formula in custom_formula JSONB column';

-- Fee billing frequencies
CREATE TYPE fee_frequency AS ENUM (
  'monthly',      -- Every month
  'bimonthly',    -- Every 2 months
  'quarterly',    -- Every 3 months
  'semiannual',   -- Every 6 months
  'annual',       -- Once per year
  'one_time'      -- Single charge (e.g., special assessment)
);

COMMENT ON TYPE fee_frequency IS
  'Billing frequency for recurring fees.
   one_time is for special assessments and one-off charges.';
