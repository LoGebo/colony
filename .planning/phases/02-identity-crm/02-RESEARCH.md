# Phase 2: Identity & CRM - Research

**Researched:** 2026-01-29
**Domain:** Supabase PostgreSQL multi-tenant CRM schema design
**Confidence:** HIGH

## Summary

This phase models the core entities that identify who lives in each community: units, residents, vehicles, and pets with their relationships. The research focused on seven key questions: (1) linking auth.users to residents profiles, (2) junction tables for unit-resident occupancy with multiple roles, (3) LPR-compatible vehicle fields, (4) vaccination records modeling, (5) onboarding workflow states, (6) document storage patterns, and (7) Mexican coefficient (indiviso) calculations.

The standard approach uses Supabase's recommended pattern of a separate `residents` table with a foreign key to `auth.users`, auto-populated via a trigger. The unit-resident relationship requires a junction table (`occupancies`) that includes the relationship type as part of the composite key to allow multiple roles per person. Vehicles need specific fields for LPR compatibility including normalized plate storage. Vaccination records should use a separate table (not JSONB) for proper querying and audit trails. Onboarding states should be a PostgreSQL ENUM with transition validation. Documents use Supabase Storage with RLS policies and folder-based organization by community/resident.

**Primary recommendation:** Build a normalized relational schema with strict foreign keys, ENUM-based status workflows, and separate tables for time-series data (vaccinations, incidents) while using JSONB only for truly unstructured metadata.

## Standard Stack

This phase is pure PostgreSQL/Supabase schema work with no additional libraries needed.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15+ | Database engine | Supabase default, full JSONB and RLS support |
| Supabase Auth | Latest | Authentication | Manages auth.users table, JWT tokens |
| Supabase Storage | Latest | Document/photo storage | S3-compatible with RLS policies |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| pg_trgm extension | Fuzzy text search | Resident name search, plate lookup |
| unaccent extension | Accent-insensitive search | Mexican names with accents |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB for vaccinations | Separate table | Table chosen: queryable, indexable, audit-friendly |
| Text for status | ENUM | ENUM chosen: type safety, smaller storage |
| Separate documents table | Storage only | Both used: metadata in table, files in Storage |

## Architecture Patterns

### Recommended Schema Structure

```
public/
  residents (profile linked to auth.users)
  units (properties within community)
  occupancies (junction: resident-unit relationships)
  vehicles (linked to residents)
  pets (linked to residents)
  pet_vaccinations (time-series vaccination records)
  pet_incidents (time-series incident history)
  resident_documents (metadata for Storage files)
```

### Pattern 1: auth.users to Residents Profile Link

**What:** One-to-one relationship where residents.id = auth.users.id
**When to use:** Always for user profile data
**Why:** Supabase manages auth.users; custom data goes in public schema

```sql
-- Source: Supabase official docs (https://supabase.com/docs/guides/auth/managing-user-data)
CREATE TABLE residents (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Profile fields
  first_name TEXT NOT NULL,
  paternal_surname TEXT NOT NULL,
  maternal_surname TEXT,
  -- ... other fields

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Auto-create resident profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.residents (id, community_id, first_name, paternal_surname)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data ->> 'community_id')::UUID,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'paternal_surname', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

**CRITICAL:** If trigger fails, signup fails. Keep trigger logic minimal and defensive.

### Pattern 2: Junction Table with Role as Part of Key

**What:** Allows same person to have multiple relationships to same unit
**When to use:** Occupancy relationships where someone can be both owner AND authorized
**Example:** Person owns unit A, is also authorized resident in unit B

```sql
-- Source: PostgreSQL best practices for many-to-many with attributes
CREATE TABLE occupancies (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,

  -- Role is part of the uniqueness constraint
  occupancy_type occupancy_type NOT NULL,

  -- Validity period
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Prevents duplicate role assignments
  CONSTRAINT occupancies_unique_role
    UNIQUE (unit_id, resident_id, occupancy_type)
);

-- Index for common queries
CREATE INDEX idx_occupancies_unit ON occupancies(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_occupancies_resident ON occupancies(resident_id) WHERE deleted_at IS NULL;
```

### Pattern 3: Onboarding State Machine with ENUM

**What:** ENUM-based states with valid transitions enforced in triggers
**When to use:** Controlled workflow progression

```sql
-- Onboarding states
CREATE TYPE onboarding_status AS ENUM (
  'invited',     -- Email/SMS invitation sent
  'registered',  -- Created account, pending verification
  'verified',    -- Identity verified (INE, etc.)
  'active',      -- Full access granted
  'suspended',   -- Temporarily blocked
  'inactive'     -- Left community or deactivated
);

-- Valid transitions (enforced by trigger)
-- invited -> registered (user creates account)
-- registered -> verified (KYC approved)
-- verified -> active (admin approves)
-- active -> suspended (admin action)
-- suspended -> active (admin reinstates)
-- any -> inactive (leaves community)

-- Add to residents table
ALTER TABLE residents ADD COLUMN onboarding_status onboarding_status NOT NULL DEFAULT 'invited';
```

### Pattern 4: Mexican Plate Storage for LPR

**What:** Store plates in normalized format for LPR matching
**When to use:** Any vehicle registration

```sql
-- Store both original and normalized versions
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  resident_id UUID NOT NULL REFERENCES residents(id),

  -- Original as entered by user (preserves formatting)
  plate_number TEXT NOT NULL,

  -- Normalized for LPR matching (uppercase, no hyphens/spaces)
  plate_normalized TEXT NOT NULL GENERATED ALWAYS AS (
    UPPER(REGEXP_REPLACE(plate_number, '[^A-Z0-9]', '', 'g'))
  ) STORED,

  -- State of registration (affects plate format)
  plate_state TEXT NOT NULL,

  -- Vehicle identification
  make TEXT,
  model TEXT,
  year INTEGER,
  color TEXT,

  -- LPR-specific fields
  vehicle_image_url TEXT,      -- Photo of vehicle
  plate_image_url TEXT,        -- Photo of plate for training
  lpr_confidence NUMERIC(5,4), -- Last LPR match confidence
  last_lpr_detection TIMESTAMPTZ,

  -- Access control
  sticker_number TEXT,
  sticker_issued_at TIMESTAMPTZ,
  access_enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Index for LPR lookups (most common query)
CREATE INDEX idx_vehicles_plate_normalized
  ON vehicles(plate_normalized, community_id)
  WHERE deleted_at IS NULL AND access_enabled = true;
```

### Pattern 5: Vaccination Records as Separate Table

**What:** Time-series vaccination data in its own table
**When to use:** Medical records, any data that accumulates over time
**Why not JSONB:** Queryable (find all pets with expired rabies), indexable, audit trail

```sql
CREATE TABLE pet_vaccinations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,

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
  created_by UUID REFERENCES auth.users(id)
);

-- Find pets with expired or expiring vaccinations
CREATE INDEX idx_pet_vaccinations_expiry
  ON pet_vaccinations(pet_id, vaccine_type, expires_at);
```

### Anti-Patterns to Avoid

- **Storing all vaccinations in JSONB array:** Cannot query across pets, no referential integrity, harder to audit
- **Putting phone/email in auth.users metadata only:** Loses RLS protection, harder to query
- **Using TEXT instead of ENUM for status fields:** No type safety, larger storage, inconsistent values
- **Not normalizing plate numbers:** LPR systems return uppercase with no formatting; matching fails
- **Single residents table without occupancies junction:** Cannot model someone who owns multiple units or has multiple roles

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User authentication | Custom auth tables | auth.users + profiles pattern | Supabase handles passwords, MFA, sessions |
| File storage | BYTEA columns or custom file server | Supabase Storage | CDN, transformations, RLS built-in |
| UUID generation | RANDOM() based | generate_uuid_v7() from Phase 1 | Time-ordered, better index performance |
| Soft deletes | Manual deleted_at logic | soft_delete() trigger from Phase 1 | Consistent across all tables |
| Audit timestamps | Application-level timestamps | set_audit_fields() trigger from Phase 1 | Database-enforced, can't be bypassed |
| Community isolation | WHERE clauses | RLS policies with get_current_community_id() | Can't accidentally leak data |

**Key insight:** Phase 1 built the foundation. Use those patterns consistently rather than creating alternative approaches.

## Common Pitfalls

### Pitfall 1: Trigger Failure Blocking Signups

**What goes wrong:** Profile creation trigger has a bug, all signups fail
**Why it happens:** Trigger runs inside the auth.users INSERT transaction
**How to avoid:**
- Keep trigger logic minimal (just copy essential fields)
- Use COALESCE for nullable fields
- Test thoroughly with edge cases (empty metadata, missing fields)
- Have a fallback: if resident doesn't exist, create on first app access
**Warning signs:** Auth signup returns 500 error, no user created

### Pitfall 2: Coefficient Not Summing to 100%

**What goes wrong:** Fee distribution is wrong because coefficients don't add up
**Why it happens:** Units added/removed without recalculating
**How to avoid:**
- Store coefficient as NUMERIC(7,4) allowing precise decimals (e.g., 2.3456%)
- Add database constraint or trigger that validates sum
- Consider storing both raw area and calculated coefficient
**Warning signs:** Total fees collected don't match budget

### Pitfall 3: LPR Matching Fails on Formatted Plates

**What goes wrong:** LPR detects "ABC123A" but database has "ABC-123-A"
**Why it happens:** User entered plate with formatting
**How to avoid:**
- Store normalized version (uppercase, alphanumeric only) as generated column
- Always query against normalized column
- Display original to users, search against normalized
**Warning signs:** Gate doesn't open for registered vehicles

### Pitfall 4: State Transition Violations

**What goes wrong:** Resident jumps from 'invited' to 'active' bypassing verification
**Why it happens:** Application bug or direct database edit
**How to avoid:**
- Add CHECK constraint or trigger enforcing valid transitions
- Log all state changes with timestamp and actor
- Require verification_completed_at before allowing 'verified' status
**Warning signs:** Users with 'active' status but no verification records

### Pitfall 5: Document Access Without Community Scoping

**What goes wrong:** User can view documents from other communities via Storage
**Why it happens:** Storage RLS policy doesn't check community membership
**How to avoid:**
- Folder structure: `{community_id}/{resident_id}/{document_type}/`
- RLS policy on storage.objects checks community via folder path
- Never use public buckets for sensitive documents
**Warning signs:** Audit shows cross-community document access

### Pitfall 6: Mexican Name Handling

**What goes wrong:** Search for "Garcia" doesn't find "Garcia" (accent)
**Why it happens:** PostgreSQL is accent-sensitive by default
**How to avoid:**
- Enable `unaccent` extension
- Create functional index: `CREATE INDEX idx_residents_name ON residents USING gin(unaccent(paternal_surname) gin_trgm_ops)`
- Search with: `WHERE unaccent(paternal_surname) ILIKE unaccent('%search%')`
**Warning signs:** Name searches return no results for common Mexican names

## Code Examples

### Complete Units Table

```sql
-- Source: Phase 1 patterns + Mexican property management requirements
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Identification
  unit_number TEXT NOT NULL,           -- "A-101", "Casa 5", etc.
  unit_type unit_type NOT NULL,        -- From Phase 1 enum

  -- Physical characteristics
  area_m2 NUMERIC(10,2),               -- Square meters
  floor_number INTEGER,                -- NULL for houses
  building TEXT,                       -- Building/tower name if applicable

  -- Coefficient for fee calculation (Mexican indiviso)
  -- Sum of all coefficients in a community should equal 100
  coefficient NUMERIC(7,4) NOT NULL DEFAULT 0,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Address details (for houses, may differ from community address)
  address_line TEXT,

  -- Parking spaces included (separate from estacionamiento unit type)
  parking_spaces INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique unit number within community
  CONSTRAINT units_community_number_unique
    UNIQUE (community_id, unit_number)
);

-- RLS Policy (following Phase 1 pattern)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_community_units"
  ON units
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

-- Trigger for audit
CREATE TRIGGER set_units_audit
  BEFORE INSERT OR UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();
```

### Complete Residents Table

```sql
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

  -- Search optimization
  full_name TEXT GENERATED ALWAYS AS (
    TRIM(first_name || ' ' || COALESCE(middle_name || ' ', '') ||
         paternal_surname || ' ' || COALESCE(maternal_surname, ''))
  ) STORED
);

-- Indexes
CREATE INDEX idx_residents_community ON residents(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_residents_onboarding ON residents(community_id, onboarding_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_residents_full_name_search ON residents
  USING gin(unaccent(full_name) gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_community_residents"
  ON residents
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "users_update_own_profile"
  ON residents
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (id = auth.uid() AND deleted_at IS NULL);
```

### Complete Pets Table

```sql
-- Pet species enum
CREATE TYPE pet_species AS ENUM (
  'dog',
  'cat',
  'bird',
  'fish',
  'reptile',
  'rodent',
  'other'
);

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

-- Pet incidents table (biting, noise complaints, etc.)
CREATE TABLE pet_incidents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id),

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
```

### Resident Documents Table

```sql
-- Document type enum
CREATE TYPE document_type AS ENUM (
  'ine_front',
  'ine_back',
  'proof_of_address',
  'lease_contract',
  'property_deed',
  'power_of_attorney',
  'vehicle_registration',
  'pet_vaccination',
  'other'
);

CREATE TABLE resident_documents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Document metadata
  document_type document_type NOT NULL,
  name TEXT NOT NULL,                  -- User-friendly name
  description TEXT,

  -- Storage reference
  -- Path format: {community_id}/{resident_id}/{document_type}/{filename}
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'resident-documents',

  -- File metadata
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- Validity
  issued_at DATE,
  expires_at DATE,

  -- Verification
  verification_status approval_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Prevent duplicate active documents of same type
  CONSTRAINT documents_unique_active_type
    UNIQUE (resident_id, document_type)
    WHERE deleted_at IS NULL AND verification_status != 'rejected'
);

-- Index for expiring documents
CREATE INDEX idx_documents_expiring
  ON resident_documents(expires_at, document_type)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;
```

### Supabase Storage RLS Policy for Documents

```sql
-- Create bucket (run via Supabase dashboard or migration)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resident-documents',
  'resident-documents',
  false,  -- Private bucket
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
);

-- RLS policy: Users can upload to their own folder
CREATE POLICY "users_upload_own_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[1] = (SELECT get_current_community_id())::TEXT
  AND (storage.foldername(name))[2] = auth.uid()::TEXT
);

-- RLS policy: Users can view their own documents
CREATE POLICY "users_view_own_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[2] = auth.uid()::TEXT
);

-- RLS policy: Admins can view all community documents
CREATE POLICY "admins_view_community_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[1] = (SELECT get_current_community_id())::TEXT
  AND (SELECT get_current_user_role()) IN ('admin', 'manager')
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| User data in auth.users metadata | Separate profiles table with trigger | Supabase best practice | Proper RLS, queryable, type-safe |
| Status as TEXT | Status as ENUM | PostgreSQL 9.1+ | Type safety, 4 bytes vs variable |
| Files in BYTEA columns | Supabase Storage with CDN | Modern approach | Streaming, transformations, RLS |
| Simple junction tables | Junction with role in key | Multi-role requirements | Same person, multiple relationships |
| Plate stored as-entered | Normalized + original columns | LPR adoption | Reliable automated matching |

**Deprecated/outdated:**
- Storing sensitive docs in public buckets: Use private buckets with RLS
- Single status column: Use separate onboarding_status for workflow, general_status for active/inactive
- Raw user_metadata for profile: Use server-controlled app_metadata for roles/community, public profiles table for user data

## Open Questions

### 1. Coefficient Recalculation Strategy

**What we know:** Mexican law requires coefficients based on unit area or value proportion
**What's unclear:** Should recalculation be automatic (trigger) or manual (admin action)?
**Recommendation:** Store both `area_m2` and `coefficient`. Provide admin function to recalculate, but don't auto-trigger (business decision). Add CHECK constraint that sum is within 99.9%-100.1% (allows rounding).

### 2. Historical Occupancy Tracking

**What we know:** Need to know current occupants AND historical (for financial records)
**What's unclear:** How far back to query, performance implications
**Recommendation:** Keep all occupancies (soft delete), use `status` and `end_date` for historical. Create view for "current occupants" that filters active + no end_date.

### 3. Multi-Community Residents

**What we know:** Some people may legitimately be in multiple communities (own property in two places)
**What's unclear:** Should residents.community_id be nullable, or multiple resident records per auth.users?
**Recommendation:** Multiple resident records (one per community). Add unique constraint on (id, community_id). User switches communities via app_metadata.community_id in JWT.

### 4. LPR System Integration

**What we know:** Need normalized plates, confidence scores, detection timestamps
**What's unclear:** Which LPR vendor will be used, exact API format
**Recommendation:** Design generic fields now. Add `lpr_metadata JSONB` for vendor-specific data discovered during integration.

## Sources

### Primary (HIGH confidence)
- [Supabase User Management Docs](https://supabase.com/docs/guides/auth/managing-user-data) - Profile table pattern, trigger example
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) - RLS policies, folder-based access
- [PostgreSQL ENUMs](https://www.postgresql.org/docs/current/datatype-enum.html) - Type safety, storage efficiency

### Secondary (MEDIUM confidence)
- [Mexican Condominium Law (LPCIDF Article 55)](https://idconline.mx/corporativo/2022/06/17/como-se-calcula-la-cuota-de-mantenimiento-y-que-pasa-si-no-la-pago) - Coefficient (indiviso) calculation requirements
- [Felix Geisendorfer - State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) - ENUM + aggregate pattern
- [Veriff INE Verification Guide](https://devdocs.veriff.com/docs/ine-institutio-nacional-electoral-database-verification-guide) - INE field requirements
- [Wikipedia - Mexican License Plates](https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_Mexico) - Plate format patterns

### Tertiary (LOW confidence)
- Mexican plate regex patterns - Derived from format documentation, not officially validated
- LPR confidence score ranges - Typical values from general LPR documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using only Supabase built-in features
- Architecture patterns: HIGH - Based on Supabase official docs and PostgreSQL best practices
- Pitfalls: HIGH - Common issues verified across multiple sources
- Mexican-specific (INE, plates, coefficients): MEDIUM - Verified with Mexican legal/official sources but may have state variations

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable domain, PostgreSQL patterns don't change frequently)
