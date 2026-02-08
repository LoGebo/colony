-- ============================================
-- FIX ADMIN RLS ROLE MISMATCH
-- ============================================
-- Phase 11 Plan 01: Fix RLS policies that check for 'admin' role
-- to also accept 'community_admin' (the actual JWT role value).
--
-- The handle_new_user trigger and complete_admin_onboarding function
-- set app_metadata.role = 'community_admin', but these RLS policies
-- only checked for 'admin'. This migration fixes all 10 affected policies.

-- ============================================
-- 1. payment_proofs: admins_view_community_payment_proofs
-- ============================================
DROP POLICY IF EXISTS "admins_view_community_payment_proofs" ON payment_proofs;
CREATE POLICY "admins_view_community_payment_proofs" ON payment_proofs
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 2. payment_proofs: admins_update_payment_proofs
-- ============================================
DROP POLICY IF EXISTS "admins_update_payment_proofs" ON payment_proofs;
CREATE POLICY "admins_update_payment_proofs" ON payment_proofs
  FOR UPDATE
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 3. transactions: admins_manage_transactions
-- ============================================
DROP POLICY IF EXISTS "admins_manage_transactions" ON transactions;
CREATE POLICY "admins_manage_transactions" ON transactions
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 4. residents: admins_manage_residents
-- ============================================
DROP POLICY IF EXISTS "admins_manage_residents" ON residents;
CREATE POLICY "admins_manage_residents" ON residents
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 5. units: admins_manage_units
-- ============================================
DROP POLICY IF EXISTS "admins_manage_units" ON units;
CREATE POLICY "admins_manage_units" ON units
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 6. occupancies: admins_manage_occupancies
-- ============================================
DROP POLICY IF EXISTS "admins_manage_occupancies" ON occupancies;
CREATE POLICY "admins_manage_occupancies" ON occupancies
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 7. fee_structures: admins_manage_fee_structures
-- ============================================
DROP POLICY IF EXISTS "admins_manage_fee_structures" ON fee_structures;
CREATE POLICY "admins_manage_fee_structures" ON fee_structures
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 8. budgets: admins_manage_budgets
-- ============================================
DROP POLICY IF EXISTS admins_manage_budgets ON budgets;
CREATE POLICY admins_manage_budgets ON budgets
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 9. budget_lines: admins_manage_budget_lines
-- ============================================
DROP POLICY IF EXISTS admins_manage_budget_lines ON budget_lines;
CREATE POLICY admins_manage_budget_lines ON budget_lines
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- 10. communities: admins_update_own_community
-- ============================================
DROP POLICY IF EXISTS "admins_update_own_community" ON communities;
CREATE POLICY "admins_update_own_community" ON communities
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  )
  WITH CHECK (
    id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );

-- ============================================
-- VERIFICATION
-- ============================================
-- After applying, verify with:
-- SELECT COUNT(*) FROM pg_policies
-- WHERE policyname LIKE 'admins_%'
-- AND qual::text LIKE '%community_admin%';
-- Expected: >= 10
