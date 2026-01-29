-- Migration: delinquency_enums
-- Phase 4 Plan 03: Delinquency management
-- Purpose: Create delinquency_action_type enum for automated escalation workflow

-- =====================================================
-- delinquency_action_type ENUM
-- =====================================================
-- Defines possible actions for delinquent accounts
-- Actions are triggered based on days overdue and balance thresholds

CREATE TYPE delinquency_action_type AS ENUM (
  'reminder_email',       -- Friendly payment reminder via email
  'reminder_sms',         -- Payment reminder via SMS
  'late_fee',             -- Apply late fee charge
  'interest_charge',      -- Apply interest on overdue amount
  'service_restriction',  -- Restrict amenity/common area access
  'payment_plan_offer',   -- Offer payment arrangement
  'legal_warning',        -- Formal legal notice
  'collection_referral',  -- Refer to collection agency
  'service_suspension'    -- Suspend services (severe cases only)
);

COMMENT ON TYPE delinquency_action_type IS
  'Types of actions that can be triggered for delinquent accounts.
   Typical escalation: 1 day (reminder), 15 days (late fee), 30 days (interest),
   60 days (restriction), 90 days (legal warning), 180 days (collection referral).
   service_suspension is a last resort per Mexican condominium law.';
