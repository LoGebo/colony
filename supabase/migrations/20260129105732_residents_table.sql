-- Enable extensions needed for search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Residents table: user profiles linked 1:1 to auth.users
CREATE TABLE residents (
  -- Links 1:1 with auth.users
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Name (Mexican format: first + paternal + maternal)
  first_name TEXT NOT NULL,
  middle_name TEXT,
  paternal_surname TEXT NOT NULL,
  maternal_surname TEXT,

  -- Contact
  email TEXT NOT NULL,
  phone phone_number,
  phone_secondary phone_number,

  -- Profile
  photo_url TEXT,
  date_of_birth DATE,
  gender TEXT,

  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone phone_number,
  emergency_contact_relationship TEXT,

  -- KYC Verification
  kyc_status approval_status NOT NULL DEFAULT 'pending',
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by UUID REFERENCES auth.users(id),

  -- INE (Mexican voter ID) verification fields
  ine_number TEXT,                      -- Clave de Elector
  ine_ocr TEXT,                         -- OCR code
  ine_cic TEXT,                         -- CIC code
  ine_verified BOOLEAN DEFAULT false,
  curp TEXT,                            -- Mexican national ID

  -- Document URLs (in Supabase Storage)
  ine_front_url TEXT,
  ine_back_url TEXT,
  proof_of_address_url TEXT,

  -- Onboarding workflow
  onboarding_status onboarding_status NOT NULL DEFAULT 'invited',
  invited_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,

  -- App settings (user-editable preferences)
  notification_preferences JSONB DEFAULT '{
    "push": true,
    "email": true,
    "sms": false
  }'::JSONB,
  locale locale_code DEFAULT 'es-MX',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Search optimization: generated column for full name
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(first_name || ' ' || COALESCE(middle_name || ' ', '') ||
         paternal_surname || ' ' || COALESCE(maternal_surname, ''))
  ) STORED
);

-- Enable RLS
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_residents_audit
  BEFORE INSERT OR UPDATE ON residents
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_residents_community ON residents(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_residents_onboarding ON residents(community_id, onboarding_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_residents_email ON residents(email) WHERE deleted_at IS NULL;

-- Full-text search index with accent insensitivity (will work once data exists)
-- Note: Index creation may warn if no data, that's OK
CREATE INDEX idx_residents_full_name_search ON residents
  USING gin(full_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- RLS Policies

-- Super admins full access
CREATE POLICY "super_admins_full_access_residents"
  ON residents
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can view residents in their community
CREATE POLICY "users_view_own_community_residents"
  ON residents
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Users can update their own profile
CREATE POLICY "users_update_own_profile"
  ON residents
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (id = auth.uid() AND deleted_at IS NULL);

-- Admins can manage all residents in their community
CREATE POLICY "admins_manage_residents"
  ON residents
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

-- Comments
COMMENT ON TABLE residents IS 'User profiles linked 1:1 with auth.users, containing CRM data';
COMMENT ON COLUMN residents.full_name IS 'Generated column for search: first + middle + paternal + maternal';
COMMENT ON COLUMN residents.onboarding_status IS 'Workflow: invited -> registered -> verified -> active';
