-- Migration: Provider Documents, Personnel, and Access Schedules
-- Phase: 07-operations-compliance
-- Plan: 02 - Provider Management
-- Description: Document expiration tracking, authorized personnel, and time-based access control

-- ==================================================================
-- PROVIDER DOCUMENTS TABLE
-- ==================================================================
-- Insurance, licenses, certifications with GENERATED expiration columns

CREATE TABLE provider_documents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  -- Document type
  document_type TEXT NOT NULL CHECK (document_type IN (
    'insurance_liability',     -- General liability insurance
    'insurance_workers_comp',  -- Workers compensation
    'business_license',        -- Business operating license
    'tax_registration',        -- Tax registration (RFC)
    'certification',           -- Professional certifications
    'contract',                -- Service contract
    'background_check',        -- Background check results
    'other'
  )),

  -- Document details
  document_name TEXT NOT NULL,
  document_number TEXT,        -- Policy number, license number, etc.
  issuing_authority TEXT,      -- Who issued the document

  -- File reference (Supabase Storage)
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,

  -- Validity period
  issued_at DATE,
  expires_at DATE,

  -- GENERATED expiration columns (computed, always current)
  is_expired BOOLEAN GENERATED ALWAYS AS (
    expires_at IS NOT NULL AND expires_at < CURRENT_DATE
  ) STORED,
  days_until_expiry INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN expires_at IS NULL THEN NULL
      ELSE expires_at - CURRENT_DATE
    END
  ) STORED,

  -- Verification workflow
  status document_status NOT NULL DEFAULT 'pending_verification',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,

  -- Expiry alert tracking (prevents duplicate alerts)
  expiry_alert_sent_30d BOOLEAN NOT NULL DEFAULT false,
  expiry_alert_sent_14d BOOLEAN NOT NULL DEFAULT false,
  expiry_alert_sent_7d BOOLEAN NOT NULL DEFAULT false,

  -- Audit columns (no soft delete - documents are permanent record)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Verification consistency: both NULL or both NOT NULL
  CONSTRAINT chk_verification_consistency CHECK (
    (verified_at IS NULL AND verified_by IS NULL) OR
    (verified_at IS NOT NULL AND verified_by IS NOT NULL)
  ),

  -- Rejection requires reason
  CONSTRAINT chk_rejection_requires_reason CHECK (
    status != 'rejected' OR rejection_reason IS NOT NULL
  )
);

-- ==================================================================
-- PROVIDER DOCUMENTS INDEXES
-- ==================================================================

-- Documents expiring soon (for alert queries)
CREATE INDEX idx_provider_docs_expiring
  ON provider_documents(expires_at, status)
  WHERE expires_at IS NOT NULL
    AND status = 'verified'
    AND expires_at > CURRENT_DATE;

-- Documents by provider
CREATE INDEX idx_provider_docs_provider
  ON provider_documents(provider_id, document_type);

-- Community's pending verifications
CREATE INDEX idx_provider_docs_pending
  ON provider_documents(community_id, status)
  WHERE status = 'pending_verification';

-- ==================================================================
-- PROVIDER DOCUMENTS EXPIRING VIEW
-- ==================================================================
-- Documents requiring attention within 30 days

CREATE VIEW provider_documents_expiring AS
SELECT
  pd.id,
  pd.community_id,
  pd.provider_id,
  pd.document_type,
  pd.document_name,
  pd.document_number,
  pd.expires_at,
  pd.is_expired,
  pd.days_until_expiry,
  pd.status,
  pd.expiry_alert_sent_30d,
  pd.expiry_alert_sent_14d,
  pd.expiry_alert_sent_7d,
  p.company_name,
  p.contact_email,
  p.contact_phone,
  CASE
    WHEN pd.days_until_expiry <= 0 THEN 'expired'
    WHEN pd.days_until_expiry <= 7 THEN 'critical'
    WHEN pd.days_until_expiry <= 14 THEN 'warning'
    WHEN pd.days_until_expiry <= 30 THEN 'upcoming'
    ELSE 'ok'
  END AS urgency_level
FROM provider_documents pd
JOIN providers p ON p.id = pd.provider_id AND p.deleted_at IS NULL
WHERE pd.status = 'verified'
  AND pd.expires_at IS NOT NULL
  AND pd.expires_at <= CURRENT_DATE + 30
ORDER BY pd.expires_at;

COMMENT ON VIEW provider_documents_expiring IS
  'Documents expiring within 30 days with urgency levels:
   expired (<=0 days), critical (<=7), warning (<=14), upcoming (<=30)';

-- ==================================================================
-- PROVIDER PERSONNEL TABLE
-- ==================================================================
-- Authorized employees who can enter the community

CREATE TABLE provider_personnel (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  -- Personal information (Mexican format)
  first_name TEXT NOT NULL,
  paternal_surname TEXT NOT NULL,
  maternal_surname TEXT,

  -- Full name generated for convenience
  full_name TEXT GENERATED ALWAYS AS (
    first_name || ' ' || paternal_surname ||
    COALESCE(' ' || maternal_surname, '')
  ) STORED,

  -- Identification
  ine_number TEXT,   -- Mexican voter ID (INE)
  photo_url TEXT,    -- Photo for visual verification

  -- Contact
  phone phone_number,

  -- Authorization period
  is_authorized BOOLEAN NOT NULL DEFAULT true,
  authorized_from DATE,
  authorized_until DATE,

  -- Access restrictions (NULL = all access points allowed)
  allowed_access_points UUID[],  -- Array of access_point IDs

  -- Notes
  notes TEXT,

  -- Standard audit columns with soft delete
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Authorization date range validity
  CONSTRAINT chk_authorization_dates CHECK (
    authorized_from IS NULL OR authorized_until IS NULL
    OR authorized_from <= authorized_until
  )
);

-- ==================================================================
-- PROVIDER PERSONNEL INDEXES
-- ==================================================================

-- Authorized personnel by provider
CREATE INDEX idx_provider_personnel_provider
  ON provider_personnel(provider_id)
  WHERE is_authorized = true AND deleted_at IS NULL;

-- Personnel by community for guard lookups
CREATE INDEX idx_provider_personnel_community
  ON provider_personnel(community_id)
  WHERE is_authorized = true AND deleted_at IS NULL;

-- ==================================================================
-- PROVIDER ACCESS SCHEDULES TABLE
-- ==================================================================
-- Time-based access restrictions for providers

CREATE TABLE provider_access_schedules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  -- Schedule identification
  name TEXT NOT NULL,  -- e.g., "Regular Hours", "Emergency Access"

  -- Allowed days (0=Sunday, 6=Saturday)
  allowed_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],  -- Mon-Fri default

  -- Time windows
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '18:00',

  -- Validity period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,  -- NULL = ongoing/indefinite

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit columns (no soft delete - schedules are permanent record)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Time range validity
  CONSTRAINT chk_time_range CHECK (start_time < end_time),

  -- Date range validity
  CONSTRAINT chk_date_range CHECK (
    effective_until IS NULL OR effective_from <= effective_until
  ),

  -- Days must be valid (0-6)
  CONSTRAINT chk_valid_days CHECK (
    allowed_days <@ ARRAY[0,1,2,3,4,5,6]
  )
);

-- ==================================================================
-- PROVIDER ACCESS SCHEDULES INDEXES
-- ==================================================================

-- Active schedules by provider
CREATE INDEX idx_provider_access_schedules_provider
  ON provider_access_schedules(provider_id)
  WHERE is_active = true;

-- ==================================================================
-- ACCESS CHECK FUNCTION
-- ==================================================================
-- Check if provider access is allowed at a given time

CREATE OR REPLACE FUNCTION is_provider_access_allowed(
  p_provider_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_schedule RECORD;
  v_day_of_week INTEGER;
  v_time_of_day TIME;
  v_check_date DATE;
BEGIN
  -- Extract components from check time
  v_day_of_week := EXTRACT(DOW FROM p_check_time);  -- 0=Sunday, 6=Saturday
  v_time_of_day := p_check_time::TIME;
  v_check_date := p_check_time::DATE;

  -- Look for a matching active schedule
  SELECT * INTO v_schedule
  FROM provider_access_schedules
  WHERE provider_id = p_provider_id
    AND is_active = true
    AND effective_from <= v_check_date
    AND (effective_until IS NULL OR effective_until >= v_check_date)
    AND v_day_of_week = ANY(allowed_days)
    AND v_time_of_day >= start_time
    AND v_time_of_day <= end_time
  LIMIT 1;

  -- Return true if a matching schedule was found
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION is_provider_access_allowed IS
  'Checks if provider has an active access schedule matching the given time.
   Returns true if access is allowed, false otherwise.
   Usage: SELECT is_provider_access_allowed(provider_id, now());';

-- ==================================================================
-- ROW LEVEL SECURITY
-- ==================================================================

ALTER TABLE provider_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_access_schedules ENABLE ROW LEVEL SECURITY;

-- provider_documents policies
CREATE POLICY "super_admin_all_provider_docs"
  ON provider_documents FOR ALL TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

CREATE POLICY "admin_manager_provider_docs"
  ON provider_documents FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Providers can view their own documents
CREATE POLICY "provider_view_own_docs"
  ON provider_documents FOR SELECT TO authenticated
  USING (
    provider_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'provider_id')::UUID,
      '00000000-0000-0000-0000-000000000000'::UUID
    )
  );

-- provider_personnel policies
CREATE POLICY "super_admin_all_personnel"
  ON provider_personnel FOR ALL TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

CREATE POLICY "admin_manager_personnel"
  ON provider_personnel FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Guards can view authorized personnel
CREATE POLICY "guard_view_authorized_personnel"
  ON provider_personnel FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND is_authorized = true
    AND deleted_at IS NULL
    AND (SELECT get_current_user_role()) = 'guard'
  );

-- provider_access_schedules policies
CREATE POLICY "super_admin_all_schedules"
  ON provider_access_schedules FOR ALL TO authenticated
  USING ((SELECT is_super_admin()))
  WITH CHECK ((SELECT is_super_admin()));

CREATE POLICY "admin_manager_schedules"
  ON provider_access_schedules FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Guards can view active schedules
CREATE POLICY "guard_view_active_schedules"
  ON provider_access_schedules FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND is_active = true
    AND (SELECT get_current_user_role()) = 'guard'
  );

-- ==================================================================
-- TRIGGERS
-- ==================================================================

-- provider_documents triggers
CREATE TRIGGER set_provider_documents_audit
  BEFORE INSERT OR UPDATE ON provider_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- provider_personnel triggers
CREATE TRIGGER set_provider_personnel_audit
  BEFORE INSERT OR UPDATE ON provider_personnel
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

CREATE TRIGGER provider_personnel_soft_delete
  BEFORE DELETE ON provider_personnel
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- provider_access_schedules triggers
CREATE TRIGGER set_provider_access_schedules_audit
  BEFORE INSERT OR UPDATE ON provider_access_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ==================================================================
-- COMMENTS
-- ==================================================================

COMMENT ON TABLE provider_documents IS
  'Provider documents (insurance, licenses, certifications) with expiration tracking.
   GENERATED columns is_expired and days_until_expiry are always current.';

COMMENT ON COLUMN provider_documents.is_expired IS
  'GENERATED: true if expires_at is in the past';
COMMENT ON COLUMN provider_documents.days_until_expiry IS
  'GENERATED: days until expiration (negative if expired)';
COMMENT ON COLUMN provider_documents.expiry_alert_sent_30d IS
  'Tracks if 30-day expiration alert was sent (prevents duplicates)';

COMMENT ON TABLE provider_personnel IS
  'Authorized provider employees with photo ID and access restrictions.
   allowed_access_points NULL means all access points allowed.';

COMMENT ON COLUMN provider_personnel.ine_number IS
  'Mexican INE (Instituto Nacional Electoral) voter ID number';
COMMENT ON COLUMN provider_personnel.allowed_access_points IS
  'Array of access_point IDs. NULL = unrestricted access to all entry points.';

COMMENT ON TABLE provider_access_schedules IS
  'Time-based access restrictions for provider companies.
   Use is_provider_access_allowed() to check real-time access permission.';

COMMENT ON COLUMN provider_access_schedules.allowed_days IS
  'Days of week (0=Sunday, 6=Saturday). Default [1,2,3,4,5] = Mon-Fri.';
