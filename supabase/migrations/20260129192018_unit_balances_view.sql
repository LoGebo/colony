-- ============================================
-- UNIT BALANCES VIEW AND HELPER FUNCTIONS
-- ============================================
-- Phase 4 Plan 04: Bank Reconciliation
--
-- Aggregates financial position per unit for:
-- - Dashboard display
-- - Statement generation
-- - Delinquency processing
--
-- This view calculates receivable balance by aggregating ledger entries
-- on the Accounts Receivable account (1100) for each unit.

-- ============================================
-- UNIT BALANCES VIEW
-- ============================================

CREATE OR REPLACE VIEW unit_balances AS
WITH unit_transactions AS (
  -- All posted transactions for each unit
  SELECT
    t.unit_id,
    t.community_id,
    t.transaction_type,
    t.amount,
    t.effective_date,
    t.id AS transaction_id
  FROM transactions t
  WHERE t.unit_id IS NOT NULL
    AND t.status = 'posted'
    AND t.deleted_at IS NULL
),
unit_receivable_balance AS (
  -- Current receivable balance per unit from ledger entries
  -- Positive balance = unit owes money (debit balance on receivable)
  SELECT
    t.unit_id,
    t.community_id,
    SUM(le.amount) AS total_receivable
  FROM ledger_entries le
  JOIN transactions t ON t.id = le.transaction_id
  JOIN accounts a ON a.id = le.account_id
  WHERE t.unit_id IS NOT NULL
    AND t.status = 'posted'
    AND t.deleted_at IS NULL
    AND a.subtype = 'accounts_receivable'
    AND a.deleted_at IS NULL
  GROUP BY t.unit_id, t.community_id
),
transaction_totals AS (
  -- Aggregate totals by type
  SELECT
    ut.unit_id,
    ut.community_id,
    SUM(CASE WHEN ut.transaction_type = 'charge' THEN ut.amount ELSE 0 END) AS total_charges,
    SUM(CASE WHEN ut.transaction_type = 'payment' THEN ut.amount ELSE 0 END) AS total_payments,
    SUM(CASE WHEN ut.transaction_type = 'interest' THEN ut.amount ELSE 0 END) AS total_interest,
    MAX(CASE WHEN ut.transaction_type = 'payment' THEN ut.effective_date END) AS last_payment_date,
    MAX(CASE WHEN ut.transaction_type = 'charge' THEN ut.effective_date END) AS last_charge_date
  FROM unit_transactions ut
  GROUP BY ut.unit_id, ut.community_id
),
oldest_unpaid AS (
  -- Find oldest unpaid charge (approximation: oldest charge for units with balance > 0)
  -- This is a simplification - for precise tracking, would need line-item matching
  SELECT
    t.unit_id,
    MIN(t.effective_date) AS oldest_unpaid_date
  FROM transactions t
  WHERE t.unit_id IS NOT NULL
    AND t.status = 'posted'
    AND t.deleted_at IS NULL
    AND t.transaction_type = 'charge'
  GROUP BY t.unit_id
)
SELECT
  u.id AS unit_id,
  u.community_id,
  u.unit_number,
  u.floor_number,
  u.building,
  u.coefficient,
  COALESCE(urb.total_receivable, 0) AS total_receivable,
  COALESCE(tt.total_charges, 0) AS total_charges,
  COALESCE(tt.total_payments, 0) AS total_payments,
  COALESCE(tt.total_interest, 0) AS total_interest,
  tt.last_payment_date,
  tt.last_charge_date,
  CASE
    WHEN COALESCE(urb.total_receivable, 0) > 0 THEN ou.oldest_unpaid_date
    ELSE NULL
  END AS oldest_unpaid_date,
  CASE
    WHEN COALESCE(urb.total_receivable, 0) > 0 AND ou.oldest_unpaid_date IS NOT NULL
    THEN GREATEST(0, CURRENT_DATE - ou.oldest_unpaid_date)
    ELSE 0
  END AS days_overdue
FROM units u
LEFT JOIN unit_receivable_balance urb ON urb.unit_id = u.id
LEFT JOIN transaction_totals tt ON tt.unit_id = u.id
LEFT JOIN oldest_unpaid ou ON ou.unit_id = u.id
WHERE u.deleted_at IS NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON VIEW unit_balances IS
  'Aggregated financial position per unit.
   total_receivable: Current balance owed (positive = owes money).
   Calculated from ledger entries on Accounts Receivable accounts.
   days_overdue: Days since oldest unpaid charge (when balance > 0).
   Used for: dashboards, statements, delinquency processing.';

-- ============================================
-- GET_UNIT_BALANCE FUNCTION
-- ============================================
-- More efficient than querying view for single unit lookups

CREATE OR REPLACE FUNCTION get_unit_balance(p_unit_id UUID)
RETURNS TABLE (
  current_balance NUMERIC(15, 4),
  days_overdue INTEGER,
  last_payment_date DATE,
  last_charge_date DATE,
  total_charges NUMERIC(15, 4),
  total_payments NUMERIC(15, 4)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ub.total_receivable AS current_balance,
    ub.days_overdue::INTEGER,
    ub.last_payment_date,
    ub.last_charge_date,
    ub.total_charges,
    ub.total_payments
  FROM public.unit_balances ub
  WHERE ub.unit_id = p_unit_id;

  -- Return zeros if unit not found or no transactions
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      0::NUMERIC(15,4) AS current_balance,
      0 AS days_overdue,
      NULL::DATE AS last_payment_date,
      NULL::DATE AS last_charge_date,
      0::NUMERIC(15,4) AS total_charges,
      0::NUMERIC(15,4) AS total_payments;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_unit_balance IS
  'Returns current financial position for a single unit.
   More efficient than querying unit_balances view directly.
   Returns zeros if unit has no transactions.';

-- ============================================
-- GET_DELINQUENT_UNITS FUNCTION
-- ============================================
-- Returns units with overdue balances for batch processing

CREATE OR REPLACE FUNCTION get_delinquent_units(
  p_community_id UUID,
  p_min_days INTEGER DEFAULT 1,
  p_min_amount NUMERIC(15, 4) DEFAULT 0
)
RETURNS TABLE (
  unit_id UUID,
  unit_number TEXT,
  building TEXT,
  total_receivable NUMERIC(15, 4),
  days_overdue INTEGER,
  oldest_unpaid_date DATE,
  last_payment_date DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ub.unit_id,
    ub.unit_number,
    ub.building,
    ub.total_receivable,
    ub.days_overdue::INTEGER,
    ub.oldest_unpaid_date,
    ub.last_payment_date
  FROM public.unit_balances ub
  WHERE ub.community_id = p_community_id
    AND ub.total_receivable > p_min_amount
    AND ub.days_overdue >= p_min_days
  ORDER BY ub.days_overdue DESC, ub.total_receivable DESC;
END;
$$;

COMMENT ON FUNCTION get_delinquent_units IS
  'Returns units with overdue balances exceeding thresholds.
   Used for delinquency notification and action processing.

   Parameters:
   - p_community_id: Community to query
   - p_min_days: Minimum days overdue (default 1)
   - p_min_amount: Minimum balance owed (default 0)

   Returns units ordered by days overdue (desc), then balance (desc).';

-- ============================================
-- GET_COMMUNITY_RECEIVABLE_SUMMARY FUNCTION
-- ============================================
-- Aggregate receivable summary for community dashboard

CREATE OR REPLACE FUNCTION get_community_receivable_summary(p_community_id UUID)
RETURNS TABLE (
  total_receivable NUMERIC(15, 4),
  units_with_balance INTEGER,
  units_delinquent_30 INTEGER,
  units_delinquent_60 INTEGER,
  units_delinquent_90 INTEGER,
  average_days_overdue NUMERIC(5, 1)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ub.total_receivable), 0) AS total_receivable,
    COUNT(CASE WHEN ub.total_receivable > 0 THEN 1 END)::INTEGER AS units_with_balance,
    COUNT(CASE WHEN ub.days_overdue >= 30 THEN 1 END)::INTEGER AS units_delinquent_30,
    COUNT(CASE WHEN ub.days_overdue >= 60 THEN 1 END)::INTEGER AS units_delinquent_60,
    COUNT(CASE WHEN ub.days_overdue >= 90 THEN 1 END)::INTEGER AS units_delinquent_90,
    COALESCE(
      AVG(CASE WHEN ub.total_receivable > 0 THEN ub.days_overdue END),
      0
    )::NUMERIC(5, 1) AS average_days_overdue
  FROM public.unit_balances ub
  WHERE ub.community_id = p_community_id;
END;
$$;

COMMENT ON FUNCTION get_community_receivable_summary IS
  'Returns aggregate receivable metrics for a community.
   Used for financial dashboard and management reporting.

   Returns:
   - total_receivable: Sum of all outstanding balances
   - units_with_balance: Count of units owing money
   - units_delinquent_30/60/90: Count of units at each threshold
   - average_days_overdue: Average days overdue for units with balance';
