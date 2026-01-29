-- Vehicles: registered vehicles with LPR-compatible plate storage
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Original as entered by user (preserves formatting)
  plate_number TEXT NOT NULL,

  -- Normalized for LPR matching (uppercase, no hyphens/spaces)
  plate_normalized TEXT NOT NULL GENERATED ALWAYS AS (
    UPPER(REGEXP_REPLACE(plate_number, '[^A-Z0-9]', '', 'gi'))
  ) STORED,

  -- State of registration (affects plate format)
  plate_state TEXT NOT NULL,

  -- Vehicle identification
  make TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,

  -- LPR-specific fields
  vehicle_image_url TEXT,      -- Photo of vehicle
  plate_image_url TEXT,        -- Photo of plate for training
  lpr_confidence NUMERIC(5,4), -- Last LPR match confidence (0.0000-1.0000)
  last_lpr_detection TIMESTAMPTZ,

  -- Access control
  sticker_number TEXT,
  sticker_issued_at TIMESTAMPTZ,
  access_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_vehicles_audit
  BEFORE INSERT OR UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
-- Primary LPR lookup: normalized plate within community
CREATE INDEX idx_vehicles_plate_normalized
  ON vehicles(plate_normalized, community_id)
  WHERE deleted_at IS NULL AND access_enabled = true;

CREATE INDEX idx_vehicles_resident ON vehicles(resident_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_community ON vehicles(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_sticker ON vehicles(community_id, sticker_number)
  WHERE deleted_at IS NULL AND sticker_number IS NOT NULL;

-- RLS Policies

-- Super admins full access
CREATE POLICY "super_admins_full_access_vehicles"
  ON vehicles
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can view vehicles in their community
CREATE POLICY "users_view_own_community_vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Users can manage their own vehicles
CREATE POLICY "users_manage_own_vehicles"
  ON vehicles
  FOR ALL
  TO authenticated
  USING (
    resident_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    resident_id = auth.uid()
  );

-- Admins can manage all vehicles
CREATE POLICY "admins_manage_vehicles"
  ON vehicles
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- Comments
COMMENT ON TABLE vehicles IS 'Registered vehicles with LPR-compatible normalized plate storage';
COMMENT ON COLUMN vehicles.plate_normalized IS 'Generated: uppercase alphanumeric only for LPR matching';
COMMENT ON COLUMN vehicles.lpr_confidence IS 'Last LPR match confidence score 0.0000-1.0000';
