---
phase: 09-auth-shared-infrastructure
plan: 01
subsystem: shared
tags: [zod, zod-v4, query-key-factory, tanstack-query, validation, typescript, monorepo]

# Dependency graph
requires:
  - phase: database (v1.0)
    provides: database.types.ts generated from 128+ migrations
provides:
  - Zod v4 auth form validators with Spanish error messages (signIn, signUp, adminOnboarding, resetPassword, inviteUser)
  - Typed query key factories for 10 domains (residents, visitors, payments, access-logs, amenities, notifications, kpis, communities, units, guards)
  - Route constants for mobile (Expo Router) and admin (Next.js) platforms
  - Re-export barrel from @upoe/shared index.ts
affects: [09-02, 09-03, 09-04, 09-05, 10-mobile-auth, 11-admin-auth]

# Tech tracking
tech-stack:
  added: [zod@^4.3.6, @lukemorales/query-key-factory@^1.3.4, @tanstack/react-query@^5.90.20 (devDep), @tanstack/query-core@^5.90.20 (devDep)]
  patterns: [Zod v4 error syntax with string shorthand, query-key-factory createQueryKeys + mergeQueryKeys, as const route objects]

key-files:
  created:
    - packages/shared/src/validators/auth.ts
    - packages/shared/src/validators/index.ts
    - packages/shared/src/queries/keys.ts
    - packages/shared/src/queries/index.ts
    - packages/shared/src/constants/routes.ts
  modified:
    - packages/shared/package.json
    - packages/shared/src/constants/index.ts
    - packages/shared/src/index.ts
    - packages/shared/tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "Disabled declaration/declarationMap in tsconfig.json -- shared package is consumed as raw TypeScript source via monorepo, declarations unnecessary and cause pnpm symlink portability errors (TS2742)"
  - "Used z.email('message') string shorthand for Zod v4 instead of { error: 'message' } object -- simpler, both produce identical runtime error messages"
  - "Added @tanstack/react-query and @tanstack/query-core as devDependencies -- required for typecheck of query-key-factory types, satisfied at runtime by consuming apps"

patterns-established:
  - "Zod v4 validators: Use z.email('spanish message') for top-level validators, z.string().min(N, 'spanish message') for constrained strings"
  - "Query keys: Use createQueryKeys per domain, mergeQueryKeys to combine, export merged queryKeys object"
  - "Route constants: as const objects per platform (MOBILE_ROUTES, ADMIN_ROUTES), AUTH_ROUTES array for middleware"

# Metrics
duration: 10min
completed: 2026-02-08
---

# Phase 9 Plan 01: Shared Package Foundation Summary

**Zod v4 auth validators with Spanish errors, query key factories for 10 domains, and route constants for Expo Router + Next.js**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-08T03:47:36Z
- **Completed:** 2026-02-08T03:58:02Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- 5 Zod v4 auth validation schemas with Spanish error messages and inferred TypeScript types
- Query key factories for 10 domains (residents, visitors, payments, access-logs, amenities, notifications, kpis, communities, units, guards) with typed parameters
- MOBILE_ROUTES and ADMIN_ROUTES constants with AUTH_ROUTES middleware array
- All new modules re-exported from @upoe/shared barrel index

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Zod v4 auth validators** - `0dd697a` (feat)
2. **Task 2: Create query key factories and route constants** - `d1c7ebe` (feat)

## Files Created/Modified
- `packages/shared/src/validators/auth.ts` - 5 Zod v4 schemas (signIn, signUp, adminOnboarding, resetPassword, inviteUser) with Spanish errors
- `packages/shared/src/validators/index.ts` - Barrel re-export for validators
- `packages/shared/src/queries/keys.ts` - Query key factories for 10 domains using @lukemorales/query-key-factory
- `packages/shared/src/queries/index.ts` - Barrel re-export for queries
- `packages/shared/src/constants/routes.ts` - MOBILE_ROUTES, ADMIN_ROUTES, AUTH_ROUTES constants
- `packages/shared/src/constants/index.ts` - Added routes re-export
- `packages/shared/src/index.ts` - Added validators and queries re-exports
- `packages/shared/package.json` - Added zod, query-key-factory, tanstack deps
- `packages/shared/tsconfig.json` - Disabled declaration generation for monorepo compatibility
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- **Disabled declaration generation:** `declaration: false` in tsconfig.json. The shared package is consumed as raw TypeScript source via `"main": "./src/index.ts"` in the monorepo. Declarations are unnecessary and caused TS2742 portability errors with pnpm's symlink structure for `@tanstack/query-core` types.
- **Zod v4 string shorthand for errors:** Used `z.email('Correo electronico invalido')` instead of `z.email({ error: 'Correo electronico invalido' })`. Both produce identical results; the string form is simpler.
- **TanStack as devDependencies:** Added `@tanstack/react-query` and `@tanstack/query-core` as devDependencies since they're only needed for typecheck. The consuming apps (mobile/admin) will have them as runtime dependencies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Committed foundational shared package files**
- **Found during:** Task 1 (commit stage)
- **Issue:** Foundational files (types/index.ts, database.types.ts, constants/roles.ts, constants/storage.ts, lib/supabase.ts, tsconfig.json) were untracked in git despite existing on disk. Could not commit validators without the base package being tracked.
- **Fix:** Included foundational shared package files plus monorepo config (.gitignore, .npmrc, package.json, pnpm-workspace.yaml) in Task 1 commit
- **Files modified:** 12 files in commit
- **Verification:** `pnpm typecheck` passes
- **Committed in:** 0dd697a (Task 1 commit)

**2. [Rule 3 - Blocking] Added @tanstack/query-core as devDependency**
- **Found during:** Task 2 (typecheck)
- **Issue:** TS2742 error -- "inferred type of 'residents' cannot be named without a reference to .pnpm/@tanstack+query-core". The `declaration: true` setting + pnpm symlinks caused non-portable type paths.
- **Fix:** Added @tanstack/query-core as devDep AND disabled declaration generation (not needed for raw TS consumption)
- **Files modified:** packages/shared/package.json, packages/shared/tsconfig.json
- **Verification:** `pnpm typecheck` passes with zero errors
- **Committed in:** d1c7ebe (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
- TS2742 portability error with pnpm + declaration generation -- resolved by disabling declaration output (not needed for monorepo raw TS consumption pattern)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared validators, query keys, and route constants are ready for consumption by mobile (09-02) and admin (09-03) packages
- All exports accessible via `import { signInSchema, queryKeys, MOBILE_ROUTES } from '@upoe/shared'`
- No blockers for downstream plans

---
*Phase: 09-auth-shared-infrastructure*
*Completed: 2026-02-08*
