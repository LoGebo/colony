# Domain Pitfalls: Supabase Multi-Tenant Property Management

**Project:** UPOE Property Management SaaS
**Domain:** Multi-tenant SaaS with offline-first mobile, real-time features, financial calculations
**Researched:** 2026-01-29
**Confidence:** HIGH (verified with official Supabase docs and community reports)

---

## Critical Pitfalls

Mistakes that cause security breaches, data loss, or complete rewrites.

### Pitfall 1: RLS Disabled or Misconfigured on Tables

**What goes wrong:** Tables are created without RLS enabled, or RLS is enabled without policies, exposing all tenant data to any authenticated user (or worse, anonymous users).

**Why it happens:**
- RLS is disabled by default when creating tables in Supabase
- Developers skip RLS during prototyping and forget to enable before launch
- Enabling RLS without creating policies blocks ALL access (deny by default)

**Consequences:**
- Complete data breach: all tenants can see each other's data
- In January 2025, 170+ apps built with Lovable were found with exposed databases (CVE-2025-48757)
- 83% of exposed Supabase databases involve RLS misconfigurations

**Warning signs:**
- No `ENABLE ROW LEVEL SECURITY` statements in migrations
- Missing `tenant_id` checks in policies
- Policies using `WITH CHECK (true)` without proper conditions
- Users reporting they can see other organizations' data

**Prevention:**
```sql
-- ALWAYS in every table migration:
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies IMMEDIATELY
CREATE POLICY "Tenant isolation" ON table_name
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT current_tenant_id()));
```

**Detection:**
```sql
-- Find tables without RLS
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_policies WHERE schemaname = 'public'
);
```

**Which phase should address:** Phase 1 (Foundation) - RLS must be configured from day one. Never skip.

**Sources:**
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS Complete Guide 2025](https://vibeappscanner.com/supabase-row-level-security)
- [Multi-Tenant RLS Architecture](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)

---

### Pitfall 2: Using user_metadata Instead of app_metadata for Tenant ID

**What goes wrong:** Storing tenant_id in `user_metadata` instead of `app_metadata`, allowing users to modify their own tenant association and access other tenants' data.

**Why it happens:**
- Both are in the JWT and look similar
- `user_metadata` is easier to set during signup
- Documentation doesn't emphasize the security difference enough

**Consequences:**
- Users can escalate privileges by modifying their `user_metadata`
- Complete multi-tenant isolation failure
- Potential legal liability for data exposure

**Warning signs:**
- RLS policies using `auth.jwt()->>'user_metadata'`
- Tenant ID set via client-side signup call
- No server-side validation of tenant assignment

**Prevention:**
```sql
-- CORRECT: Use app_metadata (server-controlled only)
CREATE POLICY "Tenant isolation" ON properties
  FOR ALL
  USING (
    tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
  );
```

```typescript
// Set tenant via server-side Admin API only
const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { tenant_id: tenantId }
});
```

**Which phase should address:** Phase 1 (Foundation) - Part of auth architecture design.

**Sources:**
- [Supabase Token Security](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Multi-Tenancy Best Practices](https://www.tomaszezula.com/keep-data-safe-in-multi-tenant-systems-a-case-for-supabase-and-row-level-security/)

---

### Pitfall 3: Service Role Key Exposed in Client Code

**What goes wrong:** The `service_role` key (which bypasses all RLS) is included in client-side code, giving attackers full database access.

**Why it happens:**
- Confusion between `anon` key and `service_role` key
- Copy-paste from server code to client code
- Environment variable misconfiguration

**Consequences:**
- Complete database compromise
- Attacker can read, modify, and delete ALL data
- No audit trail possible

**Warning signs:**
- `service_role` key in frontend environment variables
- Client-side Supabase client initialized with service role
- RLS policies never being enforced during testing

**Prevention:**
- Never use `service_role` key anywhere except server-side code
- Use separate environment variable files for client vs server
- Audit all environment variables in build output
- Add pre-commit hooks to detect service role key exposure

**Which phase should address:** Phase 1 (Foundation) - Environment setup and security review.

**Sources:**
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices)

---

### Pitfall 4: RLS Performance Degradation with Complex Policies

**What goes wrong:** RLS policies with subqueries, joins, or function calls execute on every row, causing queries to slow from milliseconds to seconds.

**Why it happens:**
- RLS policies evaluated per-row, not once per query
- Subqueries in policies run repeatedly
- Missing indexes on columns used in policies
- Database ignores indexes when RLS is enabled incorrectly

**Consequences:**
- Dashboard load times of 3-5 seconds instead of <500ms
- Sequential scans on large tables
- Timeouts on reports and analytics queries
- Users complain "app is slow"

**Warning signs:**
- `Seq Scan` in EXPLAIN output despite indexes existing
- Queries slow with RLS enabled, fast with RLS disabled
- Performance degrades as data grows
- High CPU usage on database

**Prevention:**

```sql
-- BAD: Subquery evaluated per row
CREATE POLICY "Team access" ON documents
  USING (
    auth.uid() IN (
      SELECT user_id FROM team_members
      WHERE team_id = documents.team_id
    )
  );

-- GOOD: Flip the subquery direction
CREATE POLICY "Team access" ON documents
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );

-- BETTER: Use security definer function
CREATE FUNCTION user_team_ids() RETURNS SETOF uuid
  LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$;

CREATE POLICY "Team access" ON documents
  USING (tenant_id IN (SELECT user_team_ids()));

-- CRITICAL: Index columns used in RLS
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
```

```sql
-- Wrap functions in SELECT for caching
-- BAD:
USING (is_admin() OR auth.uid() = user_id)

-- GOOD:
USING ((SELECT is_admin()) OR (SELECT auth.uid()) = user_id)
```

**Detection:**
```sql
-- Use EXPLAIN to check for sequential scans
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM properties WHERE tenant_id = 'xxx' LIMIT 10;
```

**Which phase should address:** Phase 1 (Foundation) - Design policies correctly from start. Phase 3+ - Performance testing and optimization.

**Sources:**
- [Supabase RLS Performance Troubleshooting](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Optimizing RLS Performance](https://www.antstack.com/blog/optimizing-rls-performance-with-supabase/)
- [RLS Performance Discussion](https://github.com/orgs/supabase/discussions/14576)

---

### Pitfall 5: Views Bypassing RLS by Default

**What goes wrong:** Views created in Supabase bypass RLS because they run with `security definer` (creator's privileges) by default.

**Why it happens:**
- PostgreSQL default behavior for views
- Views created by `postgres` role have full access
- Developers assume views inherit table RLS

**Consequences:**
- Data exposed through views despite table RLS
- Multi-tenant isolation completely broken via views
- Security audit failures

**Warning signs:**
- Views returning data that should be filtered
- Different results between direct table query and view query
- No `security_invoker` in view definitions

**Prevention:**
```sql
-- PostgreSQL 15+: Make views respect caller's RLS
CREATE VIEW property_summary
WITH (security_invoker = true)
AS SELECT ...;

-- Or avoid views for multi-tenant data entirely
-- Use functions with SECURITY INVOKER instead
```

**Which phase should address:** Phase 1 (Foundation) - Establish view creation standards.

**Sources:**
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

### Pitfall 6: Financial Calculations with Wrong Data Types

**What goes wrong:** Using `real`, `float`, `double precision`, or `money` type for financial amounts causes rounding errors that compound over time.

**Why it happens:**
- Floating point seems "good enough" for currency
- `money` type sounds appropriate but has issues
- Two decimal places seems sufficient

**Consequences:**
- Rounding errors in invoices and payments
- Accounts don't balance
- Legal/compliance issues with financial reporting
- Errors compound: buying 1M widgets at wrong price = significant loss

**Warning signs:**
- Penny discrepancies in financial reports
- Totals not matching sum of line items
- Currency conversion producing unexpected results

**Prevention:**
```sql
-- CORRECT: Use NUMERIC with sufficient precision
-- GAAP requires minimum 4 decimal places
CREATE TABLE payments (
  amount NUMERIC(15, 4) NOT NULL,  -- 4 decimal places for calculations
  currency VARCHAR(3) NOT NULL DEFAULT 'USD'
);

-- Alternative: Store as integer cents (bigint)
CREATE TABLE payments (
  amount_cents BIGINT NOT NULL,  -- $100.00 stored as 10000
  currency VARCHAR(3) NOT NULL DEFAULT 'USD'
);

-- NEVER use these for money:
-- real, float, double precision, money
```

**Which phase should address:** Phase 1 (Foundation) - Schema design decisions are hard to change later.

**Sources:**
- [Working with Money in Postgres](https://www.crunchydata.com/blog/working-with-money-in-postgres)
- [PostgreSQL and Financial Calculations](https://www.commandprompt.com/blog/postgresql-and-financial-calculations-part-one/)
- [PostgreSQL Monetary Types Docs](https://www.postgresql.org/docs/current/datatype-money.html)

---

## Moderate Pitfalls

Mistakes that cause significant delays, tech debt, or poor user experience.

### Pitfall 7: Realtime Subscriptions Breaking Silently

**What goes wrong:** Realtime subscriptions disconnect, produce duplicates, or stop receiving events without clear errors.

**Why it happens:**
- Subscriptions auto-disconnect when browser tab is hidden
- Status shows "CLOSED" but connection still open
- Channel names not unique, causing conflicts
- RLS policies block realtime events silently

**Consequences:**
- Guard alerts not received in real-time
- Duplicate notifications
- Users see stale data
- Unreliable experience requiring page refresh

**Warning signs:**
- "Channel Already Subscribed" errors
- Events work for ~8 seconds then stop
- Tab switching breaks subscriptions
- Works locally but not in production

**Prevention:**
```typescript
// Create self-healing subscription
const subscribeWithRecovery = (table: string, callback: Function) => {
  let channel: RealtimeChannel;

  const connect = () => {
    // Ensure unique channel name
    const channelName = `${table}-${Date.now()}`;

    // Clean up previous channel first
    if (channel) {
      supabase.removeChannel(channel);
    }

    channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table
      }, callback)
      .subscribe((status) => {
        if (status === 'CLOSED') {
          // Reconnect with exponential backoff
          setTimeout(connect, 1000);
        }
      });
  };

  connect();

  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      connect();
    }
  });
};
```

**RLS + Realtime Fix:**
```sql
-- Realtime requires SELECT policies
CREATE POLICY "Allow realtime reads" ON notifications
  FOR SELECT
  USING (tenant_id = current_tenant_id());
```

**Which phase should address:** Phase 2/3 (Real-time features) - Build robust subscription handling from start.

**Sources:**
- [Production-ready Realtime Listener](https://medium.com/@dipiash/supabase-realtime-postgres-changes-in-node-js-2666009230b0)
- [Supabase Realtime Troubleshooting](https://github.com/orgs/supabase/discussions/5312)
- [Supabase Realtime RLS Issues](https://www.technetexperts.com/realtime-rls-solved/)

---

### Pitfall 8: Offline Sync Conflict Resolution Failures

**What goes wrong:** Multiple users or devices modify the same data offline, and changes are lost or corrupted when syncing.

**Why it happens:**
- "Last write wins" is default but wrong for business data
- No conflict detection strategy defined
- Optimistic updates without proper reconciliation

**Consequences:**
- Payment records overwritten
- Resident data lost
- Guard reports conflicting
- Data integrity violations

**Warning signs:**
- Users report "my changes disappeared"
- Inconsistent data between devices
- Audit logs show gaps or reversions

**Prevention:**
```typescript
// Define conflict resolution strategy per table
const conflictStrategies = {
  // Financial: Server always wins (require online for payments)
  payments: 'server-wins',

  // Residents: Last-modified-wins with merge
  residents: 'last-modified-merge',

  // Guard logs: Append-only (never conflicts)
  guard_logs: 'append-only',

  // Documents: Manual resolution required
  documents: 'manual-review'
};

// PowerSync conflict handling
const handleConflict = (local: any, remote: any, table: string) => {
  switch (conflictStrategies[table]) {
    case 'server-wins':
      return remote;
    case 'last-modified-merge':
      return local.updated_at > remote.updated_at ? local : remote;
    case 'append-only':
      return [...local, ...remote];
    case 'manual-review':
      return { ...remote, _conflict: local };
  }
};
```

**Which phase should address:** Phase 2 (Offline-first) - Core sync architecture decision.

**Sources:**
- [PowerSync + Supabase](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync)
- [Offline-First Chat App](https://bndkt.com/blog/2023/building-an-offline-first-chat-app-using-powersync-and-supabase)

---

### Pitfall 9: Storage RLS Policy Violations

**What goes wrong:** File uploads fail with RLS errors despite seemingly correct policies, or files are exposed to wrong tenants.

**Why it happens:**
- Storage uses separate `storage.objects` table with its own RLS
- Bucket permissions AND RLS both apply
- Service role timing issues with metadata
- `upsert` requires SELECT + UPDATE policies, not just INSERT

**Consequences:**
- Photo uploads fail intermittently
- Document access broken for some users
- Files visible across tenant boundaries
- 403 errors with misleading messages

**Warning signs:**
- Uploads fail at 100% progress
- Intermittent "RLS violation" errors
- 400 status but 403 error message in body
- Works with service role but not user token

**Prevention:**
```sql
-- Complete storage policy set for multi-tenant
CREATE POLICY "Tenant upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-files'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT (auth.jwt()->'app_metadata'->>'tenant_id')
    )
  );

CREATE POLICY "Tenant read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tenant-files'
    AND (storage.foldername(name))[1] = (
      SELECT (auth.jwt()->'app_metadata'->>'tenant_id')
    )
  );

-- If using upsert, also need UPDATE
CREATE POLICY "Tenant update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'tenant-files'
    AND (storage.foldername(name))[1] = (
      SELECT (auth.jwt()->'app_metadata'->>'tenant_id')
    )
  );
```

**File path convention:**
```
/{tenant_id}/{entity_type}/{entity_id}/{filename}
/abc123/residents/456/profile.jpg
/abc123/documents/789/contract.pdf
```

**Which phase should address:** Phase 2/3 (File features) - Establish storage conventions early.

**Sources:**
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage RLS Policy Discussions](https://github.com/orgs/supabase/discussions/35737)
- [Storage RLS Admin Upload Fix](https://www.technetexperts.com/supabase-storage-rls-admin-upload-fix/)

---

### Pitfall 10: Schema Drift Between Environments

**What goes wrong:** Production database diverges from migration files due to manual changes, causing deployment failures and data issues.

**Why it happens:**
- "Quick fixes" made directly in production dashboard
- Multiple developers making local changes
- Migrations not tested before deployment
- No staging environment mirroring production

**Consequences:**
- Deployments fail with "already exists" or "doesn't exist" errors
- Cannot recreate production locally
- Migrations become unreliable
- Team loses confidence in deployment process

**Warning signs:**
- Migration history mismatch errors
- `supabase db diff` shows unexpected changes
- "Works on my machine" but fails in production
- Fear of running migrations

**Prevention:**
```bash
# Golden rule: NEVER modify production directly via UI

# Always use migration workflow
supabase db diff --use-migra -f new_feature
supabase db push --dry-run  # Preview first!
supabase db push

# Sync local from production when needed
supabase db pull

# CI/CD pipeline for migrations
# .github/workflows/migrate.yml
```

```yaml
# Use CI/CD, not manual deployment
name: Deploy Migrations
on:
  push:
    branches: [main]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --db-url ${{ secrets.SUPABASE_DB_URL }}
```

**Which phase should address:** Phase 1 (Foundation) - Set up migration workflow before any schema changes.

**Sources:**
- [Database Migrations Docs](https://supabase.com/docs/guides/deployment/database-migrations)
- [Managing Migrations Across Environments](https://dev.to/parth24072001/supabase-managing-database-migrations-across-multiple-environments-local-staging-production-4emg)

---

### Pitfall 11: Edge Function Cold Starts and Timeouts

**What goes wrong:** Edge Functions have unpredictable latency (400ms+ cold starts) and timeout on long operations.

**Why it happens:**
- Cold starts when function hasn't been called recently
- 2-second CPU limit (not wall clock)
- External API calls eat into timeout budget
- Supabase self-hosts Deno (not Deno Deploy)

**Consequences:**
- Slow guard notifications (missing 400ms+ on first alert)
- Payment webhooks timing out
- Inconsistent user experience
- Functions failing mid-operation

**Warning signs:**
- First request after idle period is slow
- "wall clock time limit reached" errors
- Functions work locally but fail in production
- Timeouts on complex calculations

**Prevention:**
```typescript
// Keep functions warm with scheduled ping
// supabase/functions/keep-warm/index.ts
Deno.serve(async () => {
  // Called every 5 minutes by cron
  return new Response('warm');
});

// In database or external scheduler:
// SELECT cron.schedule('keep-warm', '*/5 * * * *',
//   $$SELECT net.http_get('https://xxx.supabase.co/functions/v1/keep-warm')$$);
```

```typescript
// Break long operations into chunks
export async function processPayments(req: Request) {
  const { batch } = await req.json();

  // Process in chunks, return early
  const chunk = batch.slice(0, 10);
  const remaining = batch.slice(10);

  // Process chunk synchronously
  for (const payment of chunk) {
    await processPayment(payment);
  }

  // Queue remaining for next invocation
  if (remaining.length > 0) {
    await queueNextBatch(remaining);
  }

  return new Response(JSON.stringify({ processed: chunk.length }));
}
```

**Which phase should address:** Phase 2+ (When building Edge Functions) - Design for latency constraints.

**Sources:**
- [Edge Function Limits](https://supabase.com/docs/guides/functions/limits)
- [Edge Function Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting)
- [Edge Function Performance Discussion](https://github.com/orgs/supabase/discussions/29301)

---

### Pitfall 12: Over-Engineering Business Logic in Database

**What goes wrong:** Complex business rules implemented as triggers and functions become unmaintainable and untestable.

**Why it happens:**
- "Keep logic close to data" sounds good
- SQL seems elegant for some operations
- Avoiding round-trips to application layer
- Difficulty testing database code

**Consequences:**
- Hard to debug business logic
- Vendor lock-in to PostgreSQL
- Cannot unit test without database
- Complex migrations when logic changes

**Warning signs:**
- Triggers calling triggers
- 100+ line PL/pgSQL functions
- Business rules duplicated in app and database
- "Nobody understands how that trigger works"

**Prevention:**
```
Layer appropriately:

DATABASE LAYER (triggers/functions):
- Audit logging (created_at, updated_at, created_by)
- Referential integrity beyond FK constraints
- Data normalization/denormalization
- Simple computed fields

APPLICATION LAYER (Edge Functions/API):
- Business validation (can user perform action?)
- Workflow logic (what happens after X?)
- External integrations
- Complex calculations
- Anything that needs unit testing
```

```typescript
// Example: Keep payment logic in Edge Function
async function processPayment(payment: Payment) {
  // Validation - testable!
  if (!canUserMakePayment(payment.user_id, payment.amount)) {
    throw new PaymentError('Insufficient permissions');
  }

  // Business logic - testable!
  const fee = calculateProcessingFee(payment.amount);
  const total = payment.amount + fee;

  // Only simple insert in database
  await supabase.from('payments').insert({
    ...payment,
    fee,
    total,
    status: 'pending'
  });
}
```

**Which phase should address:** Phase 1 (Foundation) - Establish where logic lives before building features.

**Sources:**
- [Supabase Common Mistakes](https://hrekov.com/blog/supabase-common-mistakes)
- [3 Biggest Mistakes Using Supabase](https://medium.com/@lior_amsalem/3-biggest-mistakes-using-supabase-854fe45712e3)

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

### Pitfall 13: JWT Expiration Session Issues

**What goes wrong:** Users get logged out unexpectedly, or stale sessions cause unauthorized access.

**Why it happens:**
- JWT valid until expiry even after signout
- Token refresh fails silently
- Session not properly shared between server/client in SSR

**Prevention:**
- Set shorter JWT expiry (1 hour max for sensitive apps)
- Use `getUser()` to validate sessions, not just `getClaims()`
- Implement proper session refresh handling

**Which phase should address:** Phase 1 (Auth setup)

**Sources:**
- [Supabase Sessions Docs](https://supabase.com/docs/guides/auth/sessions)

---

### Pitfall 14: Anon Role Still Checking RLS

**What goes wrong:** Anonymous requests still trigger RLS evaluation, wasting database resources.

**Why it happens:**
- Policies using `auth.uid() = X` run for anon users (returning null)
- Database evaluates policy even when result is always false

**Prevention:**
```sql
-- GOOD: Exclude anon early
CREATE POLICY "Authenticated only" ON properties
  FOR ALL
  TO authenticated  -- Not 'public'!
  USING (tenant_id = current_tenant_id());
```

**Which phase should address:** Phase 1 (RLS design)

**Sources:**
- [RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)

---

### Pitfall 15: PowerSync WAL Replication Overhead

**What goes wrong:** PowerSync causes memory spikes and replication delays by reading all WAL changes.

**Why it happens:**
- Publication set to `FOR ALL TABLES`
- Large tables with frequent updates flood WAL
- Sync Rules don't filter at WAL level

**Prevention:**
```sql
-- Specify only tables that need sync
CREATE PUBLICATION powersync_pub
FOR TABLE properties, residents, payments, guard_logs;
```

**Which phase should address:** Phase 2 (Offline sync setup)

**Sources:**
- [PowerSync + Supabase Docs](https://docs.powersync.com/integration-guides/supabase-+-powersync)

---

## Phase-Specific Warnings

| Phase/Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation (Schema) | Financial data types wrong | Use NUMERIC(15,4), never float |
| Foundation (RLS) | Policies too complex, no indexes | Design simple policies, index all tenant_id columns |
| Foundation (Auth) | user_metadata for tenant_id | Always use app_metadata |
| Offline Sync | No conflict strategy | Define per-table resolution before building |
| Real-time | Silent subscription failures | Build self-healing subscriptions from start |
| File Storage | RLS on storage.objects missed | Test file access per-tenant early |
| Migrations | Schema drift | Use CI/CD, never manual changes |
| Scaling | RLS performance degradation | Load test with realistic data volume |
| Edge Functions | Cold start latency | Keep warm for critical paths |

---

## Real-World Incident: November 2025 Supabase Outage

**What happened:** On November 24, 2025, Supabase experienced a 30-minute outage affecting 90% of requests due to a missing feature flag in their API Gateway deployment.

**Lessons for UPOE:**
1. **Test undefined states:** The bug was a missing feature flag that wasn't caught because staging had it defined
2. **Gradual rollouts:** All services now follow staged rollout
3. **Have fallback plans:** Direct database connections and Supavisor were NOT impacted - Edge Functions and API were

**Implication:** For critical operations (guard alerts), consider having a fallback path that doesn't rely on Supabase API layer.

**Sources:**
- [Supabase Status History](https://status.supabase.com/history)

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| RLS Security Issues | HIGH | Multiple verified sources, official docs, CVE reference |
| RLS Performance | HIGH | Official troubleshooting docs, community validation |
| Realtime Issues | HIGH | Multiple GitHub discussions, production reports |
| Storage Issues | MEDIUM | GitHub issues, less official documentation |
| Offline Sync | MEDIUM | PowerSync docs, fewer production reports |
| Edge Functions | HIGH | Official docs, performance discussions |
| Migrations | HIGH | Official docs, common community complaint |
| Financial Types | HIGH | PostgreSQL official docs, industry standards |

---

## Summary: Top 5 Things to Get Right from Day 1

1. **Enable RLS on every table immediately** with tenant_id policies and proper indexes
2. **Use app_metadata (not user_metadata)** for tenant_id in JWT claims
3. **Use NUMERIC(15,4) for all financial amounts** - never float/real/money
4. **Define conflict resolution strategy** before building offline sync
5. **Set up migration CI/CD** before making any schema changes

Get these wrong and you'll be doing a rewrite. Get these right and you'll scale smoothly.
