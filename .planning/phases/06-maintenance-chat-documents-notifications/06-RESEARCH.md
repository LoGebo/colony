# Phase 6: Maintenance, Chat, Documents & Notifications - Research

**Researched:** 2026-01-29
**Domain:** PostgreSQL schema design for ticket management, real-time chat, document versioning, and notification systems
**Confidence:** HIGH

## Summary

This phase covers four operational support systems critical for daily community management: maintenance ticketing with SLA enforcement, real-time messaging between residents and guards, document management with versioning and signature capture, and multi-channel notification delivery. The research investigated nine key questions: (1) ticket state machine patterns, (2) SLA breach detection, (3) preventive maintenance scheduling via RRULE, (4) asset lifecycle management, (5) real-time chat with Supabase, (6) read receipts and typing indicators, (7) document versioning strategies, (8) digital signature capture with legal compliance, (9) push token management, and (10) notification preference schemas.

The standard approach uses PostgreSQL ENUMs for ticket state machines with trigger-enforced transitions, computed `due_at` timestamps based on SLA definitions per category/priority matrix, and `rrule_plpgsql` for preventive maintenance schedules that auto-generate tickets. Chat leverages Supabase Realtime Broadcast for messages and Presence for typing/online status, with messages persisted to PostgreSQL for history. Document versioning uses a copy-on-write pattern with version chains. Digital signatures capture timestamp, IP, and device fingerprint in compliance with ESIGN/UETA. Push tokens follow Firebase best practices with monthly staleness checks.

**Primary recommendation:** Use ENUM-based state machines with trigger validation, SLA definitions as a lookup table with computed due_at on ticket creation, Supabase Realtime for ephemeral chat events with database persistence for history, and copy-on-write versioning for documents.

## Standard Stack

This phase is PostgreSQL/Supabase schema work with Realtime integration.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15+ | Database engine | Supabase default, ENUM, triggers, JSONB |
| Supabase Realtime | Latest | Real-time messaging | Broadcast for chat, Presence for typing |
| Supabase Storage | Latest | Document storage | Versioned files, RLS integrated |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| rrule_plpgsql | Recurrence rules | Preventive maintenance schedules |
| pg_trgm | Fuzzy search | Ticket search, document search |
| NOTIFY/LISTEN | Event triggers | SLA breach alerts, ticket assignments |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RRULE string storage | Interval column | RRULE chosen: iCalendar standard, human-readable, flexible |
| Linked-list versioning | Copy-on-write | Copy-on-write chosen: simpler queries, no traversal |
| Polling for chat | Realtime Broadcast | Broadcast chosen: lower latency, less server load |
| JSONB for ticket status | ENUM | ENUM chosen: type safety, valid transitions enforced |

## Architecture Patterns

### Recommended Schema Structure

```
public/
  -- Maintenance
  ticket_categories (plumbing, electrical, etc.)
  sla_definitions (response/resolution times per category+priority)
  tickets (with state machine, SLA tracking)
  ticket_comments (updates, photos)
  ticket_assignments (current and historical)
  assets (community infrastructure)
  asset_maintenance_history
  preventive_schedules (RRULE-based)

  -- Chat
  conversations (1:1, group, guard-booth)
  conversation_participants
  messages (text, media, metadata)
  message_read_receipts
  message_reactions
  quick_responses (canned messages)

  -- Documents
  document_categories
  documents (with version chain)
  document_versions
  document_permissions
  regulation_signatures

  -- Notifications
  notifications
  push_tokens
  notification_preferences
  notification_templates
```

### Pattern 1: Ticket State Machine with ENUM and Trigger

**What:** ENUM-based states with transition validation via trigger
**When to use:** Workflows requiring controlled state progression
**Why:** Type safety, prevents invalid states, audit trail of transitions

```sql
-- Source: PostgreSQL ENUM documentation, Felix Geisendorfer state machine pattern
CREATE TYPE ticket_status AS ENUM (
  'open',           -- Initial state: ticket created
  'assigned',       -- Assigned to staff/provider
  'in_progress',    -- Work started
  'pending_parts',  -- Waiting for materials
  'pending_resident', -- Waiting for resident action
  'resolved',       -- Work completed
  'closed',         -- Confirmed by resident/admin
  'cancelled'       -- Cancelled before completion
);

CREATE TYPE ticket_priority AS ENUM (
  'low',       -- 72h response, 7 days resolution
  'medium',    -- 24h response, 3 days resolution
  'high',      -- 4h response, 24h resolution
  'urgent'     -- 1h response, 4h resolution
);

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Reporter
  reported_by UUID NOT NULL REFERENCES residents(id),
  unit_id UUID REFERENCES units(id),

  -- Classification
  category_id UUID NOT NULL REFERENCES ticket_categories(id),
  priority ticket_priority NOT NULL DEFAULT 'medium',

  -- Description
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,

  -- State machine
  status ticket_status NOT NULL DEFAULT 'open',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- SLA tracking (computed on creation/priority change)
  response_due_at TIMESTAMPTZ,
  resolution_due_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,  -- When status first changed from 'open'
  resolved_at TIMESTAMPTZ,

  -- SLA breach flags
  response_breached BOOLEAN NOT NULL DEFAULT false,
  resolution_breached BOOLEAN NOT NULL DEFAULT false,

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  -- Asset reference (if maintenance is for specific asset)
  asset_id UUID REFERENCES assets(id),

  -- Preventive maintenance link
  preventive_schedule_id UUID REFERENCES preventive_schedules(id),

  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}'::JSONB,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- State transition validation trigger
CREATE OR REPLACE FUNCTION validate_ticket_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transitions ticket_status[];
BEGIN
  -- Define valid transitions per current state
  CASE OLD.status
    WHEN 'open' THEN
      valid_transitions := ARRAY['assigned', 'cancelled']::ticket_status[];
    WHEN 'assigned' THEN
      valid_transitions := ARRAY['in_progress', 'open', 'cancelled']::ticket_status[];
    WHEN 'in_progress' THEN
      valid_transitions := ARRAY['pending_parts', 'pending_resident', 'resolved', 'assigned']::ticket_status[];
    WHEN 'pending_parts' THEN
      valid_transitions := ARRAY['in_progress', 'cancelled']::ticket_status[];
    WHEN 'pending_resident' THEN
      valid_transitions := ARRAY['in_progress', 'resolved', 'cancelled']::ticket_status[];
    WHEN 'resolved' THEN
      valid_transitions := ARRAY['closed', 'in_progress']::ticket_status[];  -- Reopen if not satisfied
    WHEN 'closed' THEN
      valid_transitions := ARRAY[]::ticket_status[];  -- Terminal state
    WHEN 'cancelled' THEN
      valid_transitions := ARRAY[]::ticket_status[];  -- Terminal state
    ELSE
      valid_transitions := ARRAY[]::ticket_status[];
  END CASE;

  -- Check if transition is valid
  IF NEW.status != OLD.status AND NOT (NEW.status = ANY(valid_transitions)) THEN
    RAISE EXCEPTION 'Invalid ticket status transition from % to %', OLD.status, NEW.status;
  END IF;

  -- Track status change time
  IF NEW.status != OLD.status THEN
    NEW.status_changed_at := now();

    -- Track first response time
    IF OLD.status = 'open' AND NEW.status != 'cancelled' AND OLD.first_responded_at IS NULL THEN
      NEW.first_responded_at := now();
    END IF;

    -- Track resolution time
    IF NEW.status = 'resolved' AND OLD.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_transition_trigger
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_ticket_transition();
```

### Pattern 2: SLA Definitions with Due Date Computation

**What:** Lookup table for SLA times, computed due_at on ticket creation
**When to use:** Variable SLAs based on category and priority
**Why:** Configurable per community, enables breach detection

```sql
-- Source: Industry SLA patterns (SysAid, Zendesk, ServiceNow)
CREATE TABLE sla_definitions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  category_id UUID REFERENCES ticket_categories(id),  -- NULL = applies to all
  priority ticket_priority NOT NULL,

  -- Response time (first assignment or status change from 'open')
  response_minutes INTEGER NOT NULL,

  -- Resolution time (status changed to 'resolved')
  resolution_minutes INTEGER NOT NULL,

  -- Business hours only? (skip nights/weekends)
  business_hours_only BOOLEAN NOT NULL DEFAULT true,

  -- Escalation settings
  escalate_on_breach BOOLEAN NOT NULL DEFAULT true,
  escalate_to UUID REFERENCES auth.users(id),

  -- Active
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One SLA per category+priority combination
  CONSTRAINT sla_unique_category_priority
    UNIQUE (community_id, category_id, priority)
);

-- Example SLA matrix:
-- | Category    | Low      | Medium   | High    | Urgent  |
-- |-------------|----------|----------|---------|---------|
-- | Plumbing    | 72h/7d   | 24h/3d   | 4h/24h  | 1h/4h   |
-- | Electrical  | 72h/7d   | 24h/3d   | 4h/24h  | 1h/4h   |
-- | Security    | 24h/3d   | 4h/24h   | 1h/4h   | 30m/2h  |

-- Function to compute SLA due dates
CREATE OR REPLACE FUNCTION compute_sla_due_dates(
  p_community_id UUID,
  p_category_id UUID,
  p_priority ticket_priority,
  p_created_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(response_due TIMESTAMPTZ, resolution_due TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sla RECORD;
BEGIN
  -- Find matching SLA (specific category first, then fallback to NULL category)
  SELECT * INTO sla
  FROM sla_definitions
  WHERE community_id = p_community_id
    AND (category_id = p_category_id OR category_id IS NULL)
    AND priority = p_priority
    AND is_active = true
  ORDER BY category_id NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    -- Default SLAs if none defined
    RETURN QUERY SELECT
      p_created_at + interval '24 hours',
      p_created_at + interval '7 days';
    RETURN;
  END IF;

  -- TODO: For business_hours_only, implement business hours calculation
  -- For now, use simple interval addition
  RETURN QUERY SELECT
    p_created_at + (sla.response_minutes || ' minutes')::INTERVAL,
    p_created_at + (sla.resolution_minutes || ' minutes')::INTERVAL;
END;
$$;

-- Trigger to set SLA due dates on ticket creation
CREATE OR REPLACE FUNCTION set_ticket_sla_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  due_dates RECORD;
BEGIN
  SELECT * INTO due_dates
  FROM compute_sla_due_dates(
    NEW.community_id,
    NEW.category_id,
    NEW.priority,
    NEW.created_at
  );

  NEW.response_due_at := due_dates.response_due;
  NEW.resolution_due_at := due_dates.resolution_due;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_sla_dates_trigger
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_sla_dates();

-- Trigger to recompute SLA on priority change
CREATE OR REPLACE FUNCTION recompute_sla_on_priority_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  due_dates RECORD;
BEGIN
  IF OLD.priority != NEW.priority THEN
    SELECT * INTO due_dates
    FROM compute_sla_due_dates(
      NEW.community_id,
      NEW.category_id,
      NEW.priority,
      NEW.created_at
    );

    NEW.response_due_at := due_dates.response_due;
    NEW.resolution_due_at := due_dates.resolution_due;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_priority_change_trigger
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  WHEN (OLD.priority IS DISTINCT FROM NEW.priority)
  EXECUTE FUNCTION recompute_sla_on_priority_change();
```

### Pattern 3: SLA Breach Detection

**What:** Scheduled function to detect and flag SLA breaches
**When to use:** Ongoing SLA monitoring
**Why:** Proactive alerting, escalation triggers

```sql
-- Function to check for SLA breaches (run periodically via pg_cron or Edge Function)
CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS TABLE(
  ticket_id UUID,
  breach_type TEXT,
  community_id UUID,
  escalate_to UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Find response breaches (not responded and past due)
  RETURN QUERY
  UPDATE tickets t
  SET response_breached = true
  FROM sla_definitions s
  WHERE t.community_id = s.community_id
    AND (t.category_id = s.category_id OR s.category_id IS NULL)
    AND t.priority = s.priority
    AND t.status = 'open'
    AND t.response_due_at < now()
    AND t.response_breached = false
    AND t.deleted_at IS NULL
  RETURNING t.id, 'response'::TEXT, t.community_id, s.escalate_to;

  -- Find resolution breaches (not resolved and past due)
  RETURN QUERY
  UPDATE tickets t
  SET resolution_breached = true
  FROM sla_definitions s
  WHERE t.community_id = s.community_id
    AND (t.category_id = s.category_id OR s.category_id IS NULL)
    AND t.priority = s.priority
    AND t.status NOT IN ('resolved', 'closed', 'cancelled')
    AND t.resolution_due_at < now()
    AND t.resolution_breached = false
    AND t.deleted_at IS NULL
  RETURNING t.id, 'resolution'::TEXT, t.community_id, s.escalate_to;
END;
$$;

-- Notify on breach for real-time alerts
CREATE OR REPLACE FUNCTION notify_sla_breach()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.response_breached = true AND OLD.response_breached = false THEN
    PERFORM pg_notify(
      'sla_breach',
      json_build_object(
        'ticket_id', NEW.id,
        'community_id', NEW.community_id,
        'breach_type', 'response',
        'title', NEW.title,
        'priority', NEW.priority
      )::TEXT
    );
  END IF;

  IF NEW.resolution_breached = true AND OLD.resolution_breached = false THEN
    PERFORM pg_notify(
      'sla_breach',
      json_build_object(
        'ticket_id', NEW.id,
        'community_id', NEW.community_id,
        'breach_type', 'resolution',
        'title', NEW.title,
        'priority', NEW.priority
      )::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_sla_breach_notify
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (
    (NEW.response_breached = true AND OLD.response_breached = false) OR
    (NEW.resolution_breached = true AND OLD.resolution_breached = false)
  )
  EXECUTE FUNCTION notify_sla_breach();
```

### Pattern 4: Preventive Maintenance with RRULE

**What:** RRULE-based schedules that auto-generate tickets
**When to use:** Recurring maintenance tasks (monthly inspections, quarterly servicing)
**Why:** iCalendar standard, human-readable, database-native expansion

```sql
-- Source: rrule_plpgsql (https://github.com/sirrodgepodge/rrule_plpgsql)
-- Note: Install rrule_plpgsql extension first

CREATE TABLE preventive_schedules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Schedule details
  name TEXT NOT NULL,
  description TEXT,

  -- Recurrence rule (iCalendar RFC 5545 format)
  -- Examples:
  -- 'FREQ=WEEKLY;BYDAY=MO' (every Monday)
  -- 'FREQ=MONTHLY;BYMONTHDAY=1' (first of each month)
  -- 'FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15' (June 15 yearly)
  rrule TEXT NOT NULL,
  dtstart TIMESTAMPTZ NOT NULL,  -- Start date for recurrence

  -- Ticket template
  category_id UUID NOT NULL REFERENCES ticket_categories(id),
  priority ticket_priority NOT NULL DEFAULT 'low',
  title_template TEXT NOT NULL,  -- Can include {asset_name}, {date}
  description_template TEXT,

  -- Asset reference (optional)
  asset_id UUID REFERENCES assets(id),

  -- Generation settings
  generate_days_ahead INTEGER NOT NULL DEFAULT 7,  -- Create ticket N days before due
  last_generated_at TIMESTAMPTZ,
  next_occurrence_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Function to generate tickets from preventive schedules
CREATE OR REPLACE FUNCTION generate_preventive_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  schedule RECORD;
  occurrence TIMESTAMPTZ;
  ticket_title TEXT;
  tickets_created INTEGER := 0;
BEGIN
  FOR schedule IN
    SELECT * FROM preventive_schedules
    WHERE is_active = true
      AND deleted_at IS NULL
  LOOP
    -- Find next occurrence using rrule.after()
    SELECT rrule.after(
      schedule.rrule,
      schedule.dtstart,
      COALESCE(schedule.last_generated_at, schedule.dtstart - interval '1 day')
    ) INTO occurrence;

    -- If occurrence is within generation window and not already created
    IF occurrence IS NOT NULL
       AND occurrence <= now() + (schedule.generate_days_ahead || ' days')::INTERVAL
       AND (schedule.last_generated_at IS NULL OR occurrence > schedule.last_generated_at)
    THEN
      -- Build title from template
      ticket_title := schedule.title_template;
      ticket_title := REPLACE(ticket_title, '{date}', occurrence::DATE::TEXT);
      IF schedule.asset_id IS NOT NULL THEN
        SELECT REPLACE(ticket_title, '{asset_name}', name)
        INTO ticket_title
        FROM assets WHERE id = schedule.asset_id;
      END IF;

      -- Create ticket
      INSERT INTO tickets (
        community_id, reported_by, category_id, priority,
        title, description, asset_id, preventive_schedule_id
      )
      SELECT
        schedule.community_id,
        (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin'
         AND raw_app_meta_data->>'community_id' = schedule.community_id::TEXT LIMIT 1),
        schedule.category_id,
        schedule.priority,
        ticket_title,
        COALESCE(schedule.description_template, ''),
        schedule.asset_id,
        schedule.id;

      -- Update schedule
      UPDATE preventive_schedules
      SET last_generated_at = occurrence,
          next_occurrence_at = rrule.after(rrule, dtstart, occurrence)
      WHERE id = schedule.id;

      tickets_created := tickets_created + 1;
    END IF;
  END LOOP;

  RETURN tickets_created;
END;
$$;
```

### Pattern 5: Asset Registry with Lifecycle Tracking

**What:** Infrastructure inventory with maintenance history
**When to use:** Tracking community equipment (pumps, elevators, generators)
**Why:** Links tickets to physical assets, enables lifecycle management

```sql
-- Source: CMDB/ITAM best practices adapted for property management
CREATE TYPE asset_status AS ENUM (
  'operational',    -- Working normally
  'degraded',       -- Working but needs attention
  'maintenance',    -- Under active maintenance
  'out_of_service', -- Not working
  'retired'         -- Decommissioned
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  name TEXT NOT NULL,
  asset_tag TEXT,  -- Physical tag number
  serial_number TEXT,

  -- Classification
  asset_type TEXT NOT NULL,  -- 'pump', 'elevator', 'generator', 'hvac', etc.
  manufacturer TEXT,
  model TEXT,

  -- Location
  location TEXT NOT NULL,
  building TEXT,
  floor TEXT,

  -- Lifecycle dates
  purchased_at DATE,
  installed_at DATE,
  warranty_expires_at DATE,
  expected_end_of_life DATE,

  -- Financial
  purchase_cost NUMERIC(12,2),
  current_value NUMERIC(12,2),
  depreciation_method TEXT,  -- 'straight_line', 'declining_balance'

  -- Status
  status asset_status NOT NULL DEFAULT 'operational',

  -- Maintenance info
  last_maintenance_at DATE,
  next_maintenance_due DATE,
  maintenance_interval_days INTEGER,

  -- Documentation
  manual_url TEXT,
  photo_urls TEXT[],

  -- Metadata
  specifications JSONB DEFAULT '{}'::JSONB,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT assets_unique_tag UNIQUE (community_id, asset_tag)
);

-- Maintenance history
CREATE TABLE asset_maintenance_history (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  -- Maintenance details
  maintenance_type TEXT NOT NULL,  -- 'preventive', 'corrective', 'emergency'
  description TEXT NOT NULL,

  -- Timing
  performed_at TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC(5,2),

  -- Personnel
  performed_by TEXT,  -- Name or company
  verified_by UUID REFERENCES auth.users(id),

  -- Cost
  labor_cost NUMERIC(10,2),
  parts_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(labor_cost, 0) + COALESCE(parts_cost, 0)
  ) STORED,

  -- Parts replaced
  parts_used JSONB DEFAULT '[]'::JSONB,

  -- Documentation
  report_url TEXT,
  photo_urls TEXT[],

  -- Ticket reference
  ticket_id UUID REFERENCES tickets(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update asset last_maintenance_at on history insert
CREATE OR REPLACE FUNCTION update_asset_maintenance_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE assets
  SET last_maintenance_at = NEW.performed_at::DATE,
      next_maintenance_due = CASE
        WHEN maintenance_interval_days IS NOT NULL
        THEN NEW.performed_at::DATE + maintenance_interval_days
        ELSE next_maintenance_due
      END
  WHERE id = NEW.asset_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_maintenance_date_trigger
  AFTER INSERT ON asset_maintenance_history
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_maintenance_date();
```

### Pattern 6: Real-Time Chat with Supabase Realtime

**What:** Broadcast for messages, Presence for typing/online, Postgres for persistence
**When to use:** 1:1, group, and guard-booth conversations
**Why:** Low latency ephemeral events + durable message history

```sql
-- Source: Supabase Realtime docs (Broadcast + Presence)
CREATE TYPE conversation_type AS ENUM (
  'direct',       -- 1:1 between residents
  'group',        -- Group chat
  'guard_booth',  -- Resident <-> Guard (per shift)
  'support'       -- Resident <-> Admin
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Type
  conversation_type conversation_type NOT NULL,

  -- Metadata
  name TEXT,  -- For group chats
  description TEXT,
  avatar_url TEXT,

  -- Guard booth specific
  access_point_id UUID REFERENCES access_points(id),  -- Which gate
  shift_date DATE,  -- Active for one shift

  -- Settings
  is_archived BOOLEAN NOT NULL DEFAULT false,

  -- Denormalized counts
  participant_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,

  -- Last activity for sorting
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TYPE participant_role AS ENUM (
  'owner',    -- Created the conversation
  'admin',    -- Can add/remove members
  'member',   -- Regular participant
  'guard'     -- Guard in guard_booth conversations
);

CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Role in conversation
  role participant_role NOT NULL DEFAULT 'member',

  -- Status
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,

  -- Notification settings
  is_muted BOOLEAN NOT NULL DEFAULT false,
  muted_until TIMESTAMPTZ,

  -- Last read tracking
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ,

  -- Unread count (denormalized)
  unread_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT participants_unique UNIQUE (conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),

  -- Content
  content TEXT,  -- NULL for media-only messages

  -- Media attachments
  media_urls TEXT[],
  media_types TEXT[],  -- MIME types for each media

  -- Reply reference
  reply_to_message_id UUID REFERENCES messages(id),

  -- Message type
  message_type TEXT NOT NULL DEFAULT 'text',  -- 'text', 'image', 'file', 'system'

  -- System message data (for 'system' type)
  system_data JSONB,  -- e.g., {"action": "user_joined", "user_name": "Juan"}

  -- Edit tracking
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  original_content TEXT,

  -- Soft delete (show "This message was deleted")
  is_deleted BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read receipts (separate table for per-user tracking)
CREATE TABLE message_read_receipts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT read_receipts_unique UNIQUE (message_id, user_id)
);

-- Message reactions
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  reaction TEXT NOT NULL,  -- Emoji or reaction code

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, reaction)
);

-- Quick responses for guards
CREATE TABLE quick_responses (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Content
  title TEXT NOT NULL,  -- Display name
  content TEXT NOT NULL,  -- Message to send

  -- Categorization
  category TEXT,  -- 'greeting', 'visitor', 'delivery', 'emergency'

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to update conversation stats on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update conversation last_message_at and count
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      message_count = message_count + 1
  WHERE id = NEW.conversation_id;

  -- Increment unread count for all participants except sender
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER message_conversation_stats_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();
```

### Pattern 7: Document Versioning with Copy-on-Write

**What:** Each edit creates new version, version chain for history
**When to use:** Documents requiring audit trail and rollback
**Why:** Simple queries (no traversal), immutable history

```sql
-- Source: Git-like versioning patterns, PostgreSQL best practices
CREATE TYPE document_category AS ENUM (
  'legal',        -- Reglamento, acta constitutiva
  'assembly',     -- Actas de asamblea
  'financial',    -- Estados financieros, presupuestos
  'operational',  -- Manuales, procedimientos
  'communication' -- Circulares, avisos
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  name TEXT NOT NULL,
  category document_category NOT NULL,
  description TEXT,

  -- Current version pointer
  current_version_id UUID,  -- FK added after document_versions table

  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT false,  -- Visible to all residents
  required_role user_role,  -- Minimum role to view (if not public)

  -- Signature requirements
  requires_signature BOOLEAN NOT NULL DEFAULT false,
  signature_deadline DATE,

  -- Metadata
  tags TEXT[],

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Version info
  version_number INTEGER NOT NULL,

  -- File reference
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'documents',

  -- File metadata
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT NOT NULL,
  checksum TEXT,  -- SHA-256 for integrity

  -- Change tracking
  change_summary TEXT,

  -- Uploader
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),

  -- Previous version link
  previous_version_id UUID REFERENCES document_versions(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT version_number_unique UNIQUE (document_id, version_number)
);

-- Add FK after both tables exist
ALTER TABLE documents
ADD CONSTRAINT documents_current_version_fk
FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

-- Document permissions (beyond simple is_public)
CREATE TABLE document_permissions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Grant to specific entity
  user_id UUID REFERENCES auth.users(id),
  unit_id UUID REFERENCES units(id),
  role user_role,  -- Grant to all users with this role

  -- Permission level
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_download BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,

  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,

  -- Only one grant per target
  CONSTRAINT permissions_unique_user UNIQUE (document_id, user_id),
  CONSTRAINT permissions_unique_unit UNIQUE (document_id, unit_id),
  CONSTRAINT permissions_unique_role UNIQUE (document_id, role)
);

-- Trigger to set version number and update document pointer
CREATE OR REPLACE FUNCTION set_document_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_version INTEGER;
  prev_version_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1, MAX(id)
  INTO next_version, prev_version_id
  FROM document_versions
  WHERE document_id = NEW.document_id;

  NEW.version_number := next_version;
  NEW.previous_version_id := prev_version_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER document_version_trigger
  BEFORE INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_document_version();

-- Update document's current version pointer after insert
CREATE OR REPLACE FUNCTION update_document_current_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE documents
  SET current_version_id = NEW.id,
      updated_at = now()
  WHERE id = NEW.document_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER document_current_version_trigger
  AFTER INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_document_current_version();
```

### Pattern 8: Regulation Signatures with Legal Compliance

**What:** Capture timestamp, IP, device fingerprint for legal validity
**When to use:** Reglamento acceptance, assembly agreements
**Why:** ESIGN/UETA compliance, court-admissible audit trail

```sql
-- Source: ESIGN Act, UETA requirements, DocuSign/Adobe Sign patterns
CREATE TABLE regulation_signatures (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Document signed
  document_id UUID NOT NULL REFERENCES documents(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),

  -- Signer
  resident_id UUID NOT NULL REFERENCES residents(id),
  unit_id UUID REFERENCES units(id),

  -- Signature representation
  signature_type TEXT NOT NULL DEFAULT 'click',  -- 'click', 'draw', 'type'
  signature_data TEXT,  -- Base64 of drawn signature or typed name

  -- Legal metadata (ESIGN/UETA compliance)
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- IP address (may be IPv4 or IPv6)
  ip_address INET NOT NULL,

  -- Device fingerprint
  user_agent TEXT NOT NULL,
  device_type TEXT,  -- 'mobile', 'tablet', 'desktop'
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,

  -- Additional device identifiers (if available from app)
  device_id TEXT,  -- App-generated unique ID
  device_model TEXT,  -- e.g., "iPhone 14 Pro"

  -- Location (if consent given)
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  location_accuracy_meters INTEGER,

  -- Consent tracking
  consent_text TEXT NOT NULL,  -- The exact text they agreed to
  consent_checkbox_id TEXT,  -- DOM element ID for audit

  -- Audit hash (tamper detection)
  -- SHA-256 of: document_checksum + resident_id + signed_at + ip_address
  signature_hash TEXT NOT NULL,

  -- Cannot be modified or deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent updates to signatures (immutable record)
CREATE OR REPLACE FUNCTION prevent_signature_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Regulation signatures cannot be modified';
END;
$$;

CREATE TRIGGER signature_immutable_trigger
  BEFORE UPDATE OR DELETE ON regulation_signatures
  FOR EACH ROW
  EXECUTE FUNCTION prevent_signature_modification();

-- Index for finding who signed what
CREATE INDEX idx_signatures_document ON regulation_signatures(document_id, document_version_id);
CREATE INDEX idx_signatures_resident ON regulation_signatures(resident_id);

-- Function to verify signature wasn't tampered
CREATE OR REPLACE FUNCTION verify_signature_hash(p_signature_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  sig RECORD;
  doc_checksum TEXT;
  expected_hash TEXT;
BEGIN
  SELECT * INTO sig FROM regulation_signatures WHERE id = p_signature_id;

  SELECT checksum INTO doc_checksum
  FROM document_versions WHERE id = sig.document_version_id;

  expected_hash := encode(
    sha256(
      (doc_checksum || sig.resident_id || sig.signed_at || sig.ip_address)::BYTEA
    ),
    'hex'
  );

  RETURN sig.signature_hash = expected_hash;
END;
$$;
```

### Pattern 9: Push Token Management

**What:** FCM/APNs device registration with staleness tracking
**When to use:** Push notification delivery
**Why:** Firebase best practices, automatic cleanup of stale tokens

```sql
-- Source: Firebase Cloud Messaging best practices
CREATE TYPE push_platform AS ENUM (
  'fcm_android',
  'fcm_ios',
  'apns',
  'web_push'
);

CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Token details
  platform push_platform NOT NULL,
  token TEXT NOT NULL,

  -- Device info
  device_id TEXT,  -- Unique device identifier
  device_name TEXT,  -- User-friendly name (e.g., "John's iPhone")
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,

  -- Token lifecycle
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Token validity
  is_active BOOLEAN NOT NULL DEFAULT true,
  deactivation_reason TEXT,  -- 'user_logout', 'token_expired', 'unregistered', 'bounced'
  deactivated_at TIMESTAMPTZ,

  -- Delivery stats
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,

  -- Unique token per platform
  CONSTRAINT push_tokens_unique UNIQUE (token),
  CONSTRAINT push_tokens_device_unique UNIQUE (user_id, device_id, platform)
);

-- Index for finding active tokens by user
CREATE INDEX idx_push_tokens_user_active ON push_tokens(user_id)
  WHERE is_active = true;

-- Function to register/update token
CREATE OR REPLACE FUNCTION register_push_token(
  p_user_id UUID,
  p_platform push_platform,
  p_token TEXT,
  p_device_id TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_device_model TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  token_id UUID;
BEGIN
  INSERT INTO push_tokens (
    user_id, platform, token, device_id, device_name, device_model, app_version
  ) VALUES (
    p_user_id, p_platform, p_token, p_device_id, p_device_name, p_device_model, p_app_version
  )
  ON CONFLICT (user_id, device_id, platform) DO UPDATE SET
    token = EXCLUDED.token,
    device_name = COALESCE(EXCLUDED.device_name, push_tokens.device_name),
    device_model = COALESCE(EXCLUDED.device_model, push_tokens.device_model),
    app_version = COALESCE(EXCLUDED.app_version, push_tokens.app_version),
    last_refreshed_at = now(),
    is_active = true,
    deactivation_reason = NULL,
    deactivated_at = NULL
  RETURNING id INTO token_id;

  RETURN token_id;
END;
$$;

-- Function to mark token as bounced/invalid
CREATE OR REPLACE FUNCTION mark_token_invalid(
  p_token TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE push_tokens
  SET is_active = false,
      deactivation_reason = p_reason,
      deactivated_at = now(),
      failure_count = failure_count + 1,
      last_failure_at = now(),
      last_failure_reason = p_reason
  WHERE token = p_token;
END;
$$;

-- Function to cleanup stale tokens (run monthly)
CREATE OR REPLACE FUNCTION cleanup_stale_push_tokens(
  p_stale_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM push_tokens
    WHERE is_active = false
      AND deactivated_at < now() - (p_stale_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Also mark tokens as stale if not used in 30 days
  UPDATE push_tokens
  SET is_active = false,
      deactivation_reason = 'stale',
      deactivated_at = now()
  WHERE is_active = true
    AND last_used_at < now() - (p_stale_days || ' days')::INTERVAL;

  RETURN deleted_count;
END;
$$;
```

### Pattern 10: Notification Preferences JSONB Schema

**What:** Flexible per-user, per-notification-type preferences
**When to use:** User-controlled notification settings
**Why:** Extensible without migrations, queryable with GIN indexes

```sql
-- Source: Notification system best practices, JSONB patterns
CREATE TYPE notification_channel AS ENUM (
  'push',
  'email',
  'sms',
  'in_app'
);

CREATE TYPE notification_type AS ENUM (
  -- Maintenance
  'ticket_created',
  'ticket_assigned',
  'ticket_status_changed',
  'ticket_comment_added',
  'sla_warning',
  'sla_breach',

  -- Chat
  'new_message',
  'message_reaction',
  'conversation_mention',

  -- Documents
  'document_published',
  'signature_required',
  'signature_reminder',

  -- General
  'announcement',
  'survey_published',
  'payment_due',
  'payment_received',
  'visitor_arrived',
  'package_arrived',
  'emergency_alert'
);

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Global settings
  do_not_disturb BOOLEAN NOT NULL DEFAULT false,
  dnd_start_time TIME,  -- e.g., 22:00
  dnd_end_time TIME,    -- e.g., 08:00

  -- Per-type preferences stored as JSONB
  -- Schema: { "notification_type": { "channels": ["push", "email"], "enabled": true } }
  preferences JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Default channels for unspecified types
  default_channels notification_channel[] NOT NULL DEFAULT ARRAY['push', 'in_app']::notification_channel[],

  -- Email digest preferences
  email_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  email_digest_frequency TEXT DEFAULT 'daily',  -- 'daily', 'weekly'
  email_digest_time TIME DEFAULT '09:00',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT preferences_unique_user UNIQUE (user_id)
);

-- Example preferences JSONB:
-- {
--   "ticket_assigned": {
--     "enabled": true,
--     "channels": ["push", "email"]
--   },
--   "new_message": {
--     "enabled": true,
--     "channels": ["push"],
--     "sound": "message.wav"
--   },
--   "announcement": {
--     "enabled": true,
--     "channels": ["push", "email", "sms"]
--   },
--   "payment_due": {
--     "enabled": false
--   }
-- }

-- GIN index for querying preferences
CREATE INDEX idx_notification_preferences_jsonb
  ON notification_preferences USING GIN (preferences);

-- Function to get effective channels for a notification type
CREATE OR REPLACE FUNCTION get_notification_channels(
  p_user_id UUID,
  p_notification_type notification_type
)
RETURNS notification_channel[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  prefs RECORD;
  type_prefs JSONB;
  current_time TIME := LOCALTIME;
BEGIN
  SELECT * INTO prefs FROM notification_preferences WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Return defaults if no preferences set
    RETURN ARRAY['push', 'in_app']::notification_channel[];
  END IF;

  -- Check DND
  IF prefs.do_not_disturb THEN
    IF prefs.dnd_start_time <= current_time OR current_time < prefs.dnd_end_time THEN
      RETURN ARRAY['in_app']::notification_channel[];  -- Only in-app during DND
    END IF;
  END IF;

  -- Get type-specific preferences
  type_prefs := prefs.preferences->p_notification_type::TEXT;

  IF type_prefs IS NULL THEN
    -- Use defaults
    RETURN prefs.default_channels;
  END IF;

  -- Check if disabled
  IF (type_prefs->>'enabled')::BOOLEAN = false THEN
    RETURN ARRAY[]::notification_channel[];
  END IF;

  -- Return configured channels
  RETURN ARRAY(
    SELECT jsonb_array_elements_text(type_prefs->'channels')::notification_channel
  );
END;
$$;
```

### Pattern 11: Notifications Table with Delivery Tracking

**What:** Central notification storage with multi-channel delivery status
**When to use:** All notification types
**Why:** Audit trail, delivery confirmation, retry logic

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Recipient
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Content
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Action (what happens when tapped)
  action_type TEXT,  -- 'open_ticket', 'open_conversation', 'open_document'
  action_data JSONB,  -- { "ticket_id": "uuid" }

  -- Source reference
  source_type TEXT,  -- 'ticket', 'message', 'document', etc.
  source_id UUID,

  -- Delivery tracking
  channels_requested notification_channel[] NOT NULL,
  channels_delivered notification_channel[] DEFAULT ARRAY[]::notification_channel[],

  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Scheduling
  scheduled_for TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ  -- Auto-cleanup old notifications
);

-- Per-channel delivery details
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,

  channel notification_channel NOT NULL,

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'delivered', 'failed', 'bounced'

  -- Attempt tracking
  attempt_count INTEGER NOT NULL DEFAULT 0,
  first_attempted_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ,

  -- Success tracking
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,  -- Confirmed delivery (if available)

  -- Failure tracking
  failure_reason TEXT,

  -- Provider details
  provider_message_id TEXT,  -- FCM message ID, email ID, etc.

  CONSTRAINT delivery_unique UNIQUE (notification_id, channel)
);

-- Index for unread notifications
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC)
  WHERE is_read = false;

-- Index for pending deliveries
CREATE INDEX idx_deliveries_pending ON notification_deliveries(notification_id)
  WHERE status = 'pending';
```

### Anti-Patterns to Avoid

- **Storing SLA times on tickets:** Calculate from SLA definitions; prevents inconsistency on rule changes
- **Polling for chat messages:** Use Realtime Broadcast; polling doesn't scale
- **Single notification channel column:** Use array for multi-channel delivery
- **Storing full document on every edit:** Use version chain with storage references
- **Modifying signature records:** Immutable for legal compliance
- **Hardcoded ticket transitions:** Use trigger-validated state machine
- **RRULE expansion at query time:** Pre-compute next occurrence for efficient scheduling

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recurrence expansion | Custom date logic | rrule_plpgsql | RFC 5545 compliant, handles edge cases |
| State machine validation | Application IF statements | ENUM + trigger | Database-enforced, can't be bypassed |
| SLA due date calculation | Inline math | lookup table + trigger | Configurable, consistent |
| Real-time message delivery | Polling loops | Supabase Realtime Broadcast | Low latency, scales to 10K+ |
| Typing indicators | Custom WebSocket | Supabase Presence | Built-in, handles disconnects |
| Version chain traversal | Recursive queries | current_version_id pointer | O(1) access to latest |
| Token staleness check | Cron + app logic | cleanup_stale_push_tokens() | Database-native, atomic |

**Key insight:** These operational systems generate high event volumes. Use database triggers and Realtime for efficiency; polling and application-level checks don't scale.

## Common Pitfalls

### Pitfall 1: SLA Times Not in Business Hours

**What goes wrong:** Due date is midnight Saturday, ticket breaches immediately Monday morning
**Why it happens:** SLA calculation doesn't account for weekends/holidays
**How to avoid:** Implement business_hours_only flag with calendar table for working days
**Warning signs:** Spike in breaches on Mondays, complaints about unfair SLAs

### Pitfall 2: Ticket State Skipping

**What goes wrong:** Ticket jumps from 'open' to 'closed' without resolution
**Why it happens:** Application bug or API misuse
**How to avoid:** Trigger-enforced valid transitions, log all state changes
**Warning signs:** Closed tickets with no resolution time, audit gaps

### Pitfall 3: RRULE Edge Cases

**What goes wrong:** "Last Friday of month" generates wrong dates in some months
**Why it happens:** Hand-rolled recurrence logic doesn't handle RFC 5545 rules
**How to avoid:** Use rrule_plpgsql which is RFC compliant
**Warning signs:** Preventive tickets on wrong dates, missed maintenance

### Pitfall 4: Chat Message Ordering

**What goes wrong:** Messages appear out of order in UI
**Why it happens:** Broadcast doesn't guarantee ordering; client clock drift
**How to avoid:** Use server-side created_at, ORDER BY created_at in queries
**Warning signs:** Replies appearing before questions, confused users

### Pitfall 5: Read Receipt Spam

**What goes wrong:** Database overloaded with read receipt writes
**Why it happens:** Every scroll generates read receipt for visible messages
**How to avoid:** Debounce reads, update last_read_message_id instead of per-message
**Warning signs:** High write load on message_read_receipts, slow chat

### Pitfall 6: Document Version Orphans

**What goes wrong:** Storage has files not referenced by any version
**Why it happens:** Upload completed but transaction rolled back
**How to avoid:** Cleanup job matching storage to database, pre-signed URL expiry
**Warning signs:** Growing storage costs, orphan files in bucket

### Pitfall 7: Push Token Overwrite

**What goes wrong:** User logs in on new device, old device stops receiving notifications
**Why it happens:** Token overwrites instead of multi-device support
**How to avoid:** Use (user_id, device_id, platform) as unique constraint
**Warning signs:** Users complaining one device doesn't get notifications

### Pitfall 8: Signature Tampering Undetected

**What goes wrong:** Signature record modified, but modification undetected
**Why it happens:** No hash verification, no immutability trigger
**How to avoid:** signature_hash + prevent_signature_modification trigger
**Warning signs:** Legal disputes over signature authenticity

## Code Examples

### Complete Ticket Categories Table

```sql
CREATE TABLE ticket_categories (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- Icon name or emoji
  color TEXT,  -- Hex color for UI

  -- Parent category (for hierarchy)
  parent_category_id UUID REFERENCES ticket_categories(id),

  -- Assignment defaults
  default_assignee_id UUID REFERENCES auth.users(id),
  escalation_contact_id UUID REFERENCES auth.users(id),

  -- SLA defaults (can be overridden in sla_definitions)
  default_response_hours INTEGER,
  default_resolution_hours INTEGER,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT categories_unique_name UNIQUE (community_id, name)
);

-- Example categories:
-- Plomeria (Plumbing)
-- Electricidad (Electrical)
-- Jardineria (Landscaping)
-- Limpieza (Cleaning)
-- Seguridad (Security)
-- Elevadores (Elevators)
-- Areas Comunes (Common Areas)
```

### Complete Ticket Comments Table

```sql
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,

  -- Author
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_role TEXT NOT NULL,  -- 'reporter', 'assignee', 'admin', 'system'

  -- Content
  content TEXT,

  -- Media attachments
  photo_urls TEXT[],

  -- Status change tracking
  status_from ticket_status,
  status_to ticket_status,

  -- Private note (only visible to staff)
  is_internal BOOLEAN NOT NULL DEFAULT false,

  -- System comment (auto-generated)
  is_system BOOLEAN NOT NULL DEFAULT false,
  system_action TEXT,  -- 'status_changed', 'assigned', 'priority_changed'
  system_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for ticket timeline
CREATE INDEX idx_ticket_comments_timeline ON ticket_comments(ticket_id, created_at);
```

### Notification Templates

```sql
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID REFERENCES communities(id),  -- NULL for system templates

  -- Template identification
  notification_type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  locale TEXT NOT NULL DEFAULT 'es-MX',

  -- Content (supports variables like {{ticket_title}}, {{resident_name}})
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,

  -- Channel-specific options
  options JSONB DEFAULT '{}'::JSONB,
  -- Push: { "sound": "default", "badge": true }
  -- Email: { "subject": "...", "reply_to": "..." }

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT templates_unique UNIQUE (community_id, notification_type, channel, locale)
);

-- Example templates:
INSERT INTO notification_templates (notification_type, channel, locale, title_template, body_template)
VALUES
  ('ticket_created', 'push', 'es-MX',
   'Nuevo ticket #{{ticket_number}}',
   '{{reporter_name}} reporto: {{ticket_title}}'),
  ('ticket_assigned', 'push', 'es-MX',
   'Ticket asignado',
   'Se te asigno el ticket #{{ticket_number}}: {{ticket_title}}'),
  ('sla_breach', 'push', 'es-MX',
   'SLA Vencido',
   'El ticket #{{ticket_number}} ha excedido su tiempo de {{breach_type}}');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TEXT status columns | ENUM with transitions | PostgreSQL 9.1+ | Type safety, validation |
| Manual SLA checks | Trigger-computed due_at | Always best | Consistent, automatic |
| Custom recurrence logic | rrule_plpgsql | RFC 5545 adoption | Edge case handling |
| Polling for chat | Realtime Broadcast | Supabase 2023+ | Low latency, scale |
| Full document copies | Version chain with storage refs | Modern approach | Storage efficiency |
| Basic timestamps | Full audit trail (IP, device) | ESIGN/UETA compliance | Legal validity |

**Deprecated/outdated:**
- Storing files in BYTEA: Use Supabase Storage with RLS
- Single notification channel: Multi-channel delivery expected
- Application-level state validation: Use database triggers
- Polling for real-time features: WebSocket/Realtime standard

## Open Questions

### 1. Business Hours Calendar

**What we know:** SLA calculations need to exclude nights/weekends/holidays
**What's unclear:** How to handle per-community calendars (some communities have 24/7 maintenance)
**Recommendation:** Add `business_hours_calendar` table with community-specific working hours and holidays. Implement `add_business_hours(timestamp, interval, calendar_id)` function.

### 2. Offline Chat Sync

**What we know:** PowerSync syncs PostgreSQL to SQLite for offline
**What's unclear:** How to handle Realtime Broadcast messages created while offline
**Recommendation:** Store all messages in PostgreSQL (not just ephemeral). PowerSync syncs messages table. Broadcast is for instant delivery only, not persistence.

### 3. Push Notification Service

**What we know:** Token schema supports FCM/APNs
**What's unclear:** Which service will handle actual delivery (Edge Functions, external service like OneSignal)
**Recommendation:** Schema is agnostic. Design Edge Function interface that can be swapped. Store provider_message_id for debugging.

### 4. Document OCR

**What we know:** Documents stored in Supabase Storage
**What's unclear:** Whether to extract text for search
**Recommendation:** Add `extracted_text TEXT` to document_versions. Populate via Edge Function using OCR service. Enable full-text search with tsvector.

## Sources

### Primary (HIGH confidence)
- [PostgreSQL ENUM Documentation](https://www.postgresql.org/docs/current/datatype-enum.html) - State machine patterns
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime) - Broadcast, Presence patterns
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) - Chat implementation
- [Supabase Realtime Presence](https://supabase.com/docs/guides/realtime/presence) - Typing indicators
- [Firebase Token Management](https://firebase.google.com/docs/cloud-messaging/manage-tokens) - Push token best practices

### Secondary (MEDIUM confidence)
- [Felix Geisendorfer - State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) - ENUM + aggregate pattern
- [rrule_plpgsql](https://github.com/sirrodgepodge/rrule_plpgsql) - RFC 5545 recurrence in PostgreSQL
- [Thoughtbot - Recurring Events](https://thoughtbot.com/blog/recurring-events-and-postgresql) - RRULE patterns
- [W3Tutorials - Notification Schema](https://www.w3tutorials.net/blog/database-schema-for-notification-system-similar-to-facebooks/) - Fan-out pattern
- [Specfy - Git-like Versioning](https://www.specfy.io/blog/7-git-like-versioning-in-postgres) - Copy-on-write approach

### Tertiary (LOW confidence)
- [ButterflyMX - Guard House](https://butterflymx.com/blog/guard-house/) - Guard booth concepts (no schema)
- [ESIGN Compliance](https://www.esignglobal.com/blog/are-electronic-signatures-legal-in-america) - Legal requirements
- [Centrifugo Push](https://centrifugal.dev/docs/pro/push_notifications) - Token management patterns

## Metadata

**Confidence breakdown:**
- Ticket state machine: HIGH - PostgreSQL ENUM documentation
- SLA patterns: MEDIUM - Industry best practices, no single authoritative source
- RRULE scheduling: HIGH - rrule_plpgsql is RFC 5545 compliant
- Chat implementation: HIGH - Supabase official documentation
- Document versioning: MEDIUM - Multiple approaches, copy-on-write most common
- Digital signatures: MEDIUM - Legal requirements clear, implementation patterns vary
- Push tokens: HIGH - Firebase official best practices
- Notification preferences: MEDIUM - JSONB pattern well-established

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable patterns, Supabase Realtime may evolve)
