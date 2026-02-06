# Architecture Research: UPOE Frontend Applications

**Domain:** Multi-tenant SaaS gated community management -- Expo mobile app + Next.js admin dashboard consuming existing Supabase backend
**Researched:** 2026-02-06
**Confidence:** HIGH (Expo Router, Next.js App Router, Supabase SSR patterns verified via official documentation)

---

## System Overview

```
                              UPOE Frontend Architecture
 =========================================================================

 +-----------------------+          +-------------------------+
 |   @upoe/mobile        |          |   @upoe/admin           |
 |   (Expo SDK 54)       |          |   (Next.js 16)          |
 |                        |          |                          |
 |  Expo Router 4+        |          |  App Router              |
 |  NativeWind v4         |          |  Tailwind CSS 4          |
 |  Zustand (client)      |          |  Server Components       |
 |  TanStack Query (srv)  |          |  TanStack Query (client) |
 |  SecureStore sessions   |          |  Cookie-based sessions   |
 +-----------+------------+          +------------+-------------+
             |                                    |
             |          +-----------------+       |
             +--------->| @upoe/shared    |<------+
                        |                 |
                        | Database types  |
                        | Supabase client |
                        | Constants/Roles |
                        | Query keys      |
                        | Validators      |
                        +---------+-------+
                                  |
                    +-------------+---------------+
                    |       Supabase Platform      |
                    |       (EXISTING BACKEND)      |
                    |                              |
                    |  Auth (JWT + app_metadata)   |
                    |  PostgREST (auto-API + RLS)  |
                    |  Realtime (subscriptions)    |
                    |  Storage (file buckets)      |
                    |  Edge Functions              |
                    +------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `@upoe/mobile` | Resident, Guard, Admin mobile experiences | Expo Router with role-based tab groups, NativeWind styling, TanStack Query |
| `@upoe/admin` | Community Admin + Super Admin web dashboard | Next.js App Router with server components for data, client components for interactivity |
| `@upoe/shared` | Cross-platform business logic and types | Pure TypeScript: DB types, Supabase client factory, constants, query key factories, Zod validators |
| Supabase Backend | Existing backend-as-a-service | PostgreSQL with RLS, Auth, Realtime, Storage, Edge Functions -- already built across 8 phases |

---

## Recommended Project Structure

### Monorepo Root

The existing monorepo uses `packages/` with pnpm workspaces. Both apps are already scaffolded. The structure below shows what exists (marked `[EXISTS]`) and what needs to be added (marked `[NEW]`).

```
colony_app/
+-- packages/
|   +-- shared/                     # @upoe/shared
|   |   +-- src/
|   |   |   +-- types/
|   |   |   |   +-- database.types.ts      [EXISTS] Auto-generated Supabase types
|   |   |   |   +-- index.ts               [EXISTS] Tables<T>, InsertTables<T>, etc.
|   |   |   +-- constants/
|   |   |   |   +-- roles.ts               [EXISTS] SYSTEM_ROLES, isAdminRole()
|   |   |   |   +-- storage.ts             [EXISTS] STORAGE_BUCKETS, getStoragePath()
|   |   |   |   +-- index.ts               [EXISTS] Re-exports
|   |   |   +-- lib/
|   |   |   |   +-- supabase.ts            [EXISTS] createSupabaseClient factory
|   |   |   +-- queries/                    [NEW] Shared query key factories
|   |   |   |   +-- keys.ts               Query key factory functions
|   |   |   |   +-- index.ts
|   |   |   +-- validators/                 [NEW] Shared Zod validation schemas
|   |   |   |   +-- auth.ts               Login, signup validation
|   |   |   |   +-- visitors.ts           Invitation schemas
|   |   |   |   +-- payments.ts           Payment proof schemas
|   |   |   |   +-- index.ts
|   |   |   +-- helpers/                    [NEW] Pure utility functions
|   |   |   |   +-- formatters.ts         Currency, date, phone formatting
|   |   |   |   +-- permissions.ts        Role permission checks
|   |   |   |   +-- index.ts
|   |   |   +-- index.ts                   [EXISTS] Barrel export
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |
|   +-- mobile/                     # @upoe/mobile (Expo SDK 54)
|   |   +-- app/                    # Expo Router file-based routes
|   |   |   +-- _layout.tsx         Root: providers + Stack.Protected auth guard
|   |   |   +-- index.tsx           Entry redirect
|   |   |   +-- (auth)/             Unauthenticated screens
|   |   |   |   +-- _layout.tsx
|   |   |   |   +-- sign-in.tsx
|   |   |   |   +-- sign-up.tsx
|   |   |   |   +-- forgot-password.tsx
|   |   |   +-- (resident)/         Resident tab group
|   |   |   |   +-- _layout.tsx     Tabs: home, visitors, payments, community, more
|   |   |   |   +-- index.tsx       Dashboard
|   |   |   |   +-- visitors/
|   |   |   |   |   +-- index.tsx   Invitation list
|   |   |   |   |   +-- create.tsx  Create invitation
|   |   |   |   |   +-- [id].tsx    Invitation detail / QR
|   |   |   |   +-- payments/
|   |   |   |   |   +-- index.tsx   Balance + payment list
|   |   |   |   |   +-- [id].tsx    Payment detail
|   |   |   |   +-- community/
|   |   |   |   |   +-- index.tsx   Social wall / announcements
|   |   |   |   |   +-- [postId].tsx
|   |   |   |   +-- more/
|   |   |   |       +-- index.tsx   Settings menu
|   |   |   |       +-- amenities.tsx
|   |   |   |       +-- maintenance.tsx
|   |   |   |       +-- documents.tsx
|   |   |   |       +-- profile.tsx
|   |   |   +-- (guard)/            Guard tab group
|   |   |   |   +-- _layout.tsx     Tabs: gate, visitors, patrol, incidents
|   |   |   |   +-- index.tsx       Gate operations dashboard
|   |   |   |   +-- gate/
|   |   |   |   |   +-- index.tsx   Active gate view
|   |   |   |   |   +-- scan.tsx    QR scanner
|   |   |   |   |   +-- manual.tsx  Manual check-in
|   |   |   |   +-- patrol/
|   |   |   |   |   +-- index.tsx   Active patrol
|   |   |   |   |   +-- checkpoints.tsx
|   |   |   |   +-- incidents/
|   |   |   |       +-- index.tsx   Incident list
|   |   |   |       +-- report.tsx  New incident
|   |   |   +-- (admin)/            Mobile admin (community_admin, manager)
|   |   |       +-- _layout.tsx     Tabs: overview, users, reports, settings
|   |   |       +-- index.tsx       Community overview
|   |   |       +-- ...
|   |   +-- src/
|   |   |   +-- components/         React Native components
|   |   |   |   +-- ui/             Primitives (Button, Card, Input, Badge)
|   |   |   |   +-- visitors/       Feature-specific components
|   |   |   |   +-- gate/
|   |   |   |   +-- payments/
|   |   |   |   +-- community/
|   |   |   |   +-- common/         Header, EmptyState, LoadingScreen
|   |   |   +-- hooks/              Custom hooks
|   |   |   |   +-- useAuth.ts      Auth state and methods
|   |   |   |   +-- useRole.ts      Role-based utility hook
|   |   |   |   +-- useSupabase.ts  Supabase client accessor
|   |   |   |   +-- queries/        TanStack Query hooks (one file per domain)
|   |   |   |       +-- useVisitors.ts
|   |   |   |       +-- usePayments.ts
|   |   |   |       +-- useAccessLogs.ts
|   |   |   |       +-- useResidents.ts
|   |   |   |       +-- useAmenities.ts
|   |   |   |       +-- useMaintenance.ts
|   |   |   |       +-- useNotifications.ts
|   |   |   +-- stores/             Zustand stores (client state only)
|   |   |   |   +-- authStore.ts    Session, role, community context
|   |   |   |   +-- uiStore.ts      Theme, bottom sheet, filters
|   |   |   +-- providers/          Context providers
|   |   |   |   +-- SessionProvider.tsx
|   |   |   |   +-- QueryProvider.tsx
|   |   |   +-- lib/                Platform-specific utilities
|   |   |   |   +-- supabase.ts     Mobile Supabase client (SecureStore)
|   |   |   |   +-- storage.ts      LargeSecureStore adapter
|   |   |   |   +-- notifications.ts  Push notification setup
|   |   |   +-- utils/              Formatters, helpers
|   |   +-- assets/
|   |   +-- app.json                [EXISTS]
|   |   +-- package.json            [EXISTS]
|   |   +-- tsconfig.json           [EXISTS]
|   |   +-- metro.config.js         [NEW] Metro config for monorepo (SDK 54 auto-detects)
|   |   +-- nativewind-env.d.ts     [NEW] NativeWind type declarations
|   |
|   +-- admin/                      # @upoe/admin (Next.js 16)
|       +-- src/
|       |   +-- app/                Next.js App Router
|       |   |   +-- layout.tsx      [EXISTS] Root: fonts, global CSS, providers
|       |   |   +-- page.tsx        [EXISTS] Landing redirect
|       |   |   +-- globals.css     [EXISTS] Tailwind imports
|       |   |   +-- (auth)/         Auth route group (no dashboard chrome)
|       |   |   |   +-- layout.tsx  Centered card layout
|       |   |   |   +-- sign-in/
|       |   |   |   |   +-- page.tsx
|       |   |   |   +-- callback/
|       |   |   |       +-- route.ts  OAuth callback handler
|       |   |   +-- (dashboard)/     Main dashboard route group
|       |   |   |   +-- layout.tsx   Sidebar + header + role context
|       |   |   |   +-- page.tsx     Dashboard overview (KPIs, charts)
|       |   |   |   +-- residents/
|       |   |   |   |   +-- page.tsx        Server component: list
|       |   |   |   |   +-- [id]/
|       |   |   |   |       +-- page.tsx    Server component: detail
|       |   |   |   +-- units/
|       |   |   |   |   +-- page.tsx
|       |   |   |   +-- access/
|       |   |   |   |   +-- page.tsx        Access logs
|       |   |   |   |   +-- invitations/
|       |   |   |   |   +-- blacklist/
|       |   |   |   +-- finance/
|       |   |   |   |   +-- page.tsx        Financial overview
|       |   |   |   |   +-- payments/
|       |   |   |   |   +-- fees/
|       |   |   |   |   +-- reports/
|       |   |   |   +-- amenities/
|       |   |   |   +-- maintenance/
|       |   |   |   +-- communications/
|       |   |   |   |   +-- page.tsx
|       |   |   |   |   +-- announcements/
|       |   |   |   |   +-- surveys/
|       |   |   |   +-- reports/
|       |   |   |   +-- settings/
|       |   |   |       +-- page.tsx
|       |   |   |       +-- community/
|       |   |   |       +-- roles/
|       |   |   +-- (super-admin)/   Super admin only route group
|       |   |       +-- layout.tsx   Role guard (redirect if not super_admin)
|       |   |       +-- communities/
|       |   |       +-- organizations/
|       |   |       +-- platform/
|       |   +-- components/
|       |   |   +-- ui/              shadcn/ui components
|       |   |   +-- dashboard/       Sidebar, Header, Breadcrumbs
|       |   |   +-- data-tables/     Generic DataTable + column defs
|       |   |   +-- forms/           Form components with react-hook-form
|       |   |   +-- charts/          Dashboard chart components
|       |   +-- hooks/
|       |   |   +-- useAuth.ts
|       |   |   +-- queries/         TanStack Query hooks
|       |   +-- lib/
|       |   |   +-- supabase/
|       |   |   |   +-- client.ts    createBrowserClient from @supabase/ssr
|       |   |   |   +-- server.ts    createServerClient from @supabase/ssr
|       |   |   +-- utils.ts
|       |   +-- middleware.ts        Auth token refresh + route protection
|       +-- public/
|       +-- next.config.ts           [EXISTS]
|       +-- package.json             [EXISTS]
|       +-- tsconfig.json            [EXISTS]
|
+-- supabase/                       [EXISTS] Migrations, edge functions, config
+-- pnpm-workspace.yaml             [EXISTS] packages: ["packages/*"]
+-- package.json                    [EXISTS] Root workspace scripts
+-- pnpm-lock.yaml                  [EXISTS]
```

### Structure Rationale

- **`app/` directory (both apps):** File-based routing is the standard for both Expo Router and Next.js App Router. Routes live in `app/`, non-route code lives in `src/`. This is consistent across both platforms.
- **Route groups with parentheses:** `(auth)`, `(resident)`, `(guard)`, `(dashboard)` group routes without affecting URL structure. This is essential for applying different layouts (tab bars on mobile, sidebar on web) per role.
- **`src/hooks/queries/`:** TanStack Query hooks wrapping Supabase calls. One file per domain (visitors, payments, etc.). Query keys imported from `@upoe/shared` ensure cache consistency.
- **`src/stores/`:** Zustand stores for truly client-side state only (UI preferences, form state). All server state belongs in TanStack Query cache.
- **`src/providers/`:** React context providers wrapping the app tree: auth session, query client configuration.
- **`src/components/ui/`:** Primitive UI components built independently per platform. NativeWind on mobile, shadcn/ui on web. These are NOT shared.

---

## Architectural Patterns

### Pattern 1: Role-Based Navigation with Stack.Protected (Mobile)

**What:** Use Expo Router's `Stack.Protected` API to declaratively render different navigation trees based on the user role extracted from JWT `app_metadata`.
**When to use:** Root layout of the mobile app to gate role-specific tab groups.
**Confidence:** HIGH -- verified in official Expo Router docs (SDK 53+ feature, current SDK is 54)

**Trade-offs:**
- Pro: Declarative -- automatic redirect when auth state changes, no manual navigation logic
- Pro: Deep links are automatically protected -- unauthenticated deep links redirect to sign-in
- Pro: Guard props can be nested for hierarchical access control
- Con: Client-side only -- not a substitute for server-side RLS (which UPOE already enforces)
- Con: Entire route group files must exist on disk even if user never sees them

**Example:**

```typescript
// packages/mobile/app/_layout.tsx
import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { SYSTEM_ROLES } from '@upoe/shared';

function RootNavigator() {
  const { session, isLoading } = useSession();
  const role = session?.appMetadata?.role;

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

      {/* Admin roles on mobile */}
      <Stack.Protected guard={
        role === SYSTEM_ROLES.COMMUNITY_ADMIN || role === SYSTEM_ROLES.MANAGER
      }>
        <Stack.Screen name="(admin)" />
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

```typescript
// packages/mobile/app/(resident)/_layout.tsx
import { Tabs } from 'expo-router';

export default function ResidentLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#4F46E5' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="visitors"
        options={{
          title: 'Visitantes',
          tabBarIcon: ({ color, size }) => <UsersIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pagos',
          tabBarIcon: ({ color, size }) => <WalletIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color, size }) => <MessageIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mas',
          tabBarIcon: ({ color, size }) => <MenuIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

```typescript
// packages/mobile/app/(guard)/_layout.tsx
import { Tabs } from 'expo-router';

export default function GuardLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#DC2626' }}>
      <Tabs.Screen name="index" options={{ title: 'Caseta' }} />
      <Tabs.Screen name="gate" options={{ title: 'Acceso' }} />
      <Tabs.Screen name="patrol" options={{ title: 'Rondines' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidentes' }} />
    </Tabs>
  );
}
```

### Pattern 2: Server/Client Component Split (Next.js Admin)

**What:** Use Next.js server components for data fetching (list pages, detail pages) and client components only for interactive UI (forms, real-time subscriptions, data tables with client-side sorting/filtering).
**When to use:** Every page in the admin dashboard.
**Confidence:** HIGH -- Next.js 16 App Router standard pattern, verified via official docs

**Trade-offs:**
- Pro: Data fetching on the server means no loading spinners for initial page load
- Pro: Supabase server client uses cookies, no API keys exposed in client bundle
- Pro: Smaller client JS bundles since data fetching code stays server-side
- Con: Cannot use Supabase Realtime in server components (requires persistent client connection)
- Con: Interactive features (forms, table filters, search) require `"use client"` directive

**Example:**

```typescript
// packages/admin/src/app/(dashboard)/residents/page.tsx
// SERVER COMPONENT (default in App Router -- no directive needed)
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResidentTable } from '@/components/data-tables/ResidentTable';

export default async function ResidentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: residents } = await supabase
    .from('residents')
    .select('*, occupancies(unit:units(name, block))')
    .order('created_at', { ascending: false })
    .limit(50);

  // Pass server-fetched data to interactive client component
  return (
    <div>
      <h1 className="text-2xl font-bold">Residentes</h1>
      <ResidentTable initialData={residents ?? []} />
    </div>
  );
}
```

```typescript
// packages/admin/src/components/data-tables/ResidentTable.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@upoe/shared';
import type { Tables } from '@upoe/shared';

interface Props {
  initialData: Tables<'residents'>[];
}

export function ResidentTable({ initialData }: Props) {
  const supabase = createClient();

  const { data: residents } = useQuery({
    queryKey: queryKeys.residents.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('*, occupancies(unit:units(name, block))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    initialData, // Server-fetched data used as initial cache
  });

  // DataTable with client-side sorting, filtering, pagination
  return <DataTable columns={residentColumns} data={residents} />;
}
```

### Pattern 3: Dual Auth Strategy (Mobile: SecureStore vs Web: Cookies)

**What:** Mobile app uses `@supabase/supabase-js` directly with an encrypted SecureStore adapter for session persistence. Web admin uses `@supabase/ssr` with cookie-based sessions and Next.js middleware for JWT refresh.
**When to use:** Auth initialization and session management in each platform.
**Confidence:** HIGH -- official Supabase patterns for each platform, verified via docs

**Trade-offs:**
- Pro: Each platform uses its native session storage mechanism
- Pro: Web gets automatic server-side auth validation in middleware
- Pro: Mobile gets encrypted device-local sessions via SecureStore + MMKV
- Con: Two different Supabase client creation patterns that cannot be fully unified
- Con: Mobile SecureStore has 2KB limit -- requires encryption adapter for larger sessions

**The shared package provides typed interfaces and constants, but each platform creates its own Supabase client instance with platform-appropriate storage:**

```typescript
// packages/mobile/src/lib/storage.ts
// Encrypted session storage: MMKV encrypted with key stored in SecureStore
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';
import * as Crypto from 'expo-crypto';

const mmkv = new MMKV({ id: 'supabase-storage' });

export class LargeSecureStore {
  private async _getEncryptionKey(): Promise<string> {
    let key = await SecureStore.getItemAsync('session-encryption-key');
    if (!key) {
      key = Crypto.randomUUID();
      await SecureStore.setItemAsync('session-encryption-key', key);
    }
    return key;
  }

  async getItem(key: string): Promise<string | null> {
    return mmkv.getString(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    mmkv.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    mmkv.delete(key);
  }
}
```

```typescript
// packages/mobile/src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from './storage';
import type { Database } from '@upoe/shared';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // No URL-based auth on native
  },
});
```

```typescript
// packages/admin/src/lib/supabase/server.ts
// Web: cookie-based server client via @supabase/ssr
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@upoe/shared';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (read-only context)
          }
        },
      },
    }
  );
}
```

```typescript
// packages/admin/src/lib/supabase/client.ts
// Web: browser client via @supabase/ssr
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@upoe/shared';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Pattern 4: TanStack Query for Server State + Zustand for Client State

**What:** Use TanStack Query (React Query v5) for all data fetched from Supabase (caching, deduplication, background refetch, optimistic updates). Use Zustand only for truly client-local state (UI preferences, form drafts, offline mutation queue).
**When to use:** Both mobile and admin apps for all data operations.
**Confidence:** HIGH -- TanStack Query v5 officially supports React Native; Zustand is the most popular React Native state library per State of React Native 2024 survey

**Trade-offs:**
- Pro: TanStack Query handles caching, deduplication, background refetch, optimistic updates, error/loading states automatically
- Pro: Zustand is minimal (~1KB) with no boilerplate for the small amount of client state needed
- Pro: Shared query key factories from `@upoe/shared` ensure both apps use identical cache keys
- Con: Must be disciplined about what goes where (server state in Query, client state in Zustand)

**Shared query key factory (in @upoe/shared):**

```typescript
// packages/shared/src/queries/keys.ts
export const queryKeys = {
  // Residents domain
  residents: {
    all: ['residents'] as const,
    list: (communityId?: string) =>
      ['residents', 'list', { communityId }] as const,
    detail: (id: string) =>
      ['residents', 'detail', id] as const,
    byUnit: (unitId: string) =>
      ['residents', 'unit', unitId] as const,
  },

  // Visitors domain
  visitors: {
    all: ['visitors'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['visitors', 'list', filters] as const,
    active: (communityId: string) =>
      ['visitors', 'active', communityId] as const,
    detail: (id: string) =>
      ['visitors', 'detail', id] as const,
  },

  // Payments domain
  payments: {
    all: ['payments'] as const,
    byUnit: (unitId: string) =>
      ['payments', 'unit', unitId] as const,
    balance: (unitId: string) =>
      ['payments', 'balance', unitId] as const,
  },

  // Access logs domain
  accessLogs: {
    all: ['access-logs'] as const,
    recent: (accessPointId: string) =>
      ['access-logs', 'recent', accessPointId] as const,
    today: (communityId: string) =>
      ['access-logs', 'today', communityId] as const,
  },

  // Amenities domain
  amenities: {
    all: ['amenities'] as const,
    list: (communityId: string) =>
      ['amenities', 'list', communityId] as const,
    reservations: (amenityId: string, date?: string) =>
      ['amenities', 'reservations', amenityId, date] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    unread: (userId: string) =>
      ['notifications', 'unread', userId] as const,
  },

  // KPIs (admin dashboard)
  kpis: {
    all: ['kpis'] as const,
    summary: (communityId: string, period: string) =>
      ['kpis', 'summary', communityId, period] as const,
  },
} as const;
```

**TanStack Query hook example (mobile):**

```typescript
// packages/mobile/src/hooks/queries/useVisitors.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@upoe/shared';
import type { InsertTables } from '@upoe/shared';

export function useActiveVisitors(communityId: string) {
  return useQuery({
    queryKey: queryKeys.visitors.active(communityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, resident:residents(full_name), unit:units(name)')
        .eq('community_id', communityId)
        .in('status', ['active', 'pending'])
        .order('expected_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000, // 30s -- visitor data changes frequently
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitation: InsertTables<'invitations'>) => {
      const { data, error } = await supabase
        .from('invitations')
        .insert(invitation)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitors.all });
    },
  });
}
```

**Zustand store example (client state only):**

```typescript
// packages/mobile/src/stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  selectedAccessPointId: string | null;
  filterStatus: string | null;
  isDarkMode: boolean;
  setSelectedAccessPoint: (id: string | null) => void;
  setFilterStatus: (status: string | null) => void;
  toggleDarkMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedAccessPointId: null,
  filterStatus: null,
  isDarkMode: false,
  setSelectedAccessPoint: (id) => set({ selectedAccessPointId: id }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
}));
```

### Pattern 5: Supabase Realtime with TanStack Query Cache Invalidation

**What:** Subscribe to Supabase Realtime channels per-screen (not globally). When a database change event arrives, invalidate the relevant TanStack Query cache to trigger a refetch. This keeps the Realtime layer thin (event notification) while TanStack Query handles the actual data consistency.
**When to use:** Guard gate operations (access logs), chat messages, notifications, visitor check-in/out status.
**Confidence:** HIGH -- both Supabase Realtime and TanStack Query cache invalidation are well-documented

**Trade-offs:**
- Pro: Clean separation -- Realtime provides "something changed" signal, TanStack Query provides "here is the new data"
- Pro: Cache invalidation is declarative and consistent
- Pro: Unsubscribe on screen unmount prevents connection waste
- Con: Each subscription consumes a WebSocket connection (Supabase has per-plan limits)
- Con: Small latency between Realtime event and refetch completion

**Example:**

```typescript
// packages/mobile/src/hooks/useRealtimeInvalidation.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Generic hook: subscribe to a table and invalidate query keys on changes.
 * Subscribes on mount, unsubscribes on unmount.
 */
export function useRealtimeInvalidation(
  table: string,
  communityId: string,
  queryKeysToInvalidate: readonly unknown[][]
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`${table}:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `community_id=eq.${communityId}`,
        },
        () => {
          // Invalidate all provided query keys
          queryKeysToInvalidate.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, communityId, queryClient]);
}
```

```typescript
// Usage in guard gate screen:
function GateScreen() {
  const { communityId } = useAuth();

  // Fetch access logs
  const { data: logs } = useRecentAccessLogs(communityId);

  // Subscribe to real-time updates -- auto-invalidates cache
  useRealtimeInvalidation(
    'access_logs',
    communityId,
    [queryKeys.accessLogs.all, queryKeys.accessLogs.today(communityId)]
  );

  return <AccessLogList logs={logs} />;
}
```

### Pattern 6: Next.js Middleware for Auth + Lightweight Route Protection

**What:** Next.js middleware refreshes the Supabase auth token on every request via cookies and performs lightweight route protection (redirect unauthenticated users). Complex role-based checks happen in server components or layouts, NOT in middleware.
**When to use:** Every admin app request.
**Confidence:** HIGH -- official Supabase SSR docs for Next.js, verified

**Critical security rules:**
- ALWAYS use `supabase.auth.getUser()` in middleware, NEVER `getSession()`. The `getUser()` method validates the JWT with the Supabase Auth server on every call. `getSession()` only reads the JWT locally and can be spoofed by anyone.
- Keep middleware lightweight: no database queries, no complex logic.
- Role-based gating belongs in route group layouts (e.g., `(super-admin)/layout.tsx`), not middleware.

**Example:**

```typescript
// packages/admin/src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
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

  // CRITICAL: Always getUser(), never getSession()
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to sign-in
  const isAuthRoute = request.nextUrl.pathname.startsWith('/sign-in') ||
                      request.nextUrl.pathname.startsWith('/callback');

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from sign-in
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

```typescript
// Role-based protection in a route group LAYOUT (not middleware)
// packages/admin/src/app/(super-admin)/layout.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SYSTEM_ROLES } from '@upoe/shared';

export default async function SuperAdminLayout({
  children,
}: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const role = user.app_metadata?.role;
  if (role !== SYSTEM_ROLES.SUPER_ADMIN) {
    redirect('/'); // Not a super admin -- redirect to main dashboard
  }

  return <>{children}</>;
}
```

### Pattern 7: Dashboard Layout with Sidebar (Next.js)

**What:** The `(dashboard)` route group has a layout that renders a persistent sidebar navigation and a header with user info/role context. The sidebar state persists across page navigation within the dashboard.
**When to use:** All community admin and super admin pages.
**Confidence:** HIGH -- standard Next.js App Router layout pattern

```typescript
// packages/admin/src/app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { ADMIN_ROLES, isAdminRole } from '@upoe/shared';

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const role = user.app_metadata?.role;
  if (!isAdminRole(role)) redirect('/unauthorized');

  const communityId = user.app_metadata?.community_id;

  return (
    <div className="flex h-screen">
      <Sidebar role={role} communityId={communityId} />
      <div className="flex flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## Data Flow

### Authentication Flow (Mobile)

```
[User opens app]
    |
    v
[Root _layout.tsx] --> [SessionProvider]
    |                     |
    |                     v
    |                  [Check SecureStore for saved session]
    |                     |
    |                     +--> [No session / expired]
    |                     |        |
    |                     |        v
    |                     |     Stack.Protected guard={!session}
    |                     |        |
    |                     |        v
    |                     |     [(auth) group: sign-in screen]
    |                     |        |
    |                     |        v
    |                     |     [supabase.auth.signInWithPassword()]
    |                     |        |
    |                     |        v
    |                     |     [Session saved to SecureStore]
    |                     |        |
    |                     |        v
    |                     |     [SessionProvider re-renders, guards re-evaluate]
    |                     |
    |                     +--> [Valid session found]
    |                              |
    |                              v
    |                           [Read role from app_metadata]
    |                              |
    |                              +--> resident  --> [(resident) tab group]
    |                              +--> guard     --> [(guard) tab group]
    |                              +--> admin     --> [(admin) tab group]
```

### Authentication Flow (Admin Web)

```
[Browser request to /dashboard]
    |
    v
[middleware.ts]
    |
    v
[Create Supabase server client with request cookies]
    |
    v
[supabase.auth.getUser()]  -- validates JWT with Supabase Auth server
    |
    +--> [Invalid / no user] --> 302 redirect to /sign-in
    |
    +--> [Valid user] --> refresh cookies in response
                             |
                             v
                         [Server Component renders]
                             |
                             v
                         [Create server client again with cookies()]
                             |
                             v
                         [supabase.from('table').select()  -- RLS enforced]
                             |
                             v
                         [HTML streamed to browser]
                             |
                             v
                         [Client components hydrate with initialData]
                             |
                             v
                         [Browser client for mutations / realtime]
```

### State Management Separation

```
SERVER STATE (managed by TanStack Query)      CLIENT STATE (managed by Zustand)
==========================================    ==========================================
 - Residents, units, occupancies               - Selected access point filter
 - Visitor invitations                         - Current form draft (before submit)
 - Payment history and balances                - Dark mode / theme preference
 - Access logs                                 - Bottom sheet open/closed state
 - Chat messages and conversations             - Camera/scanner active state
 - Maintenance tickets                         - Table sort/filter preferences
 - Amenity reservations                        - Sidebar collapsed state (admin)
 - Notifications                               - Selected date range for reports
 - Community settings
 - All data from Supabase
```

---

## Integration Points with Existing Supabase Backend

### Backend Services

| Service | Mobile Integration | Admin Integration | Shared Code |
|---------|-------------------|-------------------|-------------|
| **Auth** | `supabase-js` + SecureStore | `@supabase/ssr` + cookies + middleware | `AppMetadata` type, `SYSTEM_ROLES`, `isAdminRole()` |
| **PostgREST** | Direct queries via `supabase.from()` | Server: server client; Client: browser client | `Database` types, `Tables<T>`, `InsertTables<T>` query keys |
| **Realtime** | Hooks with channel subscribe/unsubscribe | Client components only | Channel naming convention |
| **Storage** | Upload via `supabase.storage.from(bucket)` | Upload in client components; display via signed URLs | `STORAGE_BUCKETS`, `getStoragePath()` |
| **Edge Functions** | `supabase.functions.invoke('fn-name')` | Same client-side, or call from server actions | Request/response types |
| **RLS** | Automatic via JWT `app_metadata.community_id` | Automatic via JWT in cookies | No code needed -- RLS is transparent |

### What @upoe/shared Provides vs Does NOT Provide

| Shared (platform-agnostic) | NOT Shared (platform-specific) |
|---------------------------|-------------------------------|
| `Database` type (generated) | UI components (View/Text vs div/span) |
| `Tables<T>`, `InsertTables<T>`, `Enums<T>` | Supabase client instances |
| `SYSTEM_ROLES`, `ROLE_LABELS`, `isAdminRole()` | Navigation logic / route definitions |
| `STORAGE_BUCKETS`, `getStoragePath()` | Session storage implementation |
| `queryKeys` factory object | Platform hooks (useColorScheme, etc.) |
| Zod validation schemas | Styling (NativeWind vs Tailwind CSS) |
| `AppMetadata`, `UserSession` interfaces | Push notification setup |
| Pure utility functions (formatCurrency, formatDate) | Camera, QR scanner, biometrics |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-5 communities (MVP) | Single Supabase project, monolith frontend. TanStack Query defaults. No Realtime optimization needed. All data fetched eagerly. |
| 5-50 communities | Add query pagination to all list pages. Subscribe to Realtime only on active screens. Tune `staleTime` per query domain. Admin server components with streaming. |
| 50-500 communities | Connection pooling tuning. Realtime subscription count monitoring. Consider Edge caching for admin static content. Split super-admin if traffic diverges. Mobile: offline-first with TanStack Query persistence. |
| 500+ communities | Evaluate Supabase project-per-org sharding. Read replicas for admin analytics. Mobile offline-first mandatory. Rate limit Edge Functions. CDN for Storage assets. |

### Scaling Priorities

1. **First bottleneck: Realtime connections.** Each guard on a gate screen = 1 persistent WebSocket. Supabase Pro tier allows 500 concurrent connections. **Mitigation:** Subscribe only on active screens; unsubscribe when screen loses focus. Use `AppState` listener on mobile to pause/resume subscriptions.

2. **Second bottleneck: List page query performance.** `access_logs` and `payments` tables grow continuously. **Mitigation:** Always paginate with cursor-based pagination. The backend already has BRIN indexes on timestamp columns. Never fetch unbounded lists.

3. **Third bottleneck: Admin dashboard initial load.** Heavy overview pages with KPIs and charts. **Mitigation:** Use the pre-computed `kpi_*` summary tables built in Phase 8 instead of live aggregations. Server components fetch on the server, so initial render is fast.

---

## Anti-Patterns

### Anti-Pattern 1: Sharing UI Components Between Mobile and Web

**What people do:** Create a component library used by both React Native and Next.js (e.g., `<SharedButton>`).
**Why it is wrong:** React Native uses `<View>`, `<Text>`, `<Pressable>` with StyleSheet or NativeWind. Web uses `<div>`, `<span>`, `<button>` with CSS/Tailwind. Abstraction layers over these create fragile, hard-to-debug, platform-lowest-common-denominator components that cannot use platform-native patterns.
**Do this instead:** Share types, constants, validation schemas, query keys, and utility functions via `@upoe/shared`. Build UI independently per platform. Mobile and web have different UX conventions and this is correct.

### Anti-Pattern 2: Using getSession() for Server-Side Auth Verification

**What people do:** Call `supabase.auth.getSession()` in Next.js middleware or server components to check authentication.
**Why it is wrong:** `getSession()` reads the JWT from cookies without validating it with the Supabase Auth server. A client can craft a fake JWT. The Supabase official docs explicitly warn against this.
**Do this instead:** Always use `supabase.auth.getUser()` in server contexts. It sends a request to Supabase Auth to cryptographically validate the token. The small latency cost is worth the security guarantee.

### Anti-Pattern 3: Global Realtime Subscriptions on App Start

**What people do:** Subscribe to all relevant tables when the mobile app initializes.
**Why it is wrong:** Each subscription holds an open WebSocket connection. Subscribing to tables the user is not viewing wastes connections and mobile bandwidth. Supabase has per-plan connection limits.
**Do this instead:** Subscribe per-screen in `useEffect`, unsubscribe in the cleanup function. The guard gate screen subscribes to `access_logs`. The chat screen subscribes to `messages`. Neither subscribes when not visible.

### Anti-Pattern 4: Fat @upoe/shared Package

**What people do:** Put React hooks, Supabase client instances, or platform-specific code (like `import { View }`) into the shared package.
**Why it is wrong:** The shared package must be importable by both Expo (React Native bundler) and Next.js (webpack/turbopack). React Native imports crash in Node.js server contexts. Browser APIs crash in React Native.
**Do this instead:** Keep `@upoe/shared` as pure TypeScript with zero runtime platform dependencies. It exports types, constants, pure functions, and Zod schemas. Nothing else.

### Anti-Pattern 5: Duplicating Server State in Zustand

**What people do:** Fetch data with Supabase, store the response in a Zustand store, and manually manage loading/error/stale states.
**Why it is wrong:** TanStack Query already provides caching, background refetch, stale/fresh tracking, error handling, deduplication, and optimistic updates. Putting the same data in Zustand creates two sources of truth that drift apart.
**Do this instead:** TanStack Query for ALL server state. Zustand for truly client-only state (UI preferences, form drafts, camera state). If you are calling `zustandStore.setState({ residents: data })` after a Supabase fetch, refactor to `useQuery`.

### Anti-Pattern 6: Complex Authorization Logic in Next.js Middleware

**What people do:** Query the database for user roles, permissions, or community membership inside middleware.
**Why it is wrong:** Middleware runs on EVERY request. Database queries add latency to every page load. Next.js docs explicitly recommend keeping middleware lightweight.
**Do this instead:** Middleware handles only: (1) JWT refresh via `getUser()`, (2) redirect unauthenticated users. Role-based route protection belongs in the layout component for each route group (e.g., `(super-admin)/layout.tsx` checks `app_metadata.role`). The role is already in the JWT claims -- no database query needed.

---

## Build Order (Dependencies for Roadmap Phase Structure)

This section is critical for roadmap creation -- it shows what must be built before what.

```
LAYER 0: Shared Package Extensions (no frontend dependency)
============================================================
  - Add queryKeys factory to @upoe/shared
  - Add Zod validators to @upoe/shared
  - Add helper functions (formatters, permissions) to @upoe/shared
  Dependencies: none
  Both apps will import from shared immediately.

LAYER 1: Project Scaffolding (depends on Layer 0)
============================================================
  Mobile:
    - Convert to Expo Router (file-based routing in app/ directory)
    - Configure NativeWind v4 with Tailwind CSS
    - Configure Metro for monorepo (SDK 54 auto-detects)
    - Set up environment variables (.env)

  Admin:
    - Configure transpilePackages for @upoe/shared in next.config.ts
    - Verify Tailwind CSS 4 setup
    - Set up environment variables (.env.local)

  Dependencies: @upoe/shared must export cleanly

LAYER 2: Authentication (depends on Layer 1)
============================================================
  Mobile:
    - LargeSecureStore adapter for sessions
    - Supabase client with SecureStore
    - SessionProvider context
    - Auth screens: sign-in, sign-up, forgot-password
    - Auth state listener (onAuthStateChange)

  Admin:
    - @supabase/ssr setup: server.ts + client.ts
    - middleware.ts for token refresh + redirect
    - Auth pages: sign-in, callback route handler
    - Auth state check in layouts

  Dependencies: Supabase Auth must be available (it is -- existing backend)

LAYER 3: Navigation Shell (depends on Layer 2)
============================================================
  Mobile:
    - Root _layout.tsx with Stack.Protected guards
    - (auth) layout
    - (resident) tab layout with placeholder screens
    - (guard) tab layout with placeholder screens
    - (admin) tab layout with placeholder screens

  Admin:
    - (auth) layout (centered card, no sidebar)
    - (dashboard) layout (sidebar + header)
    - (super-admin) layout (role guard)
    - Placeholder pages for each section

  Dependencies: Auth must work so guards can evaluate role

LAYER 4: Core Data Layer (depends on Layer 3)
============================================================
  Both apps:
    - TanStack Query provider setup
    - First query hooks (useResidents, useUnits, useCommunity)
    - Data fetching patterns established

  Admin-specific:
    - Server component data fetching pattern
    - initialData prop passing to client components
    - DataTable component foundation

  Dependencies: Navigation shell provides the screens to render data in

LAYER 5: Feature Modules (depends on Layer 4, parallelizable)
============================================================
  Each feature module can be developed independently:

  a) Visitor Management
     - Mobile: create invitation, QR generation, invitation list
     - Admin: invitation overview, approval queue

  b) Access Control
     - Mobile (guard): gate dashboard, QR scan, manual check-in
     - Admin: access log viewer, blacklist management

  c) Financial
     - Mobile (resident): balance view, payment list, upload proof
     - Admin: billing overview, fee management, payment approval

  d) Amenities
     - Mobile: browse amenities, make reservation
     - Admin: manage amenities, view reservations

  e) Communications
     - Mobile: social wall, announcements, surveys
     - Admin: create announcements, manage surveys

  f) Maintenance
     - Mobile: create ticket, view status
     - Admin: ticket queue, assignment, SLA tracking

  Dependencies: Each needs auth + navigation + data layer foundation

LAYER 6: Real-time and Advanced (depends on Layers 4-5)
============================================================
  - Realtime subscriptions (gate screen, chat, notifications)
  - Push notification registration and handling
  - File uploads (storage integration)
  - Chat system (conversations, messages, read receipts)

  Dependencies: Feature screens must exist to attach realtime to

LAYER 7: Polish and Platform-Specific (depends on Layer 6)
============================================================
  - QR code scanner integration (expo-camera)
  - Biometric authentication (expo-local-authentication)
  - Admin analytics dashboards (charts, KPI summaries)
  - Super admin multi-community management
  - Offline support (TanStack Query persistence)
  - Deep linking configuration

  Dependencies: Core features must be stable
```

**Key dependency insight:** Authentication must be built FIRST because every subsequent feature depends on knowing who the user is and what role they have. The navigation shell comes SECOND because it provides the scaffolding into which feature screens are inserted. Feature modules in Layer 5 can be developed in parallel by different developers or in any order, as long as the foundation layers (0-4) are in place.

---

## Sources

**Official Documentation (HIGH confidence):**
- [Expo Router Introduction](https://docs.expo.dev/router/introduction/)
- [Expo Router Protected Routes](https://docs.expo.dev/router/advanced/protected/)
- [Expo Router Tabs](https://docs.expo.dev/router/advanced/tabs/)
- [Expo Router Common Navigation Patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/)
- [Expo Router Authentication](https://docs.expo.dev/router/advanced/authentication/)
- [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/)
- [Supabase Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Realtime Getting Started](https://supabase.com/docs/guides/realtime/getting_started)
- [Supabase React Native Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Next.js App Router Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [Next.js Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [TanStack Query React Native](https://tanstack.com/query/v5/docs/framework/react/react-native)
- [NativeWind v5 Installation](https://www.nativewind.dev/v5/getting-started/installation)

**Community Sources (MEDIUM confidence -- verified against official docs):**
- [Stack.Protected Role-Based Routing](https://dev.to/aaronksaunders/simplifying-auth-and-role-based-routing-with-stackprotected-in-expo-router-592m)
- [Expo Monorepo Example by byCedric](https://github.com/byCedric/expo-monorepo-example)
- [State of React Native 2024 -- State Management](https://results.stateofreactnative.com/en-US/state-management/)
- [NativeWind + Expo SDK 54 Compatibility](https://medium.com/@matthitachi/nativewind-styling-not-working-with-expo-sdk-54-54488c07c20d)

---

*Architecture research for: UPOE Frontend Applications (Expo + Next.js consuming Supabase)*
*Researched: 2026-02-06*
