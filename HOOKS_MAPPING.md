# HOOKS, PROVIDERS & LIB MAPPING -- Mobile App Screens

> Auto-generated reference of which hooks, providers, and lib utilities each screen
> in `packages/mobile` should use.
> Last updated: 2026-02-09

---

## Table of Contents

1. [Providers & Lib Utilities](#1-providers--lib-utilities)
2. [Hook Inventory (25 hooks)](#2-hook-inventory-25-hooks)
3. [Screen-to-Hook Mapping (31+ screens)](#3-screen-to-hook-mapping)
4. [DB Gotchas & Warnings](#4-db-gotchas--warnings)

---

## 1. Providers & Lib Utilities

### SessionProvider (`src/providers/SessionProvider.tsx`)

Wraps the entire app. Provides `{ session, isLoading }` via React Context.

- **`useSession()`** -- returns `{ session: Session | null, isLoading: boolean }`
- Listens to `supabase.auth.onAuthStateChange` for live session updates
- Restores persisted session on mount via `supabase.auth.getSession()`
- Used internally by `useAuth()` -- screens should prefer `useAuth()` instead

### QueryProvider (`src/providers/QueryProvider.tsx`)

Wraps the app with `@tanstack/react-query`'s `QueryClientProvider`.

- Default `staleTime`: 60 seconds
- Default `gcTime`: 5 minutes
- Default `retry`: 2
- `refetchOnWindowFocus`: false

### supabase (`src/lib/supabase.ts`)

Singleton Supabase client typed with `Database` from `@upoe/shared`.

- Uses `expo-sqlite/localStorage` for auth persistence
- Auto-refreshes session token on app foreground via `AppState` listener
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Direct import required** by auth screens (sign-in, sign-up, forgot-password, onboarding) since they call `supabase.auth.*` directly without hooks

### pickAndUploadImage (`src/lib/upload.ts`)

```ts
pickAndUploadImage(bucket: string, communityId: string, category: string): Promise<string | null>
```

- Opens device image picker via `expo-image-picker`
- Uploads to Supabase Storage using `getStoragePath()` from `@upoe/shared`
- Returns the storage path string, or `null` if cancelled/failed
- Used by: maintenance create, payment proof upload, profile photo, marketplace create, incident create, visitor result, manual check-in, package log

### Date/Currency Helpers (`src/lib/dates.ts`)

| Function | Signature | Description |
|---|---|---|
| `formatDate` | `(dateStr: string) => string` | "08 feb 2026" |
| `formatDateTime` | `(dateStr: string) => string` | "08 feb 2026, 14:30" |
| `formatTime` | `(timeStr: string) => string` | "14:30" (handles ISO and HH:mm) |
| `formatRelative` | `(dateStr: string) => string` | "hace 5 minutos" |
| `formatCurrency` | `(amount: number, currency?: string) => string` | "$1,234.56 MXN" |
| `isExpired` | `(dateStr: string \| null) => boolean` | true if date is in the past |
| `isUpcoming` | `(dateStr: string) => boolean` | true if within next 24h |
| `DAY_LABELS` | `Record<number, string>` | `{0: "Domingo", 1: "Lunes", ...}` |

---

## 2. Hook Inventory (25 hooks)

### 2.1 `useAuth` (`src/hooks/useAuth.ts`)

**Params:** none
**Returns:**
```ts
{
  user: User | null;
  session: Session | null;
  role: string;              // from app_metadata
  communityId: string;       // from app_metadata
  residentId: string;        // from app_metadata (business ID, NOT auth.uid)
  guardId: string;           // from app_metadata
  organizationId: string;    // from app_metadata
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}
```
**Used by:** Nearly every screen and most other hooks

---

### 2.2 `useRole` (`src/hooks/useRole.ts`)

**Params:** none
**Returns:**
```ts
{
  role: string;
  isResident: boolean;
  isGuard: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSuperAdmin: boolean;
  isPendingSetup: boolean;
  isAdminRole: boolean;  // isAdmin || isManager || isSuperAdmin
}
```
**Used by:** Layout files for role-based navigation guards

---

### 2.3 `useCommunityBranding` (`src/hooks/useCommunity.ts`)

**Params:** `communityId?: string`
**Returns:** React Query result with:
```ts
{ id, name, logo_url, cover_image_url, primary_color, secondary_color }
```
**Used by:** Resident Dashboard, Guard Dashboard, Visitor Detail

---

### 2.4 `useResidentOccupancy` / `useResidentUnit` (`src/hooks/useOccupancy.ts`)

**`useResidentOccupancy(residentId?: string)`** -- returns array of active occupancies with joined unit data
**`useResidentUnit()`** -- convenience; auto-resolves current resident's primary unit

Returns:
```ts
// useResidentUnit
{
  unitId: string | null;
  unitNumber: string | null;
  building: string | null;
  floorNumber: number | null;
  isLoading: boolean;
}
```
**Used by:** Payments, Maintenance Create, Reservations, Marketplace Create, Upload Proof, Profile Unit, More index, Resident Dashboard

---

### 2.5 Payment Hooks (`src/hooks/usePayments.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useUnitBalance` | `unitId?: string` | `UnitBalance \| null` (balance, charges, payments, days_overdue) |
| `useTransactions` | `unitId?: string, pageSize?: number` | Infinite query of `Transaction[]` |
| `usePaymentProofs` | `unitId?: string` | `PaymentProof[]` |
| `useUploadPaymentProof` | none (reads auth) | Mutation: `UploadPaymentProofInput => PaymentProof` |

---

### 2.6 Package Hooks -- Guard (`src/hooks/usePackages.ts`)

| Hook | Params | Returns |
|---|---|---|
| `usePendingPackages` | none (reads communityId) | Packages with status in `[received, stored, notified, pending_pickup]` |
| `usePackageDetail` | `id: string` | Full package with unit, resident, pickup codes |
| `useLogPackage` | none (reads auth) | Mutation: `LogPackageInput => Package` |
| `useConfirmPickup` | none (reads auth) | Mutation: `{packageId, pickupCode?} => Package` |

---

### 2.7 Package Hooks -- Resident (`src/hooks/useMyPackages.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useMyPackages` | none (resolves via occupancies) | Packages for current resident's unit(s) with pickup codes |

---

### 2.8 Directory Hooks (`src/hooks/useDirectory.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useResidentSearch` | `query: string` (min 2 chars) | Residents with occupancy/unit data |
| `useUnitSearch` | `unitNumber: string` (min 1 char) | Units with occupant residents |
| `useVehicleSearch` | `plate: string` (min 3 chars) | Vehicles with owner/unit info |
| `useBlacklistCheck` | `{personName?, personDocument?, plateNormalized?}` | Blacklist result via `is_blacklisted` RPC |

---

### 2.9 Ticket/Maintenance Hooks (`src/hooks/useTickets.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useMyTickets` | none (reads residentId) | Ticket list with categories |
| `useTicketDetail` | `id: string` | Full ticket with comments |
| `useTicketCategories` | none (reads communityId) | Active categories sorted by sort_order |
| `useCreateTicket` | none (reads auth + unit) | Mutation: `CreateTicketInput => Ticket` |
| `useAddComment` | none | Mutation: `{ticket_id, content} => TicketComment` |

---

### 2.10 Announcement Hooks (`src/hooks/useAnnouncements.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useAnnouncementFeed` | none (reads residentId) | Feed via `announcement_recipients` join |
| `useAnnouncementDetail` | `id: string` | Full announcement data |
| `useMarkAnnouncementRead` | none (reads residentId) | Mutation: `announcementId => void` |
| `useAcknowledgeAnnouncement` | none (reads residentId) | Mutation: `announcementId => void` |

---

### 2.11 Social/Post Hooks (`src/hooks/usePosts.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useChannels` | none (reads communityId) | Channel list (name, type, icon, moderation settings) |
| `usePosts` | `channelId?: string` | Posts with author + channel join, ordered pinned-first |
| `usePostDetail` | `postId: string` | Full post + auto view count increment |
| `usePostComments` | `postId: string` | Threaded comments with author info |
| `useCreatePost` | none (reads auth) | Mutation: `CreatePostInput => Post` |
| `useToggleReaction` | none (reads auth) | Mutation: `{postId, reactionType} => void` |
| `useCreateComment` | none (reads auth) | Mutation: `{post_id, content, parent_comment_id?} => Comment` |
| `useVotePoll` | none | Mutation: `{postId, optionIndex} => void` |

---

### 2.12 Reservation/Amenity Hooks (`src/hooks/useReservations.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useAmenities` | none (reads communityId) | Active amenities list |
| `useAmenityDetail` | `amenityId: string` | Full amenity with schedule, rates, rules |
| `useAmenityReservations` | `amenityId: string, month?: string` | Reservations for calendar display |
| `useCreateReservation` | none (reads auth + unit) | Mutation via `create_reservation` RPC |
| `useMyReservations` | none (reads auth) | All reservations for current resident |
| `useCancelReservation` | none | Mutation: `{reservationId, reason?} => void` |
| `parseTstzrange` | `range: string` | `{ start: Date, end: Date }` (exported utility) |

---

### 2.13 Document Hooks (`src/hooks/useDocuments.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useMyDocuments` | none (reads communityId) | Via `get_accessible_documents` RPC |
| `usePendingSignatures` | none (reads communityId) | Via `get_pending_signatures` RPC |
| `useDocumentDetail` | `documentId: string` | Document + latest version + signature status |
| `useSignDocument` | none | Mutation via `capture_signature` RPC |

---

### 2.14 Vehicle Hooks (`src/hooks/useVehicles.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useMyVehicles` | none (reads residentId) | Vehicle list for current resident |
| `useCreateVehicle` | none (reads auth) | Mutation: `CreateVehicleInput => Vehicle` |
| `useUpdateVehicle` | none | Mutation: `{id, make?, model?, color?, year?} => void` |
| `useDeleteVehicle` | none | Mutation (soft delete): `vehicleId => void` |

---

### 2.15 Profile Hooks (`src/hooks/useProfile.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useResidentProfile` | none (reads residentId) | Resident info + emergency contacts |
| `useUpdateProfile` | none (reads residentId) | Mutation: `{phone?, phone_secondary?, photo_url?} => void` |
| `useUpdateEmergencyContact` | none (reads auth) | Mutation: upsert emergency contact |

---

### 2.16 Marketplace Hooks (`src/hooks/useMarketplace.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useMarketplaceListings` | `category?: string` | Approved, non-expired, non-sold listings |
| `useMyListings` | none (reads residentId) | Current resident's listings |
| `useListingDetail` | `listingId: string` | Full listing + auto view count increment |
| `useCreateListing` | none (reads auth + unit) | Mutation: `CreateListingInput => Listing` |
| `useMarkAsSold` | `listingId: string` | Mutation: marks listing as sold |
| `useDeleteListing` | none | Mutation (soft delete): `listingId => void` |
| `handleContactSeller` | `(sellerPhone, listingTitle, listingId)` | Opens WhatsApp/SMS + increments inquiry count |

---

### 2.17 Notification Hooks (`src/hooks/useNotifications.ts`)

| Hook | Params | Returns |
|---|---|---|
| `usePushRegistration` | none (reads user) | Side effect: initializes FCM + push token registration |
| `useNotificationList` | none (reads user) | Non-dismissed notifications, limit 50 |
| `useUnreadCount` | none (reads user) | Integer count of unread notifications |
| `useMarkNotificationRead` | none (reads user) | Mutation via `mark_notification_read` RPC |

---

### 2.18 Notification Preferences (`src/hooks/useNotificationPreferences.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useNotificationPreferences` | none (reads residentId) | Merged preferences from `residents.notification_preferences` JSON |
| `useUpdateNotificationPreferences` | none (reads residentId) | Mutation: `NotificationPreferences => void` |

Exports `DEFAULT_PREFERENCES` and `NotificationPreferences` type.

---

### 2.19 Visitor Hooks (`src/hooks/useVisitors.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useActiveInvitations` | none (reads auth) | Active/pending invitations with QR codes |
| `useActiveInvitationsRealtime` | none (reads auth) | Same + Realtime subscriptions |
| `useInvitationDetail` | `id: string` | Full invitation with QR codes + unit |
| `useCreateInvitation` | none (reads auth) | Mutation: creates invitation + QR code |
| `useCancelInvitation` | none | Mutation: `invitationId => void` |
| `useVisitorHistory` | `pageSize?: number` | Infinite query of all invitations |

---

### 2.20 Gate Operations (`src/hooks/useGateOps.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useGuardAccessPoint` | none (reads communityId) | First active access point |
| `useVerifyQR` | none | Mutation: `payload => {valid, data?, error?}` (calls edge function) |
| `useBlacklistCheck` | `{communityId, personName?, personDocument?, plateNormalized?}` | `{is_blocked, blacklist_id, reason, protocol}` |
| `useManualCheckIn` | none (reads auth + access point) | Mutation: `ManualCheckInInput => AccessLog` |
| `useLogAccess` | none (reads auth + access point) | Mutation: `LogAccessInput => AccessLog` (burns single-use QR) |
| `useTodayAccessLogs` | none (reads communityId) | Today's access logs, limit 50 |
| `useExpectedVisitorsRealtime` | none (reads communityId) | Expected visitors + Realtime subscriptions |

---

### 2.21 Realtime Subscription (`src/hooks/useRealtimeSubscription.ts`)

Generic Supabase Realtime postgres_changes hook.

**Params:**
```ts
{
  channelName: string;        // Unique channel ID
  table: string;              // Postgres table
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;            // PostgREST filter
  queryKeys: readonly (readonly unknown[])[];  // Keys to invalidate
  enabled?: boolean;
  onEvent?: (payload: any) => void;
}
```
**Used internally by:** `useActiveInvitationsRealtime`, `useExpectedVisitorsRealtime`

---

### 2.22 Patrol Hooks (`src/hooks/usePatrol.ts`)

| Hook | Params | Returns |
|---|---|---|
| `usePatrolRoutes` | `communityId?: string` | Active patrol routes with checkpoint sequences |
| `usePatrolCheckpoints` | `communityId?: string` | All checkpoints (NFC serials, GPS coords) |
| `useActivePatrolLog` | `guardId?: string` | Currently in-progress patrol or null |
| `usePatrolLogDetail` | `logId?: string` | Patrol log + checkpoint logs |
| `useStartPatrol` | none | Mutation: `{routeId, guardId, communityId} => PatrolLog` |
| `useScanCheckpoint` | none | Mutation: records NFC scan (DB trigger auto-increments progress) |
| `useAbandonPatrol` | none | Mutation: `patrolLogId => PatrolLog` |

---

### 2.23 Incident Hooks (`src/hooks/useIncidents.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useIncidentTypes` | `communityId?: string` | Incident types with default severity |
| `useIncidentList` | `communityId?: string` | Recent incidents, limit 50 |
| `useIncidentDetail` | `id?: string` | Full incident + media array |
| `useCreateIncident` | none (reads auth) | Mutation: `CreateIncidentInput => Incident` |
| `useAddIncidentComment` | none (reads user) | Mutation via `add_incident_comment` RPC |
| `useUploadIncidentMedia` | none | Mutation: uploads to Storage + inserts incident_media |

---

### 2.24 Handover Hooks (`src/hooks/useHandovers.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useRecentHandovers` | `communityId?: string` | Last 20 handover notes with guard names |
| `useUnacknowledgedHandovers` | `communityId?: string` | Unacknowledged handover notes |
| `useCreateHandover` | none (reads auth) | Mutation: `CreateHandoverInput => ShiftHandover` |
| `useAcknowledgeHandover` | none (reads guardId) | Mutation: `handoverId => ShiftHandover` |

---

### 2.25 Emergency & Provider Hooks (`src/hooks/useEmergency.ts`)

| Hook | Params | Returns |
|---|---|---|
| `useTriggerEmergency` | none (reads auth) | Mutation: creates emergency alert + GPS capture |
| `useActiveEmergencies` | `communityId?: string` | Non-resolved emergency alerts |
| `useProviderAccessCheck` | none | Mutation: `providerId => boolean` (via RPC) |
| `useProviderPersonnelSearch` | `query: string, communityId?: string` | Provider personnel search (min 2 chars) |

---

## 3. Screen-to-Hook Mapping

Legend:
- **[H]** = Hook
- **[L]** = Lib utility
- **[P]** = Provider
- **[D]** = Direct Supabase call (inline query, not via hook)
- **[C]** = Component that internally uses hooks

---

### AUTH FLOW

#### 1. Sign In (`(auth)/sign-in.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `supabase` | [L] | `supabase.auth.signInWithPassword()` called directly |
| `signInSchema` | shared | Zod validation from `@upoe/shared` |

No hooks used. Auth is handled directly via `supabase.auth.*`.

#### 2. Sign Up (`(auth)/sign-up.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `supabase` | [L] | `supabase.auth.signUp()` called directly |
| `signUpSchema` | shared | Zod validation from `@upoe/shared` |

No hooks used.

#### 3. Forgot Password (`(auth)/forgot-password.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `supabase` | [L] | `supabase.auth.resetPasswordForEmail()` called directly |
| `resetPasswordSchema` | shared | Zod validation from `@upoe/shared` |

No hooks used.

#### 4. Onboarding / Admin Setup (`(auth)/onboarding.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `supabase` | [L] | Calls `supabase.rpc('complete_admin_onboarding', ...)` |
| `adminOnboardingSchema` | shared | Zod validation from `@upoe/shared` |

No hooks used. After successful onboarding, auth state change triggers navigation.

---

### RESIDENT SCREENS

#### 5. Resident Dashboard (`(resident)/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `residentId`, `communityId` |
| `useCommunityBranding` | [H] | Community name, colors |
| `useResidentUnit` | [H] | `unitId` for balance query |
| `formatCurrency` | [L] | Balance formatting |
| `supabase` | [L] | **Inline queries**: `get_unit_balance` RPC, invitations count |

**GOTCHA:** Dashboard uses inline `useQuery` calls rather than `useUnitBalance` or `useActiveInvitations` hooks. Consider refactoring to use dedicated hooks.

#### 6. Create Visitor (`(resident)/visitors/create.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useCreateInvitation` | [H] | Mutation to create invitation + QR |
| `useResidentUnit` | [H] | Auto-fill `unit_id` |
| `DAY_LABELS` | [L] | Recurring day names |

#### 7. Active Invitations (`(resident)/visitors/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useActiveInvitations` | [H] | Active/pending invitations list |

**NOTE:** Does NOT use `useActiveInvitationsRealtime`. Consider upgrading for live updates.

#### 8. Visitor History (`(resident)/visitors/history.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useVisitorHistory` | [H] | Paginated invitation history (infinite query) |

#### 9. Visitor Detail (`(resident)/visitors/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | For ownership check |
| `useInvitationDetail` | [H] | Full invitation + QR |
| `useCancelInvitation` | [H] | Cancel button |
| `useCommunityBranding` | [H] | QR display styling |
| `formatDateTime`, `formatTime`, `DAY_LABELS` | [L] | Time display |

#### 10. Payments Overview (`(resident)/payments/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | Context |
| `useResidentUnit` | [H] | `unitId` |
| `useUnitBalance` | [H] | Balance card |
| `useTransactions` | [H] | Transaction list |
| `usePaymentProofs` | [H] | Proof submissions |

#### 11. Payment History (`(resident)/payments/history.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useResidentUnit` | [H] | `unitId` |
| `useTransactions` | [H] | Full paginated transaction list |

#### 12. Upload Payment Proof (`(resident)/payments/upload-proof.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId` for storage path |
| `useResidentUnit` | [H] | `unitId` for proof record |
| `useUploadPaymentProof` | [H] | Mutation |
| `pickAndUploadImage` | [L] | Image picker + Storage upload |
| `supabase` | [L] | Direct storage access for URL generation |
| `STORAGE_BUCKETS` | shared | Bucket name constant |

#### 13. Maintenance List (`(resident)/maintenance/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useMyTickets` | [H] | Ticket list with categories |
| `formatRelative` | [L] | Time display |

#### 14. Create Maintenance Ticket (`(resident)/maintenance/create.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useCreateTicket` | [H] | Mutation |
| `useTicketCategories` | [H] | Category picker |
| `useAuth` | [H] | `communityId` for storage path |
| `pickAndUploadImage` | [L] | Photo attachment |
| `STORAGE_BUCKETS` | shared | `ticket-attachments` bucket |

#### 15. Maintenance Detail (`(resident)/maintenance/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useTicketDetail` | [H] | Full ticket + comments |
| `useAddComment` | [H] | Add comment mutation |
| `formatRelative`, `formatDateTime` | [L] | Time display |

#### 16. Announcements List (`(resident)/announcements/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAnnouncementFeed` | [H] | Resident's targeted announcements |
| `formatRelative` | [L] | Time display |

#### 17. Announcement Detail (`(resident)/announcements/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAnnouncementDetail` | [H] | Full announcement |
| `useMarkAnnouncementRead` | [H] | Auto-mark on view |
| `useAcknowledgeAnnouncement` | [H] | Acknowledge button |
| `formatDateTime` | [L] | Time display |

#### 18. Social Feed / Community (`(resident)/community/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useChannels` | [H] | Channel tabs |
| `usePosts` | [H] | Post list (optionally filtered by channel) |

#### 19. Post Detail (`(resident)/community/post/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `usePostDetail` | [H] | Full post data |
| `usePostComments` | [H] | Threaded comments |
| `useCreateComment` | [H] | Add comment |
| `useVotePoll` | [H] | Poll voting |
| `ReactionBar` | [C] | Uses `useToggleReaction` internally |

#### 20. Create Post (`(resident)/community/post/create.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useChannels` | [H] | Channel picker |
| `useCreatePost` | [H] | Mutation |
| `useAuth` | [H] | `communityId` for storage path |
| `pickAndUploadImage` | [L] | Media upload |

#### 21. Amenities List (`(resident)/community/amenities/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAmenities` | [H] | Active amenities |

#### 22. Amenity Detail (`(resident)/community/amenities/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAmenityDetail` | [H] | Full amenity info |
| `AvailabilityCalendar` | [C] | Uses `useAmenityReservations` internally |
| `formatCurrency` | [L] | Rate display |

#### 23. Reserve Amenity (`(resident)/community/amenities/reserve.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAmenityDetail` | [H] | Amenity info for confirmation |
| `useCreateReservation` | [H] | Mutation (calls `create_reservation` RPC) |
| `formatCurrency`, `formatDate`, `formatTime` | [L] | Display |

#### 24. My Reservations List (`(resident)/community/reservations/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useMyReservations` | [H] | All reservations |
| `parseTstzrange` | [H] | Range parsing |
| `formatDate`, `formatTime` | [L] | Display |

#### 25. Reservation Detail (`(resident)/community/reservations/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useMyReservations` | [H] | Finds reservation in list by ID |
| `useCancelReservation` | [H] | Cancel mutation |
| `parseTstzrange` | [H] | Range parsing |
| `formatDate`, `formatTime`, `formatDateTime` | [L] | Display |

#### 26. Profile (`(resident)/more/profile/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | Context |
| `useResidentProfile` | [H] | Profile + emergency contacts |
| `useUpdateProfile` | [H] | Update phone/photo |
| `useUpdateEmergencyContact` | [H] | Upsert emergency contact |
| `pickAndUploadImage` | [L] | Avatar upload |

#### 27. Unit Info (`(resident)/more/profile/unit.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `residentId` |
| `useResidentOccupancy` | [H] | All occupancies with unit details |

#### 28. Vehicles List (`(resident)/more/vehicles/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useMyVehicles` | [H] | Vehicle list |
| `useDeleteVehicle` | [H] | Soft delete mutation |

#### 29. Create Vehicle (`(resident)/more/vehicles/create.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useCreateVehicle` | [H] | Mutation |

#### 30. Documents List (`(resident)/more/documents/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useMyDocuments` | [H] | Accessible documents |
| `usePendingSignatures` | [H] | Documents needing signature |

#### 31. Document Detail (`(resident)/more/documents/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useDocumentDetail` | [H] | Document + version + signature status |
| `SignatureModal` | [C] | Uses `useSignDocument` internally |
| `supabase` | [L] | Storage URL generation for PDF viewer |

#### 32. Marketplace List (`(resident)/more/marketplace/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useMarketplaceListings` | [H] | Browse listings (with category filter) |
| `useMyListings` | [H] | "My listings" tab |

#### 33. Marketplace Detail (`(resident)/more/marketplace/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useListingDetail` | [H] | Full listing |
| `useMarkAsSold` | [H] | Owner action |
| `useDeleteListing` | [H] | Owner action |
| `handleContactSeller` | [H] | WhatsApp/SMS contact |
| `useAuth` | [H] | Ownership check (residentId vs seller_id) |

#### 34. Create Listing (`(resident)/more/marketplace/create.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId` for storage path |
| `useCreateListing` | [H] | Mutation |
| `pickAndUploadImage` | [L] | Image upload |

#### 35. My Packages (`(resident)/more/packages/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useMyPackages` | [H] | Packages for resident's unit(s) |

#### 36. Notification Settings (`(resident)/more/notification-settings.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `NotificationPreferences` | [C] | Uses `useNotificationPreferences` + `useUpdateNotificationPreferences` internally |

#### 37. Notifications Screen (`(resident)/notifications.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `NotificationListScreen` | [C] | Uses `useNotificationList` + `useMarkNotificationRead` + `useAuth` internally |

#### 38. More / Settings Hub (`(resident)/more/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | Role info, sign out |
| `useResidentUnit` | [H] | Unit display |
| `usePendingSignatures` | [H] | Badge count for documents |

---

### GUARD SCREENS

#### 39. Guard Dashboard (`(guard)/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId` |
| `useCommunityBranding` | [H] | Community name |
| `supabase` | [L] | **Inline query**: expected visitors for today |
| `formatTime` | [L] | Time display |

**GOTCHA:** Uses inline `useQuery` instead of `useExpectedVisitorsRealtime`. Consider refactoring.

#### 40. QR Scan (`(guard)/gate/scan.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useVerifyQR` | [H] | Edge function call to verify QR payload |

Uses `expo-camera` for QR scanning. On success, navigates to visitor-result with parsed data.

#### 41. QR Scan Result / Visitor Result (`(guard)/gate/visitor-result.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId`, `guardId` |
| `useLogAccess` | [H] | Record access log + burn QR code |
| `useBlacklistCheck` (from useGateOps) | [H] | Safety check |
| `supabase` | [L] | Inline query to fetch invitation details |
| `pickAndUploadImage` | [L] | Optional photo capture |
| `formatTime`, `formatDate` | [L] | Display |

#### 42. Manual Check-In (`(guard)/gate/manual-checkin.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId` |
| `useManualCheckIn` | [H] | Record manual access log |
| `useBlacklistCheck` (from useGateOps) | [H] | Real-time blacklist check as name is typed |
| `pickAndUploadImage` | [L] | Optional photo |

#### 43. Directory - Residents/Units (`(guard)/directory/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useResidentSearch` | [H] | Search by name |
| `useUnitSearch` | [H] | Search by unit number |
| `useBlacklistCheck` (from useDirectory) | [H] | Check on selection |

#### 44. Directory - Vehicles (`(guard)/directory/vehicles.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useVehicleSearch` | [H] | Search by plate |
| `useBlacklistCheck` (from useDirectory) | [H] | Check on selection |

#### 45. Packages List (`(guard)/packages/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `usePendingPackages` | [H] | Pending packages sorted by unit |

#### 46. Package Detail (`(guard)/packages/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `usePackageDetail` | [H] | Full package with pickup codes |
| `useConfirmPickup` | [H] | Verify code + mark as picked up |
| `formatDateTime`, `formatRelative` | [L] | Display |

#### 47. Log Package (`(guard)/packages/log.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId` for storage path |
| `useUnitSearch` (from useDirectory) | [H] | Unit lookup for recipient |
| `useLogPackage` | [H] | Mutation |
| `pickAndUploadImage` | [L] | Label photo |

#### 48. Patrol Routes (`(guard)/patrol/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId`, `guardId` |
| `usePatrolRoutes` | [H] | Available routes |
| `useActivePatrolLog` | [H] | Resume in-progress patrol |
| `useStartPatrol` | [H] | Begin new patrol |

#### 49. Patrol Detail (`(guard)/patrol/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | Context |
| `usePatrolLogDetail` | [H] | Patrol log + checkpoint logs |
| `usePatrolCheckpoints` | [H] | Resolve checkpoint names/details |
| `useAbandonPatrol` | [H] | Abandon action |
| `formatRelative` | [L] | Time display |

#### 50. Patrol NFC Scan (`(guard)/patrol/scan.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | Context |
| `usePatrolCheckpoints` | [H] | Match NFC serial to checkpoint |
| `useScanCheckpoint` | [H] | Record scan |
| `expo-location` | ext | GPS capture |
| `react-native-nfc-manager` | ext | NFC tag reading |

#### 51. Incidents List (`(guard)/incidents/index.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId` |
| `useIncidentList` | [H] | Recent incidents |
| `useUnacknowledgedHandovers` | [H] | Badge/alert for pending handovers |
| `formatRelative` | [L] | Time display |

#### 52. Incident Detail (`(guard)/incidents/[id].tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | Context |
| `useIncidentDetail` | [H] | Full incident + media |
| `useAddIncidentComment` | [H] | Add follow-up |
| `formatDateTime` | [L] | Time display |
| `supabase` | [L] | Storage URL generation for evidence photos |

#### 53. Create Incident (`(guard)/incidents/create.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId` |
| `useIncidentTypes` | [H] | Type picker |
| `useCreateIncident` | [H] | Mutation |
| `useUploadIncidentMedia` | [H] | Evidence upload |
| `expo-location` | ext | GPS capture |
| `expo-image-picker` | ext | Direct camera/library access |

#### 54. Shift Handover (`(guard)/incidents/handover.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `useAuth` | [H] | `communityId`, `guardId` |
| `useRecentHandovers` | [H] | Previous handover notes |
| `useCreateHandover` | [H] | New handover note |
| `useAcknowledgeHandover` | [H] | Acknowledge incoming handover |

#### 55. Guard Notifications (`(guard)/notifications.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `NotificationListScreen` | [C] | Uses `useNotificationList` + `useMarkNotificationRead` + `useAuth` internally |

---

### ADMIN SCREENS (Mobile)

The admin screens in the mobile app (`(admin)/`) are **stub/placeholder files**. They currently exist as empty or minimal shells. The primary admin experience is in `packages/admin` (Next.js dashboard).

For reference, the admin dashboard hooks available in `packages/admin/src/hooks/` are:

| Admin Hook File | Key Hooks |
|---|---|
| `useAuth.ts` | Admin auth context |
| `useRole.ts` | Admin role checks |
| `useResidents.ts` | CRUD residents |
| `useUnits.ts` | CRUD units |
| `useOccupancies.ts` | Manage occupancies |
| `useFinancials.ts` | Financial reports/summaries |
| `useCharges.ts` | Create/manage charges |
| `usePaymentProofs.ts` | Review/approve payment proofs |
| `useTickets.ts` | Manage maintenance tickets |
| `useAnnouncements.ts` | Create/manage announcements |
| `useAccessLogs.ts` | View access history |
| `useDocuments.ts` | Manage documents |
| `useAmenities.ts` | Manage amenities |
| `useParking.ts` | Parking management |
| `useProviders.ts` | Service provider management |
| `useMoves.ts` | Move-in/out management |
| `useCommunitySettings.ts` | Community configuration |
| `useModeration.ts` | Content moderation |
| `useWorkOrders.ts` | Work order management |
| `useViolations.ts` | Violation tracking |
| `useGovernance.ts` | Governance (surveys, voting) |
| `useEmergency.ts` | Emergency management |
| `useAnalytics.ts` | Analytics dashboards |
| `useDevices.ts` | Access device management |

#### When mobile admin screens are implemented, recommended mapping:

| Screen | Recommended Hooks |
|---|---|
| **56. Admin Dashboard** (`(admin)/index.tsx`) | `useAuth`, `useCommunityBranding`, inline summary queries |
| **57. Admin Residents** (`(admin)/residents.tsx`) | Port from `admin/useResidents` or create mobile-specific hooks |
| **58. Admin Payments** (`(admin)/payments.tsx`) | Port from `admin/useFinancials`, `admin/usePaymentProofs` |
| **59. Admin Maintenance** (`(admin)/maintenance.tsx`) | Port from `admin/useTickets` |
| **60. Admin Announcements** (`(admin)/announcements.tsx`) | Port from `admin/useAnnouncements` |
| **61. Admin Amenities** (`(admin)/amenities.tsx`) | Port from `admin/useAmenities` |
| **62. Admin Moderation** (`(admin)/moderation.tsx`) | Port from `admin/useModeration` |
| **63. Admin Settings** (`(admin)/settings.tsx`) | Port from `admin/useCommunitySettings` |

---

### ROOT LAYOUT

#### Root Layout (`app/_layout.tsx`)
| Dependency | Type | Notes |
|---|---|---|
| `SessionProvider` | [P] | Wraps entire app |
| `QueryProvider` | [P] | TanStack Query client |
| `useSession` | [P] | Auth state for navigation guard |
| `usePushRegistration` | [H] | Initialize FCM on authenticated launch |
| `SYSTEM_ROLES` | shared | Role-based route group selection |

---

## 4. DB Gotchas & Warnings

### Identity Gotchas

1. **`residents.id` is NOT `auth.uid()`** -- It is a business ID. Use `residents.user_id` to link to `auth.users`. The `useAuth` hook returns `residentId` from `app_metadata.resident_id`, which is the business ID.

2. **`guards.user_id`** links to `auth.users` but is nullable (guards may not have app access). The `useAuth` hook returns `guardId` from `app_metadata.guard_id`.

3. **`tickets.reported_by`** expects `residentId` (business ID), NOT `auth.uid()`. The `useCreateTicket` hook correctly uses `residentId!`.

4. **`access_logs.processed_by`** expects `guardId` (from guards table). The gate ops hooks correctly use `guardId`.

### Table/Column Name Gotchas

5. **`useBlacklistCheck` exists in TWO files**: `useDirectory.ts` and `useGateOps.ts`. They have slightly different signatures. The directory version takes `{personName?, personDocument?, plateNormalized?}`, while the gate ops version takes `{communityId, personName?, personDocument?, plateNormalized?}`.

6. **`access_logs.plate_number`** -- The `useTodayAccessLogs` hook selects `plate_number`, but `useManualCheckIn` inserts as `vehicle_plate` and `plate_detected`. These are different columns.

7. **`reservations.reserved_range`** is a PostgreSQL `tstzrange` (not separate start/end columns). Must use `parseTstzrange()` utility from `useReservations.ts` to extract start/end dates.

8. **Enum casting** -- Several hooks cast values with `as never` to bypass TypeScript enum strictness (e.g., `'active' as never`, `'approved' as never`). This is a workaround for the generated Database types being too strict.

### Query Key Gotchas

9. **`usePaymentProofs`** uses a manual query key `['payment-proofs', unitId]` instead of the shared `queryKeys.payments.*` pattern. This could cause cache invalidation misses.

10. **`useGuardAccessPoint`** uses manual key `['guard-access-point', communityId]` instead of a shared pattern.

### Inline Query Anti-Pattern

11. **Resident Dashboard** and **Guard Dashboard** both use inline `useQuery` calls instead of the dedicated hooks (`useUnitBalance`, `useExpectedVisitorsRealtime`). This duplicates query logic and risks cache key mismatches.

### Realtime Coverage

12. **Only 2 screens use Realtime**: `useActiveInvitationsRealtime` (not even used by the visitor index screen!) and `useExpectedVisitorsRealtime` (not used by guard dashboard). Real-time subscriptions are underutilized.

### Storage Bucket References

13. Screens that upload files must use the correct `STORAGE_BUCKETS` constant:
    - Payment proofs: `payment-proofs`
    - Ticket attachments: `ticket-attachments`
    - Incident evidence: `incident-evidence`
    - Avatars: `avatars`
    - Community assets: `community-assets`

### Missing Hooks

14. **No `useAccessLogs` hook** exists in mobile hooks for guards to browse historical logs. The `useTodayAccessLogs` in `useGateOps.ts` is limited to today only.

15. **No `useEmergency` hook for residents** -- `useTriggerEmergency` in the mobile hooks is guard-focused (uses `user.id` not `residentId`). Residents would need a separate trigger path.

16. **No mobile admin hooks** -- Admin screens will need hooks ported from `packages/admin/src/hooks/` or new mobile-specific equivalents.
