-- ============================================
-- AUDIT COLUMN TRIGGER FUNCTION
-- ============================================
-- Automatically sets created_at on INSERT
-- Automatically sets updated_at on INSERT and UPDATE

CREATE OR REPLACE FUNCTION set_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- On INSERT: set both created_at and updated_at
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    -- created_by should be set by application, but default to auth.uid() if available
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;

  -- On UPDATE: only update updated_at (never change created_at/created_by)
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    -- Preserve original created_at and created_by
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_audit_fields() IS
  'Trigger function to auto-populate audit columns.
   Attach to tables with: CREATE TRIGGER set_audit BEFORE INSERT OR UPDATE ON tablename FOR EACH ROW EXECUTE FUNCTION set_audit_fields();';

-- ============================================
-- SOFT DELETE FUNCTION
-- ============================================
-- Sets deleted_at instead of actually deleting
-- Required for offline sync (clients need deletion records)

CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Instead of deleting, set deleted_at timestamp
  -- Using dynamic SQL with TG_TABLE_NAME for flexibility
  EXECUTE format(
    'UPDATE %I.%I SET deleted_at = now() WHERE ctid = $1',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME
  ) USING OLD.ctid;

  -- Return NULL to prevent the actual DELETE
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION soft_delete() IS
  'Trigger function for soft deletion. Attach with: CREATE TRIGGER soft_delete BEFORE DELETE ON tablename FOR EACH ROW EXECUTE FUNCTION soft_delete();';

-- Alternative: Generic soft delete function that works with dynamic table names
CREATE OR REPLACE FUNCTION perform_soft_delete(table_name TEXT, record_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    table_name
  ) USING record_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION perform_soft_delete(TEXT, UUID) IS
  'Soft deletes a record by setting deleted_at. Returns true if record was found and updated.
   Usage: SELECT perform_soft_delete(''residents'', ''uuid-here'');';

-- ============================================
-- RLS HELPER: GET CURRENT COMMUNITY ID
-- ============================================
-- Extracts community_id from JWT app_metadata
-- CRITICAL: Uses SELECT wrapper for 99%+ performance improvement

CREATE OR REPLACE FUNCTION get_current_community_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Extract community_id from app_metadata (NOT user_metadata!)
  -- user_metadata is user-editable, app_metadata is server-controlled only
  SELECT (
    (SELECT auth.jwt()) -> 'app_metadata' ->> 'community_id'
  )::UUID;
$$;

COMMENT ON FUNCTION get_current_community_id() IS
  'Returns the community_id from the current user''s JWT app_metadata.
   Used in RLS policies for tenant isolation.
   SECURITY: Uses app_metadata (server-controlled), NOT user_metadata (user-editable).';

-- ============================================
-- RLS HELPER: CHECK IF USER IS SUPER ADMIN
-- ============================================
-- Super admins can access all communities (platform level)

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'is_super_admin')::BOOLEAN,
    FALSE
  );
$$;

COMMENT ON FUNCTION is_super_admin() IS
  'Returns true if the current user is a platform super admin.
   Super admins bypass community isolation for administrative tasks.';

-- ============================================
-- RLS HELPER: GET USER ROLE
-- ============================================
-- Returns the user's role within their community

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    (SELECT auth.jwt()) -> 'app_metadata' ->> 'role'
  );
$$;

COMMENT ON FUNCTION get_current_user_role() IS
  'Returns the current user''s role (admin, guard, resident, etc.) from JWT.';
