---
phase: 09-auth-shared-infrastructure
plan: 04
subsystem: auth-screens
tags: [auth, forms, zod, supabase, react-native, nextjs, onboarding]

dependency-graph:
  requires: ["09-01", "09-02", "09-03"]
  provides: ["functional-auth-screens", "admin-onboarding-flow", "mobile-auth-flow", "web-auth-flow"]
  affects: ["09-05", "10-xx"]

tech-stack:
  added: []
  patterns: ["zod-form-validation", "supabase-auth-methods", "multi-step-form", "refreshSession-after-rpc"]

key-files:
  created: []
  modified:
    - packages/mobile/app/(auth)/sign-in.tsx
    - packages/mobile/app/(auth)/sign-up.tsx
    - packages/mobile/app/(auth)/forgot-password.tsx
    - packages/mobile/app/(auth)/onboarding.tsx
    - packages/admin/src/app/(auth)/sign-in/page.tsx
    - packages/admin/src/app/(auth)/sign-up/page.tsx
    - packages/admin/src/app/(auth)/forgot-password/page.tsx
    - packages/admin/src/app/(auth)/onboarding/page.tsx

decisions:
  - id: use-undefined-not-null-for-rpc
    choice: "Use undefined instead of null for optional RPC params"
    reason: "Database.types.ts generates string | undefined for optional params, not string | null"

metrics:
  duration: 4min
  completed: 2026-02-08
---

# Phase 09 Plan 04: Auth Screens Implementation Summary

Functional auth screens for both mobile (React Native/Expo) and web (Next.js) with Zod validation from @upoe/shared and Supabase auth method calls including admin onboarding RPC with session refresh.

## What Was Done

### Task 1: Mobile Auth Screens (sign-in, sign-up, forgot-password, onboarding)

Replaced 4 placeholder screens with fully functional implementations:

- **sign-in.tsx**: Email/password form validated with `signInSchema`, calls `signInWithPassword`. Session change triggers Stack.Protected re-evaluation. Links to sign-up and forgot-password.
- **sign-up.tsx**: Email/password/confirm form validated with `signUpSchema`, calls `signUp`. Shows success confirmation state with "Revisa tu email" message.
- **forgot-password.tsx**: Email form validated with `resetPasswordSchema`, calls `resetPasswordForEmail` with `upoe://reset-password` redirect. Shows sent confirmation.
- **onboarding.tsx**: Multi-step form (Step 1: org + community + optional address; Step 2: admin name + review summary). Validates with `adminOnboardingSchema`, calls `complete_admin_onboarding` RPC, then `refreshSession()` to get updated claims.

All screens use NativeWind className styling, KeyboardAvoidingView, ScrollView, and Spanish text.

### Task 2: Admin Web Auth Pages (sign-in, sign-up, forgot-password, onboarding)

Replaced 4 placeholder pages with functional `'use client'` implementations:

- **sign-in/page.tsx**: Email/password form, `signInSchema` validation, browser `createClient()`, `signInWithPassword`, `router.push('/')` on success. Indigo-themed Tailwind styling.
- **sign-up/page.tsx**: Email/password/confirm form, `signUpSchema` validation, `signUp`, success state with SVG checkmark.
- **forgot-password/page.tsx**: Email form, `resetPasswordSchema` validation, `resetPasswordForEmail` with `window.location.origin` callback redirect.
- **onboarding/page.tsx**: Multi-step form matching mobile flow. Calls `complete_admin_onboarding` RPC, `refreshSession()`, then `router.push('/')`.

All pages use Tailwind CSS, inline error display, labeled form inputs with accessible `htmlFor`/`id` pairs.

## Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| RPC optional params | `undefined` not `null` | Generated Database types use `string \| undefined` for optional RPC args |
| Form state | Simple `useState` | Plan explicitly requires no react-hook-form yet; simple forms don't need it |
| Error display | Inline red box + Alert (mobile) / inline only (web) | Mobile uses native Alert for auth errors; web uses inline for better UX |
| Supabase client instantiation (web) | Call `createClient()` inside handler | Browser client is cheap to create per action; avoids stale reference issues |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed null vs undefined for RPC optional params**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Plan used `|| null` for optional RPC params, but generated Database types expect `string | undefined`, not `string | null`
- **Fix:** Changed all optional params from `|| null` to `|| undefined`
- **Files modified:** `packages/mobile/app/(auth)/onboarding.tsx`, `packages/admin/src/app/(auth)/onboarding/page.tsx`
- **Commit:** 85ec0ca (fixed before commit)

## Verification Results

All 8 checks passed:
1. All 8 auth screen files exist (4 mobile + 4 web)
2. Mobile sign-in imports and uses `signInSchema` from `@upoe/shared`
3. Admin sign-in imports and uses `signInSchema` from `@upoe/shared`
4. Mobile onboarding calls `complete_admin_onboarding` RPC
5. Mobile onboarding calls `refreshSession()` after RPC
6. Admin onboarding calls `refreshSession()` after RPC
7. All 4 admin pages have `'use client'` directive
8. Mobile uses NativeWind className; admin uses Tailwind CSS

TypeScript: zero errors (mobile `tsc --noEmit` clean)
Build: admin `next build` succeeds, all pages render as static routes

## Commits

| Hash | Message |
|------|---------|
| 85ec0ca | feat(09-04): implement mobile auth screens with Zod validation |
| 22ae972 | feat(09-04): implement admin web auth pages with Zod validation |

## Next Phase Readiness

Plan 09-04 is complete. The 8 auth screens are functional and ready for integration testing. Plan 09-05 (TanStack Query + protected data fetching) can proceed. The onboarding flow's `refreshSession()` pattern is established for any future RPC calls that modify JWT claims.
