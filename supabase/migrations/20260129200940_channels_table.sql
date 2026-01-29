-- ============================================
-- CHANNELS TABLE
-- Phase 5 Plan 3: Community Discussion Infrastructure
-- ============================================

-- ============================================
-- CHANNELS TABLE
-- ============================================
-- Discussion channels within a community

CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT public.generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Channel identification
  name TEXT NOT NULL,
  description TEXT,
  channel_type channel_type NOT NULL DEFAULT 'general',

  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_roles user_role[] DEFAULT ARRAY['admin', 'manager', 'resident']::user_role[],

  -- Building-specific channels
  building TEXT,

  -- Posting permissions
  anyone_can_post BOOLEAN NOT NULL DEFAULT TRUE,
  requires_moderation BOOLEAN NOT NULL DEFAULT FALSE,

  -- Display settings
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,

  -- Unique name per community
  CONSTRAINT channels_unique_name UNIQUE (community_id, name)
);

-- Comments
COMMENT ON TABLE channels IS 'Discussion channels for community communication';
COMMENT ON COLUMN channels.is_public IS 'If TRUE, visible to all residents; if FALSE, only to those in allowed_roles';
COMMENT ON COLUMN channels.allowed_roles IS 'Array of user_role that can access this channel';
COMMENT ON COLUMN channels.building IS 'For building-specific channels, restricts to residents in that building';
COMMENT ON COLUMN channels.anyone_can_post IS 'If FALSE, only admins/managers can create posts';
COMMENT ON COLUMN channels.requires_moderation IS 'If TRUE, new posts require approval before visibility';

-- ============================================
-- INDEXES
-- ============================================

-- Channel list query: community + status + sort
CREATE INDEX idx_channels_community_list
  ON channels(community_id, status, sort_order)
  WHERE deleted_at IS NULL;

-- Filter by channel type
CREATE INDEX idx_channels_type
  ON channels(channel_type)
  WHERE deleted_at IS NULL;

-- Building-specific queries
CREATE INDEX idx_channels_building
  ON channels(community_id, building)
  WHERE building IS NOT NULL AND deleted_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Audit trigger
CREATE TRIGGER set_channels_audit
  BEFORE INSERT OR UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER channels_soft_delete
  BEFORE DELETE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY super_admin_all_channels ON channels
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users can view public channels in their community
CREATE POLICY users_view_public_channels ON channels
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND community_id = (SELECT public.get_current_community_id())
    AND is_public = TRUE
  );

-- Users can view channels where their role is allowed
CREATE POLICY users_view_allowed_channels ON channels
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role())::user_role = ANY(allowed_roles)
  );

-- Admins and managers can manage channels
CREATE POLICY admins_manage_channels ON channels
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- DEFAULT CHANNELS FUNCTION
-- ============================================
-- Creates default channels for a new community

CREATE OR REPLACE FUNCTION create_default_channels(p_community_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- General channel
  INSERT INTO public.channels (community_id, name, description, channel_type, icon, sort_order)
  VALUES (
    p_community_id,
    'General',
    'General community discussions',
    'general',
    'chat',
    1
  )
  ON CONFLICT (community_id, name) DO NOTHING;

  -- Announcements channel (admin-only posting)
  INSERT INTO public.channels (community_id, name, description, channel_type, anyone_can_post, icon, sort_order)
  VALUES (
    p_community_id,
    'Announcements',
    'Official community announcements from administration',
    'announcements',
    FALSE,
    'megaphone',
    0
  )
  ON CONFLICT (community_id, name) DO NOTHING;

  -- Marketplace channel
  INSERT INTO public.channels (community_id, name, description, channel_type, icon, sort_order)
  VALUES (
    p_community_id,
    'Marketplace',
    'Buy, sell, and trade within the community',
    'marketplace',
    'shopping-cart',
    2
  )
  ON CONFLICT (community_id, name) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION create_default_channels(UUID) IS
  'Creates default channels (General, Announcements, Marketplace) for a new community';
