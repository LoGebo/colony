# Architecture Patterns: Multi-Tenant Supabase for UPOE

**Domain:** Property Management SaaS with Offline-First Mobile
**Researched:** 2026-01-29
**Overall Confidence:** HIGH (verified with official Supabase docs and PowerSync documentation)

---

## Executive Summary

UPOE requires a multi-tenant architecture that supports:
1. Complete data isolation between gated communities
2. Offline-first mobile for guards without internet
3. Real-time sync when online
4. Domain-specific conflict resolution per entity type

The recommended architecture uses **Row-Level Security (RLS) with community_id isolation**, **PowerSync for offline-first sync**, and **custom conflict resolution strategies** tailored to each entity type.

---

## 1. Multi-Tenant RLS Patterns

### Recommended: Shared Schema with tenant_id Column

For UPOE's scale (hundreds of communities, not thousands of enterprise clients), the shared schema approach is optimal:

```sql
-- Every table includes community_id
CREATE TABLE access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id),
    visitor_name TEXT NOT NULL,
    entry_time TIMESTAMPTZ DEFAULT now(),
    -- ... other fields
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
```

**Why this pattern:**
- Simpler queries (no schema switching)
- Easier backup/restore operations
- Lower operational complexity
- Sufficient isolation for B2B2C SaaS

### RLS Policy Pattern: JWT Claims

Store `community_id` in JWT `app_metadata` (NOT `user_metadata` which users can modify):

```sql
-- Create RLS policy using JWT claim
CREATE POLICY "community_isolation" ON access_logs
FOR ALL TO authenticated
USING (
    community_id = (
        (SELECT auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
    )
)
WITH CHECK (
    community_id = (
        (SELECT auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
    )
);
```

### Performance-Optimized RLS Pattern

Based on Supabase's documented benchmarks (99%+ improvement):

```sql
-- CRITICAL: Wrap auth functions in SELECT to prevent per-row evaluation
CREATE POLICY "optimized_community_isolation" ON access_logs
FOR ALL TO authenticated
USING (
    community_id = (
        SELECT (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
    )
)
WITH CHECK (
    community_id = (
        SELECT (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
    )
);

-- Index the tenant column
CREATE INDEX idx_access_logs_community_id ON access_logs USING BTREE (community_id);
```

### Multi-Community Access (Admins)

For users who manage multiple communities:

```sql
-- Store array of community_ids in app_metadata
-- JWT: { "app_metadata": { "community_ids": ["uuid1", "uuid2"] } }

CREATE POLICY "multi_community_admin" ON access_logs
FOR ALL TO authenticated
USING (
    community_id = ANY(
        SELECT jsonb_array_elements_text(
            (SELECT auth.jwt() -> 'app_metadata' -> 'community_ids')
        )::UUID
    )
);
```

### Alternative: Lookup Table Pattern

For complex permission scenarios:

```sql
-- User-community membership table
CREATE TABLE user_communities (
    user_id UUID REFERENCES auth.users(id),
    community_id UUID REFERENCES communities(id),
    role TEXT CHECK (role IN ('admin', 'guard', 'resident')),
    PRIMARY KEY (user_id, community_id)
);

-- Policy using membership lookup
CREATE POLICY "membership_based_access" ON access_logs
FOR SELECT TO authenticated
USING (
    community_id IN (
        SELECT community_id FROM user_communities
        WHERE user_id = (SELECT auth.uid())
    )
);
```

**Tradeoff:** More flexible but slower. Use SECURITY DEFINER functions to optimize:

```sql
CREATE OR REPLACE FUNCTION private.user_community_ids()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN ARRAY(
        SELECT community_id FROM user_communities
        WHERE user_id = auth.uid()
    );
END;
$$;

CREATE POLICY "fast_membership_access" ON access_logs
FOR SELECT TO authenticated
USING (
    community_id = ANY((SELECT private.user_community_ids()))
);
```

---

## 2. Offline-First Sync Architecture

### Recommended: PowerSync + Supabase

PowerSync is the only sync engine with first-class offline support that integrates natively with Supabase.

```
+------------------+     +------------------+     +------------------+
|  Mobile App      |     |  PowerSync       |     |  Supabase        |
|  (SQLite local)  |<--->|  Service         |<--->|  (Postgres)      |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        |   Offline: Local ops   |                        |
        |   Online: Sync queue   |   Bucket sync          |
        |                        |   (partial data)       |
        +------------------------+------------------------+
```

### PowerSync Bucket Architecture

Buckets define which data syncs to which users:

```yaml
# sync-rules.yaml
bucket_definitions:
  # Each guard syncs their community's data
  community_data:
    # Data selection
    data:
      - SELECT * FROM access_logs WHERE community_id = bucket.community_id
      - SELECT * FROM residents WHERE community_id = bucket.community_id
      - SELECT * FROM emergencies WHERE community_id = bucket.community_id

    # User assignment (which users get this bucket)
    parameters:
      - SELECT community_id FROM user_communities WHERE user_id = token_parameters.user_id
```

### Required Schema Changes for Sync

PowerSync requires specific columns for sync tracking:

```sql
-- All synced tables need:
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS
    sync_id TEXT PRIMARY KEY;  -- Or use existing UUID as text

ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS
    updated_at TIMESTAMPTZ DEFAULT now();

-- Soft delete pattern (REQUIRED for offline sync)
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS
    deleted_at TIMESTAMPTZ;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER access_logs_updated_at
    BEFORE UPDATE ON access_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Soft Delete Pattern

**Critical for offline sync:** Never hard-delete rows. Clients that were offline would miss the deletion.

```sql
-- View for "active" records
CREATE VIEW active_access_logs AS
SELECT * FROM access_logs WHERE deleted_at IS NULL;

-- RLS that excludes soft-deleted
CREATE POLICY "hide_deleted" ON access_logs
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL
    AND community_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID)
);

-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete_access_log(log_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE access_logs
    SET deleted_at = now()
    WHERE id = log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Alternative Sync Options

| Solution | Offline Support | Conflict Resolution | Best For |
|----------|----------------|---------------------|----------|
| **PowerSync** | First-class | Custom/LWW/CRDT | Production apps needing robust offline |
| **WatermelonDB** | Good | Basic | React Native apps |
| **RxDB** | Good | Plugin-based | Web apps |
| **Brick (Flutter)** | Good | Basic | Flutter-only apps |

---

## 3. Conflict Resolution Strategies

### UPOE-Specific Requirements

Based on the requirements, different entities need different resolution strategies:

| Entity | Strategy | Rationale |
|--------|----------|-----------|
| Access Logs | Merge (chronological) | Comments/photos should sum up |
| Access State | Restrictive Priority | Block wins over allow |
| Profiles | LWW with History | Latest update wins, keep audit |
| Reservations | First-Come-First-Served | Prevent double-booking |
| Emergencies | Merge with Dedup | All reports matter, avoid duplicates |

### Strategy 1: Chronological Merge (Access Logs)

```sql
-- Access log with appendable comments
CREATE TABLE access_logs (
    id UUID PRIMARY KEY,
    community_id UUID NOT NULL,
    visitor_name TEXT NOT NULL,
    entry_time TIMESTAMPTZ,
    -- Appendable fields stored as JSONB arrays
    comments JSONB DEFAULT '[]'::JSONB,
    photos JSONB DEFAULT '[]'::JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Merge function: concatenate arrays, dedupe by id
CREATE OR REPLACE FUNCTION merge_access_log(
    server_row access_logs,
    client_row JSONB
) RETURNS access_logs AS $$
DECLARE
    merged access_logs;
BEGIN
    merged := server_row;

    -- Merge comments (union by id, sort by timestamp)
    merged.comments := (
        SELECT jsonb_agg(DISTINCT elem ORDER BY elem->>'timestamp')
        FROM (
            SELECT jsonb_array_elements(server_row.comments) AS elem
            UNION
            SELECT jsonb_array_elements(client_row->'comments') AS elem
        ) combined
    );

    -- Merge photos (union by id)
    merged.photos := (
        SELECT jsonb_agg(DISTINCT elem)
        FROM (
            SELECT jsonb_array_elements(server_row.photos) AS elem
            UNION
            SELECT jsonb_array_elements(client_row->'photos') AS elem
        ) combined
    );

    merged.updated_at := now();
    RETURN merged;
END;
$$ LANGUAGE plpgsql;
```

### Strategy 2: Restrictive Priority (Access State)

```sql
-- Access states with priority
CREATE TYPE access_decision AS ENUM ('allowed', 'pending', 'blocked');

CREATE TABLE access_states (
    id UUID PRIMARY KEY,
    community_id UUID NOT NULL,
    visitor_id UUID NOT NULL,
    decision access_decision NOT NULL,
    reason TEXT,
    decided_by UUID REFERENCES auth.users(id),
    decided_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Resolution: most restrictive wins
-- blocked > pending > allowed
CREATE OR REPLACE FUNCTION resolve_access_conflict(
    server_decision access_decision,
    client_decision access_decision
) RETURNS access_decision AS $$
BEGIN
    -- Priority: blocked (most restrictive) wins
    IF server_decision = 'blocked' OR client_decision = 'blocked' THEN
        RETURN 'blocked';
    ELSIF server_decision = 'pending' OR client_decision = 'pending' THEN
        RETURN 'pending';
    ELSE
        RETURN 'allowed';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Strategy 3: Last-Write-Wins with History (Profiles)

```sql
-- Profile with history tracking
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    community_id UUID NOT NULL,
    full_name TEXT,
    phone TEXT,
    unit_number TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- History table
CREATE TABLE profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id),
    changed_fields JSONB NOT NULL,
    old_values JSONB NOT NULL,
    new_values JSONB NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    changed_by UUID REFERENCES auth.users(id),
    change_source TEXT -- 'app', 'sync', 'admin'
);

-- Trigger to capture history
CREATE OR REPLACE FUNCTION capture_profile_history()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields JSONB := '[]'::JSONB;
    old_vals JSONB := '{}'::JSONB;
    new_vals JSONB := '{}'::JSONB;
BEGIN
    -- Compare each field
    IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
        changed_fields := changed_fields || '"full_name"'::JSONB;
        old_vals := old_vals || jsonb_build_object('full_name', OLD.full_name);
        new_vals := new_vals || jsonb_build_object('full_name', NEW.full_name);
    END IF;
    -- ... repeat for other fields

    IF changed_fields != '[]'::JSONB THEN
        INSERT INTO profile_history (profile_id, changed_fields, old_values, new_values, changed_by)
        VALUES (NEW.id, changed_fields, old_vals, new_vals, NEW.updated_by);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_history_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION capture_profile_history();
```

### Strategy 4: First-Come-First-Served (Reservations)

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL,
    amenity_id UUID NOT NULL,
    resident_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Server-assigned sequence for ordering
    sequence_number BIGSERIAL,
    UNIQUE (amenity_id, start_time, end_time)
);

-- Constraint to prevent overlapping reservations
CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM reservations
        WHERE amenity_id = NEW.amenity_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND tstzrange(start_time, end_time) && tstzrange(NEW.start_time, NEW.end_time)
    ) THEN
        RAISE EXCEPTION 'Reservation overlaps with existing booking';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_overlap_check
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION check_reservation_overlap();
```

**Offline handling:** Client creates local reservation, sync attempts insert. If overlap exists, server rejects - client shows "slot taken" and refreshes available times.

### Strategy 5: Merge with Deduplication (Emergencies)

```sql
CREATE TABLE emergencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL,
    -- Deduplication key
    fingerprint TEXT GENERATED ALWAYS AS (
        md5(
            community_id::TEXT ||
            date_trunc('minute', reported_at)::TEXT ||
            emergency_type ||
            COALESCE(location, '')
        )
    ) STORED,
    emergency_type TEXT NOT NULL,
    location TEXT,
    description TEXT,
    reported_by UUID REFERENCES auth.users(id),
    reported_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'active',
    -- Merged reports
    additional_reports JSONB DEFAULT '[]'::JSONB,
    report_count INTEGER DEFAULT 1
);

-- Unique on fingerprint to auto-dedupe
CREATE UNIQUE INDEX emergencies_fingerprint_idx ON emergencies(fingerprint);

-- Upsert function that merges reports
CREATE OR REPLACE FUNCTION report_emergency(
    p_community_id UUID,
    p_type TEXT,
    p_location TEXT,
    p_description TEXT,
    p_reported_by UUID
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO emergencies (community_id, emergency_type, location, description, reported_by)
    VALUES (p_community_id, p_type, p_location, p_description, p_reported_by)
    ON CONFLICT (fingerprint) DO UPDATE SET
        additional_reports = emergencies.additional_reports ||
            jsonb_build_object(
                'reported_by', p_reported_by,
                'description', p_description,
                'reported_at', now()
            ),
        report_count = emergencies.report_count + 1
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Realtime Subscription Patterns

### Multi-Tenant Channel Setup

```typescript
// Subscribe to community-specific changes
const communityId = user.app_metadata.community_id;

const channel = supabase
  .channel(`community-${communityId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'access_logs',
      filter: `community_id=eq.${communityId}`
    },
    (payload) => {
      handleAccessLogChange(payload);
    }
  )
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'emergencies',
      filter: `community_id=eq.${communityId}`
    },
    (payload) => {
      handleEmergencyChange(payload);
    }
  )
  .subscribe();
```

### RLS + Realtime Limitations

**Critical consideration:** RLS policies are NOT applied to DELETE events in Realtime. The workaround:

```typescript
// Use soft deletes, listen for UPDATE where deleted_at is set
.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'access_logs',
    filter: `community_id=eq.${communityId}`
  },
  (payload) => {
    if (payload.new.deleted_at) {
      // Handle as deletion
      removeFromLocalState(payload.new.id);
    } else {
      // Handle as update
      updateLocalState(payload.new);
    }
  }
)
```

### Scaling Realtime (High-Volume Communities)

For communities with many guards (>100 concurrent users), use Broadcast instead of direct Postgres Changes:

```typescript
// Server-side: Edge Function rebroadcasts changes
// supabase/functions/broadcast-changes/index.ts
Deno.serve(async (req) => {
  const { record, table, type } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Broadcast to community channel
  await supabase
    .channel(`community-${record.community_id}`)
    .send({
      type: 'broadcast',
      event: `${table}:${type}`,
      payload: record
    });

  return new Response('OK');
});

// Client-side: Listen to broadcasts instead
const channel = supabase
  .channel(`community-${communityId}`)
  .on('broadcast', { event: 'access_logs:INSERT' }, (payload) => {
    handleNewAccessLog(payload);
  })
  .subscribe();
```

---

## 5. Edge Function Patterns

### Authentication Pattern

```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

export async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header');
  }

  const token = authHeader.split(' ')[1];

  // Verify JWT
  const JWKS = jose.createRemoteJWKSet(
    new URL(`${Deno.env.get('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`)
  );

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${Deno.env.get('SUPABASE_URL')}/auth/v1`,
  });

  return payload;
}

export function getCommunityId(payload: any): string {
  const communityId = payload.app_metadata?.community_id;
  if (!communityId) {
    throw new Error('User not assigned to community');
  }
  return communityId;
}
```

### Business Logic Pattern: Reservation Booking

```typescript
// supabase/functions/book-reservation/index.ts
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, getCommunityId } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  try {
    const payload = await authenticateRequest(req);
    const communityId = getCommunityId(payload);
    const userId = payload.sub;

    const { amenityId, startTime, endTime } = await req.json();

    // Use service role for transaction
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Transaction: check + insert atomically
    const { data, error } = await supabase.rpc('book_reservation', {
      p_community_id: communityId,
      p_amenity_id: amenityId,
      p_resident_id: userId,
      p_start_time: startTime,
      p_end_time: endTime
    });

    if (error) {
      if (error.message.includes('overlap')) {
        return new Response(
          JSON.stringify({ error: 'Time slot already booked' }),
          { status: 409 }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ reservation: data }),
      { status: 201 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.message.includes('authorization') ? 401 : 500 }
    );
  }
});
```

### Sync Conflict Handler Pattern

```typescript
// supabase/functions/handle-sync-conflict/index.ts
import { createClient } from '@supabase/supabase-js';

interface ConflictPayload {
  table: string;
  clientRecord: Record<string, any>;
  serverRecord: Record<string, any>;
  conflictType: 'update' | 'delete';
}

Deno.serve(async (req) => {
  const { table, clientRecord, serverRecord, conflictType }: ConflictPayload =
    await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let resolved: Record<string, any>;

  switch (table) {
    case 'access_logs':
      // Merge strategy: combine arrays
      resolved = await mergeAccessLog(supabase, clientRecord, serverRecord);
      break;

    case 'access_states':
      // Restrictive wins
      resolved = resolveAccessState(clientRecord, serverRecord);
      break;

    case 'profiles':
      // LWW with history
      resolved = await lwwWithHistory(supabase, clientRecord, serverRecord);
      break;

    case 'emergencies':
      // Merge with dedup
      resolved = await mergeEmergency(supabase, clientRecord, serverRecord);
      break;

    default:
      // Default: LWW
      resolved = clientRecord.updated_at > serverRecord.updated_at
        ? clientRecord
        : serverRecord;
  }

  return new Response(JSON.stringify({ resolved }), { status: 200 });
});
```

---

## 6. Component Architecture

```
+------------------------------------------------------------------+
|                         MOBILE APP                                |
|  +---------------------------+  +-----------------------------+   |
|  |     UI Components         |  |    State Management         |   |
|  |  - Access Log Entry       |  |  - React Query / TanStack   |   |
|  |  - Visitor Management     |  |  - Zustand for local state  |   |
|  |  - Emergency Alert        |  |                             |   |
|  +---------------------------+  +-----------------------------+   |
|                 |                            |                    |
|  +---------------------------+  +-----------------------------+   |
|  |     Sync Layer            |  |    Local Database           |   |
|  |  - PowerSync Client       |  |  - SQLite (via PowerSync)   |   |
|  |  - Conflict Resolution    |  |  - Offline queue            |   |
|  |  - Network detection      |  |                             |   |
|  +---------------------------+  +-----------------------------+   |
+------------------------------------------------------------------+
                              |
                              | HTTPS / WebSocket
                              v
+------------------------------------------------------------------+
|                       SUPABASE BACKEND                            |
|  +---------------------------+  +-----------------------------+   |
|  |     Edge Functions        |  |    Realtime                 |   |
|  |  - Business logic         |  |  - Postgres Changes         |   |
|  |  - Sync conflict handling |  |  - Broadcast channels       |   |
|  |  - Webhook handlers       |  |  - Presence                 |   |
|  +---------------------------+  +-----------------------------+   |
|                 |                            |                    |
|  +---------------------------+  +-----------------------------+   |
|  |     PostgREST API         |  |    Auth                     |   |
|  |  - CRUD operations        |  |  - JWT with app_metadata    |   |
|  |  - RLS enforcement        |  |  - community_id claim       |   |
|  +---------------------------+  +-----------------------------+   |
|                 |                            |                    |
|  +---------------------------------------------------------------+|
|  |                    PostgreSQL Database                        ||
|  |  - RLS policies per table                                     ||
|  |  - Triggers for history/audit                                 ||
|  |  - Functions for conflict resolution                          ||
|  +---------------------------------------------------------------+|
+------------------------------------------------------------------+
                              |
                              | Logical Replication
                              v
+------------------------------------------------------------------+
|                       POWERSYNC SERVICE                           |
|  +---------------------------+  +-----------------------------+   |
|  |     Bucket Definitions    |  |    Sync Rules               |   |
|  |  - Per-community data     |  |  - Partial sync logic       |   |
|  |  - User assignment        |  |  - Checkpoint management    |   |
|  +---------------------------+  +-----------------------------+   |
+------------------------------------------------------------------+
```

---

## 7. Anti-Patterns to Avoid

### Anti-Pattern 1: Skipping RLS During Development

**What:** Disabling RLS to "move fast" during prototyping.

**Why bad:** Easy to forget before launch. One API call can leak all tenant data.

**Instead:** Enable RLS from day one. Use service role key only in Edge Functions.

### Anti-Pattern 2: Hard Deletes with Offline Sync

**What:** Using DELETE instead of soft delete.

**Why bad:** Offline clients never receive deletion notification. They'll re-sync the record as if it still exists.

**Instead:** Always use soft delete with `deleted_at` timestamp.

### Anti-Pattern 3: Complex RLS with Joins

**What:** RLS policies that join multiple tables.

**Why bad:** Evaluated per-row. 1000 rows = 1000 join operations.

**Instead:** Use SECURITY DEFINER functions that cache results, or denormalize into JWT claims.

### Anti-Pattern 4: Unfiltered Realtime Subscriptions

**What:** Subscribing to entire tables without filters.

**Why bad:** Every change triggers authorization check for every subscriber. 100 subscribers = 100x database load.

**Instead:** Always filter by `community_id` and use Broadcast for high-volume scenarios.

### Anti-Pattern 5: Client-Side Conflict Resolution Only

**What:** Resolving all conflicts in the mobile app.

**Why bad:** Different app versions may resolve differently. Business rules change but old apps have old logic.

**Instead:** Delegate to Edge Functions for critical business logic conflicts.

---

## 8. Security Considerations

### JWT Claims for Multi-Tenancy

```sql
-- Set community_id when user signs up (via trigger or Edge Function)
CREATE OR REPLACE FUNCTION set_user_community(
    user_id UUID,
    community_id UUID
) RETURNS void AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::JSONB) ||
        jsonb_build_object('community_id', community_id)
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Service Role Key Protection

```typescript
// NEVER do this in client code
const supabase = createClient(url, serviceRoleKey); // WRONG

// Only in Edge Functions
Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // OK - server side
    );
});
```

### Search Path Security

```sql
-- Set empty search path in functions to prevent injection
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Use fully qualified names
    SELECT * FROM public.my_table;
END;
$$;
```

---

## Sources

**Official Documentation:**
- [Supabase Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Edge Functions Auth](https://supabase.com/docs/guides/functions/auth)
- [Supabase Soft Deletes](https://supabase.com/docs/guides/troubleshooting/soft-deletes-with-supabase-js)

**PowerSync:**
- [PowerSync + Supabase Integration](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync)
- [PowerSync Custom Conflict Resolution](https://docs.powersync.com/usage/lifecycle-maintenance/handling-update-conflicts/custom-conflict-resolution)

**Community Resources:**
- [Multi-Tenant RLS Patterns (AntStack)](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Supabase Best Practices (Leanware)](https://www.leanware.co/insights/supabase-best-practices)
- [CRDT Dictionary (Ian Duncan)](https://www.iankduncan.com/engineering/2025-11-27-crdt-dictionary/)
- [EDB Postgres Distributed Conflicts](https://www.enterprisedb.com/docs/pgd/latest/bdr/conflicts/)
