# Phase 5: Amenities, Communication & Marketplace - Research

**Researched:** 2026-01-29
**Domain:** PostgreSQL schema design for reservations, social features, and marketplace moderation
**Confidence:** HIGH

## Summary

This phase enables community engagement through three interconnected domains: amenity reservations with scheduling constraints, social communication with nested discussions, and an internal marketplace with moderation. The research focused on nine key technical questions spanning PostgreSQL exclusion constraints for double-booking prevention, booking rules engines, waitlist auto-promotion, comment hierarchy patterns, reaction storage, announcement targeting, one-vote-per-unit enforcement, marketplace moderation queues, and safe exchange zones.

The standard approach uses PostgreSQL's `btree_gist` extension with exclusion constraints on `tstzrange` columns to prevent overlapping reservations at the database level, guaranteeing atomicity even under concurrent access. For comments, the adjacency list pattern is recommended over ltree given the dynamic nature of community discussions (frequent replies, edits, moves). Reactions should use a denormalized counter pattern with a separate reactions table plus aggregate counts on posts. Announcements use a two-table fan-out design (announcement + recipient_announcements) with segment-based targeting. Marketplace moderation leverages `FOR UPDATE SKIP LOCKED` for efficient queue processing.

**Primary recommendation:** Use PostgreSQL exclusion constraints with `tstzrange` for reservation slot integrity, adjacency list for comments, denormalized counters for reactions, and fan-out pattern for announcement delivery to ensure both correctness and performance.

## Standard Stack

This phase is pure PostgreSQL/Supabase schema work following Phase 1-4 patterns.

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL | 15+ | Database engine | Supabase default, exclusion constraints, range types |
| btree_gist extension | Built-in | Enables exclusion constraints on scalar types | Required for room_id + tstzrange constraints |
| Supabase Storage | Latest | Media storage for posts/listings | S3-compatible, RLS integrated |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| pg_trgm extension | Fuzzy text search | Marketplace listing search, channel search |
| unaccent extension | Accent-insensitive search | Mexican names, listing titles |
| NOTIFY/LISTEN | Real-time events | Waitlist promotions, new announcements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ltree for comments | Adjacency list | Adjacency chosen: simpler, frequent moves/edits |
| Closure table for comments | Adjacency list | Adjacency chosen: less storage, simpler inserts |
| Separate reactions table | JSONB array on posts | Table chosen: queryable, enforces uniqueness |
| Application-level booking validation | DB exclusion constraints | DB chosen: atomic, concurrent-safe |

## Architecture Patterns

### Recommended Schema Structure

```
public/
  -- Amenities
  amenities (amenity definitions with schedules)
  amenity_rules (booking rules per amenity)
  reservations (bookings with tstzrange)
  reservation_waitlist (queue for overbooked slots)

  -- Communication
  channels (discussion categories)
  posts (content with media references)
  post_reactions (emoji reactions table)
  post_comments (nested via parent_id)
  announcements (targeted messages)
  announcement_recipients (fan-out delivery)
  surveys (questions with options)
  survey_votes (one per unit)

  -- Marketplace
  marketplace_listings (sale, service, rental, wanted)
  listing_images (media references)
  exchange_zones (safe meeting points)
  moderation_queue (pending review items)
```

### Pattern 1: Exclusion Constraints for Reservation Slots

**What:** PostgreSQL exclusion constraints prevent overlapping time ranges at the database level
**When to use:** Any booking/reservation system requiring double-booking prevention
**Why:** Atomic enforcement even under concurrent transactions; no application-level race conditions

```sql
-- Source: PostgreSQL Documentation (https://www.postgresql.org/docs/current/rangetypes.html)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  amenity_id UUID NOT NULL REFERENCES amenities(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  resident_id UUID NOT NULL REFERENCES residents(id),

  -- Time range for the reservation
  -- '[)' means inclusive start, exclusive end (standard for bookings)
  reserved_range TSTZRANGE NOT NULL,

  -- Status
  status reservation_status NOT NULL DEFAULT 'confirmed',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- EXCLUSION CONSTRAINT: Prevents overlapping reservations for same amenity
  -- Two reservations can overlap ONLY if they are for different amenities
  -- OR one is cancelled (status != 'confirmed')
  CONSTRAINT reservations_no_overlap
    EXCLUDE USING GIST (
      amenity_id WITH =,
      reserved_range WITH &&
    )
    WHERE (status = 'confirmed' AND deleted_at IS NULL)
);

-- Example insert showing conflict detection:
-- INSERT 1: Success
INSERT INTO reservations (amenity_id, reserved_range)
VALUES ('pool-uuid', '[2026-01-29 14:00, 2026-01-29 16:00)');

-- INSERT 2: ERROR - conflicts with first reservation
INSERT INTO reservations (amenity_id, reserved_range)
VALUES ('pool-uuid', '[2026-01-29 15:00, 2026-01-29 17:00)');
-- ERROR: conflicting key value violates exclusion constraint

-- INSERT 3: Success - different amenity
INSERT INTO reservations (amenity_id, reserved_range)
VALUES ('gym-uuid', '[2026-01-29 15:00, 2026-01-29 17:00)');
```

**CRITICAL:** PostgreSQL 18 introduces cleaner `WITHOUT OVERLAPS` syntax, but current Supabase runs PostgreSQL 15. Use explicit exclusion constraint syntax.

### Pattern 2: Booking Rules Engine

**What:** Configurable rules per amenity for quotas, advance windows, blackout dates
**When to use:** Amenity management with varying restriction levels
**Why:** Flexible, data-driven rules without code changes

```sql
-- Source: Property management booking systems (bookedscheduler.com, condocontrol.com)
CREATE TYPE rule_type AS ENUM (
  'max_per_day',      -- Max reservations per unit per day
  'max_per_week',     -- Max reservations per unit per week
  'max_per_month',    -- Max reservations per unit per month
  'advance_min',      -- Minimum hours in advance
  'advance_max',      -- Maximum days in advance
  'duration_min',     -- Minimum duration in minutes
  'duration_max',     -- Maximum duration in minutes
  'blackout',         -- Blocked dates/times
  'require_deposit',  -- Requires deposit
  'owner_only'        -- Only unit owners can book
);

CREATE TABLE amenity_rules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  amenity_id UUID NOT NULL REFERENCES amenities(id),

  rule_type rule_type NOT NULL,
  rule_value JSONB NOT NULL,
  -- Examples:
  -- max_per_day: {"limit": 1}
  -- advance_max: {"days": 30}
  -- blackout: {"start": "2026-12-24", "end": "2026-12-26", "reason": "Holidays"}
  -- duration_max: {"minutes": 120}

  -- Priority for rule evaluation (higher = checked first)
  priority INTEGER NOT NULL DEFAULT 0,

  -- Active period
  effective_from DATE,
  effective_until DATE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rule validation function
CREATE OR REPLACE FUNCTION validate_booking_rules(
  p_amenity_id UUID,
  p_unit_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
)
RETURNS TABLE(is_valid BOOLEAN, violated_rule TEXT, message TEXT)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  r RECORD;
  booking_count INTEGER;
  advance_hours NUMERIC;
  duration_minutes NUMERIC;
BEGIN
  advance_hours := EXTRACT(EPOCH FROM (p_start_time - now())) / 3600;
  duration_minutes := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60;

  FOR r IN
    SELECT * FROM amenity_rules
    WHERE amenity_id = p_amenity_id
      AND is_active = true
      AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
      AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
    ORDER BY priority DESC
  LOOP
    CASE r.rule_type
      WHEN 'advance_min' THEN
        IF advance_hours < (r.rule_value->>'hours')::NUMERIC THEN
          RETURN QUERY SELECT false, 'advance_min',
            format('Must book at least %s hours in advance', r.rule_value->>'hours');
          RETURN;
        END IF;

      WHEN 'advance_max' THEN
        IF advance_hours > ((r.rule_value->>'days')::NUMERIC * 24) THEN
          RETURN QUERY SELECT false, 'advance_max',
            format('Cannot book more than %s days in advance', r.rule_value->>'days');
          RETURN;
        END IF;

      WHEN 'max_per_day' THEN
        SELECT COUNT(*) INTO booking_count
        FROM reservations
        WHERE amenity_id = p_amenity_id
          AND unit_id = p_unit_id
          AND status = 'confirmed'
          AND reserved_range && tstzrange(
            date_trunc('day', p_start_time),
            date_trunc('day', p_start_time) + interval '1 day',
            '[)'
          );
        IF booking_count >= (r.rule_value->>'limit')::INTEGER THEN
          RETURN QUERY SELECT false, 'max_per_day',
            format('Maximum %s reservation(s) per day reached', r.rule_value->>'limit');
          RETURN;
        END IF;

      WHEN 'blackout' THEN
        IF p_start_time::DATE BETWEEN
           (r.rule_value->>'start')::DATE AND (r.rule_value->>'end')::DATE THEN
          RETURN QUERY SELECT false, 'blackout',
            format('Amenity unavailable: %s', COALESCE(r.rule_value->>'reason', 'Maintenance'));
          RETURN;
        END IF;

      ELSE
        -- Other rules handled similarly
        NULL;
    END CASE;
  END LOOP;

  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT;
END;
$$;
```

### Pattern 3: Waitlist with Auto-Promotion Trigger

**What:** FIFO queue that auto-promotes when reservations cancel
**When to use:** High-demand amenities with cancellation handling
**Why:** Automated slot filling improves utilization; NOTIFY enables real-time alerts

```sql
-- Source: PostgreSQL NOTIFY documentation + queue patterns
CREATE TABLE reservation_waitlist (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  amenity_id UUID NOT NULL REFERENCES amenities(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  resident_id UUID NOT NULL REFERENCES residents(id),

  -- Desired time range
  requested_range TSTZRANGE NOT NULL,

  -- Position tracking (auto-increment per amenity+date)
  position INTEGER NOT NULL,

  -- Status
  status waitlist_status NOT NULL DEFAULT 'waiting',
  -- waiting, promoted, expired, cancelled

  -- Promotion tracking
  promoted_to_reservation_id UUID REFERENCES reservations(id),
  promoted_at TIMESTAMPTZ,

  -- Expiry (auto-expire if not promoted by this time)
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique position per amenity per day
  CONSTRAINT waitlist_position_unique
    UNIQUE (amenity_id, position, (lower(requested_range)::DATE))
);

-- Trigger function: Auto-promote from waitlist when reservation cancelled
CREATE OR REPLACE FUNCTION promote_from_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  waitlist_entry RECORD;
  new_reservation_id UUID;
BEGIN
  -- Only process cancellations
  IF NEW.status != 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Find first waitlist entry for this slot
  SELECT * INTO waitlist_entry
  FROM public.reservation_waitlist
  WHERE amenity_id = NEW.amenity_id
    AND requested_range && NEW.reserved_range
    AND status = 'waiting'
    AND expires_at > now()
  ORDER BY position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;  -- Prevent concurrent promotion races

  IF FOUND THEN
    -- Create new reservation for waitlist entry
    INSERT INTO public.reservations (
      community_id, amenity_id, unit_id, resident_id,
      reserved_range, status
    ) VALUES (
      waitlist_entry.community_id,
      waitlist_entry.amenity_id,
      waitlist_entry.unit_id,
      waitlist_entry.resident_id,
      waitlist_entry.requested_range,
      'confirmed'
    )
    RETURNING id INTO new_reservation_id;

    -- Update waitlist entry
    UPDATE public.reservation_waitlist
    SET status = 'promoted',
        promoted_to_reservation_id = new_reservation_id,
        promoted_at = now()
    WHERE id = waitlist_entry.id;

    -- Notify for real-time UI update
    PERFORM pg_notify(
      'waitlist_promotion',
      json_build_object(
        'waitlist_id', waitlist_entry.id,
        'reservation_id', new_reservation_id,
        'resident_id', waitlist_entry.resident_id,
        'amenity_id', waitlist_entry.amenity_id
      )::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reservation_cancellation_promote
  AFTER UPDATE ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION promote_from_waitlist();
```

### Pattern 4: Adjacency List for Nested Comments

**What:** Simple parent_id reference for comment hierarchy
**When to use:** Community discussions with frequent replies and edits
**Why:** Simple inserts, easy moves, good enough performance for typical depths

```sql
-- Source: DEV.to hierarchical data comparison, PostgreSQL best practices
CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- Hierarchy (adjacency list)
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,

  -- Denormalized for query optimization
  depth INTEGER NOT NULL DEFAULT 0,
  root_comment_id UUID,  -- For fetching entire threads

  -- Content
  author_id UUID NOT NULL REFERENCES residents(id),
  content TEXT NOT NULL,

  -- Moderation
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  hidden_reason TEXT,
  hidden_by UUID REFERENCES auth.users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Set depth and root on insert
CREATE OR REPLACE FUNCTION set_comment_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    NEW.depth := 0;
    NEW.root_comment_id := NEW.id;
  ELSE
    SELECT depth + 1, COALESCE(root_comment_id, id)
    INTO NEW.depth, NEW.root_comment_id
    FROM post_comments
    WHERE id = NEW.parent_comment_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER comment_hierarchy_trigger
  BEFORE INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_comment_hierarchy();

-- Recursive CTE for fetching thread
-- Performance: O(n*depth), acceptable for typical 5-10 level threads
WITH RECURSIVE comment_tree AS (
  SELECT id, parent_comment_id, content, depth, 0 as sort_order,
         ARRAY[created_at] as path
  FROM post_comments
  WHERE post_id = $1 AND parent_comment_id IS NULL

  UNION ALL

  SELECT c.id, c.parent_comment_id, c.content, c.depth, ct.sort_order + 1,
         ct.path || c.created_at
  FROM post_comments c
  INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
)
SELECT * FROM comment_tree ORDER BY path;
```

### Pattern 5: Reactions with Denormalized Counters

**What:** Separate reactions table plus aggregate counts on posts
**When to use:** Social features with reaction counts displayed frequently
**Why:** Fast reads via counter lookup; uniqueness enforced per user

```sql
-- Source: AlgoMaster scalable likes system design
CREATE TABLE post_reactions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id),

  -- Emoji reaction (stored as emoji or code)
  reaction_type TEXT NOT NULL,  -- 'like', 'love', 'laugh', 'sad', 'angry' or emoji

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One reaction per user per post
  CONSTRAINT reactions_unique_per_user UNIQUE (post_id, resident_id)
);

-- Denormalized counters on posts table
ALTER TABLE posts ADD COLUMN reaction_counts JSONB NOT NULL DEFAULT '{}'::JSONB;
-- Example: {"like": 5, "love": 2, "laugh": 1}

-- Trigger to maintain counters
CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET reaction_counts = jsonb_set(
      reaction_counts,
      ARRAY[NEW.reaction_type],
      to_jsonb(COALESCE((reaction_counts->>NEW.reaction_type)::INTEGER, 0) + 1)
    )
    WHERE id = NEW.post_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET reaction_counts = jsonb_set(
      reaction_counts,
      ARRAY[OLD.reaction_type],
      to_jsonb(GREATEST((reaction_counts->>OLD.reaction_type)::INTEGER - 1, 0))
    )
    WHERE id = OLD.post_id;

  ELSIF TG_OP = 'UPDATE' AND OLD.reaction_type != NEW.reaction_type THEN
    UPDATE posts
    SET reaction_counts = jsonb_set(
      jsonb_set(
        reaction_counts,
        ARRAY[OLD.reaction_type],
        to_jsonb(GREATEST((reaction_counts->>OLD.reaction_type)::INTEGER - 1, 0))
      ),
      ARRAY[NEW.reaction_type],
      to_jsonb(COALESCE((reaction_counts->>NEW.reaction_type)::INTEGER, 0) + 1)
    )
    WHERE id = NEW.post_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER reactions_counter_trigger
  AFTER INSERT OR UPDATE OR DELETE ON post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reaction_counts();
```

### Pattern 6: Announcement Targeting with Read Receipts

**What:** Fan-out pattern with segment-based targeting
**When to use:** Targeted messages to specific unit types, buildings, roles
**Why:** Pre-computed recipient list enables fast read receipt tracking

```sql
-- Source: Notification system best practices (Medium article pattern)
CREATE TYPE announcement_segment AS ENUM (
  'all',              -- Everyone in community
  'owners',           -- Only owners
  'tenants',          -- Only tenants
  'building',         -- Specific building(s)
  'unit_type',        -- Specific unit types
  'delinquent',       -- Units with outstanding balance
  'role'              -- Specific user roles
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_urls TEXT[],

  -- Author
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Targeting
  target_segment announcement_segment NOT NULL DEFAULT 'all',
  target_criteria JSONB,
  -- Examples:
  -- building: {"buildings": ["Tower A", "Tower B"]}
  -- unit_type: {"types": ["departamento"]}
  -- delinquent: {"min_balance": 1000}
  -- role: {"roles": ["admin", "manager"]}

  -- Scheduling
  publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,

  -- Priority
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,

  -- Metrics (denormalized)
  total_recipients INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  acknowledged_count INTEGER NOT NULL DEFAULT 0,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Fan-out table for delivery and read tracking
CREATE TABLE announcement_recipients (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id),
  unit_id UUID REFERENCES units(id),

  -- Delivery tracking
  delivered_at TIMESTAMPTZ,
  delivery_channel TEXT,  -- 'push', 'email', 'sms', 'in_app'

  -- Read receipt
  read_at TIMESTAMPTZ,

  -- Acknowledgment (for important announcements)
  acknowledged_at TIMESTAMPTZ,

  CONSTRAINT recipient_unique UNIQUE (announcement_id, resident_id)
);

-- Function to expand segments into recipients
CREATE OR REPLACE FUNCTION expand_announcement_recipients(p_announcement_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  ann RECORD;
  recipient_count INTEGER := 0;
BEGIN
  SELECT * INTO ann FROM announcements WHERE id = p_announcement_id;

  INSERT INTO announcement_recipients (announcement_id, resident_id, unit_id)
  SELECT p_announcement_id, r.id, o.unit_id
  FROM residents r
  LEFT JOIN occupancies o ON o.resident_id = r.id AND o.status = 'active'
  WHERE r.community_id = ann.community_id
    AND r.deleted_at IS NULL
    AND r.onboarding_status = 'active'
    AND (
      ann.target_segment = 'all'
      OR (ann.target_segment = 'owners' AND o.occupancy_type = 'owner')
      OR (ann.target_segment = 'tenants' AND o.occupancy_type = 'tenant')
      OR (ann.target_segment = 'building' AND EXISTS (
        SELECT 1 FROM units u
        WHERE u.id = o.unit_id
        AND u.building = ANY(
          SELECT jsonb_array_elements_text(ann.target_criteria->'buildings')
        )
      ))
      -- Additional segment logic...
    )
  ON CONFLICT (announcement_id, resident_id) DO NOTHING;

  GET DIAGNOSTICS recipient_count = ROW_COUNT;

  UPDATE announcements
  SET total_recipients = recipient_count
  WHERE id = p_announcement_id;

  RETURN recipient_count;
END;
$$;

-- Trigger to update read counts
CREATE OR REPLACE FUNCTION update_announcement_read_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    UPDATE announcements
    SET read_count = read_count + 1
    WHERE id = NEW.announcement_id;
  END IF;

  IF NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL THEN
    UPDATE announcements
    SET acknowledged_count = acknowledged_count + 1
    WHERE id = NEW.announcement_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER announcement_read_trigger
  AFTER UPDATE ON announcement_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_read_count();
```

### Pattern 7: One-Vote-Per-Unit with Coefficient Weighting

**What:** Survey votes enforced at unit level with optional coefficient weighting
**When to use:** HOA assemblies, community decisions requiring proportional voting
**Why:** Mexican condominium law requires coefficient-based voting for certain decisions

```sql
-- Source: Mexican Condominium Law (LPCIDF Article 55), weighted voting systems
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Content
  title TEXT NOT NULL,
  description TEXT,

  -- Options
  options JSONB NOT NULL,
  -- Example: [{"id": "opt1", "text": "Approve"}, {"id": "opt2", "text": "Reject"}]

  -- Configuration
  voting_method TEXT NOT NULL DEFAULT 'simple',
  -- 'simple' = one vote per unit (equal weight)
  -- 'coefficient' = weighted by unit coefficient (indiviso)

  quorum_percentage NUMERIC(5,2),  -- Required participation %
  approval_threshold NUMERIC(5,2), -- Required approval % (e.g., 66.67 for 2/3)

  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,

  -- Results (computed after close)
  is_closed BOOLEAN NOT NULL DEFAULT false,
  results JSONB,
  -- Example: {"opt1": {"votes": 15, "weight": 65.5}, "opt2": {"votes": 8, "weight": 34.5}}

  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE survey_votes (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,

  -- ONE VOTE PER UNIT (not per resident)
  unit_id UUID NOT NULL REFERENCES units(id),

  -- Who cast the vote (must be authorized for unit)
  voted_by UUID NOT NULL REFERENCES residents(id),

  -- The choice
  option_id TEXT NOT NULL,

  -- Weight at time of voting (snapshot)
  vote_weight NUMERIC(7,4) NOT NULL DEFAULT 1,

  -- Audit
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CRITICAL: One vote per unit per survey
  CONSTRAINT survey_votes_one_per_unit UNIQUE (survey_id, unit_id)
);

-- Function to cast vote with validation
CREATE OR REPLACE FUNCTION cast_survey_vote(
  p_survey_id UUID,
  p_unit_id UUID,
  p_option_id TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_survey RECORD;
  v_unit RECORD;
  v_occupancy RECORD;
  v_weight NUMERIC(7,4);
BEGIN
  -- Get survey
  SELECT * INTO v_survey FROM surveys
  WHERE id = p_survey_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Survey not found';
    RETURN;
  END IF;

  -- Check timing
  IF now() < v_survey.starts_at THEN
    RETURN QUERY SELECT false, 'Voting has not started yet';
    RETURN;
  END IF;

  IF now() > v_survey.ends_at OR v_survey.is_closed THEN
    RETURN QUERY SELECT false, 'Voting has ended';
    RETURN;
  END IF;

  -- Check option validity
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_survey.options) opt
    WHERE opt->>'id' = p_option_id
  ) THEN
    RETURN QUERY SELECT false, 'Invalid option';
    RETURN;
  END IF;

  -- Check voter authorization for unit
  SELECT * INTO v_occupancy FROM occupancies
  WHERE unit_id = p_unit_id
    AND resident_id = auth.uid()
    AND status = 'active'
    AND occupancy_type IN ('owner', 'authorized');  -- Only owners/authorized can vote

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Not authorized to vote for this unit';
    RETURN;
  END IF;

  -- Get unit coefficient for weighted voting
  SELECT * INTO v_unit FROM units WHERE id = p_unit_id;
  v_weight := CASE
    WHEN v_survey.voting_method = 'coefficient' THEN v_unit.coefficient
    ELSE 1.0
  END;

  -- Insert vote (constraint prevents duplicates)
  INSERT INTO survey_votes (survey_id, unit_id, voted_by, option_id, vote_weight)
  VALUES (p_survey_id, p_unit_id, auth.uid(), p_option_id, v_weight)
  ON CONFLICT (survey_id, unit_id)
  DO UPDATE SET option_id = EXCLUDED.option_id,
                voted_at = now(),
                voted_by = EXCLUDED.voted_by;

  RETURN QUERY SELECT true, 'Vote recorded';
END;
$$;
```

### Pattern 8: Marketplace Moderation Queue with SKIP LOCKED

**What:** Efficient queue processing preventing concurrent moderator conflicts
**When to use:** Content moderation requiring manual review
**Why:** FOR UPDATE SKIP LOCKED enables horizontal scaling of moderators

```sql
-- Source: PostgreSQL SKIP LOCKED documentation, content moderation best practices
CREATE TYPE moderation_status AS ENUM (
  'pending',      -- Awaiting review
  'in_review',    -- Claimed by moderator
  'approved',     -- Published
  'rejected',     -- Blocked
  'flagged'       -- Reported by users
);

CREATE TYPE listing_category AS ENUM (
  'sale',         -- Item for sale
  'service',      -- Service offered
  'rental',       -- Item for rent
  'wanted'        -- Looking for item/service
);

CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Seller/poster
  seller_id UUID NOT NULL REFERENCES residents(id),
  unit_id UUID REFERENCES units(id),

  -- Listing details
  category listing_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price money_amount,
  price_negotiable BOOLEAN NOT NULL DEFAULT false,

  -- Media
  image_urls TEXT[],

  -- Location preference
  preferred_exchange_zone_id UUID REFERENCES exchange_zones(id),

  -- Moderation
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  moderated_by UUID REFERENCES auth.users(id),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Auto-flagging
  auto_flag_reasons TEXT[],

  -- Activity
  view_count INTEGER NOT NULL DEFAULT 0,
  inquiry_count INTEGER NOT NULL DEFAULT 0,

  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  is_sold BOOLEAN NOT NULL DEFAULT false,
  sold_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Moderation queue table for efficient processing
CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Polymorphic reference
  item_type TEXT NOT NULL,  -- 'listing', 'post', 'comment'
  item_id UUID NOT NULL,

  -- Queue management
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher = review first
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution TEXT,  -- 'approved', 'rejected'
  resolution_notes TEXT,

  CONSTRAINT queue_item_unique UNIQUE (item_type, item_id)
);

-- Index for efficient queue claiming
CREATE INDEX idx_moderation_queue_pending
  ON moderation_queue(community_id, priority DESC, queued_at ASC)
  WHERE assigned_to IS NULL AND resolved_at IS NULL;

-- Function to claim next item from queue
CREATE OR REPLACE FUNCTION claim_moderation_item(p_community_id UUID)
RETURNS TABLE(queue_id UUID, item_type TEXT, item_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  claimed RECORD;
BEGIN
  -- FOR UPDATE SKIP LOCKED prevents concurrent claims
  SELECT * INTO claimed
  FROM moderation_queue
  WHERE community_id = p_community_id
    AND assigned_to IS NULL
    AND resolved_at IS NULL
  ORDER BY priority DESC, queued_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Claim the item
  UPDATE moderation_queue
  SET assigned_to = auth.uid(),
      assigned_at = now()
  WHERE id = claimed.id;

  RETURN QUERY SELECT claimed.id, claimed.item_type, claimed.item_id;
END;
$$;

-- Function to resolve moderation
CREATE OR REPLACE FUNCTION resolve_moderation(
  p_queue_id UUID,
  p_resolution TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  q RECORD;
BEGIN
  SELECT * INTO q FROM moderation_queue WHERE id = p_queue_id;

  IF NOT FOUND OR q.assigned_to != auth.uid() THEN
    RETURN false;
  END IF;

  -- Update queue
  UPDATE moderation_queue
  SET resolved_at = now(),
      resolution = p_resolution,
      resolution_notes = p_notes
  WHERE id = p_queue_id;

  -- Update source item
  IF q.item_type = 'listing' THEN
    UPDATE marketplace_listings
    SET moderation_status = p_resolution::moderation_status,
        moderated_by = auth.uid(),
        moderated_at = now(),
        rejection_reason = CASE WHEN p_resolution = 'rejected' THEN p_notes END
    WHERE id = q.item_id;
  -- Handle other item types...
  END IF;

  RETURN true;
END;
$$;
```

### Pattern 9: Safe Exchange Zones

**What:** Designated locations for marketplace transactions
**When to use:** Facilitating safe in-person exchanges within community
**Why:** Reduces risk of disputes, provides accountability

```sql
-- Source: Police department exchange zone programs, property management best practices
CREATE TABLE exchange_zones (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Location details
  name TEXT NOT NULL,
  description TEXT,
  location_instructions TEXT,

  -- Coordinates (for map display)
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),

  -- Amenity reference (if exchange zone is at an amenity)
  amenity_id UUID REFERENCES amenities(id),

  -- Availability
  available_hours JSONB,
  -- Example: {"mon": {"open": "08:00", "close": "20:00"}, "sat": {"open": "09:00", "close": "18:00"}}

  -- Features
  has_video_surveillance BOOLEAN NOT NULL DEFAULT false,
  has_lighting BOOLEAN NOT NULL DEFAULT true,
  is_indoor BOOLEAN NOT NULL DEFAULT false,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Exchange appointments (optional scheduling)
CREATE TABLE exchange_appointments (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  listing_id UUID NOT NULL REFERENCES marketplace_listings(id),
  exchange_zone_id UUID NOT NULL REFERENCES exchange_zones(id),

  -- Parties
  seller_id UUID NOT NULL REFERENCES residents(id),
  buyer_id UUID NOT NULL REFERENCES residents(id),

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,

  -- Status
  status approval_status NOT NULL DEFAULT 'pending',
  -- pending (proposed), approved (confirmed), completed, cancelled

  -- Completion tracking
  seller_confirmed BOOLEAN,
  buyer_confirmed BOOLEAN,
  completed_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Anti-Patterns to Avoid

- **Application-level booking validation:** Race conditions under concurrent access; exclusion constraints are atomic
- **Storing all reactions in JSONB array on post:** Cannot enforce uniqueness, no efficient aggregation
- **Using ltree for frequently-edited comments:** Moving subtrees requires updating all descendant paths
- **Single notifications table without fan-out:** Cannot track individual read receipts efficiently
- **Polling for moderation queue:** Use NOTIFY or FOR UPDATE SKIP LOCKED pattern instead
- **Storing vote weight at query time:** Coefficient may change; snapshot weight at vote time

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlapping reservation prevention | Application CHECK before INSERT | PostgreSQL exclusion constraint | Atomic, concurrent-safe, database-enforced |
| Booking rule validation | Complex IF statements in app | Rule table + validation function | Data-driven, configurable without deploy |
| Comment threading | Recursive app queries | Adjacency list + recursive CTE | Single query, database-optimized |
| Reaction counts | COUNT(*) on every view | Denormalized counter + trigger | O(1) reads vs O(n) aggregation |
| Read receipt tracking | Single is_read column | Fan-out table per recipient | Per-user tracking with timestamps |
| Concurrent moderation | Row locks | FOR UPDATE SKIP LOCKED | Non-blocking, scalable |
| Voting deduplication | Application checks | Unique constraint (survey_id, unit_id) | Database-enforced, atomic |

**Key insight:** PostgreSQL provides specialized features (exclusion constraints, range types, SKIP LOCKED) that solve these problems more correctly than application code. Use them.

## Common Pitfalls

### Pitfall 1: Missing btree_gist Extension

**What goes wrong:** Exclusion constraint creation fails
**Why it happens:** btree_gist not enabled; required for scalar + range combinations
**How to avoid:** Always CREATE EXTENSION IF NOT EXISTS btree_gist before reservation tables
**Warning signs:** ERROR: data type uuid has no default operator class for access method "gist"

### Pitfall 2: Inclusive Range Bounds Causing Gaps

**What goes wrong:** 14:00-15:00 and 15:00-16:00 both blocked as "overlapping"
**Why it happens:** Using '[,]' (inclusive both ends) instead of '[,)' (exclusive end)
**How to avoid:** Always use '[)' bounds for time slots; end of one = start of next
**Warning signs:** Adjacent slots flagged as conflicts

### Pitfall 3: Waitlist Race Conditions

**What goes wrong:** Two waitlist entries promoted to same slot
**Why it happens:** Not using FOR UPDATE SKIP LOCKED in promotion trigger
**How to avoid:** Lock waitlist row during promotion check
**Warning signs:** Multiple reservations for same time slot

### Pitfall 4: Comment Depth Explosion

**What goes wrong:** Recursive CTE times out on deeply nested threads
**Why it happens:** No depth limit enforced
**How to avoid:** Add CHECK (depth <= 20) constraint; flatten UI after limit
**Warning signs:** Slow comment loading on popular posts

### Pitfall 5: Reaction Counter Drift

**What goes wrong:** Displayed count doesn't match actual reactions
**Why it happens:** Trigger failed silently, counter out of sync
**How to avoid:** Periodic reconciliation job; verify in CI
**Warning signs:** COUNT(*) FROM reactions != posts.reaction_counts totals

### Pitfall 6: Vote Manipulation via Occupancy Changes

**What goes wrong:** User changes units mid-survey, votes twice
**Why it happens:** Validation checks current occupancy, not vote-time
**How to avoid:** Snapshot unit_id at vote time; constraint on (survey_id, unit_id)
**Warning signs:** More votes than units in survey

### Pitfall 7: Moderation Queue Starvation

**What goes wrong:** Items stuck in "in_review" forever
**Why it happens:** Moderator assigned but never resolved (closed browser, etc.)
**How to avoid:** Add timeout; reassign if assigned_at > 30 minutes and unresolved
**Warning signs:** Growing queue despite active moderators

### Pitfall 8: Announcement Fan-Out Memory Issues

**What goes wrong:** Insert fails for large community announcements
**Why it happens:** Inserting 10,000 recipient rows in single transaction
**How to avoid:** Batch inserts (1000 at a time) or use background job
**Warning signs:** OOM errors, transaction timeouts on announcement publish

## Code Examples

### Complete Amenities Table

```sql
CREATE TYPE amenity_type AS ENUM (
  'pool',
  'gym',
  'salon',
  'rooftop',
  'bbq',
  'court',
  'room',
  'parking',
  'other'
);

CREATE TABLE amenities (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  amenity_type amenity_type NOT NULL,

  -- Location
  location TEXT,
  floor_number INTEGER,

  -- Capacity
  capacity INTEGER,

  -- Schedule (operating hours)
  schedule JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Example: {
  --   "mon": {"open": "06:00", "close": "22:00"},
  --   "tue": {"open": "06:00", "close": "22:00"},
  --   ...
  --   "sun": {"open": "08:00", "close": "20:00"}
  -- }

  -- Booking configuration
  requires_reservation BOOLEAN NOT NULL DEFAULT true,
  min_advance_hours INTEGER DEFAULT 1,
  max_advance_days INTEGER DEFAULT 30,
  default_duration_minutes INTEGER DEFAULT 60,

  -- Fees
  hourly_rate money_amount,
  deposit_amount money_amount,

  -- Media
  photo_urls TEXT[],
  rules_document_url TEXT,

  -- Status
  status general_status NOT NULL DEFAULT 'active',
  maintenance_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT amenities_unique_name UNIQUE (community_id, name)
);
```

### Complete Posts Table

```sql
CREATE TYPE post_type AS ENUM (
  'discussion',    -- General discussion
  'question',      -- Q&A format
  'event',         -- Event announcement
  'poll'           -- Simple poll
);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  channel_id UUID NOT NULL REFERENCES channels(id),

  -- Author
  author_id UUID NOT NULL REFERENCES residents(id),

  -- Content
  post_type post_type NOT NULL DEFAULT 'discussion',
  title TEXT,
  content TEXT NOT NULL,

  -- Media
  media_urls TEXT[],

  -- Poll data (if post_type = 'poll')
  poll_options JSONB,
  poll_ends_at TIMESTAMPTZ,
  poll_results JSONB,

  -- Engagement metrics (denormalized)
  reaction_counts JSONB NOT NULL DEFAULT '{}'::JSONB,
  comment_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,

  -- Moderation
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,  -- No new comments
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  hidden_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Trigger to maintain comment_count
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER post_comment_count_trigger
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comment_count();
```

### Complete Channels Table

```sql
CREATE TYPE channel_type AS ENUM (
  'general',       -- Open discussion
  'building',      -- Building-specific
  'committee',     -- Committee discussions
  'announcements', -- Admin announcements only
  'marketplace'    -- Buy/sell/trade
);

CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),

  name TEXT NOT NULL,
  description TEXT,
  channel_type channel_type NOT NULL DEFAULT 'general',

  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT true,
  allowed_roles user_role[] DEFAULT ARRAY['admin', 'manager', 'resident']::user_role[],

  -- For building-specific channels
  building TEXT,

  -- Posting permissions
  anyone_can_post BOOLEAN NOT NULL DEFAULT true,
  requires_moderation BOOLEAN NOT NULL DEFAULT false,

  -- Display
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT channels_unique_name UNIQUE (community_id, name)
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application-level overlap check | PostgreSQL exclusion constraints | PostgreSQL 9.2+ | Guaranteed atomicity |
| Manual queue locking | FOR UPDATE SKIP LOCKED | PostgreSQL 9.5+ | Scalable concurrent processing |
| ltree for all hierarchies | Adjacency list for dynamic trees | Best practice recognition | Simpler updates, good enough perf |
| Aggregate COUNT on every read | Denormalized counters with triggers | Always best practice | O(1) vs O(n) reads |
| Single notification table | Fan-out pattern | Scale requirements | Per-user tracking |

**Deprecated/outdated:**
- `WITHOUT OVERLAPS` syntax: PostgreSQL 18+ only, Supabase currently on 15
- Nested sets for comments: Overly complex for typical community discussions
- Pure closure tables: Storage overhead not justified for shallow hierarchies

## Open Questions

### 1. PowerSync Compatibility for Offline-First

**What we know:** PowerSync syncs via WAL to SQLite; works with RLS
**What's unclear:** How do exclusion constraints behave with offline writes that conflict when syncing?
**Recommendation:** Test conflict resolution scenarios. May need application-level conflict UI for reservations that fail exclusion constraint on sync.

### 2. Amenity Images in Supabase Storage

**What we know:** Storage supports RLS, transformations
**What's unclear:** Best folder structure for amenity vs listing vs post images
**Recommendation:** `{community_id}/amenities/{amenity_id}/`, `{community_id}/listings/{listing_id}/`, `{community_id}/posts/{post_id}/`

### 3. Real-Time Comment Updates

**What we know:** Supabase Realtime supports postgres changes
**What's unclear:** Performance with many concurrent users on popular posts
**Recommendation:** Use Realtime for new comments; poll for reaction counts to reduce subscription load.

### 4. Announcement Push Notification Integration

**What we know:** Fan-out table supports delivery tracking
**What's unclear:** Which push service (OneSignal, FCM, etc.) will be used
**Recommendation:** Design delivery_channel and device_token columns now; integrate push service in implementation phase.

## Sources

### Primary (HIGH confidence)
- [PostgreSQL Range Types Documentation](https://www.postgresql.org/docs/current/rangetypes.html) - Exclusion constraints, tstzrange, btree_gist
- [PostgreSQL ltree Documentation](https://www.postgresql.org/docs/current/ltree.html) - Path limits, GiST index configuration
- [PostgreSQL FOR UPDATE SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html) - Queue processing pattern

### Secondary (MEDIUM confidence)
- [DEV.to - Hierarchical Data Structures Comparison](https://dev.to/dowerdev/implementing-hierarchical-data-structures-in-postgresql-ltree-vs-adjacency-list-vs-closure-table-2jpb) - Adjacency list vs ltree vs closure table
- [AlgoMaster - Scalable Likes System](https://blog.algomaster.io/p/designing-a-scalable-likes-counting-system) - Denormalized counter pattern
- [PowerSync + Supabase Integration](https://docs.powersync.com/integration-guides/supabase-+-powersync) - Offline-first patterns
- [Condo Control Amenity Booking](https://support.condocontrol.com/hc/en-us/articles/36801083805595-Amenity-Booking-Overview) - Booking rules patterns
- [Booked Scheduler Quotas](https://www.bookedscheduler.com/help/administration/quotas/) - Quota system design

### Tertiary (LOW confidence)
- [SafeTrade Stations](https://www.safetradestations.com/) - Safe exchange zone concepts (no database schema)
- [SQLServerCentral - Content Moderation Architecture](https://www.sqlservercentral.com/articles/database-architecture-considerations-for-implementing-content-moderation-services) - Moderation queue patterns (SQL Server focus)

## Metadata

**Confidence breakdown:**
- Exclusion constraints: HIGH - PostgreSQL official documentation
- Booking rules: MEDIUM - Derived from industry patterns, property management software
- Comment patterns: HIGH - Well-documented PostgreSQL approaches
- Reaction counters: HIGH - Standard pattern with trigger implementation
- Announcement targeting: MEDIUM - Adapted from notification system patterns
- Vote enforcement: HIGH - Database constraints guarantee uniqueness
- Moderation queue: HIGH - FOR UPDATE SKIP LOCKED is standard PostgreSQL
- Safe exchange zones: MEDIUM - Conceptual design, no reference implementations found

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable PostgreSQL patterns)
