# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Milestone v2.0 -- Phase 12: Admin Dashboard Operations

## Current Position

Phase: 12 of 16 (Admin Dashboard Operations)
Plan: 0 of 4 in current phase
Status: Not started
Last activity: 2026-02-08 -- Completed Phase 11 (Admin Dashboard Financial Core) -- all 4 plans

Progress: [████░░░░░░] 41% (14/34 v2.0 plans)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 38
- Average duration: 6.2 min
- Total execution time: ~236 min

**v2.0 Velocity:**
- Total plans completed: 14
- Average duration: 6.5 min
- Total execution time: ~91 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key decisions carrying forward to v2.0:

- Supabase auto-API (PostgREST) -- no custom backend needed
- React Native with Expo 54 (managed workflow)
- Next.js 16 for admin dashboard
- Monorepo with pnpm workspaces
- Platform-specific Supabase clients (expo-sqlite for mobile, @supabase/ssr for web)
- getClaims() not getSession() for server-side auth verification
- TanStack Query v5 as universal data layer
- frontend-design skill for all UI implementations

New v2.0 decisions:
- expo-sqlite localStorage polyfill for Supabase auth storage (NOT SecureStore or MMKV)
- NativeWind v4.2 + Tailwind CSS v3.4.17 (NOT Tailwind v4) for mobile styling
- Stack.Protected for role-based routing (Expo SDK 54 feature)
- Custom env.d.ts for process.env types (not @types/node)
- getClaims() with runtime getUser() fallback for admin middleware JWT validation
- 4-file Supabase client structure for admin: client.ts, server.ts, proxy.ts, admin.ts
- Inline SVG Heroicons in sidebar (no icon library dependency)
- Next.js middleware.ts kept despite deprecation warning (proxy.ts rename deferred)
- Disabled declaration generation in @upoe/shared tsconfig (raw TS source consumption, avoids pnpm TS2742)
- @tanstack/react-query + query-core as devDependencies in shared (typecheck only, runtime from consumers)
- Use undefined (not null) for optional RPC params (matches generated Database types)
- Lazy Supabase client creation in admin useAuth (avoids SSR prerender crashes)
- force-dynamic on auth-dependent dashboard pages
- occupancy_type='owner' priority for primary unit resolution (occupancies table lacks is_primary column)
- expo-file-system v19 File/Paths API (not legacy cacheDirectory/writeAsStringAsync)
- Client-side fallback QR payload with 'unsigned' signature until HMAC secret configured
- PostgREST FK hints required for ambiguous occupancies->residents joins (authorized_by vs resident_id)
- useGuardAccessPoint hook resolves required access_point_id for access_logs inserts
- Lazy Supabase client in queryFn (not hook body) to prevent SSR prerender crashes in financial hooks
- Inclusive RLS role update: community_admin added alongside admin (not replacing) for backwards compat
- Recharts v3 Tooltip formatter uses untyped value param with Number() cast
- record_charge RPC typed as 'never' cast (types not regenerated after migration deployment)
- Badge component has no size prop -- all badges use text-xs by default

### Pending Todos

None.

### Blockers/Concerns

- Database migrations 20260208123300 and 20260208123301 need to be applied to live Supabase instance before admin dashboard features work

## Session Continuity

Last session: 2026-02-08
Stopped at: Completed Phase 11 (all 4 plans). Ready for Phase 12.
Resume file: None
