-- ============================================
-- ACCESS POINTS TABLE
-- ============================================
-- Phase 03-01: Access Control & Security Infrastructure
-- Physical entry/exit points in a community (gates, barriers, doors, etc.)

CREATE TABLE access_points (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  name TEXT NOT NULL,                       -- "Main Gate", "Tower A Entrance"
  code TEXT,                                -- Short code for guards: "MG", "T1"

  -- Type and direction
  access_point_type access_point_type NOT NULL,
  direction access_point_direction NOT NULL DEFAULT 'bidirectional',

  -- Location
  location_description TEXT,               -- "North side of complex, near pool"
  location_lat NUMERIC(10, 7),             -- Latitude for mapping
  location_lng NUMERIC(10, 7),             -- Longitude for mapping

  -- Capabilities (hardware features)
  has_lpr BOOLEAN NOT NULL DEFAULT FALSE,           -- License plate recognition
  has_intercom BOOLEAN NOT NULL DEFAULT FALSE,      -- Intercom system
  has_camera BOOLEAN NOT NULL DEFAULT TRUE,         -- Security camera
  has_nfc_reader BOOLEAN NOT NULL DEFAULT FALSE,    -- NFC/RFID reader
  has_qr_scanner BOOLEAN NOT NULL DEFAULT TRUE,     -- QR code scanner
  can_remote_open BOOLEAN NOT NULL DEFAULT FALSE,   -- Can be opened remotely

  -- Hardware identifiers (for future integrations)
  lpr_device_id TEXT,                      -- LPR camera device ID
  camera_device_id TEXT,                   -- Security camera ID
  barrier_controller_id TEXT,              -- Barrier/gate controller ID

  -- Operating hours (NULL = 24/7)
  operating_start_time TIME,               -- When access point opens
  operating_end_time TIME,                 -- When access point closes

  -- Status
  status general_status NOT NULL DEFAULT 'active',
  is_emergency_exit BOOLEAN NOT NULL DEFAULT FALSE,  -- Emergency exit only

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT access_points_name_unique UNIQUE (community_id, name)
);

-- Table comment
COMMENT ON TABLE access_points IS
  'Physical entry/exit points in a community (gates, barriers, doors, turnstiles).
   Used for access logging, guard assignments, and hardware integration.';

-- Column comments
COMMENT ON COLUMN access_points.code IS 'Short code for quick reference by guards (e.g., MG for Main Gate)';
COMMENT ON COLUMN access_points.has_lpr IS 'License Plate Recognition camera installed';
COMMENT ON COLUMN access_points.has_qr_scanner IS 'QR code scanner for visitor invitations';
COMMENT ON COLUMN access_points.can_remote_open IS 'Can be opened remotely via app/dashboard';
COMMENT ON COLUMN access_points.lpr_device_id IS 'Device ID for LPR camera integration';
COMMENT ON COLUMN access_points.barrier_controller_id IS 'Controller ID for automated barrier/gate';
COMMENT ON COLUMN access_points.operating_start_time IS 'Opening time (NULL means 24/7)';
COMMENT ON COLUMN access_points.operating_end_time IS 'Closing time (NULL means 24/7)';
COMMENT ON COLUMN access_points.is_emergency_exit IS 'Designated emergency exit only';

-- ============================================
-- INDEXES
-- ============================================

-- Community lookup (most common query)
CREATE INDEX idx_access_points_community ON access_points(community_id)
  WHERE deleted_at IS NULL;

-- Type filtering within community
CREATE INDEX idx_access_points_type ON access_points(community_id, access_point_type)
  WHERE deleted_at IS NULL;

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER access_points_audit
  BEFORE INSERT OR UPDATE ON access_points
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE access_points ENABLE ROW LEVEL SECURITY;

-- Super admin can see all access points across all communities
CREATE POLICY "super_admin_all_access_points"
  ON access_points
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Users can view their community's access points
CREATE POLICY "users_view_own_community_access_points"
  ON access_points
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Admins and managers can manage their community's access points
CREATE POLICY "admins_manage_access_points"
  ON access_points
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
