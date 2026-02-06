# Stack Research: UPOE Frontend Applications

**Domain:** React Native (Expo) mobile app + Next.js admin dashboard consuming Supabase backend
**Researched:** 2026-02-06
**Confidence:** HIGH (verified via npm registries, official docs, multiple credible sources)

---

## Executive Summary

This document covers the frontend-specific technology stack for building two applications on top of UPOE's existing Supabase backend (116 tables, 399 RLS policies, 206 functions). The backend stack (Supabase, PostgreSQL, RLS, Edge Functions) is already validated and NOT re-evaluated here.

**Key decisions:**

1. **Expo SDK 54** (stable) with React Native 0.81 -- SDK 55 is still in beta as of Feb 2026; start on SDK 54, upgrade to 55 once stable
2. **Expo Router v4** for file-based navigation with built-in `Stack.Protected` for role-based auth guards
3. **NativeWind 4.1** for mobile styling (Tailwind CSS syntax shared with admin dashboard's Tailwind 4)
4. **TanStack Query v5** as the universal data-fetching layer for both mobile and web
5. **Zustand v5** for lightweight client state (auth session, UI preferences)
6. **React Hook Form + Zod v4** for form validation across both platforms
7. **shadcn/ui** for the admin dashboard component library (already uses Tailwind 4)
8. **react-native-mmkv** for fast, encrypted local storage on mobile
9. **@supabase/ssr** for Next.js server-side auth with middleware token refresh

The existing `@upoe/shared` package (types, Supabase client factory, constants) is the integration bridge. Both apps import from it.

---

## Existing Foundation (DO NOT Add Again)

These are already in the monorepo. Listed for reference only.

| Package | Location | Version | Purpose |
|---------|----------|---------|---------|
| `@supabase/supabase-js` | `@upoe/shared` | ^2.49.1 (upgrade to ^2.95) | Supabase client |
| `next` | `@upoe/admin` | 16.1.6 | Web framework |
| `react` | `@upoe/admin` | 19.2.3 | UI library |
| `react-dom` | `@upoe/admin` | 19.2.3 | DOM rendering |
| `tailwindcss` | `@upoe/admin` | ^4 (4.1.18 installed) | CSS framework |
| `@tailwindcss/postcss` | `@upoe/admin` | ^4 | PostCSS plugin |
| `typescript` | all packages | ^5 (5.9.3 installed) | Type system |

**Action needed:** Upgrade `@supabase/supabase-js` from ^2.49.1 to ^2.95.0 in `@upoe/shared` for latest auth improvements and bug fixes.

---

## Recommended Stack: Mobile App (`@upoe/mobile`)

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Expo SDK | 54 (stable) | React Native framework | Current stable SDK. SDK 55 is beta only (Feb 2026). SDK 54 includes RN 0.81, React 19.1, precompiled iOS builds. Last SDK to support Legacy Architecture fallback, though New Architecture should be default. |
| React Native | 0.81.x | Mobile runtime | Bundled with Expo SDK 54. Includes precompiled XCFrameworks for iOS (120s -> 10s clean builds). |
| React | 19.1.x | UI library | Bundled with Expo SDK 54. Hooks, Suspense, transitions available. |
| Expo Router | ~4.0 | File-based navigation | Built on React Navigation. File-based routing matches Next.js mental model. `Stack.Protected` provides declarative auth guards. Typed routes, deep linking, universal links for free. |

**Confidence:** HIGH -- SDK 54 stable confirmed via [Expo Changelog](https://expo.dev/changelog/sdk-54), npm shows 54.0.33 as latest.

### Navigation & Routing

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `expo-router` | ~4.0 | File-based routing | Comes with Expo SDK 54. File-system routing, deep links, typed routes. `Stack.Protected` for role-based access (UPOE has 6 roles). |
| `react-native-screens` | (bundled) | Native screen optimization | Installed via `npx expo install`. Required dependency of Expo Router. |
| `react-native-safe-area-context` | (bundled) | Safe area handling | Required for proper layout on notch/island devices. |

**Why NOT React Navigation directly:** Expo Router IS React Navigation under the hood, but adds file-based routing, typed routes, and `Stack.Protected`. No reason to use raw React Navigation in a new Expo project.

**Confidence:** HIGH -- [Expo Router docs](https://docs.expo.dev/router/introduction/) confirm file-based routing, protected routes.

### Styling

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `nativewind` | ^4.1 (4.2.1 latest) | Tailwind CSS for React Native | Unifies styling between mobile and web. Admin dashboard uses Tailwind 4; NativeWind lets mobile use the same utility classes. v4.1 is production-ready with fast-refresh, lightningcss compiler. |
| `tailwindcss` | ^4.0 | CSS engine (peer dep) | Required peer dependency for NativeWind 4.1+. |

**Why NOT Tamagui:** While Tamagui has excellent build-time optimization, NativeWind is the pragmatic choice because the admin dashboard already uses Tailwind 4. Sharing a mental model and utility class vocabulary between mobile and web developers reduces cognitive overhead. NativeWind 4.1 supports most Tailwind features including animations (via reanimated).

**Why NOT Gluestack UI:** Gluestack uses NativeWind under the hood. Adding it would be adding a component library on top of a styling library. For UPOE, building custom components with NativeWind gives more control over the Spanish-language UI.

**NativeWind + Reanimated note:** NativeWind does NOT support Reanimated v4 as of Jan 2026. Use Reanimated v3 with NativeWind 4.1. This is fine -- Reanimated v3 is fully featured and stable.

**Confidence:** HIGH -- NativeWind 4.2.1 verified on [npm](https://www.npmjs.com/package/nativewind), [v4.1 announcement](https://www.nativewind.dev/blog/announcement-nativewind-v4-1).

### Data Fetching & Server State

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `@tanstack/react-query` | ^5.90 | Server state management | De facto standard for React data fetching in 2026. Caching, background refetch, optimistic updates, offline support. Works identically on mobile and web. |
| `@tanstack/react-query-devtools` | ^5.90 | Development tools (web only) | Essential for debugging cache state during admin dashboard development. |

**Why TanStack Query over raw Supabase subscriptions:** Supabase's `.select()` returns raw data. TanStack Query adds caching, deduplication, background refetching, retry logic, and optimistic updates. For a 116-table schema, you need a disciplined caching layer. TanStack Query also integrates cleanly with Supabase Realtime for cache invalidation.

**Pattern for UPOE:**
```typescript
// Shared hook in @upoe/shared or platform-specific packages
function useResidents(communityId: string) {
  return useQuery({
    queryKey: ['residents', communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('*, occupancies(unit:units(*))')
        .order('last_name');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min for resident data
  });
}
```

**Confidence:** HIGH -- v5.90.19 verified on [npm](https://www.npmjs.com/package/@tanstack/react-query). [Official React Native docs](https://tanstack.com/query/v5/docs/framework/react/react-native).

### Client State Management

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `zustand` | ^5.0 (5.0.11 latest) | Client-side state | ~3KB bundle. For auth session, UI preferences (dark mode, selected community), navigation state. No boilerplate. Works cross-platform. |

**Why NOT Redux Toolkit:** UPOE's client state is small -- auth session, UI preferences, current community selection. Zustand handles this with zero boilerplate. Redux is overkill. Server state is handled by TanStack Query.

**Why NOT Jotai:** Zustand's single-store model is simpler for team onboarding and for the relatively small client state UPOE needs. Jotai's atomic model excels for complex interdependent state, which isn't UPOE's pattern.

**Confidence:** HIGH -- v5.0.11 verified on [npm](https://www.npmjs.com/package/zustand).

### Forms & Validation

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `react-hook-form` | ^7.71 | Form state management | Uncontrolled components = minimal re-renders. Works on React Native and web. 4.9M weekly downloads, double Formik's. |
| `zod` | ^4.3 (4.3.5 latest) | Schema validation | TypeScript-first. Infers types from schemas. Shared validation between mobile and web. v4 is a major improvement: unified error API, smaller bundle. |
| `@hookform/resolvers` | ^5.2 | Bridge RHF + Zod | Connects react-hook-form with zod. v5.2 supports Zod v3.25+ and v4.0+ with auto-detection. |

**Why Zod v4 over v3:** Zod 4 is 2x faster, smaller bundle, and has a cleaner error API. The migration is manageable (see PITFALLS.md). During transition, import via `zod/v4` subpath if needed. `@hookform/resolvers` v5.2 auto-detects the version.

**Pattern for UPOE:**
```typescript
// Shared schema in @upoe/shared
import { z } from 'zod';

export const residentFormSchema = z.object({
  first_name: z.string().min(1, 'Nombre es requerido'),
  last_name: z.string().min(1, 'Apellido es requerido'),
  email: z.email('Email invalido'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Telefono invalido'),
  unit_id: z.string().uuid(),
});

export type ResidentFormData = z.infer<typeof residentFormSchema>;
```

**Confidence:** HIGH -- versions verified on npm. [Zod v4 release notes](https://zod.dev/v4).

### Storage & Persistence (Mobile)

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `react-native-mmkv` | ^4.1 (4.1.2 latest) | Fast key-value storage | 30x faster than AsyncStorage. Synchronous API. Encryption support. Use as Supabase auth session store. |
| `expo-secure-store` | (bundled with SDK 54) | Encryption key storage | iOS Keychain / Android Keystore. 2KB limit -- too small for Supabase session, but perfect for storing the encryption key used with MMKV. |

**Why NOT AsyncStorage alone:** AsyncStorage is async and unencrypted. MMKV is synchronous (no async/await needed), 30x faster, and supports encryption. For a security-focused app like UPOE (gate access, resident data), encrypted storage is not optional.

**Hybrid pattern for Supabase auth:**
1. Generate encryption key with `expo-crypto`
2. Store encryption key in `expo-secure-store` (hardware-backed, 2KB limit is fine for a key)
3. Initialize MMKV with that encryption key
4. Use MMKV as Supabase client's custom storage adapter

**Known issue:** react-native-mmkv 4.1.0/4.1.1 had Android build failures with Expo SDK 54 (NitroModules compilation error). Version 4.1.2 should address this -- verify before adopting.

**Confidence:** MEDIUM -- v4.1.2 verified on npm, but the SDK 54 compatibility issue was reported on [GitHub](https://github.com/mrousavy/react-native-mmkv/issues/985). Test early.

### Image & Media Handling

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `expo-image` | (bundled with SDK 54) | Image component | Replaces React Native's `<Image>`. Built on Glide (Android) + SDWebImage (iOS). Caching, blurhash, animated images. Official Expo recommendation. |
| `expo-image-picker` | (bundled with SDK 54) | Photo/video selection | Camera roll access + camera capture. Returns file URI for Supabase Storage upload. |
| `expo-camera` | (bundled with SDK 54) | Camera access | QR code scanning (visitor access), photo capture for incidents/evidence. |
| `expo-file-system` | (bundled with SDK 54) | File operations | SDK 54 stabilized the new API (was expo-file-system/next, now default). Needed for file uploads to Supabase Storage. |

**Image upload to Supabase Storage pattern:**
```typescript
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  quality: 0.8,
});

if (!result.canceled) {
  const file = result.assets[0];
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    type: file.mimeType ?? 'image/jpeg',
    name: file.fileName ?? 'upload.jpg',
  } as any);

  await supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .upload(getAvatarPath(userId, filename), formData);
}
```

**Confidence:** HIGH -- All are first-party Expo packages bundled with SDK 54. [expo-image docs](https://docs.expo.dev/versions/latest/sdk/image/).

### Push Notifications

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `expo-notifications` | ~0.32 (0.32.16 latest) | Push notification handling | Manages FCM (Android) + APNs (iOS). Token registration, notification display, action handling. Works with Expo Push Service or direct FCM/APNs. |
| `expo-device` | (bundled) | Device detection | Required to check if running on physical device (push notifications don't work on simulators). |
| `expo-constants` | (bundled) | Project ID access | Needed for `getExpoPushTokenAsync({ projectId })`. |

**Integration with existing backend:**
The database already has `push_tokens` and `notifications` tables. The `send-push` Edge Function exists. Frontend needs to:
1. Register device token on login using `expo-notifications`
2. Save token to `push_tokens` table via Supabase
3. Handle incoming notifications with notification handlers

**Important (SDK 54):** Push notifications no longer work in Expo Go. A Development Build is required for testing.

**Confidence:** HIGH -- [Expo notifications docs](https://docs.expo.dev/push-notifications/push-notifications-setup/).

### Animations

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `react-native-reanimated` | v3.x | Animations | v3 is required for NativeWind 4.1 compatibility. Do NOT use v4 (requires New Arch only AND is incompatible with NativeWind). v3 is fully featured for all UPOE animation needs. |
| `react-native-gesture-handler` | (bundled) | Gesture detection | Swipe-to-dismiss, pull-to-refresh, drag interactions. Required by Expo Router. |

**Confidence:** HIGH -- NativeWind v4.1 + Reanimated v3 is the documented stable combination. [Expo Reanimated docs](https://docs.expo.dev/versions/latest/sdk/reanimated/).

### Internationalization

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `i18next` | ^25.8 | i18n framework | Most mature i18n solution. 100+ locales. Works on mobile and web. |
| `react-i18next` | ^16.5 | React bindings | Hooks-based API. useTranslation() hook works in both React Native and Next.js. |
| `expo-localization` | ~17.0 | Device locale detection | Detects device language to auto-set locale. Expo first-party. |
| `date-fns` | ^4.x | Date formatting with locale | Tree-shakeable. Spanish locale support. Functional API. Preferred over dayjs for a project this size where tree-shaking matters. |

**UPOE is Spanish-first for Mexican market.** All UI strings in Spanish by default. i18next enables future expansion to English without refactoring. Locale files go in `@upoe/shared` so both apps share translations.

**Confidence:** HIGH -- versions verified on npm. [Expo localization docs](https://docs.expo.dev/guides/localization/).

---

## Recommended Stack: Admin Dashboard (`@upoe/admin`)

### Already Installed (Extend, Don't Replace)

Next.js 16.1.6, React 19.2.3, Tailwind CSS 4.1.18 are already in `@upoe/admin`.

### Supabase SSR Integration

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `@supabase/ssr` | ^0.8.0 | Server-side auth | Replaces deprecated @supabase/auth-helpers. Handles cookie-based sessions, middleware token refresh. Required for Next.js App Router. |

**Critical setup requirements:**
1. Create `utils/supabase/client.ts` -- browser client via `createBrowserClient`
2. Create `utils/supabase/server.ts` -- server client via `createServerClient` with cookie access
3. Create `middleware.ts` -- calls `updateSession()` to refresh expired tokens
4. ALWAYS use `supabase.auth.getUser()` in Server Components (NOT `getSession()` which doesn't revalidate)

**Confidence:** HIGH -- v0.8.0 verified on npm. [Official Supabase Next.js SSR guide](https://supabase.com/docs/guides/auth/server-side/nextjs).

### UI Components

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `shadcn/ui` | latest (CLI-based) | Component library | Not an npm package -- components are copied into the project. Built on Radix UI primitives. Fully customizable. Tailwind 4 support confirmed. React 19 compatible. |
| `radix-ui` | unified package | Accessible primitives | shadcn/ui's Feb 2026 update uses the unified `radix-ui` package instead of individual `@radix-ui/react-*` packages. |
| `lucide-react` | latest | Icons | Default icon library for shadcn/ui. Consistent, tree-shakeable. |

**Why NOT Material UI or Ant Design:** shadcn/ui is the dominant choice for Next.js + Tailwind projects in 2026. Components are owned (copied into project, not imported from node_modules), fully customizable, and use the same Tailwind classes the project already has. MUI and Ant Design bring their own styling systems that would conflict with Tailwind 4.

**Setup:**
```bash
npx shadcn@latest init
# Select: New York style, Tailwind CSS v4, unified radix-ui
```

**Confidence:** HIGH -- [shadcn/ui changelog](https://ui.shadcn.com/docs/changelog) confirms Tailwind v4 and React 19 support.

### Data Tables

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `@tanstack/react-table` | ^8.x | Headless table logic | Server-side pagination, sorting, filtering for admin tables (residents, payments, access logs). shadcn/ui's DataTable component is built on this. |

**Why headless table:** UPOE's admin dashboard needs tables for 116 database tables worth of data. TanStack Table provides sorting, filtering, pagination logic; shadcn/ui provides the visual components. Server-side processing handles the scale.

**Confidence:** HIGH -- [shadcn/ui DataTable docs](https://ui.shadcn.com/docs/components/radix/data-table).

### Charts & Analytics

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `recharts` | ^3.7 (3.7.0 latest) | Dashboard charts | Most popular React charting library. 10 years of stability. The database already has KPI summary tables (Phase 8). Recharts visualizes them: line charts for trends, bar charts for comparisons, area charts for usage. |

**Why NOT Tremor:** Tremor is built ON TOP of Recharts. Using Recharts directly gives more control and avoids an abstraction layer. For an admin dashboard with custom KPI visualizations, direct Recharts is better.

**Why NOT Chart.js:** Recharts is React-native (uses React components as API). Chart.js uses imperative canvas API that doesn't integrate as cleanly with React 19 Server Components.

**Confidence:** HIGH -- v3.7.0 verified on npm. [Recharts releases](https://github.com/recharts/recharts/releases).

### Date Handling (Web-specific)

For the admin dashboard, use the same `date-fns` from the shared package. The Spanish locale (`date-fns/locale/es`) handles Mexican date formatting conventions.

---

## Recommended Stack: Shared (`@upoe/shared`)

### Current Exports (Keep)

- `Database` types (393KB auto-generated)
- `createSupabaseClient()` factory
- `SYSTEM_ROLES`, `ROLE_LABELS`, `isAdminRole()`
- `STORAGE_BUCKETS`, `getStoragePath()`, `getAvatarPath()`

### New Shared Libraries to Add

| Library | Version | Purpose | Where Used |
|---------|---------|---------|------------|
| `zod` | ^4.3 | Validation schemas | Both apps: form validation, API response validation |
| `date-fns` | ^4.x | Date utilities | Both apps: date formatting with Spanish locale |
| `i18next` | ^25.8 | i18n core | Both apps: translation strings |

**Shared code categories to add to `@upoe/shared`:**
1. **Zod schemas** -- validation rules shared between mobile forms and admin forms
2. **i18n translation files** -- Spanish strings used by both apps
3. **Date formatting utilities** -- consistent date display across platforms
4. **TanStack Query key factories** -- consistent cache key naming
5. **Supabase query helpers** -- typed query functions both apps can use

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@tanstack/react-query-devtools` | Query cache inspector | Admin dashboard only (web). Invaluable for debugging stale data. |
| `@dev-plugins/react-native-mmkv` | MMKV inspector | Expo DevTools plugin. Inspect stored key-values during development. |
| `expo-dev-client` | Development builds | Required for testing native modules (push notifications, camera, MMKV). Expo Go is insufficient. |
| React Compiler | Auto-memoization | Stable in Next.js 16. Enable in `next.config.ts`. Eliminates manual `useMemo`/`useCallback`. |

---

## Installation Commands

### Mobile (`@upoe/mobile`)

```bash
# Initialize (if not already done)
npx create-expo-app@latest packages/mobile --template tabs

# Core Expo modules
npx expo install expo-router react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated

# Styling
npx expo install nativewind tailwindcss

# Data layer
pnpm add @tanstack/react-query zustand

# Forms
pnpm add react-hook-form @hookform/resolvers zod

# Storage
npx expo install react-native-mmkv react-native-nitro-modules expo-secure-store expo-crypto

# Auth support
npx expo install @react-native-async-storage/async-storage react-native-url-polyfill

# Media
npx expo install expo-image expo-image-picker expo-camera expo-file-system

# Push notifications
npx expo install expo-notifications expo-device expo-constants

# i18n
npx expo install expo-localization
pnpm add i18next react-i18next

# Date handling
pnpm add date-fns

# Dev tools
npx expo install expo-dev-client
pnpm add -D @dev-plugins/react-native-mmkv
```

### Admin Dashboard (`@upoe/admin`)

```bash
# Supabase SSR
pnpm add @supabase/ssr

# UI components (shadcn/ui init)
npx shadcn@latest init
npx shadcn@latest add button card input table dialog form select tabs badge avatar dropdown-menu sheet toast

# Data layer
pnpm add @tanstack/react-query @tanstack/react-table zustand

# Forms
pnpm add react-hook-form @hookform/resolvers zod

# Charts
pnpm add recharts

# i18n
pnpm add i18next react-i18next

# Date handling
pnpm add date-fns

# Dev tools
pnpm add -D @tanstack/react-query-devtools
```

### Shared Package (`@upoe/shared`)

```bash
# Add shared dependencies
pnpm add zod date-fns i18next
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Navigation | Expo Router v4 | React Navigation (raw) | Expo Router IS React Navigation + file-based routing + typed routes + Stack.Protected. No reason to go lower-level. |
| Mobile styling | NativeWind 4.1 | Tamagui | Tamagui is excellent but introduces a different styling paradigm. NativeWind matches the Tailwind 4 already used in admin dashboard. Shared vocabulary > marginal performance gain. |
| Mobile styling | NativeWind 4.1 | StyleSheet.create | Manual styles don't scale for a 100+ screen app. No design token sharing with web. |
| Data fetching | TanStack Query v5 | SWR | TanStack Query has richer features (optimistic updates, infinite queries, dependent queries). Wider adoption. Better React Native support. |
| Client state | Zustand v5 | Redux Toolkit | UPOE's client state is small (auth, UI prefs). Redux adds unnecessary boilerplate. |
| Client state | Zustand v5 | Jotai | Zustand's centralized store is simpler for team onboarding. UPOE doesn't need Jotai's atomic fine-grained reactivity. |
| Forms | React Hook Form | Formik | RHF has 2x the downloads, uncontrolled components = fewer re-renders. Formik is in maintenance mode. |
| Validation | Zod v4 | Yup | Zod is TypeScript-first with type inference. Yup requires separate type definitions. Zod v4 is faster and smaller. |
| Web components | shadcn/ui | Material UI | MUI brings its own styling (Emotion). Conflicts with Tailwind 4. shadcn/ui is built for Tailwind. |
| Web components | shadcn/ui | Ant Design | Ant Design's styling conflicts with Tailwind. Also, Ant Design's Chinese-first documentation is less ideal for the team. |
| Charts | Recharts 3 | Chart.js | Recharts uses React components as API. Chart.js is imperative/canvas-based. React 19 integration is cleaner with Recharts. |
| Charts | Recharts 3 | Tremor | Tremor wraps Recharts. Direct Recharts gives more control for custom KPI dashboards. |
| Storage | MMKV | AsyncStorage | MMKV is 30x faster, synchronous, and supports encryption. AsyncStorage is async and unencrypted. |
| i18n | i18next | expo-localization alone | expo-localization only detects device locale. i18next provides the full translation framework. They complement each other. |
| Date | date-fns | dayjs | dayjs is smaller (6KB vs 18KB) but date-fns is tree-shakeable and functional. For a project importing selectively, final bundle is similar. date-fns has better TypeScript support. |

---

## What NOT to Use (and Why)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated. No longer maintained. | `@supabase/ssr` ^0.8.0 |
| `@supabase/auth-helpers-react` | Deprecated. | `@supabase/supabase-js` directly with TanStack Query |
| `react-native-fast-image` | Unmaintained. expo-image uses same native libraries (Glide, SDWebImage) with better DX. | `expo-image` |
| `Formik` | Maintenance mode. 2x fewer downloads than RHF. Controlled components = more re-renders. | `react-hook-form` |
| `Yup` | No TypeScript type inference. Requires separate type definitions. | `zod` v4 |
| `styled-components` / `emotion` | Extra runtime, conflicts with Tailwind paradigm. | NativeWind (mobile), Tailwind CSS (web) |
| `MobX` | Overkill for UPOE's client state. Adds complexity. | Zustand |
| `react-native-reanimated` v4 | Incompatible with NativeWind 4.1. New Arch only. | Reanimated v3.x |
| `expo-sqlite` for general storage | SQLite is for relational data. Key-value storage should use MMKV. | `react-native-mmkv` |
| `@react-navigation/native` (direct) | Lower-level than needed. Expo Router wraps it with file-based routing. | `expo-router` |
| `NativeWind v5` | Still in preview (Feb 2026). Not production-ready. | NativeWind ^4.1 |
| `Expo SDK 55` | Beta only as of Feb 2026. Wait for stable release. | Expo SDK 54 |

---

## Version Compatibility Matrix

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Expo SDK 54 | React Native 0.81.x, React 19.1.x | Bundled versions. Do not override. |
| NativeWind 4.1+ | Tailwind CSS 4.x, Reanimated v3.x | Does NOT work with Reanimated v4. |
| react-native-mmkv 4.1.2 | Expo SDK 54 | Had build issues in 4.1.0/4.1.1 on Android. Verify 4.1.2 fixes them. |
| Zod v4.3 | @hookform/resolvers 5.2+ | Auto-detects Zod v3 vs v4 at runtime. |
| @supabase/ssr 0.8.0 | Next.js 16.x, @supabase/supabase-js 2.x | Required for App Router cookie auth. |
| shadcn/ui (Feb 2026) | React 19, Tailwind 4, unified radix-ui package | New York style uses single radix-ui package. |
| TanStack Query v5.90 | React 19, React Native 0.81 | Works on both platforms with same API. |
| recharts 3.7 | React 19 | Verified compatible. Uses React components API. |
| Next.js 16.1.6 | React 19.2.3, Tailwind 4, Turbopack | Turbopack is default for dev and build. React Compiler stable. |

---

## Stack Patterns by Platform

**Mobile-only packages** (install in `@upoe/mobile` only):
- expo-router, expo-image, expo-image-picker, expo-camera, expo-file-system
- expo-notifications, expo-device, expo-constants
- expo-secure-store, expo-localization, expo-crypto
- react-native-mmkv, react-native-reanimated, react-native-gesture-handler
- nativewind
- react-native-screens, react-native-safe-area-context

**Web-only packages** (install in `@upoe/admin` only):
- @supabase/ssr
- shadcn/ui components (copied into project)
- radix-ui, lucide-react
- @tanstack/react-table
- recharts
- @tanstack/react-query-devtools

**Shared packages** (install in `@upoe/shared`):
- zod, date-fns, i18next

**Both platforms** (install in each app separately):
- @tanstack/react-query
- react-hook-form, @hookform/resolvers
- zustand
- react-i18next

---

## Upgrade Path: SDK 54 to SDK 55

When Expo SDK 55 reaches stable (expected mid-February to March 2026):

1. **Benefits:** React Native 0.83, React 19.2, Hermes v1, smaller OTA updates, new default template
2. **Breaking:** Legacy Architecture fully removed, New Architecture is the only option
3. **Action items:**
   - Verify react-native-mmkv compatibility with RN 0.83
   - Verify NativeWind compatibility with SDK 55 (Reanimated v4 still not supported)
   - If using Reanimated, may need temporary override for react-native-worklets
   - Run `npx expo install --fix` to resolve peer dependency issues
4. **Risk:** LOW -- SDK 54 already defaults to New Architecture. The team should already be on New Arch.

---

## Sources

### Official Documentation (HIGH confidence)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) -- SDK features and bundled versions
- [Expo Router Introduction](https://docs.expo.dev/router/introduction/) -- File-based routing
- [Expo Router Protected Routes](https://docs.expo.dev/router/advanced/protected/) -- Stack.Protected for auth
- [Expo Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) -- Push notification configuration
- [Expo Using Supabase Guide](https://docs.expo.dev/guides/using-supabase/) -- Official integration guide
- [Supabase Next.js SSR Setup](https://supabase.com/docs/guides/auth/server-side/nextjs) -- @supabase/ssr with App Router
- [Supabase Expo Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) -- Getting started
- [TanStack Query React Native Docs](https://tanstack.com/query/v5/docs/framework/react/react-native) -- Official RN support
- [NativeWind v4.1 Announcement](https://www.nativewind.dev/blog/announcement-nativewind-v4-1) -- Stable release notes
- [shadcn/ui Changelog](https://ui.shadcn.com/docs/changelog) -- React 19 + Tailwind 4 support
- [Zod v4 Release Notes](https://zod.dev/v4) -- Breaking changes and improvements
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) -- Features and React 19.2

### npm Registry (HIGH confidence -- version verification)
- [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) -- v5.90.19
- [zustand](https://www.npmjs.com/package/zustand) -- v5.0.11
- [react-hook-form](https://www.npmjs.com/package/react-hook-form) -- v7.71.1
- [zod](https://www.npmjs.com/package/zod) -- v4.3.5
- [@hookform/resolvers](https://www.npmjs.com/package/@hookform/resolvers) -- v5.2.2
- [nativewind](https://www.npmjs.com/package/nativewind) -- v4.2.1
- [recharts](https://www.npmjs.com/package/recharts) -- v3.7.0
- [@supabase/ssr](https://www.npmjs.com/package/@supabase/ssr) -- v0.8.0
- [@supabase/supabase-js](https://www.npmjs.com/package/@supabase/supabase-js) -- v2.95.2
- [react-native-mmkv](https://www.npmjs.com/package/react-native-mmkv) -- v4.1.2
- [i18next](https://www.npmjs.com/package/i18next) -- v25.8.3
- [react-i18next](https://www.npmjs.com/package/react-i18next) -- v16.5.4

### Community Resources (MEDIUM confidence -- verified with official docs)
- [Expo SDK 55 Beta Changelog](https://expo.dev/changelog/sdk-55-beta) -- Upcoming features
- [NativeWind + Reanimated v4 incompatibility](https://github.com/nativewind/nativewind) -- Known limitation
- [react-native-mmkv SDK 54 Android build issue](https://github.com/mrousavy/react-native-mmkv/issues/985) -- Compatibility risk
- [Supabase MMKV session storage pattern](https://github.com/supabase/supabase/issues/6348) -- Integration approach

---
*Stack research for: UPOE Frontend Applications (React Native Expo + Next.js Admin Dashboard)*
*Researched: 2026-02-06*
