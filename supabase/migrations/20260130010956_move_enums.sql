-- Migration: Move coordination enums
-- Phase: 07-operations-compliance
-- Plan: 03 (Move Coordination)
-- Description: Enum types for move requests, validations, and deposits

-- Move direction
CREATE TYPE move_type AS ENUM (
  'move_in',
  'move_out'
);

COMMENT ON TYPE move_type IS 'Direction of move: in (new resident) or out (departing)';

-- Move request status workflow
CREATE TYPE move_status AS ENUM (
  'requested',         -- Initial request submitted
  'validating',        -- Pre-move validations in progress
  'validation_failed', -- One or more validations failed
  'approved',          -- All validations passed
  'scheduled',         -- Date/time confirmed
  'in_progress',       -- Move happening now
  'completed',         -- Move finished
  'cancelled'          -- Cancelled by resident or admin
);

COMMENT ON TYPE move_status IS 'Move request workflow: requested -> validating -> approved -> scheduled -> in_progress -> completed';

-- Validation item status
CREATE TYPE validation_status AS ENUM (
  'pending',   -- Not yet checked
  'passed',    -- Validation succeeded
  'failed',    -- Validation failed
  'waived'     -- Admin override
);

COMMENT ON TYPE validation_status IS 'Status of individual pre-move validation item';

-- Damage deposit workflow status
CREATE TYPE deposit_status AS ENUM (
  'collected',           -- Payment received
  'held',                -- During residency
  'inspection_pending',  -- Move-out inspection needed
  'deductions_pending',  -- Calculating damages
  'refund_pending',      -- Approved for refund
  'refunded',            -- Refund processed
  'forfeited'            -- Deposit kept due to damages/violations
);

COMMENT ON TYPE deposit_status IS 'Damage deposit lifecycle: collected -> held -> inspection_pending -> deductions_pending -> refund_pending -> refunded';
