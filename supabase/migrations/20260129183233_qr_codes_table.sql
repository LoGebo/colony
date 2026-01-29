-- Migration: QR Codes Table with HMAC Signature Functions
-- Plan: 03-04 (Emergency Alerts & QR Codes)
-- Creates qr_codes table for visitor access with cryptographic verification

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Link to invitation or direct resident access
  invitation_id UUID REFERENCES invitations(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,

  -- Payload that gets encoded in QR (format: id|community_id|expiry_epoch|signature)
  payload TEXT NOT NULL,

  -- Cryptographic signature (HMAC-SHA256)
  signature TEXT NOT NULL,

  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,

  -- Status tracking
  status qr_status NOT NULL DEFAULT 'active',
  scanned_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES guards(id) ON DELETE SET NULL,
  scanned_at_access_point UUID REFERENCES access_points(id) ON DELETE SET NULL,

  -- Single-use tracking
  is_single_use BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- At least one of invitation_id or resident_id required
  CONSTRAINT qr_must_have_owner CHECK (
    invitation_id IS NOT NULL OR resident_id IS NOT NULL
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_qr_codes_community ON qr_codes(community_id);
CREATE INDEX idx_qr_codes_invitation ON qr_codes(invitation_id) WHERE status = 'active';
CREATE INDEX idx_qr_codes_resident ON qr_codes(resident_id) WHERE status = 'active';
CREATE INDEX idx_qr_codes_status ON qr_codes(community_id, status, valid_until);

-- ============================================
-- HMAC SIGNATURE FUNCTIONS
-- ============================================

-- Function to generate signed QR payload
-- IMPORTANT: secret_key should come from Supabase Vault or environment, never from regular tables
CREATE OR REPLACE FUNCTION generate_qr_payload(
  qr_id UUID,
  comm_id UUID,
  expires_at TIMESTAMPTZ,
  secret_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  data_to_sign TEXT;
  signature TEXT;
BEGIN
  -- Data format: id|community_id|expiry_epoch
  data_to_sign := qr_id::TEXT || '|' || comm_id::TEXT || '|' || EXTRACT(EPOCH FROM expires_at)::BIGINT::TEXT;

  -- HMAC-SHA256 signature (base64 encoded)
  signature := encode(
    hmac(data_to_sign::bytea, secret_key::bytea, 'sha256'),
    'base64'
  );

  -- Return payload with signature appended: id|community_id|expiry|signature
  RETURN data_to_sign || '|' || signature;
END;
$$;

-- Function to verify QR payload (used offline on guard devices via PowerSync)
CREATE OR REPLACE FUNCTION verify_qr_payload(
  payload TEXT,
  secret_key TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  qr_id UUID,
  community_id UUID,
  expires_at TIMESTAMPTZ,
  error_message TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parts TEXT[];
  data_to_verify TEXT;
  expected_sig TEXT;
  provided_sig TEXT;
  expiry_epoch BIGINT;
  v_qr_id UUID;
  v_community_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Parse payload: id|community_id|expiry|signature
  parts := string_to_array(payload, '|');

  IF array_length(parts, 1) != 4 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, 'Invalid payload format: expected 4 parts';
    RETURN;
  END IF;

  -- Extract components
  BEGIN
    v_qr_id := parts[1]::UUID;
    v_community_id := parts[2]::UUID;
    expiry_epoch := parts[3]::BIGINT;
    provided_sig := parts[4];
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, 'Invalid payload format: parse error';
    RETURN;
  END;

  -- Reconstruct data and compute expected signature
  data_to_verify := parts[1] || '|' || parts[2] || '|' || parts[3];
  expected_sig := encode(hmac(data_to_verify::bytea, secret_key::bytea, 'sha256'), 'base64');

  -- Verify signature (constant-time comparison would be better but not critical for this use case)
  IF expected_sig != provided_sig THEN
    RETURN QUERY SELECT FALSE, v_qr_id, v_community_id, NULL::TIMESTAMPTZ, 'Invalid signature';
    RETURN;
  END IF;

  -- Check expiry
  v_expires_at := to_timestamp(expiry_epoch);
  IF v_expires_at < now() THEN
    RETURN QUERY SELECT FALSE, v_qr_id, v_community_id, v_expires_at, 'QR code expired';
    RETURN;
  END IF;

  -- Valid!
  RETURN QUERY SELECT TRUE, v_qr_id, v_community_id, v_expires_at, NULL::TEXT;
END;
$$;

-- Function to burn (use) a single-use QR code
CREATE OR REPLACE FUNCTION burn_qr_code(
  p_qr_id UUID,
  p_guard_id UUID DEFAULT NULL,
  p_access_point_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_single_use BOOLEAN;
  v_status public.qr_status;
BEGIN
  -- Get QR code details
  SELECT is_single_use, status INTO v_is_single_use, v_status
  FROM public.qr_codes WHERE id = p_qr_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_status != 'active' THEN
    RETURN FALSE;
  END IF;

  -- Update QR code
  UPDATE public.qr_codes
  SET status = CASE WHEN v_is_single_use THEN 'used'::public.qr_status ELSE status END,
      scanned_at = now(),
      scanned_by = p_guard_id,
      scanned_at_access_point = p_access_point_id
  WHERE id = p_qr_id;

  RETURN TRUE;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_qr_codes" ON qr_codes FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Residents can view QR codes for their invitations
CREATE POLICY "residents_view_own_qr_codes" ON qr_codes FOR SELECT TO authenticated
  USING (
    resident_id = auth.uid()
    OR invitation_id IN (SELECT id FROM invitations WHERE created_by_resident_id = auth.uid())
  );

-- Guards can view active QR codes for validation
CREATE POLICY "guards_view_qr_codes" ON qr_codes FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager', 'guard')
  );

-- Admins can manage QR codes
CREATE POLICY "admins_manage_qr_codes" ON qr_codes FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- ============================================
-- FK FROM ACCESS_LOGS
-- ============================================
-- Add FK from access_logs to qr_codes (was forward reference in 03-02)

ALTER TABLE access_logs
  ADD CONSTRAINT access_logs_qr_code_fk
  FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE SET NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE qr_codes IS 'QR codes with HMAC-SHA256 signatures for offline verification';
COMMENT ON COLUMN qr_codes.payload IS 'Encoded payload format: qr_id|community_id|expiry_epoch|hmac_signature';
COMMENT ON FUNCTION generate_qr_payload IS 'Generates HMAC-signed QR payload. secret_key must come from Vault, not regular tables.';
COMMENT ON FUNCTION verify_qr_payload IS 'Verifies QR signature and expiry. Can run offline via PowerSync with cached key.';
COMMENT ON FUNCTION burn_qr_code IS 'Marks a single-use QR code as used after successful scan';
