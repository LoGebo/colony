# Phase 13: Advanced Resident Features - Research

**Researched:** 2026-02-08
**Domain:** Mobile resident screens (social wall, amenity reservations, documents, profile management, marketplace) + surveys/voting
**Confidence:** HIGH (verified via live DB inspection, full codebase analysis, established mobile patterns from Phase 10-12)

## Summary

Phase 13 builds five major mobile resident feature areas plus an assessment of survey/voting feasibility. All five domains have complete database schemas already deployed (posts/channels, amenities/reservations, documents/regulation_signatures, residents/vehicles/emergency_contacts/packages, marketplace_listings). The backend is fully ready -- this phase is purely mobile UI work using Supabase auto-API (PostgREST) with server-side RPC functions for complex operations.

Key findings:
1. **Complete database infrastructure exists** for all domains. Critical SECURITY DEFINER functions handle complex operations: `create_reservation()` (booking with rule validation + overlap protection), `capture_signature()` (regulation signing with tamper-proof hashing), `cast_vote()` (election voting with quorum tracking), `get_accessible_documents()` (permission-aware document listing), `get_pending_signatures()` (unsigned documents for current resident), `increment_post_view_count()`, `increment_listing_view_count()`, `increment_listing_inquiry_count()`.
2. **Critical RLS identity mismatch** affects nearly all Phase 13 tables. RLS policies compare `resident_id = auth.uid()` but `resident_id` FK references `residents.id` (a business UUID, NOT `auth.uid()`). The workaround: use `residentId` from `useAuth()` (from JWT `app_metadata.resident_id`) when inserting data, and rely on SECURITY DEFINER RPCs for operations that bypass RLS. For direct table queries filtered by `resident_id`, this mismatch means residents' "view own" policies will NOT work unless the policies are fixed. The planner must add a migration to fix these policies OR rely exclusively on SECURITY DEFINER functions.
3. **The `community` and `more` tabs** are declared in the resident Tabs layout but have no route files yet. Phase 13 features map naturally: social wall + amenities under `community/`, and profile + marketplace + documents under `more/`.
4. **New dependency needed**: `react-native-calendars` (v1.1314.0, pure JS, Expo compatible) for the amenity availability calendar view.
5. **RAMEN-05 (push notifications for bookings) is DEFERRED** to Phase 16 per prior decisions. RCOMM-06 (surveys/voting) uses the complex `elections` + `ballots` + `cast_vote()` system -- feasible here but heavy; a simplified read-only view (browse open elections, cast vote) is recommended, with full governance management deferred to Phase 15.

**Primary recommendation:** Build mobile screens under two new tab route groups: `(resident)/community/` (social wall, amenities) and `(resident)/more/` (profile, vehicles, documents, marketplace, packages). Use SECURITY DEFINER RPCs for reservations, signatures, and voting. Add `react-native-calendars` for amenity availability. Fix RLS policies for `post_reactions`, `vehicles`, `emergency_contacts`, `marketplace_listings`, `reservations`, `regulation_signatures`, `packages`, and `package_pickup_codes` to use `resident_id = (SELECT id FROM residents WHERE user_id = auth.uid())` instead of `resident_id = auth.uid()`. Add missing query key factories for posts, marketplace, and vehicles.

---

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Install Location |
|---------|---------|---------|------------------|
| `expo` | ^54 | Managed workflow framework | `@upoe/mobile` |
| `expo-router` | ^5 | File-based routing | `@upoe/mobile` |
| `@supabase/supabase-js` | ^2.95.3 | Supabase client | `@upoe/mobile` |
| `@tanstack/react-query` | ^5.90.20 | Server state management | `@upoe/mobile` |
| `nativewind` | ^4.2.1 | Tailwind for React Native | `@upoe/mobile` |
| `tailwindcss` | 3.4.17 | Styling engine (NOT v4) | `@upoe/mobile` |
| `expo-image-picker` | ~17.0.10 | Photo selection | `@upoe/mobile` |
| `date-fns` | ^4.1.0 | Date formatting with `{ locale: es }` | `@upoe/mobile` |
| `@lukemorales/query-key-factory` | ^1.3.4 | Type-safe query keys | `@upoe/shared` |

### New Dependencies
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `react-native-calendars` | ^1.1314.0 | Calendar component for amenity availability | Pure JS, Expo compatible, provides Calendar with date marking for showing available/booked slots |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-calendars` | Custom calendar with `date-fns` | Reinventing UI for month view, day marking, swipe navigation. Not worth it. |
| `@gorhom/bottom-sheet` for marketplace filters | Modal with ScrollView | BottomSheet adds complexity; simple filter Modal is sufficient for MVP |
| In-app messaging for seller contact | Deep link to WhatsApp/SMS | Simpler -- no chat infrastructure needed. Use `Linking.openURL()` with phone/WhatsApp |

**Installation:**
```bash
cd packages/mobile && pnpm add react-native-calendars
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/mobile/
  app/(resident)/
    community/
      _layout.tsx                   # Stack layout for community tab
      index.tsx                     # Social wall feed (channel tabs + post list)
      post/
        create.tsx                  # Create new post
        [id].tsx                    # Post detail with comments + reactions
      amenities/
        index.tsx                   # RAMEN-01: Amenity catalog grid
        [id].tsx                    # RAMEN-02: Amenity detail + availability calendar
        reserve.tsx                 # RAMEN-03: Create reservation (amenity_id param)
      reservations/
        index.tsx                   # My reservations list
        [id].tsx                    # RAMEN-04: Reservation detail + cancel
    more/
      _layout.tsx                   # Stack layout for more tab
      index.tsx                     # Menu screen (profile, vehicles, documents, marketplace, packages)
      profile/
        index.tsx                   # RPROF-01: Edit profile (phone, photo, emergency contacts)
        unit.tsx                    # RPROF-02: Unit assignment + occupancy details
      vehicles/
        index.tsx                   # RPROF-03: Vehicle list + add/edit
        create.tsx                  # Add new vehicle
      documents/
        index.tsx                   # RDOC-01: Document list by category
        [id].tsx                    # Document detail + download + sign
      marketplace/
        index.tsx                   # RMRKT-02: Browse listings by category
        create.tsx                  # RMRKT-01: Create listing with photos
        [id].tsx                    # RMRKT-03: Listing detail + contact seller
      packages/
        index.tsx                   # RPROF-04: Package notifications + pickup codes
  src/hooks/
    usePosts.ts                     # Social wall queries/mutations
    useReservations.ts              # Amenity reservation queries/mutations
    useDocuments.ts                 # Document queries + signature mutations
    useProfile.ts                   # Profile update mutations
    useVehicles.ts                  # Vehicle CRUD queries/mutations
    useMarketplace.ts               # Marketplace listing queries/mutations
    useMyPackages.ts                # Package notifications query
  src/components/
    posts/
      PostCard.tsx                  # Social wall post card
      CommentItem.tsx               # Threaded comment display
      ReactionBar.tsx               # Like/reaction buttons
    amenities/
      AmenityCard.tsx               # Amenity catalog card with photo
      AvailabilityCalendar.tsx      # Calendar with slot marking
      TimeSlotPicker.tsx            # Time slot selection for booking
    marketplace/
      ListingCard.tsx               # Marketplace listing preview card
      CategoryFilter.tsx            # Category filter chips
    documents/
      DocumentCard.tsx              # Document row with category badge
      SignatureModal.tsx            # Consent + sign modal

packages/shared/src/
  queries/keys.ts                   # Add: posts, marketplace, vehicles factories
```

### Pattern 1: Stack Layout for Tab Sub-Screens (Established)

**What:** Stack navigator inside a Tabs.Screen for nested navigation
**When to use:** All new tab route groups (community, more)
**Example:**

```typescript
// app/(resident)/community/_layout.tsx
import { Stack } from 'expo-router';

export default function CommunityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Comunidad' }} />
      <Stack.Screen name="post/create" options={{ title: 'Nuevo Post' }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="amenities/index" options={{ title: 'Amenidades' }} />
      <Stack.Screen name="amenities/[id]" options={{ title: 'Amenidad' }} />
      <Stack.Screen name="amenities/reserve" options={{ title: 'Reservar' }} />
      <Stack.Screen name="reservations/index" options={{ title: 'Mis Reservaciones' }} />
      <Stack.Screen name="reservations/[id]" options={{ title: 'Reservacion' }} />
    </Stack>
  );
}
```

### Pattern 2: RPC Mutation for Complex Operations (Critical Pattern)

**What:** Use `supabase.rpc()` for SECURITY DEFINER functions instead of direct table inserts
**When to use:** Reservations, signatures, voting -- any operation that has server-side validation
**Example:**

```typescript
// Creating a reservation via RPC (NOT direct insert)
export function useCreateReservation() {
  const { residentId } = useAuth();
  const { unitId } = useResidentUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      amenity_id: string;
      start_time: string; // ISO timestamp
      end_time: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('create_reservation', {
        p_amenity_id: input.amenity_id,
        p_unit_id: unitId!,
        p_resident_id: residentId!,   // Business ID from JWT
        p_start_time: input.start_time,
        p_end_time: input.end_time,
        p_notes: input.notes ?? undefined,
      });
      if (error) throw error;
      return data; // Returns reservation UUID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
    },
  });
}
```

### Pattern 3: FlatList with Category Tabs (New Pattern for Social Wall/Marketplace)

**What:** Horizontal scrollable category/channel tabs above a FlatList feed
**When to use:** Social wall (channels), marketplace (categories), documents (categories)
**Example:**

```typescript
// Channel tabs + post feed
const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
const { data: channels } = useChannels();
const { data: posts, isLoading, refetch } = usePosts(selectedChannel);

return (
  <View className="flex-1 bg-gray-50">
    {/* Channel tabs */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
      <Pressable onPress={() => setSelectedChannel(null)}
        className={`rounded-full px-4 py-2 ${!selectedChannel ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}>
        <Text className={!selectedChannel ? 'text-white font-medium' : 'text-gray-700'}>Todos</Text>
      </Pressable>
      {(channels ?? []).map(ch => (
        <Pressable key={ch.id} onPress={() => setSelectedChannel(ch.id)}
          className={`rounded-full px-4 py-2 ${selectedChannel === ch.id ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}>
          <Text className={selectedChannel === ch.id ? 'text-white font-medium' : 'text-gray-700'}>
            {ch.icon ? `${ch.icon} ` : ''}{ch.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>

    {/* Post feed */}
    <FlatList
      data={posts}
      keyExtractor={p => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      ListEmptyComponent={<EmptyState message="No hay publicaciones" />}
    />
  </View>
);
```

### Pattern 4: Toggle Reaction (Upsert/Delete Pattern)

**What:** Single-tap toggle for post reactions using upsert + delete
**When to use:** Post reactions (like/love/etc.)
**Example:**

```typescript
export function useToggleReaction() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, reactionType }: { postId: string; reactionType: string }) => {
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('resident_id', residentId!)
        .maybeSingle();

      if (existing) {
        // Remove existing reaction
        await supabase.from('post_reactions').delete().eq('id', existing.id);
      } else {
        // Add new reaction
        const { error } = await supabase.from('post_reactions').insert({
          community_id: communityId!,
          post_id: postId,
          resident_id: residentId!,
          reaction_type: reactionType,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
    },
  });
}
```

### Pattern 5: Seller Contact via External Link (Marketplace)

**What:** Contact seller by opening WhatsApp or phone dialer with pre-filled message
**When to use:** RMRKT-03 (contact seller)
**Example:**

```typescript
import { Linking, Alert } from 'react-native';

function handleContactSeller(sellerPhone: string, listingTitle: string) {
  const message = encodeURIComponent(`Hola! Me interesa tu publicacion: "${listingTitle}"`);

  // Try WhatsApp first, fall back to SMS
  const whatsappUrl = `whatsapp://send?phone=${sellerPhone}&text=${message}`;
  const smsUrl = `sms:${sellerPhone}?body=${message}`;

  Linking.canOpenURL(whatsappUrl).then(supported => {
    if (supported) {
      Linking.openURL(whatsappUrl);
    } else {
      Linking.openURL(smsUrl);
    }
  });

  // Increment inquiry count (fire-and-forget)
  supabase.rpc('increment_listing_inquiry_count', { p_listing_id: listingId });
}
```

### Anti-Patterns to Avoid

- **Using `auth.uid()` as `resident_id` in inserts:** All `resident_id` columns FK to `residents.id` (business UUID). Use `residentId` from `useAuth()` (JWT `app_metadata.resident_id`).
- **Direct INSERT into `reservations` table:** Use `create_reservation()` RPC which validates booking rules, checks amenity hours, and handles overlap detection.
- **Direct INSERT into `regulation_signatures`:** Use `capture_signature()` RPC which validates document status, checks deadlines, prevents duplicates, and computes tamper-proof hash.
- **Direct INSERT into `ballots`:** Use `cast_vote()` RPC which validates election status, voting period, option counts, unit authorization, and proxy rules.
- **Modifying `regulation_signatures`:** The `prevent_signature_modification` trigger raises an exception on UPDATE/DELETE. Signatures are immutable.
- **Inserting `marketplace_listings` with `moderation_status != 'pending'`:** The RLS INSERT policy enforces `moderation_status = 'pending'`. The `queue_listing_for_moderation` trigger auto-creates a moderation_queue entry.
- **Showing `is_hidden` or `is_locked` posts/comments to residents:** RLS `users_view_posts` policy already filters `is_hidden = false`, but also check in the UI layer.
- **Fetching all posts without channel filter:** Posts are scoped by channel. The `users_view_posts` RLS checks channel access (public or role-allowed). Always include channel context.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reservation overlap detection | Frontend time conflict checks | `create_reservation()` RPC | Server validates booking rules (10 types), checks amenity hours, handles overlap at DB level |
| Reservation rule engine | Frontend booking rules | `validate_booking_rules()` called by `create_reservation()` | 10 rule types: advance_min/max, duration_min/max, max_per_day/week/month, blackout, owner_only, require_deposit |
| Document signature flow | Manual insert into regulation_signatures | `capture_signature()` RPC | Validates document status, checks deadline, prevents duplicates, computes SHA-256 hash, captures device metadata |
| Voting flow | Manual ballot insert | `cast_vote()` RPC | Validates election open, voting period, option count min/max, unit authorization, proxy limits, updates option tallies + quorum |
| Post reaction counts | Manual count queries | DB trigger `update_reaction_counts()` | Denormalized `reaction_counts` jsonb on posts, auto-updated on INSERT/DELETE |
| Post comment counts | Manual count queries | DB trigger `update_post_comment_count()` | Denormalized `comment_count` on posts, auto-updated on INSERT/DELETE |
| Comment threading | Manual depth tracking | DB trigger `set_comment_hierarchy()` | Auto-sets `root_comment_id` and `depth` on INSERT |
| Listing moderation queue | Manual moderation insert | DB trigger `queue_listing_for_moderation()` | Auto-queues on INSERT into marketplace_listings |
| Post view counting | Manual view tracking | `increment_post_view_count()` RPC | SECURITY DEFINER, atomic increment, fire-and-forget |
| Listing view/inquiry counting | Manual counters | `increment_listing_view_count()` / `increment_listing_inquiry_count()` RPCs | SECURITY DEFINER, atomic increment |
| Document access control | Frontend permission checks | `get_accessible_documents()` RPC + `check_document_access()` | Role hierarchy, public docs, explicit permissions, unit-based permissions |
| Pending signatures list | Frontend filtering | `get_pending_signatures()` RPC | Returns documents requiring signature that current resident hasn't signed |
| Calendar UI | Custom month/day grid | `react-native-calendars` Calendar component | Date marking, month navigation, theme customization built-in |

**Key insight:** The database layer has extensive SECURITY DEFINER functions that handle ALL complex business logic. The mobile app is purely a UI layer that calls RPCs and displays results. Never duplicate validation that the database already handles.

---

## Common Pitfalls

### Pitfall 1: RLS Identity Mismatch (CRITICAL - Cross-Cutting)
**What goes wrong:** RLS policies on `post_reactions`, `vehicles`, `emergency_contacts`, `marketplace_listings`, `reservations`, `regulation_signatures`, `packages`, `package_pickup_codes`, `reservation_waitlist`, and `ballots` use `resident_id = auth.uid()` (or `seller_id = auth.uid()`, `voted_by = auth.uid()`). But ALL these columns FK to `residents.id` which is a business UUID, NOT `auth.uid()`. The link is `residents.user_id -> auth.users.id`.
**Why it happens:** The RLS policies were written assuming `residents.id = auth.uid()`, but the schema uses a separate business UUID for `residents.id`.
**How to avoid:** Two strategies:
1. **Fix RLS policies** to use `resident_id = (SELECT id FROM residents WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1)` instead of `resident_id = auth.uid()`. This is the correct long-term fix.
2. **Use SECURITY DEFINER RPCs** for operations that bypass RLS. The critical ones (`create_reservation`, `capture_signature`, `cast_vote`) already do this. For table reads, the planner must fix the RLS policies.
**Warning signs:** Empty query results for "my reservations", "my vehicles", "my packages" despite data existing. INSERT failures with "new row violates row-level security".
**Affected tables and policies:**
- `post_reactions.users_manage_own_reactions`: `resident_id = auth.uid()`
- `vehicles.users_manage_own_vehicles`: `resident_id = auth.uid()`
- `emergency_contacts.emergency_contacts_*_own`: `resident_id = auth.uid()`
- `marketplace_listings.sellers_*_own_listings`: `seller_id = auth.uid()`
- `marketplace_listings.users_create_listings`: `seller_id = auth.uid()`
- `reservations.users_view_own_reservations`: `resident_id = auth.uid()`
- `reservations.residents_cancel_own_reservations`: `resident_id = auth.uid()`
- `regulation_signatures.residents_view_own_signatures`: `resident_id = auth.uid()`
- `packages.residents_view_unit_packages`: `occupancies.resident_id = auth.uid()`
- `package_pickup_codes.residents_view_own_pickup_codes`: `occupancies.resident_id = auth.uid()`
- `reservation_waitlist.residents_manage_own_waitlist`: `resident_id = auth.uid()`
- `ballots.voters_insert_own_ballot`: `voted_by = auth.uid()`
- `ballots.voters_see_own_ballots`: `voted_by = auth.uid()`
- `posts.authors_manage_own_posts`: `author_id = (SELECT residents.id FROM residents WHERE residents.id = auth.uid())` -- this will also fail
- `post_comments.authors_manage_comments`: same broken pattern

### Pitfall 2: Posts Require a Channel
**What goes wrong:** Attempting to create a post without a valid `channel_id` fails RLS.
**Why it happens:** The `users_create_posts` INSERT policy checks that a channel exists, is not deleted, and either `anyone_can_post = true` or user is admin/manager.
**How to avoid:** Always fetch available channels first. Present channel selection before post creation. If no channels exist (Phase 12 admin should have created them), show an empty state.
**Warning signs:** Post creation fails with RLS violation.

### Pitfall 3: Reservation Uses tstzrange Not Separate Start/End Columns
**What goes wrong:** Frontend tries to query reservations by start_time/end_time columns that don't exist.
**Why it happens:** The `reservations` table uses `reserved_range` (tstzrange) column, not separate start/end timestamps.
**How to avoid:** Use PostgREST range operators: `.overlaps('reserved_range', `[${start},${end})`)` for overlap checks. For display, extract bounds with `lower(reserved_range)` and `upper(reserved_range)` in SQL, or parse the tstzrange string client-side. The `create_reservation()` RPC accepts `p_start_time` and `p_end_time` as separate params and constructs the range internally with `'[)'` bounds (inclusive start, exclusive end).
**Warning signs:** "column start_time does not exist" errors.

### Pitfall 4: Marketplace Listings Default to Pending Moderation
**What goes wrong:** Resident creates a listing but it doesn't appear in the community feed.
**Why it happens:** The INSERT policy enforces `moderation_status = 'pending'`. The `users_view_approved_listings` SELECT policy only shows `moderation_status = 'approved'` listings. The listing must be approved by an admin before it's visible.
**How to avoid:** Show a clear "Pendiente de aprobacion" status badge on the resident's own listings (they can see their own via `sellers_view_own_listings`). Show all community listings only from approved ones.
**Warning signs:** Resident creates a listing but sees it only in "My listings", not in the main marketplace feed.

### Pitfall 5: Reaction Uniqueness Constraint
**What goes wrong:** Attempting to insert a second reaction from the same resident on the same post fails.
**Why it happens:** Unique constraint `reactions_unique_per_user` on `(post_id, resident_id)` -- one reaction per user per post.
**How to avoid:** Implement toggle pattern: check if reaction exists, delete if yes, insert if no. Or use upsert: `.upsert({ ...fields }, { onConflict: 'post_id,resident_id' })`.
**Warning signs:** "duplicate key value violates unique constraint reactions_unique_per_user".

### Pitfall 6: capture_signature Requires Many Parameters
**What goes wrong:** Calling `capture_signature` without required fields (ip_address, user_agent, consent_text) results in errors.
**Why it happens:** The function has 17 parameters (7 required, 10 optional). It captures detailed device metadata for legal compliance.
**How to avoid:** In React Native, gather: IP (from a simple API or use `'0.0.0.0'` as placeholder), user agent (from `Constants.getWebViewUserAgentAsync()` or hardcode), consent text (from the UI). Optional fields like device_type, os, screen_resolution can be gathered from `expo-device` and `Dimensions`.
**Warning signs:** "function capture_signature() does not exist" (wrong param count) or "null value in column ip_address violates not-null constraint".

### Pitfall 7: Amenity Schedule is JSONB, Not Standardized
**What goes wrong:** Frontend assumes amenity schedule has a specific structure but it varies.
**Why it happens:** `amenities.schedule` is `jsonb DEFAULT '{}'`. There's no schema enforcement.
**How to avoid:** Treat schedule as opaque. The `is_amenity_open()` function handles schedule interpretation server-side. For the calendar view, query existing reservations to show booked slots rather than trying to parse the schedule JSONB on the client.
**Warning signs:** Type errors when accessing schedule properties that don't exist.

---

## Code Examples

### Social Wall: Fetch Channel List
```typescript
// hooks/usePosts.ts
export function useChannels() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.posts.list(communityId!).queryKey, 'channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, description, channel_type, icon, anyone_can_post, requires_moderation')
        .eq('community_id', communityId!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}
```

### Social Wall: Fetch Post Feed
```typescript
export function usePosts(channelId?: string | null) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.posts.list(communityId!).queryKey, channelId],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(`
          id, title, content, post_type, media_urls,
          poll_options, poll_ends_at, poll_results,
          reaction_counts, comment_count, view_count,
          is_pinned, created_at,
          channels!inner(id, name, icon),
          residents!posts_author_id_fkey(id, first_name, paternal_surname, photo_url)
        `)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (channelId) {
        query = query.eq('channel_id', channelId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}
```

### Social Wall: Create Post
```typescript
export function useCreatePost() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      channel_id: string;
      post_type: 'discussion' | 'question' | 'event' | 'poll';
      title?: string;
      content: string;
      media_urls?: string[];
      poll_options?: { text: string }[];
      poll_ends_at?: string;
    }) => {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          community_id: communityId!,
          channel_id: input.channel_id,
          author_id: residentId!,  // Business ID, NOT auth.uid()
          post_type: input.post_type,
          title: input.title ?? undefined,
          content: input.content,
          media_urls: input.media_urls ?? undefined,
          poll_options: input.poll_options ? JSON.stringify(input.poll_options) : undefined,
          poll_ends_at: input.poll_ends_at ?? undefined,
        })
        .select()
        .single();

      if (error) throw error;

      // Fire-and-forget view count increment
      supabase.rpc('increment_post_view_count', { p_post_id: data.id });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
    },
  });
}
```

### Amenity: Fetch Catalog
```typescript
export function useAmenities() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.amenities.list(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenities')
        .select('id, name, description, amenity_type, location, capacity, photo_urls, requires_reservation, hourly_rate, deposit_amount, rules_document_url, schedule, status')
        .eq('community_id', communityId!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}
```

### Amenity: Fetch Reservations for Calendar
```typescript
export function useAmenityReservations(amenityId: string, date?: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.amenities.reservations(amenityId, date).queryKey,
    queryFn: async () => {
      // Fetch confirmed reservations for the month
      const startOfMonth = date ? `${date.substring(0, 7)}-01` : new Date().toISOString().substring(0, 7) + '-01';
      const endOfMonth = new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 0).toISOString().substring(0, 10);

      const { data, error } = await supabase
        .from('reservations')
        .select('id, reserved_range, status, resident_id, residents(first_name, paternal_surname)')
        .eq('amenity_id', amenityId)
        .eq('community_id', communityId!)
        .eq('status', 'confirmed')
        .is('deleted_at', null)
        .gte('reserved_range', `[${startOfMonth},`)
        .lte('reserved_range', `,${endOfMonth}]`);
      // NOTE: PostgREST range filtering may need adjustments.
      // Alternative: use .filter('reserved_range', 'ov', `[${startOfMonth},${endOfMonth}]`)

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && !!amenityId,
  });
}
```

### Amenity: Cancel Reservation
```typescript
export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reservationId, reason }: { reservationId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('reservations')
        .update({
          status: 'cancelled' as never,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user!.id,
          cancellation_reason: reason ?? undefined,
        })
        .eq('id', reservationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
    },
  });
}
```

### Documents: Fetch Accessible Documents
```typescript
export function useMyDocuments() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: queryKeys.documents.list(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_accessible_documents', {
        p_user_id: residentId!,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!residentId,
  });
}
```

### Documents: Sign Regulation
```typescript
import * as Device from 'expo-device';
import { Dimensions, Platform } from 'react-native';

export function useSignDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      document_id: string;
      document_version_id: string;
      consent_text: string;
    }) => {
      const { width, height } = Dimensions.get('window');

      const { data, error } = await supabase.rpc('capture_signature', {
        p_document_id: input.document_id,
        p_document_version_id: input.document_version_id,
        p_signature_type: 'click',
        p_signature_data: null,
        p_ip_address: '0.0.0.0',  // Mobile apps don't easily get public IP
        p_user_agent: `UPOE-Mobile/${Platform.OS}`,
        p_consent_text: input.consent_text,
        p_device_type: Device.deviceType === Device.DeviceType.PHONE ? 'phone' : 'tablet',
        p_os: `${Platform.OS} ${Platform.Version}`,
        p_screen_resolution: `${width}x${height}`,
        p_device_model: Device.modelName,
      });

      if (error) throw error;
      return data; // Returns signature UUID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents._def });
    },
  });
}
```

### Profile: Update Resident Info
```typescript
export function useUpdateProfile() {
  const { residentId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      phone?: string;
      phone_secondary?: string;
      photo_url?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      emergency_contact_relationship?: string;
    }) => {
      const { error } = await supabase
        .from('residents')
        .update(input)
        .eq('id', residentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
    },
  });
}
```

### Marketplace: Create Listing with Photos
```typescript
export function useCreateListing() {
  const { residentId, communityId } = useAuth();
  const { unitId } = useResidentUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category: 'sale' | 'service' | 'rental' | 'wanted';
      title: string;
      description: string;
      price?: number;
      price_negotiable?: boolean;
      image_paths?: string[]; // Already uploaded to Storage
    }) => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .insert({
          community_id: communityId!,
          seller_id: residentId!,  // Business ID, NOT auth.uid()
          unit_id: unitId ?? undefined,
          category: input.category as never,
          title: input.title,
          description: input.description,
          price: input.price ?? undefined,
          price_negotiable: input.price_negotiable ?? false,
          image_urls: input.image_paths ?? undefined,
          moderation_status: 'pending' as never, // REQUIRED by RLS
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace._def });
    },
  });
}
```

### Marketplace: Browse Approved Listings
```typescript
export function useMarketplaceListings(category?: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.marketplace.list(communityId!).queryKey, category],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_listings')
        .select(`
          id, category, title, description, price, price_negotiable,
          image_urls, view_count, inquiry_count, created_at, expires_at,
          residents!marketplace_listings_seller_id_fkey(first_name, paternal_surname, photo_url)
        `)
        .eq('community_id', communityId!)
        .eq('moderation_status', 'approved' as never)
        .eq('is_sold', false)
        .is('deleted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category as never);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}
```

### Query Key Factory Additions
```typescript
// Add to packages/shared/src/queries/keys.ts

export const posts = createQueryKeys('posts', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  comments: (postId: string) => [{ postId }],
});

export const marketplace = createQueryKeys('marketplace', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  myListings: (residentId: string) => [{ residentId }],
});

export const vehicles = createQueryKeys('vehicles', {
  all: null,
  list: (residentId: string) => [{ residentId }],
  detail: (id: string) => [id],
});

export const elections = createQueryKeys('elections', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  results: (id: string) => [{ id }],
});

// Update mergeQueryKeys:
export const queryKeys = mergeQueryKeys(
  residents, visitors, payments, accessLogs, amenities,
  notifications, kpis, communities, units, guards,
  packages, occupancies, shifts, tickets, announcements,
  documents, posts, marketplace, vehicles, elections,
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global state for social feeds | TanStack Query with infinite scroll | TQ v5 (2024) | Already using TQ -- just add feed queries |
| Custom calendar widgets | `react-native-calendars` v1.1314 | Stable (2020+) | Pure JS, Expo compatible, well-maintained |
| In-app messaging for marketplace | External link (WhatsApp/SMS) | N/A | Much simpler, no chat infrastructure needed |
| Complex e-signature libraries | Click-to-sign with metadata capture | N/A | `capture_signature()` RPC handles legal requirements |
| Client-side booking validation | Server-side via SECURITY DEFINER RPCs | Already in DB | 10 booking rules evaluated server-side |
| Separate API for voting | DB function `cast_vote()` via RPC | Already in DB | Full voting with quorum, proxies, coefficient weighting |

**Deprecated/outdated:**
- None relevant to this phase. Stack is current.

---

## Open Questions

1. **RLS Policy Fix Scope and Timing**
   - What we know: At least 15 RLS policies across 10+ tables use `resident_id = auth.uid()` but `resident_id` FK references `residents.id` (business UUID). ALL these policies are broken for the intended access pattern.
   - What's unclear: Whether to fix all policies in a single migration at the start of Phase 13 (comprehensive but large) or fix only the policies needed for each plan.
   - Recommendation: Fix all affected policies in a single migration at the beginning of Phase 13. The fix is mechanical: replace `auth.uid()` with `(SELECT id FROM residents WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1)` in each policy. This unlocks all direct table queries for resident-facing features. Without this fix, many "view own" queries will return empty results.

2. **Marketplace Image Storage Bucket**
   - What we know: `marketplace_listings.image_urls` stores paths. The `community-assets` bucket is public. There's no dedicated marketplace bucket.
   - What's unclear: Whether marketplace listing images should go to `community-assets` (public) or a new bucket.
   - Recommendation: Use `community-assets` bucket with a `marketplace/` category prefix. Listings are public (approved ones are visible to all community residents), so a public bucket is appropriate. The existing `pickAndUploadImage` function handles the upload.

3. **Social Wall Media Storage Bucket**
   - What we know: `posts.media_urls` stores paths. There's no dedicated social media bucket.
   - What's unclear: Same question as marketplace.
   - Recommendation: Use `community-assets` bucket with a `posts/` category prefix. Social wall posts are visible to the community. If privacy is needed later, use `chat-media` bucket instead.

4. **PostgREST Range Filtering for Reservations**
   - What we know: `reservations.reserved_range` is a tstzrange. PostgREST supports range operators but the exact syntax for "overlaps with date range" needs testing.
   - What's unclear: Whether `.filter('reserved_range', 'ov', '[start,end)')` works correctly via PostgREST.
   - Recommendation: Test the overlap filter during implementation. Fallback: use an RPC that returns reservations for a date range using SQL `&&` operator.

5. **Surveys (RCOMM-06) Scope**
   - What we know: The database has a full `elections` + `election_options` + `ballots` system with `cast_vote()` RPC supporting quorum, proxies, and coefficient voting. This is a governance feature designed for assembly-level decisions, not casual polls.
   - What's unclear: Whether RCOMM-06 "participate in surveys and vote on community decisions" means the full governance voting or simple post polls.
   - Recommendation: Implement two levels: (1) Simple inline polls using `posts.poll_options` / `posts.poll_results` with `post_type = 'poll'` -- lightweight, already in the posts schema. (2) Read-only view of open community elections (from `elections` table) with ability to cast vote via `cast_vote()` RPC -- for formal governance decisions. Full election management (create, certify) deferred to Phase 15.

6. **`expo-device` Dependency for Signatures**
   - What we know: `capture_signature()` accepts device metadata (device_type, os, screen_resolution, device_model). These are optional but recommended for legal compliance.
   - What's unclear: Whether `expo-device` is already installed.
   - Recommendation: Check if `expo-device` is in `package.json`. If not, add it (`npx expo install expo-device`). If the dependency is unwanted, hardcode basic values using `Platform.OS` and `Dimensions`.

---

## Sources

### Primary (HIGH confidence)
- Live database inspection via Supabase MCP: all 25+ tables verified with columns, RLS policies, triggers, functions, enum values, indexes, and FK constraints
- Function source code inspected: `create_reservation()`, `capture_signature()`, `cast_vote()`, `get_accessible_documents()`, `get_pending_signatures()`, `validate_booking_rules()`, `handle_new_user()`
- Codebase analysis: complete mobile app structure (50+ files), all hooks, components, upload utility, auth flow
- `package.json` for all workspace packages: exact versions confirmed
- Phase 12 research document: established patterns and architecture decisions

### Secondary (MEDIUM confidence)
- [react-native-calendars npm](https://www.npmjs.com/package/react-native-calendars) - v1.1314.0, pure JS, Expo compatible
- [Expo Calendars blog post](https://expo.dev/blog/build-fast-flexible-calendars-in-react-native-with-flash-calendar) - Calendar library comparison
- MEMORY.md: `residents.id` vs `auth.uid()` gotcha confirmed via live DB inspection

### Tertiary (LOW confidence)
- PostgREST range filter syntax for tstzrange: not verified with actual queries, needs testing during implementation
- Marketplace image bucket choice: architectural decision, not verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified in package.json, only react-native-calendars is new
- Architecture: HIGH - follows established patterns from Phase 10/11/12, file structure is prescriptive
- Database schema: HIGH - all tables, columns, enums, RLS policies, triggers, functions verified in live DB
- RLS identity issue: HIGH - confirmed via FK analysis + RLS policy inspection + handle_new_user trigger code
- Pitfalls: HIGH - identified from actual DB constraints, trigger behaviors, and RLS policy analysis
- Code examples: HIGH - adapted from verified existing hooks in the codebase
- Surveys/voting scope: MEDIUM - schema is comprehensive but UI complexity depends on desired UX depth

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable - no major version changes expected)
