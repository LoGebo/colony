-- =============================================================================
-- Fix RLS Identity Mismatch: resident_id != auth.uid()
-- =============================================================================
-- Problem: Many RLS policies compare resident_id (or seller_id, voted_by,
-- author_id, signed_by_resident_id) directly to auth.uid(). However, these
-- columns FK to residents.id (a business UUID), NOT to auth.users.id.
-- The link is: residents.user_id -> auth.users.id.
--
-- Fix: Replace auth.uid() comparisons with a subquery that resolves the
-- current user's resident_id:
--   (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
-- =============================================================================

-- Helper: define the subquery as a variable-like expression for readability.
-- We'll use it inline in each policy.

-- =============================================================================
-- 1. post_reactions: users_manage_own_reactions
-- =============================================================================
DROP POLICY IF EXISTS users_manage_own_reactions ON post_reactions;
CREATE POLICY users_manage_own_reactions ON post_reactions
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

-- =============================================================================
-- 2. vehicles: users_manage_own_vehicles
-- =============================================================================
DROP POLICY IF EXISTS users_manage_own_vehicles ON vehicles;
CREATE POLICY users_manage_own_vehicles ON vehicles
  FOR ALL
  TO authenticated
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND deleted_at IS NULL
  )
  WITH CHECK (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

-- =============================================================================
-- 3. emergency_contacts: 4 policies (select, insert, update, delete)
-- =============================================================================
DROP POLICY IF EXISTS emergency_contacts_select_own ON emergency_contacts;
CREATE POLICY emergency_contacts_select_own ON emergency_contacts
  FOR SELECT
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS emergency_contacts_insert_own ON emergency_contacts;
CREATE POLICY emergency_contacts_insert_own ON emergency_contacts
  FOR INSERT
  WITH CHECK (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND community_id = (SELECT get_current_community_id())
  );

DROP POLICY IF EXISTS emergency_contacts_update_own ON emergency_contacts;
CREATE POLICY emergency_contacts_update_own ON emergency_contacts
  FOR UPDATE
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND deleted_at IS NULL
  )
  WITH CHECK (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

DROP POLICY IF EXISTS emergency_contacts_delete_own ON emergency_contacts;
CREATE POLICY emergency_contacts_delete_own ON emergency_contacts
  FOR DELETE
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND deleted_at IS NULL
  );

-- =============================================================================
-- 4. marketplace_listings: sellers_view_own_listings, sellers_update_own_listings,
--    sellers_delete_own_listings, users_create_listings
-- =============================================================================
DROP POLICY IF EXISTS sellers_view_own_listings ON marketplace_listings;
CREATE POLICY sellers_view_own_listings ON marketplace_listings
  FOR SELECT
  USING (
    seller_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS sellers_update_own_listings ON marketplace_listings;
CREATE POLICY sellers_update_own_listings ON marketplace_listings
  FOR UPDATE
  USING (
    seller_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND moderation_status IN ('pending', 'approved', 'flagged')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    seller_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

DROP POLICY IF EXISTS sellers_delete_own_listings ON marketplace_listings;
CREATE POLICY sellers_delete_own_listings ON marketplace_listings
  FOR DELETE
  USING (
    seller_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS users_create_listings ON marketplace_listings;
CREATE POLICY users_create_listings ON marketplace_listings
  FOR INSERT
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND seller_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND moderation_status = 'pending'
  );

-- =============================================================================
-- 5. reservations: users_view_own_reservations, residents_cancel_own_reservations
-- =============================================================================
DROP POLICY IF EXISTS users_view_own_reservations ON reservations;
CREATE POLICY users_view_own_reservations ON reservations
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

DROP POLICY IF EXISTS residents_cancel_own_reservations ON reservations;
CREATE POLICY residents_cancel_own_reservations ON reservations
  FOR UPDATE
  TO authenticated
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    AND status = 'confirmed'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- =============================================================================
-- 6. regulation_signatures: residents_view_own_signatures
-- =============================================================================
DROP POLICY IF EXISTS residents_view_own_signatures ON regulation_signatures;
CREATE POLICY residents_view_own_signatures ON regulation_signatures
  FOR SELECT
  TO authenticated
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

-- =============================================================================
-- 7. packages: residents_view_unit_packages
-- =============================================================================
DROP POLICY IF EXISTS residents_view_unit_packages ON packages;
CREATE POLICY residents_view_unit_packages ON packages
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND recipient_unit_id IN (
      SELECT unit_id FROM occupancies
      WHERE resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
        AND deleted_at IS NULL
    )
  );

-- =============================================================================
-- 8. package_pickup_codes: residents_view_own_pickup_codes
-- =============================================================================
DROP POLICY IF EXISTS residents_view_own_pickup_codes ON package_pickup_codes;
CREATE POLICY residents_view_own_pickup_codes ON package_pickup_codes
  FOR SELECT
  TO authenticated
  USING (
    package_id IN (
      SELECT id FROM packages
      WHERE recipient_unit_id IN (
        SELECT unit_id FROM occupancies
        WHERE resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
          AND deleted_at IS NULL
      )
      AND deleted_at IS NULL
    )
  );

-- =============================================================================
-- 9. reservation_waitlist: users_view_own_waitlist, residents_manage_own_waitlist
-- =============================================================================
DROP POLICY IF EXISTS users_view_own_waitlist ON reservation_waitlist;
CREATE POLICY users_view_own_waitlist ON reservation_waitlist
  FOR SELECT
  TO authenticated
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

DROP POLICY IF EXISTS residents_manage_own_waitlist ON reservation_waitlist;
CREATE POLICY residents_manage_own_waitlist ON reservation_waitlist
  FOR ALL
  TO authenticated
  USING (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  )
  WITH CHECK (
    resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

-- =============================================================================
-- 10. ballots: voters_insert_own_ballot, voters_see_own_ballots
-- =============================================================================
DROP POLICY IF EXISTS voters_insert_own_ballot ON ballots;
CREATE POLICY voters_insert_own_ballot ON ballots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    voted_by = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

DROP POLICY IF EXISTS voters_see_own_ballots ON ballots;
CREATE POLICY voters_see_own_ballots ON ballots
  FOR SELECT
  TO authenticated
  USING (
    voted_by = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

-- =============================================================================
-- 11. posts: authors_manage_own_posts (broken subquery: WHERE id = auth.uid())
-- =============================================================================
DROP POLICY IF EXISTS authors_manage_own_posts ON posts;
CREATE POLICY authors_manage_own_posts ON posts
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND author_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND author_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

-- =============================================================================
-- 12. post_comments: authors_manage_comments (broken subquery: WHERE id = auth.uid())
-- =============================================================================
DROP POLICY IF EXISTS authors_manage_comments ON post_comments;
CREATE POLICY authors_manage_comments ON post_comments
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND author_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND author_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
  );

-- =============================================================================
-- 13. package_signatures: residents_view_own_package_signatures
--     (also uses signed_by_resident_id = auth.uid() and nested resident_id = auth.uid())
-- =============================================================================
DROP POLICY IF EXISTS residents_view_own_package_signatures ON package_signatures;
CREATE POLICY residents_view_own_package_signatures ON package_signatures
  FOR SELECT
  TO authenticated
  USING (
    signed_by_resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
    OR package_id IN (
      SELECT id FROM packages
      WHERE recipient_unit_id IN (
        SELECT unit_id FROM occupancies
        WHERE resident_id = (SELECT r.id FROM public.residents r WHERE r.user_id = auth.uid() AND r.deleted_at IS NULL LIMIT 1)
          AND deleted_at IS NULL
      )
      AND deleted_at IS NULL
    )
  );

-- =============================================================================
-- Done. All 20 policies fixed across 12 tables.
-- =============================================================================
