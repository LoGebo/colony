# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Milestone v2.0 -- COMPLETE

## Current Position

Phase: 16 of 16 (Push Notifications & Real-time Polish)
Plan: 3 of 3 in current phase
Status: Complete
Last activity: 2026-02-08 -- Completed Phase 16 (Push Notifications & Real-time Polish) -- all 3 plans

Progress: [██████████] 100% (36/36 v2.0 plans)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 38
- Average duration: 6.2 min
- Total execution time: ~236 min

**v2.0 Velocity:**
- Total plans completed: 35
- Average duration: 6.1 min
- Total execution time: ~254 min

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
- Lazy Supabase client creation in admin useAuth (avoids SSR prerender crashes)
- force-dynamic on auth-dependent dashboard pages
- occupancy_type='owner' priority for primary unit resolution (occupancies table lacks is_primary column)
- expo-file-system v19 File/Paths API (not legacy cacheDirectory/writeAsStringAsync)
- Client-side fallback QR payload with 'unsigned' signature until HMAC secret configured
- PostgREST FK hints required for ambiguous occupancies->residents joins (authorized_by vs resident_id)
- useGuardAccessPoint hook resolves required access_point_id for access_logs inserts
- Lazy Supabase client in queryFn (not hook body) to prevent SSR prerender crashes in financial hooks
- Inclusive RLS role update: community_admin added alongside admin (not replacing) for backwards compat
- Recharts v3 Tooltip formatter uses untyped value param with Number() cast
- record_charge RPC typed as 'never' cast (types not regenerated after migration deployment)
- Badge component has no size prop -- all badges use text-xs by default
- Use 'as never' cast for dynamic status/priority filter values in Supabase queries
- Non-null assertion on user!.id for mutations (admin must be authenticated)
- Photo attachments on tickets stored as ticket_comments with photo_urls array (not ticket fields)
- Internal comments (is_internal=true) filtered out in resident-facing ticket detail view
- Two-step create mutation for announcements: insert then call expand_announcement_recipients RPC explicitly
- Auto-mark announcement as read on detail screen mount using useEffect with ref guard
- Use 'as never' cast for RPC call and target_segment enum insert (types not regenerated)
- Document schema uses name/is_public/category-enum (not title/visibility/free-text-category as planned)
- amenity_rules requires community_id on insert (not just amenity_id)
- Card grid layout (not DataTable) for amenity list pages (fewer items, richer display)
- RLS identity mismatch fix: 20 policies across 12 tables use resident subquery instead of auth.uid()
- Client-side poll voting via posts.poll_results jsonb (formal governance uses elections/cast_vote RPC)
- Post media stored in community-assets bucket with posts/ category prefix
- Max 3 levels of comment thread indent (72px) on mobile
- Client-side month filtering for amenity reservations (PostgREST tstzrange ops unreliable)
- Local MarkedDates type definition (react-native-calendars doesn't re-export from main index)
- Hourly slots 8am-9pm default for amenity time picker
- documents table (not community_documents) in PostgREST types
- vehicles: no vehicle_type or is_primary columns; plate_state required, access_enabled boolean
- emergency_contacts: contact_name (not name), phone_primary (not phone), community_id required on insert
- residents: no resident_type or status columns; uses onboarding_status
- document_versions: storage_path/storage_bucket/file_name (not file_url/file_size/uploaded_at)
- Occupancy-based package query (packages -> occupancies -> units, not direct resident_id)
- Contact seller via WhatsApp deep link with SMS fallback (no in-app messaging)
- Marketplace photo uploads to community-assets bucket with marketplace/ category prefix
- Fire-and-forget RPCs for view_count and inquiry_count (no await)
- Alphabetized mergeQueryKeys entries for maintainability (was insertion-order)
- Inline sanction/appeal forms in violations detail page (not modals) for faster workflow
- Photo URLs as text inputs in violations create (file upload infrastructure deferred)
- Client-side aggregation for guard performance metrics (not PostgreSQL functions)
- Multi-table audit trail from governance tables (not dedicated audit_log table)
- tickets.title (not ticket_number) used for audit trail entity names
- Multi-step election wizard with react-hook-form for complex option management
- Inline attendance/agreement forms in assemblies (toggle visibility, no modals)
- Real-time quorum via calculate_assembly_quorum RPC for coefficient-weighted calculation
- agreement_number as number type (not string) with auto-increment from max
- Manual TypeScript interfaces for tables not in database.types.ts (access_devices, access_device_types, access_device_assignments)
- Cast table queries as 'never' and results as 'unknown as TypeRow' for type safety with missing tables
- RPC get_evacuation_priority_list for floor-prioritized evacuation list
- Device lifecycle state machine: Assign creates assignment + updates status, Return updates assignment + resets status
- queryKeys bracket notation for hyphenated keys (queryKeys['emergency-contacts'] not queryKeys.emergencyContacts)
- Singleton NotificationService pattern for push notification management (prevents duplicate listeners)
- Android notification channels created before permission request (required for Android 8+)
- Type-based foreground notification priority (emergency=MAX+sound, visitor=HIGH+sound, default=banner-only)
- Select-then-update pattern for push_tokens storage (unique constraints unclear from types)
- Fire-and-forget mark_notification_read on tap (user already navigated, don't block UX)
- Type-based icon mapping for 19 notification types (ticket, sla, message, document, announcement, payment, visitor, package, emergency)
- Spanish locale (date-fns/locale/es) for relative timestamps in notification list
- Hidden Tabs.Screen with href: null for navigation-only routes (notifications accessible via router.push)
- Real-time subscriptions use stable channel names (no Date.now()) to prevent re-subscription churn
- Emergency alerts cannot be disabled (always on in notification preferences UI)
- Notification preferences stored as JSONB in residents table (flexible schema, default merge for new types)

### Pending Todos

None.

### Blockers/Concerns

- Database migrations 20260208123300, 20260208123301, and 20260208210500 need to be applied to live Supabase instance before resident/admin features work
- Migrations 20260208220000 (shift_handovers) and 20260208220100 (provider_work_orders) need to be applied before handover and work order features work
- NFC testing requires EAS Build development client (not Expo Go)
- Push notification testing requires physical device (emulators/simulators don't support FCM/APNs)

## Session Continuity

Last session: 2026-02-09
Stopped at: Completed 16-03-PLAN.md (Real-time Subscriptions & Notification Preferences)
Resume file: None
