-- ============================================
-- ACCESS LOGS TABLE (IMMUTABLE)
-- ============================================
-- Tamper-proof audit trail of all access events
-- Part of Phase 3 Plan 02: Invitations & Access Management
--
-- CRITICAL: This table is APPEND-ONLY
-- - NO deleted_at column (logs are never deleted)
-- - NO updated_at column (logs are never updated)
-- - Triggers PREVENT UPDATE and DELETE operations
-- - Hash chain provides tamper detection

CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  access_point_id UUID NOT NULL REFERENCES access_points(id) ON DELETE RESTRICT,

  -- Who/what is accessing (denormalized for historical accuracy)
  person_type TEXT NOT NULL CHECK (person_type IN ('resident', 'visitor', 'guard', 'provider', 'vehicle_only')),
  person_id UUID,                          -- Reference to residents/guards/etc (may be null for unknown visitors)
  person_name TEXT NOT NULL,               -- Denormalized - name at time of access
  person_document TEXT,                    -- ID number shown at access

  -- Vehicle if applicable
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  plate_number TEXT,                       -- Plate as registered
  plate_detected TEXT,                     -- LPR detected plate (may differ)

  -- Authorization
  invitation_id UUID REFERENCES invitations(id) ON DELETE SET NULL,
  qr_code_id UUID,                         -- Will reference qr_codes (created in 03-04)

  -- Access details
  direction TEXT NOT NULL CHECK (direction IN ('entry', 'exit')),
  method TEXT NOT NULL CHECK (method IN ('qr_code', 'nfc_tag', 'lpr', 'facial', 'manual', 'intercom', 'remote', 'emergency')),
  decision access_decision NOT NULL,       -- allowed, denied, blocked (from Phase 1 enum)
  denial_reason TEXT,                      -- If denied/blocked, why

  -- Evidence
  photo_url TEXT,                          -- Person photo from camera
  photo_vehicle_url TEXT,                  -- Vehicle photo

  -- Guard who processed (if manual access)
  processed_by UUID REFERENCES guards(id) ON DELETE SET NULL,
  guard_notes TEXT,

  -- Timing (NOT using updated_at - this is immutable)
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Hash chain for tamper detection
  previous_hash TEXT,
  entry_hash TEXT GENERATED ALWAYS AS (
    encode(sha256(
      (id::TEXT || logged_at::TEXT || person_name || direction || decision::TEXT)::bytea
    ), 'hex')
  ) STORED

  -- NO deleted_at column - access logs are never deleted
  -- NO updated_at column - access logs are never updated
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE access_logs IS 'Immutable audit trail of all access events. UPDATE and DELETE are blocked by triggers.';
COMMENT ON COLUMN access_logs.person_name IS 'Denormalized name at time of access for historical accuracy';
COMMENT ON COLUMN access_logs.plate_detected IS 'LPR detected plate - may differ from registered plate_number';
COMMENT ON COLUMN access_logs.entry_hash IS 'SHA-256 hash of key fields for tamper detection';
COMMENT ON COLUMN access_logs.previous_hash IS 'Hash of previous entry for chain verification (optional)';
COMMENT ON COLUMN access_logs.logged_at IS 'Timestamp of access event. This is the primary time field (no updated_at).';

-- ============================================
-- IMMUTABILITY ENFORCEMENT
-- ============================================
-- CRITICAL: These triggers RAISE EXCEPTION on UPDATE/DELETE

CREATE OR REPLACE FUNCTION prevent_access_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'access_logs is append-only: % operations are not allowed', TG_OP;
END;
$$;

COMMENT ON FUNCTION prevent_access_log_modification IS 'Trigger function that prevents UPDATE and DELETE on access_logs table';

-- Block UPDATE operations
CREATE TRIGGER access_logs_immutable_update
  BEFORE UPDATE ON access_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_access_log_modification();

-- Block DELETE operations
CREATE TRIGGER access_logs_immutable_delete
  BEFORE DELETE ON access_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_access_log_modification();

-- ============================================
-- INDEXES
-- ============================================

-- BRIN index for timestamp queries (1000x smaller than B-tree for time-series)
-- pages_per_range=32 is optimal for typical access log insert rates
CREATE INDEX idx_access_logs_timestamp_brin
  ON access_logs USING BRIN (logged_at)
  WITH (pages_per_range = 32);

-- B-tree indexes for specific lookups
CREATE INDEX idx_access_logs_access_point ON access_logs(access_point_id, logged_at DESC);
CREATE INDEX idx_access_logs_person ON access_logs(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_access_logs_community_date ON access_logs(community_id, logged_at DESC);
CREATE INDEX idx_access_logs_invitation ON access_logs(invitation_id) WHERE invitation_id IS NOT NULL;
CREATE INDEX idx_access_logs_plate ON access_logs(plate_detected) WHERE plate_detected IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can see all logs and insert (still can't UPDATE/DELETE due to triggers)
CREATE POLICY "super_admin_all_access_logs" ON access_logs FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Users can view their community's access logs
CREATE POLICY "users_view_own_community_logs" ON access_logs FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

-- Guards and admins can insert new logs
CREATE POLICY "guards_insert_logs" ON access_logs FOR INSERT TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- Residents can see logs related to their visitors
CREATE POLICY "residents_view_visitor_logs" ON access_logs FOR SELECT TO authenticated
  USING (
    invitation_id IN (
      SELECT id FROM invitations WHERE created_by_resident_id = auth.uid()
    )
  );
