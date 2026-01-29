-- Migration: interest_enums
-- Phase 4 Plan 03: Interest rules and delinquency management
-- Purpose: Create interest_calculation_method enum for configurable late payment interest

-- =====================================================
-- interest_calculation_method ENUM
-- =====================================================
-- Defines how late payment interest (moratorios) is calculated
-- Mexico has no federal limit on condominium moratorium rates
-- Rates must be approved by the General Assembly

CREATE TYPE interest_calculation_method AS ENUM (
  'simple',           -- principal * rate * time (most common for HOAs)
  'compound_monthly', -- Monthly compounding
  'compound_daily',   -- Daily compounding
  'flat_fee'          -- Fixed fee per period (e.g., 100 MXN per month late)
);

COMMENT ON TYPE interest_calculation_method IS
  'Interest calculation methods for late payments (moratorios).
   simple: principal * rate * (days / period_days)
   compound_monthly: principal * (POWER(1 + rate, days/30) - 1)
   compound_daily: principal * (POWER(1 + rate/365, days) - 1)
   flat_fee: fixed amount regardless of principal';
