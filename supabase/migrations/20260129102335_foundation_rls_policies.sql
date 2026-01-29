-- ============================================
-- RLS POLICIES FOR ORGANIZATIONS
-- ============================================
-- Organizations are accessible to:
-- 1. Super admins (all orgs)
-- 2. Users whose community belongs to the org

-- Super admins can do everything
CREATE POLICY "super_admin_all_access_organizations"
  ON organizations
  FOR ALL
  TO authenticated
  USING (
    (SELECT is_super_admin())
  )
  WITH CHECK (
    (SELECT is_super_admin())
  );

-- Users can view their own organization
-- (organization_id is derived from their community's parent org)
CREATE POLICY "users_view_own_organization"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT c.organization_id
      FROM communities c
      WHERE c.id = (SELECT get_current_community_id())
        AND c.deleted_at IS NULL
    )
  );

-- Exclude deleted organizations from all queries
CREATE POLICY "exclude_deleted_organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
  );

-- ============================================
-- RLS POLICIES FOR COMMUNITIES
-- ============================================
-- Communities are accessible to:
-- 1. Super admins (all communities)
-- 2. Users assigned to that specific community (via JWT app_metadata)

-- Super admins can do everything
CREATE POLICY "super_admin_all_access_communities"
  ON communities
  FOR ALL
  TO authenticated
  USING (
    (SELECT is_super_admin())
  )
  WITH CHECK (
    (SELECT is_super_admin())
  );

-- CRITICAL POLICY: Users can only see their own community
-- This is the primary tenant isolation policy
CREATE POLICY "users_view_own_community"
  ON communities
  FOR SELECT
  TO authenticated
  USING (
    -- Use SELECT wrapper for performance (caches JWT extraction)
    id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Community admins can update their community settings
CREATE POLICY "admins_update_own_community"
  ON communities
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- SERVICE ROLE BYPASS NOTE
-- ============================================
-- The service_role key bypasses ALL RLS policies.
-- This is intentional for Edge Functions and admin operations.
-- NEVER expose service_role key to client code!

-- ============================================
-- HELPER FUNCTION FOR COMMUNITY MEMBERSHIP CHECK
-- ============================================
-- Optimized function for checking if user belongs to a community
-- Used in RLS policies across all tables

CREATE OR REPLACE FUNCTION user_has_community_access(target_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT public.is_super_admin())
    OR
    target_community_id = (SELECT public.get_current_community_id())
$$;

COMMENT ON FUNCTION user_has_community_access(UUID) IS
  'Returns true if current user can access the specified community.
   Super admins can access all communities.
   Regular users can only access their assigned community.';

-- ============================================
-- VERIFY RLS IS WORKING
-- ============================================
-- Test query (should fail without valid JWT)
-- SELECT * FROM communities; -- Would return empty set

COMMENT ON POLICY "users_view_own_community" ON communities IS
  'Primary tenant isolation policy. Users can only see their assigned community from JWT app_metadata.community_id.';
