-- Patrol routes table with ordered checkpoint sequences

CREATE TABLE patrol_routes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,                       -- "Night Perimeter", "Pool Area Check", "Main Building"
  description TEXT,

  -- Expected duration
  estimated_duration_minutes INTEGER,

  -- Checkpoint sequence (ordered array of checkpoint IDs)
  -- Guards should visit these checkpoints in this order
  checkpoint_sequence UUID[] NOT NULL,

  -- Schedule configuration
  frequency_minutes INTEGER,                 -- How often route should be patrolled (e.g., 60 = hourly)
  applicable_shifts UUID[],                  -- Which shifts patrol this route (FK to guard_shifts)

  status general_status NOT NULL DEFAULT 'active',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Route name unique per community
  CONSTRAINT patrol_routes_name_unique UNIQUE (community_id, name)
);

-- Indexes
CREATE INDEX idx_patrol_routes_community ON patrol_routes(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patrol_routes_active ON patrol_routes(community_id, status) WHERE deleted_at IS NULL AND status = 'active';

-- Audit trigger
CREATE TRIGGER patrol_routes_audit
  BEFORE INSERT OR UPDATE ON patrol_routes
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- RLS
ALTER TABLE patrol_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_routes" ON patrol_routes FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "users_view_own_community_routes" ON patrol_routes FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()) AND deleted_at IS NULL);

CREATE POLICY "admins_manage_routes" ON patrol_routes FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Function to validate checkpoint sequence (all checkpoints must exist and belong to same community)
CREATE OR REPLACE FUNCTION validate_patrol_route_checkpoints()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  checkpoint_count INTEGER;
  valid_count INTEGER;
BEGIN
  IF NEW.checkpoint_sequence IS NULL OR array_length(NEW.checkpoint_sequence, 1) = 0 THEN
    RAISE EXCEPTION 'Patrol route must have at least one checkpoint';
  END IF;

  checkpoint_count := array_length(NEW.checkpoint_sequence, 1);

  SELECT COUNT(*) INTO valid_count
  FROM patrol_checkpoints
  WHERE id = ANY(NEW.checkpoint_sequence)
    AND community_id = NEW.community_id
    AND deleted_at IS NULL;

  IF valid_count != checkpoint_count THEN
    RAISE EXCEPTION 'All checkpoints in route must exist and belong to the same community';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER patrol_routes_validate_checkpoints
  BEFORE INSERT OR UPDATE ON patrol_routes
  FOR EACH ROW
  EXECUTE FUNCTION validate_patrol_route_checkpoints();

COMMENT ON TABLE patrol_routes IS 'Defined patrol paths with ordered checkpoint sequences';
COMMENT ON COLUMN patrol_routes.checkpoint_sequence IS 'Ordered array of checkpoint IDs. Guards should visit in this order.';
COMMENT ON COLUMN patrol_routes.frequency_minutes IS 'How often this route should be patrolled. NULL means no automatic scheduling.';
