# Phase 7: Operations & Compliance - Research

**Researched:** 2026-01-29
**Domain:** Package management, provider relationships, move coordination, comprehensive audit logging, and system configuration for Mexican residential communities
**Confidence:** HIGH

## Summary

This phase implements the operational support systems that complete the property management ecosystem: package tracking (digital mailroom), service provider credential management, move-in/move-out coordination, comprehensive audit logging, user session tracking, community configuration, feature flags, and role-based access control (RBAC). The research focused on eight key questions: (1) package tracking state machine, (2) pickup code generation (PIN/QR) with expiration, (3) provider credential management with expiration alerts, (4) move coordination checklist patterns, (5) PostgreSQL audit logging (triggers vs pgaudit), (6) session management with device fingerprinting, (7) feature flags (JSONB vs separate table), and (8) RBAC patterns for multi-tenant systems.

The standard approach uses ENUM-based state machines for package tracking (received -> stored -> notified -> picked_up), cryptographically signed pickup codes with short expiration windows, provider credential tables with expiration date tracking and computed alerts, move request workflows with pre-validation checklist patterns, trigger-based audit logging using the supa_audit pattern for critical tables (entity, action, actor, before/after stored as JSONB), session tracking tables with device fingerprint and IP logging, JSONB-based feature flags on the community settings table for flexibility, and a hybrid RBAC approach combining JWT claims with a permissions table for fine-grained control.

**Primary recommendation:** Use trigger-based auditing (supa_audit pattern) for application-level audit trails capturing before/after state as JSONB, with immutability enforced by database triggers. Implement pickup codes using HMAC-SHA256 signatures with short expiration (24-72 hours). Store provider credentials with explicit expires_at columns and computed is_expired flags. Use JSONB feature flags on community_settings for tenant-specific configuration without schema changes.

## Standard Stack

This phase continues PostgreSQL/Supabase schema patterns from previous phases.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15+ | Database with triggers, JSONB, computed columns | Supabase default, audit trail support |
| pgcrypto | Built-in | HMAC signatures for pickup codes | Cryptographic security, built into Supabase |
| Supabase Auth | Latest | JWT with custom claims for RBAC | app_metadata for roles/permissions |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| supa_audit pattern | Table-level audit logging | Critical tables requiring change history |
| pgAudit extension | Statement-level audit logging | Compliance/security auditing (optional) |
| BRIN indexes | Time-series audit log queries | Audit tables > 100K rows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Trigger-based auditing | pgAudit extension | Triggers chosen: captures before/after row data as JSONB; pgAudit only logs statements |
| JSONB feature flags | Separate feature_flags table | JSONB chosen: simpler queries, no joins, tenant-specific flexibility |
| HMAC-SHA256 pickup codes | Random 6-digit PIN | HMAC chosen: verifiable without database lookup when offline |
| Hybrid RBAC | Pure JWT claims | Hybrid chosen: JWT for common checks, table for fine-grained permissions |

## Architecture Patterns

### Recommended Schema Structure

```
public/
  -- Package Management (Digital Mailroom)
  packages (core package records with state machine)
  package_storage_locations (shelf, locker assignments)
  package_pickup_codes (PIN/QR with signatures and expiration)
  package_signatures (pickup signature capture)

  -- Provider Management
  providers (company profiles)
  provider_documents (insurance, certifications with expiration)
  provider_personnel (authorized employees)
  provider_access_schedules (allowed days/hours)
  provider_work_orders (linked to maintenance tickets)

  -- Move Coordination
  move_requests (move-in/out with status workflow)
  move_validations (checklist items: debt-free, keys, etc.)
  move_deposits (damage deposits with refund workflow)

  -- Audit & Security
  audit_log (comprehensive change tracking)
  user_sessions (device, IP, location tracking)
  security_events (blocked access, alerts, failures)

  -- Configuration
  community_settings (JSONB feature flags, branding, rules)
  roles (custom role definitions per community)
  permissions (granular permission assignments)
  role_permissions (role-to-permission mapping)
```

### Pattern 1: Package Tracking State Machine

**What:** ENUM-based package status with trigger-validated transitions
**When to use:** Digital mailroom package lifecycle tracking
**Why:** Clear audit trail, prevents invalid state transitions, supports pickup workflow

```sql
-- Source: Package locker systems (Quadient, SSG, Envoy) + Phase 6 state machine pattern
CREATE TYPE package_status AS ENUM (
  'received',        -- Package checked in by guard/staff
  'stored',          -- Assigned to storage location
  'notified',        -- Recipient notified with pickup code
  'pending_pickup',  -- Pickup code sent, awaiting recipient
  'picked_up',       -- Successfully retrieved by recipient
  'forwarded',       -- Forwarded to another address
  'returned',        -- Returned to sender
  'abandoned'        -- Exceeded retention period
);

CREATE TYPE package_carrier AS ENUM (
  'fedex',
  'dhl',
  'ups',
  'estafeta',
  'redpack',
  'mercado_libre',
  'amazon',
  'correos_mexico',
  'other'
);

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Carrier information
  carrier package_carrier NOT NULL,
  carrier_other TEXT,  -- If carrier = 'other'
  tracking_number TEXT,

  -- Recipient
  recipient_resident_id UUID REFERENCES residents(id),
  recipient_unit_id UUID NOT NULL REFERENCES units(id),
  recipient_name TEXT NOT NULL,  -- As shown on package

  -- Package details
  description TEXT,
  package_count INTEGER NOT NULL DEFAULT 1,
  is_oversized BOOLEAN NOT NULL DEFAULT false,
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  is_perishable BOOLEAN NOT NULL DEFAULT false,

  -- Photos
  photo_url TEXT,  -- Photo at intake
  label_photo_url TEXT,  -- Shipping label photo

  -- Storage
  storage_location_id UUID REFERENCES package_storage_locations(id),

  -- State machine
  status package_status NOT NULL DEFAULT 'received',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Timestamps for SLA tracking
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES auth.users(id),
  stored_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  picked_up_by UUID REFERENCES auth.users(id),

  -- Retention
  retention_days INTEGER NOT NULL DEFAULT 14,
  abandonment_date DATE GENERATED ALWAYS AS (
    (received_at::DATE + retention_days)
  ) STORED,

  -- Notes
  special_instructions TEXT,
  staff_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- State transition validation trigger
CREATE OR REPLACE FUNCTION validate_package_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transitions package_status[];
BEGIN
  -- Define valid transitions per current state
  CASE OLD.status
    WHEN 'received' THEN
      valid_transitions := ARRAY['stored', 'returned']::package_status[];
    WHEN 'stored' THEN
      valid_transitions := ARRAY['notified', 'returned']::package_status[];
    WHEN 'notified' THEN
      valid_transitions := ARRAY['pending_pickup', 'returned']::package_status[];
    WHEN 'pending_pickup' THEN
      valid_transitions := ARRAY['picked_up', 'abandoned', 'returned', 'forwarded']::package_status[];
    WHEN 'picked_up' THEN
      valid_transitions := ARRAY[]::package_status[];  -- Terminal
    WHEN 'forwarded' THEN
      valid_transitions := ARRAY[]::package_status[];  -- Terminal
    WHEN 'returned' THEN
      valid_transitions := ARRAY[]::package_status[];  -- Terminal
    WHEN 'abandoned' THEN
      valid_transitions := ARRAY['returned']::package_status[];
    ELSE
      valid_transitions := ARRAY[]::package_status[];
  END CASE;

  IF NEW.status != OLD.status AND NOT (NEW.status = ANY(valid_transitions)) THEN
    RAISE EXCEPTION 'Invalid package status transition from % to %', OLD.status, NEW.status;
  END IF;

  -- Track timestamps on transition
  IF NEW.status != OLD.status THEN
    NEW.status_changed_at := now();

    CASE NEW.status
      WHEN 'stored' THEN NEW.stored_at := now();
      WHEN 'notified' THEN NEW.notified_at := now();
      WHEN 'picked_up' THEN NEW.picked_up_at := now();
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER package_transition_trigger
  BEFORE UPDATE ON packages
  FOR EACH ROW
  EXECUTE FUNCTION validate_package_transition();

-- Storage locations
CREATE TABLE package_storage_locations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Location identification
  name TEXT NOT NULL,  -- "Shelf A-1", "Locker 5"
  location_type TEXT NOT NULL CHECK (location_type IN ('shelf', 'locker', 'floor', 'refrigerator')),

  -- Capacity
  max_packages INTEGER,
  current_count INTEGER NOT NULL DEFAULT 0,

  -- Physical location
  area TEXT,  -- "Mailroom", "Guard Booth"
  row_number TEXT,
  shelf_number TEXT,

  -- Status
  is_available BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT storage_unique_name UNIQUE (community_id, name)
);
```

### Pattern 2: Pickup Code Generation with HMAC Signature

**What:** Short-lived codes (PIN or QR) with cryptographic verification
**When to use:** Package pickup authentication
**Why:** Verifiable offline, prevents code reuse, audit trail

```sql
-- Source: Phase 3 QR code pattern + smart locker systems (SSG, Envoy)
CREATE TYPE pickup_code_type AS ENUM (
  'pin',     -- 6-digit numeric code
  'qr'       -- QR code with signed payload
);

CREATE TYPE pickup_code_status AS ENUM (
  'active',
  'used',
  'expired',
  'revoked'
);

CREATE TABLE package_pickup_codes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,

  -- Code details
  code_type pickup_code_type NOT NULL DEFAULT 'pin',
  code_value TEXT NOT NULL,  -- PIN digits or full QR payload

  -- For QR codes: cryptographic signature
  -- Payload format: {package_id}|{expires_epoch}|{signature}
  signature TEXT,

  -- Validity
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,

  -- Status
  status pickup_code_status NOT NULL DEFAULT 'active',

  -- Usage tracking
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),

  -- Delivery tracking
  sent_via TEXT[],  -- ['sms', 'email', 'push']
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to generate 6-digit PIN
CREATE OR REPLACE FUNCTION generate_pickup_pin()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate random 6-digit PIN (100000-999999)
  RETURN LPAD((100000 + floor(random() * 900000))::TEXT, 6, '0');
END;
$$;

-- Function to generate signed QR payload
CREATE OR REPLACE FUNCTION generate_pickup_qr_payload(
  p_package_id UUID,
  p_expires_at TIMESTAMPTZ,
  p_secret_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  data_to_sign TEXT;
  signature TEXT;
BEGIN
  data_to_sign := p_package_id::TEXT || '|' || EXTRACT(EPOCH FROM p_expires_at)::BIGINT;

  signature := encode(
    hmac(data_to_sign::bytea, p_secret_key::bytea, 'sha256'),
    'base64'
  );

  RETURN data_to_sign || '|' || signature;
END;
$$;

-- Function to verify QR payload
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
AS $$
DECLARE
  parts TEXT[];
  data_to_verify TEXT;
  expected_sig TEXT;
  provided_sig TEXT;
  expiry_epoch BIGINT;
BEGIN
  parts := string_to_array(p_payload, '|');

  IF array_length(parts, 1) != 3 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ, 'Invalid payload format';
    RETURN;
  END IF;

  package_id := parts[1]::UUID;
  expiry_epoch := parts[2]::BIGINT;
  provided_sig := parts[3];

  data_to_verify := parts[1] || '|' || parts[2];
  expected_sig := encode(hmac(data_to_verify::bytea, p_secret_key::bytea, 'sha256'), 'base64');

  IF expected_sig != provided_sig THEN
    RETURN QUERY SELECT FALSE, package_id, NULL::TIMESTAMPTZ, 'Invalid signature';
    RETURN;
  END IF;

  expires_at := to_timestamp(expiry_epoch);
  IF expires_at < now() THEN
    RETURN QUERY SELECT FALSE, package_id, expires_at, 'Code expired';
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, package_id, expires_at, NULL::TEXT;
END;
$$;

-- Function to create pickup code for a package
CREATE OR REPLACE FUNCTION create_pickup_code(
  p_package_id UUID,
  p_code_type pickup_code_type DEFAULT 'pin',
  p_valid_hours INTEGER DEFAULT 72
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_code_id UUID;
  v_community_id UUID;
  v_code_value TEXT;
  v_expires_at TIMESTAMPTZ;
  v_secret_key TEXT;
BEGIN
  -- Get community_id
  SELECT community_id INTO v_community_id FROM packages WHERE id = p_package_id;

  -- Revoke any existing active codes for this package
  UPDATE package_pickup_codes
  SET status = 'revoked'
  WHERE package_id = p_package_id AND status = 'active';

  v_expires_at := now() + (p_valid_hours || ' hours')::INTERVAL;

  IF p_code_type = 'pin' THEN
    v_code_value := generate_pickup_pin();
  ELSE
    -- Get secret key from community settings or Vault
    -- For now, using placeholder - should use Supabase Vault in production
    v_secret_key := 'community_secret_key_placeholder';
    v_code_value := generate_pickup_qr_payload(p_package_id, v_expires_at, v_secret_key);
  END IF;

  INSERT INTO package_pickup_codes (
    community_id, package_id, code_type, code_value, valid_until
  ) VALUES (
    v_community_id, p_package_id, p_code_type, v_code_value, v_expires_at
  ) RETURNING id INTO v_code_id;

  -- Update package status to pending_pickup
  UPDATE packages SET status = 'pending_pickup' WHERE id = p_package_id;

  RETURN v_code_id;
END;
$$;
```

### Pattern 3: Package Pickup Signature Capture

**What:** Digital signature with device/IP metadata for chain of custody
**When to use:** Package handoff verification
**Why:** Legal proof of delivery, dispute resolution

```sql
-- Source: Phase 6 regulation signatures pattern + delivery confirmation standards
CREATE TABLE package_signatures (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,

  -- Signer identification
  signed_by_resident_id UUID REFERENCES residents(id),
  signed_by_name TEXT NOT NULL,  -- Name as provided (may not be resident)
  relationship_to_recipient TEXT,  -- 'self', 'family', 'neighbor', 'other'

  -- Signature data
  signature_type TEXT NOT NULL DEFAULT 'draw' CHECK (signature_type IN ('draw', 'type', 'pin')),
  signature_data TEXT,  -- Base64 of drawn signature or typed name

  -- Legal metadata
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET NOT NULL,
  user_agent TEXT NOT NULL,
  device_type TEXT,
  device_id TEXT,

  -- Photo verification (optional)
  photo_url TEXT,  -- Photo of person picking up

  -- Consent
  consent_text TEXT NOT NULL,

  -- Immutable hash
  signature_hash TEXT NOT NULL,

  -- Cannot be modified
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent modifications
CREATE OR REPLACE FUNCTION prevent_signature_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Package signatures cannot be modified';
END;
$$;

CREATE TRIGGER package_signature_immutable
  BEFORE UPDATE OR DELETE ON package_signatures
  FOR EACH ROW
  EXECUTE FUNCTION prevent_signature_modification();
```

### Pattern 4: Provider Credential Management with Expiration Tracking

**What:** Provider companies with documents that have expiration dates and alert tracking
**When to use:** Managing third-party service providers (cleaning, landscaping, security)
**Why:** Compliance, insurance verification, access control

```sql
-- Source: Healthcare credentialing patterns + property management requirements
CREATE TYPE provider_status AS ENUM (
  'pending_approval',
  'active',
  'suspended',
  'inactive'
);

CREATE TYPE document_status AS ENUM (
  'pending_verification',
  'verified',
  'expired',
  'rejected'
);

CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Company identification
  company_name TEXT NOT NULL,
  legal_name TEXT,
  rfc TEXT,  -- Mexican tax ID

  -- Contact
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone phone_number NOT NULL,
  address TEXT,

  -- Services
  specialties TEXT[] NOT NULL,  -- ['plumbing', 'electrical', 'cleaning']

  -- Status
  status provider_status NOT NULL DEFAULT 'pending_approval',

  -- Rating (computed from work orders)
  average_rating NUMERIC(3,2),
  total_work_orders INTEGER NOT NULL DEFAULT 0,

  -- Approval
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Provider documents with expiration tracking
CREATE TABLE provider_documents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  -- Document type
  document_type TEXT NOT NULL CHECK (document_type IN (
    'insurance_liability',
    'insurance_workers_comp',
    'business_license',
    'tax_registration',
    'certification',
    'contract',
    'background_check',
    'other'
  )),

  -- Document details
  document_name TEXT NOT NULL,
  document_number TEXT,  -- Policy number, license number, etc.
  issuing_authority TEXT,

  -- File
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,

  -- Validity
  issued_at DATE,
  expires_at DATE,

  -- Computed expiration status
  is_expired BOOLEAN GENERATED ALWAYS AS (
    expires_at IS NOT NULL AND expires_at < CURRENT_DATE
  ) STORED,

  -- Days until expiration (for alerts)
  days_until_expiry INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN expires_at IS NULL THEN NULL
      ELSE expires_at - CURRENT_DATE
    END
  ) STORED,

  -- Verification
  status document_status NOT NULL DEFAULT 'pending_verification',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  -- Alert tracking
  expiry_alert_sent_30d BOOLEAN NOT NULL DEFAULT false,
  expiry_alert_sent_14d BOOLEAN NOT NULL DEFAULT false,
  expiry_alert_sent_7d BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for expiration alerts
CREATE INDEX idx_provider_docs_expiring
  ON provider_documents(expires_at, status)
  WHERE expires_at IS NOT NULL
    AND status = 'verified'
    AND expires_at > CURRENT_DATE;

-- View for documents requiring attention
CREATE VIEW provider_documents_expiring AS
SELECT
  pd.*,
  p.company_name,
  p.contact_email,
  CASE
    WHEN pd.days_until_expiry <= 0 THEN 'expired'
    WHEN pd.days_until_expiry <= 7 THEN 'critical'
    WHEN pd.days_until_expiry <= 14 THEN 'warning'
    WHEN pd.days_until_expiry <= 30 THEN 'upcoming'
    ELSE 'ok'
  END as urgency_level
FROM provider_documents pd
JOIN providers p ON p.id = pd.provider_id
WHERE pd.status = 'verified'
  AND pd.expires_at IS NOT NULL
  AND pd.expires_at <= CURRENT_DATE + 30
ORDER BY pd.expires_at;

-- Provider personnel (authorized employees)
CREATE TABLE provider_personnel (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  -- Personal info
  first_name TEXT NOT NULL,
  paternal_surname TEXT NOT NULL,
  maternal_surname TEXT,

  -- Identification
  ine_number TEXT,
  photo_url TEXT,

  -- Contact
  phone phone_number,

  -- Access authorization
  is_authorized BOOLEAN NOT NULL DEFAULT true,
  authorized_from DATE,
  authorized_until DATE,

  -- Access restrictions
  allowed_access_points UUID[],  -- NULL = all access points

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Provider access schedules
CREATE TABLE provider_access_schedules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  -- Schedule name
  name TEXT NOT NULL,  -- "Regular Hours", "Emergency Access"

  -- Days of week (0=Sunday, 6=Saturday)
  allowed_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],  -- Mon-Fri default

  -- Time windows
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '18:00',

  -- Validity period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to check if provider access is allowed
CREATE OR REPLACE FUNCTION is_provider_access_allowed(
  p_provider_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  schedule RECORD;
  day_of_week INTEGER;
  time_of_day TIME;
BEGIN
  day_of_week := EXTRACT(DOW FROM p_check_time);
  time_of_day := p_check_time::TIME;

  SELECT * INTO schedule
  FROM provider_access_schedules
  WHERE provider_id = p_provider_id
    AND is_active = true
    AND effective_from <= p_check_time::DATE
    AND (effective_until IS NULL OR effective_until >= p_check_time::DATE)
    AND day_of_week = ANY(allowed_days)
    AND time_of_day BETWEEN start_time AND end_time
  LIMIT 1;

  RETURN FOUND;
END;
$$;
```

### Pattern 5: Move Request Workflow with Validations

**What:** Move-in/move-out coordination with pre-validation checklists
**When to use:** Resident transitions requiring property management coordination
**Why:** Ensures debt-free status, key returns, damage deposit handling

```sql
-- Source: Property management checklist patterns (Manifestly, RentCheck)
CREATE TYPE move_type AS ENUM (
  'move_in',
  'move_out'
);

CREATE TYPE move_status AS ENUM (
  'requested',        -- Initial request
  'validating',       -- Pre-move validations in progress
  'validation_failed', -- One or more validations failed
  'approved',         -- All validations passed, move approved
  'scheduled',        -- Date/time confirmed
  'in_progress',      -- Move happening now
  'completed',        -- Move finished
  'cancelled'
);

CREATE TABLE move_requests (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Who is moving
  resident_id UUID NOT NULL REFERENCES residents(id),
  unit_id UUID NOT NULL REFERENCES units(id),

  -- Move type
  move_type move_type NOT NULL,

  -- Scheduling
  requested_date DATE NOT NULL,
  requested_time_start TIME,
  requested_time_end TIME,

  confirmed_date DATE,
  confirmed_time_start TIME,
  confirmed_time_end TIME,

  -- Moving company
  moving_company_name TEXT,
  moving_company_phone TEXT,
  moving_company_vehicle_plates TEXT[],
  estimated_duration_hours INTEGER,

  -- Elevator/loading dock reservation
  elevator_reserved BOOLEAN DEFAULT false,
  loading_dock_reserved BOOLEAN DEFAULT false,

  -- Status
  status move_status NOT NULL DEFAULT 'requested',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation summary
  all_validations_passed BOOLEAN,

  -- Notes
  resident_notes TEXT,
  admin_notes TEXT,

  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Pre-move validation checklist
CREATE TYPE validation_status AS ENUM (
  'pending',
  'passed',
  'failed',
  'waived'
);

CREATE TABLE move_validations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  move_request_id UUID NOT NULL REFERENCES move_requests(id) ON DELETE CASCADE,

  -- Validation type
  validation_type TEXT NOT NULL CHECK (validation_type IN (
    'debt_free',           -- No outstanding balance
    'keys_returned',       -- All keys/access devices returned
    'vehicles_updated',    -- Vehicle registry updated
    'pets_updated',        -- Pet registry updated
    'parking_cleared',     -- Parking spot vacated
    'utility_transfer',    -- Utilities transferred/cancelled
    'inspection_scheduled', -- Final inspection scheduled
    'deposit_review',      -- Damage deposit review complete
    'documentation_signed' -- Required paperwork signed
  )),

  -- Status
  status validation_status NOT NULL DEFAULT 'pending',

  -- Details
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES auth.users(id),
  notes TEXT,

  -- For debt_free: balance at check time
  balance_at_check NUMERIC(12,2),

  -- For waived: reason
  waiver_reason TEXT,
  waived_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT validations_unique UNIQUE (move_request_id, validation_type)
);

-- Damage deposits
CREATE TYPE deposit_status AS ENUM (
  'collected',
  'held',
  'inspection_pending',
  'deductions_pending',
  'refund_pending',
  'refunded',
  'forfeited'
);

CREATE TABLE move_deposits (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  move_request_id UUID REFERENCES move_requests(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  resident_id UUID NOT NULL REFERENCES residents(id),

  -- Deposit details
  deposit_type TEXT NOT NULL DEFAULT 'damage' CHECK (deposit_type IN ('damage', 'move', 'key')),
  amount money_amount NOT NULL,

  -- Collection
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_by UUID REFERENCES auth.users(id),
  payment_method TEXT,
  receipt_number TEXT,

  -- Status
  status deposit_status NOT NULL DEFAULT 'collected',

  -- Inspection results (for refund calculation)
  inspection_date DATE,
  inspection_notes TEXT,
  inspection_photos TEXT[],

  -- Deductions
  deduction_amount money_amount DEFAULT 0,
  deduction_reason TEXT,

  -- Refund
  refund_amount money_amount GENERATED ALWAYS AS (
    amount - COALESCE(deduction_amount, 0)
  ) STORED,
  refund_approved_at TIMESTAMPTZ,
  refund_approved_by UUID REFERENCES auth.users(id),
  refund_processed_at TIMESTAMPTZ,
  refund_method TEXT,
  refund_reference TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to create default validations for a move request
CREATE OR REPLACE FUNCTION create_move_validations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create validation checklist based on move type
  IF NEW.move_type = 'move_out' THEN
    INSERT INTO move_validations (move_request_id, validation_type)
    VALUES
      (NEW.id, 'debt_free'),
      (NEW.id, 'keys_returned'),
      (NEW.id, 'vehicles_updated'),
      (NEW.id, 'pets_updated'),
      (NEW.id, 'parking_cleared'),
      (NEW.id, 'inspection_scheduled'),
      (NEW.id, 'deposit_review');
  ELSE  -- move_in
    INSERT INTO move_validations (move_request_id, validation_type)
    VALUES
      (NEW.id, 'documentation_signed'),
      (NEW.id, 'deposit_review');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER move_request_create_validations
  AFTER INSERT ON move_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_move_validations();
```

### Pattern 6: Comprehensive Audit Logging (supa_audit Pattern)

**What:** Trigger-based audit capturing entity, action, actor, before/after as JSONB
**When to use:** All sensitive tables requiring change history
**Why:** Row-level detail with before/after state, queryable, compliance-ready

```sql
-- Source: supa_audit pattern (https://github.com/supabase/supa_audit) + Phase 4 immutability patterns
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TYPE audit.operation AS ENUM (
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE'
);

CREATE TABLE audit.audit_log (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

  -- What changed
  table_schema TEXT NOT NULL,
  table_name TEXT NOT NULL,
  table_oid OID NOT NULL,

  -- Record identification
  record_id UUID,  -- Primary key of affected record (if UUID)
  record_pk JSONB,  -- Primary key values as JSONB (for composite keys)

  -- Operation
  operation audit.operation NOT NULL,

  -- Data (JSONB for flexibility)
  old_record JSONB,  -- NULL for INSERT
  new_record JSONB,  -- NULL for DELETE
  changed_fields TEXT[],  -- List of changed column names (for UPDATE)

  -- Actor information
  actor_id UUID,  -- auth.uid() if available
  actor_role TEXT,  -- Database role
  actor_ip INET,
  actor_user_agent TEXT,

  -- Context
  community_id UUID,  -- Extracted from record if present

  -- Timestamp (immutable)
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Transaction info
  transaction_id BIGINT DEFAULT txid_current()
);

-- BRIN index for time-series queries
CREATE INDEX idx_audit_log_timestamp_brin
  ON audit.audit_log USING BRIN (logged_at)
  WITH (pages_per_range = 32);

-- B-tree indexes for common queries
CREATE INDEX idx_audit_log_table ON audit.audit_log(table_name, logged_at DESC);
CREATE INDEX idx_audit_log_record ON audit.audit_log(record_id, logged_at DESC) WHERE record_id IS NOT NULL;
CREATE INDEX idx_audit_log_actor ON audit.audit_log(actor_id, logged_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_log_community ON audit.audit_log(community_id, logged_at DESC) WHERE community_id IS NOT NULL;

-- Prevent modifications to audit log (immutable)
CREATE OR REPLACE FUNCTION audit.prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit.audit_log is append-only: % operations are not allowed', TG_OP;
END;
$$;

CREATE TRIGGER audit_log_immutable_update
  BEFORE UPDATE ON audit.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_audit_modification();

CREATE TRIGGER audit_log_immutable_delete
  BEFORE DELETE ON audit.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_audit_modification();

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit.log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_record JSONB;
  v_new_record JSONB;
  v_record_id UUID;
  v_community_id UUID;
  v_changed_fields TEXT[];
  v_actor_id UUID;
  v_actor_ip INET;
  v_actor_user_agent TEXT;
BEGIN
  -- Get actor from current session
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  -- Try to get request context (if available via pg_headerkit or similar)
  BEGIN
    v_actor_ip := current_setting('request.headers')::JSONB->>'x-forwarded-for';
    v_actor_user_agent := current_setting('request.headers')::JSONB->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_actor_ip := NULL;
    v_actor_user_agent := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_new_record := to_jsonb(NEW);
    v_record_id := CASE WHEN v_new_record ? 'id' THEN (v_new_record->>'id')::UUID ELSE NULL END;
    v_community_id := CASE WHEN v_new_record ? 'community_id' THEN (v_new_record->>'community_id')::UUID ELSE NULL END;

    INSERT INTO audit.audit_log (
      table_schema, table_name, table_oid, record_id, operation,
      new_record, actor_id, actor_role, actor_ip, actor_user_agent, community_id
    ) VALUES (
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_RELID, v_record_id, 'INSERT',
      v_new_record, v_actor_id, current_user, v_actor_ip, v_actor_user_agent, v_community_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_record := to_jsonb(OLD);
    v_new_record := to_jsonb(NEW);
    v_record_id := CASE WHEN v_new_record ? 'id' THEN (v_new_record->>'id')::UUID ELSE NULL END;
    v_community_id := CASE WHEN v_new_record ? 'community_id' THEN (v_new_record->>'community_id')::UUID ELSE NULL END;

    -- Find changed fields
    SELECT array_agg(key) INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(v_new_record) n
      FULL OUTER JOIN jsonb_each(v_old_record) o USING (key)
      WHERE n.value IS DISTINCT FROM o.value
    ) changed;

    INSERT INTO audit.audit_log (
      table_schema, table_name, table_oid, record_id, operation,
      old_record, new_record, changed_fields,
      actor_id, actor_role, actor_ip, actor_user_agent, community_id
    ) VALUES (
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_RELID, v_record_id, 'UPDATE',
      v_old_record, v_new_record, v_changed_fields,
      v_actor_id, current_user, v_actor_ip, v_actor_user_agent, v_community_id
    );

  ELSIF TG_OP = 'DELETE' THEN
    v_old_record := to_jsonb(OLD);
    v_record_id := CASE WHEN v_old_record ? 'id' THEN (v_old_record->>'id')::UUID ELSE NULL END;
    v_community_id := CASE WHEN v_old_record ? 'community_id' THEN (v_old_record->>'community_id')::UUID ELSE NULL END;

    INSERT INTO audit.audit_log (
      table_schema, table_name, table_oid, record_id, operation,
      old_record, actor_id, actor_role, actor_ip, actor_user_agent, community_id
    ) VALUES (
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_RELID, v_record_id, 'DELETE',
      v_old_record, v_actor_id, current_user, v_actor_ip, v_actor_user_agent, v_community_id
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to enable auditing on a table
CREATE OR REPLACE FUNCTION audit.enable_tracking(target_table REGCLASS)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  trigger_name TEXT;
BEGIN
  trigger_name := 'audit_' || target_table::TEXT;

  EXECUTE format(
    'CREATE TRIGGER %I
     AFTER INSERT OR UPDATE OR DELETE ON %s
     FOR EACH ROW
     EXECUTE FUNCTION audit.log_changes()',
    trigger_name,
    target_table
  );
END;
$$;

-- Function to disable auditing on a table
CREATE OR REPLACE FUNCTION audit.disable_tracking(target_table REGCLASS)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  trigger_name TEXT;
BEGIN
  trigger_name := 'audit_' || target_table::TEXT;

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, target_table);
END;
$$;

-- Enable auditing on critical tables
-- SELECT audit.enable_tracking('public.residents'::regclass);
-- SELECT audit.enable_tracking('public.transactions'::regclass);
-- SELECT audit.enable_tracking('public.packages'::regclass);
-- SELECT audit.enable_tracking('public.providers'::regclass);
```

### Pattern 7: User Session Tracking with Device Fingerprint

**What:** Track user sessions with device, IP, and location metadata
**When to use:** Security monitoring, suspicious activity detection
**Why:** Audit trail for login activity, multi-device management

```sql
-- Source: Fingerprint.com patterns + Supabase auth integration
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session identification
  auth_session_id TEXT,  -- Supabase auth session ID

  -- Device fingerprint
  device_fingerprint TEXT,  -- Computed fingerprint hash
  device_id TEXT,  -- App-generated device ID

  -- Device details
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  device_model TEXT,
  browser TEXT,
  browser_version TEXT,
  os TEXT,
  os_version TEXT,
  screen_resolution TEXT,

  -- Network
  ip_address INET NOT NULL,

  -- Location (if available)
  country TEXT,
  region TEXT,
  city TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),

  -- Session lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  termination_reason TEXT,  -- 'logout', 'expired', 'admin_revoke', 'security'

  -- Security flags
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  suspicious_reason TEXT,

  -- App version
  app_version TEXT
);

-- Index for user's active sessions
CREATE INDEX idx_user_sessions_active
  ON user_sessions(user_id, last_active_at DESC)
  WHERE terminated_at IS NULL;

-- Index for security analysis
CREATE INDEX idx_user_sessions_ip ON user_sessions(ip_address, created_at DESC);
CREATE INDEX idx_user_sessions_fingerprint ON user_sessions(device_fingerprint) WHERE device_fingerprint IS NOT NULL;

-- Security events table
CREATE TYPE security_event_type AS ENUM (
  'login_success',
  'login_failed',
  'logout',
  'password_changed',
  'mfa_enabled',
  'mfa_disabled',
  'session_terminated',
  'access_blocked',
  'blacklist_hit',
  'suspicious_activity',
  'permission_denied',
  'data_export'
);

CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID REFERENCES communities(id),

  -- Event type
  event_type security_event_type NOT NULL,

  -- Actor
  user_id UUID REFERENCES auth.users(id),
  session_id UUID REFERENCES user_sessions(id),

  -- Details
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Context
  ip_address INET,
  user_agent TEXT,

  -- Related entity (if applicable)
  entity_type TEXT,
  entity_id UUID,

  -- Severity
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),

  -- Timestamp
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BRIN index for time-series
CREATE INDEX idx_security_events_timestamp_brin
  ON security_events USING BRIN (logged_at);

-- B-tree for common queries
CREATE INDEX idx_security_events_user ON security_events(user_id, logged_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_security_events_type ON security_events(event_type, logged_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, logged_at DESC) WHERE severity IN ('warning', 'critical');
```

### Pattern 8: Community Settings with JSONB Feature Flags

**What:** JSONB-based feature flags on community settings for tenant-specific configuration
**When to use:** Enabling/disabling features per community without schema changes
**Why:** Flexible, no migrations needed, GIN indexed for queries

```sql
-- Source: PostgreSQL JSONB multi-tenant patterns (Citus, Crunchy Data)
CREATE TABLE community_settings (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Operating hours
  office_hours_start TIME DEFAULT '08:00',
  office_hours_end TIME DEFAULT '18:00',
  office_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],  -- Mon-Fri

  -- Contact information
  management_email TEXT,
  management_phone phone_number,
  emergency_phone phone_number,

  -- Branding
  logo_url TEXT,
  primary_color TEXT,  -- Hex color
  secondary_color TEXT,

  -- Locale
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  locale locale_code NOT NULL DEFAULT 'es-MX',
  currency currency_code NOT NULL DEFAULT 'MXN',

  -- Feature flags (JSONB for flexibility)
  -- Schema: { "feature_name": { "enabled": true, "config": {...} } }
  feature_flags JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Rules and policies
  guest_parking_allowed BOOLEAN DEFAULT true,
  max_vehicles_per_unit INTEGER DEFAULT 2,
  pet_policy TEXT,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',

  -- Package settings
  package_retention_days INTEGER DEFAULT 14,
  package_notification_channels TEXT[] DEFAULT ARRAY['push', 'email'],

  -- Custom rules stored as JSONB
  custom_rules JSONB DEFAULT '[]'::JSONB,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT community_settings_unique UNIQUE (community_id)
);

-- GIN index for JSONB queries
CREATE INDEX idx_community_settings_features
  ON community_settings USING GIN (feature_flags);

-- Example feature flags structure:
-- {
--   "digital_mailroom": {
--     "enabled": true,
--     "config": {
--       "qr_codes_enabled": true,
--       "pin_codes_enabled": true,
--       "signature_required": false,
--       "photo_on_pickup": true
--     }
--   },
--   "provider_management": {
--     "enabled": true,
--     "config": {
--       "require_insurance": true,
--       "require_background_check": false
--     }
--   },
--   "move_coordination": {
--     "enabled": true,
--     "config": {
--       "require_deposit": true,
--       "deposit_amount": 5000,
--       "elevator_reservation": true
--     }
--   },
--   "marketplace": {
--     "enabled": false
--   },
--   "voting": {
--     "enabled": true,
--     "config": {
--       "weighted_voting": true
--     }
--   }
-- }

-- Function to check if feature is enabled for a community
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_community_id UUID,
  p_feature_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_feature JSONB;
BEGIN
  SELECT feature_flags->p_feature_name INTO v_feature
  FROM community_settings
  WHERE community_id = p_community_id;

  IF v_feature IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN COALESCE((v_feature->>'enabled')::BOOLEAN, FALSE);
END;
$$;

-- Function to get feature config
CREATE OR REPLACE FUNCTION get_feature_config(
  p_community_id UUID,
  p_feature_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (
    SELECT feature_flags->p_feature_name->'config'
    FROM community_settings
    WHERE community_id = p_community_id
  );
END;
$$;
```

### Pattern 9: RBAC with Permissions Matrix

**What:** Hybrid RBAC using JWT claims for common checks + database for fine-grained permissions
**When to use:** Multi-tenant with configurable roles per community
**Why:** JWT for performance, database for flexibility and audit

```sql
-- Source: Supabase RBAC docs + Permit.io patterns + Oso RBAC guide
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID REFERENCES communities(id),  -- NULL for system roles

  -- Role identification
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Hierarchy (optional)
  parent_role_id UUID REFERENCES roles(id),

  -- System vs custom
  is_system_role BOOLEAN NOT NULL DEFAULT false,  -- Cannot delete
  is_default BOOLEAN NOT NULL DEFAULT false,  -- Assigned to new users

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique role name per community
  CONSTRAINT roles_unique_name UNIQUE (community_id, name)
);

-- System roles (community_id = NULL)
-- INSERT INTO roles (name, display_name, is_system_role) VALUES
--   ('super_admin', 'Super Administrator', true),
--   ('community_admin', 'Community Administrator', true),
--   ('manager', 'Manager', true),
--   ('guard', 'Security Guard', true),
--   ('resident', 'Resident', true),
--   ('tenant', 'Tenant', true);

-- Permissions (resource + action combinations)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

  -- Permission identification
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Resource and action
  resource TEXT NOT NULL,  -- 'packages', 'providers', 'residents', etc.
  action TEXT NOT NULL,     -- 'read', 'create', 'update', 'delete', 'approve', etc.

  -- Grouping for UI
  category TEXT,  -- 'operations', 'security', 'financial', etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT permissions_unique_resource_action UNIQUE (resource, action)
);

-- Example permissions:
-- INSERT INTO permissions (name, display_name, resource, action, category) VALUES
--   ('packages.read', 'View Packages', 'packages', 'read', 'operations'),
--   ('packages.create', 'Create Package Records', 'packages', 'create', 'operations'),
--   ('packages.update', 'Update Packages', 'packages', 'update', 'operations'),
--   ('packages.pickup', 'Process Package Pickup', 'packages', 'pickup', 'operations'),
--   ('providers.read', 'View Providers', 'providers', 'read', 'operations'),
--   ('providers.create', 'Add Providers', 'providers', 'create', 'operations'),
--   ('providers.approve', 'Approve Providers', 'providers', 'approve', 'operations'),
--   ('moves.read', 'View Move Requests', 'moves', 'read', 'operations'),
--   ('moves.approve', 'Approve Move Requests', 'moves', 'approve', 'operations'),
--   ('audit.read', 'View Audit Logs', 'audit', 'read', 'security'),
--   ('settings.read', 'View Community Settings', 'settings', 'read', 'configuration'),
--   ('settings.update', 'Update Community Settings', 'settings', 'update', 'configuration'),
--   ('roles.manage', 'Manage Roles', 'roles', 'manage', 'security');

-- Role-permission assignments
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Conditions (optional JSONB for fine-grained control)
  -- e.g., {"own_unit_only": true} or {"max_amount": 1000}
  conditions JSONB,

  -- Validity period (optional)
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,

  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- User role assignments (per community)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Assignment details
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT user_roles_unique UNIQUE (user_id, role_id, community_id)
);

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_community_id UUID,
  p_permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND ur.community_id = p_community_id
      AND ur.is_active = true
      AND (ur.valid_until IS NULL OR ur.valid_until > now())
      AND p.name = p_permission_name
      AND (rp.valid_until IS NULL OR rp.valid_until > now())
  );
END;
$$;

-- Function to get all permissions for current user
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID DEFAULT auth.uid(),
  p_community_id UUID DEFAULT NULL
)
RETURNS TABLE (
  permission_name TEXT,
  resource TEXT,
  action TEXT,
  conditions JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Use community from JWT if not provided
  IF p_community_id IS NULL THEN
    p_community_id := (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID;
  END IF;

  RETURN QUERY
  SELECT
    p.name,
    p.resource,
    p.action,
    rp.conditions
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = p_user_id
    AND ur.community_id = p_community_id
    AND ur.is_active = true
    AND (ur.valid_until IS NULL OR ur.valid_until > now())
    AND (rp.valid_until IS NULL OR rp.valid_until > now());
END;
$$;
```

### Anti-Patterns to Avoid

- **Using pgAudit alone for before/after tracking:** pgAudit logs statements, not row data; use triggers for before/after JSONB capture
- **Hardcoding feature flags:** Use JSONB on community_settings for per-tenant configuration
- **Random PIN codes without expiration:** Always include expiration timestamp in pickup codes
- **Single role per user:** Users may need multiple roles (resident + board member); use junction table
- **Auditing high-write tables:** Don't enable audit triggers on tables with >3K ops/second; sample instead
- **Modifying audit records:** Immutable triggers must prevent UPDATE and DELETE on audit tables
- **Storing signing keys in database tables:** Use Supabase Vault or environment variables

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pickup code signing | Custom hash | pgcrypto HMAC-SHA256 | Cryptographically secure |
| Audit log schema | Custom design | supa_audit pattern | Proven, handles edge cases |
| Feature flag system | Custom flags table | JSONB on community_settings | Simpler, GIN indexed |
| State machine validation | Application IF statements | ENUM + trigger | Database-enforced |
| Permission checking | Inline SQL in every query | has_permission() function | Centralized, auditable |
| Document expiration alerts | Manual queries | Computed columns + views | Automatic, always current |

**Key insight:** Operations systems generate compliance-sensitive data. Use database-enforced immutability and audit trails that cannot be bypassed by application bugs.

## Common Pitfalls

### Pitfall 1: Audit Log Growing Too Large

**What goes wrong:** Audit table has billions of rows, queries timeout
**Why it happens:** Auditing enabled on high-write tables without limits
**How to avoid:**
- Only audit critical tables (packages, providers, financial transactions)
- Don't audit access_logs (already immutable)
- Implement partitioning by month for audit tables
- Use BRIN indexes for timestamp queries
**Warning signs:** Disk usage alerts, slow audit queries, >3K audit inserts/second

### Pitfall 2: Pickup Codes Without Cryptographic Verification

**What goes wrong:** Codes can be guessed or brute-forced
**Why it happens:** Using random 6-digit PINs only
**How to avoid:**
- Use HMAC-signed payloads for QR codes
- Limit PIN attempts (3 max before lockout)
- Short expiration windows (24-72 hours)
- Log all verification attempts
**Warning signs:** Multiple failed pickup attempts, codes used after expiration

### Pitfall 3: Provider Documents Not Tracked for Expiration

**What goes wrong:** Providers working with expired insurance, liability exposure
**Why it happens:** No automated expiration tracking
**How to avoid:**
- Computed is_expired and days_until_expiry columns
- Scheduled job to send alerts at 30/14/7 days
- Block provider access when critical documents expire
**Warning signs:** Providers with expired insurance still active

### Pitfall 4: Move Validations Bypassed

**What goes wrong:** Resident moves out with outstanding debt
**Why it happens:** Validation checklist exists but not enforced
**How to avoid:**
- Move status can't transition to 'approved' unless all_validations_passed = true
- Debt check queries live balance, not snapshot
- Require admin override (with reason) for validation waivers
**Warning signs:** Completed moves with failed validations

### Pitfall 5: Feature Flags Not GIN Indexed

**What goes wrong:** Slow queries when filtering communities by enabled features
**Why it happens:** JSONB without proper indexing
**How to avoid:**
- Create GIN index on feature_flags column
- Use containment operators (@>) for queries
- Cache feature check results in application
**Warning signs:** Slow dashboard loading, feature check queries in slow log

### Pitfall 6: RBAC Permissions Checked Only at Application Layer

**What goes wrong:** Direct database access bypasses permission checks
**Why it happens:** RLS not configured, relying on application code
**How to avoid:**
- RLS policies that call has_permission() function
- Permission checks in both application and database
- Revoke direct table access from application roles
**Warning signs:** Users accessing data they shouldn't see in audit logs

## Code Examples

### Complete Provider Work Orders Table

```sql
-- Links providers to maintenance tickets with performance tracking
CREATE TABLE provider_work_orders (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  ticket_id UUID REFERENCES tickets(id),  -- From Phase 6

  -- Work order details
  work_order_number TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Assigned personnel
  assigned_personnel_ids UUID[],  -- References provider_personnel

  -- Scheduling
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,

  -- Actual work
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'scheduled', 'in_progress', 'completed', 'cancelled'
  )),

  -- Cost
  quoted_amount money_amount,
  final_amount money_amount,

  -- Rating
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment TEXT,
  rated_at TIMESTAMPTZ,
  rated_by UUID REFERENCES residents(id),

  -- Documentation
  before_photos TEXT[],
  after_photos TEXT[],
  completion_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT work_orders_unique_number UNIQUE (community_id, work_order_number)
);

-- Update provider rating on work order rating
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rating IS NOT NULL AND (OLD.rating IS NULL OR OLD.rating != NEW.rating) THEN
    UPDATE providers
    SET
      average_rating = (
        SELECT AVG(rating)::NUMERIC(3,2)
        FROM provider_work_orders
        WHERE provider_id = NEW.provider_id
          AND rating IS NOT NULL
      ),
      total_work_orders = (
        SELECT COUNT(*)
        FROM provider_work_orders
        WHERE provider_id = NEW.provider_id
          AND status = 'completed'
      )
    WHERE id = NEW.provider_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER work_order_rating_trigger
  AFTER UPDATE ON provider_work_orders
  FOR EACH ROW
  WHEN (NEW.rating IS NOT NULL)
  EXECUTE FUNCTION update_provider_rating();
```

### Failed Login Tracking

```sql
CREATE TABLE failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

  -- Identification (may not have valid user_id for wrong email)
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),

  -- Attempt details
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET NOT NULL,
  user_agent TEXT,

  -- Failure reason
  failure_reason TEXT NOT NULL,  -- 'invalid_email', 'invalid_password', 'account_locked', 'mfa_failed'

  -- Rate limiting
  attempt_count INTEGER NOT NULL DEFAULT 1
);

-- Index for rate limiting checks
CREATE INDEX idx_failed_logins_ip ON failed_login_attempts(ip_address, attempted_at DESC);
CREATE INDEX idx_failed_logins_email ON failed_login_attempts(email, attempted_at DESC);

-- Function to check if login should be blocked
CREATE OR REPLACE FUNCTION should_block_login(
  p_email TEXT,
  p_ip_address INET,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_email_attempts INTEGER;
  v_ip_attempts INTEGER;
BEGIN
  -- Check attempts by email
  SELECT COUNT(*) INTO v_email_attempts
  FROM failed_login_attempts
  WHERE email = p_email
    AND attempted_at > now() - (p_window_minutes || ' minutes')::INTERVAL;

  -- Check attempts by IP
  SELECT COUNT(*) INTO v_ip_attempts
  FROM failed_login_attempts
  WHERE ip_address = p_ip_address
    AND attempted_at > now() - (p_window_minutes || ' minutes')::INTERVAL;

  RETURN v_email_attempts >= p_max_attempts OR v_ip_attempts >= (p_max_attempts * 2);
END;
$$;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pgAudit only | Trigger-based + optional pgAudit | Always (for row data) | Before/after JSONB capture |
| Hardcoded feature flags | JSONB feature flags | Modern multi-tenant | No migrations for new features |
| Random PIN codes | HMAC-signed codes | Security best practice | Offline verification, tamper-proof |
| Single role per user | Role junction table | RBAC evolution | Multiple roles supported |
| Manual expiration checks | Computed columns | PostgreSQL 12+ | Always current, no stale data |

**Deprecated/outdated:**
- pgAudit for row-level change tracking: Use triggers (pgAudit is for statement logging)
- Storing feature flags in separate table: JSONB on settings is simpler
- Random codes without signatures: Use HMAC for verification
- Application-only permission checks: Database-enforced via RLS

## Open Questions

### 1. Pickup Code Delivery Channel

**What we know:** Need to send PIN/QR to recipients via multiple channels
**What's unclear:** Which notification service handles delivery (Phase 6 notifications vs dedicated service)
**Recommendation:** Use Phase 6 notification system. Create notification with type 'package_arrived' and include pickup code in action_data. Let notification preferences determine channel (push/SMS/email).

### 2. Provider Portal

**What we know:** Providers need to view their schedules, work orders, and update documents
**What's unclear:** Whether providers get Supabase auth accounts or use a separate portal
**Recommendation:** Providers get auth accounts with 'provider' role scoped to their provider_id. They can only see their own data via RLS. Separate from resident app or admin dashboard.

### 3. Audit Log Retention

**What we know:** Audit logs are immutable and grow indefinitely
**What's unclear:** Retention period, archival strategy
**Recommendation:** Keep 2 years in primary table, archive older to cold storage (S3). Use partitioning by month. Compliance requirements may dictate specific retention periods.

### 4. Offline Audit Log Sync

**What we know:** Guards work offline; PowerSync syncs to SQLite
**What's unclear:** Should audit logs sync to devices, or only be server-side?
**Recommendation:** Audit logs are server-only. Never sync audit tables to devices. Actions performed offline are audited when synced to server. This prevents tampering with audit trail on compromised devices.

## Sources

### Primary (HIGH confidence)
- [Supabase PGAudit Documentation](https://supabase.com/docs/guides/database/extensions/pgaudit) - Extension configuration
- [supa_audit GitHub](https://github.com/supabase/supa_audit) - Trigger-based audit pattern
- [Supabase RBAC Documentation](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) - Custom claims and RBAC
- [Bytebase PostgreSQL Audit Logging](https://www.bytebase.com/blog/postgres-audit-logging/) - Trigger vs pgAudit comparison

### Secondary (MEDIUM confidence)
- [Satori Cyber - PostgreSQL Audit](https://satoricyber.com/postgres-security/postgres-audit/) - Three audit method comparison
- [Permit.io Fine-Grained Postgres Permissions](https://www.permit.io/blog/implementing-fine-grained-postgres-permissions-for-multi-tenant-applications) - Multi-tenant RBAC patterns
- [Crunchy Data Multi-Tenancy](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy) - JSONB feature flags
- [Fingerprint.com Supabase Integration](https://blog.mansueli.com/tracking-user-data-with-fingerprint-and-supabase-in-postgresql) - Device fingerprint schema
- [Smart Locker Documentation (SSG, Quadient)](https://www.southwestsolutions.com/lockers/smart-lockers/smart-parcel-lockers/) - Package pickup patterns

### Tertiary (LOW confidence)
- Property management checklist patterns (Manifestly, RentCheck) - Workflow concepts, not technical schemas
- Healthcare credentialing software patterns - Expiration tracking concepts

## Metadata

**Confidence breakdown:**
- Package state machine: HIGH - Following Phase 6 ticket pattern, standard workflow
- Pickup codes: HIGH - Based on Phase 3 QR pattern + industry smart locker systems
- Provider credentials: MEDIUM - Healthcare credentialing adapted for property management
- Audit logging: HIGH - supa_audit pattern is documented and proven
- Session tracking: MEDIUM - Based on Fingerprint.com patterns, Supabase integration
- Feature flags: HIGH - JSONB patterns well-documented (Crunchy Data, Citus)
- RBAC: HIGH - Supabase documentation + established patterns

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable domain, audit/RBAC patterns don't change frequently)
