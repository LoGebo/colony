# Technology Stack for UPOE

**Project:** UPOE - Unified Property Operations Ecosystem
**Domain:** Multi-tenant property management SaaS for gated communities
**Researched:** 2026-01-29
**Overall Confidence:** HIGH (based on official Supabase docs, PowerSync docs, and 2026 production reviews)

---

## Executive Summary

For UPOE's requirements (multi-tenant RLS, offline-first with 30-day sync, Expo mobile + Next.js web), the optimal 2026 Supabase stack combines:

1. **Supabase** as the backend platform (Auth, Database, RLS, Storage, Edge Functions, Realtime)
2. **PowerSync** as the offline-first sync layer (bridges Supabase Postgres to local SQLite)
3. **@supabase/supabase-js v2.90+** for web and **@powersync/react-native** for mobile
4. **Row-Level Security with JWT claims** for multi-tenant isolation (community_id in app_metadata)

This architecture supports the scale requirements (50K access records, 10K vehicles, 5K residents per community) while enabling true offline-first operation with eventual consistency.

---

## Recommended Stack

### Core Platform: Supabase

| Component | Version/Tier | Purpose | Rationale |
|-----------|--------------|---------|-----------|
| Supabase Platform | Pro ($25/mo minimum) | Backend-as-a-Service | Free tier pauses after 7 days inactivity - unsuitable for production. Pro provides 500 Realtime connections, 8GB database, daily backups |
| PostgreSQL | 15 or 17 | Primary database | Battle-tested in 1M+ Supabase projects. Use v17 for latest features |
| Supabase Auth | Included | Authentication | Native JWT with custom claims for tenant_id. Supports email, phone, social auth |
| Supabase RLS | Included | Multi-tenant isolation | Database-level security using community_id in JWT claims |
| Supabase Realtime | Included | Live updates | Broadcast for ephemeral events, Postgres Changes for data sync |
| Supabase Storage | Included | File storage | Documents, photos, vehicle images. S3-compatible with RLS |
| Supabase Edge Functions | Included | Serverless compute | Webhooks, Stripe integration, notification dispatch |

**Sources:**
- [Supabase Review 2026](https://hackceleration.com/supabase-review/) - 8-month production testing across 6 projects
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices)

### Database Extensions

| Extension | Purpose | Why Enable |
|-----------|---------|------------|
| `uuid-ossp` | UUID generation | Primary keys for all entities (access_logs, vehicles, residents) |
| `pg_cron` | Job scheduling | HOA fee due date reminders, maintenance schedule triggers, report generation |
| `pg_trgm` | Trigram text search | Fast fuzzy search for residents, vehicles by partial plate |
| `pgcrypto` | Encryption | Encrypt sensitive resident data at rest |
| `postgis` | Geospatial | Community boundary mapping, emergency location tracking |
| `pg_net` | Async HTTP | Call external APIs from database triggers (push notifications) |

**Do NOT enable:**
| Extension | Reason to Skip |
|-----------|----------------|
| `pgvector` | No AI/embedding use case in property management. Adds overhead |
| `pgroonga` | Overkill for community-scoped searches. pg_trgm sufficient |

**Source:** [Supabase Extensions Docs](https://supabase.com/docs/guides/database/extensions)

### Offline-First: PowerSync

| Package | Version | Purpose |
|---------|---------|---------|
| `@powersync/react-native` | 1.28.1+ | React Native/Expo SDK for local SQLite sync |
| `@powersync/op-sqlite` | Latest | SQLite adapter with encryption (recommended over quick-sqlite) |
| PowerSync Cloud | Free/Pro | Sync service between Supabase Postgres and client SQLite |

**Why PowerSync over alternatives:**

| Option | Verdict | Reason |
|--------|---------|--------|
| **PowerSync** | RECOMMENDED | Purpose-built for Supabase. Non-invasive (no schema changes). Handles 30-day offline. Background sync with Expo. Rust-based sync client as of Jan 2026 |
| WatermelonDB | Not recommended | More complex setup, less Supabase integration, requires schema changes |
| RxDB + Supabase plugin | Not recommended | Requires soft-delete pattern, more boilerplate, less battle-tested with Supabase |
| Brick (Flutter only) | N/A | Flutter-only, not applicable for Expo |

**PowerSync handles UPOE's scale:**
- 50K access records: SQLite handles millions of rows locally
- 30 days offline: PowerSync queues writes indefinitely, syncs on reconnect
- Background sync: Expo background tasks integration available

**Sources:**
- [PowerSync + Supabase Integration](https://www.powersync.com/blog/bringing-offline-first-to-supabase)
- [PowerSync React Native SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)
- [PowerSync Release Notes Jan 2026](https://releases.powersync.com/announcements/react-native-client-sdk)

### Frontend: Mobile (Expo)

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | SDK 52+ | React Native framework with managed workflow |
| `@powersync/react-native` | 1.28.1+ | Offline-first sync with local SQLite |
| `@powersync/op-sqlite` | Latest | SQLite adapter (required peer dependency) |
| `@supabase/supabase-js` | 2.90.1+ | Supabase client for Auth and direct API calls |
| `expo-secure-store` | Latest | Encrypted storage for auth tokens |
| `react-native-url-polyfill` | Latest | Required polyfill for Supabase client |
| `@react-native-async-storage/async-storage` | Latest | Session persistence |

**Installation:**
```bash
# Core Supabase
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-secure-store

# PowerSync offline-first
npx expo install @powersync/react-native @powersync/op-sqlite @op-engineering/op-sqlite

# If using Expo Go for development (limited - prefer dev builds)
npx expo install @powersync/adapter-sql-js
```

**Critical Note:** PowerSync requires native modules. You MUST use Expo CNG (Continuous Native Generation) or development builds. Expo Go sandbox does not support the native SQLite adapters.

**Sources:**
- [Supabase Expo Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Expo Supabase Guide](https://docs.expo.dev/guides/using-supabase/)
- [PowerSync Expo Background Sync](https://www.powersync.com/blog/keep-background-apps-fresh-with-expo-background-tasks-and-powersync)

### Frontend: Web (Next.js)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15+ | React framework with App Router |
| `@supabase/supabase-js` | 2.90.1+ | Supabase client |
| `@supabase/ssr` | Latest | Server-side auth (replaces deprecated auth-helpers) |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Key Setup Requirements:**

1. **Create client utilities** in `utils/supabase/`:
   - `client.ts` - Browser client using `createBrowserClient`
   - `server.ts` - Server client using `createServerClient`
   - `middleware.ts` - Auth token refresh proxy

2. **Always use `getUser()` not `getSession()`** in server code - `getSession()` doesn't revalidate tokens

3. **Environment variables** must be prefixed with `NEXT_PUBLIC_` for client access

**Sources:**
- [Supabase Next.js SSR Setup](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [@supabase/ssr Package](https://www.npmjs.com/package/@supabase/ssr)

---

## Supabase Features: What to Use

### Authentication (USE)

**Configuration for multi-tenant:**

```typescript
// When user signs up or is added to a community
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
  userId,
  {
    app_metadata: {
      community_id: 'uuid-of-community',
      role: 'resident' // or 'guard', 'admin', 'super_admin'
    }
  }
)
```

**Why app_metadata not user_metadata:**
- `app_metadata` is secure, cannot be modified by user
- `user_metadata` is editable by user - NEVER use for tenant isolation

**RLS policy using JWT claims:**
```sql
CREATE POLICY "Users can only see their community data"
ON residents
FOR ALL
USING (
  community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::uuid
);
```

**Sources:**
- [Multi-Tenant RLS Deep Dive](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Row-Level Security (USE - Critical)

**Best practices for UPOE:**

1. **Index all columns used in RLS policies:**
```sql
CREATE INDEX idx_residents_community_id ON residents(community_id);
CREATE INDEX idx_access_logs_community_id ON access_logs(community_id);
CREATE INDEX idx_vehicles_community_id ON vehicles(community_id);
```

2. **Use JWT claims instead of subqueries:**
```sql
-- GOOD: Fast, uses JWT claim directly
CREATE POLICY "community_isolation" ON access_logs
USING (community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::uuid);

-- BAD: Slow, requires subquery to profiles table
CREATE POLICY "community_isolation" ON access_logs
USING (community_id = (SELECT community_id FROM profiles WHERE id = auth.uid()));
```

3. **Enable RLS on ALL tables**, even internal ones:
```sql
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
-- etc for all tables
```

**Source:** [AntStack Multi-Tenant RLS Guide](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)

### Realtime (USE Selectively)

**Three modes for different UPOE features:**

| Mode | Use For | Example |
|------|---------|---------|
| **Broadcast** | Ephemeral events, no persistence needed | Panic button alerts, guard notifications |
| **Presence** | Track who's online | Guard duty status, admin dashboard presence |
| **Postgres Changes** | Data sync, needs persistence | New access log entries, visitor arrivals |

**Performance optimization for scale:**

```typescript
// GOOD: Subscribe only to INSERTs on specific table
supabase
  .channel('access-logs')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'access_logs' },
    handleNewAccessLog
  )
  .subscribe()

// BAD: Subscribe to all changes
supabase
  .channel('all-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, handler)
  .subscribe()
```

**At scale (10K+ concurrent):** Use Broadcast from Database pattern instead of direct Postgres Changes. Stream to a public table without RLS, then re-broadcast to clients.

**Sources:**
- [Supabase Realtime Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)
- [Realtime Broadcast Feature](https://supabase.com/docs/guides/realtime/broadcast)

### Storage (USE)

**Bucket structure for UPOE:**

```
upoe-storage/
├── communities/
│   └── {community_id}/
│       ├── documents/      # HOA docs, meeting minutes
│       ├── announcements/  # Images for announcements
│       └── amenities/      # Amenity photos
├── residents/
│   └── {resident_id}/
│       ├── profile/        # Profile photos
│       └── documents/      # Personal docs
├── vehicles/
│   └── {vehicle_id}/
│       └── photos/         # Vehicle registration photos
└── access-logs/
    └── {date}/
        └── {log_id}/       # LPR captures, visitor photos
```

**RLS for storage:**
```sql
-- Residents can only access their community's files
CREATE POLICY "community_files_access" ON storage.objects
FOR SELECT USING (
  bucket_id = 'upoe-storage' AND
  (storage.foldername(name))[2] = (auth.jwt() -> 'app_metadata' ->> 'community_id')
);
```

**For large files (vehicle photos, LPR captures):** Use resumable uploads via TUS protocol or S3 multipart for files >6MB.

**Source:** [Supabase Storage Docs](https://supabase.com/docs/guides/storage)

### Edge Functions (USE for Specific Cases)

**Good use cases for UPOE:**
- Stripe webhook handler (payment processing)
- Push notification dispatch
- Email notification aggregation
- External API integrations (LPR systems, access control hardware)

**Pattern: Use pg_cron for scheduling, not HTTP triggers:**

```sql
-- Schedule HOA fee reminder check every day at 9 AM
SELECT cron.schedule(
  'hoa-fee-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/send-fee-reminders',
    '{}',
    '{"Authorization": "Bearer your-service-key"}'
  )
  $$
);
```

**Why polling over webhooks:** If 1,000 residents get fee reminders at once, webhooks fire 1,000 Edge Functions instantly. Polling with pg_cron processes a queue gradually.

**Source:** [Processing Large Jobs with Edge Functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions)

---

## What NOT to Use (and Why)

### DO NOT: Use Supabase UI for Schema Management

**Problem:** Creating tables via Supabase Studio dashboard leads to:
- No version control
- Impossible to replicate across environments (dev/staging/prod)
- Migration nightmares

**Instead:** Use migrations via Supabase CLI or an ORM like Drizzle:

```bash
# Generate migration
supabase db diff -f add_access_logs_table

# Apply migration
supabase db push
```

**Source:** [3 Biggest Mistakes Using Supabase](https://medium.com/@lior_amsalem/3-biggest-mistakes-using-supabase-854fe45712e3)

### DO NOT: Put Complex Business Logic in RLS Policies

**Problem:**
- Hard to debug (no console.log in SQL)
- Performance issues with complex joins
- Logic scattered between app and database

**Instead:** Use RLS only for tenant isolation (community_id checks). Put business logic in your app code or Edge Functions.

```sql
-- GOOD: Simple tenant isolation
CREATE POLICY "tenant_isolation" ON payments
USING (community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::uuid);

-- BAD: Complex business logic in RLS
CREATE POLICY "payment_access" ON payments
USING (
  community_id = ... AND
  (
    (status = 'pending' AND created_by = auth.uid()) OR
    (status = 'approved' AND role = 'admin') OR
    (amount < 1000 AND department = 'maintenance')
  )
);
```

**Source:** [AntStack: What I Don't Like About Supabase](https://www.antstack.com/blog/what-i-don-t-like-about-supabase/)

### DO NOT: Use service_role Key in Client Code

**Problem:** Service role bypasses ALL RLS. If exposed, attacker has full database access.

**Instead:**
- Use `anon` key in client code
- Use `service_role` only in Edge Functions and server-side code
- Store keys in environment variables, never in code

### DO NOT: Rely on Free Tier for Production

**Problem:**
- Projects pause after 7 days inactivity
- 3 emails/hour limit breaks auth flows
- 500MB database fills quickly with access logs

**Instead:** Start with Pro tier ($25/mo) from day one for any production workload.

### DO NOT: Enable Realtime on All Tables

**Problem:** Every table change broadcasts to all subscribers, causing:
- Bandwidth waste
- Client-side processing overhead
- Database load from CDC checks

**Instead:** Enable Realtime only on tables that need live updates:

```sql
-- In Supabase dashboard or via SQL:
-- Enable only for tables needing real-time
ALTER PUBLICATION supabase_realtime ADD TABLE access_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_alerts;
-- Do NOT add: residents, vehicles, payments (these can poll or use PowerSync)
```

### DO NOT: Use Supabase for Heavy Compute

**Problem:** Edge Functions have:
- 150ms CPU time limit (free) / 400ms (Pro)
- 1MB response size limit
- No persistent state

**Instead:** For heavy compute (report generation, batch processing, ML):
- Use external compute (AWS Lambda, Cloud Run)
- Trigger via pg_cron + pg_net
- Or use Supabase as database only

---

## Multi-Tenant Architecture Summary

### Schema Design Pattern

```sql
-- Every table includes community_id
CREATE TABLE residents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id),
  -- ... other fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for RLS performance
CREATE INDEX idx_residents_community ON residents(community_id);

-- RLS policy using JWT claims
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_isolation" ON residents
FOR ALL USING (
  community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::uuid
);
```

### User Onboarding Flow

1. User signs up (email/phone)
2. Admin invites user to community
3. Backend updates user's `app_metadata.community_id`
4. JWT now contains community_id claim
5. All queries automatically filtered by RLS

### Offline-First Data Flow

```
[Mobile App]
    |
    v
[Local SQLite (PowerSync SDK)]
    |
    | (background sync)
    v
[PowerSync Cloud Service]
    |
    | (streaming sync)
    v
[Supabase Postgres]
    |
    v
[RLS filters by community_id]
```

---

## Version Summary

| Package | Version | Last Verified |
|---------|---------|---------------|
| `@supabase/supabase-js` | 2.90.1 | Jan 2026 |
| `@supabase/ssr` | Latest (use with above) | Jan 2026 |
| `@powersync/react-native` | 1.28.1 | Jan 2026 |
| `@powersync/op-sqlite` | Latest | Jan 2026 |
| Supabase CLI | Requires Node.js 20+ | Jan 2026 |
| PostgreSQL (Supabase) | 15 or 17 | Jan 2026 |

---

## Installation Commands

### Mobile (Expo)

```bash
# Initialize Expo project
npx create-expo-app upoe-mobile --template expo-template-blank-typescript

# Supabase client
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-secure-store

# PowerSync offline-first (use dev builds, not Expo Go)
npx expo install @powersync/react-native @powersync/op-sqlite @op-engineering/op-sqlite

# Additional utilities
npx expo install expo-background-task  # For background sync
```

### Web (Next.js)

```bash
# Initialize Next.js project
npx create-next-app@latest upoe-web --typescript --tailwind --app

# Supabase
npm install @supabase/supabase-js @supabase/ssr
```

### Development Tools

```bash
# Supabase CLI (requires Node.js 20+)
npm install -g supabase

# Local development
supabase init
supabase start
supabase db diff -f initial_schema
```

---

## Sources

### Official Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Extensions](https://supabase.com/docs/guides/database/extensions)
- [Supabase Next.js SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Expo Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)

### PowerSync
- [PowerSync + Supabase Integration](https://www.powersync.com/blog/bringing-offline-first-to-supabase)
- [PowerSync React Native SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)
- [PowerSync Background Sync with Expo](https://www.powersync.com/blog/keep-background-apps-fresh-with-expo-background-tasks-and-powersync)

### Best Practices & Reviews
- [Supabase Review 2026](https://hackceleration.com/supabase-review/) - 8-month production testing
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices)
- [Multi-Tenant RLS Architecture](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)
- [Common Supabase Pitfalls](https://hrekov.com/blog/supabase-common-mistakes)

### GitHub Discussions
- [Supabase Offline Discussion](https://github.com/orgs/supabase/discussions/357)
- [supabase-js Releases](https://github.com/supabase/supabase-js/releases)
