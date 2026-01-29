-- ============================================
-- ACCOUNT ENUMS FOR FINANCIAL ENGINE
-- ============================================
-- Phase 4 Plan 01: Chart of Accounts & Double-Entry Ledger
--
-- HOA Standard Chart of Accounts:
-- 1000-1999: Assets (what we own)
-- 2000-2999: Liabilities (what we owe)
-- 3000-3999: Equity (net worth)
-- 4000-4999: Income (revenue)
-- 5000-5999: Expenses (costs)
-- 7000-7999: Reserve Expenses (Mexican law requires separation)

-- ============================================
-- ACCOUNT CATEGORY ENUM
-- ============================================
-- The 5 fundamental account categories in double-entry bookkeeping

CREATE TYPE account_category AS ENUM (
  'asset',      -- 1000-1999: Bank accounts, receivables, property
  'liability',  -- 2000-2999: Payables, deposits held, loans
  'equity',     -- 3000-3999: Retained earnings, reserve fund
  'income',     -- 4000-4999: Maintenance fees, assessments, late fees
  'expense'     -- 5000-5999: Utilities, maintenance, admin, insurance
);

COMMENT ON TYPE account_category IS
  'The 5 fundamental account categories in double-entry bookkeeping.
   Assets/Expenses have normal debit balance.
   Liabilities/Equity/Income have normal credit balance.';

-- ============================================
-- ACCOUNT SUBTYPE ENUM
-- ============================================
-- More specific classification within each category

CREATE TYPE account_subtype AS ENUM (
  -- Assets (1000s)
  'cash',                   -- Bank accounts, petty cash (1010-1030)
  'accounts_receivable',    -- Money owed by residents (1100-1120)
  'prepaid',                -- Prepaid expenses (1200s)
  'fixed_asset',            -- Property, equipment (1300s)

  -- Liabilities (2000s)
  'accounts_payable',       -- Money we owe vendors (2010)
  'security_deposits',      -- Resident deposits held (2020)
  'loans',                  -- Mortgages, credit lines (2100s)
  'deferred_income',        -- Prepaid fees from residents (2030)

  -- Equity (3000s)
  'retained_earnings',      -- Accumulated surplus (3010)
  'reserves',               -- Reserve fund (critical for HOAs) (3100)

  -- Income (4000s)
  'maintenance_fees',       -- Regular cuotas (4010)
  'special_assessments',    -- One-time charges (4020)
  'late_fees',              -- Moratorios, penalties (4030)
  'other_income',           -- Interest earned, amenity fees (4040-4050)

  -- Expenses (5000s-7000s)
  'utilities',              -- Water, electricity, gas (5010-5020)
  'maintenance',            -- Repairs, upkeep, landscaping (5030-5040)
  'administrative',         -- Management, legal, accounting (5050-5080)
  'insurance',              -- Property insurance (5070)
  'taxes',                  -- Property taxes (5090)
  'reserve_contribution'    -- Transfer to reserves (7010-7020)
);

COMMENT ON TYPE account_subtype IS
  'Detailed account classification within categories.
   Grouped by category for chart of accounts organization.
   Standard HOA/property management numbering (1000s-7000s).';
