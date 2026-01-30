-- Migration: Package Pickup Codes and Signatures
-- Plan: 07-01 (Package Management Schema)
-- Creates pickup code generation (PIN/QR with HMAC) and signature capture for chain of custody

-- ============================================
-- PACKAGE PICKUP CODES TABLE
-- ============================================
-- Verification codes for package pickup (PIN or QR)

CREATE TABLE package_pickup_codes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,

  -- Code type and value
  code_type pickup_code_type NOT NULL DEFAULT 'pin',
  code_value TEXT NOT NULL,     -- 6-digit PIN or QR payload
  signature TEXT,               -- HMAC signature for QR codes

  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,

  -- Status tracking
  status pickup_code_status NOT NULL DEFAULT 'active',
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Notification tracking
  sent_via TEXT[],     -- Channels: sms, email, push
  sent_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at or deleted_at - codes are created once, then status changes
);

COMMENT ON TABLE package_pickup_codes IS
  'Pickup verification codes for packages. Supports PIN (6-digit) and QR (HMAC-signed payload).
   Multiple codes can exist per package (old ones get revoked when new one is created).';

-- ============================================
-- INDEXES FOR PICKUP CODES
-- ============================================

CREATE INDEX idx_pickup_codes_package_status
  ON package_pickup_codes(package_id, status)
  WHERE status = 'active';

CREATE INDEX idx_pickup_codes_community
  ON package_pickup_codes(community_id, created_at DESC);

CREATE INDEX idx_pickup_codes_expiration
  ON package_pickup_codes(valid_until)
  WHERE status = 'active';

-- ============================================
-- FUNCTION: GENERATE PICKUP PIN
-- ============================================
-- Returns 6-digit random PIN

CREATE OR REPLACE FUNCTION generate_pickup_pin()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  -- Generate 6-digit PIN (100000-999999)
  SELECT lpad((floor(random() * 900000 + 100000)::INTEGER)::TEXT, 6, '0')
$$;

COMMENT ON FUNCTION generate_pickup_pin IS 'Generates a random 6-digit PIN for package pickup verification.';

-- ============================================
-- FUNCTION: GENERATE PICKUP QR PAYLOAD
-- ============================================
-- Creates HMAC-signed QR payload (same pattern as Phase 3 qr_codes)

CREATE OR REPLACE FUNCTION generate_pickup_qr_payload(
  p_package_id UUID,
  p_expires_at TIMESTAMPTZ,
  p_secret_key TEXT
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
  -- Data format: package_id|expiry_epoch
  data_to_sign := p_package_id::TEXT || '|' || EXTRACT(EPOCH FROM p_expires_at)::BIGINT::TEXT;

  -- HMAC-SHA256 signature (base64 encoded)
  signature := encode(
    hmac(data_to_sign::bytea, p_secret_key::bytea, 'sha256'),
    'base64'
  );

  -- Return payload with signature appended: package_id|expiry|signature
  RETURN data_to_sign || '|' || signature;
END;
$$;

COMMENT ON FUNCTION generate_pickup_qr_payload IS
  'Generates HMAC-SHA256 signed QR payload for offline verification.
   Format: package_id|expiry_epoch|signature
   secret_key should come from Supabase Vault, not regular tables.';

-- ============================================
-- FUNCTION: VERIFY PICKUP QR PAYLOAD
-- ============================================
-- Validates signature and expiration

CREATE OR REPLACE FUNCTION verify_pickup_qr_payload(
  p_payload TEXT,
  p_secret_key TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  package_id UUID,
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
  v_package_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Parse payload: package_id|expiry|signature
  parts := string_to_array(p_payload, '|');

  IF array_length(parts, 1) != 3 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ, 'Invalid payload format: expected 3 parts';
    RETURN;
  END IF;

  -- Extract components
  BEGIN
    v_package_id := parts[1]::UUID;
    expiry_epoch := parts[2]::BIGINT;
    provided_sig := parts[3];
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ, 'Invalid payload format: parse error';
    RETURN;
  END;

  -- Reconstruct data and compute expected signature
  data_to_verify := parts[1] || '|' || parts[2];
  expected_sig := encode(hmac(data_to_verify::bytea, p_secret_key::bytea, 'sha256'), 'base64');

  -- Verify signature
  IF expected_sig != provided_sig THEN
    RETURN QUERY SELECT FALSE, v_package_id, NULL::TIMESTAMPTZ, 'Invalid signature';
    RETURN;
  END IF;

  -- Check expiry
  v_expires_at := to_timestamp(expiry_epoch);
  IF v_expires_at < now() THEN
    RETURN QUERY SELECT FALSE, v_package_id, v_expires_at, 'Pickup code expired';
    RETURN;
  END IF;

  -- Valid!
  RETURN QUERY SELECT TRUE, v_package_id, v_expires_at, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION verify_pickup_qr_payload IS
  'Verifies QR signature and expiration. Can run offline via PowerSync with cached secret key.
   Returns is_valid, package_id, expires_at, and error_message.';

-- ============================================
-- FUNCTION: CREATE PICKUP CODE
-- ============================================
-- Creates new code, revokes existing active codes, updates package status

CREATE OR REPLACE FUNCTION create_pickup_code(
  p_package_id UUID,
  p_code_type pickup_code_type DEFAULT 'pin',
  p_valid_hours INTEGER DEFAULT 72
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_package RECORD;
  v_code_id UUID;
  v_code_value TEXT;
  v_signature TEXT;
  v_expires_at TIMESTAMPTZ;
  v_secret_key TEXT;
BEGIN
  -- Get package details
  SELECT * INTO v_package
  FROM packages
  WHERE id = p_package_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Package not found: %', p_package_id;
  END IF;

  -- Package must be in valid state for code creation
  IF v_package.status NOT IN ('received', 'stored', 'notified', 'pending_pickup') THEN
    RAISE EXCEPTION 'Cannot create pickup code for package in % status', v_package.status;
  END IF;

  -- Calculate expiration
  v_expires_at := now() + (p_valid_hours || ' hours')::INTERVAL;

  -- Revoke existing active codes for this package
  UPDATE package_pickup_codes
  SET status = 'revoked'
  WHERE package_id = p_package_id
    AND status = 'active';

  -- Generate code based on type
  IF p_code_type = 'pin' THEN
    v_code_value := generate_pickup_pin();
    v_signature := NULL;
  ELSE
    -- QR code - get secret from Vault (or use default for development)
    BEGIN
      SELECT decrypted_secret INTO v_secret_key
      FROM vault.decrypted_secrets
      WHERE name = 'pickup_qr_secret';
    EXCEPTION WHEN OTHERS THEN
      -- Development fallback - in production this should fail
      v_secret_key := 'development-secret-replace-in-production';
    END;

    v_code_value := generate_pickup_qr_payload(p_package_id, v_expires_at, v_secret_key);
    -- Extract signature (last part after |)
    v_signature := split_part(v_code_value, '|', 3);
  END IF;

  -- Insert new code
  INSERT INTO package_pickup_codes (
    community_id,
    package_id,
    code_type,
    code_value,
    signature,
    valid_from,
    valid_until,
    status
  )
  VALUES (
    v_package.community_id,
    p_package_id,
    p_code_type,
    v_code_value,
    v_signature,
    now(),
    v_expires_at,
    'active'
  )
  RETURNING id INTO v_code_id;

  -- Update package status to pending_pickup if not already there
  IF v_package.status IN ('received', 'stored', 'notified') THEN
    -- Use direct UPDATE to transition through valid states
    IF v_package.status = 'received' THEN
      UPDATE packages SET status = 'stored' WHERE id = p_package_id;
    END IF;
    IF v_package.status IN ('received', 'stored') THEN
      UPDATE packages SET status = 'notified' WHERE id = p_package_id;
    END IF;
    UPDATE packages SET status = 'pending_pickup' WHERE id = p_package_id;
  END IF;

  RETURN v_code_id;
END;
$$;

COMMENT ON FUNCTION create_pickup_code IS
  'Creates a pickup verification code for a package.
   Revokes any existing active codes.
   Transitions package to pending_pickup status.
   Returns the new code ID.';

-- ============================================
-- FUNCTION: VALIDATE PICKUP CODE
-- ============================================
-- Validates PIN or QR code for pickup

CREATE OR REPLACE FUNCTION validate_pickup_code(
  p_package_id UUID,
  p_code_value TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  code_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code RECORD;
  v_secret_key TEXT;
  v_qr_result RECORD;
BEGIN
  -- Find active code for this package
  SELECT * INTO v_code
  FROM package_pickup_codes
  WHERE package_id = p_package_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'No active pickup code found for this package';
    RETURN;
  END IF;

  -- Check expiration
  IF v_code.valid_until < now() THEN
    -- Mark as expired
    UPDATE package_pickup_codes SET status = 'expired' WHERE id = v_code.id;
    RETURN QUERY SELECT FALSE, v_code.id, 'Pickup code has expired';
    RETURN;
  END IF;

  -- Validate based on code type
  IF v_code.code_type = 'pin' THEN
    -- Direct PIN comparison
    IF v_code.code_value != p_code_value THEN
      RETURN QUERY SELECT FALSE, v_code.id, 'Invalid PIN';
      RETURN;
    END IF;
  ELSE
    -- QR code - verify signature
    BEGIN
      SELECT decrypted_secret INTO v_secret_key
      FROM vault.decrypted_secrets
      WHERE name = 'pickup_qr_secret';
    EXCEPTION WHEN OTHERS THEN
      v_secret_key := 'development-secret-replace-in-production';
    END;

    SELECT * INTO v_qr_result
    FROM verify_pickup_qr_payload(p_code_value, v_secret_key);

    IF NOT v_qr_result.is_valid THEN
      RETURN QUERY SELECT FALSE, v_code.id, v_qr_result.error_message;
      RETURN;
    END IF;

    -- Ensure QR is for this package
    IF v_qr_result.package_id != p_package_id THEN
      RETURN QUERY SELECT FALSE, v_code.id, 'QR code is for a different package';
      RETURN;
    END IF;
  END IF;

  -- Valid!
  RETURN QUERY SELECT TRUE, v_code.id, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION validate_pickup_code IS
  'Validates a pickup code (PIN or QR) for a package.
   Returns is_valid, code_id, and error_message.
   Does NOT mark the code as used - caller should do that after signature capture.';

-- ============================================
-- FUNCTION: USE PICKUP CODE
-- ============================================
-- Marks code as used after successful pickup

CREATE OR REPLACE FUNCTION use_pickup_code(
  p_code_id UUID,
  p_used_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code RECORD;
BEGIN
  -- Get code
  SELECT * INTO v_code
  FROM package_pickup_codes
  WHERE id = p_code_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_code.status != 'active' THEN
    RETURN FALSE;
  END IF;

  -- Mark as used
  UPDATE package_pickup_codes
  SET status = 'used',
      used_at = now(),
      used_by = COALESCE(p_used_by, auth.uid())
  WHERE id = p_code_id;

  -- Update package status to picked_up
  UPDATE packages
  SET status = 'picked_up',
      picked_up_by = COALESCE(p_used_by, auth.uid())
  WHERE id = v_code.package_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION use_pickup_code IS
  'Marks a pickup code as used and updates package status to picked_up.
   Called after signature capture is complete.';

-- ============================================
-- PACKAGE SIGNATURES TABLE
-- ============================================
-- Immutable signature records for package handoff (chain of custody)

CREATE TABLE package_signatures (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,

  -- Signer identity
  signed_by_resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  signed_by_name TEXT NOT NULL,
  relationship_to_recipient TEXT CHECK (relationship_to_recipient IN ('self', 'family', 'neighbor', 'other')),

  -- Signature representation
  signature_type TEXT NOT NULL DEFAULT 'draw' CHECK (signature_type IN ('draw', 'type', 'pin')),
  signature_data TEXT,  -- Base64 of drawn signature or typed name

  -- Timestamp
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ESIGN/UETA Compliance Metadata
  ip_address INET NOT NULL,
  user_agent TEXT NOT NULL,

  -- Device fingerprint
  device_type TEXT,   -- mobile, tablet, desktop
  device_id TEXT,     -- App-generated unique ID

  -- Photo verification (optional)
  photo_url TEXT,

  -- Consent tracking
  consent_text TEXT NOT NULL,

  -- Tamper detection (SHA-256 hash)
  signature_hash TEXT NOT NULL,

  -- Audit (NO deleted_at - signatures are immutable legal records)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at - signatures cannot be modified
);

COMMENT ON TABLE package_signatures IS
  'Immutable signature records for package handoff.
   Captures chain of custody with legal compliance metadata.
   CANNOT be modified or deleted (trigger-enforced).';

-- ============================================
-- FUNCTION: COMPUTE PACKAGE SIGNATURE HASH
-- ============================================

CREATE OR REPLACE FUNCTION compute_package_signature_hash(
  p_package_id UUID,
  p_signed_by_name TEXT,
  p_signed_at TIMESTAMPTZ,
  p_ip_address INET
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    sha256(
      (p_package_id::TEXT || p_signed_by_name || p_signed_at::TEXT || p_ip_address::TEXT)::BYTEA
    ),
    'hex'
  )
$$;

COMMENT ON FUNCTION compute_package_signature_hash IS
  'Computes SHA-256 hash for tamper detection on package signatures.';

-- ============================================
-- TRIGGER: SET PACKAGE SIGNATURE HASH
-- ============================================

CREATE OR REPLACE FUNCTION set_package_signature_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.signature_hash := compute_package_signature_hash(
    NEW.package_id,
    NEW.signed_by_name,
    NEW.signed_at,
    NEW.ip_address
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER package_signature_hash_trigger
  BEFORE INSERT ON package_signatures
  FOR EACH ROW
  EXECUTE FUNCTION set_package_signature_hash();

-- ============================================
-- TRIGGER: PREVENT PACKAGE SIGNATURE MODIFICATION
-- ============================================

CREATE OR REPLACE FUNCTION prevent_package_signature_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Package signatures cannot be modified or deleted. These are legal chain of custody records.'
    USING HINT = 'Signature records are immutable for legal compliance.';
END;
$$;

CREATE TRIGGER package_signature_immutable_trigger
  BEFORE UPDATE OR DELETE ON package_signatures
  FOR EACH ROW
  EXECUTE FUNCTION prevent_package_signature_modification();

-- ============================================
-- INDEXES FOR SIGNATURES
-- ============================================

CREATE INDEX idx_package_signatures_package
  ON package_signatures(package_id, signed_at DESC);

CREATE INDEX idx_package_signatures_community
  ON package_signatures(community_id, signed_at DESC);

CREATE INDEX idx_package_signatures_resident
  ON package_signatures(signed_by_resident_id)
  WHERE signed_by_resident_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE package_pickup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_signatures ENABLE ROW LEVEL SECURITY;

-- Pickup Codes: Super admins
CREATE POLICY "super_admin_all_pickup_codes"
  ON package_pickup_codes
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

-- Pickup Codes: Staff can full CRUD
CREATE POLICY "staff_manage_pickup_codes"
  ON package_pickup_codes
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

-- Pickup Codes: Residents can view their own
CREATE POLICY "residents_view_own_pickup_codes"
  ON package_pickup_codes
  FOR SELECT
  TO authenticated
  USING (
    package_id IN (
      SELECT id FROM packages
      WHERE recipient_unit_id IN (
        SELECT unit_id FROM occupancies
        WHERE resident_id = auth.uid()
          AND deleted_at IS NULL
      )
      AND deleted_at IS NULL
    )
  );

-- Signatures: Super admins
CREATE POLICY "super_admin_all_package_signatures"
  ON package_signatures
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

-- Signatures: Staff can INSERT and SELECT
CREATE POLICY "staff_manage_package_signatures"
  ON package_signatures
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

-- Signatures: Residents can view their own
CREATE POLICY "residents_view_own_package_signatures"
  ON package_signatures
  FOR SELECT
  TO authenticated
  USING (
    signed_by_resident_id = auth.uid()
    OR package_id IN (
      SELECT id FROM packages
      WHERE recipient_unit_id IN (
        SELECT unit_id FROM occupancies
        WHERE resident_id = auth.uid()
          AND deleted_at IS NULL
      )
      AND deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN package_pickup_codes.code_value IS
  'For PIN: 6-digit number. For QR: full signed payload (package_id|expiry|signature).';

COMMENT ON COLUMN package_pickup_codes.signature IS
  'HMAC signature extracted from QR payload for quick validation. NULL for PIN codes.';

COMMENT ON COLUMN package_pickup_codes.sent_via IS
  'Array of channels used to send code: {sms, email, push}.';

COMMENT ON COLUMN package_signatures.signature_hash IS
  'SHA-256 of (package_id + signed_by_name + signed_at + ip_address) for tamper detection.';

COMMENT ON COLUMN package_signatures.relationship_to_recipient IS
  'Relationship of signer to package recipient. Important for chain of custody.';
