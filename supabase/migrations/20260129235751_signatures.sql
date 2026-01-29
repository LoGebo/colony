-- ============================================
-- REGULATION SIGNATURES TABLE
-- ============================================
-- Legally-compliant digital signatures with ESIGN/UETA metadata
-- Phase 6: Documents & Notifications

-- ============================================
-- REGULATION SIGNATURES TABLE
-- ============================================
-- Immutable signature records with full audit trail

CREATE TABLE regulation_signatures (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Document being signed (specific version is critical for legal validity)
  document_id UUID NOT NULL REFERENCES documents(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),

  -- Signer identity
  resident_id UUID NOT NULL REFERENCES residents(id),
  unit_id UUID REFERENCES units(id),

  -- Signature representation
  signature_type TEXT NOT NULL DEFAULT 'click',  -- click, draw, type
  signature_data TEXT,  -- Base64 of drawn signature or typed name

  -- ESIGN/UETA Legal Compliance Metadata
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Network identity
  ip_address INET NOT NULL,
  user_agent TEXT NOT NULL,

  -- Device fingerprint
  device_type TEXT,              -- mobile, tablet, desktop
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  device_id TEXT,                -- App-generated unique ID
  device_model TEXT,             -- e.g., iPhone 14 Pro

  -- Location (if consent given)
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  location_accuracy_meters INTEGER,

  -- Consent tracking
  consent_text TEXT NOT NULL,    -- Exact text they agreed to
  consent_checkbox_id TEXT,      -- DOM element ID for audit

  -- Tamper detection (SHA-256 hash)
  signature_hash TEXT NOT NULL,

  -- Timestamp (NO deleted_at - signatures are permanent)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  -- NO updated_at - signatures are immutable
);

-- Enable RLS
ALTER TABLE regulation_signatures ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTION: COMPUTE SIGNATURE HASH
-- ============================================
-- Creates SHA-256 hash for tamper detection

CREATE OR REPLACE FUNCTION compute_signature_hash(
  p_document_checksum TEXT,
  p_resident_id UUID,
  p_signed_at TIMESTAMPTZ,
  p_ip_address INET
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    sha256(
      (COALESCE(p_document_checksum, '') || p_resident_id::TEXT || p_signed_at::TEXT || p_ip_address::TEXT)::BYTEA
    ),
    'hex'
  )
$$;

COMMENT ON FUNCTION compute_signature_hash IS
  'Computes SHA-256 hash from document checksum, resident ID, timestamp, and IP for tamper detection.';

-- ============================================
-- TRIGGER: SET SIGNATURE HASH ON INSERT
-- ============================================
-- Auto-compute signature hash from document checksum

CREATE OR REPLACE FUNCTION set_signature_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_checksum TEXT;
BEGIN
  -- Get document checksum from version being signed
  SELECT checksum INTO v_checksum
  FROM document_versions
  WHERE id = NEW.document_version_id;

  -- Compute and set signature hash
  NEW.signature_hash := compute_signature_hash(
    v_checksum,
    NEW.resident_id,
    NEW.signed_at,
    NEW.ip_address
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER signature_hash_trigger
  BEFORE INSERT ON regulation_signatures
  FOR EACH ROW
  EXECUTE FUNCTION set_signature_hash();

-- ============================================
-- TRIGGER: PREVENT SIGNATURE MODIFICATION
-- ============================================
-- Enforce immutability for legal compliance

CREATE OR REPLACE FUNCTION prevent_signature_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Regulation signatures cannot be modified or deleted. These are legally binding records.'
    USING HINT = 'Signature records are immutable for ESIGN/UETA compliance.';
END;
$$;

CREATE TRIGGER signature_immutable_trigger
  BEFORE UPDATE OR DELETE ON regulation_signatures
  FOR EACH ROW
  EXECUTE FUNCTION prevent_signature_modification();

-- ============================================
-- FUNCTION: VERIFY SIGNATURE HASH
-- ============================================
-- Recomputes hash to detect tampering

CREATE OR REPLACE FUNCTION verify_signature_hash(p_signature_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_sig RECORD;
  v_doc_checksum TEXT;
  v_expected_hash TEXT;
BEGIN
  -- Get signature record
  SELECT * INTO v_sig
  FROM regulation_signatures
  WHERE id = p_signature_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Get document checksum
  SELECT checksum INTO v_doc_checksum
  FROM document_versions
  WHERE id = v_sig.document_version_id;

  -- Recompute expected hash
  v_expected_hash := compute_signature_hash(
    v_doc_checksum,
    v_sig.resident_id,
    v_sig.signed_at,
    v_sig.ip_address
  );

  -- Compare with stored hash
  RETURN v_sig.signature_hash = v_expected_hash;
END;
$$;

COMMENT ON FUNCTION verify_signature_hash IS
  'Verifies signature integrity by recomputing hash. Returns true if signature has not been tampered with.';

-- ============================================
-- FUNCTION: CAPTURE SIGNATURE
-- ============================================
-- Validates and records a signature

CREATE OR REPLACE FUNCTION capture_signature(
  p_document_id UUID,
  p_document_version_id UUID,
  p_signature_type TEXT,
  p_signature_data TEXT,
  p_ip_address INET,
  p_user_agent TEXT,
  p_consent_text TEXT,
  p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_screen_resolution TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_device_model TEXT DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_location_accuracy_meters INTEGER DEFAULT NULL,
  p_consent_checkbox_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_doc RECORD;
  v_resident_id UUID;
  v_community_id UUID;
  v_unit_id UUID;
  v_signature_id UUID;
BEGIN
  -- Get document details
  SELECT d.*, dv.checksum
  INTO v_doc
  FROM documents d
  JOIN document_versions dv ON dv.id = p_document_version_id
  WHERE d.id = p_document_id
    AND d.deleted_at IS NULL
    AND d.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or inactive';
  END IF;

  -- Verify document requires signature
  IF v_doc.requires_signature = FALSE THEN
    RAISE EXCEPTION 'This document does not require a signature';
  END IF;

  -- Check signature deadline
  IF v_doc.signature_deadline IS NOT NULL AND v_doc.signature_deadline < CURRENT_DATE THEN
    RAISE EXCEPTION 'Signature deadline has passed (%)', v_doc.signature_deadline;
  END IF;

  -- Get resident ID (must be the current user)
  v_resident_id := auth.uid();
  IF v_resident_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to sign documents';
  END IF;

  -- Get community ID from JWT
  v_community_id := (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID;

  -- Verify resident is in the same community as document
  IF v_doc.community_id != v_community_id THEN
    RAISE EXCEPTION 'Cannot sign documents from other communities';
  END IF;

  -- Get primary unit for resident (optional)
  SELECT unit_id INTO v_unit_id
  FROM occupancies
  WHERE resident_id = v_resident_id
    AND deleted_at IS NULL
  ORDER BY
    CASE occupancy_type
      WHEN 'owner' THEN 1
      WHEN 'tenant' THEN 2
      ELSE 3
    END
  LIMIT 1;

  -- Check if already signed this version
  IF EXISTS (
    SELECT 1 FROM regulation_signatures
    WHERE document_version_id = p_document_version_id
      AND resident_id = v_resident_id
  ) THEN
    RAISE EXCEPTION 'You have already signed this version of the document';
  END IF;

  -- Insert signature record
  INSERT INTO regulation_signatures (
    community_id,
    document_id,
    document_version_id,
    resident_id,
    unit_id,
    signature_type,
    signature_data,
    ip_address,
    user_agent,
    device_type,
    browser,
    os,
    screen_resolution,
    device_id,
    device_model,
    latitude,
    longitude,
    location_accuracy_meters,
    consent_text,
    consent_checkbox_id
  )
  VALUES (
    v_community_id,
    p_document_id,
    p_document_version_id,
    v_resident_id,
    v_unit_id,
    p_signature_type,
    p_signature_data,
    p_ip_address,
    p_user_agent,
    p_device_type,
    p_browser,
    p_os,
    p_screen_resolution,
    p_device_id,
    p_device_model,
    p_latitude,
    p_longitude,
    p_location_accuracy_meters,
    p_consent_text,
    p_consent_checkbox_id
  )
  RETURNING id INTO v_signature_id;

  RETURN v_signature_id;
END;
$$;

COMMENT ON FUNCTION capture_signature IS
  'Validates and records a digital signature with full ESIGN/UETA compliance metadata.
   Validates: document requires signature, deadline not passed, not already signed.';

-- ============================================
-- FUNCTION: GET PENDING SIGNATURES
-- ============================================
-- Returns documents requiring signature that user has not signed

CREATE OR REPLACE FUNCTION get_pending_signatures(p_resident_id UUID)
RETURNS TABLE (
  document_id UUID,
  document_name TEXT,
  category document_category,
  current_version_id UUID,
  signature_deadline DATE,
  days_until_deadline INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_community_id UUID;
BEGIN
  -- Get community from JWT
  v_community_id := (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.category,
    d.current_version_id,
    d.signature_deadline,
    (d.signature_deadline - CURRENT_DATE)::INTEGER AS days_until_deadline
  FROM documents d
  WHERE d.community_id = v_community_id
    AND d.requires_signature = TRUE
    AND d.deleted_at IS NULL
    AND d.status = 'active'
    AND (d.signature_deadline IS NULL OR d.signature_deadline >= CURRENT_DATE)
    -- Has not signed current version
    AND NOT EXISTS (
      SELECT 1 FROM regulation_signatures rs
      WHERE rs.document_version_id = d.current_version_id
        AND rs.resident_id = p_resident_id
    )
  ORDER BY d.signature_deadline NULLS LAST, d.name;
END;
$$;

COMMENT ON FUNCTION get_pending_signatures IS
  'Returns documents requiring signature that the resident has not yet signed.';

-- ============================================
-- FUNCTION: GET DOCUMENT SIGNATURES
-- ============================================
-- Returns all signatures for a document (admin view)

CREATE OR REPLACE FUNCTION get_document_signatures(p_document_id UUID)
RETURNS TABLE (
  signature_id UUID,
  resident_id UUID,
  resident_name TEXT,
  unit_identifier TEXT,
  signature_type TEXT,
  signed_at TIMESTAMPTZ,
  ip_address INET,
  device_type TEXT,
  signature_verified BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rs.id,
    rs.resident_id,
    r.full_name,
    u.identifier,
    rs.signature_type,
    rs.signed_at,
    rs.ip_address,
    rs.device_type,
    verify_signature_hash(rs.id) AS signature_verified
  FROM regulation_signatures rs
  JOIN residents r ON r.id = rs.resident_id
  LEFT JOIN units u ON u.id = rs.unit_id
  WHERE rs.document_id = p_document_id
  ORDER BY rs.signed_at DESC;
END;
$$;

COMMENT ON FUNCTION get_document_signatures IS
  'Returns all signatures for a document with resident info and verification status. For admin dashboard.';

-- ============================================
-- INDEXES
-- ============================================

-- Who signed what version
CREATE INDEX idx_signatures_document_version
  ON regulation_signatures(document_id, document_version_id);

-- My signatures
CREATE INDEX idx_signatures_resident
  ON regulation_signatures(resident_id, signed_at DESC);

-- Audit queries by community
CREATE INDEX idx_signatures_community_signed
  ON regulation_signatures(community_id, signed_at DESC);

-- Unique constraint: one signature per resident per version
CREATE UNIQUE INDEX idx_signatures_unique_resident_version
  ON regulation_signatures(document_version_id, resident_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Super admins full access (read-only, cannot modify)
CREATE POLICY "super_admins_view_signatures"
  ON regulation_signatures
  FOR SELECT
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Residents can view their own signatures
CREATE POLICY "residents_view_own_signatures"
  ON regulation_signatures
  FOR SELECT
  TO authenticated
  USING (resident_id = auth.uid());

-- Admins can view all community signatures
CREATE POLICY "admins_view_community_signatures"
  ON regulation_signatures
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Insert via capture_signature function only (SECURITY DEFINER)
-- No direct INSERT policy - function handles validation

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE regulation_signatures IS
  'Legally-compliant digital signature records.
   IMMUTABLE: Cannot be modified or deleted (trigger-enforced).
   Captures full ESIGN/UETA metadata: timestamp, IP, device fingerprint, consent text.
   signature_hash enables tamper detection via verify_signature_hash().';

COMMENT ON COLUMN regulation_signatures.document_version_id IS
  'Specific version signed. Critical for legal validity - changes to document require re-signature.';

COMMENT ON COLUMN regulation_signatures.signature_hash IS
  'SHA-256 hash of (document_checksum + resident_id + signed_at + ip_address) for tamper detection.';

COMMENT ON COLUMN regulation_signatures.consent_text IS
  'Exact legal text the signer agreed to. Preserved verbatim for court admissibility.';

COMMENT ON COLUMN regulation_signatures.ip_address IS
  'Signers IP address at time of signing. INET type supports IPv4 and IPv6.';
