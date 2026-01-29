-- Patrol logging tables with progress tracking and GPS validation

-- Patrol sessions (one per guard per route attempt)
CREATE TABLE patrol_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Which patrol
  route_id UUID NOT NULL REFERENCES patrol_routes(id) ON DELETE RESTRICT,
  guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE RESTRICT,

  -- Patrol timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

  -- Completion stats (updated by trigger)
  checkpoints_total INTEGER NOT NULL,
  checkpoints_visited INTEGER NOT NULL DEFAULT 0,

  -- If abandoned
  abandon_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No deleted_at - patrol logs are audit records
);

-- Individual checkpoint scans within a patrol
CREATE TABLE patrol_checkpoint_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  patrol_log_id UUID NOT NULL REFERENCES patrol_logs(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES patrol_checkpoints(id) ON DELETE RESTRICT,

  -- Scan details
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nfc_serial_scanned TEXT NOT NULL,         -- What was actually scanned (verification against checkpoint.nfc_serial)

  -- GPS at time of scan
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  gps_accuracy_meters NUMERIC(6, 2),

  -- GPS validation result
  gps_within_tolerance BOOLEAN,

  -- Evidence
  photo_url TEXT,
  notes TEXT,

  -- Sequence position in the route
  sequence_order INTEGER NOT NULL,          -- 1, 2, 3... position in route

  -- Prevent duplicate scans of same checkpoint in same patrol
  CONSTRAINT checkpoint_scan_unique UNIQUE (patrol_log_id, checkpoint_id)
);

-- Indexes
CREATE INDEX idx_patrol_logs_community ON patrol_logs(community_id);
CREATE INDEX idx_patrol_logs_guard ON patrol_logs(guard_id, started_at DESC);
CREATE INDEX idx_patrol_logs_route ON patrol_logs(route_id, started_at DESC);
CREATE INDEX idx_patrol_logs_status ON patrol_logs(community_id, status) WHERE status = 'in_progress';

CREATE INDEX idx_patrol_checkpoint_logs_patrol ON patrol_checkpoint_logs(patrol_log_id);
CREATE INDEX idx_patrol_checkpoint_logs_checkpoint ON patrol_checkpoint_logs(checkpoint_id);

-- Audit trigger for patrol_logs only (checkpoint_logs are append-only)
CREATE TRIGGER patrol_logs_audit
  BEFORE INSERT OR UPDATE ON patrol_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Trigger to auto-update patrol progress when checkpoint is scanned
CREATE OR REPLACE FUNCTION update_patrol_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment visited count
  UPDATE patrol_logs
  SET checkpoints_visited = checkpoints_visited + 1,
      updated_at = now()
  WHERE id = NEW.patrol_log_id;

  -- Check if patrol is now complete
  UPDATE patrol_logs
  SET status = 'completed',
      completed_at = now()
  WHERE id = NEW.patrol_log_id
    AND checkpoints_visited >= checkpoints_total
    AND status = 'in_progress';

  RETURN NEW;
END;
$$;

CREATE TRIGGER patrol_checkpoint_logged
  AFTER INSERT ON patrol_checkpoint_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_patrol_progress();

-- Function to calculate GPS distance for validation
CREATE OR REPLACE FUNCTION calculate_gps_distance_meters(
  lat1 NUMERIC,
  lng1 NUMERIC,
  lat2 NUMERIC,
  lng2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  -- Haversine formula approximation (good enough for short distances)
  SELECT 6371000 * 2 * ASIN(
    SQRT(
      POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
      COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
      POWER(SIN(RADIANS(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- Trigger to auto-validate GPS within tolerance
CREATE OR REPLACE FUNCTION validate_checkpoint_gps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  checkpoint_lat NUMERIC;
  checkpoint_lng NUMERIC;
  tolerance INTEGER;
  distance NUMERIC;
BEGIN
  -- Get checkpoint location
  SELECT location_lat, location_lng, location_tolerance_meters
  INTO checkpoint_lat, checkpoint_lng, tolerance
  FROM patrol_checkpoints
  WHERE id = NEW.checkpoint_id;

  -- Calculate if GPS is provided and checkpoint has coordinates
  IF NEW.gps_lat IS NOT NULL AND NEW.gps_lng IS NOT NULL
     AND checkpoint_lat IS NOT NULL AND checkpoint_lng IS NOT NULL THEN
    distance := calculate_gps_distance_meters(checkpoint_lat, checkpoint_lng, NEW.gps_lat, NEW.gps_lng);
    NEW.gps_within_tolerance := distance <= COALESCE(tolerance, 50);
  ELSE
    NEW.gps_within_tolerance := NULL;  -- Cannot validate
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER patrol_checkpoint_validate_gps
  BEFORE INSERT ON patrol_checkpoint_logs
  FOR EACH ROW
  EXECUTE FUNCTION validate_checkpoint_gps();

-- RLS
ALTER TABLE patrol_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrol_checkpoint_logs ENABLE ROW LEVEL SECURITY;

-- Patrol logs RLS
CREATE POLICY "super_admin_all_patrol_logs" ON patrol_logs FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "users_view_own_community_patrol_logs" ON patrol_logs FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

CREATE POLICY "guards_manage_own_patrol_logs" ON patrol_logs FOR ALL TO authenticated
  USING (
    guard_id IN (SELECT id FROM guards WHERE user_id = auth.uid())
    OR (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    guard_id IN (SELECT id FROM guards WHERE user_id = auth.uid())
    OR (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Patrol checkpoint logs RLS (follows patrol_logs access)
CREATE POLICY "super_admin_all_checkpoint_logs" ON patrol_checkpoint_logs FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "users_view_checkpoint_logs" ON patrol_checkpoint_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM patrol_logs pl
    WHERE pl.id = patrol_checkpoint_logs.patrol_log_id
    AND pl.community_id = (SELECT get_current_community_id())
  ));

CREATE POLICY "guards_insert_checkpoint_logs" ON patrol_checkpoint_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM patrol_logs pl
    JOIN guards g ON g.id = pl.guard_id
    WHERE pl.id = patrol_checkpoint_logs.patrol_log_id
    AND (g.user_id = auth.uid() OR (SELECT get_current_user_role()) IN ('admin', 'manager'))
  ));

COMMENT ON TABLE patrol_logs IS 'Guard patrol sessions tracking route completion';
COMMENT ON TABLE patrol_checkpoint_logs IS 'Individual NFC checkpoint scans within a patrol';
COMMENT ON COLUMN patrol_checkpoint_logs.nfc_serial_scanned IS 'Actual NFC serial scanned by device - should match checkpoint.nfc_serial';
COMMENT ON COLUMN patrol_checkpoint_logs.gps_within_tolerance IS 'TRUE if guard GPS was within checkpoint tolerance at scan time';
