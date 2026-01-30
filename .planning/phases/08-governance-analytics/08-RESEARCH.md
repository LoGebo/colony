# Phase 8: Governance & Analytics - Research

**Researched:** 2026-01-29
**Domain:** Incident management, voting/assemblies with Mexican condominium law, parking, access devices, violations, pre-computed analytics, and external integrations
**Confidence:** HIGH

## Summary

This phase completes the UPOE property management system with governance features (incidents, voting, violations), operational inventories (parking, access devices, emergency contacts), pre-computed analytics, and external integrations. The research focused on ten key questions: (1) incident timeline patterns using polymorphic event tables, (2) weighted voting with Mexican condominium coefficient (indiviso), (3) quorum calculation per Mexican law, (4) proxy delegation for assemblies, (5) parking spot inventory and assignment patterns, (6) access device lifecycle (assigned -> lost -> replaced), (7) violation escalation workflow, (8) materialized views vs summary tables for analytics, (9) webhook delivery with retry and exponential backoff, and (10) API key management with scopes.

The standard approach uses JSONB-based timeline tables for incident events (polymorphic history), coefficient-weighted voting that sums to 100% with the units.coefficient column from Phase 2, quorum validation per Mexican Ley de Propiedad en Condominio (75%/50%+1/any for 1st/2nd/3rd convocatoria), proxy delegation with maximum 2 units per representative, parking as an inventory with unit assignments and visitor reservations using time-range exclusion constraints, access device state machine with assignment history, violation escalation using trigger-based thresholds, summary tables with pg_cron refresh for analytics (not materialized views for PowerSync compatibility), webhook delivery queues with exponential backoff and dead letter queues, and API keys with hashed storage, scopes, and rotation tracking.

**Primary recommendation:** Use summary tables refreshed by pg_cron for analytics (PowerSync-compatible), implement coefficient-weighted voting with quorum validation functions per Mexican law, and build webhook delivery with a queue table using exponential backoff. Store API keys hashed with scope arrays and explicit expiration dates.

## Standard Stack

This phase continues PostgreSQL/Supabase schema patterns from previous phases.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15+ | Database with JSONB timelines, computed columns | Supabase default |
| pg_cron | 1.6.4 | Scheduled analytics refresh | Built into Supabase |
| pgcrypto | Built-in | API key hashing, webhook signatures | Cryptographic security |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Summary tables | Pre-computed KPIs | Dashboard analytics, reporting |
| BRIN indexes | Time-series queries | Analytics tables > 100K rows |
| pg_net extension | HTTP requests from database | Webhook delivery from triggers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Summary tables | Materialized views | Summary tables chosen: PowerSync compatible, incremental updates possible, explicit refresh control |
| JSONB timeline | Separate event rows | JSONB chosen: fewer joins, easier querying for UI timeline display, still queryable |
| Polling for webhooks | Realtime triggers | Queue chosen: retry capability, dead letter queue, delivery tracking |
| Plain text API keys | Hashed keys | Hashed chosen: security, can't reverse if leaked |

## Architecture Patterns

### Recommended Schema Structure

```
public/
  -- Incidents
  incident_types (category definitions)
  incidents (core incident records)
  incident_events (timeline: JSONB event log)
  incident_media (photos, videos, audio)
  incident_assignments (who is handling)

  -- Voting & Assemblies
  elections (board elections, decisions)
  election_options (candidates, choices)
  ballots (votes with coefficient weight)
  assemblies (events)
  assembly_attendance (who attended, proxies)
  assembly_agreements (decisions made)

  -- Parking
  parking_spots (inventory)
  parking_assignments (unit -> spot)
  parking_reservations (visitor time slots)
  parking_violations (evidence)

  -- Access Devices
  access_device_types (tag, remote, key, card)
  access_devices (inventory with serial numbers)
  access_device_assignments (who has what)
  access_device_events (assignment history)

  -- Emergency
  emergency_contacts (per resident)
  medical_conditions (allergies, conditions)
  accessibility_needs (special requirements)

  -- Violations
  violation_types (with default penalties)
  violations (records with evidence)
  violation_sanctions (warnings, fines)
  violation_appeals (dispute process)

  -- Analytics
  kpi_daily (pre-computed daily metrics)
  kpi_weekly (aggregated weekly)
  kpi_monthly (aggregated monthly)

  -- Integrations
  integration_configs (type, credentials, status)
  webhook_endpoints (URL, secret, events)
  webhook_deliveries (queue with retry)
  api_keys (hashed keys with scopes)
```

### Pattern 1: Incident Timeline with JSONB Events

**What:** Store incident history as JSONB array for efficient timeline display
**When to use:** Any entity requiring an activity feed/timeline
**Why:** Single query returns full timeline, supports polymorphic event types, UI-friendly

```sql
-- Source: History tracking patterns + Phase 7 audit patterns
CREATE TYPE incident_severity AS ENUM (
  'low',        -- Nuisance, non-urgent
  'medium',     -- Requires attention within 24h
  'high',       -- Requires immediate attention
  'critical'    -- Emergency, life/safety at risk
);

CREATE TYPE incident_status AS ENUM (
  'reported',      -- Initial report received
  'acknowledged',  -- Staff aware, not yet assigned
  'investigating', -- Under investigation
  'in_progress',   -- Resolution in progress
  'pending_review',-- Awaiting supervisor review
  'resolved',      -- Issue resolved
  'closed'         -- Formally closed
);

-- Incident types table
CREATE TABLE incident_types (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Type definition
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,  -- 'security', 'maintenance', 'noise', 'pet', 'parking', 'other'

  -- Default settings
  default_severity incident_severity NOT NULL DEFAULT 'medium',
  default_priority INTEGER NOT NULL DEFAULT 3,  -- 1=highest

  -- SLA (optional)
  sla_response_hours INTEGER,  -- Time to first response
  sla_resolution_hours INTEGER, -- Time to resolution

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT incident_types_unique UNIQUE (community_id, name)
);

-- Core incidents table
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Reference
  incident_number TEXT NOT NULL,  -- INC-2026-00001

  -- Classification
  incident_type_id UUID REFERENCES incident_types(id),
  severity incident_severity NOT NULL DEFAULT 'medium',
  priority INTEGER NOT NULL DEFAULT 3,

  -- Location
  location_type TEXT,  -- 'common_area', 'unit', 'parking', 'entrance', 'other'
  location_description TEXT,
  unit_id UUID REFERENCES units(id),  -- If unit-related
  access_point_id UUID REFERENCES access_points(id),  -- If entrance-related
  gps_latitude NUMERIC(10,7),
  gps_longitude NUMERIC(10,7),

  -- Description
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Reporter
  reported_by UUID REFERENCES residents(id),
  reported_by_guard UUID REFERENCES guards(id),
  reporter_name TEXT,  -- If anonymous or external
  reporter_phone TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status
  status incident_status NOT NULL DEFAULT 'reported',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- SLA tracking
  first_response_at TIMESTAMPTZ,
  sla_response_breached BOOLEAN GENERATED ALWAYS AS (
    first_response_at IS NULL AND
    reported_at + (SELECT sla_response_hours * INTERVAL '1 hour'
                   FROM incident_types WHERE id = incident_type_id) < now()
  ) STORED,

  -- Timeline (polymorphic event log as JSONB)
  -- Each event: { type, timestamp, actor_id, actor_name, data: {...} }
  timeline JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT incidents_number_unique UNIQUE (community_id, incident_number)
);

-- Timeline event types:
-- 'created' - Incident reported
-- 'status_changed' - Status transition (data: {from, to})
-- 'assigned' - Assigned to user (data: {user_id, user_name})
-- 'comment' - Comment added (data: {text, is_internal})
-- 'media_added' - Photo/video added (data: {media_id, type})
-- 'escalated' - Priority increased (data: {from, to, reason})
-- 'resolution' - Resolution attempt (data: {notes, successful})

-- Function to add timeline event
CREATE OR REPLACE FUNCTION add_incident_event(
  p_incident_id UUID,
  p_event_type TEXT,
  p_actor_id UUID,
  p_data JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_name TEXT;
  v_event JSONB;
BEGIN
  -- Get actor name
  SELECT COALESCE(full_name, email) INTO v_actor_name
  FROM residents WHERE id = p_actor_id;

  IF v_actor_name IS NULL THEN
    SELECT name INTO v_actor_name
    FROM guards WHERE user_id = p_actor_id;
  END IF;

  -- Build event
  v_event := jsonb_build_object(
    'id', generate_uuid_v7(),
    'type', p_event_type,
    'timestamp', now(),
    'actor_id', p_actor_id,
    'actor_name', COALESCE(v_actor_name, 'System'),
    'data', p_data
  );

  -- Append to timeline
  UPDATE incidents
  SET timeline = timeline || v_event,
      updated_at = now()
  WHERE id = p_incident_id;

  RETURN (v_event->>'id')::UUID;
END;
$$;

-- Trigger to auto-add status change events
CREATE OR REPLACE FUNCTION incident_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at := now();
    NEW.timeline := NEW.timeline || jsonb_build_object(
      'id', generate_uuid_v7(),
      'type', 'status_changed',
      'timestamp', now(),
      'actor_id', auth.uid(),
      'actor_name', 'System',
      'data', jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );

    -- Track first response
    IF OLD.status = 'reported' AND NEW.status != 'reported' THEN
      NEW.first_response_at := now();
    END IF;

    -- Track resolution
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
      NEW.resolved_at := now();
      NEW.resolved_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER incident_status_trigger
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION incident_status_changed();

-- Incident media table (photos, videos)
CREATE TABLE incident_media (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Media details
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'audio', 'document')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes INTEGER,

  -- Metadata
  caption TEXT,
  taken_at TIMESTAMPTZ,

  -- For audio: transcription
  transcription TEXT,

  -- Audit
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Incident assignments
CREATE TABLE incident_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,

  -- Assignment
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  assigned_by UUID REFERENCES auth.users(id),

  -- Role in incident
  role TEXT NOT NULL DEFAULT 'handler' CHECK (role IN ('handler', 'supervisor', 'observer')),

  -- Validity
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,

  -- Reason for assignment change
  notes TEXT
);
```

### Pattern 2: Weighted Voting with Mexican Coefficient

**What:** Votes weighted by unit coefficient (indiviso) per Mexican condominium law
**When to use:** Board elections, extraordinary decisions, assembly voting
**Why:** Legal requirement under Ley de Propiedad en Condominio

```sql
-- Source: Mexican Ley de Propiedad en Condominio + Phase 2 coefficient pattern
CREATE TYPE election_type AS ENUM (
  'board_election',         -- Electing board members
  'bylaw_amendment',        -- Changing reglamento
  'extraordinary_expense',  -- Approving special assessment
  'general_decision'        -- Other assembly decisions
);

CREATE TYPE election_status AS ENUM (
  'draft',        -- Being prepared
  'scheduled',    -- Approved, waiting for date
  'open',         -- Voting in progress
  'closed',       -- Voting ended, counting
  'certified',    -- Results certified
  'cancelled'
);

CREATE TABLE elections (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Reference
  election_number TEXT NOT NULL,  -- ELEC-2026-001

  -- Type and description
  election_type election_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Rules
  min_options_selectable INTEGER NOT NULL DEFAULT 1,  -- Minimum choices required
  max_options_selectable INTEGER NOT NULL DEFAULT 1,  -- Maximum choices allowed

  -- Voting period
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,

  -- Status
  status election_status NOT NULL DEFAULT 'draft',

  -- Quorum requirement (percentage of coefficient)
  -- Mexican law: 75% first call, 50%+1 second, any third
  quorum_required NUMERIC(5,2) NOT NULL DEFAULT 50.01,

  -- Results (computed after closing)
  total_coefficient_voted NUMERIC(7,4) DEFAULT 0,
  quorum_met BOOLEAN,

  -- Certification
  certified_at TIMESTAMPTZ,
  certified_by UUID REFERENCES auth.users(id),

  -- Related assembly
  assembly_id UUID REFERENCES assemblies(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT elections_number_unique UNIQUE (community_id, election_number),
  CONSTRAINT elections_valid_dates CHECK (closes_at > opens_at)
);

-- Election options (candidates or choices)
CREATE TABLE election_options (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,

  -- Option details
  title TEXT NOT NULL,
  description TEXT,

  -- For board elections: candidate info
  candidate_resident_id UUID REFERENCES residents(id),
  candidate_photo_url TEXT,

  -- Display order
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Results (computed after closing)
  votes_count INTEGER DEFAULT 0,
  coefficient_total NUMERIC(7,4) DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ballots (votes)
CREATE TABLE ballots (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  election_id UUID NOT NULL REFERENCES elections(id),

  -- Voter identification
  unit_id UUID NOT NULL REFERENCES units(id),
  voted_by UUID NOT NULL REFERENCES residents(id),  -- The person who voted

  -- Coefficient weight (copied from unit at vote time for immutability)
  vote_weight NUMERIC(7,4) NOT NULL,

  -- Selected options (array for multi-select elections)
  selected_options UUID[] NOT NULL,

  -- Proxy voting
  is_proxy_vote BOOLEAN NOT NULL DEFAULT false,
  proxy_for_resident_id UUID REFERENCES residents(id),  -- Original unit owner
  proxy_document_url TEXT,  -- Carta poder

  -- Verification
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,

  -- One vote per unit per election
  CONSTRAINT ballots_one_per_unit UNIQUE (election_id, unit_id),

  -- Proxy can't vote for more than 2 units (Mexican law)
  CONSTRAINT ballots_proxy_limit CHECK (
    NOT is_proxy_vote OR
    (SELECT COUNT(*) FROM ballots b2
     WHERE b2.election_id = election_id
       AND b2.voted_by = voted_by
       AND b2.is_proxy_vote = true) <= 2
  )
);

-- Function to cast a vote with validation
CREATE OR REPLACE FUNCTION cast_vote(
  p_election_id UUID,
  p_unit_id UUID,
  p_selected_options UUID[],
  p_is_proxy BOOLEAN DEFAULT false,
  p_proxy_for UUID DEFAULT NULL,
  p_proxy_document TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_election elections;
  v_unit units;
  v_voter_id UUID := auth.uid();
  v_ballot_id UUID;
  v_proxy_count INTEGER;
  v_occupancy occupancies;
BEGIN
  -- Get election
  SELECT * INTO v_election FROM elections WHERE id = p_election_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Election not found';
  END IF;

  IF v_election.status != 'open' THEN
    RAISE EXCEPTION 'Election is not open for voting';
  END IF;

  IF now() < v_election.opens_at OR now() > v_election.closes_at THEN
    RAISE EXCEPTION 'Election is outside voting period';
  END IF;

  -- Validate option count
  IF array_length(p_selected_options, 1) < v_election.min_options_selectable THEN
    RAISE EXCEPTION 'Must select at least % options', v_election.min_options_selectable;
  END IF;

  IF array_length(p_selected_options, 1) > v_election.max_options_selectable THEN
    RAISE EXCEPTION 'Cannot select more than % options', v_election.max_options_selectable;
  END IF;

  -- Get unit and coefficient
  SELECT * INTO v_unit FROM units
  WHERE id = p_unit_id AND community_id = v_election.community_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unit not found in this community';
  END IF;

  -- Verify voter has right to vote for this unit
  IF p_is_proxy THEN
    -- Proxy vote: check proxy limit (max 2 units)
    SELECT COUNT(*) INTO v_proxy_count
    FROM ballots
    WHERE election_id = p_election_id
      AND voted_by = v_voter_id
      AND is_proxy_vote = true;

    IF v_proxy_count >= 2 THEN
      RAISE EXCEPTION 'Cannot represent more than 2 units by proxy (Mexican law)';
    END IF;

    IF p_proxy_document IS NULL THEN
      RAISE EXCEPTION 'Proxy vote requires carta poder document';
    END IF;
  ELSE
    -- Direct vote: verify occupancy
    SELECT * INTO v_occupancy
    FROM occupancies
    WHERE unit_id = p_unit_id
      AND resident_id = v_voter_id
      AND occupancy_type IN ('owner', 'tenant')
      AND status = 'active'
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'You are not authorized to vote for this unit';
    END IF;
  END IF;

  -- Check unit hasn't voted already
  IF EXISTS (SELECT 1 FROM ballots WHERE election_id = p_election_id AND unit_id = p_unit_id) THEN
    RAISE EXCEPTION 'This unit has already voted in this election';
  END IF;

  -- Check voter has no suspended voting rights (morosidad)
  -- This would check against financial standing if implemented

  -- Cast vote
  INSERT INTO ballots (
    election_id, unit_id, voted_by, vote_weight,
    selected_options, is_proxy_vote, proxy_for_resident_id, proxy_document_url
  ) VALUES (
    p_election_id, p_unit_id, v_voter_id, v_unit.coefficient,
    p_selected_options, p_is_proxy, p_proxy_for, p_proxy_document
  ) RETURNING id INTO v_ballot_id;

  -- Update election totals
  UPDATE elections
  SET total_coefficient_voted = total_coefficient_voted + v_unit.coefficient
  WHERE id = p_election_id;

  -- Update option totals
  UPDATE election_options
  SET votes_count = votes_count + 1,
      coefficient_total = coefficient_total + v_unit.coefficient
  WHERE id = ANY(p_selected_options);

  RETURN v_ballot_id;
END;
$$;

-- Function to check quorum
CREATE OR REPLACE FUNCTION check_election_quorum(p_election_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_election elections;
  v_total_coefficient NUMERIC(7,4);
  v_voted_coefficient NUMERIC(7,4);
  v_percentage NUMERIC(5,2);
BEGIN
  SELECT * INTO v_election FROM elections WHERE id = p_election_id;

  -- Get total community coefficient (should be ~100)
  SELECT COALESCE(SUM(coefficient), 0) INTO v_total_coefficient
  FROM units
  WHERE community_id = v_election.community_id
    AND deleted_at IS NULL
    AND status = 'active';

  -- Get voted coefficient
  SELECT COALESCE(SUM(vote_weight), 0) INTO v_voted_coefficient
  FROM ballots
  WHERE election_id = p_election_id;

  -- Calculate percentage
  IF v_total_coefficient > 0 THEN
    v_percentage := (v_voted_coefficient / v_total_coefficient) * 100;
  ELSE
    v_percentage := 0;
  END IF;

  -- Update election
  UPDATE elections
  SET total_coefficient_voted = v_voted_coefficient,
      quorum_met = v_percentage >= quorum_required
  WHERE id = p_election_id;

  RETURN v_percentage >= v_election.quorum_required;
END;
$$;
```

### Pattern 3: Assembly Events with Attendance and Proxy

**What:** Track assembly meetings with attendance, proxy delegation, and agreements
**When to use:** Formal condominium assemblies (asambleas ordinarias/extraordinarias)
**Why:** Legal documentation required by Mexican law

```sql
-- Source: Mexican Ley de Propiedad en Condominio requirements
CREATE TYPE assembly_type AS ENUM (
  'ordinary',       -- Regular (yearly) assembly
  'extraordinary'   -- Special assembly for specific matters
);

CREATE TYPE assembly_status AS ENUM (
  'scheduled',
  'convocatoria_1',  -- First call (75% quorum required)
  'convocatoria_2',  -- Second call (50%+1 quorum required)
  'convocatoria_3',  -- Third call (any attendance valid)
  'in_progress',
  'concluded',
  'cancelled'
);

CREATE TABLE assemblies (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Reference
  assembly_number TEXT NOT NULL,  -- ASM-2026-001

  -- Type and details
  assembly_type assembly_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  location TEXT,  -- Physical or virtual
  meeting_url TEXT,  -- For virtual assemblies

  -- Status
  status assembly_status NOT NULL DEFAULT 'scheduled',

  -- Convocatoria tracking (Mexican law requires specific timing)
  convocatoria_1_at TIMESTAMPTZ,  -- First call time
  convocatoria_2_at TIMESTAMPTZ,  -- 30 min after first
  convocatoria_3_at TIMESTAMPTZ,  -- 30 min after second

  -- Quorum
  quorum_coefficient_present NUMERIC(7,4) DEFAULT 0,
  quorum_percentage NUMERIC(5,2) DEFAULT 0,
  quorum_met BOOLEAN DEFAULT false,

  -- Actual times
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Documentation
  agenda_document_id UUID,  -- REFERENCES documents(id)
  minutes_document_id UUID,  -- REFERENCES documents(id)

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT assemblies_number_unique UNIQUE (community_id, assembly_number)
);

-- Assembly attendance with proxy tracking
CREATE TABLE assembly_attendance (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,

  -- Unit being represented
  unit_id UUID NOT NULL REFERENCES units(id),
  coefficient NUMERIC(7,4) NOT NULL,  -- Copied at attendance time

  -- Who is present
  attendee_type TEXT NOT NULL CHECK (attendee_type IN ('owner', 'representative', 'proxy')),
  resident_id UUID REFERENCES residents(id),  -- If resident
  attendee_name TEXT,  -- For non-resident representatives

  -- Proxy delegation
  is_proxy BOOLEAN NOT NULL DEFAULT false,
  proxy_grantor_id UUID REFERENCES residents(id),  -- Who gave the proxy
  proxy_document_url TEXT,  -- Carta poder scan

  -- Check-in
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ,  -- If they leave early

  -- Convocatoria they arrived for
  arrived_at_convocatoria INTEGER CHECK (arrived_at_convocatoria BETWEEN 1 AND 3),

  -- One attendance per unit per assembly
  CONSTRAINT attendance_one_per_unit UNIQUE (assembly_id, unit_id)
);

-- Validate proxy limit (max 2 units)
CREATE OR REPLACE FUNCTION validate_proxy_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_proxy_count INTEGER;
BEGIN
  IF NEW.is_proxy AND NEW.resident_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_proxy_count
    FROM assembly_attendance
    WHERE assembly_id = NEW.assembly_id
      AND resident_id = NEW.resident_id
      AND is_proxy = true
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    IF v_proxy_count >= 2 THEN
      RAISE EXCEPTION 'A person cannot represent more than 2 units by proxy (Mexican law)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assembly_attendance_proxy_limit
  BEFORE INSERT OR UPDATE ON assembly_attendance
  FOR EACH ROW
  EXECUTE FUNCTION validate_proxy_limit();

-- Assembly agreements/resolutions
CREATE TABLE assembly_agreements (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  assembly_id UUID NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,

  -- Agreement details
  agreement_number INTEGER NOT NULL,  -- Order in assembly
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Related election (if voted)
  election_id UUID REFERENCES elections(id),

  -- Approval status
  approved BOOLEAN,
  votes_for_coefficient NUMERIC(7,4),
  votes_against_coefficient NUMERIC(7,4),
  abstentions_coefficient NUMERIC(7,4),

  -- Action items
  action_required BOOLEAN DEFAULT false,
  action_description TEXT,
  action_due_date DATE,
  action_responsible TEXT,
  action_completed_at TIMESTAMPTZ,

  -- Order
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to calculate assembly quorum
CREATE OR REPLACE FUNCTION calculate_assembly_quorum(p_assembly_id UUID)
RETURNS TABLE (
  total_coefficient NUMERIC(7,4),
  present_coefficient NUMERIC(7,4),
  percentage NUMERIC(5,2),
  quorum_met BOOLEAN,
  required_for_convocatoria_1 BOOLEAN,
  required_for_convocatoria_2 BOOLEAN,
  required_for_convocatoria_3 BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_community_id UUID;
  v_total NUMERIC(7,4);
  v_present NUMERIC(7,4);
  v_pct NUMERIC(5,2);
BEGIN
  -- Get community
  SELECT community_id INTO v_community_id
  FROM assemblies WHERE id = p_assembly_id;

  -- Total coefficient in community
  SELECT COALESCE(SUM(coefficient), 0) INTO v_total
  FROM units
  WHERE community_id = v_community_id
    AND status = 'active'
    AND deleted_at IS NULL;

  -- Present coefficient
  SELECT COALESCE(SUM(coefficient), 0) INTO v_present
  FROM assembly_attendance
  WHERE assembly_id = p_assembly_id
    AND checked_out_at IS NULL;

  -- Calculate percentage
  IF v_total > 0 THEN
    v_pct := (v_present / v_total) * 100;
  ELSE
    v_pct := 0;
  END IF;

  -- Update assembly record
  UPDATE assemblies
  SET quorum_coefficient_present = v_present,
      quorum_percentage = v_pct,
      quorum_met = v_pct >= 50.01 OR status = 'convocatoria_3'
  WHERE id = p_assembly_id;

  RETURN QUERY SELECT
    v_total,
    v_present,
    v_pct,
    v_pct >= 50.01 OR (SELECT status FROM assemblies WHERE id = p_assembly_id) = 'convocatoria_3',
    v_pct >= 75.00,      -- First convocatoria requires 75%
    v_pct >= 50.01,      -- Second convocatoria requires 50%+1
    true;                 -- Third convocatoria accepts any
END;
$$;
```

### Pattern 4: Parking Inventory with Assignments and Reservations

**What:** Track parking spots, assignments to units, and visitor reservations
**When to use:** Managed parking in condominiums
**Why:** Prevent conflicts, track violations, support visitor parking

```sql
-- Source: Parking lot system design patterns
CREATE TYPE parking_spot_type AS ENUM (
  'assigned',    -- Belongs to specific unit
  'visitor',     -- For guests, first-come or reservation
  'commercial',  -- For commercial units/businesses
  'disabled',    -- Accessible parking
  'loading',     -- Loading/unloading zone
  'reserved'     -- Reserved for specific purpose
);

CREATE TYPE parking_spot_status AS ENUM (
  'available',
  'occupied',
  'reserved',
  'maintenance',
  'blocked'
);

-- Parking spot inventory
CREATE TABLE parking_spots (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  spot_number TEXT NOT NULL,  -- "A-01", "V-05"
  spot_type parking_spot_type NOT NULL,

  -- Location
  area TEXT,            -- "Building A", "Outdoor", "Basement 1"
  level TEXT,           -- Floor/level
  section TEXT,         -- Zone within level

  -- Physical characteristics
  is_covered BOOLEAN NOT NULL DEFAULT false,
  is_electric_vehicle BOOLEAN NOT NULL DEFAULT false,
  width_meters NUMERIC(4,2),
  length_meters NUMERIC(4,2),

  -- Status
  status parking_spot_status NOT NULL DEFAULT 'available',

  -- For assigned spots: linked unit
  assigned_unit_id UUID REFERENCES units(id),

  -- Fees (if applicable)
  monthly_fee money_amount DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT parking_spots_unique UNIQUE (community_id, spot_number)
);

-- Parking assignments (unit -> spot relationship)
CREATE TABLE parking_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  parking_spot_id UUID NOT NULL REFERENCES parking_spots(id),
  unit_id UUID NOT NULL REFERENCES units(id),

  -- Vehicle (optional - spot may be assigned but vehicle unknown)
  vehicle_id UUID REFERENCES vehicles(id),

  -- Validity
  assigned_from DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_until DATE,  -- NULL = permanent

  -- Assignment type
  assignment_type TEXT NOT NULL DEFAULT 'ownership'
    CHECK (assignment_type IN ('ownership', 'rental', 'temporary')),

  -- For rentals
  monthly_rate money_amount,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- One active assignment per spot
  CONSTRAINT parking_assignments_one_active UNIQUE (parking_spot_id)
    WHERE is_active = true
);

-- Visitor parking reservations
CREATE TABLE parking_reservations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  parking_spot_id UUID NOT NULL REFERENCES parking_spots(id),

  -- Who is reserving
  unit_id UUID NOT NULL REFERENCES units(id),
  resident_id UUID NOT NULL REFERENCES residents(id),

  -- Visitor info
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  visitor_vehicle_plates TEXT,
  visitor_vehicle_description TEXT,

  -- Time slot
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),

  -- Actual usage
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),

  -- Prevent overlapping reservations (exclusion constraint)
  CONSTRAINT parking_no_overlap EXCLUDE USING gist (
    parking_spot_id WITH =,
    tstzrange(
      reservation_date + start_time,
      reservation_date + end_time
    ) WITH &&
  ) WHERE (status IN ('pending', 'confirmed'))
);

-- Parking violations
CREATE TABLE parking_violations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Location
  parking_spot_id UUID REFERENCES parking_spots(id),
  location_description TEXT,  -- If not in a specific spot

  -- Violator
  vehicle_id UUID REFERENCES vehicles(id),  -- If known
  vehicle_plates TEXT,  -- As observed
  vehicle_description TEXT,

  -- Violation details
  violation_type TEXT NOT NULL,  -- 'unauthorized_parking', 'double_parking', 'blocking', 'overstay'
  description TEXT NOT NULL,

  -- Evidence
  photo_urls TEXT[],

  -- Timing
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_by UUID REFERENCES auth.users(id),

  -- Resolution
  status TEXT NOT NULL DEFAULT 'reported'
    CHECK (status IN ('reported', 'warned', 'fined', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Link to violation record (if fine issued)
  violation_record_id UUID,  -- REFERENCES violations(id) - circular dependency

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Pattern 5: Access Device Lifecycle with Assignment History

**What:** Track access devices (tags, remotes, keys, cards) through their lifecycle
**When to use:** Managing physical access credentials
**Why:** Audit trail, lost device handling, inventory management

```sql
-- Source: Key fob access control systems + Phase 3 access patterns
CREATE TYPE device_type AS ENUM (
  'rfid_tag',     -- Proximity tag/fob
  'rfid_card',    -- Proximity card
  'remote',       -- Gate remote control
  'physical_key', -- Traditional key
  'transponder',  -- Vehicle transponder
  'biometric'     -- Biometric enrollment (fingerprint, etc.)
);

CREATE TYPE device_status AS ENUM (
  'in_inventory',  -- Available for assignment
  'assigned',      -- Currently assigned to someone
  'lost',          -- Reported lost
  'damaged',       -- Damaged, needs replacement
  'deactivated',   -- Intentionally disabled
  'retired'        -- Permanently out of service
);

-- Device type definitions
CREATE TABLE access_device_types (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Type info
  device_type device_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Access points this type can open
  access_point_ids UUID[],  -- NULL = all access points

  -- Fees
  deposit_amount money_amount DEFAULT 0,
  replacement_fee money_amount DEFAULT 0,

  -- Active
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT device_types_unique UNIQUE (community_id, name)
);

-- Device inventory
CREATE TABLE access_devices (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  device_type_id UUID NOT NULL REFERENCES access_device_types(id),

  -- Identification
  serial_number TEXT NOT NULL,
  internal_code TEXT,  -- RFID code, key number, etc.

  -- Batch/purchase info
  batch_number TEXT,
  purchased_at DATE,
  vendor TEXT,

  -- Status
  status device_status NOT NULL DEFAULT 'in_inventory',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Current assignment (denormalized for quick lookup)
  current_assignment_id UUID,  -- REFERENCES access_device_assignments(id)

  -- Lost/damaged tracking
  lost_reported_at TIMESTAMPTZ,
  lost_reported_by UUID REFERENCES auth.users(id),
  damaged_reported_at TIMESTAMPTZ,
  damage_notes TEXT,

  -- Deactivation
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id),
  deactivation_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT access_devices_serial_unique UNIQUE (community_id, serial_number)
);

-- Device assignments (history of who had what)
CREATE TABLE access_device_assignments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  access_device_id UUID NOT NULL REFERENCES access_devices(id),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Assignee (one of these)
  unit_id UUID REFERENCES units(id),
  resident_id UUID REFERENCES residents(id),
  guard_id UUID REFERENCES guards(id),
  provider_personnel_id UUID REFERENCES provider_personnel(id),

  -- Assignment period
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  returned_at TIMESTAMPTZ,
  returned_to UUID REFERENCES auth.users(id),

  -- Deposit
  deposit_collected BOOLEAN NOT NULL DEFAULT false,
  deposit_amount money_amount,
  deposit_returned_at TIMESTAMPTZ,

  -- Return condition
  return_condition TEXT CHECK (return_condition IN ('good', 'damaged', 'lost', 'not_returned')),
  condition_notes TEXT,

  -- Replacement fee charged
  replacement_fee_charged BOOLEAN DEFAULT false,

  -- Active flag (only one active assignment per device)
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Trigger to update device status on assignment
CREATE OR REPLACE FUNCTION update_device_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New assignment
    UPDATE access_devices
    SET status = 'assigned',
        status_changed_at = now(),
        current_assignment_id = NEW.id
    WHERE id = NEW.access_device_id;

  ELSIF TG_OP = 'UPDATE' AND NEW.returned_at IS NOT NULL AND OLD.returned_at IS NULL THEN
    -- Device returned
    UPDATE access_devices
    SET status = CASE
          WHEN NEW.return_condition = 'lost' THEN 'lost'::device_status
          WHEN NEW.return_condition = 'damaged' THEN 'damaged'::device_status
          ELSE 'in_inventory'::device_status
        END,
        status_changed_at = now(),
        current_assignment_id = NULL,
        lost_reported_at = CASE WHEN NEW.return_condition = 'lost' THEN now() ELSE NULL END
    WHERE id = NEW.access_device_id;

    -- Deactivate the assignment
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER access_device_assignment_status
  AFTER INSERT OR UPDATE ON access_device_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_device_on_assignment();

-- Device events log (detailed history)
CREATE TABLE access_device_events (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  access_device_id UUID NOT NULL REFERENCES access_devices(id),

  -- Event type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'assigned', 'returned', 'lost', 'found',
    'damaged', 'deactivated', 'reactivated', 'retired'
  )),

  -- Details
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Actor
  performed_by UUID REFERENCES auth.users(id),

  -- Timestamp
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to report device as lost
CREATE OR REPLACE FUNCTION report_device_lost(
  p_device_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignment access_device_assignments;
BEGIN
  -- Get current assignment
  SELECT * INTO v_assignment
  FROM access_device_assignments
  WHERE access_device_id = p_device_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device is not currently assigned';
  END IF;

  -- Update assignment
  UPDATE access_device_assignments
  SET returned_at = now(),
      return_condition = 'lost',
      condition_notes = p_notes,
      replacement_fee_charged = true
  WHERE id = v_assignment.id;

  -- Log event
  INSERT INTO access_device_events (access_device_id, event_type, description, performed_by)
  VALUES (p_device_id, 'lost', COALESCE(p_notes, 'Device reported lost'), auth.uid());

  -- Device status updated via trigger
END;
$$;
```

### Pattern 6: Violation Escalation Workflow

**What:** Track violations with escalating sanctions and appeal process
**When to use:** Enforcing community rules with formal process
**Why:** Legal protection, fair process, documentation

```sql
-- Source: HOA violation management patterns
CREATE TYPE violation_severity AS ENUM (
  'minor',     -- Warning only
  'moderate',  -- Fine possible
  'major',     -- Fine required
  'severe'     -- May result in access suspension
);

CREATE TYPE sanction_type AS ENUM (
  'verbal_warning',
  'written_warning',
  'fine',
  'amenity_suspension',
  'access_restriction',
  'legal_action'
);

-- Violation types
CREATE TABLE violation_types (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Definition
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'noise', 'parking', 'pet', 'common_area', 'payment', 'other'

  -- Default severity and penalties
  default_severity violation_severity NOT NULL DEFAULT 'minor',

  -- Escalation thresholds
  escalate_after_count INTEGER NOT NULL DEFAULT 3,  -- After N violations, escalate

  -- Default penalties
  first_offense_fine money_amount DEFAULT 0,
  second_offense_fine money_amount DEFAULT 0,
  third_offense_fine money_amount DEFAULT 0,

  -- Consequences
  can_suspend_amenities BOOLEAN DEFAULT false,
  can_restrict_access BOOLEAN DEFAULT false,

  -- Active
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT violation_types_unique UNIQUE (community_id, name)
);

-- Violation records
CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Reference
  violation_number TEXT NOT NULL,  -- VIOL-2026-00001

  -- Type
  violation_type_id UUID NOT NULL REFERENCES violation_types(id),
  severity violation_severity NOT NULL,

  -- Violator
  unit_id UUID NOT NULL REFERENCES units(id),
  resident_id UUID REFERENCES residents(id),  -- If specific person

  -- Details
  description TEXT NOT NULL,
  location TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,

  -- Evidence
  photo_urls TEXT[],
  video_urls TEXT[],
  witness_names TEXT[],

  -- Reporter
  reported_by UUID REFERENCES auth.users(id),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN (
    'reported', 'under_review', 'confirmed', 'sanctioned',
    'appealed', 'appeal_denied', 'appeal_granted', 'closed', 'dismissed'
  )),

  -- Repeat offense tracking
  offense_number INTEGER NOT NULL DEFAULT 1,  -- 1st, 2nd, 3rd offense
  previous_violation_id UUID REFERENCES violations(id),

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT violations_number_unique UNIQUE (community_id, violation_number)
);

-- Calculate offense number for repeat violations
CREATE OR REPLACE FUNCTION calculate_offense_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous_count INTEGER;
  v_last_violation violations;
BEGIN
  -- Count previous violations of same type for same unit (in last 12 months)
  SELECT COUNT(*), MAX(id) INTO v_previous_count
  FROM (
    SELECT id FROM violations
    WHERE community_id = NEW.community_id
      AND unit_id = NEW.unit_id
      AND violation_type_id = NEW.violation_type_id
      AND status IN ('confirmed', 'sanctioned', 'appeal_denied', 'closed')
      AND occurred_at > now() - INTERVAL '12 months'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) previous;

  NEW.offense_number := v_previous_count + 1;

  -- Link to most recent
  IF v_previous_count > 0 THEN
    SELECT id INTO NEW.previous_violation_id
    FROM violations
    WHERE community_id = NEW.community_id
      AND unit_id = NEW.unit_id
      AND violation_type_id = NEW.violation_type_id
      AND status IN ('confirmed', 'sanctioned', 'appeal_denied', 'closed')
      AND occurred_at > now() - INTERVAL '12 months'
    ORDER BY occurred_at DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER violations_offense_number
  BEFORE INSERT ON violations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_offense_number();

-- Sanctions
CREATE TABLE violation_sanctions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,

  -- Sanction details
  sanction_type sanction_type NOT NULL,
  description TEXT NOT NULL,

  -- For fines
  fine_amount money_amount,
  transaction_id UUID,  -- REFERENCES transactions(id) when fine is posted

  -- For suspensions
  suspension_start DATE,
  suspension_end DATE,
  suspended_amenities UUID[],  -- Array of amenity IDs

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'notified', 'acknowledged', 'paid', 'served', 'appealed', 'cancelled'
  )),

  -- Notification
  notified_at TIMESTAMPTZ,
  notification_method TEXT,  -- 'email', 'letter', 'in_person'

  -- Issued by
  issued_by UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appeals
CREATE TABLE violation_appeals (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  violation_id UUID NOT NULL REFERENCES violations(id),
  sanction_id UUID REFERENCES violation_sanctions(id),

  -- Appellant
  appealed_by UUID NOT NULL REFERENCES residents(id),

  -- Appeal details
  appeal_reason TEXT NOT NULL,
  supporting_documents TEXT[],  -- Storage URLs

  -- Status
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'hearing_scheduled', 'granted', 'denied', 'withdrawn'
  )),

  -- Hearing (if applicable)
  hearing_date DATE,
  hearing_notes TEXT,

  -- Resolution
  decision TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,

  -- If granted
  fine_reduced_to money_amount,
  sanction_modified_to TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update violation status when appealed
CREATE OR REPLACE FUNCTION update_violation_on_appeal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE violations SET status = 'appealed' WHERE id = NEW.violation_id;
    UPDATE violation_sanctions SET status = 'appealed' WHERE id = NEW.sanction_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'granted' AND OLD.status != 'granted' THEN
      UPDATE violations SET status = 'appeal_granted' WHERE id = NEW.violation_id;
    ELSIF NEW.status = 'denied' AND OLD.status != 'denied' THEN
      UPDATE violations SET status = 'appeal_denied' WHERE id = NEW.violation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER violation_appeal_status
  AFTER INSERT OR UPDATE ON violation_appeals
  FOR EACH ROW
  EXECUTE FUNCTION update_violation_on_appeal();
```

### Pattern 7: Emergency Contacts and Medical Information

**What:** Store emergency contacts and medical conditions per resident
**When to use:** Emergency response, accessibility accommodations
**Why:** Critical information for security and medical emergencies

```sql
-- Source: Phase 2 resident patterns + emergency response requirements
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Contact info
  contact_name TEXT NOT NULL,
  relationship TEXT NOT NULL,  -- 'spouse', 'parent', 'child', 'sibling', 'friend', 'doctor', 'other'

  -- Phone numbers
  phone_primary phone_number NOT NULL,
  phone_secondary phone_number,

  -- Location
  address TEXT,
  city TEXT,

  -- Priority (lower = call first)
  priority INTEGER NOT NULL DEFAULT 1,

  -- When to contact
  contact_for TEXT[],  -- ['medical', 'security', 'general', 'financial']

  -- Notes
  notes TEXT,

  -- Active
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medical conditions
CREATE TABLE medical_conditions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Condition
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'allergy', 'chronic_condition', 'disability', 'medication', 'other'
  )),
  condition_name TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),

  -- Details
  description TEXT,

  -- For allergies: reaction type
  reaction_description TEXT,

  -- Medications
  medications TEXT[],

  -- Emergency instructions
  emergency_instructions TEXT,

  -- Medical provider
  doctor_name TEXT,
  doctor_phone phone_number,
  hospital_preference TEXT,

  -- Documentation
  document_url TEXT,  -- Medical letter, prescription, etc.

  -- Visibility
  share_with_security BOOLEAN NOT NULL DEFAULT true,  -- Guards can see
  share_with_neighbors BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accessibility needs
CREATE TABLE accessibility_needs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Need type
  need_type TEXT NOT NULL,  -- 'wheelchair', 'visual', 'hearing', 'cognitive', 'mobility', 'other'
  description TEXT NOT NULL,

  -- Accommodations required
  accommodations TEXT[],  -- ['ramp_access', 'elevator_priority', 'large_print', 'sign_language']

  -- Equipment
  uses_mobility_device BOOLEAN DEFAULT false,
  mobility_device_type TEXT,  -- 'wheelchair', 'walker', 'scooter', 'cane'

  -- Assistance animal
  has_service_animal BOOLEAN DEFAULT false,
  service_animal_type TEXT,

  -- Evacuation
  needs_evacuation_assistance BOOLEAN DEFAULT false,
  evacuation_notes TEXT,

  -- Unit modifications
  unit_modifications TEXT[],  -- What has been modified in their unit

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Pattern 8: Pre-Computed Analytics with Summary Tables

**What:** Summary tables refreshed by pg_cron instead of materialized views
**When to use:** Dashboard KPIs, reporting, trend analysis
**Why:** PowerSync compatible, explicit refresh control, incremental updates possible

```sql
-- Source: Supabase pg_cron + analytics patterns
-- Note: Using summary tables instead of materialized views for PowerSync compatibility

-- Daily KPIs
CREATE TABLE kpi_daily (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  metric_date DATE NOT NULL,

  -- Access metrics
  total_entries INTEGER DEFAULT 0,
  resident_entries INTEGER DEFAULT 0,
  visitor_entries INTEGER DEFAULT 0,
  denied_entries INTEGER DEFAULT 0,

  -- Peak hours (JSONB: { "08": 45, "09": 67, ... })
  entries_by_hour JSONB DEFAULT '{}',

  -- Security metrics
  incidents_reported INTEGER DEFAULT 0,
  incidents_resolved INTEGER DEFAULT 0,
  patrol_checkpoints_completed INTEGER DEFAULT 0,
  patrol_checkpoints_missed INTEGER DEFAULT 0,

  -- Financial metrics
  payments_received INTEGER DEFAULT 0,
  payments_amount money_amount DEFAULT 0,
  new_charges_count INTEGER DEFAULT 0,
  new_charges_amount money_amount DEFAULT 0,

  -- Delinquency
  units_delinquent INTEGER DEFAULT 0,
  total_delinquent_amount money_amount DEFAULT 0,

  -- Communication
  announcements_sent INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,

  -- Amenities
  reservations_made INTEGER DEFAULT 0,
  reservations_cancelled INTEGER DEFAULT 0,
  no_shows INTEGER DEFAULT 0,

  -- Packages
  packages_received INTEGER DEFAULT 0,
  packages_picked_up INTEGER DEFAULT 0,
  packages_pending INTEGER DEFAULT 0,

  -- Maintenance
  tickets_opened INTEGER DEFAULT 0,
  tickets_closed INTEGER DEFAULT 0,

  -- Computed at
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kpi_daily_unique UNIQUE (community_id, metric_date)
);

-- Weekly aggregates
CREATE TABLE kpi_weekly (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  week_start DATE NOT NULL,  -- Monday of the week
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,

  -- Aggregated metrics (similar to daily but summed)
  total_entries INTEGER DEFAULT 0,
  incidents_reported INTEGER DEFAULT 0,
  incidents_resolved INTEGER DEFAULT 0,
  payments_amount money_amount DEFAULT 0,
  avg_daily_entries NUMERIC(10,2) DEFAULT 0,

  -- Trends
  entries_change_pct NUMERIC(5,2),  -- vs previous week
  incidents_change_pct NUMERIC(5,2),

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kpi_weekly_unique UNIQUE (community_id, year, week_number)
);

-- Monthly aggregates
CREATE TABLE kpi_monthly (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,

  -- Financial summary
  total_billed money_amount DEFAULT 0,
  total_collected money_amount DEFAULT 0,
  collection_rate NUMERIC(5,2) DEFAULT 0,  -- percentage

  -- Delinquency
  units_delinquent_30_days INTEGER DEFAULT 0,
  units_delinquent_60_days INTEGER DEFAULT 0,
  units_delinquent_90_days INTEGER DEFAULT 0,

  -- Access summary
  total_entries INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,

  -- Security
  total_incidents INTEGER DEFAULT 0,
  incidents_by_category JSONB DEFAULT '{}',
  avg_resolution_hours NUMERIC(10,2),

  -- Amenities
  total_reservations INTEGER DEFAULT 0,
  utilization_by_amenity JSONB DEFAULT '{}',

  -- Trends
  collection_rate_change NUMERIC(5,2),  -- vs previous month

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT kpi_monthly_unique UNIQUE (community_id, year, month)
);

-- Function to compute daily KPIs
CREATE OR REPLACE FUNCTION compute_daily_kpis(p_community_id UUID, p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO kpi_daily (
    community_id, metric_date,
    total_entries, resident_entries, visitor_entries, denied_entries,
    entries_by_hour,
    incidents_reported, incidents_resolved,
    payments_received, payments_amount,
    packages_received, packages_picked_up,
    tickets_opened, tickets_closed
  )
  SELECT
    p_community_id,
    p_date,
    -- Access metrics
    (SELECT COUNT(*) FROM access_logs
     WHERE community_id = p_community_id
       AND entry_time::DATE = p_date),
    (SELECT COUNT(*) FROM access_logs
     WHERE community_id = p_community_id
       AND entry_time::DATE = p_date
       AND resident_id IS NOT NULL),
    (SELECT COUNT(*) FROM access_logs
     WHERE community_id = p_community_id
       AND entry_time::DATE = p_date
       AND visitor_name IS NOT NULL),
    (SELECT COUNT(*) FROM access_logs
     WHERE community_id = p_community_id
       AND entry_time::DATE = p_date
       AND access_result = 'denied'),
    -- Entries by hour
    (SELECT jsonb_object_agg(hour, cnt)
     FROM (
       SELECT EXTRACT(HOUR FROM entry_time)::TEXT AS hour, COUNT(*) AS cnt
       FROM access_logs
       WHERE community_id = p_community_id AND entry_time::DATE = p_date
       GROUP BY EXTRACT(HOUR FROM entry_time)
     ) hourly),
    -- Incidents
    (SELECT COUNT(*) FROM incidents
     WHERE community_id = p_community_id
       AND reported_at::DATE = p_date),
    (SELECT COUNT(*) FROM incidents
     WHERE community_id = p_community_id
       AND resolved_at::DATE = p_date),
    -- Payments
    (SELECT COUNT(*) FROM transactions
     WHERE community_id = p_community_id
       AND transaction_type = 'payment'
       AND status = 'posted'
       AND posted_at::DATE = p_date),
    (SELECT COALESCE(SUM(amount), 0) FROM transactions
     WHERE community_id = p_community_id
       AND transaction_type = 'payment'
       AND status = 'posted'
       AND posted_at::DATE = p_date),
    -- Packages
    (SELECT COUNT(*) FROM packages
     WHERE community_id = p_community_id
       AND received_at::DATE = p_date),
    (SELECT COUNT(*) FROM packages
     WHERE community_id = p_community_id
       AND picked_up_at::DATE = p_date),
    -- Tickets
    (SELECT COUNT(*) FROM tickets
     WHERE community_id = p_community_id
       AND created_at::DATE = p_date),
    (SELECT COUNT(*) FROM tickets
     WHERE community_id = p_community_id
       AND resolved_at::DATE = p_date)
  ON CONFLICT (community_id, metric_date)
  DO UPDATE SET
    total_entries = EXCLUDED.total_entries,
    resident_entries = EXCLUDED.resident_entries,
    visitor_entries = EXCLUDED.visitor_entries,
    denied_entries = EXCLUDED.denied_entries,
    entries_by_hour = EXCLUDED.entries_by_hour,
    incidents_reported = EXCLUDED.incidents_reported,
    incidents_resolved = EXCLUDED.incidents_resolved,
    payments_received = EXCLUDED.payments_received,
    payments_amount = EXCLUDED.payments_amount,
    packages_received = EXCLUDED.packages_received,
    packages_picked_up = EXCLUDED.packages_picked_up,
    tickets_opened = EXCLUDED.tickets_opened,
    tickets_closed = EXCLUDED.tickets_closed,
    computed_at = now();
END;
$$;

-- Schedule daily KPI computation via pg_cron
-- Run at 1am every day for all communities
SELECT cron.schedule(
  'compute-daily-kpis',
  '0 1 * * *',  -- 1:00 AM daily
  $$
  SELECT compute_daily_kpis(c.id, CURRENT_DATE - 1)
  FROM communities c
  WHERE c.deleted_at IS NULL
  $$
);

-- Schedule weekly aggregation (Mondays at 2am)
SELECT cron.schedule(
  'compute-weekly-kpis',
  '0 2 * * 1',  -- 2:00 AM on Mondays
  $$
  SELECT compute_weekly_kpis(c.id, date_trunc('week', CURRENT_DATE - 7)::DATE)
  FROM communities c
  WHERE c.deleted_at IS NULL
  $$
);

-- BRIN indexes for time-series queries
CREATE INDEX idx_kpi_daily_date_brin ON kpi_daily USING BRIN (metric_date);
CREATE INDEX idx_kpi_weekly_week_brin ON kpi_weekly USING BRIN (week_start);
CREATE INDEX idx_kpi_monthly_period_brin ON kpi_monthly USING BRIN (year, month);

-- B-tree for community queries
CREATE INDEX idx_kpi_daily_community ON kpi_daily (community_id, metric_date DESC);
CREATE INDEX idx_kpi_weekly_community ON kpi_weekly (community_id, year DESC, week_number DESC);
CREATE INDEX idx_kpi_monthly_community ON kpi_monthly (community_id, year DESC, month DESC);
```

### Pattern 9: Webhook Delivery with Retry and Dead Letter Queue

**What:** Queue-based webhook delivery with exponential backoff
**When to use:** External integrations, event notifications
**Why:** Reliability, retry capability, audit trail

```sql
-- Source: Webhook delivery patterns + Supabase pg_net
CREATE TYPE webhook_status AS ENUM (
  'pending',
  'sending',
  'delivered',
  'failed',
  'retrying',
  'dead_letter'  -- Exhausted all retries
);

-- Webhook endpoint configurations
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Endpoint details
  name TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Security
  secret TEXT NOT NULL,  -- For HMAC signature

  -- Events to receive
  event_types TEXT[] NOT NULL,  -- ['access.entry', 'incident.created', 'payment.received']

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Health tracking
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,

  -- Auto-disable after too many failures
  auto_disabled_at TIMESTAMPTZ,

  -- Headers to include
  custom_headers JSONB DEFAULT '{}',

  -- Retry config
  max_retries INTEGER NOT NULL DEFAULT 5,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Webhook delivery queue
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Event details
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL,  -- Reference to original event
  payload JSONB NOT NULL,

  -- Delivery status
  status webhook_status NOT NULL DEFAULT 'pending',

  -- Retry tracking
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 6,
  next_attempt_at TIMESTAMPTZ,

  -- Exponential backoff: 1m, 5m, 15m, 1h, 4h, 24h

  -- Last attempt details
  last_attempt_at TIMESTAMPTZ,
  last_response_code INTEGER,
  last_response_body TEXT,
  last_error TEXT,

  -- Success tracking
  delivered_at TIMESTAMPTZ,

  -- Signature
  signature TEXT,  -- HMAC-SHA256 of payload

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calculate next retry time with exponential backoff
CREATE OR REPLACE FUNCTION calculate_next_retry(p_attempt INTEGER)
RETURNS INTERVAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_attempt
    WHEN 1 THEN INTERVAL '1 minute'
    WHEN 2 THEN INTERVAL '5 minutes'
    WHEN 3 THEN INTERVAL '15 minutes'
    WHEN 4 THEN INTERVAL '1 hour'
    WHEN 5 THEN INTERVAL '4 hours'
    ELSE INTERVAL '24 hours'
  END;
END;
$$;

-- Function to queue a webhook delivery
CREATE OR REPLACE FUNCTION queue_webhook(
  p_community_id UUID,
  p_event_type TEXT,
  p_event_id UUID,
  p_payload JSONB
)
RETURNS SETOF UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_endpoint webhook_endpoints;
  v_delivery_id UUID;
  v_signature TEXT;
BEGIN
  -- Find active endpoints subscribed to this event type
  FOR v_endpoint IN
    SELECT * FROM webhook_endpoints
    WHERE community_id = p_community_id
      AND is_active = true
      AND auto_disabled_at IS NULL
      AND p_event_type = ANY(event_types)
  LOOP
    -- Generate signature
    v_signature := encode(
      hmac(p_payload::TEXT::BYTEA, v_endpoint.secret::BYTEA, 'sha256'),
      'hex'
    );

    -- Create delivery record
    INSERT INTO webhook_deliveries (
      endpoint_id, community_id, event_type, event_id,
      payload, signature, next_attempt_at
    ) VALUES (
      v_endpoint.id, p_community_id, p_event_type, p_event_id,
      p_payload, v_signature, now()  -- Immediate first attempt
    ) RETURNING id INTO v_delivery_id;

    RETURN NEXT v_delivery_id;
  END LOOP;
END;
$$;

-- Function to process webhook queue (called by Edge Function or pg_cron + pg_net)
CREATE OR REPLACE FUNCTION process_webhook_delivery(p_delivery_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_delivery webhook_deliveries;
  v_endpoint webhook_endpoints;
BEGIN
  -- Lock the delivery record
  SELECT * INTO v_delivery
  FROM webhook_deliveries
  WHERE id = p_delivery_id
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_delivery.status NOT IN ('pending', 'retrying') THEN
    RETURN false;
  END IF;

  -- Get endpoint
  SELECT * INTO v_endpoint
  FROM webhook_endpoints
  WHERE id = v_delivery.endpoint_id;

  -- Update status to sending
  UPDATE webhook_deliveries
  SET status = 'sending',
      attempt_count = attempt_count + 1,
      last_attempt_at = now()
  WHERE id = p_delivery_id;

  -- Actual HTTP call would be done via pg_net or Edge Function
  -- This function just manages the queue state

  RETURN true;
END;
$$;

-- Function to record delivery result
CREATE OR REPLACE FUNCTION record_webhook_result(
  p_delivery_id UUID,
  p_success BOOLEAN,
  p_response_code INTEGER DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_delivery webhook_deliveries;
BEGIN
  SELECT * INTO v_delivery
  FROM webhook_deliveries
  WHERE id = p_delivery_id;

  IF p_success THEN
    -- Success
    UPDATE webhook_deliveries
    SET status = 'delivered',
        delivered_at = now(),
        last_response_code = p_response_code
    WHERE id = p_delivery_id;

    -- Update endpoint health
    UPDATE webhook_endpoints
    SET consecutive_failures = 0,
        last_success_at = now()
    WHERE id = v_delivery.endpoint_id;
  ELSE
    -- Failure
    IF v_delivery.attempt_count >= v_delivery.max_attempts THEN
      -- Exhausted retries -> dead letter
      UPDATE webhook_deliveries
      SET status = 'dead_letter',
          last_response_code = p_response_code,
          last_response_body = p_response_body,
          last_error = p_error
      WHERE id = p_delivery_id;
    ELSE
      -- Schedule retry
      UPDATE webhook_deliveries
      SET status = 'retrying',
          last_response_code = p_response_code,
          last_response_body = p_response_body,
          last_error = p_error,
          next_attempt_at = now() + calculate_next_retry(v_delivery.attempt_count)
      WHERE id = p_delivery_id;
    END IF;

    -- Update endpoint health
    UPDATE webhook_endpoints
    SET consecutive_failures = consecutive_failures + 1,
        last_failure_at = now(),
        last_failure_reason = p_error,
        -- Auto-disable after 10 consecutive failures
        auto_disabled_at = CASE
          WHEN consecutive_failures >= 9 THEN now()
          ELSE NULL
        END
    WHERE id = v_delivery.endpoint_id;
  END IF;
END;
$$;

-- Index for processing queue
CREATE INDEX idx_webhook_deliveries_pending
  ON webhook_deliveries (next_attempt_at)
  WHERE status IN ('pending', 'retrying');

-- Schedule webhook processing every minute
SELECT cron.schedule(
  'process-webhooks',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://' || current_setting('supabase.project_ref') || '.supabase.co/functions/v1/process-webhooks',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('supabase.anon_key'))
  )
  $$
);
```

### Pattern 10: API Key Management with Scopes and Hashing

**What:** Secure API key storage with scope-based access control
**When to use:** Third-party integrations, external access
**Why:** Security, audit trail, granular permissions

```sql
-- Source: API key security best practices
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  name TEXT NOT NULL,
  description TEXT,

  -- Key (only prefix stored for display, full key shown once on creation)
  key_prefix TEXT NOT NULL,  -- First 8 chars: "upoe_sk_abc12345..."
  key_hash TEXT NOT NULL,    -- SHA-256 hash of full key

  -- Scopes (what this key can access)
  -- Format: ['access_logs:read', 'residents:read', 'payments:write']
  scopes TEXT[] NOT NULL,

  -- Restrictions
  allowed_ips INET[],  -- NULL = any IP
  rate_limit_per_minute INTEGER DEFAULT 60,

  -- Validity
  expires_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  last_used_ip INET,
  total_requests INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT api_keys_prefix_unique UNIQUE (community_id, key_prefix)
);

-- API key usage log (for rate limiting and auditing)
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id),

  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,

  -- Client info
  ip_address INET NOT NULL,
  user_agent TEXT,

  -- Response
  response_code INTEGER,
  response_time_ms INTEGER,

  -- Timestamp
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partition usage log by month for performance
CREATE INDEX idx_api_key_usage_key_time
  ON api_key_usage (api_key_id, requested_at DESC);

-- BRIN index for time queries
CREATE INDEX idx_api_key_usage_time_brin
  ON api_key_usage USING BRIN (requested_at);

-- Function to generate a new API key
CREATE OR REPLACE FUNCTION generate_api_key(
  p_community_id UUID,
  p_name TEXT,
  p_scopes TEXT[],
  p_expires_in_days INTEGER DEFAULT NULL
)
RETURNS TABLE (
  key_id UUID,
  api_key TEXT,  -- Only returned once!
  prefix TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_key TEXT;
  v_prefix TEXT;
  v_hash TEXT;
  v_id UUID;
  v_expires TIMESTAMPTZ;
BEGIN
  -- Generate random key: upoe_sk_{32 random chars}
  v_key := 'upoe_sk_' || encode(gen_random_bytes(24), 'base64');
  v_key := replace(replace(v_key, '+', 'x'), '/', 'y');  -- URL safe

  -- Extract prefix
  v_prefix := substring(v_key from 1 for 16);

  -- Hash the key
  v_hash := encode(sha256(v_key::BYTEA), 'hex');

  -- Calculate expiration
  IF p_expires_in_days IS NOT NULL THEN
    v_expires := now() + (p_expires_in_days || ' days')::INTERVAL;
  END IF;

  -- Insert
  INSERT INTO api_keys (
    community_id, name, key_prefix, key_hash, scopes, expires_at, created_by
  ) VALUES (
    p_community_id, p_name, v_prefix, v_hash, p_scopes, v_expires, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_key, v_prefix, v_expires;
END;
$$;

-- Function to validate API key and check scopes
CREATE OR REPLACE FUNCTION validate_api_key(
  p_key TEXT,
  p_required_scope TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_valid BOOLEAN,
  key_id UUID,
  community_id UUID,
  scopes TEXT[],
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash TEXT;
  v_api_key api_keys;
BEGIN
  -- Hash the provided key
  v_hash := encode(sha256(p_key::BYTEA), 'hex');

  -- Find key
  SELECT * INTO v_api_key
  FROM api_keys
  WHERE key_hash = v_hash;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::TEXT[], 'Invalid API key';
    RETURN;
  END IF;

  -- Check if active
  IF NOT v_api_key.is_active THEN
    RETURN QUERY SELECT false, v_api_key.id, v_api_key.community_id, v_api_key.scopes, 'API key is revoked';
    RETURN;
  END IF;

  -- Check expiration
  IF v_api_key.expires_at IS NOT NULL AND v_api_key.expires_at < now() THEN
    RETURN QUERY SELECT false, v_api_key.id, v_api_key.community_id, v_api_key.scopes, 'API key has expired';
    RETURN;
  END IF;

  -- Check scope if required
  IF p_required_scope IS NOT NULL AND NOT (p_required_scope = ANY(v_api_key.scopes)) THEN
    RETURN QUERY SELECT false, v_api_key.id, v_api_key.community_id, v_api_key.scopes, 'Insufficient scope';
    RETURN;
  END IF;

  -- Update usage
  UPDATE api_keys
  SET last_used_at = now(),
      total_requests = total_requests + 1
  WHERE id = v_api_key.id;

  RETURN QUERY SELECT true, v_api_key.id, v_api_key.community_id, v_api_key.scopes, NULL::TEXT;
END;
$$;

-- Integration configurations
CREATE TABLE integration_configs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Integration type
  integration_type TEXT NOT NULL,  -- 'bank_feed', 'lpr', 'cctv', 'access_control', 'payment_gateway'
  name TEXT NOT NULL,

  -- Provider
  provider TEXT NOT NULL,  -- 'banamex', 'hikvision', 'stripe', etc.

  -- Connection details (encrypted)
  -- In practice, use Supabase Vault for secrets
  config JSONB NOT NULL DEFAULT '{}',  -- Non-sensitive config

  -- Credentials reference (ID in Supabase Vault)
  vault_secret_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'error', 'disabled'
  )),

  -- Health
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_error TEXT,

  -- Sync settings
  sync_interval_minutes INTEGER DEFAULT 60,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT integration_configs_unique UNIQUE (community_id, integration_type, name)
);

-- Integration sync logs
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  integration_id UUID NOT NULL REFERENCES integration_configs(id) ON DELETE CASCADE,

  -- Sync details
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Results
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Errors
  error_message TEXT,
  error_details JSONB,

  -- Metadata
  sync_type TEXT,  -- 'full', 'incremental', 'manual'
  triggered_by UUID REFERENCES auth.users(id)
);

-- Index for sync log queries
CREATE INDEX idx_integration_sync_logs_integration
  ON integration_sync_logs (integration_id, started_at DESC);
```

### Anti-Patterns to Avoid

- **Using materialized views with PowerSync:** Summary tables preferred for offline-sync compatibility
- **Storing API keys in plain text:** Always hash keys; only show once on creation
- **Unlimited webhook retries:** Use exponential backoff with dead letter queue
- **Voting without coefficient validation:** Must sum to 100%, check quorum
- **Proxy voting without limits:** Mexican law limits 2 units per representative
- **Hard-coding escalation thresholds:** Make configurable per violation type
- **Real-time analytics queries:** Pre-compute with pg_cron for dashboard performance
- **Incident timeline as separate rows:** JSONB array is faster for timeline display

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key generation | Custom random | gen_random_bytes + SHA-256 | Cryptographically secure |
| Webhook signatures | Custom hash | HMAC-SHA256 via pgcrypto | Standard, verifiable |
| Retry scheduling | Custom logic | calculate_next_retry function | Exponential backoff pattern |
| Quorum calculation | Application code | calculate_assembly_quorum function | Database-enforced |
| Analytics refresh | Manual triggers | pg_cron scheduled jobs | Automatic, consistent |
| Vote weight | Application lookup | Copy coefficient at vote time | Immutable audit trail |

**Key insight:** Governance features require audit trails and legal compliance. Database-enforced validation prevents application bugs from creating legal liability.

## Common Pitfalls

### Pitfall 1: Coefficient Sum Not Validated

**What goes wrong:** Votes don't add up correctly because coefficients don't total 100%
**Why it happens:** Units added/removed without recalculating
**How to avoid:**
- Add CHECK constraint: SUM(coefficient) BETWEEN 99.9 AND 100.1
- Provide recalculation function for admins
- Copy coefficient at vote time for immutability
**Warning signs:** Election results percentages exceed 100%

### Pitfall 2: Webhook Retry Storm

**What goes wrong:** Failing endpoint receives thousands of retry attempts
**Why it happens:** No backoff, no circuit breaker
**How to avoid:**
- Exponential backoff with jitter
- Auto-disable after N consecutive failures
- Dead letter queue for exhausted retries
**Warning signs:** Database queue growing, target server overwhelmed

### Pitfall 3: API Key Leaked in Logs

**What goes wrong:** Full API key appears in error messages or audit logs
**Why it happens:** Logging raw request headers
**How to avoid:**
- Only store key prefix and hash
- Never log Authorization headers
- Use Supabase Vault for sensitive data
**Warning signs:** Keys visible in log aggregation tools

### Pitfall 4: Analytics Query Timeouts

**What goes wrong:** Dashboard takes forever to load
**Why it happens:** Real-time aggregation on large tables
**How to avoid:**
- Pre-compute KPIs in summary tables
- Use pg_cron for background refresh
- Index summary tables for common queries
**Warning signs:** Slow log entries for dashboard queries

### Pitfall 5: Proxy Limit Not Enforced

**What goes wrong:** One person votes for 10 units, violating Mexican law
**Why it happens:** Validation only in application code
**How to avoid:**
- Database trigger enforces 2-unit proxy limit
- Check BEFORE insert, not after
- Log proxy relationships for audit
**Warning signs:** Audit shows single user with many proxy votes

### Pitfall 6: Incident Timeline Grows Unbounded

**What goes wrong:** Old incidents with hundreds of events slow down queries
**Why it happens:** No archival strategy
**How to avoid:**
- Limit timeline to recent N events (keep full history in separate table)
- Archive closed incidents after 90 days
- Use GIN index on timeline JSONB
**Warning signs:** Incident detail pages slow, JSONB columns > 1MB

## Code Examples

### Complete Incident Creation with Timeline

```sql
-- Create incident with initial timeline event
CREATE OR REPLACE FUNCTION create_incident(
  p_community_id UUID,
  p_incident_type_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_severity incident_severity DEFAULT 'medium',
  p_location_type TEXT DEFAULT NULL,
  p_location_description TEXT DEFAULT NULL,
  p_unit_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_incident_id UUID;
  v_incident_number TEXT;
  v_reporter_name TEXT;
BEGIN
  -- Generate incident number
  SELECT 'INC-' || TO_CHAR(now(), 'YYYY') || '-' ||
         LPAD((COUNT(*) + 1)::TEXT, 5, '0')
  INTO v_incident_number
  FROM incidents
  WHERE community_id = p_community_id
    AND created_at >= date_trunc('year', now());

  -- Get reporter name
  SELECT full_name INTO v_reporter_name
  FROM residents WHERE id = auth.uid();

  -- Create incident
  INSERT INTO incidents (
    community_id, incident_number, incident_type_id,
    title, description, severity,
    location_type, location_description, unit_id,
    reported_by, timeline
  ) VALUES (
    p_community_id, v_incident_number, p_incident_type_id,
    p_title, p_description, p_severity,
    p_location_type, p_location_description, p_unit_id,
    auth.uid(),
    jsonb_build_array(
      jsonb_build_object(
        'id', generate_uuid_v7(),
        'type', 'created',
        'timestamp', now(),
        'actor_id', auth.uid(),
        'actor_name', COALESCE(v_reporter_name, 'Anonymous'),
        'data', jsonb_build_object(
          'title', p_title,
          'severity', p_severity
        )
      )
    )
  ) RETURNING id INTO v_incident_id;

  RETURN v_incident_id;
END;
$$;
```

### Vote Casting with Full Validation

```sql
-- See Pattern 2 above for cast_vote function
-- Additional helper: get voting rights for a unit
CREATE OR REPLACE FUNCTION get_voting_rights(
  p_election_id UUID,
  p_unit_id UUID
)
RETURNS TABLE (
  can_vote BOOLEAN,
  reason TEXT,
  coefficient NUMERIC(7,4),
  eligible_voters UUID[],
  has_voted BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_unit units;
  v_election elections;
  v_voters UUID[];
BEGIN
  SELECT * INTO v_election FROM elections WHERE id = p_election_id;
  SELECT * INTO v_unit FROM units WHERE id = p_unit_id;

  -- Check if already voted
  IF EXISTS (SELECT 1 FROM ballots WHERE election_id = p_election_id AND unit_id = p_unit_id) THEN
    RETURN QUERY SELECT false, 'Unit has already voted', v_unit.coefficient, NULL::UUID[], true;
    RETURN;
  END IF;

  -- Get eligible voters (owners/tenants)
  SELECT array_agg(resident_id) INTO v_voters
  FROM occupancies
  WHERE unit_id = p_unit_id
    AND occupancy_type IN ('owner', 'tenant')
    AND status = 'active'
    AND deleted_at IS NULL;

  IF v_voters IS NULL OR array_length(v_voters, 1) = 0 THEN
    RETURN QUERY SELECT false, 'No eligible voters for this unit', v_unit.coefficient, NULL::UUID[], false;
    RETURN;
  END IF;

  -- Check for suspended voting rights (morosidad)
  -- Would query financial standing here

  RETURN QUERY SELECT true, NULL::TEXT, v_unit.coefficient, v_voters, false;
END;
$$;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Materialized views for analytics | Summary tables + pg_cron | PowerSync adoption | Offline-sync compatible |
| Application-level quorum check | Database function validation | Modern RBAC | Can't bypass via direct SQL |
| Random API keys | Prefix + hashed keys | Security best practice | Key never stored in plain text |
| Immediate webhook delivery | Queue with exponential backoff | Reliability patterns | Handles endpoint failures gracefully |
| Separate timeline rows | JSONB array timeline | Performance optimization | Single query for full timeline |

**Deprecated/outdated:**
- Plain text API key storage: Always hash
- Unlimited webhook retries: Use backoff + dead letter
- Real-time aggregations for dashboards: Pre-compute with pg_cron
- Application-only vote validation: Database triggers for legal compliance

## Open Questions

### 1. Analytics Granularity

**What we know:** Daily KPIs are computed, weekly/monthly aggregated
**What's unclear:** How far back to keep granular data?
**Recommendation:** Keep daily for 90 days, weekly for 1 year, monthly indefinitely. Implement archival job via pg_cron.

### 2. Webhook Payload Size

**What we know:** Webhooks deliver event data as JSON
**What's unclear:** Include full entity or just ID + summary?
**Recommendation:** Include summary (key fields) by default. Full entity available via API lookup using the event_id. Keeps payloads small and reduces bandwidth.

### 3. Voting Privacy

**What we know:** Ballots store who voted and their selections
**What's unclear:** Should votes be anonymous?
**Recommendation:** For Mexican condominium law, votes are typically NOT anonymous (for audit and legal purposes). Store full details but restrict read access to election administrators only.

### 4. Device Deactivation Propagation

**What we know:** Lost devices should be deactivated immediately
**What's unclear:** How to propagate to physical access control hardware?
**Recommendation:** Integration layer handles sync. access_devices.status = 'lost' triggers webhook to access control integration. Hardware sync is responsibility of integration config.

## Sources

### Primary (HIGH confidence)
- [Supabase pg_cron Documentation](https://supabase.com/docs/guides/database/extensions/pg_cron) - Scheduled jobs
- [PostgreSQL Exclusion Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION) - Parking reservation overlap prevention
- [Mexican Ley de Propiedad en Condominio (CDMX)](https://www.congresocdmx.gob.mx/archivos/transparencia/LEY_DE_PROPIEDAD_EN_CONDOMINIO_DE_INMUEBLES_PARA_EL_DISTRITO_FEDERAL.pdf) - Quorum and voting rules

### Secondary (MEDIUM confidence)
- [Webhook Retry with Exponential Backoff (Medium)](https://medium.com/wellhub-tech-team/handling-failed-webhooks-with-exponential-backoff-72d2e01017d7) - Retry patterns
- [API Key Security Best Practices (DEV.to)](https://dev.to/alixd/api-key-security-best-practices-for-2026-1n5d) - Key management patterns
- [HOA Violation Workflow (HOALife)](https://help.hoalife.com/article/dlzggmpquo-2496120-escalated-violations) - Escalation patterns
- [Parking System Design (Vertabelo)](https://vertabelo.com/blog/constructing-a-data-model-for-a-parking-lot-management-system/) - Parking schema patterns

### Tertiary (LOW confidence)
- Key fob lifecycle patterns (Swiftlane, access control vendors) - General concepts, not technical schemas
- HOA software screenshots - UI patterns, not database design

## Metadata

**Confidence breakdown:**
- Incident timeline: HIGH - JSONB pattern proven in Phase 7 audit
- Voting/Assemblies: HIGH - Mexican law requirements are well-documented
- Parking: HIGH - Standard database patterns, exclusion constraints documented
- Access devices: MEDIUM - Based on industry patterns, not official specs
- Violations: MEDIUM - HOA patterns adapted for Mexican context
- Analytics: HIGH - pg_cron and summary tables well-documented
- Webhooks: HIGH - Standard delivery patterns with backoff
- API keys: HIGH - Security best practices well-documented

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable domain, patterns don't change frequently)
