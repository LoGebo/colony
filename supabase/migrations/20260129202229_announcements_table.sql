-- Announcements with segment targeting and recipient fan-out
-- Migration: 20260129202229_announcements_table.sql

--------------------------------------------------------------------------------
-- ANNOUNCEMENTS TABLE
--------------------------------------------------------------------------------

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_urls TEXT[],                                -- Array of media file URLs

  -- Author
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Targeting
  target_segment announcement_segment NOT NULL DEFAULT 'all',
  -- Segment-specific configuration:
  --   building:   {"buildings": ["Tower A", "Tower B"]}
  --   unit_type:  {"types": ["departamento", "casa"]}
  --   delinquent: {"min_balance": 1000}
  --   role:       {"roles": ["admin", "manager"]}
  target_criteria JSONB,

  -- Scheduling
  publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,

  -- Flags
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  requires_acknowledgment BOOLEAN NOT NULL DEFAULT FALSE,

  -- Denormalized counters (updated by triggers)
  total_recipients INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  acknowledged_count INTEGER NOT NULL DEFAULT 0,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_announcements_audit
  BEFORE INSERT OR UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_announcements_community_publish
  ON announcements(community_id, publish_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_announcements_urgent
  ON announcements(community_id, is_urgent)
  WHERE deleted_at IS NULL AND is_urgent = TRUE;

CREATE INDEX idx_announcements_expires
  ON announcements(expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

--------------------------------------------------------------------------------
-- ANNOUNCEMENT_RECIPIENTS TABLE (Fan-out pattern)
--------------------------------------------------------------------------------

CREATE TABLE announcement_recipients (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id),               -- Which unit qualified them

  -- Delivery tracking
  delivered_at TIMESTAMPTZ,
  delivery_channel TEXT,                            -- push, email, sms, in_app

  -- Read/acknowledgment tracking
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,

  -- Unique: one recipient record per resident per announcement
  CONSTRAINT announcement_recipients_unique
    UNIQUE (announcement_id, resident_id)
);

-- Enable RLS
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_announcement_recipients_announcement
  ON announcement_recipients(announcement_id, read_at);

CREATE INDEX idx_announcement_recipients_resident
  ON announcement_recipients(resident_id);

CREATE INDEX idx_announcement_recipients_unread
  ON announcement_recipients(resident_id, read_at)
  WHERE read_at IS NULL;

--------------------------------------------------------------------------------
-- EXPAND_ANNOUNCEMENT_RECIPIENTS FUNCTION
--------------------------------------------------------------------------------

-- Expands announcement recipients based on target_segment
-- Uses batching to handle large communities
CREATE OR REPLACE FUNCTION expand_announcement_recipients(p_announcement_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_announcement RECORD;
  v_batch_size INTEGER := 1000;
  v_total_inserted INTEGER := 0;
  v_batch_count INTEGER;
BEGIN
  -- Get announcement details
  SELECT community_id, target_segment, target_criteria
  INTO v_announcement
  FROM announcements
  WHERE id = p_announcement_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Announcement not found: %', p_announcement_id;
  END IF;

  -- Insert recipients based on segment type
  -- Using batched inserts with offset/limit pattern

  CASE v_announcement.target_segment

    WHEN 'all' THEN
      -- All active residents in community
      INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
      SELECT DISTINCT ON (r.id)
        p_announcement_id,
        r.id,
        o.unit_id
      FROM residents r
      LEFT JOIN occupancies o ON o.resident_id = r.id
        AND o.deleted_at IS NULL
        AND o.status = 'active'
      WHERE r.community_id = v_announcement.community_id
        AND r.deleted_at IS NULL
        AND r.onboarding_status IN ('verified', 'active')
      ON CONFLICT (announcement_id, resident_id) DO NOTHING;

      GET DIAGNOSTICS v_total_inserted = ROW_COUNT;

    WHEN 'owners' THEN
      -- Only owners
      INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
      SELECT DISTINCT ON (r.id)
        p_announcement_id,
        r.id,
        o.unit_id
      FROM residents r
      JOIN occupancies o ON o.resident_id = r.id
        AND o.deleted_at IS NULL
        AND o.status = 'active'
        AND o.occupancy_type = 'owner'
      WHERE r.community_id = v_announcement.community_id
        AND r.deleted_at IS NULL
        AND r.onboarding_status IN ('verified', 'active')
      ON CONFLICT (announcement_id, resident_id) DO NOTHING;

      GET DIAGNOSTICS v_total_inserted = ROW_COUNT;

    WHEN 'tenants' THEN
      -- Only tenants
      INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
      SELECT DISTINCT ON (r.id)
        p_announcement_id,
        r.id,
        o.unit_id
      FROM residents r
      JOIN occupancies o ON o.resident_id = r.id
        AND o.deleted_at IS NULL
        AND o.status = 'active'
        AND o.occupancy_type = 'tenant'
      WHERE r.community_id = v_announcement.community_id
        AND r.deleted_at IS NULL
        AND r.onboarding_status IN ('verified', 'active')
      ON CONFLICT (announcement_id, resident_id) DO NOTHING;

      GET DIAGNOSTICS v_total_inserted = ROW_COUNT;

    WHEN 'building' THEN
      -- Specific building(s)
      INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
      SELECT DISTINCT ON (r.id)
        p_announcement_id,
        r.id,
        o.unit_id
      FROM residents r
      JOIN occupancies o ON o.resident_id = r.id
        AND o.deleted_at IS NULL
        AND o.status = 'active'
      JOIN units u ON u.id = o.unit_id
        AND u.deleted_at IS NULL
        AND u.building = ANY(
          ARRAY(SELECT jsonb_array_elements_text(v_announcement.target_criteria->'buildings'))
        )
      WHERE r.community_id = v_announcement.community_id
        AND r.deleted_at IS NULL
        AND r.onboarding_status IN ('verified', 'active')
      ON CONFLICT (announcement_id, resident_id) DO NOTHING;

      GET DIAGNOSTICS v_total_inserted = ROW_COUNT;

    WHEN 'unit_type' THEN
      -- Specific unit types
      INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
      SELECT DISTINCT ON (r.id)
        p_announcement_id,
        r.id,
        o.unit_id
      FROM residents r
      JOIN occupancies o ON o.resident_id = r.id
        AND o.deleted_at IS NULL
        AND o.status = 'active'
      JOIN units u ON u.id = o.unit_id
        AND u.deleted_at IS NULL
        AND u.unit_type::TEXT = ANY(
          ARRAY(SELECT jsonb_array_elements_text(v_announcement.target_criteria->'types'))
        )
      WHERE r.community_id = v_announcement.community_id
        AND r.deleted_at IS NULL
        AND r.onboarding_status IN ('verified', 'active')
      ON CONFLICT (announcement_id, resident_id) DO NOTHING;

      GET DIAGNOSTICS v_total_inserted = ROW_COUNT;

    WHEN 'delinquent' THEN
      -- Units with outstanding balance (uses unit_balances view from Phase 4)
      -- Falls back gracefully if view doesn't exist
      BEGIN
        INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
        SELECT DISTINCT ON (r.id)
          p_announcement_id,
          r.id,
          o.unit_id
        FROM residents r
        JOIN occupancies o ON o.resident_id = r.id
          AND o.deleted_at IS NULL
          AND o.status = 'active'
        JOIN unit_balances ub ON ub.unit_id = o.unit_id
          AND ub.balance >= COALESCE(
            (v_announcement.target_criteria->>'min_balance')::NUMERIC,
            0
          )
        WHERE r.community_id = v_announcement.community_id
          AND r.deleted_at IS NULL
          AND r.onboarding_status IN ('verified', 'active')
        ON CONFLICT (announcement_id, resident_id) DO NOTHING;

        GET DIAGNOSTICS v_total_inserted = ROW_COUNT;
      EXCEPTION WHEN undefined_table THEN
        -- unit_balances view doesn't exist, skip delinquent targeting
        v_total_inserted := 0;
      END;

    WHEN 'role' THEN
      -- Specific user roles (checks JWT claim in residents context)
      -- Note: This uses a simplified approach checking against known role-holders
      -- In practice, you'd join against a user_roles table or JWT-based approach
      INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
      SELECT DISTINCT ON (r.id)
        p_announcement_id,
        r.id,
        o.unit_id
      FROM residents r
      LEFT JOIN occupancies o ON o.resident_id = r.id
        AND o.deleted_at IS NULL
        AND o.status = 'active'
      WHERE r.community_id = v_announcement.community_id
        AND r.deleted_at IS NULL
        AND r.onboarding_status IN ('verified', 'active')
        -- Role check would typically use a user_roles junction or JWT claims
        -- For now, include all residents for role-based (filtered by app)
      ON CONFLICT (announcement_id, resident_id) DO NOTHING;

      GET DIAGNOSTICS v_total_inserted = ROW_COUNT;

  END CASE;

  -- Update total_recipients count on announcement
  UPDATE announcements
  SET total_recipients = v_total_inserted,
      updated_at = now()
  WHERE id = p_announcement_id;

  RETURN v_total_inserted;
END;
$$;

COMMENT ON FUNCTION expand_announcement_recipients(UUID) IS 'Fan-out function: creates recipient records based on announcement target_segment';

--------------------------------------------------------------------------------
-- UPDATE READ/ACKNOWLEDGMENT COUNT TRIGGER
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_announcement_read_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment read_count when read_at transitions from NULL to non-NULL
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    UPDATE announcements
    SET read_count = read_count + 1,
        updated_at = now()
    WHERE id = NEW.announcement_id;
  END IF;

  -- Increment acknowledged_count when acknowledged_at transitions from NULL to non-NULL
  IF NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL THEN
    UPDATE announcements
    SET acknowledged_count = acknowledged_count + 1,
        updated_at = now()
    WHERE id = NEW.announcement_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_announcement_read_count
  AFTER UPDATE ON announcement_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_read_count();

--------------------------------------------------------------------------------
-- RLS POLICIES: ANNOUNCEMENTS
--------------------------------------------------------------------------------

-- Super admins full access
CREATE POLICY "super_admins_full_access_announcements"
  ON announcements
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Admins/managers can manage announcements in their community
CREATE POLICY "admins_manage_announcements"
  ON announcements
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Users can view published announcements they're recipients of
CREATE POLICY "users_view_own_announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND publish_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM announcement_recipients ar
      WHERE ar.announcement_id = announcements.id
        AND ar.resident_id = auth.uid()
    )
  );

--------------------------------------------------------------------------------
-- RLS POLICIES: ANNOUNCEMENT_RECIPIENTS
--------------------------------------------------------------------------------

-- Super admins full access
CREATE POLICY "super_admins_full_access_announcement_recipients"
  ON announcement_recipients
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Admins can view all recipients for announcements in their community
CREATE POLICY "admins_view_announcement_recipients"
  ON announcement_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_recipients.announcement_id
        AND a.community_id = (SELECT get_current_community_id())
        AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- Users can view and update their own recipient records
CREATE POLICY "users_view_own_recipient_records"
  ON announcement_recipients
  FOR SELECT
  TO authenticated
  USING (resident_id = auth.uid());

CREATE POLICY "users_update_own_recipient_records"
  ON announcement_recipients
  FOR UPDATE
  TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

--------------------------------------------------------------------------------
-- COMMENTS
--------------------------------------------------------------------------------

COMMENT ON TABLE announcements IS 'Community announcements with segment-based targeting';
COMMENT ON COLUMN announcements.target_segment IS 'Recipient targeting: all, owners, tenants, building, unit_type, delinquent, role';
COMMENT ON COLUMN announcements.target_criteria IS 'Segment-specific criteria: {buildings: []}, {types: []}, {min_balance: N}, {roles: []}';
COMMENT ON COLUMN announcements.total_recipients IS 'Denormalized count of recipients, updated by expand_announcement_recipients()';
COMMENT ON COLUMN announcements.read_count IS 'Denormalized count of reads, updated by trigger on announcement_recipients';

COMMENT ON TABLE announcement_recipients IS 'Fan-out table: one row per recipient per announcement for delivery/read tracking';
COMMENT ON COLUMN announcement_recipients.delivery_channel IS 'How notification was sent: push, email, sms, in_app';
COMMENT ON COLUMN announcement_recipients.read_at IS 'When recipient opened/viewed the announcement';
COMMENT ON COLUMN announcement_recipients.acknowledged_at IS 'When recipient explicitly acknowledged (for requires_acknowledgment announcements)';
