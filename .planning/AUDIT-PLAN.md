# Exhaustive Audit & Fix Plan — UPOE Colony App v2.0

**Date**: 2026-02-09
**Scope**: Full codebase audit across all 3 packages + Supabase database
**Total Source**: ~57,000 LOC across 262 files (mobile: 138, admin: 109, shared: 15)

---

## Executive Summary

| Category | Issues Found | Severity | Effort |
|----------|-------------|----------|--------|
| TypeScript Errors | 116 total (48 admin, 68 mobile) | HIGH | Medium |
| Type Safety Casts | 178 (127 `as never` + 51 `as unknown`) | MEDIUM | Low (auto-fix) |
| DB Schema Drift | 6 columns missing from live schema | HIGH | Medium |
| Pending Migrations | 9 not applied to Supabase | HIGH | Low |
| Security (DB) | 127 functions with mutable search_path | WARN | Medium |
| Performance (DB) | 486 duplicate RLS policies + 93 auth initplan | WARN | High |
| Unused Indexes | 325 indexes never used | INFO | Medium |
| Unindexed FKs | 184 foreign keys without indexes | INFO | Medium |
| Console Statements | 18 in source code | LOW | Low |
| TODO/FIXME | 3 in source code | LOW | Low |
| Hardcoded Secrets | 0 | CLEAN | None |
| **Total DB Advisories** | **1,215** | | |

---

## Phase A: Database Alignment (Critical — Fixes 80% of TS errors)

### A1. Apply Pending Migrations to Supabase
**Priority**: CRITICAL
**Impact**: Unblocks shift_handovers, provider_work_orders tables

9 pending migrations in `.pending_migrations/`:
1. `20260130043900_webhook_tables.sql`
2. `20260130043911_access_devices_tables.sql`
3. `20260130044016_access_device_lifecycle.sql`
4. `20260130044100_api_keys_integrations.sql`
5. `20260130044200_emergency_contacts.sql`
6. `20260130044342_voting_functions.sql`
7. `20260130044418_violations_tables.sql`
8. `20260208220000_shift_handovers.sql` ← needed by mobile useHandovers
9. `20260208220100_provider_work_orders.sql` ← needed by admin useWorkOrders

**Action**: Apply via `mcp__supabase__apply_migration` in order.

### A2. Verify Column Schema Alignment
**Priority**: HIGH
**Impact**: Fixes ~30 mobile TS errors for missing columns

Mobile code expects columns that may not exist:
- `patrol_checkpoints.gps_latitude` / `gps_longitude` — 4 errors
- `patrol_routes.is_active` — 2 errors
- `patrol_logs.observations` — 4 errors
- `incident_types.severity_default` — 5 errors
- `incident_evidence.storage_bucket` — 1 error

**Action**: Check actual DB schema, either:
- Add missing columns via migration, OR
- Update hooks to use correct column names

### A3. Regenerate TypeScript Types
**Priority**: CRITICAL
**Impact**: Eliminates most `as never` / `as unknown` casts

After A1+A2, run `mcp__supabase__generate_typescript_types` and update `packages/shared/src/types/database.types.ts`.

This should fix:
- 127 `as never` casts (most become unnecessary)
- 51 `as unknown` casts (most become unnecessary)
- 36 TS2769 "No overload" errors
- 21 TS2589 "Type instantiation too deep" errors

---

## Phase B: TypeScript Error Fixes (Post-type-regeneration)

### B1. Fix Query Key Naming (Bracket Notation)
**Priority**: HIGH — 7 errors
**Files**:
- `packages/admin/src/hooks/useWorkOrders.ts` — uses `queryKeys.workOrders` → should be `queryKeys['work-orders']`
- `packages/mobile/src/hooks/useGateOps.ts` (if applicable) — uses `queryKeys.accessLogs` → should be `queryKeys['access-logs']`

### B2. Fix RPC Parameter Names
**Priority**: HIGH — 1 error
**File**: `packages/mobile/src/hooks/useIncidents.ts:161`
- Uses `p_comment_text` but RPC expects `p_text`

### B3. Fix Readonly Array Assignment
**Priority**: MEDIUM — 5 errors
**File**: `packages/mobile/src/hooks/useVisitors.ts:56-69`
- `useRealtimeSubscription` queryKeys parameter typed as `unknown[]` (mutable)
- Query key factory returns `readonly` arrays
- Fix: Change `useRealtimeSubscription` queryKeys param to `readonly unknown[]`

### B4. Fix NotificationService API
**Priority**: HIGH — 2 errors
**File**: `packages/mobile/src/services/notifications/NotificationService.ts`
- Line 94: `NotificationBehavior` now requires `shouldShowBanner` and `shouldShowList` (expo-notifications SDK update)
- Line 274: `.catch()` doesn't exist on Supabase filter builder — use `const { error } = await ...` pattern

### B5. Fix Missing RPC in Types
**Priority**: MEDIUM — 1 error
**File**: `packages/mobile/src/hooks/useGateOps.ts`
- `is_provider_access_allowed` RPC not in generated types
- Fix: Add `as never` cast OR verify the RPC exists in DB and regenerate types

### B6. Fix Remaining Property Access Errors
**Priority**: MEDIUM — ~10 errors
**Files**: Various admin hooks
- `NonNullable<ResultOne>` missing `.status`, `.company_name`
- Likely caused by complex PostgREST joins that TypeScript can't infer
- Fix: Type the select query properly or add type assertions

---

## Phase C: Code Quality Cleanup

### C1. Reduce Console Statements
**Priority**: LOW
**18 statements found** — Categorize and clean:

**Keep (error/warn in catch blocks — appropriate):**
- `packages/admin/src/hooks/useCharges.ts:104` — console.warn for fee calculation
- `packages/mobile/src/lib/upload.ts:53,59` — console.error for upload failures
- `packages/mobile/src/hooks/useTickets.ts:132` — console.error for attachment failure

**Remove or replace with proper logging:**
- `packages/mobile/src/services/notifications/NotificationService.ts` — 8 console statements
  - Replace `console.log` with silent no-ops or debug-only logging
  - Keep `console.error` for actual errors but consider error reporting service

**Replace with debug-only:**
- `packages/admin/src/app/(dashboard)/devices/*.tsx` — 4 console.error in mutation handlers
- `packages/admin/src/app/(dashboard)/residents/invite/actions.ts:80`

### C2. Address TODO Comments
**Priority**: LOW — 3 items
1. `packages/mobile/app/(resident)/visitors/[id].tsx:44` — QR HMAC signing
2. `packages/mobile/src/hooks/useGateOps.ts:42` — QR HMAC secret
3. `packages/mobile/src/hooks/useVisitors.ts:151` — QR HMAC signing

All 3 are about the same feature: server-side QR HMAC signing. This is a deployment/config concern, not a code bug. Document as known limitation.

### C3. Review Type Cast Hotspots
**Priority**: MEDIUM — After type regeneration
**Goal**: Reduce remaining `as never` / `as unknown` casts to minimum

Post-regeneration, audit remaining casts:
- `packages/admin/src/hooks/useDevices.ts` — heaviest (40+ casts for access_devices tables)
- If tables are now in types, remove all casts
- If tables are still custom, consolidate into typed helper functions

---

## Phase D: Database Security Hardening

### D1. Fix Function Search Path (127 functions)
**Priority**: WARN (Supabase security linter)
**Impact**: Prevents potential search_path hijacking

Create single migration to set `search_path = public` on all 127 functions:
```sql
ALTER FUNCTION public.function_name SET search_path = public;
```

Functions affected (127 total — see Supabase security advisors):
- Core: generate_uuid_v7, set_audit_fields, handle_new_user, complete_admin_onboarding
- Financial: update_account_balance, record_charge, validate_posted_transaction, etc.
- Access: compute_access_log_hash, prevent_access_log_modification, etc.
- Chat: find_or_create_direct_conversation, mark_messages_read, etc.
- Governance: calculate_assembly_quorum, record_attendance, record_agreement, etc.
- All others listed in security advisors output

### D2. Consolidate Multiple Permissive RLS Policies (486 occurrences)
**Priority**: HIGH (Supabase performance linter)
**Impact**: Each permissive policy executes per query — multiple policies degrade performance

Multiple permissive RLS policies on the same table/role/action should be merged with OR:
```sql
-- Before (2 separate policies, both evaluated):
CREATE POLICY "residents_select_own" ON residents FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "residents_select_admin" ON residents FOR SELECT USING (is_admin());
-- After (1 merged policy):
CREATE POLICY "residents_select" ON residents FOR SELECT USING (user_id = auth.uid() OR is_admin());
```

Affected: 100+ tables across the schema. Prioritize high-traffic tables first:
- access_logs, residents, units, occupancies, invitations, tickets, notifications

### D3. Fix Auth RLS Initplan (93 occurrences)
**Priority**: MEDIUM (Supabase performance linter)
**Impact**: `auth.uid()` / `current_setting()` re-evaluated per ROW instead of per QUERY

Wrap auth calls in subqueries to force INITPLAN evaluation:
```sql
-- Before (evaluated per row):
USING (community_id = (auth.jwt() ->> 'community_id')::uuid)
-- After (evaluated once per query):
USING (community_id = (SELECT (auth.jwt() ->> 'community_id')::uuid))
```

### D4. Clean Up Unused Indexes (325 occurrences)
**Priority**: LOW (INFO level)
**Impact**: Reduces storage overhead and improves write performance

Review 325 indexes that have never been used. Some may be legitimately needed for:
- Unique constraints (don't remove)
- Recently created (no data yet)
- Rarely-used admin queries

**Action**: Generate list, filter out unique/PK indexes, drop confirmed unused.

### D5. Add Missing Foreign Key Indexes (184 occurrences)
**Priority**: MEDIUM (INFO level)
**Impact**: Improves JOIN performance on foreign key lookups

Add indexes on 184 unindexed foreign key columns. High-priority tables:
- access_logs (community_id, access_point_id, resident_id)
- occupancies (unit_id, resident_id)
- notifications (user_id, community_id)
- tickets (unit_id, assigned_to)
- packages (unit_id, received_by)

---

## Phase E: Cross-Feature Integration Audit

### E1. Navigation Completeness
**Priority**: MEDIUM
Verify every screen is reachable:
- [ ] All admin sidebar links point to existing pages
- [ ] All mobile tab routes render correct screens
- [ ] All `router.push()` / `router.replace()` targets exist
- [ ] Deep linking from notifications navigates correctly

### E2. Auth Flow Integration
**Priority**: HIGH
- [ ] Resident sign-up → handle_new_user trigger links correctly
- [ ] Guard sign-up → same flow
- [ ] Admin onboarding → complete_admin_onboarding creates org+community
- [ ] JWT claims contain correct community_id, role, resident_id/guard_id
- [ ] Protected routes redirect unauthenticated users
- [ ] Role-based routing sends each role to correct layout

### E3. Data Flow Verification
**Priority**: HIGH
- [ ] Resident creates visitor invitation → guard sees in queue
- [ ] Guard logs access → shows in admin access logs
- [ ] Admin creates charge → resident sees in payments
- [ ] Resident submits ticket → admin Kanban board shows it
- [ ] Admin posts announcement → resident receives notification
- [ ] Guard patrol scan → admin analytics reflect it

### E4. Real-time Subscription Verification
**Priority**: MEDIUM
- [ ] Visitor queue updates in real-time for guards
- [ ] Notification count badge updates on new notifications
- [ ] Stable channel names prevent re-subscription churn

---

## Phase F: Remaining Fixes (Lower Priority)

### F1. Unused Component Cleanup
**Priority**: LOW
- `NotificationBell.tsx` — Created but not imported anywhere after tab-based approach was adopted
- Check for other orphaned components

### F2. Expo SDK Compatibility
**Priority**: MEDIUM
- `NotificationBehavior` type changed in recent expo-notifications
- Verify all expo-* packages are compatible with Expo SDK 54

### F3. Admin Build Verification
**Priority**: HIGH
- Run `next build` on admin package to verify SSR/SSG works
- Check `force-dynamic` pages compile correctly
- Verify middleware.ts auth redirect works

### F4. Mobile Build Verification
**Priority**: HIGH
- Run `npx expo export` to verify Metro bundler resolves all imports
- Check NativeWind styles compile
- Verify monorepo imports from @upoe/shared resolve

---

## Execution Order (Recommended)

| Step | Phase | Description | Est. Impact |
|------|-------|-------------|-------------|
| 1 | A1 | Apply 9 pending migrations | Enables A2, A3 |
| 2 | A2 | Verify column schema alignment | Fixes schema drift |
| 3 | A3 | Regenerate TypeScript types | Fixes ~80% of TS errors |
| 4 | B1-B6 | Fix remaining TS errors | Fixes remaining ~20% |
| 5 | D1 | Fix 78 function search paths | Security hardening |
| 6 | C1-C3 | Code quality cleanup | Polish |
| 7 | E1-E4 | Integration verification | Confidence |
| 8 | F1-F4 | Build verification | Deployment readiness |

**Estimated Total**: Steps 1-4 fix all compilation errors. Steps 5-8 are polish/hardening.

---

## Metrics After Completion

| Metric | Before | Target |
|--------|--------|--------|
| TS errors (admin) | 48 | 0 |
| TS errors (mobile) | 68 | 0 |
| `as never` casts | 127 | <10 |
| `as unknown` casts | 51 | <10 |
| Security warnings | 78 | 0 |
| Console.log in source | 18 | <5 |
| TODO comments | 3 | 0 (documented) |
