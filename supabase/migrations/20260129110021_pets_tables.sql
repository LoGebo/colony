-- Pets: registered pets with owner link
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Identification
  name TEXT NOT NULL,
  species pet_species NOT NULL,
  breed TEXT,
  color TEXT,

  -- Physical characteristics
  weight_kg NUMERIC(5,2),
  date_of_birth DATE,

  -- Registration
  microchip_number TEXT,
  registration_number TEXT,           -- Community-issued pet tag
  photo_url TEXT,

  -- Status
  status general_status NOT NULL DEFAULT 'active',
  is_service_animal BOOLEAN NOT NULL DEFAULT false,

  -- Notes
  special_needs TEXT,
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_pets_audit
  BEFORE INSERT OR UPDATE ON pets
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_pets_resident ON pets(resident_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pets_community ON pets(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pets_microchip ON pets(microchip_number)
  WHERE deleted_at IS NULL AND microchip_number IS NOT NULL;

-- Pet vaccinations: separate table for time-series vaccination records
CREATE TABLE pet_vaccinations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Vaccination details
  vaccine_type TEXT NOT NULL,        -- 'rabies', 'distemper', etc.
  vaccine_brand TEXT,
  batch_number TEXT,                 -- For recall tracking

  -- Dates
  administered_at DATE NOT NULL,
  expires_at DATE,

  -- Provider
  veterinarian_name TEXT,
  clinic_name TEXT,
  clinic_phone TEXT,

  -- Documentation
  certificate_url TEXT,              -- Link to Supabase Storage

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE pet_vaccinations ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_pet_vaccinations_audit
  BEFORE INSERT OR UPDATE ON pet_vaccinations
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_pet_vaccinations_pet ON pet_vaccinations(pet_id);
CREATE INDEX idx_pet_vaccinations_expiry
  ON pet_vaccinations(pet_id, vaccine_type, expires_at)
  WHERE expires_at IS NOT NULL;

-- Pet incidents: biting, noise complaints, etc.
CREATE TABLE pet_incidents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Incident details
  incident_type TEXT NOT NULL,        -- 'bite', 'noise', 'damage', 'escape'
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,

  -- Parties involved
  reported_by UUID REFERENCES residents(id),
  victim_resident_id UUID REFERENCES residents(id),
  victim_name TEXT,                   -- If not a resident

  -- Resolution
  resolution_status approval_status NOT NULL DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Documentation
  photo_urls TEXT[],                  -- Array of Storage URLs

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE pet_incidents ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_pet_incidents_audit
  BEFORE INSERT OR UPDATE ON pet_incidents
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_pet_incidents_pet ON pet_incidents(pet_id);
CREATE INDEX idx_pet_incidents_community ON pet_incidents(community_id);
CREATE INDEX idx_pet_incidents_status ON pet_incidents(community_id, resolution_status);

-- RLS Policies for pets

CREATE POLICY "super_admins_full_access_pets"
  ON pets FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

CREATE POLICY "users_view_own_community_pets"
  ON pets FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()) AND deleted_at IS NULL);

CREATE POLICY "users_manage_own_pets"
  ON pets FOR ALL TO authenticated
  USING (resident_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (resident_id = auth.uid());

CREATE POLICY "admins_manage_pets"
  ON pets FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- RLS Policies for pet_vaccinations

CREATE POLICY "super_admins_full_access_pet_vaccinations"
  ON pet_vaccinations FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

CREATE POLICY "users_view_own_community_vaccinations"
  ON pet_vaccinations FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

CREATE POLICY "users_manage_own_pet_vaccinations"
  ON pet_vaccinations FOR ALL TO authenticated
  USING (
    pet_id IN (SELECT id FROM pets WHERE resident_id = auth.uid())
  )
  WITH CHECK (
    pet_id IN (SELECT id FROM pets WHERE resident_id = auth.uid())
  );

CREATE POLICY "admins_manage_vaccinations"
  ON pet_vaccinations FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- RLS Policies for pet_incidents

CREATE POLICY "super_admins_full_access_pet_incidents"
  ON pet_incidents FOR ALL TO authenticated
  USING ((SELECT is_super_admin()));

CREATE POLICY "users_view_own_community_incidents"
  ON pet_incidents FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

CREATE POLICY "admins_manage_incidents"
  ON pet_incidents FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Allow residents to report incidents
CREATE POLICY "residents_create_incidents"
  ON pet_incidents FOR INSERT TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND reported_by = auth.uid()
  );

-- Comments
COMMENT ON TABLE pets IS 'Registered pets with owner link';
COMMENT ON TABLE pet_vaccinations IS 'Time-series vaccination records, separate from pets for queryability';
COMMENT ON TABLE pet_incidents IS 'Pet-related incidents with resolution workflow';
