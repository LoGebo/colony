-- ============================================
-- DOCUMENT PERMISSIONS TABLE
-- ============================================
-- Granular access control for documents
-- Phase 6: Documents & Notifications

-- ============================================
-- DOCUMENT PERMISSIONS TABLE
-- ============================================
-- Grant access to documents by user, unit, or role

CREATE TABLE document_permissions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Grant target (exactly one must be set)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  role user_role,

  -- Permission levels
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_download BOOLEAN NOT NULL DEFAULT TRUE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,  -- Upload new versions

  -- Grant metadata
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,

  -- Exactly one of user_id, unit_id, role must be set
  CONSTRAINT document_permissions_check_target CHECK (
    (user_id IS NOT NULL AND unit_id IS NULL AND role IS NULL) OR
    (user_id IS NULL AND unit_id IS NOT NULL AND role IS NULL) OR
    (user_id IS NULL AND unit_id IS NULL AND role IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;

-- Unique constraints for each permission type
CREATE UNIQUE INDEX idx_document_permissions_unique_user
  ON document_permissions(document_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX idx_document_permissions_unique_unit
  ON document_permissions(document_id, unit_id) WHERE unit_id IS NOT NULL;

CREATE UNIQUE INDEX idx_document_permissions_unique_role
  ON document_permissions(document_id, role) WHERE role IS NOT NULL;

-- Additional indexes for permission lookups
CREATE INDEX idx_document_permissions_document ON document_permissions(document_id);
CREATE INDEX idx_document_permissions_user ON document_permissions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_document_permissions_unit ON document_permissions(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_document_permissions_role ON document_permissions(role) WHERE role IS NOT NULL;

-- ============================================
-- FUNCTION: CHECK DOCUMENT ACCESS
-- ============================================
-- Evaluates if user has specified permission on document

CREATE OR REPLACE FUNCTION check_document_access(
  p_document_id UUID,
  p_user_id UUID,
  p_permission TEXT DEFAULT 'view'  -- view, download, edit
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_doc RECORD;
  v_user_role user_role;
  v_user_unit_ids UUID[];
  v_permission_exists BOOLEAN := FALSE;
BEGIN
  -- Get document details
  SELECT * INTO v_doc
  FROM documents
  WHERE id = p_document_id
    AND deleted_at IS NULL
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Get user role
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role')::user_role,
    'visitor'
  ) INTO v_user_role;

  -- Super admin always has access
  IF v_user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- 1. Check if document is public (for view permission only)
  IF v_doc.is_public = TRUE AND p_permission = 'view' THEN
    RETURN TRUE;
  END IF;

  -- 2. Check if user role meets required_role
  IF v_doc.required_role IS NOT NULL AND p_permission IN ('view', 'download') THEN
    -- Check role hierarchy
    IF (
      CASE v_user_role
        WHEN 'admin' THEN v_doc.required_role IN ('admin', 'manager', 'guard', 'resident', 'provider', 'visitor')
        WHEN 'manager' THEN v_doc.required_role IN ('manager', 'guard', 'resident', 'provider', 'visitor')
        WHEN 'guard' THEN v_doc.required_role IN ('guard', 'resident', 'provider', 'visitor')
        WHEN 'resident' THEN v_doc.required_role IN ('resident', 'provider', 'visitor')
        WHEN 'provider' THEN v_doc.required_role IN ('provider', 'visitor')
        WHEN 'visitor' THEN v_doc.required_role = 'visitor'
        ELSE FALSE
      END
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Get users unit IDs for unit-based permission check
  SELECT ARRAY_AGG(DISTINCT o.unit_id) INTO v_user_unit_ids
  FROM occupancies o
  WHERE o.resident_id = p_user_id
    AND o.deleted_at IS NULL;

  -- 3. Check document_permissions table
  SELECT EXISTS (
    SELECT 1 FROM document_permissions dp
    WHERE dp.document_id = p_document_id
      AND (dp.expires_at IS NULL OR dp.expires_at > now())
      AND (
        -- User-specific permission
        (dp.user_id = p_user_id)
        -- Unit-based permission
        OR (dp.unit_id = ANY(COALESCE(v_user_unit_ids, ARRAY[]::UUID[])))
        -- Role-based permission
        OR (dp.role = v_user_role)
      )
      AND (
        -- Check specific permission level
        (p_permission = 'view' AND dp.can_view = TRUE) OR
        (p_permission = 'download' AND dp.can_download = TRUE) OR
        (p_permission = 'edit' AND dp.can_edit = TRUE)
      )
  ) INTO v_permission_exists;

  RETURN v_permission_exists;
END;
$$;

COMMENT ON FUNCTION check_document_access IS
  'Evaluates document access based on is_public, required_role, and document_permissions.
   Permission types: view, download, edit.';

-- ============================================
-- FUNCTION: GET ACCESSIBLE DOCUMENTS
-- ============================================
-- Returns all documents a user can access

CREATE OR REPLACE FUNCTION get_accessible_documents(p_user_id UUID)
RETURNS TABLE (
  document_id UUID,
  name TEXT,
  category document_category,
  description TEXT,
  is_public BOOLEAN,
  requires_signature BOOLEAN,
  current_version_id UUID,
  access_source TEXT  -- public, role, user_permission, unit_permission, role_permission
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_role user_role;
  v_user_community_id UUID;
  v_user_unit_ids UUID[];
BEGIN
  -- Get user role and community
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role')::user_role,
    'visitor'
  ) INTO v_user_role;

  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID,
    NULL
  ) INTO v_user_community_id;

  -- Get users unit IDs
  SELECT ARRAY_AGG(DISTINCT o.unit_id) INTO v_user_unit_ids
  FROM occupancies o
  WHERE o.resident_id = p_user_id
    AND o.deleted_at IS NULL;

  RETURN QUERY
  SELECT DISTINCT ON (d.id)
    d.id,
    d.name,
    d.category,
    d.description,
    d.is_public,
    d.requires_signature,
    d.current_version_id,
    CASE
      WHEN v_user_role = 'super_admin' THEN 'super_admin'
      WHEN d.is_public = TRUE THEN 'public'
      WHEN d.required_role IS NOT NULL THEN 'role'
      WHEN dp.user_id = p_user_id THEN 'user_permission'
      WHEN dp.unit_id = ANY(COALESCE(v_user_unit_ids, ARRAY[]::UUID[])) THEN 'unit_permission'
      WHEN dp.role = v_user_role THEN 'role_permission'
      ELSE 'unknown'
    END AS access_source
  FROM documents d
  LEFT JOIN document_permissions dp ON dp.document_id = d.id
    AND (dp.expires_at IS NULL OR dp.expires_at > now())
    AND dp.can_view = TRUE
    AND (
      dp.user_id = p_user_id
      OR dp.unit_id = ANY(COALESCE(v_user_unit_ids, ARRAY[]::UUID[]))
      OR dp.role = v_user_role
    )
  WHERE d.deleted_at IS NULL
    AND d.status = 'active'
    AND d.community_id = v_user_community_id
    AND (
      -- Super admin sees all
      v_user_role = 'super_admin'
      -- Public documents
      OR d.is_public = TRUE
      -- Role-based access
      OR (d.required_role IS NOT NULL AND (
        CASE v_user_role
          WHEN 'admin' THEN d.required_role IN ('admin', 'manager', 'guard', 'resident', 'provider', 'visitor')
          WHEN 'manager' THEN d.required_role IN ('manager', 'guard', 'resident', 'provider', 'visitor')
          WHEN 'guard' THEN d.required_role IN ('guard', 'resident', 'provider', 'visitor')
          WHEN 'resident' THEN d.required_role IN ('resident', 'provider', 'visitor')
          WHEN 'provider' THEN d.required_role IN ('provider', 'visitor')
          WHEN 'visitor' THEN d.required_role = 'visitor'
          ELSE FALSE
        END
      ))
      -- Explicit permission
      OR dp.id IS NOT NULL
    )
  ORDER BY d.id, d.name;
END;
$$;

COMMENT ON FUNCTION get_accessible_documents IS
  'Returns all documents a user can access based on public status, role requirements, and explicit permissions.';

-- ============================================
-- RLS POLICIES FOR DOCUMENT PERMISSIONS
-- ============================================

-- Super admins full access
CREATE POLICY "super_admins_full_access_document_permissions"
  ON document_permissions
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Admins can manage permissions on their community documents
CREATE POLICY "admins_manage_document_permissions"
  ON document_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_permissions.document_id
      AND d.community_id = (SELECT get_current_community_id())
      AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_permissions.document_id
      AND d.community_id = (SELECT get_current_community_id())
      AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- Users can view permissions on documents they can access
CREATE POLICY "users_view_document_permissions"
  ON document_permissions
  FOR SELECT
  TO authenticated
  USING (
    check_document_access(document_id, auth.uid(), 'view')
  );

-- ============================================
-- UPDATE DOCUMENTS RLS TO USE check_document_access
-- ============================================
-- Drop existing policies that will be replaced
DROP POLICY IF EXISTS "users_view_public_documents" ON documents;
DROP POLICY IF EXISTS "users_view_role_documents" ON documents;

-- New unified policy using check_document_access function
CREATE POLICY "users_view_documents_via_permission"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND check_document_access(id, auth.uid(), 'view')
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE document_permissions IS
  'Granular document access control by user, unit, or role.
   Exactly one of user_id, unit_id, or role must be set.
   Permissions are additive - any matching permission grants access.';

COMMENT ON COLUMN document_permissions.can_edit IS
  'Allows uploading new versions of the document.';

COMMENT ON COLUMN document_permissions.expires_at IS
  'Optional expiration for temporary access grants.';
