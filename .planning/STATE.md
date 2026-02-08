# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Milestone v2.0 -- Phase 9: Auth & Shared Infrastructure

## Current Position

Phase: 9 of 16 (Auth & Shared Infrastructure)
Plan: 4 of 5 in current phase (Wave 1: 01, 02, 03; Wave 2: 04)
Status: In progress
Last activity: 2026-02-08 -- Completed 09-04-PLAN.md (Auth Screens Implementation)

Progress: [█░░░░░░░░░] 12% (4/34 v2.0 plans)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 38
- Average duration: 6.2 min
- Total execution time: ~236 min

**v2.0 Velocity:**
- Total plans completed: 4
- Average duration: 7.0 min
- Total execution time: 28 min

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-08
Stopped at: Completed 09-04-PLAN.md (Auth Screens Implementation)
Resume file: None
