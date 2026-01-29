# Phase 3: Access Control & Security - Research

**Researched:** 2026-01-29
**Domain:** PostgreSQL schema design for physical access control, guard operations, and emergency response
**Confidence:** HIGH

## Summary

This phase models the security operations infrastructure for Mexican gated residential communities: access points (gates, barriers, doors), visitor invitations with multiple validity types, immutable access logs, blacklist management, guard operations with shifts/patrols, and emergency alerts. The research focused on eight key questions: (1) access log immutability patterns, (2) invitation type modeling, (3) QR code offline verification, (4) NFC checkpoint identification, (5) emergency dispatch workflows, (6) guard shift assignments, (7) blacklist expiration, and (8) high-volume log indexing.

The standard approach uses PostgreSQL triggers to enforce append-only semantics on access logs, ENUM-based invitation types with separate validation logic per type, Ed25519 or HMAC-SHA256 signatures for QR codes that work offline, NFC tag serial numbers (not UUIDs) for patrol checkpoints, state machine workflows for emergency dispatch, junction tables for guard-to-shift-to-access-point assignments, and BRIN indexes for time-ordered access logs. Partitioning by month is recommended for logs exceeding millions of rows.

**Primary recommendation:** Build immutable access_logs with trigger-enforced append-only semantics, use BRIN indexes for timestamp queries, implement QR signatures using HMAC-SHA256 for offline verification, and model invitations as a single polymorphic table with type-specific validation in triggers.

## Standard Stack

This phase is pure PostgreSQL/Supabase schema work, continuing from Phase 1 and 2 patterns.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15+ | Database with triggers, BRIN indexes | Supabase default, immutability enforcement |
| Supabase Storage | Latest | Evidence photos, patrol images | S3-compatible with RLS |
| HMAC-SHA256 | N/A | QR code signatures | Built into pgcrypto, simple offline verification |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| pgcrypto extension | HMAC signatures, hash chaining | QR code generation/verification |
| pg_trgm extension | Fuzzy search | Visitor name lookup |
| BRIN indexes | Time-ordered access logs | Tables > 100K rows with timestamp correlation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HMAC-SHA256 | Ed25519 asymmetric | Ed25519 is more secure but requires key management; HMAC simpler for internal system |
| Single invitations table | Separate tables per type | Single table chosen: simpler RLS, unified queries, type discrimination via ENUM |
| Monthly partitioning | BRIN only | Both used for logs: BRIN for queries, partitioning for maintenance/archival |

## Architecture Patterns

### Recommended Schema Structure

```
public/
  access_points (gates, barriers, doors, turnstiles)
  guards (security personnel profiles)
  guard_certifications (licenses, training records)
  guard_shifts (scheduled work periods)
  shift_assignments (guard-to-shift-to-access_point)

  invitations (all types: single-use, event, recurring, vehicle)
  qr_codes (cryptographically signed, trackable)
  access_logs (immutable entry/exit records)

  blacklist_entries (banned persons with evidence)

  patrol_routes (defined patrol paths)
  patrol_checkpoints (NFC tags at locations)
  patrol_logs (guard check-in records)

  emergency_alerts (panic, fire, medical incidents)
  emergency_responders (dispatch assignments)
```

### Pattern 1: Immutable Access Logs with Trigger Enforcement

**What:** Append-only table that blocks UPDATE and DELETE at database level
**When to use:** Any audit trail requiring legal/compliance immutability
**Why:** Database-enforced immutability cannot be bypassed by application bugs

```sql
-- Source: PostgreSQL trigger documentation + audit trail best practices
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  access_point_id UUID NOT NULL REFERENCES access_points(id),

  -- Who/what is accessing
  person_type TEXT NOT NULL CHECK (person_type IN ('resident', 'visitor', 'guard', 'provider', 'vehicle')),
  person_id UUID,                          -- Reference to residents/visitors/guards table
  person_name TEXT NOT NULL,               -- Denormalized for historical accuracy
  person_document TEXT,                    -- ID number shown

  -- Vehicle if applicable
  vehicle_id UUID REFERENCES vehicles(id),
  plate_number TEXT,                       -- Denormalized, as detected
  plate_detected TEXT,                     -- LPR result if different

  -- Invitation/authorization
  invitation_id UUID REFERENCES invitations(id),
  qr_code_id UUID REFERENCES qr_codes(id),

  -- Access details
  direction TEXT NOT NULL CHECK (direction IN ('entry', 'exit')),
  method TEXT NOT NULL CHECK (method IN ('qr_code', 'nfc_tag', 'lpr', 'facial', 'manual', 'intercom', 'remote')),
  decision access_decision NOT NULL,       -- allowed, denied, blocked
  denial_reason TEXT,                      -- If denied/blocked

  -- Evidence
  photo_url TEXT,                          -- Supabase Storage path
  photo_vehicle_url TEXT,                  -- Vehicle photo

  -- Guard who processed (if manual)
  processed_by UUID REFERENCES guards(id),
  guard_notes TEXT,

  -- Timing
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Hash chain for tamper detection (optional but recommended)
  previous_hash TEXT,
  entry_hash TEXT GENERATED ALWAYS AS (
    encode(sha256(
      (id || logged_at || person_name || direction || decision)::bytea
    ), 'hex')
  ) STORED
);

-- CRITICAL: Enforce immutability
CREATE OR REPLACE FUNCTION prevent_access_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'access_logs is append-only: % operations are not allowed', TG_OP;
END;
$$;

CREATE TRIGGER access_logs_immutable_update
  BEFORE UPDATE ON access_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_access_log_modification();

CREATE TRIGGER access_logs_immutable_delete
  BEFORE DELETE ON access_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_access_log_modification();

-- BRIN index for timestamp queries (1000x smaller than B-tree)
CREATE INDEX idx_access_logs_timestamp_brin
  ON access_logs USING BRIN (logged_at)
  WITH (pages_per_range = 32);

-- B-tree for specific lookups
CREATE INDEX idx_access_logs_access_point ON access_logs(access_point_id, logged_at DESC);
CREATE INDEX idx_access_logs_person ON access_logs(person_id) WHERE person_id IS NOT NULL;
```

### Pattern 2: Polymorphic Invitations with Type-Specific Validation

**What:** Single table for all invitation types with ENUM discrimination
**When to use:** Multiple related entity types with shared core fields but different validation rules
**Why:** Unified RLS policies, simpler queries, type-specific constraints via triggers

```sql
-- Invitation types enum
CREATE TYPE invitation_type AS ENUM (
  'single_use',     -- One-time entry, burns after use
  'event',          -- Valid for specific date/time window
  'recurring',      -- Regular visits (e.g., weekly housekeeper)
  'vehicle_preauth' -- Pre-authorized vehicle by plate
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Who created the invitation
  created_by_resident_id UUID NOT NULL REFERENCES residents(id),
  unit_id UUID REFERENCES units(id),

  -- Invitation type determines validation rules
  invitation_type invitation_type NOT NULL,

  -- Visitor identification
  visitor_name TEXT NOT NULL,
  visitor_document TEXT,                   -- ID number if known
  visitor_phone phone_number,
  visitor_email TEXT,
  visitor_company TEXT,                    -- Company/organization name

  -- Vehicle pre-authorization (for vehicle_preauth type)
  vehicle_plate TEXT,
  vehicle_plate_normalized TEXT GENERATED ALWAYS AS (
    UPPER(REGEXP_REPLACE(vehicle_plate, '[^A-Z0-9]', '', 'g'))
  ) STORED,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,

  -- Validity window
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,                 -- NULL for recurring with no end

  -- Recurring pattern (for recurring type)
  -- Stored as interval array for weekdays, e.g., ['1 day', '3 day'] for Mon/Wed
  recurring_days INTEGER[],                -- Array of day-of-week (0=Sun, 6=Sat)
  recurring_start_time TIME,               -- e.g., 08:00
  recurring_end_time TIME,                 -- e.g., 18:00

  -- Event details (for event type)
  event_name TEXT,
  event_max_guests INTEGER,
  event_guests_checked_in INTEGER DEFAULT 0,

  -- Usage tracking
  max_uses INTEGER DEFAULT 1,              -- NULL for unlimited
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Status
  status approval_status NOT NULL DEFAULT 'approved', -- Invitations auto-approved by resident
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,

  -- Access restrictions
  allowed_access_points UUID[],            -- NULL means all points
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  requires_document BOOLEAN NOT NULL DEFAULT false,

  -- Notes
  special_instructions TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Type-specific constraints
  CONSTRAINT single_use_has_max_1 CHECK (
    invitation_type != 'single_use' OR max_uses = 1
  ),
  CONSTRAINT event_has_dates CHECK (
    invitation_type != 'event' OR (valid_from IS NOT NULL AND valid_until IS NOT NULL)
  ),
  CONSTRAINT recurring_has_pattern CHECK (
    invitation_type != 'recurring' OR recurring_days IS NOT NULL
  ),
  CONSTRAINT vehicle_has_plate CHECK (
    invitation_type != 'vehicle_preauth' OR vehicle_plate IS NOT NULL
  )
);

-- Validation function for invitation use
CREATE OR REPLACE FUNCTION is_invitation_valid(inv_id UUID, check_time TIMESTAMPTZ DEFAULT now())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  inv RECORD;
  day_of_week INTEGER;
BEGIN
  SELECT * INTO inv FROM invitations WHERE id = inv_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF inv.status != 'approved' THEN RETURN FALSE; END IF;
  IF inv.cancelled_at IS NOT NULL THEN RETURN FALSE; END IF;

  -- Check time window
  IF inv.valid_from > check_time THEN RETURN FALSE; END IF;
  IF inv.valid_until IS NOT NULL AND inv.valid_until < check_time THEN RETURN FALSE; END IF;

  -- Check max uses
  IF inv.max_uses IS NOT NULL AND inv.times_used >= inv.max_uses THEN RETURN FALSE; END IF;

  -- Type-specific validation
  CASE inv.invitation_type
    WHEN 'recurring' THEN
      day_of_week := EXTRACT(DOW FROM check_time);
      IF NOT (day_of_week = ANY(inv.recurring_days)) THEN RETURN FALSE; END IF;
      IF inv.recurring_start_time IS NOT NULL AND check_time::TIME < inv.recurring_start_time THEN RETURN FALSE; END IF;
      IF inv.recurring_end_time IS NOT NULL AND check_time::TIME > inv.recurring_end_time THEN RETURN FALSE; END IF;
    WHEN 'event' THEN
      IF inv.event_max_guests IS NOT NULL AND inv.event_guests_checked_in >= inv.event_max_guests THEN RETURN FALSE; END IF;
    ELSE
      -- single_use and vehicle_preauth: basic checks already done
      NULL;
  END CASE;

  RETURN TRUE;
END;
$$;
```

### Pattern 3: QR Code with HMAC Signature for Offline Verification

**What:** QR codes containing signed payloads that guards can verify without network
**When to use:** Offline-first scenarios where guards need to validate access
**Why:** PowerSync syncs signing keys; verification happens locally on device

```sql
-- Enable pgcrypto for HMAC
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- QR code status enum
CREATE TYPE qr_status AS ENUM (
  'active',
  'used',       -- Single-use, has been scanned
  'expired',
  'revoked'
);

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Link to invitation or direct resident access
  invitation_id UUID REFERENCES invitations(id),
  resident_id UUID REFERENCES residents(id),

  -- Payload that gets encoded in QR
  -- Format: {id}|{community_id}|{valid_until_epoch}|{signature}
  payload TEXT NOT NULL,

  -- Cryptographic signature (HMAC-SHA256)
  -- Sign: id + community_id + valid_until using community's secret key
  signature TEXT NOT NULL,

  -- Validity
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,

  -- Status tracking
  status qr_status NOT NULL DEFAULT 'active',
  scanned_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES guards(id),
  scanned_at_access_point UUID REFERENCES access_points(id),

  -- Single-use tracking
  is_single_use BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Function to generate signed QR payload
CREATE OR REPLACE FUNCTION generate_qr_payload(
  qr_id UUID,
  comm_id UUID,
  expires_at TIMESTAMPTZ,
  secret_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  data_to_sign TEXT;
  signature TEXT;
BEGIN
  -- Data format: id|community_id|expiry_epoch
  data_to_sign := qr_id::TEXT || '|' || comm_id::TEXT || '|' || EXTRACT(EPOCH FROM expires_at)::BIGINT;

  -- HMAC-SHA256 signature
  signature := encode(
    hmac(data_to_sign::bytea, secret_key::bytea, 'sha256'),
    'base64'
  );

  -- Return payload with signature appended
  RETURN data_to_sign || '|' || signature;
END;
$$;

-- Function to verify QR payload (used in guards' offline app)
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
AS $$
DECLARE
  parts TEXT[];
  data_to_verify TEXT;
  expected_sig TEXT;
  provided_sig TEXT;
  expiry_epoch BIGINT;
BEGIN
  -- Parse payload: id|community_id|expiry|signature
  parts := string_to_array(payload, '|');

  IF array_length(parts, 1) != 4 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::TIMESTAMPTZ, 'Invalid payload format';
    RETURN;
  END IF;

  -- Extract components
  qr_id := parts[1]::UUID;
  community_id := parts[2]::UUID;
  expiry_epoch := parts[3]::BIGINT;
  provided_sig := parts[4];

  -- Reconstruct data and compute expected signature
  data_to_verify := parts[1] || '|' || parts[2] || '|' || parts[3];
  expected_sig := encode(hmac(data_to_verify::bytea, secret_key::bytea, 'sha256'), 'base64');

  -- Verify signature
  IF expected_sig != provided_sig THEN
    RETURN QUERY SELECT FALSE, qr_id, community_id, NULL::TIMESTAMPTZ, 'Invalid signature';
    RETURN;
  END IF;

  -- Check expiry
  expires_at := to_timestamp(expiry_epoch);
  IF expires_at < now() THEN
    RETURN QUERY SELECT FALSE, qr_id, community_id, expires_at, 'QR code expired';
    RETURN;
  END IF;

  -- Valid!
  RETURN QUERY SELECT TRUE, qr_id, community_id, expires_at, NULL::TEXT;
END;
$$;

-- Index for QR lookups
CREATE INDEX idx_qr_codes_invitation ON qr_codes(invitation_id) WHERE status = 'active';
CREATE INDEX idx_qr_codes_resident ON qr_codes(resident_id) WHERE status = 'active';
```

### Pattern 4: NFC Checkpoint with Serial Number (Not UUID)

**What:** Patrol checkpoints use NFC tag hardware serial numbers
**When to use:** Physical NFC tags at checkpoint locations
**Why:** NFC serial numbers are factory-assigned, immutable, and automatically read by devices

```sql
CREATE TABLE patrol_checkpoints (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- NFC tag identification (factory serial number)
  nfc_serial TEXT NOT NULL,

  -- Location
  name TEXT NOT NULL,                      -- "Building A Entrance", "Pool Gate"
  description TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  location_tolerance_meters INTEGER DEFAULT 50,  -- GPS validation tolerance

  -- Physical location
  building TEXT,
  floor INTEGER,
  area TEXT,

  -- Photo of checkpoint location for guard reference
  photo_url TEXT,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- NFC serial must be unique within community
  CONSTRAINT checkpoints_nfc_unique UNIQUE (community_id, nfc_serial)
);

-- Comment explaining NFC serial vs UUID choice
COMMENT ON COLUMN patrol_checkpoints.nfc_serial IS
  'Factory-assigned NFC tag serial number (e.g., "04:A2:E5:1A:BC:34:80").
   Use serial number, not UUID, because:
   1. NFC readers return serial numbers directly
   2. Serial numbers are factory-immutable (tamper-evident)
   3. No need to write custom data to tags
   Store as TEXT to handle various serial formats (hex, decimal).';
```

### Pattern 5: Guard Shifts with Access Point Assignments

**What:** Guards have scheduled shifts assigned to specific access points
**When to use:** Multi-access-point communities with rotating guard schedules
**Why:** Enables accountability (who was on duty when) and capacity planning

```sql
-- Guard profiles (separate from residents for non-resident guards)
CREATE TABLE guards (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Link to auth if guard has app access
  user_id UUID REFERENCES auth.users(id),

  -- Personal info
  first_name TEXT NOT NULL,
  paternal_surname TEXT NOT NULL,
  maternal_surname TEXT,
  photo_url TEXT,

  -- Contact
  phone phone_number NOT NULL,
  phone_emergency phone_number,
  email TEXT,

  -- Employment
  employee_number TEXT,
  hired_at DATE,
  employment_status general_status NOT NULL DEFAULT 'active',

  -- Documents
  ine_number TEXT,
  curp TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Guard certifications/training
CREATE TABLE guard_certifications (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,

  certification_type TEXT NOT NULL,        -- 'security_license', 'first_aid', 'fire_safety'
  certificate_number TEXT,
  issuing_authority TEXT,
  issued_at DATE NOT NULL,
  expires_at DATE,
  document_url TEXT,                       -- Certificate scan

  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shift definitions (templates)
CREATE TABLE guard_shifts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  name TEXT NOT NULL,                      -- "Morning Shift", "Night Shift"

  -- Schedule
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Which days this shift applies (NULL = all days)
  applicable_days INTEGER[],               -- 0=Sun, 6=Sat

  -- Whether shift crosses midnight
  crosses_midnight BOOLEAN GENERATED ALWAYS AS (end_time < start_time) STORED,

  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Shift assignments (guard + shift + access point + date range)
CREATE TABLE shift_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  guard_id UUID NOT NULL REFERENCES guards(id),
  shift_id UUID NOT NULL REFERENCES guard_shifts(id),
  access_point_id UUID NOT NULL REFERENCES access_points(id),

  -- Assignment period
  effective_from DATE NOT NULL,
  effective_until DATE,                    -- NULL for ongoing

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Prevent double-booking same guard at same time
  -- (actual conflict detection needs application logic due to time complexity)
  CONSTRAINT assignments_guard_shift_unique
    UNIQUE (guard_id, shift_id, access_point_id, effective_from)
);

-- Function to get guards on duty at a specific access point
CREATE OR REPLACE FUNCTION get_guards_on_duty(
  p_access_point_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF guards
LANGUAGE sql
STABLE
AS $$
  SELECT g.*
  FROM guards g
  JOIN shift_assignments sa ON sa.guard_id = g.id
  JOIN guard_shifts s ON s.id = sa.shift_id
  WHERE sa.access_point_id = p_access_point_id
    AND sa.status = 'active'
    AND sa.effective_from <= p_check_time::DATE
    AND (sa.effective_until IS NULL OR sa.effective_until >= p_check_time::DATE)
    AND (s.applicable_days IS NULL OR EXTRACT(DOW FROM p_check_time) = ANY(s.applicable_days))
    AND (
      -- Handle shifts that cross midnight
      CASE WHEN s.crosses_midnight THEN
        p_check_time::TIME >= s.start_time OR p_check_time::TIME <= s.end_time
      ELSE
        p_check_time::TIME BETWEEN s.start_time AND s.end_time
      END
    )
    AND g.deleted_at IS NULL
    AND g.employment_status = 'active';
$$;
```

### Pattern 6: Emergency Alerts with Dispatch Workflow

**What:** State machine for emergency lifecycle from trigger to resolution
**When to use:** Panic buttons, fire alarms, medical emergencies
**Why:** Audit trail of response times, escalation tracking, compliance

```sql
-- Emergency dispatch status
CREATE TYPE emergency_status AS ENUM (
  'triggered',     -- Alert activated
  'acknowledged',  -- Guard/dispatcher has seen it
  'responding',    -- Responders en route
  'on_scene',      -- Responders arrived
  'resolved',      -- Incident handled
  'false_alarm',   -- Determined to be false alarm
  'escalated'      -- Escalated to external services (911)
);

CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Alert type
  emergency_type emergency_type NOT NULL,  -- panic, medical, fire, intrusion
  priority priority_level NOT NULL DEFAULT 'critical',

  -- Who triggered
  triggered_by UUID REFERENCES auth.users(id),
  triggered_by_name TEXT,                  -- Denormalized
  triggered_by_unit_id UUID REFERENCES units(id),

  -- Location
  location_description TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  access_point_id UUID REFERENCES access_points(id),

  -- Current status
  status emergency_status NOT NULL DEFAULT 'triggered',

  -- Timestamps for SLA tracking
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES guards(id),
  response_started_at TIMESTAMPTZ,
  on_scene_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Resolution details
  resolution_type TEXT,                    -- 'handled', 'false_alarm', 'escalated_911'
  resolution_notes TEXT,

  -- External escalation
  escalated_to_911 BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMPTZ,
  external_reference TEXT,                 -- Police report number, etc.

  -- Evidence
  photos TEXT[],                           -- Array of Storage URLs
  audio_recording_url TEXT,                -- If panic button records audio

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Responders assigned to an emergency
CREATE TABLE emergency_responders (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  emergency_alert_id UUID NOT NULL REFERENCES emergency_alerts(id) ON DELETE CASCADE,

  guard_id UUID NOT NULL REFERENCES guards(id),

  -- Assignment
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),

  -- Response tracking
  acknowledged_at TIMESTAMPTZ,
  departed_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'en_route', 'on_scene', 'completed')),

  notes TEXT
);

-- Trigger to auto-set priority based on type
CREATE OR REPLACE FUNCTION set_emergency_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.priority IS NULL THEN
    NEW.priority := CASE NEW.emergency_type
      WHEN 'panic' THEN 'critical'
      WHEN 'fire' THEN 'critical'
      WHEN 'medical' THEN 'urgent'
      WHEN 'intrusion' THEN 'high'
      WHEN 'natural_disaster' THEN 'critical'
      ELSE 'high'
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER emergency_set_priority
  BEFORE INSERT ON emergency_alerts
  FOR EACH ROW
  EXECUTE FUNCTION set_emergency_priority();

-- Index for active emergencies (most common query)
CREATE INDEX idx_emergencies_active ON emergency_alerts(community_id, status, triggered_at DESC)
  WHERE status NOT IN ('resolved', 'false_alarm');
```

### Pattern 7: Blacklist with Evidence and Expiration

**What:** Banned persons with supporting evidence and automatic expiration
**When to use:** Security bans with legal documentation requirements
**Why:** Mexican law requires evidence for denying access; expiration prevents indefinite bans

```sql
CREATE TABLE blacklist_entries (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Who is blacklisted
  person_name TEXT NOT NULL,
  person_document TEXT,                    -- ID number if known
  person_photo_url TEXT,

  -- Vehicle if applicable
  vehicle_plate TEXT,
  vehicle_plate_normalized TEXT GENERATED ALWAYS AS (
    UPPER(REGEXP_REPLACE(vehicle_plate, '[^A-Z0-9]', '', 'g'))
  ) STORED,
  vehicle_description TEXT,

  -- Reason and evidence
  reason TEXT NOT NULL,
  incident_date DATE,
  evidence_photos TEXT[],                  -- Storage URLs
  evidence_documents TEXT[],               -- Police reports, etc.
  incident_description TEXT,

  -- Related incident/access log
  related_incident_id UUID,                -- Future: incidents table
  related_access_log_id UUID REFERENCES access_logs(id),

  -- Validity
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,                         -- NULL for permanent

  -- Protocol when encountered
  protocol TEXT NOT NULL DEFAULT 'deny_entry',  -- 'deny_entry', 'alert_only', 'call_police'
  alert_guards BOOLEAN NOT NULL DEFAULT TRUE,
  notify_admin BOOLEAN NOT NULL DEFAULT TRUE,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Who added/approved
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  -- If lifted early
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id),
  lifted_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Function to check if person/vehicle is blacklisted
CREATE OR REPLACE FUNCTION is_blacklisted(
  p_community_id UUID,
  p_person_name TEXT DEFAULT NULL,
  p_person_document TEXT DEFAULT NULL,
  p_plate_normalized TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_blocked BOOLEAN,
  blacklist_id UUID,
  reason TEXT,
  protocol TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    TRUE,
    b.id,
    b.reason,
    b.protocol
  FROM blacklist_entries b
  WHERE b.community_id = p_community_id
    AND b.status = 'active'
    AND b.deleted_at IS NULL
    AND b.effective_from <= CURRENT_DATE
    AND (b.expires_at IS NULL OR b.expires_at >= CURRENT_DATE)
    AND b.lifted_at IS NULL
    AND (
      (p_person_name IS NOT NULL AND b.person_name ILIKE '%' || p_person_name || '%')
      OR (p_person_document IS NOT NULL AND b.person_document = p_person_document)
      OR (p_plate_normalized IS NOT NULL AND b.vehicle_plate_normalized = p_plate_normalized)
    )
  LIMIT 1;
$$;

-- Indexes
CREATE INDEX idx_blacklist_active ON blacklist_entries(community_id)
  WHERE status = 'active' AND deleted_at IS NULL AND lifted_at IS NULL;
CREATE INDEX idx_blacklist_plate ON blacklist_entries(vehicle_plate_normalized)
  WHERE vehicle_plate_normalized IS NOT NULL AND status = 'active';
CREATE INDEX idx_blacklist_document ON blacklist_entries(person_document)
  WHERE person_document IS NOT NULL AND status = 'active';
```

### Anti-Patterns to Avoid

- **Storing access logs in application-controlled mutable table:** Use database triggers to enforce immutability, not application logic
- **Generating UUIDs for NFC checkpoints:** Use factory serial numbers; they're already unique and tamper-evident
- **Single QR code per resident without expiration:** Generate short-lived codes with signatures
- **Storing signing keys in public columns:** Use Supabase Vault or environment variables, never in regular tables
- **Not partitioning access logs:** High-volume tables need partitioning for maintenance
- **Blocking DELETE but allowing UPDATE:** Both must be blocked for true immutability

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC signatures | Custom hash function | pgcrypto hmac() | Cryptographically secure, well-tested |
| QR code generation | Custom encoding | Client library + server signing | QR encoding is complex; sign server-side only |
| Recurring schedule | Materialize all dates | PostgreSQL interval + DOW check | Infinite schedules, instant updates |
| Hash chaining | Manual concatenation | Generated column with sha256 | Database-enforced, cannot be bypassed |
| Shift overlap detection | Application validation | Database constraints + function | Can't be bypassed by direct DB access |

**Key insight:** Security-critical validation must happen at database level. Application bugs cannot compromise access log integrity or bypass blacklist checks.

## Common Pitfalls

### Pitfall 1: Access Logs Without Immutability Enforcement

**What goes wrong:** Logs can be modified to cover up security incidents
**Why it happens:** Relying on application logic or role permissions alone
**How to avoid:**
- Create BEFORE UPDATE and BEFORE DELETE triggers that RAISE EXCEPTION
- Revoke UPDATE and DELETE permissions at role level as backup
- Add hash chain column for tamper detection
**Warning signs:** Missing trigger on access_logs, UPDATE grants to application role

### Pitfall 2: QR Codes Without Expiration

**What goes wrong:** Screenshot of QR can be used months later
**Why it happens:** Convenience over security mindset
**How to avoid:**
- All QR codes must have valid_until timestamp
- Signature includes expiration, so expired codes fail verification
- Single-use codes burn after first scan
**Warning signs:** valid_until column is nullable or defaults to far future

### Pitfall 3: Invitation Validation Only at Creation

**What goes wrong:** Cancelled/expired invitations still grant access
**Why it happens:** Validation runs once when invitation created, not when used
**How to avoid:**
- Create is_invitation_valid() function called at access time
- Check: status, cancelled_at, valid_from/until, max_uses, times_used
- For recurring: also check day of week and time window
**Warning signs:** Access granted without invitation status check

### Pitfall 4: BRIN Index on Non-Correlated Data

**What goes wrong:** BRIN index scans entire table (worse than no index)
**Why it happens:** Using BRIN when data isn't insert-ordered
**How to avoid:**
- Only use BRIN on columns with physical-to-logical correlation
- Timestamps work because new rows append in order
- Don't use BRIN on randomly distributed IDs
**Warning signs:** BRIN on UUID columns, queries slower with BRIN than B-tree

### Pitfall 5: Blacklist Check Only on Name

**What goes wrong:** Person uses fake name to bypass blacklist
**Why it happens:** Only checking one identifier
**How to avoid:**
- Check multiple identifiers: name, document number, vehicle plate
- Store normalized plate for LPR matching
- Alert guards to manually verify suspicious matches
**Warning signs:** is_blacklisted() only accepts one parameter

### Pitfall 6: Emergency Response Time Not Tracked

**What goes wrong:** No data to improve response times or audit failures
**Why it happens:** Only storing trigger and resolution, not intermediate states
**How to avoid:**
- Track all state transitions with timestamps: acknowledged_at, response_started_at, on_scene_at
- Calculate response times as generated columns or in reports
- Store responder-specific arrival times in emergency_responders junction
**Warning signs:** Missing timestamp columns between triggered and resolved

## Code Examples

### Complete Access Points Table

```sql
-- Source: Phase 1 patterns + physical access control requirements
CREATE TYPE access_point_type AS ENUM (
  'vehicular_gate',    -- Car entry/exit
  'pedestrian_gate',   -- Walking entry
  'turnstile',         -- Single-person controlled entry
  'barrier',           -- Parking barrier
  'door',              -- Building door with access control
  'elevator'           -- Access-controlled elevator
);

CREATE TYPE access_point_direction AS ENUM (
  'entry',             -- Entry only
  'exit',              -- Exit only
  'bidirectional'      -- Both entry and exit
);

CREATE TABLE access_points (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  name TEXT NOT NULL,                       -- "Main Gate", "Tower A Entrance"
  code TEXT,                                -- Short code for guards: "MG", "T1"

  -- Type and direction
  access_point_type access_point_type NOT NULL,
  direction access_point_direction NOT NULL DEFAULT 'bidirectional',

  -- Location
  location_description TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),

  -- Capabilities
  has_lpr BOOLEAN NOT NULL DEFAULT FALSE,
  has_intercom BOOLEAN NOT NULL DEFAULT FALSE,
  has_camera BOOLEAN NOT NULL DEFAULT TRUE,
  has_nfc_reader BOOLEAN NOT NULL DEFAULT FALSE,
  has_qr_scanner BOOLEAN NOT NULL DEFAULT TRUE,
  can_remote_open BOOLEAN NOT NULL DEFAULT FALSE,

  -- Hardware identifiers (for integrations)
  lpr_device_id TEXT,
  camera_device_id TEXT,
  barrier_controller_id TEXT,

  -- Operating hours (NULL = 24/7)
  operating_start_time TIME,
  operating_end_time TIME,

  -- Status
  status general_status NOT NULL DEFAULT 'active',
  is_emergency_exit BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT access_points_name_unique UNIQUE (community_id, name)
);

-- RLS
ALTER TABLE access_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_community_access_points"
  ON access_points
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
  );
```

### Complete Patrol Routes and Logs

```sql
CREATE TABLE patrol_routes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  name TEXT NOT NULL,                       -- "Night Perimeter", "Pool Area"
  description TEXT,

  -- Expected duration
  estimated_duration_minutes INTEGER,

  -- Checkpoint sequence (ordered)
  checkpoint_sequence UUID[] NOT NULL,       -- Array of checkpoint IDs in order

  -- Schedule
  frequency_minutes INTEGER,                 -- How often route should be patrolled
  applicable_shifts UUID[],                  -- Which shifts patrol this route

  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE patrol_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Which patrol
  route_id UUID NOT NULL REFERENCES patrol_routes(id),
  guard_id UUID NOT NULL REFERENCES guards(id),

  -- Patrol timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

  -- Completion stats
  checkpoints_total INTEGER NOT NULL,
  checkpoints_visited INTEGER NOT NULL DEFAULT 0,

  -- If abandoned
  abandon_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual checkpoint scans
CREATE TABLE patrol_checkpoint_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  patrol_log_id UUID NOT NULL REFERENCES patrol_logs(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES patrol_checkpoints(id),

  -- Scan details
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nfc_serial_scanned TEXT NOT NULL,         -- What was actually scanned (verification)

  -- GPS at time of scan
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  gps_accuracy_meters NUMERIC(6, 2),

  -- GPS validation
  gps_within_tolerance BOOLEAN,

  -- Evidence
  photo_url TEXT,
  notes TEXT,

  -- Sequence
  sequence_order INTEGER NOT NULL            -- Position in route
);

-- Trigger to update patrol_logs.checkpoints_visited
CREATE OR REPLACE FUNCTION update_patrol_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE patrol_logs
  SET checkpoints_visited = checkpoints_visited + 1,
      updated_at = now()
  WHERE id = NEW.patrol_log_id;

  -- Check if patrol complete
  UPDATE patrol_logs
  SET status = 'completed',
      completed_at = now()
  WHERE id = NEW.patrol_log_id
    AND checkpoints_visited >= checkpoints_total;

  RETURN NEW;
END;
$$;

CREATE TRIGGER patrol_checkpoint_logged
  AFTER INSERT ON patrol_checkpoint_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_patrol_progress();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application-enforced immutability | Database triggers | Always best practice | Cannot bypass via direct DB |
| UUID for NFC checkpoints | Factory serial numbers | Standard practice | Hardware compatibility |
| B-tree for all indexes | BRIN for time-series | PostgreSQL 9.5+ | 1000x smaller indexes |
| Separate invitation tables per type | Single polymorphic table | Modern patterns | Simpler queries and RLS |
| Manual hash chains | Generated columns | PostgreSQL 12+ | Database-enforced |

**Deprecated/outdated:**
- Storing QR secrets in database tables: Use Supabase Vault or environment variables
- Monthly CRON jobs for expiring blacklists: Use effective date ranges with queries
- Single monolithic access_logs table: Partition by month for tables > 1M rows

## Open Questions

### 1. QR Secret Key Rotation Strategy

**What we know:** HMAC signing requires a shared secret between generator and verifier
**What's unclear:** How to rotate keys without invalidating existing QR codes
**Recommendation:** Store key version in QR payload; guards' app caches multiple keys; rotate monthly with overlap period. Store keys in Supabase Vault, not regular tables.

### 2. Access Log Partitioning Timeline

**What we know:** BRIN works well for moderate sizes; partitioning needed for very high volume
**What's unclear:** Exact threshold when to add partitioning (depends on access frequency)
**Recommendation:** Start without partitioning; add monthly partitions when table exceeds 1M rows or monthly inserts exceed 100K. Use BRIN immediately regardless.

### 3. LPR Integration Points

**What we know:** Need plate_detected field for LPR results, confidence scores
**What's unclear:** Which LPR vendor, exact API format, how to handle mismatches
**Recommendation:** Design generic fields now (plate_detected, lpr_confidence). Add lpr_metadata JSONB for vendor-specific data during integration phase.

### 4. Offline Sync Conflict Resolution for Access Decisions

**What we know:** Guards work offline; PowerSync syncs when connected
**What's unclear:** What if guard approves access offline but invitation was cancelled online?
**Recommendation:** Offline approval is final (better to let someone in than strand them). Log shows offline_decision=true. Sync cancellations for future checks but don't retroactively invalidate entries.

## Sources

### Primary (HIGH confidence)
- [PostgreSQL Trigger Documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html) - Immutability enforcement patterns
- [PostgreSQL BRIN Indexes](https://www.postgresql.org/docs/current/brin.html) - Time-series indexing
- [Crunchy Data BRIN Performance](https://www.crunchydata.com/blog/postgres-indexing-when-does-brin-win) - BRIN vs B-tree benchmarks
- [PostgreSQL Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) - High-volume table management

### Secondary (MEDIUM confidence)
- [Thoughtbot Recurring Events](https://thoughtbot.com/blog/recurring-events-and-postgresql) - Interval-based scheduling patterns
- [Design Gurus Audit Trail Patterns](https://www.designgurus.io/answers/detail/how-do-you-enforce-immutability-and-appendonly-audit-trails) - Immutability architectural principles
- [Signed QR Codes Implementation](https://github.com/oelna/signed-qr-codes) - Cryptographic signature patterns
- [TrackTik NFC Checkpoints](https://support.tracktik.com/hc/en-us/articles/360060063774-Create-a-checkpoint-with-an-NFC-chip-or-a-barcode) - NFC serial number usage in guard tour systems

### Tertiary (LOW confidence)
- Guard tour system comparisons - Market research, not technical specifications
- Emergency dispatch workflows - General patterns, not PostgreSQL-specific implementations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using PostgreSQL built-in features (triggers, BRIN, pgcrypto)
- Architecture patterns: HIGH - Based on PostgreSQL documentation and proven patterns
- Immutability enforcement: HIGH - PostgreSQL trigger behavior is well-documented
- QR signature pattern: MEDIUM - HMAC-SHA256 is standard but implementation details vary
- Emergency dispatch: MEDIUM - State machine pattern is standard; specific states based on industry practice
- NFC checkpoints: MEDIUM - Based on guard tour system documentation but hardware varies

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable domain, PostgreSQL patterns don't change frequently)
