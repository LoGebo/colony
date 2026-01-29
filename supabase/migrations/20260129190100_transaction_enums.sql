-- ============================================
-- TRANSACTION ENUMS FOR FINANCIAL ENGINE
-- ============================================
-- Phase 4 Plan 01: Chart of Accounts & Double-Entry Ledger
--
-- Transaction types and statuses for the ledger system.
-- Status transitions: pending -> posted (immutable) or voided

-- ============================================
-- TRANSACTION TYPE ENUM
-- ============================================
-- Types of financial transactions in HOA accounting

CREATE TYPE transaction_type AS ENUM (
  'charge',       -- Fee charged to unit (creates receivable)
  'payment',      -- Payment received (reduces receivable)
  'adjustment',   -- Correction entry (can be positive or negative)
  'interest',     -- Interest/penalty applied (moratorios)
  'reversal',     -- Reverses a prior transaction
  'transfer'      -- Internal transfer between accounts
);

COMMENT ON TYPE transaction_type IS
  'Types of financial transactions in HOA/condominium accounting.
   charge: Creates receivable from unit
   payment: Reduces receivable, increases cash
   adjustment: Correction entry
   interest: Late payment penalty (moratorio)
   reversal: Cancels a prior transaction
   transfer: Moves funds between accounts';

-- ============================================
-- TRANSACTION STATUS ENUM
-- ============================================
-- State machine for transaction lifecycle

CREATE TYPE transaction_status AS ENUM (
  'pending',      -- Mutable while processing
  'posted',       -- Immutable, finalized in ledger
  'voided'        -- Cancelled (via reversal, not deletion)
);

COMMENT ON TYPE transaction_status IS
  'Transaction lifecycle states.
   pending: Can be modified, not yet final
   posted: Immutable, recorded in ledger (triggers validate balance=0)
   voided: Cancelled via reversal entry, cannot be modified';
