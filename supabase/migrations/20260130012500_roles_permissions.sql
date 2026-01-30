-- Migration: Roles and Permissions with RBAC Functions
-- Phase: 07-operations-compliance
-- Plan: 05
-- Purpose: Configurable RBAC system with roles, permissions, and has_permission() function
-- Patterns: Hybrid RBAC (Pattern 9 from 07-RESEARCH.md) - JWT for common checks, database for fine-grained

-- Ensure pgcrypto is available for UUID generation (required by generate_uuid_v7)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Fix generate_uuid_v7 to use extensions.gen_random_bytes
CREATE OR REPLACE FUNCTION generate_uuid_v7()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
PARALLEL SAFE
AS $$
DECLARE
  v_time BIGINT;
  v_random BYTEA;
  v_uuid_bytes BYTEA;
BEGIN
  -- Get current timestamp in milliseconds since Unix epoch
  v_time := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;

  -- Get 10 random bytes for the remaining portion (use extensions schema)
  v_random := extensions.gen_random_bytes(10);

  -- Build UUID v7 structure:
  v_uuid_bytes :=
    set_byte(set_byte(set_byte(set_byte(set_byte(set_byte(
      E'\\x000000000000'::BYTEA,
      0, ((v_time >> 40) & 255)::INT),
      1, ((v_time >> 32) & 255)::INT),
      2, ((v_time >> 24) & 255)::INT),
      3, ((v_time >> 16) & 255)::INT),
      4, ((v_time >> 8) & 255)::INT),
      5, (v_time & 255)::INT)
    ||
    set_byte(E'\\x00'::BYTEA, 0, (112 | (get_byte(v_random, 0) & 15))::INT)
    ||
    get_bytea_to_byte(v_random, 1)
    ||
    set_byte(E'\\x00'::BYTEA, 0, (128 | (get_byte(v_random, 2) & 63))::INT)
    ||
    substring(v_random FROM 4 FOR 7);

  RETURN encode(v_uuid_bytes, 'hex')::UUID;
END;
$$;

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
-- Defines roles that can be assigned to users per community
-- System roles (community_id = NULL) are shared across all communities

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,  -- NULL for system roles

  -- Role identification
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Hierarchy (optional role inheritance)
  parent_role_id UUID REFERENCES roles(id),

  -- Role type
  is_system_role BOOLEAN NOT NULL DEFAULT false,  -- System roles cannot be deleted
  is_default BOOLEAN NOT NULL DEFAULT false,       -- Assigned to new users in community
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique role name per community (NULL community_id = system role)
  CONSTRAINT roles_unique_name UNIQUE (community_id, name)
);

-- Comments
COMMENT ON TABLE roles IS 'Role definitions: system roles (community_id NULL) and community-specific custom roles';
COMMENT ON COLUMN roles.parent_role_id IS 'Optional role hierarchy for permission inheritance';
COMMENT ON COLUMN roles.is_system_role IS 'System roles cannot be deleted, only deactivated';
COMMENT ON COLUMN roles.is_default IS 'Default role is auto-assigned to new users in the community';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_roles_community
  ON roles(community_id)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_roles_system
  ON roles(is_system_role)
  WHERE community_id IS NULL AND deleted_at IS NULL;

-- Audit trigger
CREATE TRIGGER set_roles_audit
  BEFORE INSERT OR UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================================================
-- SEED SYSTEM ROLES
-- ============================================================================

INSERT INTO roles (name, display_name, description, is_system_role) VALUES
  ('super_admin', 'Super Administrador', 'Platform-level administrator with full access', true),
  ('community_admin', 'Administrador', 'Community administrator with full community access', true),
  ('manager', 'Gestor', 'Operations manager with day-to-day management access', true),
  ('guard', 'Guardia', 'Security guard with access control permissions', true),
  ('resident', 'Residente', 'Property owner or tenant with standard resident access', true),
  ('provider', 'Proveedor', 'Service provider with limited access to work orders', true)
ON CONFLICT ON CONSTRAINT roles_unique_name DO NOTHING;

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================
-- Defines granular permissions as resource + action combinations

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

  -- Permission identification
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Resource and action
  resource TEXT NOT NULL,  -- e.g., 'packages', 'providers', 'residents', 'audit'
  action TEXT NOT NULL,     -- e.g., 'read', 'create', 'update', 'delete', 'approve'

  -- UI grouping
  category TEXT,  -- e.g., 'operations', 'security', 'financial', 'configuration'

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique resource + action combination
  CONSTRAINT permissions_unique_resource_action UNIQUE (resource, action)
);

-- Comments
COMMENT ON TABLE permissions IS 'Permission definitions: resource + action pairs for fine-grained access control';
COMMENT ON COLUMN permissions.resource IS 'The resource being accessed (packages, providers, audit, etc.)';
COMMENT ON COLUMN permissions.action IS 'The action being performed (read, create, update, delete, approve)';
COMMENT ON COLUMN permissions.category IS 'UI grouping for permission management screens';

-- Index for category-based queries
CREATE INDEX IF NOT EXISTS idx_permissions_category
  ON permissions(category);

-- ============================================================================
-- SEED COMMON PERMISSIONS
-- ============================================================================

INSERT INTO permissions (name, display_name, resource, action, category, description) VALUES
  -- Package Management (Operations)
  ('packages.read', 'Ver paquetes', 'packages', 'read', 'operations', 'View package records and status'),
  ('packages.create', 'Registrar paquetes', 'packages', 'create', 'operations', 'Create new package records'),
  ('packages.update', 'Actualizar paquetes', 'packages', 'update', 'operations', 'Update package information'),
  ('packages.pickup', 'Procesar entregas', 'packages', 'pickup', 'operations', 'Process package pickups and signatures'),

  -- Provider Management (Operations)
  ('providers.read', 'Ver proveedores', 'providers', 'read', 'operations', 'View provider profiles and documents'),
  ('providers.create', 'Agregar proveedores', 'providers', 'create', 'operations', 'Register new providers'),
  ('providers.update', 'Actualizar proveedores', 'providers', 'update', 'operations', 'Update provider information'),
  ('providers.approve', 'Aprobar proveedores', 'providers', 'approve', 'operations', 'Approve or suspend providers'),

  -- Move Coordination (Operations)
  ('moves.read', 'Ver mudanzas', 'moves', 'read', 'operations', 'View move requests and status'),
  ('moves.create', 'Crear mudanzas', 'moves', 'create', 'operations', 'Submit move requests'),
  ('moves.approve', 'Aprobar mudanzas', 'moves', 'approve', 'operations', 'Approve move requests and validations'),

  -- Audit & Security
  ('audit.read', 'Ver auditoria', 'audit', 'read', 'security', 'View audit logs and change history'),
  ('security.read', 'Ver eventos de seguridad', 'security', 'read', 'security', 'View security events and alerts'),
  ('security.manage', 'Gestionar seguridad', 'security', 'manage', 'security', 'Manage security settings and blacklists'),

  -- Community Settings (Configuration)
  ('settings.read', 'Ver configuracion', 'settings', 'read', 'configuration', 'View community settings'),
  ('settings.update', 'Actualizar configuracion', 'settings', 'update', 'configuration', 'Update community settings and feature flags'),

  -- Role Management (Security)
  ('roles.read', 'Ver roles', 'roles', 'read', 'security', 'View role assignments'),
  ('roles.manage', 'Gestionar roles', 'roles', 'manage', 'security', 'Assign and revoke user roles'),

  -- Resident Management (Configuration)
  ('residents.read', 'Ver residentes', 'residents', 'read', 'configuration', 'View resident profiles'),
  ('residents.create', 'Agregar residentes', 'residents', 'create', 'configuration', 'Register new residents'),
  ('residents.update', 'Actualizar residentes', 'residents', 'update', 'configuration', 'Update resident information'),

  -- Financial (Financial)
  ('financial.read', 'Ver finanzas', 'financial', 'read', 'financial', 'View financial records and balances'),
  ('financial.create', 'Crear transacciones', 'financial', 'create', 'financial', 'Create charges and payments'),
  ('financial.approve', 'Aprobar transacciones', 'financial', 'approve', 'financial', 'Approve refunds and adjustments')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ROLE_PERMISSIONS TABLE (Junction)
-- ============================================================================
-- Maps roles to permissions with optional conditions and validity periods

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Optional conditions for fine-grained control
  -- e.g., {"own_unit_only": true} or {"max_amount": 1000}
  conditions JSONB,

  -- Validity period (optional time-bound permissions)
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,

  -- Grant tracking
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique role-permission combination
  CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- Comments
COMMENT ON TABLE role_permissions IS 'Maps roles to permissions with optional conditions and validity periods';
COMMENT ON COLUMN role_permissions.conditions IS 'JSONB conditions for fine-grained access (e.g., own_unit_only, max_amount)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON role_permissions(role_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
  ON role_permissions(permission_id);

-- ============================================================================
-- SEED DEFAULT ROLE PERMISSIONS
-- ============================================================================

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'community_admin'
  AND r.is_system_role = true
ON CONFLICT ON CONSTRAINT role_permissions_unique DO NOTHING;

-- Super admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND r.is_system_role = true
ON CONFLICT ON CONSTRAINT role_permissions_unique DO NOTHING;

-- Manager gets most operational permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND r.is_system_role = true
  AND p.name IN (
    'packages.read', 'packages.create', 'packages.update', 'packages.pickup',
    'providers.read', 'providers.create', 'providers.update',
    'moves.read', 'moves.approve',
    'settings.read',
    'residents.read', 'residents.update',
    'financial.read'
  )
ON CONFLICT ON CONSTRAINT role_permissions_unique DO NOTHING;

-- Guard gets access control and package permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'guard'
  AND r.is_system_role = true
  AND p.name IN (
    'packages.read', 'packages.create', 'packages.pickup',
    'providers.read',
    'moves.read',
    'security.read',
    'residents.read'
  )
ON CONFLICT ON CONSTRAINT role_permissions_unique DO NOTHING;

-- Resident gets limited read access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'resident'
  AND r.is_system_role = true
  AND p.name IN (
    'packages.read',
    'moves.read', 'moves.create',
    'settings.read'
  )
ON CONFLICT ON CONSTRAINT role_permissions_unique DO NOTHING;

-- Provider gets work-related access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'provider'
  AND r.is_system_role = true
  AND p.name IN (
    'settings.read'
  )
ON CONFLICT ON CONSTRAINT role_permissions_unique DO NOTHING;

-- ============================================================================
-- USER_ROLES TABLE
-- ============================================================================
-- Assigns roles to users within specific communities

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Assignment tracking
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,  -- NULL = no expiration

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Unique user-role-community combination
  CONSTRAINT user_roles_unique UNIQUE (user_id, role_id, community_id)
);

-- Comments
COMMENT ON TABLE user_roles IS 'User role assignments per community with validity periods';
COMMENT ON COLUMN user_roles.valid_until IS 'NULL means no expiration, role is permanent until revoked';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_community
  ON user_roles(user_id, community_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles(role_id)
  WHERE is_active = true;

-- ============================================================================
-- RBAC FUNCTIONS
-- ============================================================================

-- Function to check if user has a specific permission in a community
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_community_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND ur.community_id = p_community_id
      AND ur.is_active = true
      AND (ur.valid_until IS NULL OR ur.valid_until > now())
      AND p.name = p_permission_name
      AND (rp.valid_until IS NULL OR rp.valid_until > now())
  );
END;
$$;

COMMENT ON FUNCTION has_permission(UUID, UUID, TEXT) IS
  'Check if a user has a specific permission in a community. Returns true if user has the permission through any of their roles.';

-- Function to get all permissions for a user in a community
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID DEFAULT auth.uid(),
  p_community_id UUID DEFAULT NULL
)
RETURNS TABLE (
  permission_name TEXT,
  resource TEXT,
  action TEXT,
  conditions JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Use community from JWT if not provided
  IF p_community_id IS NULL THEN
    p_community_id := (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    p.name,
    p.resource,
    p.action,
    rp.conditions
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = p_user_id
    AND ur.community_id = p_community_id
    AND ur.is_active = true
    AND (ur.valid_until IS NULL OR ur.valid_until > now())
    AND (rp.valid_until IS NULL OR rp.valid_until > now())
  ORDER BY p.name;
END;
$$;

COMMENT ON FUNCTION get_user_permissions(UUID, UUID) IS
  'Get all permissions for a user in a community. If community_id is NULL, uses current JWT community.';

-- Function to assign a role to a user
CREATE OR REPLACE FUNCTION assign_role(
  p_user_id UUID,
  p_role_id UUID,
  p_community_id UUID,
  p_valid_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_role_id UUID;
BEGIN
  INSERT INTO public.user_roles (
    user_id,
    role_id,
    community_id,
    assigned_by,
    valid_until
  ) VALUES (
    p_user_id,
    p_role_id,
    p_community_id,
    auth.uid(),
    p_valid_until
  )
  ON CONFLICT (user_id, role_id, community_id) DO UPDATE
  SET
    is_active = true,
    assigned_by = auth.uid(),
    assigned_at = now(),
    valid_from = now(),
    valid_until = EXCLUDED.valid_until
  RETURNING id INTO v_user_role_id;

  RETURN v_user_role_id;
END;
$$;

COMMENT ON FUNCTION assign_role(UUID, UUID, UUID, TIMESTAMPTZ) IS
  'Assign a role to a user in a community. If already assigned, reactivates with new validity.';

-- Function to revoke a role from a user
CREATE OR REPLACE FUNCTION revoke_role(
  p_user_id UUID,
  p_role_id UUID,
  p_community_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Soft revoke: set is_active = false (preserve audit trail)
  UPDATE public.user_roles
  SET is_active = false
  WHERE user_id = p_user_id
    AND role_id = p_role_id
    AND community_id = p_community_id
    AND is_active = true;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION revoke_role(UUID, UUID, UUID) IS
  'Revoke a role from a user. Does not delete, sets is_active = false for audit purposes.';

-- Function to get user's roles in a community
CREATE OR REPLACE FUNCTION get_user_roles(
  p_user_id UUID DEFAULT auth.uid(),
  p_community_id UUID DEFAULT NULL
)
RETURNS TABLE (
  role_id UUID,
  role_name TEXT,
  display_name TEXT,
  is_system_role BOOLEAN,
  assigned_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Use community from JWT if not provided
  IF p_community_id IS NULL THEN
    p_community_id := (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.display_name,
    r.is_system_role,
    ur.assigned_at,
    ur.valid_until
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.community_id = p_community_id
    AND ur.is_active = true
    AND (ur.valid_until IS NULL OR ur.valid_until > now())
    AND r.is_active = true
    AND r.deleted_at IS NULL
  ORDER BY r.name;
END;
$$;

COMMENT ON FUNCTION get_user_roles(UUID, UUID) IS
  'Get all active roles for a user in a community.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- ROLES TABLE
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view roles (reference data)
CREATE POLICY roles_select_policy ON roles
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND is_active = true
    AND (
      -- System roles visible to all
      community_id IS NULL
      -- Community-specific roles visible to community members
      OR community_id = (SELECT get_current_community_id())
    )
  );

-- Only admins can create/update community roles
CREATE POLICY roles_insert_policy ON roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
  );

CREATE POLICY roles_update_policy ON roles
  FOR UPDATE
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
    AND is_system_role = false  -- Cannot modify system roles
  );

-- PERMISSIONS TABLE
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view permissions (reference data)
CREATE POLICY permissions_select_policy ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- ROLE_PERMISSIONS TABLE
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view role permissions (reference data)
CREATE POLICY role_permissions_select_policy ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify role permissions
CREATE POLICY role_permissions_insert_policy ON role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
  );

CREATE POLICY role_permissions_update_policy ON role_permissions
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
  );

CREATE POLICY role_permissions_delete_policy ON role_permissions
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
  );

-- USER_ROLES TABLE
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles, admins can view all
CREATE POLICY user_roles_select_policy ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      community_id = (SELECT get_current_community_id())
      AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin', 'manager')
    )
  );

-- Only admins can assign/modify roles
CREATE POLICY user_roles_insert_policy ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
  );

CREATE POLICY user_roles_update_policy ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'community_admin')
  );
