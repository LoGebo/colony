# Frontend Pitfalls: Expo + Next.js Consuming Supabase Backend

**Project:** UPOE Property Management SaaS -- Frontend Applications
**Domain:** React Native (Expo 54) mobile app + Next.js 16 admin dashboard consuming existing Supabase backend (116 tables, 399 RLS policies)
**Researched:** 2026-02-06
**Confidence:** HIGH (verified against official Supabase docs, Expo docs, Next.js docs, GitHub issues)

---

## Critical Pitfalls

Mistakes that cause security breaches, broken auth, or architectural rewrites.

### Pitfall 1: Using getSession() Instead of getClaims()/getUser() on the Server

**What goes wrong:**
Server-side code in Next.js (Server Components, Server Actions, Route Handlers) uses `supabase.auth.getSession()` to check authentication. The session data comes directly from cookies and is **not verified** against the Supabase Auth server. An attacker can forge or tamper with the JWT in the cookie, and `getSession()` will trust it.

**Why it happens:**
- Older tutorials and examples use `getSession()` everywhere
- `getSession()` is faster (no network call) so it feels like an optimization
- The warning was only recently emphasized in docs with the introduction of `getClaims()`
- Developers confuse "having a session" with "having a verified session"

**Consequences:**
- Attackers can spoof authenticated sessions by crafting valid-looking JWTs
- Authorization checks based on unverified claims (role, community_id) can be bypassed
- With 6 roles (super_admin through provider), a spoofed JWT could escalate privileges

**Warning signs:**
- Console warnings: "Using the user object as returned from supabase.auth.getSession() could be insecure"
- Server code calling `getSession()` and extracting user data from it
- No `getClaims()` or `getUser()` calls in middleware or server components

**How to avoid:**

```typescript
// WRONG: Trusts unverified cookie data
export async function ServerComponent() {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id; // SPOOFABLE
}

// RIGHT: Verifies JWT signature against JWKS
export async function ServerComponent() {
  const supabase = await createServerClient();
  const { data: { claims }, error } = await supabase.auth.getClaims();
  if (error || !claims) redirect('/login');
  const userId = claims.sub; // Cryptographically verified
}

// RIGHT: Full server verification (slower but catches banned/logged-out users)
export async function SensitiveAction() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
}
```

**When to use which:**
- `getClaims()` -- Default for page protection and reads. Verifies JWT locally via JWKS. Fast.
- `getUser()` -- For sensitive mutations (financial, role changes). Validates with Auth server. Catches banned/logged-out users.
- `getSession()` -- Client-side only. Never on server for authorization.

**Phase to address:** Phase 1 (Auth Architecture). Must be correct from the first authenticated route.

**Sources:**
- [Supabase Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) -- HIGH confidence
- [getClaims vs getUser Discussion](https://github.com/supabase/supabase/issues/40985) -- HIGH confidence
- [SSR Attack Vector Discussion](https://github.com/orgs/supabase/discussions/23224) -- HIGH confidence

---

### Pitfall 2: Shared Supabase Client Missing Platform-Specific Auth Configuration

**What goes wrong:**
The `@upoe/shared` package creates a single Supabase client factory, but mobile and web require fundamentally different auth configurations. Using the same config for both causes auth failures: mobile sessions are not persisted, tokens are not refreshed when the app is backgrounded, or web SSR cookies are not set.

**Why it happens:**
- DRY principle leads to sharing the client creation across platforms
- The existing `createSupabaseClient()` in shared uses `detectSessionInUrl: true`, which is correct for web but wrong for React Native
- Storage adapters differ: web uses cookies (via @supabase/ssr), mobile uses expo-sqlite or SecureStore
- Auto-refresh behavior differs: browsers handle focus automatically, React Native needs AppState listeners

**Consequences:**
- Mobile: sessions lost after app restart, users forced to re-login constantly
- Mobile: tokens expire while app is backgrounded, causing 401 errors on resume
- Web: SSR hydration mismatches when client/server session state diverges
- Web: middleware fails to refresh tokens, causing random logouts

**Warning signs:**
- Users report being logged out randomly on mobile
- Session works in Expo Go but breaks in production builds
- "Invalid Refresh Token: Already Used" errors
- Next.js hydration warnings related to auth state

**How to avoid:**

```typescript
// packages/shared/src/lib/supabase.ts -- Keep shared types and base config only
export type { Database } from '../types/database.types';
export const SUPABASE_CONFIG = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
} as const;

// apps/mobile/src/lib/supabase.ts -- Mobile-specific client
import { createClient } from '@supabase/supabase-js';
import { localStorage } from 'expo-sqlite';
import { AppState, Platform } from 'react-native';
import type { Database } from '@upoe/shared';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: localStorage,           // expo-sqlite storage
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,        // CRITICAL: false for React Native
    },
  }
);

// Register AppState listener for token refresh (once, at app root)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

// apps/admin/src/lib/supabase/server.ts -- Next.js server client
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@upoe/shared';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

**Phase to address:** Phase 1 (Monorepo Setup). The shared package boundary must be defined before any auth code.

**Sources:**
- [Supabase Expo Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) -- HIGH confidence
- [Supabase Next.js Server-Side Auth](https://supabase.com/docs/guides/auth/server-side/nextjs) -- HIGH confidence
- [Supabase startAutoRefresh docs](https://supabase.com/docs/reference/javascript/auth-startautorefresh) -- HIGH confidence

---

### Pitfall 3: Missing Next.js Middleware for Token Refresh

**What goes wrong:**
Without middleware calling `supabase.auth.getClaims()` (or `getUser()`) on every request, expired auth tokens in cookies are never refreshed. Server Components cannot write cookies, so they cannot update the session. Users experience random logouts, especially after periods of inactivity.

**Why it happens:**
- Developers assume the Supabase client handles refresh automatically
- The browser client does refresh automatically, creating a false sense of security
- Server Components are read-only for cookies -- this is a Next.js constraint, not a Supabase one
- Missing middleware is not immediately obvious during development with short sessions

**Consequences:**
- Users logged out after JWT expiry (default 1 hour)
- Race conditions when multiple parallel requests try to refresh the same token
- "Invalid Refresh Token: Already Used" errors when middleware and Server Components both attempt refresh
- Admin dashboard becomes unusable for long working sessions

**Warning signs:**
- Users report being logged out after ~1 hour of use
- "AuthApiError: Invalid Refresh Token: Already Used" in server logs
- Auth works perfectly in development but fails in production

**How to avoid:**

```typescript
// middleware.ts (root of Next.js app)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Pass refreshed tokens to both request and response
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

  // This refreshes the token and writes updated cookies
  const { data: { claims } } = await supabase.auth.getClaims();

  // Redirect unauthenticated users
  if (!claims && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip static files and API routes that don't need auth
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Critical detail:** The middleware must set cookies on BOTH the request (for downstream Server Components) AND the response (for the browser). Missing either one causes subtle bugs.

**Phase to address:** Phase 1 (Auth Architecture). This is the first file to create in the Next.js app.

**Sources:**
- [Supabase Next.js Server-Side Auth Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- HIGH confidence
- [Token Refresh Race Conditions](https://github.com/supabase/supabase/issues/18981) -- HIGH confidence
- [Middleware Performance Discussion](https://github.com/supabase/supabase/issues/30241) -- MEDIUM confidence

---

### Pitfall 4: Realtime Subscription Memory Leaks in React Components

**What goes wrong:**
Supabase Realtime channels are created in `useEffect` but not properly cleaned up. React 19's Strict Mode double-invokes effects in development, creating orphaned WebSocket subscriptions. In production, navigating between screens creates new subscriptions without removing old ones. Memory grows steadily and the app crashes after extended use.

**Why it happens:**
- `useEffect` cleanup is not called when `subscribe()` is still pending
- React Strict Mode mounts/unmounts/remounts, and the first subscribe gets a CLOSED signal
- Developers use `channel.unsubscribe()` (which only unsubscribes) instead of `supabase.removeChannel(channel)` (which also cleans up the WebSocket)
- On React Native, screen transitions via React Navigation don't unmount screens by default (they stay in the stack)

**Consequences:**
- Steady memory growth (reported on GitHub issue #1204 for supabase-js)
- Duplicate event handlers firing, causing UI glitches
- Hitting Supabase Realtime rate limits (100 channels per client by default)
- App crashes on low-memory mobile devices after extended use

**Warning signs:**
- "Channel Already Subscribed" warnings in console
- Duplicate notifications or events
- Memory usage climbing in React Native performance monitor
- Realtime works for ~8 seconds then stops (rate limit)

**How to avoid:**

```typescript
// WRONG: No cleanup, stale references
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, handler)
    .subscribe();
  // Missing cleanup!
}, []);

// RIGHT: Proper cleanup with removeChannel
useEffect(() => {
  const channel = supabase
    .channel(`notifications-${communityId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `community_id=eq.${communityId}`,
    }, handleNotification)
    .subscribe();

  return () => {
    supabase.removeChannel(channel); // Removes AND unsubscribes
  };
}, [communityId]);

// For React Navigation screens that stay mounted, use focus/blur
import { useFocusEffect } from '@react-navigation/native';

function GuardDashboard() {
  useFocusEffect(
    useCallback(() => {
      const channel = supabase
        .channel('guard-alerts')
        .on('postgres_changes', { /* ... */ }, handleAlert)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [])
  );
}
```

**Phase to address:** Phase 2 (Realtime Infrastructure). Build a subscription management hook/utility before any feature uses Realtime.

**Sources:**
- [Supabase removeChannel docs](https://supabase.com/docs/reference/javascript/removechannel) -- HIGH confidence
- [Memory leak issue #1204](https://github.com/supabase/supabase-js/issues/1204) -- HIGH confidence
- [React Strict Mode + Realtime issue #169](https://github.com/supabase/realtime-js/issues/169) -- HIGH confidence

---

### Pitfall 5: Monorepo Workspace Configuration Incomplete for Expo + Next.js

**What goes wrong:**
The current `pnpm-workspace.yaml` only includes `packages/*` but the root `package.json` scripts reference apps at `@upoe/admin` and `@upoe/mobile`. When the `apps/` directory is created, pnpm will not recognize those workspaces. Additionally, pnpm's default isolated dependency installation breaks Metro bundler's module resolution, causing "Unable to resolve module" errors at runtime.

**Why it happens:**
- Workspace config was created before the apps were planned
- pnpm defaults to isolated (`node-linker=hoisted` not set) which React Native's Metro bundler historically could not handle
- Expo SDK 54 added isolated dependency support but only since SDK 54 itself
- Duplicate React/React Native versions across workspaces cause red screens and build failures
- EAS Build assumes Yarn-style hoisted `node_modules`, not pnpm's symlink structure

**Consequences:**
- `pnpm --filter @upoe/mobile start` fails with "package not found"
- Metro bundler crashes with "Unable to resolve module 'react-native'" at runtime
- Duplicate React versions cause "Invalid hook call" errors
- EAS builds fail because pnpm layout is not recognized
- `@upoe/shared` TypeScript types not resolved by either app

**Warning signs:**
- `pnpm ls` does not show app packages
- Metro red screen "Unable to resolve module" on launch
- TypeScript cannot find `@upoe/shared` module
- Different React versions in `pnpm why react`

**How to avoid:**

```yaml
# pnpm-workspace.yaml -- MUST include apps
packages:
  - "packages/*"
  - "apps/*"
```

```ini
# .npmrc -- Consider keeping hoisted for now if EAS Build issues arise
auto-install-peers=true
strict-peer-dependencies=false
# Expo SDK 54 supports isolated installs, but if EAS builds fail:
# node-linker=hoisted
```

```json
// Root package.json -- Pin shared React/React Native versions
{
  "pnpm": {
    "overrides": {
      "react": "19.1.0",
      "react-native": "0.81.0"
    }
  }
}
```

```javascript
// apps/mobile/metro.config.js -- SDK 54 auto-configures, but verify
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// SDK 54+ auto-detects monorepo. If issues arise:
// config.resolver.unstable_enableSymlinks = true;
module.exports = config;
```

**Phase to address:** Phase 1 (Monorepo Setup). Must be the VERY FIRST task before any app code.

**Sources:**
- [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/) -- HIGH confidence
- [pnpm + Expo Working Configuration](https://dev.to/isaacaddis/working-expo-pnpm-workspaces-configuration-4k2l) -- MEDIUM confidence
- [byCedric expo-monorepo-example](https://github.com/byCedric/expo-monorepo-example) -- MEDIUM confidence

---

### Pitfall 6: Role-Based Authorization Checked Only on Frontend

**What goes wrong:**
With 6 user roles, developers implement authorization logic purely in React components (hiding buttons, redirecting routes) without enforcing it server-side. An attacker with a valid JWT for a `resident` role can call any API endpoint or Supabase query directly, bypassing all frontend guards.

**Why it happens:**
- Frontend role checks are visible and testable ("if role !== 'admin', hide button")
- RLS policies exist for tenant isolation but not for role-based access within a tenant
- Developers assume hiding the UI is sufficient
- The 399 existing RLS policies use `community_id` for tenant isolation but may not all check roles

**Consequences:**
- Residents can access admin-only data by querying Supabase directly
- Guards can modify financial records
- Providers can read other providers' data within the same community
- Violates the principle of defense-in-depth

**Warning signs:**
- Authorization logic only in React components (no RLS role checks)
- All authenticated users can SELECT from all tables within their tenant
- No `app_metadata->>'role'` checks in RLS policies
- Admin-only pages work when accessed directly via URL

**How to avoid:**

```typescript
// WRONG: Frontend-only authorization
function AdminDashboard() {
  const { role } = useAuth();
  if (role !== 'community_admin') return <Redirect to="/home" />;
  // Data is still accessible via direct Supabase query!
  return <Dashboard />;
}

// RIGHT: RLS enforces role + frontend hides UI for UX
// In database migration:
```

```sql
-- RLS policy example: Only admins can see financial data
CREATE POLICY "Admin financial access" ON financial_transactions
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT (auth.jwt()->'app_metadata'->>'community_id')::uuid)
    AND (SELECT auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'community_admin', 'manager')
  );

-- Guards can only see their assigned access points
CREATE POLICY "Guard access point visibility" ON access_logs
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT (auth.jwt()->'app_metadata'->>'community_id')::uuid)
    AND (
      (SELECT auth.jwt()->'app_metadata'->>'role') IN ('super_admin', 'community_admin', 'manager')
      OR (
        (SELECT auth.jwt()->'app_metadata'->>'role') = 'guard'
        AND access_point_id IN (
          SELECT access_point_id FROM guard_assignments
          WHERE guard_id = (SELECT (auth.jwt()->'app_metadata'->>'guard_id')::uuid)
        )
      )
    )
  );
```

```typescript
// Frontend: Hide UI for UX (not security)
function useCanAccess(requiredRoles: SystemRole[]) {
  const { appMetadata } = useAuth();
  return requiredRoles.includes(appMetadata.role as SystemRole);
}
```

**Phase to address:** Phase 1 (Auth Architecture). Audit existing RLS policies for role enforcement before building any UI.

**Sources:**
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- HIGH confidence
- [Understanding API Keys](https://supabase.com/docs/guides/api/api-keys) -- HIGH confidence

---

## Moderate Pitfalls

Mistakes that cause significant delays, technical debt, or degraded user experience.

### Pitfall 7: 393KB database.types.ts Slowing Down TypeScript and Bundling

**What goes wrong:**
The generated `database.types.ts` file is 12,202 lines / 393KB. TypeScript's language server becomes sluggish when this file is imported across the monorepo. Every file that imports from `@upoe/shared` triggers TS to re-evaluate the massive Database type. IDE autocompletion becomes slow, and CI type-checking takes significantly longer.

**Why it happens:**
- 116 tables generate enormous type unions
- The `Tables<'table_name'>` helper forces TS to evaluate all 116 table types
- Every `supabase.from('table')` call resolves against the full Database type
- TypeScript does not tree-shake types at the language server level

**Consequences:**
- IDE autocompletion delays of 2-5 seconds
- `tsc` type-checking taking 30-60+ seconds in CI
- Developer frustration and productivity loss
- Temptation to use `any` to avoid slow type resolution

**Warning signs:**
- "TypeScript server is busy" warnings in VS Code
- Slow autocomplete specifically on Supabase query chains
- CI type-check step becoming a bottleneck

**How to avoid:**

```typescript
// Option 1: Create focused type subsets for each app
// packages/shared/src/types/mobile.types.ts
import type { Database } from './database.types';

// Only the tables the mobile app needs
export type MobileDB = {
  public: {
    Tables: Pick<Database['public']['Tables'],
      | 'residents'
      | 'units'
      | 'notifications'
      | 'access_logs'
      | 'invitations'
      | 'push_tokens'
      | 'payments'
      | 'reservations'
    >;
    Views: Pick<Database['public']['Views'], 'unit_balances'>;
    Functions: Database['public']['Functions'];
    Enums: Database['public']['Enums'];
  };
};

// Option 2: Use explicit return types on data-fetching functions
// Instead of exposing raw Supabase queries everywhere
export async function getResidentNotifications(supabase: SupabaseClient, residentId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, read_at, created_at')
    .eq('recipient_id', residentId)
    .order('created_at', { ascending: false });

  return { data, error };
  // Return type is inferred once, not re-evaluated at every call site
}
```

**Note:** This is a developer experience issue, not a runtime bundle size issue. TypeScript types are erased at compilation and do not affect the shipped bundle. However, development velocity impact is real.

**Phase to address:** Phase 1 (Shared Package Architecture). Decide on type strategy before apps start consuming types.

**Sources:**
- [Supabase TypeScript Support](https://supabase.com/docs/reference/javascript/typescript-support) -- HIGH confidence
- Project observation: 12,202 lines confirmed in `packages/shared/src/types/database.types.ts`

---

### Pitfall 8: Expo SecureStore 2048-Byte Limit Breaking Auth Token Storage

**What goes wrong:**
Supabase auth sessions (which include JWT access tokens + refresh tokens + user metadata) can exceed 2048 bytes. On some iOS versions, `expo-secure-store` silently fails or throws when storing values larger than ~2048 bytes. The session appears saved but is actually lost, causing users to be logged out on next app launch.

**Why it happens:**
- iOS Keychain historically had a ~2048-byte limit for individual items
- Supabase JWTs with `app_metadata` (containing community_id, role, resident_id, guard_id, organization_id) can push the token beyond this limit
- Expo does not enforce a limit itself, but the underlying native API may reject large values
- The failure is often silent -- no error thrown, data just not persisted

**Consequences:**
- Session lost on app restart (user must re-login every time)
- Intermittent: works on some devices, fails on others (depends on iOS version)
- Hard to debug because the error is not surfaced to JavaScript

**Warning signs:**
- Users on older iOS versions report being logged out on every app restart
- Auth works in Expo Go but fails in production builds
- `getSession()` returns null after app restart despite successful login

**How to avoid:**

```typescript
// RECOMMENDED: Use expo-sqlite localStorage adapter (what Supabase docs now recommend)
import { localStorage } from 'expo-sqlite';

const supabase = createClient<Database>(url, key, {
  auth: {
    storage: localStorage,  // No size limit, encrypted at rest on iOS
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ALTERNATIVE: If you need SecureStore's hardware-backed encryption,
// use an unlimited wrapper that chunks large values
// npm: @neverdull-agency/expo-unlimited-secure-store
```

**Phase to address:** Phase 1 (Mobile Auth Setup). Storage adapter must be chosen at client initialization.

**Sources:**
- [Expo SecureStore docs](https://docs.expo.dev/versions/latest/sdk/securestore/) -- HIGH confidence
- [Supabase Expo Tutorial (recommends expo-sqlite)](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native) -- HIGH confidence
- [SecureStore size limit issue #1765](https://github.com/expo/expo/issues/1765) -- HIGH confidence

---

### Pitfall 9: File Uploads from React Native Failing Due to Blob/File Type Mismatch

**What goes wrong:**
`expo-image-picker` returns a file URI string, but `supabase.storage.from('bucket').upload()` expects a `File` or `ArrayBuffer`. Attempting to convert URI to Blob and pass it directly results in TypeScript errors (Blob missing `lastModified` and `name` properties) or 0-byte uploads (promise not awaited).

**Why it happens:**
- Web APIs (`File`, `Blob`) work differently in React Native
- React Native does not have a native `File` constructor compatible with web
- Developers try web patterns that do not translate to mobile
- The conversion from URI to uploadable format requires multiple async steps

**Consequences:**
- File uploads silently produce 0-byte files in storage
- Upload appears to succeed (200 response) but file is empty
- TypeScript compile errors when trying to pass Blob as File
- User profile photos, document uploads, and evidence attachments all broken

**Warning signs:**
- Uploaded files are 0 bytes in Supabase Storage dashboard
- TypeScript error: "Argument of type 'Blob' is not assignable to parameter of type 'File'"
- Upload function works in Next.js admin but fails in mobile app

**How to avoid:**

```typescript
import * as ImagePicker from 'expo-image-picker';

async function uploadProfilePhoto(userId: string) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return;

  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  const fileName = `${userId}/profile.${ext}`;

  // CORRECT: Read file as ArrayBuffer
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, arrayBuffer, {
      contentType: asset.mimeType ?? `image/${ext}`,
      upsert: true,
    });

  if (error) throw error;
  return data.path;
}
```

```typescript
// WRONG: Common mistakes
// 1. Passing URI string directly (not a valid upload format)
await supabase.storage.from('avatars').upload(name, asset.uri); // FAILS

// 2. Converting to Blob but not awaiting
const blob = fetch(asset.uri).then(r => r.blob()); // Promise, not Blob!
await supabase.storage.from('avatars').upload(name, blob); // 0 bytes

// 3. Using FormData (not supported by Supabase storage upload)
const formData = new FormData();
formData.append('file', { uri: asset.uri, name, type: 'image/jpeg' });
```

**Phase to address:** Phase 2 (Mobile Core Features). Build a shared upload utility before any feature needs file uploads.

**Sources:**
- [Supabase React Native Storage Blog](https://supabase.com/blog/react-native-storage) -- HIGH confidence
- [Image Picker Discussion #1268](https://github.com/orgs/supabase/discussions/1268) -- MEDIUM confidence

---

### Pitfall 10: Deep Linking Not Configured for Auth Flows

**What goes wrong:**
Supabase Auth features that redirect users (email verification, OAuth callbacks, magic links, password reset) open in the system browser but cannot navigate back to the Expo app. Users complete auth in the browser and are stranded -- the app never receives the auth tokens.

**Why it happens:**
- Deep linking requires platform-specific configuration (app.json scheme, iOS Associated Domains, Android intent filters)
- Expo Go supports a limited set of URL schemes that differ from production builds
- The redirect URL must be registered in Supabase Auth settings AND in the app
- Email clients may strip or modify deep links

**Consequences:**
- Email verification flow broken: users click link, browser opens, but app never gets the session
- OAuth (Google, Apple) login completes in browser but app stays on login screen
- Password reset flow leaves users stranded in browser
- "It works in development but not in production" because Expo Go has different URL handling

**Warning signs:**
- Auth redirects open in browser and stay there
- `Linking.getInitialURL()` returns null after auth redirect
- Different behavior between Expo Go and standalone build
- OAuth works on web but not on mobile

**How to avoid:**

```json
// app.json -- Configure URL scheme
{
  "expo": {
    "scheme": "upoe",
    "ios": {
      "associatedDomains": ["applinks:yourapp.com"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "upoe" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

```typescript
// In Supabase Dashboard > Authentication > URL Configuration:
// Add redirect URL: upoe://auth/callback

// In mobile app: Handle the redirect
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';

const redirectTo = makeRedirectUri();

// For email/password signup with verification
await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: redirectTo },
});

// Listen for the redirect
Linking.addEventListener('url', async ({ url }) => {
  if (url.includes('access_token')) {
    const params = new URLSearchParams(url.split('#')[1]);
    await supabase.auth.setSession({
      access_token: params.get('access_token')!,
      refresh_token: params.get('refresh_token')!,
    });
  }
});

// ALTERNATIVE: Use OTP verification instead of email links (simpler, more reliable)
await supabase.auth.signInWithOtp({ email });
// User enters 6-digit code from email -- no deep linking needed
await supabase.auth.verifyOtp({ email, token: userInput, type: 'email' });
```

**Recommendation:** For the Mexican market where users may use email clients that mangle deep links, prefer OTP code verification over magic link flows. It is more reliable and does not require deep linking for basic email auth.

**Phase to address:** Phase 1 (Auth Architecture). Must be decided before implementing any auth flow.

**Sources:**
- [Supabase Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) -- HIGH confidence
- [Expo Auth Session + Supabase Social Auth](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth) -- HIGH confidence

---

### Pitfall 11: Expo SDK 54 / React Native 0.81 Upgrade Regressions

**What goes wrong:**
Expo SDK 54 with React Native 0.81 introduces breaking changes including UI regressions (text clipping, broken tabs, safe-area overlap), Metro import path changes, and a new stable `expo-file-system` API that moves the import path. Building on SDK 54 from day one avoids migration pain, but developers must be aware of known issues.

**Why it happens:**
- React Native 0.81 includes layout engine changes that affect component rendering
- Metro 0.83 changes internal import paths (`metro/src/..` becomes `metro/private/..`)
- `expo-file-system/next` becomes the default `expo-file-system`, old API moves to `expo-file-system/legacy`
- Stricter peer dependency checks mean libraries must be explicitly installed even if internally bundled
- iOS release builds with precompiled XCFrameworks had submission issues (fixed in 0.81.1)

**Consequences:**
- UI elements unexpectedly clipped or overlapping
- Third-party libraries importing from old Metro paths fail at build time
- File system code using old imports breaks after upgrade
- EAS builds fail with opaque peer dependency errors
- TestFlight/App Store submission blocked

**Warning signs:**
- Visual regression in layouts after starting fresh with SDK 54
- Build errors mentioning `metro/src/` paths
- `expo-file-system` import errors
- EAS build fails with "peer dependency not met" for react-native-worklets

**How to avoid:**
- Start on Expo SDK 54.0.x latest patch (not .0) to get bugfixes
- Use `expo-file-system` (not `expo-file-system/next`) as the import path
- Explicitly install `react-native-worklets` even though Expo bundles it internally
- Test on physical devices early -- simulators may not surface layout regressions
- Set `ios.buildReactNativeFromSource: false` in `expo-build-properties` if needed for TestFlight

**Phase to address:** Phase 1 (Project Initialization). Choose SDK version and verify all dependencies before writing feature code.

**Sources:**
- [Expo SDK 54 Breaking Changes](https://expo.dev/changelog/sdk-54-beta) -- HIGH confidence
- [RN 0.81 Upgrade Experience](https://medium.com/elobyte-software/what-breaks-after-an-expo-54-reactnative-0-81-15cb83cdb248) -- MEDIUM confidence
- [Web Build createContext Error](https://github.com/expo/expo/issues/40769) -- MEDIUM confidence

---

### Pitfall 12: startAutoRefresh() While Offline Clears Session

**What goes wrong:**
The AppState listener pattern for Supabase auth refresh calls `supabase.auth.startAutoRefresh()` when the app comes to the foreground. If the device is offline at that moment, the refresh attempt fails and Supabase may clear the local session entirely. The user is logged out even though they had a valid (not yet expired) token.

**Why it happens:**
- `startAutoRefresh()` immediately attempts to refresh the token
- When offline, the refresh request fails
- The error handling in some versions treats refresh failure as "session invalid"
- Mobile apps frequently transition between online/offline states

**Consequences:**
- Users in areas with poor connectivity (common in gated communities in Mexico) are frequently logged out
- Guards on patrol lose their session when entering signal dead zones
- The app becomes unusable without constant internet connection

**Warning signs:**
- Users report being logged out when returning from areas with poor signal
- Auth works perfectly on WiFi but fails on cellular
- Session disappears despite token not being expired

**How to avoid:**

```typescript
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

// Only refresh when online AND app is active
AppState.addEventListener('change', async (state) => {
  if (state === 'active') {
    const networkState = await NetInfo.fetch();
    if (networkState.isConnected) {
      supabase.auth.startAutoRefresh();
    }
    // If offline, do nothing -- existing token is still valid until expiry
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

**Phase to address:** Phase 1 (Mobile Auth Setup). Must be part of the initial auth configuration.

**Sources:**
- [Session Lost When Starting Offline Discussion](https://github.com/orgs/supabase/discussions/36906) -- MEDIUM confidence
- [Supabase startAutoRefresh docs](https://supabase.com/docs/reference/javascript/auth-startautorefresh) -- HIGH confidence

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping expo-sqlite for auth storage, using AsyncStorage | Simpler setup, one less dependency | Unencrypted tokens on disk, security audit failure | Never for production |
| Importing full `Database` type everywhere | Quick autocompletion | 2-5s IDE lag, slow CI, developer frustration | Only in shared package internals |
| Using `supabase.from()` directly in components | Fast to prototype | No data layer abstraction, impossible to add caching/offline later | Early prototyping only, refactor in Phase 2 |
| Skipping middleware token refresh | Fewer moving parts | Users logged out after 1 hour, broken admin dashboard | Never |
| Using `getSession()` for server auth | Faster (no network call) | Security vulnerability -- JWT not verified | Never on server |
| Single Supabase client for web + mobile | DRY code | Wrong storage adapter, wrong session detection, broken auth on one platform | Never |
| Hardcoding Spanish strings in components | Ship faster | Impossible to add English or other languages later | MVP only if no i18n plans |
| Using FlatList instead of FlashList | No extra dependency | Poor performance with large lists (payments, access logs, notifications) | Lists under 50 items |

---

## Integration Gotchas

Common mistakes when connecting frontend apps to the existing Supabase backend.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth (Mobile) | `detectSessionInUrl: true` | Set `detectSessionInUrl: false` for React Native. URL detection is for web OAuth redirects only. |
| Supabase Auth (Next.js) | Using `@supabase/auth-helpers` package | Use `@supabase/ssr` -- auth-helpers is deprecated, all fixes go to ssr package. |
| Supabase Realtime | Creating channel without RLS-compatible filter | Always filter by `community_id` in subscription. RLS blocks events silently if user cannot SELECT the row. |
| Supabase Storage (Mobile) | Passing image URI string to `upload()` | Convert to ArrayBuffer via `fetch(uri).then(r => r.arrayBuffer())` before upload. |
| Expo Push Notifications | Storing only Expo push tokens | Store BOTH Expo tokens and native FCM/APNs tokens. Expo tokens cannot be used with third-party services (marketing tools, Customer.io). |
| Expo Environment Variables | Using `process.env.SUPABASE_URL` | Must prefix with `EXPO_PUBLIC_` for client-side access: `process.env.EXPO_PUBLIC_SUPABASE_URL`. |
| Next.js Server Components | Creating Supabase client at module level | Create client per-request inside the function. Module-level clients share state across requests. |
| pnpm Monorepo | Importing `@upoe/shared` without workspace protocol | Use `"@upoe/shared": "workspace:*"` in package.json dependencies. |

---

## Performance Traps

Patterns that work at small scale but fail as the community grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all notifications without pagination | Slow load, high memory | Use `.range(0, 19)` with infinite scroll via FlashList `onEndReached` | >100 notifications per user |
| Not adding client-side `.eq()` filters alongside RLS | Full table scans despite RLS | Always add explicit `.eq('community_id', id)` even though RLS filters | >10K rows in table |
| Subscribing to all postgres_changes without filter | Server pushes every change to every client | Add `filter: 'community_id=eq.${id}'` to subscription | >50 concurrent users |
| Loading full Database type on every import | IDE lag, slow compilation | Create per-app type subsets with `Pick<>` | >80 tables (already at 116) |
| Rendering large access log tables without virtualization | Scroll jank, memory spikes | Use FlashList (mobile) or virtualized table (web) | >500 rows visible |
| Fetching related data with multiple sequential queries | Waterfall requests, slow screens | Use Supabase joins: `.select('*, residents(*)')` or RPC functions | >3 related queries per screen |
| Re-creating Supabase client on every render | Auth state lost, token refresh storms | Singleton client per platform (createBrowserClient once) | Any usage |

---

## Security Mistakes

Domain-specific security issues for a multi-tenant property management app.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `service_role` key in Next.js client component | Full database bypass, all tenant data exposed | Only use in Server Actions / Route Handlers. Never prefix with `NEXT_PUBLIC_`. |
| Using `NEXT_PUBLIC_` prefix for service role key | Key bundled into client JavaScript, extractable | Service role key: `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix) |
| Trusting `appMetadata.role` from client without RLS | Residents can impersonate admins via API | RLS must enforce role checks. Frontend role checks are UX only. |
| Storing push notification tokens without user association | Notifications sent to wrong users after account switch | Associate push tokens with user_id AND device_id. Clean up on logout. |
| Not validating file upload MIME types | Executable files uploaded as "images" | Validate Content-Type server-side. Use Supabase storage MIME type restrictions. |
| Logging full JWT tokens in error handlers | Token theft from log aggregation services | Never log authorization headers. Redact tokens in error reporting. |
| Using community_id from URL params for data fetching | Users can change URL to access other communities | Always extract community_id from verified JWT claims, never from URL/request params. |

---

## UX Pitfalls

Common user experience mistakes specific to this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No offline indicator | Users submit forms that silently fail | Show connection status banner. Queue mutations when offline. |
| Blocking UI during Supabase queries | App feels frozen, especially on slow mobile connections | Use optimistic updates with rollback on error. Show skeleton loaders. |
| Loading all data on app launch | 5+ second splash screen while fetching everything | Lazy-load per screen. Pre-fetch only auth state and critical data. |
| Not handling Supabase rate limits gracefully | Cryptic error messages ("Too Many Requests") | Implement exponential backoff with user-friendly "Please wait" message. |
| Spanish-only error messages from Supabase | English error messages leak through to Spanish UI | Wrap all Supabase errors in a translation layer. Map error codes to Spanish messages. |
| Push notification permission requested on first launch | Users deny permission reflexively | Request after showing value (e.g., after first visitor invitation). |
| No pull-to-refresh on list screens | Users don't know how to get fresh data | Add RefreshControl to all FlatList/FlashList screens. |
| Admin dashboard with no loading states | White screen while Server Components render | Use `loading.tsx` files and Suspense boundaries in Next.js App Router. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Auth:** Login works -- but does the session persist after app kill and restart on mobile?
- [ ] **Auth:** Login works -- but does the middleware refresh tokens in Next.js after 1 hour of inactivity?
- [ ] **Auth:** OAuth works -- but does the deep link redirect back to the mobile app (not just the browser)?
- [ ] **Realtime:** Subscriptions work -- but do they clean up when navigating away from the screen?
- [ ] **Realtime:** Events arrive -- but do they still arrive after the app was backgrounded for 10 minutes?
- [ ] **Storage:** Upload works -- but are the files actually non-zero bytes in Supabase Storage?
- [ ] **Storage:** Upload works -- but does the file respect tenant isolation (correct folder path with community_id)?
- [ ] **Push Notifications:** Token registered -- but does it update when the OS rotates the token?
- [ ] **Push Notifications:** Notification received -- but does tapping it navigate to the correct screen?
- [ ] **Roles:** Admin pages hidden from residents -- but can a resident access admin data via direct Supabase query?
- [ ] **Monorepo:** Shared types import -- but does the mobile app resolve them after EAS build (not just local dev)?
- [ ] **Offline:** App works offline -- but what happens to pending mutations when the user logs out?
- [ ] **Performance:** List loads fast with 10 items -- but does it still scroll smoothly with 1,000 items?
- [ ] **i18n:** UI is in Spanish -- but are Supabase error messages also translated?

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| getSession() used server-side | LOW | Search-and-replace with getClaims(). No data migration needed. |
| Wrong auth storage adapter | LOW | Change adapter, users will need to re-login once. |
| Realtime memory leaks | MEDIUM | Add useEffect cleanup. Existing users need app update. |
| Missing middleware | LOW | Add middleware.ts file. Immediate fix, no data impact. |
| Frontend-only role checks | HIGH | Must add RLS policies for role enforcement. Requires database migration and thorough testing. |
| Monorepo workspace misconfigured | LOW | Update pnpm-workspace.yaml and reinstall. But if builds were shipped with wrong resolution, app update needed. |
| Service role key exposed | CRITICAL | Rotate key immediately in Supabase dashboard. Audit all data for unauthorized access. Redeploy all apps. |
| Deep linking not configured | MEDIUM | Requires new app binary build (cannot fix via OTA update). |
| Large types file slowing dev | LOW | Refactor to type subsets. No runtime impact. |
| File upload 0-byte bug | LOW | Fix upload utility, re-upload affected files. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: getSession() on server | Phase 1: Auth Architecture | Grep codebase for `getSession()` in server files. Should find zero occurrences. |
| P2: Shared client wrong config | Phase 1: Monorepo Setup | Mobile app persists session across app restart. Next.js refreshes via middleware. |
| P3: Missing middleware | Phase 1: Auth Architecture | Auth token refreshes after 1+ hour of dashboard use without re-login. |
| P4: Realtime memory leaks | Phase 2: Realtime Infrastructure | Memory usage stable after 30 minutes of screen navigation. |
| P5: Workspace misconfigured | Phase 1: Monorepo Setup | `pnpm -r ls` shows all packages. EAS build succeeds. |
| P6: Frontend-only role checks | Phase 1: Auth Architecture + RLS Audit | Direct Supabase query as resident cannot access admin-only tables. |
| P7: Large types file | Phase 1: Shared Package | IDE autocomplete responds in <1 second on Supabase queries. |
| P8: SecureStore limit | Phase 1: Mobile Auth | Session persists across app restart on iOS 15+ with metadata-heavy JWT. |
| P9: File upload mismatch | Phase 2: Mobile Features | Uploaded files have correct byte count in Supabase Storage. |
| P10: Deep linking | Phase 1: Auth Architecture | Email verification link opens mobile app directly. |
| P11: SDK 54 regressions | Phase 1: Project Init | UI renders correctly on physical iOS and Android devices. |
| P12: Offline auto-refresh | Phase 1: Mobile Auth | App retains session after airplane mode toggle. |

---

## Sources

### Official Documentation (HIGH confidence)
- [Supabase Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Expo React Native Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase removeChannel API](https://supabase.com/docs/reference/javascript/removechannel)
- [Supabase startAutoRefresh API](https://supabase.com/docs/reference/javascript/auth-startautorefresh)
- [Supabase Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase Understanding API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Supabase React Native Storage](https://supabase.com/blog/react-native-storage)
- [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/)
- [Expo SecureStore Docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54-beta)
- [Expo Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)

### GitHub Issues and Discussions (HIGH-MEDIUM confidence)
- [getClaims vs getUser Clarification #40985](https://github.com/supabase/supabase/issues/40985)
- [Realtime Memory Leak #1204](https://github.com/supabase/supabase-js/issues/1204)
- [Strict Mode + Realtime #169](https://github.com/supabase/realtime-js/issues/169)
- [Token Refresh Race Condition #18981](https://github.com/supabase/supabase/issues/18981)
- [SSR Attack Vector Discussion #23224](https://github.com/orgs/supabase/discussions/23224)
- [SecureStore Size Limit #1765](https://github.com/expo/expo/issues/1765)
- [Session Lost Offline #36906](https://github.com/orgs/supabase/discussions/36906)
- [Middleware Token Refresh Concerns #30241](https://github.com/supabase/supabase/issues/30241)

### Community Sources (MEDIUM confidence)
- [Expo SDK 54 Upgrade Experience](https://medium.com/elobyte-software/what-breaks-after-an-expo-54-reactnative-0-81-15cb83cdb248)
- [pnpm + Expo Workspaces Configuration](https://dev.to/isaacaddis/working-expo-pnpm-workspaces-configuration-4k2l)
- [byCedric Expo Monorepo Example](https://github.com/byCedric/expo-monorepo-example)
- [Next.js + Supabase Production Lessons](https://catjam.fi/articles/next-supabase-what-do-differently)

---
*Frontend pitfalls research for: UPOE Expo + Next.js applications*
*Researched: 2026-02-06*
