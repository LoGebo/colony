-- Patrol checkpoints table for NFC tag locations
-- NFC serial numbers are TEXT (factory-assigned), not UUIDs

CREATE TABLE patrol_checkpoints (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- NFC tag identification (factory serial number, not UUID)
  -- e.g., "04:A2:E5:1A:BC:34:80" or "0411223344556677"
  nfc_serial TEXT NOT NULL,

  -- Location identification
  name TEXT NOT NULL,                      -- "Building A Entrance", "Pool Gate", "Parking Lot B"
  description TEXT,

  -- GPS coordinates for validation
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  location_tolerance_meters INTEGER DEFAULT 50,  -- GPS validation tolerance

  -- Physical location details
  building TEXT,
  floor INTEGER,
  area TEXT,

  -- Photo of checkpoint location for guard reference
  photo_url TEXT,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- NFC serial must be unique within community (same physical tag can't be in two places)
  CONSTRAINT checkpoints_nfc_unique UNIQUE (community_id, nfc_serial),
  -- Name must also be unique within community
  CONSTRAINT checkpoints_name_unique UNIQUE (community_id, name)
);

-- Indexes
CREATE INDEX idx_patrol_checkpoints_community ON patrol_checkpoints(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patrol_checkpoints_nfc ON patrol_checkpoints(community_id, nfc_serial) WHERE deleted_at IS NULL;

-- Audit trigger
CREATE TRIGGER patrol_checkpoints_audit
  BEFORE INSERT OR UPDATE ON patrol_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- RLS
ALTER TABLE patrol_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_checkpoints" ON patrol_checkpoints FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "users_view_own_community_checkpoints" ON patrol_checkpoints FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()) AND deleted_at IS NULL);

CREATE POLICY "admins_manage_checkpoints" ON patrol_checkpoints FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

COMMENT ON TABLE patrol_checkpoints IS 'Physical NFC tag locations for guard patrol verification';
COMMENT ON COLUMN patrol_checkpoints.nfc_serial IS 'Factory-assigned NFC tag serial number (e.g., "04:A2:E5:1A:BC:34:80"). Use serial number, not UUID, because NFC readers return serial numbers directly and they are factory-immutable (tamper-evident).';
COMMENT ON COLUMN patrol_checkpoints.location_tolerance_meters IS 'Maximum distance in meters between GPS location and checkpoint for valid scan';
