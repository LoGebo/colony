-- ============================================================================
-- ASSETS AND MAINTENANCE HISTORY
-- Phase 6, Plan 2: Assets & Preventive Maintenance
-- ============================================================================
-- Community infrastructure tracking with lifecycle management
-- Asset types: pumps, elevators, generators, HVAC, gates, intercoms, lighting, pool equipment
-- Maintenance history with cost tracking and auto-update of next maintenance due
-- ============================================================================

--------------------------------------------------------------------------------
-- ASSET_STATUS ENUM
--------------------------------------------------------------------------------

CREATE TYPE asset_status AS ENUM (
  'operational',       -- Working normally
  'degraded',          -- Working but needs attention
  'maintenance',       -- Under active maintenance
  'out_of_service',    -- Not working
  'retired'            -- Decommissioned
);

COMMENT ON TYPE asset_status IS '5-state lifecycle for community infrastructure assets';

--------------------------------------------------------------------------------
-- ASSETS TABLE
--------------------------------------------------------------------------------

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Basic identification
  name TEXT NOT NULL,                       -- e.g., 'Bomba Principal Torre A'
  asset_tag TEXT,                           -- Physical tag number
  serial_number TEXT,
  asset_type TEXT NOT NULL,                 -- pump, elevator, generator, hvac, gate, intercom, lighting, pool_equipment, other

  -- Manufacturer info
  manufacturer TEXT,
  model TEXT,

  -- Location
  location TEXT NOT NULL,                   -- e.g., 'Sotano 1, Cuarto de Maquinas'
  building TEXT,
  floor TEXT,

  -- Lifecycle dates
  purchased_at DATE,
  installed_at DATE,
  warranty_expires_at DATE,
  expected_end_of_life DATE,

  -- Financial tracking
  purchase_cost NUMERIC(12,2),
  current_value NUMERIC(12,2),
  depreciation_method TEXT,                 -- straight_line, declining_balance

  -- Status
  status asset_status NOT NULL DEFAULT 'operational',

  -- Maintenance tracking
  last_maintenance_at DATE,
  next_maintenance_due DATE,
  maintenance_interval_days INTEGER,        -- Days between maintenance

  -- Documentation
  manual_url TEXT,
  photo_urls TEXT[],
  specifications JSONB NOT NULL DEFAULT '{}'::JSONB,  -- Technical specs

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Unique asset tag per community
  CONSTRAINT assets_unique_tag
    UNIQUE NULLS NOT DISTINCT (community_id, asset_tag)
);

-- Comments
COMMENT ON TABLE assets IS 'Community infrastructure assets with lifecycle tracking (pumps, elevators, generators, etc.)';
COMMENT ON COLUMN assets.asset_type IS 'Type: pump, elevator, generator, hvac, gate, intercom, lighting, pool_equipment, other';
COMMENT ON COLUMN assets.maintenance_interval_days IS 'Days between scheduled maintenance; triggers next_maintenance_due calculation';
COMMENT ON COLUMN assets.specifications IS 'JSONB for technical specs: voltage, capacity, dimensions, etc.';

--------------------------------------------------------------------------------
-- ASSET_MAINTENANCE_HISTORY TABLE
--------------------------------------------------------------------------------

CREATE TABLE asset_maintenance_history (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  -- Maintenance details
  maintenance_type TEXT NOT NULL,           -- preventive, corrective, emergency
  description TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC(5,2),

  -- Personnel
  performed_by TEXT,                        -- Name or company
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Cost tracking
  labor_cost NUMERIC(10,2),
  parts_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2) GENERATED ALWAYS AS (COALESCE(labor_cost, 0) + COALESCE(parts_cost, 0)) STORED,
  parts_used JSONB NOT NULL DEFAULT '[]'::JSONB,  -- Array of {name, quantity, cost}

  -- Documentation
  report_url TEXT,
  photo_urls TEXT[],

  -- Link to maintenance ticket
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,

  -- Timestamp (no soft delete for history)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE asset_maintenance_history IS 'Historical record of all maintenance performed on assets';
COMMENT ON COLUMN asset_maintenance_history.maintenance_type IS 'Type: preventive (scheduled), corrective (issue fix), emergency';
COMMENT ON COLUMN asset_maintenance_history.parts_used IS 'Array of parts: [{name: "Filtro", quantity: 2, cost: 150.00}]';
COMMENT ON COLUMN asset_maintenance_history.total_cost IS 'Auto-calculated: labor_cost + parts_cost';

--------------------------------------------------------------------------------
-- UPDATE_ASSET_MAINTENANCE_DATE TRIGGER FUNCTION
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_asset_maintenance_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interval_days INTEGER;
BEGIN
  -- Get the maintenance interval for this asset
  SELECT maintenance_interval_days INTO v_interval_days
  FROM public.assets
  WHERE id = NEW.asset_id;

  -- Update the asset's last_maintenance_at
  UPDATE public.assets
  SET
    last_maintenance_at = NEW.performed_at::DATE,
    next_maintenance_due = CASE
      WHEN v_interval_days IS NOT NULL
      THEN NEW.performed_at::DATE + v_interval_days
      ELSE next_maintenance_due
    END
  WHERE id = NEW.asset_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_asset_maintenance_date IS 'Updates asset last_maintenance_at and calculates next_maintenance_due after maintenance history insert';

CREATE TRIGGER asset_maintenance_history_update_asset
  AFTER INSERT ON asset_maintenance_history
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_maintenance_date();

--------------------------------------------------------------------------------
-- ADD asset_id FK TO TICKETS TABLE
--------------------------------------------------------------------------------

-- Add FK constraint to existing column (column was added without FK in 06-01)
ALTER TABLE tickets
  ADD CONSTRAINT tickets_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;

-- Index for filtering tickets by asset
CREATE INDEX idx_tickets_asset
  ON tickets(asset_id)
  WHERE asset_id IS NOT NULL AND deleted_at IS NULL;

--------------------------------------------------------------------------------
-- INDEXES
--------------------------------------------------------------------------------

-- Asset listing by community and status
CREATE INDEX idx_assets_community_status
  ON assets(community_id, status)
  WHERE deleted_at IS NULL;

-- Asset listing by type
CREATE INDEX idx_assets_community_type
  ON assets(community_id, asset_type)
  WHERE deleted_at IS NULL;

-- Upcoming maintenance queries
CREATE INDEX idx_assets_next_maintenance
  ON assets(next_maintenance_due)
  WHERE next_maintenance_due IS NOT NULL
    AND status IN ('operational', 'degraded')
    AND deleted_at IS NULL;

-- Maintenance history by asset
CREATE INDEX idx_maintenance_history_asset
  ON asset_maintenance_history(asset_id, performed_at DESC);

--------------------------------------------------------------------------------
-- AUDIT TRIGGER
--------------------------------------------------------------------------------

CREATE TRIGGER assets_audit_trigger
  BEFORE INSERT OR UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

--------------------------------------------------------------------------------
-- RLS POLICIES
--------------------------------------------------------------------------------

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance_history ENABLE ROW LEVEL SECURITY;

-- Assets: Super admin
CREATE POLICY super_admin_all_assets ON assets
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Assets: Community members can view
CREATE POLICY users_view_community_assets ON assets
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND deleted_at IS NULL
  );

-- Assets: Admins can manage
CREATE POLICY admins_manage_assets ON assets
  FOR ALL
  TO authenticated
  USING (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    NOT is_super_admin()
    AND community_id = (SELECT public.get_current_community_id())
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager')
  );

-- Maintenance History: Super admin
CREATE POLICY super_admin_all_maintenance_history ON asset_maintenance_history
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Maintenance History: Community members can view
CREATE POLICY users_view_maintenance_history ON asset_maintenance_history
  FOR SELECT
  TO authenticated
  USING (
    NOT is_super_admin()
    AND asset_id IN (
      SELECT id FROM public.assets
      WHERE community_id = (SELECT public.get_current_community_id())
      AND deleted_at IS NULL
    )
  );

-- Maintenance History: Admins/staff can manage
CREATE POLICY admins_manage_maintenance_history ON asset_maintenance_history
  FOR ALL
  TO authenticated
  USING (
    NOT is_super_admin()
    AND asset_id IN (
      SELECT id FROM public.assets
      WHERE community_id = (SELECT public.get_current_community_id())
      AND deleted_at IS NULL
    )
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager', 'staff')
  )
  WITH CHECK (
    NOT is_super_admin()
    AND asset_id IN (
      SELECT id FROM public.assets
      WHERE community_id = (SELECT public.get_current_community_id())
      AND deleted_at IS NULL
    )
    AND (SELECT public.get_current_user_role()) IN ('admin', 'manager', 'staff')
  );
