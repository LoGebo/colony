---
phase: 09-auth-shared-infrastructure
plan: 03
subsystem: auth
tags: [supabase-ssr, next.js, middleware, jwt, getClaims, cookie-auth, sidebar]

# Dependency graph
requires:
  - phase: 09-01
    provides: shared package with Database types and constants
provides:
  - Browser Supabase client (createBrowserClient from @supabase/ssr)
  - Server Supabase client with cookie-based auth
  - Middleware proxy with getClaims() JWT validation
  - Admin service-role client (server-only)
  - Next.js middleware for auth redirects and session refresh
  - Auth callback route for code-to-session exchange
  - Auth route group with centered card layout (sign-in, sign-up, forgot-password, onboarding)
  - Dashboard route group with sidebar navigation layout
affects: [09-04 (auth forms), 09-05 (shared hooks), 11-resident-mgmt, 12-financial, 13-operations, 14-community, 15-reports]

# Tech tracking
tech-stack:
  added: ["@supabase/ssr ^0.8.0", "@supabase/supabase-js ^2.95.3"]
  patterns: ["cookie-based SSR auth via @supabase/ssr", "getClaims() with getUser() fallback for JWT validation", "route groups for auth vs dashboard separation", "server component sidebar layout"]

key-files:
  created:
    - packages/admin/src/lib/supabase/client.ts
    - packages/admin/src/lib/supabase/server.ts
    - packages/admin/src/lib/supabase/proxy.ts
    - packages/admin/src/lib/supabase/admin.ts
    - packages/admin/src/middleware.ts
    - packages/admin/src/app/auth/callback/route.ts
    - packages/admin/src/app/(auth)/layout.tsx
    - packages/admin/src/app/(auth)/sign-in/page.tsx
    - packages/admin/src/app/(auth)/sign-up/page.tsx
    - packages/admin/src/app/(auth)/forgot-password/page.tsx
    - packages/admin/src/app/(auth)/onboarding/page.tsx
    - packages/admin/src/app/(dashboard)/layout.tsx
    - packages/admin/src/app/(dashboard)/page.tsx
    - packages/admin/.env.example
  modified:
    - packages/admin/src/app/layout.tsx
    - packages/admin/next.config.ts
    - packages/admin/package.json
    - packages/admin/.gitignore

key-decisions:
  - "getClaims() with getUser() runtime fallback -- uses typeof check to detect getClaims availability"
  - "Middleware convention kept as middleware.ts (Next.js 16 shows deprecation warning for proxy.ts rename)"
  - "Service-role key uses SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix) for security"
  - "Sidebar uses inline SVG Heroicons instead of icon library dependency"
  - "Auth pages are placeholder-only (forms implemented in Plan 09-04)"

patterns-established:
  - "Pattern: 4-file Supabase client structure (client.ts, server.ts, proxy.ts, admin.ts)"
  - "Pattern: Middleware handles all auth redirects (unauthenticated to /sign-in, authenticated away from auth, pending_setup to /onboarding)"
  - "Pattern: Dashboard sidebar as Server Component with static nav items"
  - "Pattern: Route groups (auth) and (dashboard) for layout separation"

# Metrics
duration: 7min
completed: 2026-02-08
---

# Phase 9 Plan 03: Admin Dashboard Auth Infrastructure Summary

**Next.js 16 admin dashboard with @supabase/ssr cookie-based auth, getClaims() middleware, sidebar navigation, and auth/dashboard route groups**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-08T03:50:43Z
- **Completed:** 2026-02-08T03:57:54Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Installed @supabase/ssr and created 4 Supabase client files (browser, server, proxy, admin) following official SSR patterns
- Middleware validates JWT via getClaims() with automatic getUser() fallback, handles auth redirects and pending_setup onboarding flow
- Created auth route group with centered card layout and 4 placeholder pages (sign-in, sign-up, forgot-password, onboarding)
- Created dashboard route group with full sidebar navigation layout (6 nav items with Heroicons)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @supabase/ssr and create Supabase client files + middleware** - `b6ecafd` (feat)
2. **Task 2: Create auth and dashboard route groups with sidebar layout** - `409ebc3` (feat)

## Files Created/Modified

- `packages/admin/src/lib/supabase/client.ts` - Browser Supabase client using createBrowserClient
- `packages/admin/src/lib/supabase/server.ts` - Server Supabase client with cookie-based auth via next/headers
- `packages/admin/src/lib/supabase/proxy.ts` - Middleware session handler with getClaims() JWT validation
- `packages/admin/src/lib/supabase/admin.ts` - Service-role admin client (server-only, no NEXT_PUBLIC_ prefix)
- `packages/admin/src/middleware.ts` - Next.js middleware calling updateSession for auth redirects
- `packages/admin/src/app/auth/callback/route.ts` - Auth callback route exchanging code for session
- `packages/admin/src/app/(auth)/layout.tsx` - Centered card layout for auth pages
- `packages/admin/src/app/(auth)/sign-in/page.tsx` - Placeholder sign-in page
- `packages/admin/src/app/(auth)/sign-up/page.tsx` - Placeholder sign-up page
- `packages/admin/src/app/(auth)/forgot-password/page.tsx` - Placeholder forgot-password page
- `packages/admin/src/app/(auth)/onboarding/page.tsx` - Placeholder onboarding page
- `packages/admin/src/app/(dashboard)/layout.tsx` - Sidebar layout with 6 navigation items
- `packages/admin/src/app/(dashboard)/page.tsx` - Dashboard home page
- `packages/admin/src/app/layout.tsx` - Updated: UPOE Admin title, Spanish lang
- `packages/admin/next.config.ts` - Added transpilePackages for @upoe/shared
- `packages/admin/package.json` - Added @supabase/ssr and @supabase/supabase-js
- `packages/admin/.env.example` - Required environment variables
- `packages/admin/.gitignore` - Added !.env.example exclusion

## Decisions Made

1. **getClaims() with runtime fallback to getUser()**: The plan specified getClaims() as primary with getUser() fallback. Used `typeof supabase.auth.getClaims === 'function'` runtime check to detect availability. getClaims() validates JWT via JWKS (fast, local). getUser() calls Auth server (slower, catches banned users).

2. **Next.js 16 middleware.ts deprecation**: Next.js 16.1.6 shows a deprecation warning recommending renaming `middleware.ts` to `proxy.ts`. Kept as `middleware.ts` per plan specification since it still works. Future plan can rename when convention stabilizes.

3. **Inline SVG icons over icon library**: Used Heroicons SVG paths directly in the sidebar rather than adding a dependency like `@heroicons/react`. Keeps bundle smaller and avoids unnecessary dependencies for 6 static icons.

4. **Service-role key naming**: Used `SUPABASE_SERVICE_ROLE_KEY` (NOT `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`) to ensure the key never leaks to client bundles.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getClaims() nullable data destructuring**
- **Found during:** Task 1 (proxy.ts creation)
- **Issue:** Initial code used `const { data: { claims } } = await supabase.auth.getClaims()` but `data` can be null, causing TypeScript error
- **Fix:** Changed to `const { data } = await supabase.auth.getClaims()` with `data?.claims` null check
- **Files modified:** packages/admin/src/lib/supabase/proxy.ts
- **Verification:** `pnpm build` passes without TypeScript errors
- **Committed in:** b6ecafd (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed .gitignore excluding .env.example**
- **Found during:** Task 1 (.env.example creation)
- **Issue:** Default .gitignore had `.env*` pattern which would exclude `.env.example` from git
- **Fix:** Added `!.env.example` exception to .gitignore
- **Files modified:** packages/admin/.gitignore
- **Verification:** `git add packages/admin/.env.example` succeeds
- **Committed in:** b6ecafd (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- Next.js 16.1.6 deprecation warning for `middleware.ts` convention (recommends `proxy.ts`). Non-blocking -- middleware still functions correctly. Noted for future migration.

## User Setup Required

Environment variables must be configured before running the admin dashboard:

1. Copy `.env.example` to `.env.local` in `packages/admin/`
2. Set `NEXT_PUBLIC_SUPABASE_URL` to your Supabase project URL
3. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to your Supabase anon/publishable key
4. Set `SUPABASE_SERVICE_ROLE_KEY` to your Supabase service role key (server-only)
5. Set `NEXT_PUBLIC_SITE_URL` to your site URL (default: http://localhost:3000)

## Next Phase Readiness

- Auth infrastructure complete -- Plan 09-04 can implement actual auth forms (sign-in, sign-up, forgot-password, onboarding)
- Sidebar layout ready for feature pages in Phases 11-15
- Middleware handles all auth redirect logic including pending_setup onboarding flow
- No blockers for next plan

---
*Phase: 09-auth-shared-infrastructure*
*Completed: 2026-02-08*
