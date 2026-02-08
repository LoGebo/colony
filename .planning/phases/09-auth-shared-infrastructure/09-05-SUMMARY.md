# Phase 9 Plan 05: Shared Hooks, QueryProvider, Upload Utilities Summary

## One-liner
useAuth/useRole hooks on both platforms with identical API, TanStack Query provider for admin, mobile image upload utility, and wired sidebar with user info and logout.

## What Was Done

### Task 1: Create useAuth and useRole hooks for both platforms
- Created `packages/mobile/src/hooks/useAuth.ts` -- extracts user, session, role, communityId from SessionProvider; signOut delegates to supabase.auth.signOut() (Stack.Protected handles redirect)
- Created `packages/mobile/src/hooks/useRole.ts` -- boolean helpers (isResident, isGuard, isAdmin, isManager, isSuperAdmin, isPendingSetup, isAdminRole) derived from useAuth role
- Created `packages/admin/src/hooks/useAuth.ts` -- manages own auth state via onAuthStateChange subscription; lazy Supabase client creation to avoid SSR prerender errors; signOut redirects to /sign-in
- Created `packages/admin/src/hooks/useRole.ts` -- identical API to mobile useRole

### Task 2: Create admin QueryProvider, file upload utilities, and wire sidebar
- Created `packages/shared/src/lib/upload.ts` -- generateUploadPath (unique timestamped paths) and getContentType (MIME from extension)
- Updated `packages/shared/src/index.ts` -- re-exported generateUploadPath and getContentType
- Created `packages/mobile/src/lib/upload.ts` -- pickAndUploadImage using expo-image-picker, fetches URI as ArrayBuffer, uploads to Supabase Storage
- Created `packages/admin/src/providers/QueryProvider.tsx` -- TanStack Query with staleTime 60s, gcTime 5min, retry 1
- Updated `packages/admin/src/app/layout.tsx` -- wrapped children with QueryProvider
- Updated `packages/admin/src/app/(dashboard)/layout.tsx` -- converted to client component with SidebarUser (email, role label, Cerrar Sesion button) and NavLink (active state via usePathname)
- Updated `packages/admin/src/app/(dashboard)/page.tsx` -- added force-dynamic (auth-dependent page)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SSR prerender crash in admin useAuth**
- **Found during:** Task 2 verification (admin build)
- **Issue:** `createBrowserClient` was called at module scope in useAuth.ts, causing `@supabase/ssr` to throw "URL and API key required" during Next.js static prerendering where env vars are unavailable
- **Fix:** Changed to lazy client creation pattern using useRef + useCallback, so createClient() is only called inside useEffect (client-side only)
- **Files modified:** packages/admin/src/hooks/useAuth.ts
- **Commit:** 58b7d60

**2. [Rule 2 - Missing Critical] Added force-dynamic to dashboard page**
- **Found during:** Task 2 verification
- **Issue:** Dashboard page was being statically prerendered despite depending on auth state
- **Fix:** Added `export const dynamic = 'force-dynamic'` to skip static prerendering
- **Files modified:** packages/admin/src/app/(dashboard)/page.tsx
- **Commit:** 58b7d60

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Lazy Supabase client in admin useAuth | Avoids SSR prerender crashes; createBrowserClient needs env vars only available at runtime |
| Dashboard layout as 'use client' | Required for useAuth/usePathname hooks; Server Component sidebar would need separate client boundary anyway |
| useRef + useCallback for client singleton | Stable reference across renders without re-creating client; deferred to useEffect timing |

## Verification Results
1. `useAuth` found in packages/mobile/src/hooks/ -- PASS
2. `useAuth` found in packages/admin/src/hooks/ -- PASS
3. `signOut` found in mobile useAuth.ts -- PASS
4. `signOut` found in admin useAuth.ts -- PASS
5. `QueryProvider` found in admin layout.tsx -- PASS
6. `pickAndUploadImage` found in mobile upload.ts -- PASS
7. `Cerrar Sesion` found in dashboard layout -- PASS
8. `pnpm build` succeeds for admin -- PASS
9. `tsc --noEmit` succeeds for mobile -- PASS

## Files Created
- `packages/mobile/src/hooks/useAuth.ts`
- `packages/mobile/src/hooks/useRole.ts`
- `packages/admin/src/hooks/useAuth.ts`
- `packages/admin/src/hooks/useRole.ts`
- `packages/shared/src/lib/upload.ts`
- `packages/mobile/src/lib/upload.ts`
- `packages/admin/src/providers/QueryProvider.tsx`

## Files Modified
- `packages/shared/src/index.ts`
- `packages/admin/src/app/layout.tsx`
- `packages/admin/src/app/(dashboard)/layout.tsx`
- `packages/admin/src/app/(dashboard)/page.tsx`
- `packages/admin/package.json` (@tanstack/react-query added)
- `packages/mobile/package.json` (expo-image-picker added)
- `pnpm-lock.yaml`

## Duration
~5 min

## Commits
- `a604612` feat(09-05): create useAuth and useRole hooks for both platforms
- `58b7d60` feat(09-05): add QueryProvider, upload utilities, and wire sidebar
