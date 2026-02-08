# Phase 9: Auth & Shared Infrastructure - Research

**Researched:** 2026-02-07
**Domain:** Cross-platform authentication (Expo + Next.js) consuming Supabase Auth backend, shared infrastructure (typed clients, query hooks, validators)
**Confidence:** HIGH (verified via official Supabase docs, Expo docs, NativeWind docs, npm registries, live database inspection)

## Summary

This research covers the 7 specific topics that the existing project research (STACK.md, ARCHITECTURE.md, PITFALLS.md) does NOT cover in sufficient detail for planning. The existing research already established high-level stack choices -- this research provides the exact implementation patterns, file structures, configuration steps, and code examples needed to plan Phase 9.

Key findings:
1. **Expo Router file structure** for 3-role mobile: Use `(auth)`, `(resident)`, `(guard)`, `(admin)` route groups with `Stack.Protected` guards in root `_layout.tsx`. Tabs.Protected can conditionally show/hide individual tab screens within a group.
2. **@supabase/ssr for Next.js 16**: Use `createBrowserClient` (client) + `createServerClient` with cookies (server) + middleware calling `getClaims()` for JWT validation. The docs now recommend "publishable key" over "anon key" terminology.
3. **NativeWind for Expo SDK 54**: Use NativeWind **v4.2.0+** (NOT v4.1 -- earlier versions break with SDK 54's Reanimated v4). Requires Tailwind CSS **v3.4.17** (NOT v4). NativeWind v5 exists but is preview/experimental.
4. **expo-sqlite as auth storage**: The official Supabase recommendation for Expo is now `import 'expo-sqlite/localStorage/install'`, NOT SecureStore or MMKV. This replaces the MMKV pattern from ARCHITECTURE.md.
5. **Backend auth flows are fully built**: `handle_new_user` trigger handles all 3 flows (invited resident, invited guard, new admin with `pending_setup`). `complete_admin_onboarding` RPC creates org + community + role assignment.

**Primary recommendation:** Follow the official Supabase patterns exactly -- expo-sqlite for mobile auth storage, @supabase/ssr with getClaims() for web, and build the shared package as pure TypeScript with zero platform dependencies.

---

## Standard Stack

The stack was established in STACK.md. This section covers ONLY version corrections and new findings.

### Version Corrections from STACK.md

| STACK.md Said | Corrected To | Why |
|---------------|--------------|-----|
| NativeWind ^4.1 (4.2.1 latest) | NativeWind ^4.2.0 minimum | v4.1.x is incompatible with Expo SDK 54's Reanimated v4. v4.2.0+ includes the fix. |
| react-native-reanimated ~3.17.4 | react-native-reanimated ~4.1.1 | Expo SDK 54 ships Reanimated v4, NOT v3. NativeWind v4.2+ is compatible with both. |
| MMKV + SecureStore for auth storage | expo-sqlite localStorage | Supabase official docs now recommend `expo-sqlite/localStorage/install`. Simpler, no size limits, no encryption key dance. |
| Tailwind CSS ^4 for NativeWind | Tailwind CSS ^3.4.17 for NativeWind | NativeWind v4.x requires Tailwind CSS v3. Only NativeWind v5 (preview) uses Tailwind v4. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase docs now use "publishable key" terminology. Both work, but new projects should follow current naming. |

**Confidence:** HIGH -- NativeWind v4.2 + Reanimated v4 compatibility verified via [NativeWind Discussion #1604](https://github.com/nativewind/nativewind/discussions/1604) and [NativeWind Installation Docs](https://www.nativewind.dev/docs/getting-started/installation). expo-sqlite verified via [Supabase Expo Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) and [Expo Supabase Guide](https://docs.expo.dev/guides/using-supabase/).

### New Libraries for This Phase

| Library | Version | Purpose | Install Location |
|---------|---------|---------|------------------|
| `@supabase/ssr` | ^0.8.0 | Next.js cookie-based auth | `@upoe/admin` |
| `expo-sqlite` | (bundled SDK 54) | Auth session storage via localStorage polyfill | `@upoe/mobile` |
| `zod` | ^4.3 | Shared validation schemas | `@upoe/shared` |
| `@lukemorales/query-key-factory` | latest | Typesafe query key management | `@upoe/shared` |
| `supazod` | ^4.1.0 | Generate Zod schemas from Supabase types | `@upoe/shared` (devDep) |

**Confidence:** HIGH -- versions verified on npm.

---

## Architecture Patterns

### Pattern 1: Expo Router File Structure for 3-Role Mobile App

**What:** File-based routing with route groups per role, protected by `Stack.Protected` guards in the root layout.
**Confidence:** HIGH -- verified via [Expo Router Protected Routes](https://docs.expo.dev/router/advanced/protected/) and [Common Navigation Patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/)

**Critical prerequisite:** The mobile app must be converted from the current `App.tsx` entry point to Expo Router's `app/` directory structure. The current `packages/mobile/App.tsx` uses basic React Native -- it does NOT use Expo Router yet.

**File structure:**

```
packages/mobile/
  app/                          # Expo Router file-based routes
    _layout.tsx                 # Root: providers + Stack.Protected auth guards
    index.tsx                   # Entry redirect (to auth or role home)

    (auth)/                     # Unauthenticated screens (no tabs)
      _layout.tsx               # Stack layout for auth flow
      sign-in.tsx
      sign-up.tsx
      forgot-password.tsx
      onboarding.tsx            # Admin onboarding (org + community creation)

    (resident)/                 # Resident tab group
      _layout.tsx               # Tabs: home, visitors, payments, community, more
      index.tsx                 # Dashboard
      visitors/
        index.tsx               # Invitation list
        create.tsx              # Create invitation
        [id].tsx                # Invitation detail / QR
      payments/
        index.tsx               # Balance + payment list
        [id].tsx                # Payment detail
      community/
        index.tsx               # Social wall / announcements
      more/
        index.tsx               # Settings menu
        profile.tsx

    (guard)/                    # Guard tab group
      _layout.tsx               # Tabs: gate, visitors, patrol, incidents
      index.tsx                 # Gate operations dashboard
      gate/
        index.tsx               # Active gate view
        scan.tsx                # QR scanner
      patrol/
        index.tsx               # Active patrol
      incidents/
        index.tsx               # Incident list
        report.tsx              # New incident

    (admin)/                    # Mobile admin (community_admin, manager)
      _layout.tsx               # Tabs: overview, users, reports, settings
      index.tsx                 # Community overview
      users/
        index.tsx
      settings/
        index.tsx

  src/
    components/                 # React Native components
      ui/                       # Primitives (Button, Card, Input)
      common/                   # Header, EmptyState, LoadingScreen
    hooks/
      useAuth.ts                # Auth state and methods
      useRole.ts                # Role-based utility hook
    providers/
      SessionProvider.tsx        # Auth session context
      QueryProvider.tsx          # TanStack Query setup
    lib/
      supabase.ts               # Mobile Supabase client (expo-sqlite)
    stores/
      authStore.ts              # Zustand: session, role, community
      uiStore.ts                # Zustand: theme, filters
```

**Root layout implementation:**

```typescript
// packages/mobile/app/_layout.tsx
import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { SYSTEM_ROLES } from '@upoe/shared';

function RootNavigator() {
  const { session, isLoading } = useSession();
  const role = session?.user?.app_metadata?.role;

  if (isLoading) return null; // SplashScreen stays visible

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Unauthenticated: show auth screens */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Resident role */}
      <Stack.Protected guard={role === SYSTEM_ROLES.RESIDENT}>
        <Stack.Screen name="(resident)" />
      </Stack.Protected>

      {/* Guard role */}
      <Stack.Protected guard={role === SYSTEM_ROLES.GUARD}>
        <Stack.Screen name="(guard)" />
      </Stack.Protected>

      {/* Admin roles (community_admin + manager) on mobile */}
      <Stack.Protected guard={
        role === SYSTEM_ROLES.COMMUNITY_ADMIN ||
        role === SYSTEM_ROLES.MANAGER
      }>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>

      {/* Pending setup: show onboarding (within auth group) */}
      <Stack.Protected guard={role === 'pending_setup'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <QueryProvider>
        <RootNavigator />
      </QueryProvider>
    </SessionProvider>
  );
}
```

**Key behaviors verified from official docs:**
- When a screen's guard changes from true to false, all history entries for those routes are removed and the user is redirected automatically
- Protected routes work with deep links -- if an unauthenticated user deep links to a protected screen, they redirect to the anchor route
- `Stack.Protected` works with Stack, Tabs, and Drawer navigators
- Available since SDK 53 (current is SDK 54)

---

### Pattern 2: @supabase/ssr Setup for Next.js 16 App Router

**What:** Cookie-based auth with three client types (browser, server, middleware) and getClaims() for JWT validation.
**Confidence:** HIGH -- verified via [Supabase Next.js SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs) and [Creating a Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

**Four files to create:**

```typescript
// 1. packages/admin/src/lib/supabase/client.ts (Browser Client)
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@upoe/shared';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

```typescript
// 2. packages/admin/src/lib/supabase/server.ts (Server Client)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@upoe/shared';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (read-only context).
            // Can be ignored if middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

```typescript
// 3. packages/admin/src/lib/supabase/proxy.ts (updateSession for middleware)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CRITICAL: Always getClaims(), never getSession()
  // getClaims() validates JWT signature against JWKS
  const { data: { claims } } = await supabase.auth.getClaims();

  // Redirect unauthenticated users to sign-in
  const isAuthRoute = request.nextUrl.pathname.startsWith('/sign-in') ||
                      request.nextUrl.pathname.startsWith('/sign-up') ||
                      request.nextUrl.pathname.startsWith('/auth/callback');

  if (!claims && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (claims && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

```typescript
// 4. packages/admin/src/middleware.ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Auth callback route handler:**

```typescript
// packages/admin/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed
  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_error`);
}
```

**Security hierarchy (from Supabase docs):**
- `getClaims()` -- Validates JWT signature locally via JWKS. Fast. Use for page protection and reads. Does NOT check if user was banned/logged out server-side.
- `getUser()` -- Validates with Auth server on every call. Slower. Use for sensitive mutations (financial, role changes). Catches banned users.
- `getSession()` -- NEVER use on server. Reads JWT from cookies without validation. Spoofable.

---

### Pattern 3: expo-sqlite as Auth Storage Adapter (Replaces MMKV Pattern)

**What:** Use expo-sqlite's localStorage polyfill as the Supabase auth storage adapter instead of SecureStore or MMKV.
**Confidence:** HIGH -- this is the current official Supabase recommendation, verified via [Supabase Expo Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) and [Expo Supabase Guide](https://docs.expo.dev/guides/using-supabase/)

**Why this replaces the MMKV pattern from ARCHITECTURE.md:**
- Supabase's official tutorial now uses `expo-sqlite/localStorage/install` as the storage adapter
- No encryption key management needed (expo-sqlite handles storage)
- No 2KB SecureStore limit (the problem MMKV was solving)
- One less native dependency (no react-native-mmkv, no NitroModules)
- Bundled with Expo SDK 54 -- no additional installation required beyond `expo-sqlite`

**Implementation:**

```typescript
// packages/mobile/src/lib/supabase.ts
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '@upoe/shared';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,        // expo-sqlite localStorage polyfill
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,    // CRITICAL: false for React Native
  },
});

// Auto-refresh management: start/stop based on app foreground state
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

**Installation:**

```bash
npx expo install expo-sqlite
```

**Important:** The `import 'expo-sqlite/localStorage/install'` MUST be called before creating the Supabase client. It installs a global `localStorage` polyfill that the Supabase client's default storage adapter recognizes.

---

### Pattern 4: NativeWind v4.2 Setup for Expo SDK 54

**What:** Configure NativeWind v4.2+ with Tailwind CSS v3 for Expo SDK 54.
**Confidence:** HIGH -- verified via [NativeWind Installation Docs](https://www.nativewind.dev/docs/getting-started/installation), [NativeWind Discussion #1604](https://github.com/nativewind/nativewind/discussions/1604), and [SDK 54 Compatibility Article](https://medium.com/@matthitachi/nativewind-styling-not-working-with-expo-sdk-54-54488c07c20d)

**Critical version requirements:**
- NativeWind: `^4.2.0` (NOT 4.1.x -- breaks with Reanimated v4)
- Tailwind CSS: `^3.4.17` (NOT v4 -- NativeWind v4.x only supports Tailwind v3)
- react-native-reanimated: `~4.1.1` (shipped with Expo SDK 54, do NOT downgrade to v3)

**Note about Tailwind version mismatch:** The admin dashboard uses Tailwind CSS v4. The mobile app uses Tailwind CSS v3 (via NativeWind v4.2). This is acceptable because:
- NativeWind compiles Tailwind classes to React Native StyleSheet at build time
- The utility class names are the same between v3 and v4 for the vast majority of cases
- The output format is completely different (CSS vs StyleSheet) so there is no shared build config
- NativeWind v5 (preview) supports Tailwind v4 but is NOT production-ready

**Installation:**

```bash
# In packages/mobile
npx expo install nativewind react-native-reanimated react-native-safe-area-context
npm install --save-dev tailwindcss@3.4.17
```

**Configuration files:**

```javascript
// packages/mobile/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

```javascript
// packages/mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

```javascript
// packages/mobile/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

```css
/* packages/mobile/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```typescript
// packages/mobile/nativewind-env.d.ts
/// <reference types="nativewind/types" />
```

```json
// app.json addition
{
  "expo": {
    "web": {
      "bundler": "metro"
    }
  }
}
```

**Import global.css in root layout:**

```typescript
// packages/mobile/app/_layout.tsx
import '../global.css';
// ... rest of layout
```

**Critical pitfall:** Do NOT add `react-native-worklets/plugin` to babel.config.js. Reanimated v4 already includes the worklets plugin internally. Having both causes a duplicate plugin compilation error.

---

### Pattern 5: Zod v4 Schemas for Supabase Table Types

**What:** Use Zod v4 for form validation schemas that correspond to Supabase table types. Use supazod to auto-generate base schemas, then create manual form schemas for specific use cases.
**Confidence:** HIGH for Zod v4 API (verified via [Zod v4 docs](https://zod.dev/v4)), MEDIUM for supazod Zod v4 support (verified via [supazod releases](https://github.com/dohooo/supazod/releases) showing v4.1.0 with Zod 4 support)

**Two-layer approach:**

Layer 1: Auto-generated schemas via supazod (base validation matching DB constraints)
Layer 2: Hand-written form schemas (UI-specific validation, Spanish error messages)

```bash
# Generate base schemas from database types
pnpm supabase gen types typescript --project-id qbaiviuluiqdbaymgxhq > packages/shared/src/types/database.types.ts
pnpm supazod -i packages/shared/src/types/database.types.ts -o packages/shared/src/validators/generated.ts --inline-types
```

**Hand-written form schemas (what the planner should create):**

```typescript
// packages/shared/src/validators/auth.ts
import { z } from 'zod';

// Sign-in form
export const signInSchema = z.object({
  email: z.email({ error: 'Email invalido' }),
  password: z.string().min(8, { error: 'Minimo 8 caracteres' }),
});
export type SignInForm = z.infer<typeof signInSchema>;

// Sign-up form (for invited resident/guard)
export const signUpSchema = z.object({
  email: z.email({ error: 'Email invalido' }),
  password: z.string().min(8, { error: 'Minimo 8 caracteres' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  error: 'Las contrasenas no coinciden',
  path: ['confirmPassword'],
});
export type SignUpForm = z.infer<typeof signUpSchema>;

// Admin onboarding form
export const adminOnboardingSchema = z.object({
  orgName: z.string().min(1, { error: 'Nombre de organizacion requerido' }),
  communityName: z.string().min(1, { error: 'Nombre de comunidad requerido' }),
  communityAddress: z.string().optional(),
  communityCity: z.string().optional(),
  communityState: z.string().optional(),
  communityZip: z.string().optional(),
  firstName: z.string().optional(),
  paternalSurname: z.string().optional(),
});
export type AdminOnboardingForm = z.infer<typeof adminOnboardingSchema>;

// Password reset
export const resetPasswordSchema = z.object({
  email: z.email({ error: 'Email invalido' }),
});
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
```

**Zod v4 key API changes from v3:**
- Error customization: Use `{ error: "message" }` instead of `{ message: "message" }`
- Top-level validators: `z.email()`, `z.url()`, `z.uuid()` (tree-shakable, preferred over `z.string().email()`)
- Refinements can chain: `z.string().refine(...).min(5)` works in v4 (was broken in v3)
- Import: `import { z } from 'zod'` (same as v3, no subpath needed)
- Type inference: `z.infer<typeof schema>` works identically to v3
- Performance: 14.7x faster string parsing, 57% smaller bundle
- i18n support: `z.config(z.locales.es())` -- Spanish locale available

---

### Pattern 6: Query Key Factory with @lukemorales/query-key-factory

**What:** Use the query-key-factory library for typesafe, standardized query key management across both apps.
**Confidence:** HIGH -- verified via [query-key-factory GitHub](https://github.com/lukemorales/query-key-factory), recommended in [TanStack Query Community Resources](https://tanstack.com/query/v5/docs/community-resources)

**Why use a library instead of plain objects (as shown in ARCHITECTURE.md):**
- Typed `_def` property for prefix-based invalidation
- Auto-generates `queryKey` arrays from factory function calls
- Can bundle `queryFn` with keys (query options pattern)
- Prevents typo bugs in string-based keys

**Implementation:**

```typescript
// packages/shared/src/queries/keys.ts
import { createQueryKeys, mergeQueryKeys } from '@lukemorales/query-key-factory';

export const residents = createQueryKeys('residents', {
  all: null,
  list: (communityId?: string) => [{ communityId }],
  detail: (id: string) => [id],
  byUnit: (unitId: string) => [{ unitId }],
});

export const visitors = createQueryKeys('visitors', {
  all: null,
  list: (filters?: Record<string, unknown>) => [{ filters }],
  active: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
});

export const payments = createQueryKeys('payments', {
  all: null,
  byUnit: (unitId: string) => [{ unitId }],
  balance: (unitId: string) => [{ unitId }],
});

export const accessLogs = createQueryKeys('access-logs', {
  all: null,
  recent: (accessPointId: string) => [{ accessPointId }],
  today: (communityId: string) => [{ communityId }],
});

export const amenities = createQueryKeys('amenities', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  reservations: (amenityId: string, date?: string) => [{ amenityId, date }],
});

export const notifications = createQueryKeys('notifications', {
  all: null,
  unread: (userId: string) => [{ userId }],
});

export const kpis = createQueryKeys('kpis', {
  all: null,
  summary: (communityId: string, period: string) => [{ communityId, period }],
});

// Merge all key factories into a single queryable object
export const queryKeys = mergeQueryKeys(
  residents,
  visitors,
  payments,
  accessLogs,
  amenities,
  notifications,
  kpis,
);
```

**Usage in hooks:**

```typescript
// Querying
const { data } = useQuery({
  queryKey: queryKeys.residents.list(communityId).queryKey,
  queryFn: () => fetchResidents(communityId),
});

// Invalidation (prefix-based)
queryClient.invalidateQueries({
  queryKey: queryKeys.residents._def,  // Invalidates ALL resident queries
});

// Specific invalidation
queryClient.invalidateQueries({
  queryKey: queryKeys.residents.detail(id).queryKey,
});
```

---

### Pattern 7: Admin Invite Flow

**What:** Admin invites residents/guards via `supabase.auth.admin.inviteUserByEmail()` from a Next.js Server Action, using the service role key.
**Confidence:** HIGH -- verified via [Supabase Admin API](https://supabase.com/docs/reference/javascript/admin-api) and [inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), plus live DB inspection of `handle_new_user` trigger

**Complete invite-to-signup flow:**

1. Admin (on web dashboard) clicks "Invite Resident" and enters email
2. Server Action creates a Supabase admin client with service_role key
3. Admin first creates the resident/guard record in the database (with email, community_id, no user_id)
4. Admin calls `inviteUserByEmail()` which sends an invite email
5. Invited user clicks the link, lands on the signup page
6. User sets their password -- Supabase creates an auth.users entry
7. The `handle_new_user` trigger fires, finds the pre-existing resident/guard record by email
8. Trigger links the auth user to the resident/guard record and sets app_metadata

**Server Action implementation:**

```typescript
// packages/admin/src/app/(dashboard)/users/actions.ts
'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { Database } from '@upoe/shared';

// Admin client with service_role key -- NEVER expose to browser
function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // NOT NEXT_PUBLIC_ prefixed
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function inviteResident(formData: {
  email: string;
  firstName: string;
  paternalSurname: string;
  unitId: string;
  communityId: string;
}) {
  // 1. Verify the caller is an admin
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const role = user.app_metadata?.role;
  if (role !== 'community_admin' && role !== 'manager' && role !== 'super_admin') {
    throw new Error('Insufficient permissions');
  }

  // 2. Create resident record (with email, without user_id)
  const { data: resident, error: residentError } = await supabase
    .from('residents')
    .insert({
      email: formData.email,
      first_name: formData.firstName,
      paternal_surname: formData.paternalSurname,
      community_id: formData.communityId,
      onboarding_status: 'invited',
      invited_by: user.id,
    })
    .select()
    .single();

  if (residentError) throw residentError;

  // 3. Create occupancy linking resident to unit
  await supabase.from('occupancies').insert({
    resident_id: resident.id,
    unit_id: formData.unitId,
    community_id: formData.communityId,
    type: 'owner', // or 'tenant'
  });

  // 4. Send invite email via admin API
  const adminClient = createAdminClient();
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    formData.email,
    {
      data: {
        invited_as: 'resident',
        community_id: formData.communityId,
        resident_id: resident.id,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    }
  );

  if (inviteError) throw inviteError;

  return { success: true, residentId: resident.id };
}
```

**Critical notes:**
- `SUPABASE_SERVICE_ROLE_KEY` must NOT be prefixed with `NEXT_PUBLIC_` -- it stays server-side only
- `inviteUserByEmail()` does NOT support PKCE (the admin's browser differs from the invited user's browser)
- The `data` option in inviteUserByEmail sets `raw_user_meta_data` (NOT `raw_app_meta_data`) -- the trigger handles app_metadata
- The invited user's email template can be customized in Supabase Dashboard > Auth > Email Templates

---

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query key management | Manual string arrays | `@lukemorales/query-key-factory` | Typo-proof, typed, prefix invalidation |
| Zod schema generation | Manual schema per table | `supazod` (auto-generate) + manual form schemas | 116 tables = too many to hand-write |
| JWT validation in middleware | Custom JWT verification | `supabase.auth.getClaims()` | Handles JWKS rotation, signature verification |
| Session persistence on mobile | Custom storage adapter | `expo-sqlite/localStorage/install` | Official Supabase recommendation, zero config |
| Cookie-based auth for Next.js | Custom cookie handling | `@supabase/ssr` createServerClient | Handles token refresh, race conditions |
| Role-based route protection (mobile) | Manual redirect logic | `Stack.Protected` guards | Declarative, handles deep links automatically |
| Form validation bridge | Manual RHF + Zod wiring | `@hookform/resolvers` v5.2 | Auto-detects Zod v3 vs v4, zero config |

**Key insight:** The existing Supabase backend already handles the three auth flows via `handle_new_user` trigger and `complete_admin_onboarding` RPC. The frontend needs to call the right methods at the right time -- NOT reimplement auth logic.

---

## Common Pitfalls

These are SPECIFIC to Phase 9 implementation. General pitfalls are documented in PITFALLS.md.

### Pitfall 1: NativeWind v4.1 with Expo SDK 54

**What goes wrong:** Using NativeWind 4.1.x (as stated in STACK.md) with Expo SDK 54 breaks because SDK 54 ships Reanimated v4, and NativeWind 4.1 only supports Reanimated v3.
**How to avoid:** Use NativeWind `^4.2.0`. Do NOT downgrade Reanimated -- Expo SDK manages its own Reanimated version. Do NOT add `react-native-worklets/plugin` separately.
**Warning signs:** Build errors mentioning NitroModules, Reanimated, or worklets plugin conflicts.

### Pitfall 2: Tailwind CSS v4 for NativeWind

**What goes wrong:** The admin dashboard uses Tailwind CSS v4. Developers assume NativeWind should also use Tailwind v4. NativeWind v4.x requires Tailwind CSS v3.
**How to avoid:** Install `tailwindcss@3.4.17` in `@upoe/mobile`. The mobile and admin packages use DIFFERENT Tailwind versions. This is fine -- they have separate build pipelines.
**Warning signs:** NativeWind compilation errors, undefined utility classes, empty styles.

### Pitfall 3: expo-sqlite Import Order

**What goes wrong:** The `import 'expo-sqlite/localStorage/install'` statement is placed AFTER the Supabase client creation. The localStorage polyfill is not available when `createClient` runs, so sessions are not persisted.
**How to avoid:** The expo-sqlite import MUST be the first import in the supabase.ts file, before `createClient`.
**Warning signs:** Sessions work during the session but are lost on app restart.

### Pitfall 4: Missing Expo Router Conversion

**What goes wrong:** The current mobile app uses `App.tsx` with basic React Native. Developers try to add Expo Router without fully converting the app entry point.
**How to avoid:** Remove `App.tsx` and `index.ts`. Add `"main": "expo-router/entry"` to package.json. Create the `app/` directory with `_layout.tsx`. Update app.json with `"scheme": "upoe"`.
**Warning signs:** App launches but shows blank screen, or navigation does not work.

### Pitfall 5: pending_setup Role Not Handled

**What goes wrong:** The `handle_new_user` trigger sets `role: 'pending_setup'` for new admin signups. If the frontend only checks for `resident`, `guard`, and `community_admin` roles, pending_setup users see a blank screen.
**How to avoid:** Add a `Stack.Protected guard={role === 'pending_setup'}` that routes to the onboarding screen. After `complete_admin_onboarding` RPC succeeds, the role changes to `community_admin` and the guard re-evaluates.
**Warning signs:** New admin signs up successfully but sees no navigation.

### Pitfall 6: Service Role Key in Client Bundle

**What goes wrong:** The `SUPABASE_SERVICE_ROLE_KEY` environment variable is prefixed with `NEXT_PUBLIC_`, exposing it in the client JavaScript bundle. This bypasses ALL RLS policies.
**How to avoid:** Store as `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix). Only access in Server Actions, Route Handlers, or server-side code. Never import the admin client in a `'use client'` file.
**Warning signs:** Service role key visible in browser DevTools network tab or source.

---

## Code Examples

### SessionProvider for Mobile

```typescript
// packages/mobile/src/providers/SessionProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  isLoading: true,
});

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
}
```

### TanStack Query Provider

```typescript
// packages/mobile/src/providers/QueryProvider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,     // 1 minute
            gcTime: 5 * 60 * 1000,    // 5 minutes (was cacheTime in v4)
            retry: 2,
            refetchOnWindowFocus: false, // Not relevant for mobile
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Sign-In Screen (Mobile)

```typescript
// packages/mobile/app/(auth)/sign-in.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { signInSchema } from '@upoe/shared';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      Alert.alert('Error', result.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    }
    // Session state change triggers Stack.Protected re-evaluation
  }

  return (
    <View className="flex-1 justify-center px-6">
      <Text className="text-3xl font-bold mb-8">Iniciar Sesion</Text>
      <TextInput
        className="border border-gray-300 rounded-lg p-4 mb-4"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-lg p-4 mb-4"
        placeholder="Contrasena"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        className="bg-indigo-600 rounded-lg p-4 items-center"
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text className="text-white font-semibold text-lg">
          {loading ? 'Cargando...' : 'Iniciar Sesion'}
        </Text>
      </Pressable>
    </View>
  );
}
```

### File Upload Utility (Shared Pattern)

```typescript
// packages/mobile/src/lib/upload.ts
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { STORAGE_BUCKETS, getStoragePath } from '@upoe/shared';

export async function pickAndUploadImage(
  bucket: string,
  communityId: string,
  path: string
): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  const filePath = getStoragePath(bucket as any, communityId, `${path}.${ext}`);

  // Convert URI to ArrayBuffer (correct pattern for React Native)
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, arrayBuffer, {
      contentType: asset.mimeType ?? `image/${ext}`,
      upsert: true,
    });

  if (error) throw error;
  return data.path;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SecureStore / MMKV for Supabase auth | `expo-sqlite/localStorage/install` | 2025 (Supabase docs update) | Simpler setup, no size limits, officially recommended |
| `getSession()` for server auth | `getClaims()` for fast + `getUser()` for sensitive | 2025 (getClaims added) | getClaims validates JWT locally via JWKS -- fast and secure |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 (deprecated) | SSR package handles App Router, middleware, cookies |
| Manual redirect auth guards | `Stack.Protected` guards | SDK 53 (2025) | Declarative, handles deep links, removes history on guard change |
| Zod v3 `{ message }` | Zod v4 `{ error }` | 2025 (Zod v4 release) | Simplified error API, 14.7x faster, 57% smaller |
| NativeWind v4.1 | NativeWind v4.2+ for SDK 54 | 2026 (SDK 54 release) | v4.2 adds Reanimated v4 compatibility |
| `anon_key` env var naming | `publishable_key` env var naming | 2025 (Supabase terminology) | Both work, new projects should use PUBLISHABLE_KEY |

---

## Backend Auth Infrastructure (Already Built)

Understanding what exists is critical for planning the frontend.

### handle_new_user Trigger (on auth.users INSERT)

Three flows handled automatically:

**Flow 1 -- Invited Resident:**
- Matches `NEW.email` against `residents` table where `user_id IS NULL` and `onboarding_status = 'invited'`
- Links auth user to resident record (sets `user_id`, changes status to `registered`)
- Assigns `resident` role in `user_roles` table
- Sets `app_metadata`: `{ community_id, role: 'resident', resident_id }`

**Flow 2 -- Invited Guard:**
- Matches `NEW.email` against `guards` table where `user_id IS NULL`
- Links auth user to guard record
- Assigns `guard` role in `user_roles` table
- Sets `app_metadata`: `{ community_id, role: 'guard', guard_id }`

**Flow 3 -- New Admin (no pre-existing record):**
- No match found -- sets `app_metadata`: `{ role: 'pending_setup', onboarding_complete: false }`
- User must call `complete_admin_onboarding` RPC to create org + community

### complete_admin_onboarding RPC

- Validates user has `pending_setup` role
- Creates organization, community, community_settings
- Assigns `community_admin` role in `user_roles`
- Updates `app_metadata`: `{ role: 'community_admin', community_id, organization_id, onboarding_complete: true }`
- Returns `{ organization_id, community_id, role }`

### Implications for Frontend

- Frontend does NOT need to set app_metadata -- the backend handles it
- Frontend DOES need to handle the `pending_setup` role state (show onboarding screen)
- Frontend DOES need to call `complete_admin_onboarding` RPC for new admin signup flow
- Frontend DOES need to create resident/guard records BEFORE sending the invite email
- After `complete_admin_onboarding` succeeds, the session's app_metadata is stale -- must call `supabase.auth.refreshSession()` to get updated claims

---

## Open Questions

Things that could not be fully resolved:

1. **getClaims() availability in @supabase/ssr**
   - What we know: Supabase docs now recommend `getClaims()` over `getUser()` for page protection. It validates JWT signature locally via JWKS.
   - What is unclear: The exact `@supabase/ssr` version that added `getClaims()` support. Earlier examples in the wild still show `getUser()`.
   - Recommendation: Use `getClaims()` in middleware and server components. If it throws "method not found", upgrade `@supabase/supabase-js` to `^2.95` and `@supabase/ssr` to `^0.8.0`. Fall back to `getUser()` if needed.

2. **NativeWind v5 readiness**
   - What we know: NativeWind v5 supports Tailwind CSS v4 (matching admin dashboard). It's marked as `@preview` on npm.
   - What is unclear: Whether v5 is stable enough for production use. The NativeWind maintainer encourages testing but hasn't declared it stable.
   - Recommendation: Start with NativeWind v4.2 + Tailwind v3 (stable, proven). Plan a potential migration to v5 once it's stable. The class names are compatible -- migration would be config-only.

3. **supazod Zod v4 output quality**
   - What we know: supazod v4.1.0 claims Zod v4 support. It generates schemas for tables, views, enums, and functions.
   - What is unclear: Whether the generated schemas use Zod v4's new API (e.g., `z.email()` vs `z.string().email()`).
   - Recommendation: Generate schemas with supazod, then test import and validation. If output uses v3 syntax, Zod v4 is backwards-compatible -- it still works. Hand-written form schemas should use v4 syntax.

---

## Sources

### Primary (HIGH confidence)
- [Supabase Expo React Native Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) -- expo-sqlite localStorage pattern
- [Expo Supabase Guide](https://docs.expo.dev/guides/using-supabase/) -- expo-sqlite installation, client setup
- [Supabase Next.js SSR Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- @supabase/ssr, middleware, getClaims
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- browser + server client patterns
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/admin-api) -- service_role key, inviteUserByEmail
- [Expo Router Protected Routes](https://docs.expo.dev/router/advanced/protected/) -- Stack.Protected API
- [Expo Router Common Navigation Patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/) -- tabs + protected routes
- [NativeWind Installation](https://www.nativewind.dev/docs/getting-started/installation) -- v4 setup steps
- [Zod v4 Release Notes](https://zod.dev/v4) -- breaking changes, new API
- [TanStack Query Key Docs](https://tanstack.com/query/v5/docs/react/guides/query-keys) -- key structure
- Live database inspection: `handle_new_user` trigger and `complete_admin_onboarding` function definitions

### Secondary (MEDIUM confidence)
- [NativeWind Discussion #1604](https://github.com/nativewind/nativewind/discussions/1604) -- NativeWind v4/v5 + SDK 54 compatibility
- [query-key-factory GitHub](https://github.com/lukemorales/query-key-factory) -- library API and patterns
- [supazod GitHub](https://github.com/dohooo/supazod) -- Zod schema generation from Supabase types
- [Stack.Protected Role-Based Routing](https://dev.to/aaronksaunders/simplifying-auth-and-role-based-routing-with-stackprotected-in-expo-router-592m) -- multi-role example
- [Expo SDK 54 + NativeWind Fix](https://medium.com/@matthitachi/nativewind-styling-not-working-with-expo-sdk-54-54488c07c20d) -- compatibility issue details

### Tertiary (LOW confidence)
- NativeWind v5 stability -- maintainer encourages testing but no stable release yet
- supazod Zod v4 output quality -- version claims support but not independently verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm and official docs
- Architecture patterns (Expo Router): HIGH -- verified via official Expo docs, SDK 53+ feature
- Architecture patterns (@supabase/ssr): HIGH -- verified via official Supabase docs
- Architecture patterns (NativeWind): HIGH -- version fix verified via GitHub discussions and installation docs
- Architecture patterns (expo-sqlite): HIGH -- verified via official Supabase tutorial and Expo guide
- Pitfalls: HIGH -- derived from verified patterns and known issues
- Backend auth infrastructure: HIGH -- inspected live database function definitions
- Open questions: Clearly flagged with confidence levels

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days -- stable domain, but NativeWind v5 status may change)
