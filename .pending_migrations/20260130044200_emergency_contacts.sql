-- Migration: Emergency contacts table for Phase 8-06
-- Provides emergency contact management with priority ordering and role-based access

-- ============================================================================
-- EMERGENCY CONTACTS TABLE
-- ============================================================================

-- Relationship enum for emergency contacts
CREATE TYPE emergency_contact_relationship AS ENUM (
  'spouse',
  'parent',
  'child',
  'sibling',
  'friend',
  'doctor',
  'employer',
  'neighbor',
  'other'
);

-- Emergency contacts table
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Contact info
  contact_name TEXT NOT NULL,
  relationship emergency_contact_relationship NOT NULL,

  -- Phone numbers
  phone_primary TEXT NOT NULL,
  phone_secondary TEXT,

  -- Location
  address TEXT,
  city TEXT,

  -- Priority: Lower = call first (1 = primary, 2 = secondary, etc.)
  priority INTEGER NOT NULL DEFAULT 1 CHECK (priority > 0),

  -- Contact for categories: determines when to use this contact
  contact_for TEXT[] NOT NULL DEFAULT ARRAY['general']::TEXT[],

  -- Additional notes
  notes TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_contact_for CHECK (
    contact_for <@ ARRAY['medical', 'security', 'general', 'financial']::TEXT[]
  )
);

-- Comments
COMMENT ON TABLE emergency_contacts IS 'Emergency contacts for residents with priority ordering and category-based usage';
COMMENT ON COLUMN emergency_contacts.priority IS 'Lower number = call first. 1 = primary contact';
COMMENT ON COLUMN emergency_contacts.contact_for IS 'Categories: medical, security, general, financial';
COMMENT ON COLUMN emergency_contacts.is_active IS 'Only active contacts are returned by helper functions';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup: contacts for a resident, ordered by priority (active only)
CREATE INDEX idx_emergency_contacts_resident
  ON emergency_contacts(resident_id, priority)
  WHERE is_active = true AND deleted_at IS NULL;

-- Community-level queries
CREATE INDEX idx_emergency_contacts_community
  ON emergency_contacts(community_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Audit trigger
CREATE TRIGGER set_emergency_contacts_audit
  BEFORE INSERT OR UPDATE ON emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Soft delete trigger
CREATE TRIGGER soft_delete_emergency_contacts
  BEFORE DELETE ON emergency_contacts
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get emergency contacts for a resident, ordered by priority
CREATE OR REPLACE FUNCTION get_emergency_contacts(p_resident_id UUID)
RETURNS TABLE (
  contact_name TEXT,
  relationship emergency_contact_relationship,
  phone_primary TEXT,
  phone_secondary TEXT,
  priority INTEGER,
  contact_for TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ec.contact_name,
    ec.relationship,
    ec.phone_primary,
    ec.phone_secondary,
    ec.priority,
    ec.contact_for
  FROM emergency_contacts ec
  WHERE ec.resident_id = p_resident_id
    AND ec.is_active = true
    AND ec.deleted_at IS NULL
  ORDER BY ec.priority ASC;
$$;

COMMENT ON FUNCTION get_emergency_contacts IS 'Returns emergency contacts for a resident, ordered by priority (lowest first)';

-- Get emergency contacts for all residents in a unit
CREATE OR REPLACE FUNCTION get_emergency_contacts_for_unit(p_unit_id UUID)
RETURNS TABLE (
  resident_id UUID,
  resident_name TEXT,
  contact_name TEXT,
  relationship emergency_contact_relationship,
  phone_primary TEXT,
  phone_secondary TEXT,
  priority INTEGER,
  contact_for TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    r.id AS resident_id,
    r.full_name AS resident_name,
    ec.contact_name,
    ec.relationship,
    ec.phone_primary,
    ec.phone_secondary,
    ec.priority,
    ec.contact_for
  FROM residents r
  JOIN occupancies o ON o.resident_id = r.id
  JOIN emergency_contacts ec ON ec.resident_id = r.id
  WHERE o.unit_id = p_unit_id
    AND o.status = 'active'
    AND o.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND ec.is_active = true
    AND ec.deleted_at IS NULL
  ORDER BY r.full_name, ec.priority ASC;
$$;

COMMENT ON FUNCTION get_emergency_contacts_for_unit IS 'Returns all emergency contacts for all residents in a unit. Useful for guard booth access.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Residents can view their own contacts
CREATE POLICY emergency_contacts_select_own ON emergency_contacts
  FOR SELECT
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Policy: Residents can insert their own contacts
CREATE POLICY emergency_contacts_insert_own ON emergency_contacts
  FOR INSERT
  WITH CHECK (
    resident_id = (SELECT auth.uid())
    AND community_id = (SELECT get_current_community_id())
  );

-- Policy: Residents can update their own contacts
CREATE POLICY emergency_contacts_update_own ON emergency_contacts
  FOR UPDATE
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    resident_id = (SELECT auth.uid())
  );

-- Policy: Residents can delete (soft) their own contacts
CREATE POLICY emergency_contacts_delete_own ON emergency_contacts
  FOR DELETE
  USING (
    resident_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );

-- Policy: Staff can view all contacts in their community (for emergency access)
CREATE POLICY emergency_contacts_select_staff ON emergency_contacts
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_my_claim('user_role')::TEXT) IN ('"admin"', '"manager"', '"staff"')
  );

-- Policy: Guards can view all contacts in their community (security needs this during emergencies)
CREATE POLICY emergency_contacts_select_guard ON emergency_contacts
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND (SELECT get_my_claim('user_role')::TEXT) = '"guard"'
  );

-- ============================================================================
-- ENABLE AUDIT TRACKING
-- ============================================================================

SELECT audit.enable_tracking('public.emergency_contacts'::regclass);
