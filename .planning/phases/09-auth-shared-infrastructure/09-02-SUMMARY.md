---
phase: 09-auth-shared-infrastructure
plan: 02
subsystem: mobile, auth, ui
tags: [expo-router, nativewind, tailwindcss, supabase, expo-sqlite, react-query, react-native]

# Dependency graph
requires:
  - phase: 09-01
    provides: Shared package with types, constants, validators
provides:
  - Expo Router file-based routing with 4 route groups
  - NativeWind v4.2 + Tailwind CSS v3.4 styling
  - Supabase client with expo-sqlite auth storage
  - SessionProvider for reactive auth state management
  - QueryProvider with TanStack Query v5 defaults
  - Role-based Stack.Protected guards (resident, guard, admin, pending_setup)
  - Tab layouts for resident (5 tabs), guard (4 tabs), admin (4 tabs)
affects: [09-04, 10-access-control, 11-payments, 12-communication, 13-community]

# Tech tracking
tech-stack:
  added: [expo-router@6.0.23, nativewind@4.2.1, tailwindcss@3.4.17, expo-sqlite@16.0.10, expo-splash-screen@31.0.13, react-native-reanimated@4.1.6, react-native-safe-area-context@5.6.2, react-native-screens@4.16.0, "@supabase/supabase-js@2.95.3", "@tanstack/react-query@5.90.20"]
  patterns: [expo-router-file-routing, stack-protected-guards, session-provider-context, expo-sqlite-localstorage-polyfill, nativewind-classname-styling]

key-files:
  created:
    - packages/mobile/app/_layout.tsx
    - packages/mobile/app/index.tsx
    - packages/mobile/app/(auth)/_layout.tsx
    - packages/mobile/app/(auth)/sign-in.tsx
    - packages/mobile/app/(auth)/sign-up.tsx
    - packages/mobile/app/(auth)/forgot-password.tsx
    - packages/mobile/app/(auth)/onboarding.tsx
    - packages/mobile/app/(resident)/_layout.tsx
    - packages/mobile/app/(resident)/index.tsx
    - packages/mobile/app/(guard)/_layout.tsx
    - packages/mobile/app/(guard)/index.tsx
    - packages/mobile/app/(admin)/_layout.tsx
    - packages/mobile/app/(admin)/index.tsx
    - packages/mobile/src/lib/supabase.ts
    - packages/mobile/src/providers/SessionProvider.tsx
    - packages/mobile/src/providers/QueryProvider.tsx
    - packages/mobile/src/env.d.ts
    - packages/mobile/babel.config.js
    - packages/mobile/metro.config.js
    - packages/mobile/tailwind.config.js
    - packages/mobile/global.css
    - packages/mobile/nativewind-env.d.ts
    - packages/mobile/.env.example
  modified:
    - packages/mobile/package.json
    - packages/mobile/app.json
    - packages/mobile/tsconfig.json

key-decisions:
  - "expo-sqlite localStorage polyfill for Supabase auth storage (NOT SecureStore or MMKV)"
  - "NativeWind v4.2 + Tailwind CSS v3.4.17 (NOT Tailwind v4)"
  - "Stack.Protected for role-based routing (SDK 54 feature)"
  - "Emoji tab icons as temporary placeholders until icon library added"
  - "process.env typed via custom env.d.ts (not @types/node)"

patterns-established:
  - "Pattern: expo-sqlite/localStorage/install MUST be first import in supabase.ts"
  - "Pattern: SessionProvider wraps entire app, useSession() hook for auth state"
  - "Pattern: Stack.Protected guards in root _layout.tsx for role-based navigation"
  - "Pattern: Route groups (auth), (resident), (guard), (admin) for role separation"
  - "Pattern: @/* path alias maps to ./src/* in mobile package"

# Metrics
duration: 7min
completed: 2026-02-08
---

# Phase 9 Plan 02: Mobile App Shell Summary

**Expo Router with 4 role-based route groups, NativeWind v4.2 styling, Supabase client with expo-sqlite storage, and SessionProvider with Stack.Protected auth guards**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-08T03:49:31Z
- **Completed:** 2026-02-08T03:56:09Z
- **Tasks:** 2/2
- **Files modified:** 30 (23 created, 3 modified, 2 deleted, 2 config auto-generated)

## Accomplishments

- Converted mobile app from bare App.tsx to Expo Router file-based routing with 4 route groups
- Configured NativeWind v4.2 with Tailwind CSS v3.4.17 for className styling on React Native
- Created Supabase client with expo-sqlite localStorage polyfill for persistent auth sessions
- Built SessionProvider with onAuthStateChange subscription for reactive auth state
- Implemented Stack.Protected guards for resident, guard, admin, and pending_setup roles
- Created tab layouts: resident (5 tabs), guard (4 tabs), admin (4 tabs) with placeholder screens

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, convert to Expo Router, and configure NativeWind** - `b178e71` (feat)
2. **Task 2: Create Supabase client, SessionProvider, and role-based route structure** - `982831c` (feat)

## Files Created/Modified

- `packages/mobile/app/_layout.tsx` - Root layout with SessionProvider, QueryProvider, Stack.Protected role guards
- `packages/mobile/app/index.tsx` - Entry redirect based on session role
- `packages/mobile/app/(auth)/_layout.tsx` - Stack navigator for auth screens
- `packages/mobile/app/(auth)/sign-in.tsx` - Sign-in placeholder with NativeWind className
- `packages/mobile/app/(auth)/sign-up.tsx` - Sign-up placeholder
- `packages/mobile/app/(auth)/forgot-password.tsx` - Password recovery placeholder
- `packages/mobile/app/(auth)/onboarding.tsx` - Admin onboarding placeholder
- `packages/mobile/app/(resident)/_layout.tsx` - 5-tab resident navigator (Inicio, Visitantes, Pagos, Comunidad, Mas)
- `packages/mobile/app/(resident)/index.tsx` - Resident dashboard placeholder
- `packages/mobile/app/(guard)/_layout.tsx` - 4-tab guard navigator (Caseta, Visitantes, Patrulla, Incidentes)
- `packages/mobile/app/(guard)/index.tsx` - Guard dashboard placeholder
- `packages/mobile/app/(admin)/_layout.tsx` - 4-tab admin navigator (Resumen, Usuarios, Reportes, Config)
- `packages/mobile/app/(admin)/index.tsx` - Admin dashboard placeholder
- `packages/mobile/src/lib/supabase.ts` - Supabase client with expo-sqlite localStorage and AppState auto-refresh
- `packages/mobile/src/providers/SessionProvider.tsx` - Auth session context with getSession + onAuthStateChange
- `packages/mobile/src/providers/QueryProvider.tsx` - TanStack Query v5 provider (staleTime 60s, gcTime 300s)
- `packages/mobile/src/env.d.ts` - Type declarations for EXPO_PUBLIC env vars and process global
- `packages/mobile/babel.config.js` - Babel config with nativewind/babel preset and reanimated plugin
- `packages/mobile/metro.config.js` - Metro config with NativeWind and monorepo support
- `packages/mobile/tailwind.config.js` - Tailwind v3 config with nativewind/preset
- `packages/mobile/global.css` - Tailwind base/components/utilities directives
- `packages/mobile/nativewind-env.d.ts` - NativeWind type reference
- `packages/mobile/.env.example` - Template for Supabase env vars
- `packages/mobile/package.json` - Updated main to expo-router/entry, added all dependencies
- `packages/mobile/app.json` - Updated name/slug/scheme, added web bundler and plugins
- `packages/mobile/tsconfig.json` - Added @/* path alias and NativeWind type reference

## Decisions Made

1. **expo-sqlite localStorage over SecureStore/MMKV** - Official Supabase recommendation as of 2026. Simpler, no encryption key dance, no size limits. The `import 'expo-sqlite/localStorage/install'` polyfill must be the first import in the Supabase client file.

2. **Tailwind CSS v3.4.17 for NativeWind** - NativeWind v4.x requires Tailwind CSS v3, not v4. NativeWind v5 (preview) would use Tailwind v4 but is not stable.

3. **Custom env.d.ts instead of @types/node** - Expo handles process.env via babel transform. Adding @types/node would bring in unnecessary Node.js types that could mask React Native incompatibilities. A focused env.d.ts is cleaner.

4. **Emoji tab icons as placeholders** - Tab icons use emoji text for now. Proper icon library (lucide-react-native or similar) will be added in a future plan to avoid premature dependency decisions.

5. **No react-native-worklets plugin in babel** - Reanimated v4 (shipped with Expo SDK 54) includes worklets internally. Adding the separate plugin causes build failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added process type declaration for env vars**
- **Found during:** Task 2 (Supabase client creation)
- **Issue:** TypeScript could not find `process` global - Expo SDK 54 base tsconfig does not include @types/node
- **Fix:** Created `packages/mobile/src/env.d.ts` with typed `process` declaration for EXPO_PUBLIC env vars
- **Files modified:** packages/mobile/src/env.d.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 982831c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for TypeScript compilation. No scope creep.

## Issues Encountered

- **Tailwind CSS v4 peer dependency conflict:** The root monorepo had tailwindcss v4 installed. NativeWind's `react-native-css-interop` peer dependency requires `tailwindcss ~3`. Resolved by installing `tailwindcss@3.4.17` as a devDependency specifically in the mobile package, which takes precedence via pnpm's package resolution.

## User Setup Required

To run the mobile app, create `packages/mobile/.env` with:
```
EXPO_PUBLIC_SUPABASE_URL=https://qbaiviuluiqdbaymgxhq.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Next Phase Readiness

- Mobile app shell is complete and ready for auth screen implementation (Plan 09-04)
- All route groups have placeholder screens that can be replaced with real implementations
- SessionProvider and Supabase client are functional and ready for auth flows
- Tab layouts define the navigation structure for phases 10-16

---
*Phase: 09-auth-shared-infrastructure*
*Completed: 2026-02-08*
