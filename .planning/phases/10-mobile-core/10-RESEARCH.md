# Phase 10: Mobile Core -- Resident Visitors/Payments + Guard Gate - Research

**Researched:** 2026-02-08
**Domain:** React Native (Expo) mobile screens -- QR code generation/scanning, Supabase data fetching with TanStack Query, visitor management, financial views, guard gate operations
**Confidence:** HIGH (verified via Expo docs, npm registries, Supabase database inspection, Phase 9 codebase)

## Summary

This research covers the 10 technical focus areas needed to implement Phase 10: the core mobile screens for residents (dashboard, visitors, payments) and guards (gate operations, directory, packages). The phase builds directly on Phase 9's infrastructure (Expo Router route groups, SessionProvider, QueryProvider, NativeWind, useAuth/useRole hooks, pickAndUploadImage utility).

Key findings:
1. **QR code generation** uses `react-native-qrcode-svg` (the de-facto standard for Expo). The library supports `getRef` for extracting base64 data and sharing via WhatsApp.
2. **QR code scanning** uses `expo-camera` CameraView with `onBarcodeScanned` -- `expo-barcode-scanner` is deprecated. The guard scans a QR payload, the app calls the `verify-qr` edge function which delegates to the `verify_qr_payload` DB function.
3. **WhatsApp sharing** uses React Native's `Linking.openURL('whatsapp://send?text=...')` for text sharing and `expo-sharing` for file/image sharing. No additional dependencies needed.
4. **TanStack Query patterns** are well-established: `useQuery` for reads, `useMutation` with `onSettled` invalidation for writes, `useInfiniteQuery` for paginated lists with FlatList `onEndReached`.
5. **Critical RLS policy bug**: Multiple tables (`invitations`, `payment_proofs`, `packages`, `occupancies`) have RLS policies comparing `auth.uid()` against `residents.id` (business ID). These are different UUIDs. The frontend must use `app_metadata.resident_id` from the JWT, but the RLS policies need fixing to compare against `residents.user_id` or use a subquery.

**Primary recommendation:** Use `react-native-qrcode-svg` + `expo-camera` CameraView for the QR workflow, `date-fns` for date/time handling, and build custom TanStack Query hooks per domain (useVisitors, usePayments, useGateOps) that wrap Supabase PostgREST calls. Address the RLS policy mismatch before implementing data-fetching hooks.

---

## Standard Stack

### Core (New for Phase 10)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native-qrcode-svg` | ^6.3.5 | Generate QR codes as SVG | De-facto standard for Expo, supports logos, base64 export via `getRef` |
| `react-native-svg` | (bundled SDK 54) | SVG rendering dependency | Required peer dep for react-native-qrcode-svg, bundled with Expo |
| `expo-camera` | ~16.1 (SDK 54) | QR code scanning | Official Expo package, replaces deprecated `expo-barcode-scanner` |
| `date-fns` | ^4.1 | Date/time formatting and manipulation | Tree-shakable, functional API, Hermes-compatible via `@date-fns/tz` |

### Already Installed (from Phase 9)

| Library | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | ^5.90.20 | Data fetching, caching, mutations |
| `expo-image-picker` | ~17.0.10 | Image selection for payment proofs, visitor photos, package labels |
| `expo-linking` | ~8.0.11 | WhatsApp deep linking |
| `nativewind` | ^4.2.1 | Tailwind-style className on React Native |
| `@supabase/supabase-js` | ^2.95.3 | Supabase client |
| `expo-sqlite` | ~16.0.10 | Auth session storage |

### Supporting (Consider Adding)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-sharing` | ~13.0 | Native share sheet | Sharing QR code images to WhatsApp/other apps |
| `expo-file-system` | ~19.0 | Write base64 to temp file | Required to save QR code image before sharing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-qrcode-svg` | `qrcode.react` + `react-native-svg` | qrcode.react requires extra wrapping for RN, react-native-qrcode-svg is RN-native |
| `date-fns` | `dayjs` | dayjs is smaller (2KB) but date-fns has better tree-shaking and Hermes timezone polyfill support |
| Custom QR scanning | `react-native-vision-camera` | Vision Camera is more powerful but heavier; expo-camera is sufficient for QR scanning |

**Installation:**

```bash
# In packages/mobile
npx expo install expo-camera expo-sharing expo-file-system
npm install react-native-qrcode-svg date-fns
```

Note: `react-native-svg` is already bundled with Expo SDK 54. `expo-linking` is already installed.

---

## Architecture Patterns

### Recommended File Structure for Phase 10

```
packages/mobile/
  app/
    (resident)/
      _layout.tsx                  # Already exists (5 tabs)
      index.tsx                    # Dashboard (replace placeholder)
      visitors/
        _layout.tsx                # Stack navigator for visitor screens
        index.tsx                  # Active/pending visitors list
        create.tsx                 # Create invitation form
        [id].tsx                   # Invitation detail with QR code
        history.tsx                # Past visitors
      payments/
        _layout.tsx                # Stack navigator for payment screens
        index.tsx                  # Balance overview + recent charges
        history.tsx                # Full payment history
        upload-proof.tsx           # Upload payment proof

    (guard)/
      _layout.tsx                  # Already exists (4 tabs)
      index.tsx                    # Gate dashboard (replace placeholder)
      gate/
        _layout.tsx                # Stack navigator for gate operations
        scan.tsx                   # QR scanner screen
        manual-checkin.tsx         # Walk-in visitor check-in form
        visitor-result.tsx         # Verification result display
      directory/
        _layout.tsx                # Stack navigator
        index.tsx                  # Resident directory search
        vehicles.tsx               # Vehicle plate search
      packages/
        _layout.tsx                # Stack navigator
        index.tsx                  # Pending packages list
        log.tsx                    # Log new package form
        [id].tsx                   # Package detail / pickup verification

  src/
    hooks/
      useAuth.ts                   # Already exists
      useRole.ts                   # Already exists
      # New domain hooks:
      useVisitors.ts               # Query hooks for visitor/invitation data
      usePayments.ts               # Query hooks for payments/balance data
      useGateOps.ts                # Query hooks for gate operations
      usePackages.ts               # Query hooks for package management
      useCommunity.ts              # Query hooks for community branding/settings
    components/
      ui/                          # Shared primitives
        Card.tsx
        Button.tsx
        Input.tsx
        Badge.tsx
        EmptyState.tsx
        LoadingSpinner.tsx
      visitors/
        InvitationCard.tsx
        QRCodeDisplay.tsx
        VisitorStatusBadge.tsx
      payments/
        BalanceCard.tsx
        TransactionRow.tsx
        PaymentProofCard.tsx
      guard/
        VisitorQueueCard.tsx
        BlacklistAlert.tsx
        AccessLogRow.tsx
        PackageCard.tsx
```

### Pattern 1: TanStack Query Hook with Supabase PostgREST

**What:** Create custom hooks that wrap `useQuery`/`useMutation` with typed Supabase queries and the query key factory from `@upoe/shared`.
**Confidence:** HIGH -- standard TanStack Query v5 pattern verified via official docs.

```typescript
// packages/mobile/src/hooks/useVisitors.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// Fetch active invitations for the current resident
export function useActiveInvitations() {
  const { residentId, communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.visitors.active(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, qr_codes(*)')
        .eq('created_by_resident_id', residentId!)
        .eq('community_id', communityId!)
        .in('status', ['approved', 'pending'])
        .is('cancelled_at', null)
        .is('deleted_at', null)
        .gte('valid_until', new Date().toISOString())
        .order('valid_from', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId && !!communityId,
  });
}

// Create a new invitation
export function useCreateInvitation() {
  const queryClient = useQueryClient();
  const { residentId, communityId } = useAuth();

  return useMutation({
    mutationFn: async (invitation: {
      visitor_name: string;
      invitation_type: 'single_use' | 'recurring' | 'event';
      valid_from: string;
      valid_until?: string;
      visitor_phone?: string;
      vehicle_plate?: string;
      recurring_days?: number[];
      recurring_start_time?: string;
      recurring_end_time?: string;
      unit_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          ...invitation,
          community_id: communityId!,
          created_by_resident_id: residentId!,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all visitor queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.visitors._def,
      });
    },
  });
}

// Cancel an invitation
export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('invitations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.visitors._def,
      });
    },
  });
}
```

### Pattern 2: Infinite Scroll with FlatList + useInfiniteQuery

**What:** Use TanStack Query v5 `useInfiniteQuery` with Supabase `.range()` pagination and FlatList `onEndReached`.
**Confidence:** HIGH -- verified via TanStack Query v5 docs and Supabase pagination docs.

```typescript
// Paginated visitor history
export function useVisitorHistory(pageSize = 20) {
  const { residentId, communityId } = useAuth();

  return useInfiniteQuery({
    queryKey: queryKeys.visitors.list({ communityId, type: 'history' }).queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('invitations')
        .select('*, qr_codes(*)', { count: 'exact' })
        .eq('created_by_resident_id', residentId!)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data ?? [], page: pageParam, totalCount: count ?? 0 };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      const totalPages = Math.ceil(lastPage.totalCount / pageSize);
      return nextPage < totalPages ? nextPage : undefined;
    },
    enabled: !!residentId && !!communityId,
  });
}

// Usage in FlatList
function VisitorHistoryScreen() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useVisitorHistory();

  const allItems = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <FlatList
      data={allItems}
      renderItem={({ item }) => <InvitationCard invitation={item} />}
      keyExtractor={(item) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshing={isRefetching}
      onRefresh={refetch}
      ListEmptyComponent={<EmptyState message="Sin historial de visitantes" />}
      ListFooterComponent={isFetchingNextPage ? <LoadingSpinner /> : null}
    />
  );
}
```

### Pattern 3: QR Code Generation and Sharing

**What:** Generate a QR code from the invitation's `qr_codes.payload` field and share it via WhatsApp using Linking + expo-sharing.
**Confidence:** HIGH -- react-native-qrcode-svg API verified via npm/GitHub, WhatsApp URL scheme well documented.

```typescript
// packages/mobile/src/components/visitors/QRCodeDisplay.tsx
import { useRef, useCallback } from 'react';
import { View, Text, Pressable, Alert, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

interface QRCodeDisplayProps {
  payload: string;
  visitorName: string;
  communityName: string;
  validUntil?: string;
}

export function QRCodeDisplay({ payload, visitorName, communityName, validUntil }: QRCodeDisplayProps) {
  const qrRef = useRef<any>(null);

  const shareViaWhatsApp = useCallback(async () => {
    try {
      // Get base64 from QR code
      qrRef.current?.toDataURL(async (base64: string) => {
        // Clean base64 (strip newlines that react-native-qrcode-svg adds)
        const cleanBase64 = base64.replace(/(\r\n|\n|\r)/gm, '');

        // Write to temp file for sharing
        const fileUri = FileSystem.cacheDirectory + 'qr-invitation.png';
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Build WhatsApp message
        const message = `Te invito a ${communityName}. Visitante: ${visitorName}${
          validUntil ? `. Valido hasta: ${validUntil}` : ''
        }`;

        // Try sharing the image with the native share sheet
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: 'Compartir invitacion',
          });
        } else {
          // Fallback: open WhatsApp with text-only message
          const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
          const supported = await Linking.canOpenURL(whatsappUrl);
          if (supported) {
            await Linking.openURL(whatsappUrl);
          } else {
            // Final fallback: native share
            await Share.share({ message });
          }
        }
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir la invitacion');
    }
  }, [payload, visitorName, communityName, validUntil]);

  return (
    <View className="items-center p-6 bg-white rounded-2xl shadow-sm">
      <Text className="text-lg font-semibold text-gray-900 mb-4">{visitorName}</Text>
      <QRCode
        value={payload}
        size={200}
        getRef={(c) => (qrRef.current = c)}
      />
      {validUntil && (
        <Text className="mt-3 text-sm text-gray-500">
          Valido hasta: {validUntil}
        </Text>
      )}
      <Pressable
        className="mt-4 bg-green-500 rounded-lg px-6 py-3 flex-row items-center"
        onPress={shareViaWhatsApp}
      >
        <Text className="text-white font-semibold">Compartir por WhatsApp</Text>
      </Pressable>
    </View>
  );
}
```

### Pattern 4: QR Scanning with expo-camera

**What:** Use CameraView with `onBarcodeScanned` for the guard QR scanning flow. After scanning, call the `verify-qr` edge function.
**Confidence:** HIGH -- expo-camera API verified via official Expo docs.

```typescript
// packages/mobile/app/(guard)/gate/scan.tsx
import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-lg text-center mb-4">
          Se necesita permiso de camara para escanear codigos QR
        </Text>
        <Pressable
          className="bg-blue-600 rounded-lg px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Permitir Camara</Text>
        </Pressable>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string; type: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      // Call the verify-qr edge function
      const { data: result, error } = await supabase.functions.invoke('verify-qr', {
        body: { qr_payload: data },
      });

      if (error || !result?.valid) {
        Alert.alert(
          'Codigo Invalido',
          result?.error ?? error?.message ?? 'El codigo QR no es valido',
          [{ text: 'Escanear otro', onPress: () => setScanned(false) }]
        );
      } else {
        // Navigate to result screen with verification data
        router.push({
          pathname: '/(guard)/gate/visitor-result',
          params: {
            qrId: result.data?.[0]?.qr_id,
            communityId: result.data?.[0]?.community_id,
          },
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexion');
      setScanned(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View className="flex-1">
      <CameraView
        className="flex-1"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      {scanned && (
        <Pressable
          className="absolute bottom-10 self-center bg-white rounded-full px-6 py-3"
          onPress={() => setScanned(false)}
        >
          <Text className="font-semibold">Escanear otro</Text>
        </Pressable>
      )}
    </View>
  );
}
```

### Pattern 5: Pull-to-Refresh with useQuery

**What:** Simple pull-to-refresh on non-paginated lists using `useQuery` with `refetch`.
**Confidence:** HIGH -- standard React Native + TanStack Query pattern.

```typescript
function ActiveVisitorsScreen() {
  const { data, isLoading, refetch, isRefetching } = useActiveInvitations();

  if (isLoading) return <LoadingSpinner />;

  return (
    <FlatList
      data={data ?? []}
      renderItem={({ item }) => <InvitationCard invitation={item} />}
      keyExtractor={(item) => item.id}
      refreshing={isRefetching}
      onRefresh={refetch}
      ListEmptyComponent={<EmptyState message="Sin visitantes activos" />}
    />
  );
}
```

### Pattern 6: Supabase RPC Calls for Complex Queries

**What:** Use `supabase.rpc()` for database functions that encapsulate complex logic.
**Confidence:** HIGH -- verified via live database function inspection.

```typescript
// Get unit balance via RPC
export function useUnitBalance(unitId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.balance(unitId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unit_balance', {
        p_unit_id: unitId!,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!unitId,
  });
}

// Check blacklist during guard check-in
export function useBlacklistCheck(params: {
  communityId: string;
  personName?: string;
  personDocument?: string;
  plateNormalized?: string;
}) {
  return useQuery({
    queryKey: ['blacklist-check', params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_blacklisted', {
        p_community_id: params.communityId,
        p_person_name: params.personName ?? undefined,
        p_person_document: params.personDocument ?? undefined,
        p_plate_normalized: params.plateNormalized ?? undefined,
      });
      if (error) throw error;
      return data?.[0] ?? { is_blocked: false };
    },
    enabled: !!(params.personName || params.personDocument || params.plateNormalized),
  });
}
```

### Pattern 7: Search/Filter with Supabase PostgREST

**What:** Use Supabase text search operators for resident directory and vehicle plate search.
**Confidence:** HIGH -- PostgREST operators verified via Supabase docs.

```typescript
// Guard: Search resident directory
export function useResidentSearch(query: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.residents.list(communityId).queryKey.concat([{ search: query }]),
    queryFn: async () => {
      let builder = supabase
        .from('residents')
        .select('id, first_name, paternal_surname, email, occupancies(unit_id, units(unit_number))')
        .eq('community_id', communityId!)
        .is('deleted_at', null);

      if (query.trim()) {
        // Use ilike for case-insensitive partial match
        builder = builder.or(
          `first_name.ilike.%${query}%,paternal_surname.ilike.%${query}%`
        );
      }

      const { data, error } = await builder.order('paternal_surname').limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!communityId && query.length >= 2,
  });
}

// Guard: Search by unit number
export function useUnitSearch(unitNumber: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.units.list(communityId!).queryKey.concat([{ search: unitNumber }]),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, building, floor_number, occupancies(residents(id, first_name, paternal_surname))')
        .eq('community_id', communityId!)
        .ilike('unit_number', `%${unitNumber}%`)
        .is('deleted_at', null)
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && unitNumber.length >= 1,
  });
}

// Guard: Search by vehicle plate
export function useVehicleSearch(plate: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['vehicles', communityId, { search: plate }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, residents(first_name, paternal_surname)')
        .eq('community_id', communityId!)
        .ilike('plate_normalized', `%${plate.replace(/[^A-Z0-9]/gi, '').toUpperCase()}%`)
        .is('deleted_at', null)
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && plate.length >= 3,
  });
}
```

### Pattern 8: Date/Time Handling with date-fns

**What:** Use date-fns for formatting dates (visitor time windows, payment dates, shift times) in Spanish locale.
**Confidence:** HIGH -- date-fns v4 API verified via npm.

```typescript
// packages/mobile/src/lib/dates.ts
import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy', { locale: es });
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm', { locale: es });
}

export function formatTime(timeStr: string): string {
  // For time-only strings like "08:00:00"
  const [hours, minutes] = timeStr.split(':');
  return `${hours}:${minutes}`;
}

export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: es });
}

export function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return isBefore(parseISO(dateStr), new Date());
}

export function isUpcoming(dateStr: string): boolean {
  return isAfter(parseISO(dateStr), new Date());
}

// Day-of-week helpers for recurring invitations
// PostgreSQL EXTRACT(DOW) returns 0=Sunday, 1=Monday, ..., 6=Saturday
export const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miercoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sabado',
};
```

### Anti-Patterns to Avoid

- **Fetching inside render:** Never call `supabase.from()` directly in the component body. Always wrap in `useQuery`/`useMutation` hooks.
- **Forgetting `enabled` guard:** Supabase queries that depend on auth state (residentId, communityId) MUST use `enabled: !!residentId` to prevent fetching before auth is loaded.
- **Using `auth.uid()` as `resident_id`:** The `useAuth()` hook provides both `user.id` (auth UUID) and `residentId` (business UUID from `app_metadata.resident_id`). Use `residentId` when writing to tables that FK to `residents.id`. Use `user.id` for `submitted_by`, `processed_by`, and other fields that FK to `auth.users`.
- **Not handling the `deleted_at` soft-delete pattern:** All queries must include `.is('deleted_at', null)` to exclude soft-deleted records.
- **Debounce-less search:** Search queries (resident directory, vehicle plate) should debounce the input to avoid excessive API calls. Use `enabled: query.length >= N` as a minimum, plus a debounce timer on the input state.

---

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code rendering | Custom canvas/SVG drawing | `react-native-qrcode-svg` | Error correction levels, encoding, sizing are non-trivial |
| QR code scanning | Manual camera frame analysis | `expo-camera` CameraView `onBarcodeScanned` | Hardware-accelerated barcode detection built into the OS |
| QR HMAC verification | Client-side HMAC checking | `verify-qr` edge function + `verify_qr_payload` RPC | Secret key stays server-side, client only sends payload |
| Date formatting in Spanish | Manual `toLocaleDateString` | `date-fns` with `es` locale | Handles all edge cases, consistent formatting |
| Pagination | Manual offset tracking | `useInfiniteQuery` + Supabase `.range()` | TanStack Query handles page caching, deduplication, background updates |
| Financial balance calculation | Frontend math on transactions | `get_unit_balance` RPC (reads `unit_balances` view) | View is auto-updated by `update_account_balance` trigger; single source of truth |
| Blacklist checking | Frontend name/plate matching | `is_blacklisted` RPC | Server-side normalized plate comparison, considers expiry dates |
| Invitation validity | Frontend date/time checks | `is_invitation_valid` RPC | Handles single_use, recurring (day-of-week + time window), event (guest limit) |
| Image sharing to WhatsApp | Custom intent building | `expo-sharing` + `expo-file-system` | Handles MIME types, temp files, share sheet across platforms |

**Key insight:** The database already has rich server-side logic (RPC functions, triggers, views) for complex operations. The mobile app should delegate to these RPCs rather than reimplementing business logic on the client.

---

## Common Pitfalls

### Pitfall 1: RLS Policy Mismatch (residents.id vs auth.uid)

**What goes wrong:** Multiple RLS policies compare `auth.uid()` against columns that FK to `residents.id` (a business UUID), NOT to `auth.users.id`. These are different UUIDs. Examples:
- `invitations`: `created_by_resident_id = auth.uid()` -- but `created_by_resident_id` FKs to `residents.id`
- `payment_proofs`: `unit_id IN (SELECT unit_id FROM occupancies WHERE resident_id = auth.uid())` -- but `occupancies.resident_id` FKs to `residents.id`
- `packages`: same pattern via `occupancies.resident_id`

**Why it happens:** The RLS policies were likely written assuming `residents.id` would be the auth.uid, but the seed data clearly shows `residents.id` is a deterministic business UUID (e.g., `00000000-...000201`) that is different from the auth user's UUID.

**How to avoid:** Before implementing data-fetching hooks, verify whether these RLS policies work correctly with real users. Options:
1. Fix the RLS policies to use subqueries: `created_by_resident_id IN (SELECT id FROM residents WHERE user_id = auth.uid())`
2. Use the JWT claim: `created_by_resident_id = ((auth.jwt()->'app_metadata'->>'resident_id')::uuid)`
3. If the policies are intended to work differently, document the actual behavior

**Warning signs:** Queries return empty arrays despite data existing; permission errors on insert.

### Pitfall 2: QR Secret Key Not Configured

**What goes wrong:** The `verify_qr_payload` and `generate_qr_payload` functions require a `secret_key` parameter for HMAC signing/verification. The `verify-qr` edge function currently calls `verify_qr_payload` with only `p_payload` (missing the secret key). No vault secret is configured.

**Why it happens:** The QR system was built with the database functions but the operational infrastructure (secret management, edge function integration) was not fully wired.

**How to avoid:** Before implementing QR scanning:
1. Set a QR HMAC secret in Supabase vault or as an edge function environment variable
2. Update the `verify-qr` edge function to pass the secret key to `verify_qr_payload`
3. Create a flow that generates QR codes with signed payloads (insert into `qr_codes` table, call `generate_qr_payload` RPC)

**Warning signs:** All QR scans return "Invalid signature" errors.

### Pitfall 3: expo-camera Import Path

**What goes wrong:** Using `import { CameraView } from 'expo-camera/next'` (the migration guide's old syntax) instead of `import { CameraView } from 'expo-camera'` (current SDK 54 API).

**Why it happens:** The barcode-scanner-to-expo-camera migration guide shows `expo-camera/next` as the import path, which was valid during the transition period but is now the default export in SDK 54.

**How to avoid:** Always import from `'expo-camera'` directly in SDK 54+. The `/next` subpath was for SDK 51-52 migration.

**Warning signs:** Import resolution error or "module not found" for `expo-camera/next`.

### Pitfall 4: Missing Query Invalidation After Mutations

**What goes wrong:** After creating an invitation or uploading a payment proof, the list screens don't update because the query cache is stale.

**Why it happens:** TanStack Query caches query results. Without explicit invalidation after a mutation, the cached data persists for `staleTime` (60s in our config).

**How to avoid:** Every `useMutation` must include `onSuccess` or `onSettled` that calls `queryClient.invalidateQueries()` with the appropriate query key prefix. Use `queryKeys.visitors._def` for broad invalidation of all visitor queries.

**Warning signs:** Data appears after navigating away and back but not immediately after mutation.

### Pitfall 5: FlatList Performance with Complex Items

**What goes wrong:** List screens (visitors, payments, access logs) scroll poorly because each item re-renders on every scroll event.

**Why it happens:** React Native FlatList virtualizes items, but if `renderItem` creates new objects/functions on each render, every visible item re-renders.

**How to avoid:**
- Extract `renderItem` components and wrap with `React.memo`
- Use `keyExtractor` with stable IDs (UUID from database)
- Set `removeClippedSubviews={true}` on Android
- For very long lists, consider `@shopify/flash-list` as a drop-in replacement

**Warning signs:** Choppy scrolling, frame drops visible in the React Native profiler.

### Pitfall 6: useAuth Values Undefined Before Session Loads

**What goes wrong:** Hooks that depend on `communityId` or `residentId` from `useAuth()` fire before the session is loaded, causing queries to run with `undefined` values.

**Why it happens:** The SessionProvider loads the session asynchronously. During the initial render, all auth values are `undefined` or `null`.

**How to avoid:** Always use the `enabled` option in `useQuery`/`useInfiniteQuery`:
```typescript
enabled: !!communityId && !!residentId
```
This prevents the query from executing until auth values are available.

**Warning signs:** Console errors about null/undefined query parameters, or Supabase returning 400 errors.

---

## Code Examples

### Resident Dashboard with Summary Cards

```typescript
// packages/mobile/app/(resident)/index.tsx
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useActiveInvitations } from '@/hooks/useVisitors';
import { useUnitBalance } from '@/hooks/usePayments';
import { useCommunityBranding } from '@/hooks/useCommunity';
import { formatDate } from '@/lib/dates';

function DashboardCard({
  title, value, subtitle, onPress, color = 'bg-blue-50',
}: {
  title: string; value: string; subtitle?: string; onPress: () => void; color?: string;
}) {
  return (
    <Pressable className={`${color} rounded-xl p-4 mb-3`} onPress={onPress}>
      <Text className="text-sm text-gray-600">{title}</Text>
      <Text className="text-2xl font-bold text-gray-900 mt-1">{value}</Text>
      {subtitle && <Text className="text-xs text-gray-500 mt-1">{subtitle}</Text>}
    </Pressable>
  );
}

export default function ResidentDashboard() {
  const { residentId, communityId } = useAuth();
  const branding = useCommunityBranding(communityId);
  const invitations = useActiveInvitations();
  const balance = useUnitBalance(/* unitId from occupancy */);

  const isRefreshing = invitations.isRefetching || balance.isRefetching;
  const onRefresh = () => {
    invitations.refetch();
    balance.refetch();
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Community branding header */}
      <View className="bg-white px-6 pt-12 pb-6">
        <Text className="text-2xl font-bold text-gray-900">
          {branding.data?.name ?? 'Mi Comunidad'}
        </Text>
        <Text className="text-gray-500 mt-1">Bienvenido</Text>
      </View>

      <View className="px-4 mt-4">
        <DashboardCard
          title="Saldo"
          value={`$${balance.data?.current_balance ?? '0.00'}`}
          subtitle={balance.data?.days_overdue ? `${balance.data.days_overdue} dias de atraso` : 'Al corriente'}
          onPress={() => router.push('/(resident)/payments')}
          color={balance.data?.days_overdue ? 'bg-red-50' : 'bg-green-50'}
        />
        <DashboardCard
          title="Visitantes activos"
          value={`${invitations.data?.length ?? 0}`}
          onPress={() => router.push('/(resident)/visitors')}
        />
      </View>
    </ScrollView>
  );
}
```

### Guard Gate Operations Dashboard

```typescript
// packages/mobile/app/(guard)/index.tsx
import { View, Text, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTodayExpectedVisitors } from '@/hooks/useGateOps';
import { formatTime } from '@/lib/dates';

export default function GuardGateDashboard() {
  const { guardId, communityId } = useAuth();
  const expectedVisitors = useTodayExpectedVisitors();

  return (
    <View className="flex-1 bg-gray-50">
      {/* Action buttons */}
      <View className="bg-white px-4 pt-12 pb-4">
        <Text className="text-2xl font-bold text-gray-900 mb-4">Caseta</Text>
        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 bg-blue-600 rounded-xl p-4 items-center"
            onPress={() => router.push('/(guard)/gate/scan')}
          >
            <Text className="text-white font-semibold text-lg">Escanear QR</Text>
          </Pressable>
          <Pressable
            className="flex-1 bg-gray-200 rounded-xl p-4 items-center"
            onPress={() => router.push('/(guard)/gate/manual-checkin')}
          >
            <Text className="text-gray-900 font-semibold text-lg">Registro Manual</Text>
          </Pressable>
        </View>
      </View>

      {/* Expected visitors queue */}
      <View className="flex-1 px-4 mt-4">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Visitantes esperados hoy</Text>
        <FlatList
          data={expectedVisitors.data ?? []}
          renderItem={({ item }) => (
            <View className="bg-white rounded-lg p-4 mb-2 flex-row justify-between items-center">
              <View>
                <Text className="font-semibold text-gray-900">{item.visitor_name}</Text>
                <Text className="text-sm text-gray-500">
                  {item.valid_from ? formatTime(item.valid_from) : 'Todo el dia'}
                  {item.valid_until ? ` - ${formatTime(item.valid_until)}` : ''}
                </Text>
              </View>
              <Text className="text-sm text-gray-400">{item.unit_number}</Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-gray-400">Sin visitantes esperados</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}
```

### Payment Proof Upload

```typescript
// packages/mobile/app/(resident)/payments/upload-proof.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useUploadPaymentProof } from '@/hooks/usePayments';
import { pickAndUploadImage } from '@/lib/upload';
import { STORAGE_BUCKETS } from '@upoe/shared';

export default function UploadPaymentProofScreen() {
  const { communityId } = useAuth();
  const uploadMutation = useUploadPaymentProof();

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async () => {
    setUploading(true);
    const path = await pickAndUploadImage(
      STORAGE_BUCKETS.PAYMENT_PROOFS,
      communityId!,
      'receipts'
    );
    if (path) {
      setImageUrl(path);
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!imageUrl || !amount || !paymentDate) {
      Alert.alert('Error', 'Completa los campos requeridos');
      return;
    }

    uploadMutation.mutate(
      {
        amount: parseFloat(amount),
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
        bank_name: bankName || undefined,
        document_url: imageUrl,
        proof_type: 'bank_transfer',
      },
      {
        onSuccess: () => {
          Alert.alert('Enviado', 'Tu comprobante ha sido enviado para revision');
          router.back();
        },
        onError: (error) => {
          Alert.alert('Error', error.message);
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 bg-white px-6 pt-6">
        <Text className="text-xl font-bold text-gray-900 mb-6">Subir Comprobante de Pago</Text>

        {/* Image picker */}
        <Pressable
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 items-center mb-4"
          onPress={handlePickImage}
          disabled={uploading}
        >
          <Text className="text-gray-500">
            {uploading ? 'Subiendo...' : imageUrl ? 'Imagen seleccionada' : 'Toca para seleccionar imagen'}
          </Text>
        </Pressable>

        {/* Form fields */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Monto *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">Fecha de pago *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4"
          value={paymentDate}
          onChangeText={setPaymentDate}
          placeholder="YYYY-MM-DD"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">Numero de referencia</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4"
          value={referenceNumber}
          onChangeText={setReferenceNumber}
          placeholder="Opcional"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">Banco</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-6"
          value={bankName}
          onChangeText={setBankName}
          placeholder="Opcional"
        />

        <Pressable
          className="bg-blue-600 rounded-lg p-4 items-center mb-10"
          onPress={handleSubmit}
          disabled={uploadMutation.isPending}
        >
          <Text className="text-white font-semibold text-lg">
            {uploadMutation.isPending ? 'Enviando...' : 'Enviar Comprobante'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-barcode-scanner` | `expo-camera` CameraView `onBarcodeScanned` | SDK 51+ (deprecated) | expo-barcode-scanner is fully deprecated; CameraView is the only supported scanner |
| `import from 'expo-camera/next'` | `import from 'expo-camera'` | SDK 54 | The `/next` subpath was a migration bridge; SDK 54 uses the direct import |
| TanStack Query v4 `cacheTime` | TanStack Query v5 `gcTime` | 2024 | Renamed to clarify semantics; `cacheTime` still works as alias |
| TanStack Query v4 `refetchPage` | TanStack Query v5 `maxPages` | 2024 | `refetchPage` removed in v5; use `maxPages` to limit stored pages |
| `useInfiniteQuery` without `initialPageParam` | Required `initialPageParam` | TanStack Query v5 | v5 requires explicit `initialPageParam` (was optional in v4) |
| Moment.js for dates | date-fns v4 or dayjs | 2020+ | Moment.js is maintenance-only; date-fns is tree-shakable with Hermes support |

**Deprecated/outdated:**
- `expo-barcode-scanner`: Deprecated since SDK 51, use `expo-camera` instead
- `react-native-camera`: Deprecated, community project abandoned
- TanStack Query v4's `refetchPage` for infinite queries: Removed in v5

---

## Database Schema Reference

### Key Tables for Phase 10

**invitations** -- Core visitor invitation table
- `id` (uuid, PK), `community_id`, `created_by_resident_id` (FK `residents.id`), `unit_id`
- `invitation_type`: `single_use` | `event` | `recurring` | `vehicle_preauth`
- `visitor_name`, `visitor_phone`, `visitor_email`, `visitor_company`, `visitor_document`
- `vehicle_plate`, `vehicle_plate_normalized`, `vehicle_make`, `vehicle_model`, `vehicle_color`
- `valid_from` (timestamptz), `valid_until` (timestamptz, nullable)
- `recurring_days` (int[]), `recurring_start_time` (time), `recurring_end_time` (time)
- `event_name`, `event_max_guests`, `event_guests_checked_in`
- `max_uses` (default 1), `times_used` (default 0), `last_used_at`
- `status` (approval_status): `pending` | `approved` | `rejected` | `cancelled` | `expired`
- `cancelled_at`, `cancelled_by`, `cancellation_reason`
- Soft-delete: `deleted_at`

**qr_codes** -- QR code with HMAC-signed payload
- `id` (uuid), `community_id`, `invitation_id` (FK), `resident_id`
- `payload` (the signed payload string), `signature` (HMAC signature)
- `valid_from`, `valid_until`, `status` (qr_status): `active` | `used` | `expired` | `revoked`
- `scanned_at`, `scanned_by`, `scanned_at_access_point`
- `is_single_use` (default true)

**access_logs** -- Immutable entry/exit log with hash chain
- `id`, `community_id`, `access_point_id`, `invitation_id`, `qr_code_id`
- `person_type`, `person_id`, `person_name`, `person_document`
- `vehicle_id`, `plate_number`, `plate_detected`
- `direction` (text), `method` (text), `decision` (access_decision): `allowed` | `pending` | `denied` | `blocked`
- `denial_reason`, `photo_url`, `photo_vehicle_url`
- `processed_by` (guard FK), `guard_notes`, `logged_at`
- `previous_hash`, `entry_hash` (blockchain-style integrity)

**payment_proofs** -- Resident-submitted payment receipts
- `id`, `community_id`, `payment_id`, `unit_id`
- `proof_type`, `amount`, `payment_date`, `reference_number`, `bank_name`
- `document_url`, `document_filename`, `document_size_bytes`
- `status` (approval_status): `pending` | `approved` | `rejected`
- `submitted_by` (auth.uid FK), `submitted_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`

**unit_balances** (VIEW) -- Auto-calculated financial summary
- `unit_id`, `community_id`, `unit_number`, `floor_number`, `building`, `coefficient`
- `total_receivable` (current balance), `total_charges`, `total_payments`, `total_interest`
- `last_payment_date`, `last_charge_date`, `oldest_unpaid_date`, `days_overdue`

**transactions** -- Financial ledger entries
- `id`, `community_id`, `unit_id`, `resident_id`
- `transaction_type`: `charge` | `payment` | `adjustment` | `interest` | `reversal` | `transfer`
- `amount`, `currency` (default 'MXN'), `description`, `reference_number`
- `status` (transaction_status): `pending` | `posted` | `voided`
- `effective_date`, `posted_at`, `posted_by`

**packages** -- Package tracking
- `id`, `community_id`, `carrier` (package_carrier enum: `fedex` | `dhl` | `ups` | `estafeta` | `redpack` | `mercado_libre` | `amazon` | `correos_mexico` | `other`)
- `carrier_other`, `tracking_number`
- `recipient_resident_id`, `recipient_unit_id`, `recipient_name`
- `description`, `package_count`, `is_oversized`, `requires_signature`, `is_perishable`
- `photo_url`, `label_photo_url`, `storage_location_id`
- `status` (package_status): `received` | `stored` | `notified` | `pending_pickup` | `picked_up` | `forwarded` | `returned` | `abandoned`
- `received_at`, `received_by`, `stored_at`, `notified_at`, `picked_up_at`, `picked_up_by`

**package_pickup_codes** -- Codes for package pickup verification
- `id`, `community_id`, `package_id`
- `code_type` (pickup_code_type): `pin` | `qr`
- `code_value`, `signature`
- `valid_from`, `valid_until`, `status` (pickup_code_status): `active` | `used` | `expired` | `revoked`
- `used_at`, `used_by`, `sent_via`, `sent_at`

**blacklist_entries** -- Security blacklist
- `id`, `community_id`
- `person_name`, `person_document`, `person_photo_url`
- `vehicle_plate`, `vehicle_plate_normalized`, `vehicle_description`
- `reason`, `incident_date`, `evidence_photos`, `evidence_documents`
- `effective_from`, `expires_at`, `protocol` (default 'deny_entry'), `alert_guards`, `notify_admin`
- `status` (general_status): `active` | `inactive`

**guard_shifts** -- Shift definitions
- `id`, `community_id`, `name` (e.g., "Turno Matutino")
- `start_time` (time), `end_time` (time), `applicable_days` (int[])
- `crosses_midnight` (boolean)

**shift_assignments** -- Guard-to-shift-to-access-point assignments
- `id`, `community_id`, `guard_id`, `shift_id`, `access_point_id`
- `effective_from`, `effective_until`

**access_points** -- Gates/doors/turnstiles
- `id`, `community_id`, `name`, `code`
- `access_point_type`: `vehicular_gate` | `pedestrian_gate` | `turnstile` | `barrier` | `door` | `elevator`
- `direction`: `entry` | `exit` | `bidirectional`
- Equipment flags: `has_lpr`, `has_intercom`, `has_camera`, `has_nfc_reader`, `has_qr_scanner`, `can_remote_open`

**vehicles** -- Registered resident vehicles
- `id`, `community_id`, `resident_id`
- `plate_number`, `plate_normalized`, `plate_state`
- `make`, `model`, `year`, `color`
- `access_enabled`, `sticker_number`

**communities** -- Community branding data
- `name`, `logo_url`, `cover_image_url`, `primary_color`, `secondary_color`

### Key Database Functions

| Function | Arguments | Returns | Purpose |
|----------|-----------|---------|---------|
| `generate_qr_payload` | `qr_id, comm_id, expires_at, secret_key` | `text` | Creates HMAC-signed QR payload: `id\|community_id\|expiry_epoch\|signature` |
| `verify_qr_payload` | `payload, secret_key` | `TABLE(is_valid, qr_id, community_id, expires_at, error_message)` | Verifies HMAC signature and expiry |
| `burn_qr_code` | `p_qr_id, p_guard_id?, p_access_point_id?` | `boolean` | Marks single-use QR as used; records scan metadata |
| `is_invitation_valid` | `inv_id, check_time?` | `boolean` | Full invitation validation (status, time window, recurring day/time, max uses, guest limit) |
| `is_blacklisted` | `p_community_id, p_person_name?, p_person_document?, p_plate_normalized?` | `TABLE(is_blocked, blacklist_id, reason, protocol)` | Checks against active blacklist entries |
| `get_unit_balance` | `p_unit_id` | `TABLE(current_balance, days_overdue, last_payment_date, ...)` | Reads from `unit_balances` materialized view |
| `get_guards_on_duty` | `p_access_point_id, p_check_time?` | `SETOF guards` | Returns guards assigned to a gate at given time |
| `compute_access_log_hash` | (trigger) | trigger | Auto-computes blockchain-style hash on access_log insert |
| `verify_pickup_qr_payload` | `p_payload, p_secret_key` | `TABLE(is_valid, package_id, expires_at, error_message)` | Verifies package pickup QR code |
| `on_payment_proof_approved` | (trigger) | trigger | Auto-creates transaction when payment proof is approved |

---

## Open Questions

1. **RLS Policy Mismatch (`residents.id` vs `auth.uid()`)**
   - What we know: RLS policies on `invitations`, `payment_proofs`, `packages` compare `auth.uid()` against columns that FK to `residents.id`. The MEMORY.md explicitly states "residents.id is a business ID (NOT auth.uid)". The `useAuth()` hook exposes `residentId` from `app_metadata.resident_id`.
   - What is unclear: Whether these RLS policies are bugs that need fixing or whether there is an undocumented mapping. The seed data shows `residents.id = '00000000-...000201'` with `user_id = null` (no auth users linked yet), so the policies cannot be tested with seed data.
   - Recommendation: **This must be resolved before implementing data hooks.** The safest fix is to update RLS policies to use `(auth.jwt()->'app_metadata'->>'resident_id')::uuid` instead of `auth.uid()` for columns that FK to `residents.id`. This should be a prerequisite migration task in the plan.

2. **QR Secret Key Infrastructure**
   - What we know: `generate_qr_payload` and `verify_qr_payload` require a `secret_key` parameter. The `verify-qr` edge function calls `verify_qr_payload` but the current code passes `p_payload` only (missing secret_key). No vault secrets exist for QR HMAC.
   - What is unclear: Whether the edge function should read the secret from an env var or from Supabase vault.
   - Recommendation: Store the HMAC secret as a Supabase Edge Function secret (env var). Update the edge function to read it from `Deno.env.get('QR_HMAC_SECRET')`. Create a companion function or flow that generates QR codes with signed payloads when a resident creates an invitation.

3. **Guard Shift Selection UX**
   - What we know: The `shift_assignments` table links guards to shifts and access points. The `get_guards_on_duty` function returns guards for an access point at a given time.
   - What is unclear: Whether the guard should manually select their access point when starting their shift, or whether the app should auto-detect based on `shift_assignments` for the current time.
   - Recommendation: Auto-detect the guard's assigned access point via `shift_assignments` for the current day/time. If multiple assignments exist, show a picker. If none exist, show a manual access point selector.

4. **Resident's Unit ID Resolution**
   - What we know: The resident dashboard needs `unit_id` to show balance and to scope visitors. The `occupancies` table links `resident_id` to `unit_id`. A resident may have multiple occupancies (e.g., owner of multiple units).
   - What is unclear: Whether to default to the first active occupancy or to show a unit picker.
   - Recommendation: For Phase 10, query the first active occupancy for the resident and use that as the default. If multiple active occupancies exist, show a unit selector in the dashboard header.

5. **Camera Permission Handling on iOS**
   - What we know: iOS requires `NSCameraUsageDescription` in Info.plist. Expo manages this via `app.json` plugins.
   - What is unclear: Whether the expo-camera plugin auto-adds the permission or if manual configuration is needed.
   - Recommendation: Add `expo-camera` to the plugins array in `app.json` with a Spanish permission message: `["expo-camera", { "cameraPermission": "La app necesita acceso a la camara para escanear codigos QR" }]`.

---

## Sources

### Primary (HIGH confidence)
- [Expo Camera Documentation (SDK 54)](https://docs.expo.dev/versions/latest/sdk/camera/) -- CameraView API, barcode scanning, useCameraPermissions
- [Expo barcode-scanner migration guide](https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md) -- Migration from deprecated expo-barcode-scanner
- [TanStack Query v5 Infinite Queries](https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries) -- useInfiniteQuery, initialPageParam, maxPages
- [TanStack Query v5 Optimistic Updates](https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates) -- onMutate, cache update, rollback
- [Expo Linking API](https://docs.expo.dev/versions/latest/sdk/linking/) -- openURL, canOpenURL for WhatsApp
- [Expo Sharing API](https://docs.expo.dev/versions/latest/sdk/sharing/) -- shareAsync for file sharing
- Live database inspection: `invitations`, `qr_codes`, `access_logs`, `payment_proofs`, `packages`, `blacklist_entries`, `unit_balances`, `guard_shifts`, `shift_assignments`, `vehicles` table schemas
- Live database function inspection: `generate_qr_payload`, `verify_qr_payload`, `burn_qr_code`, `is_invitation_valid`, `is_blacklisted`, `get_unit_balance`, `verify_pickup_qr_payload`
- Phase 9 codebase: SessionProvider, QueryProvider, useAuth, useRole, pickAndUploadImage, query key factories

### Secondary (MEDIUM confidence)
- [react-native-qrcode-svg npm](https://www.npmjs.com/package/react-native-qrcode-svg) -- QR code generation library API
- [react-native-qrcode-svg GitHub](https://github.com/Expensify/react-native-qrcode-svg) -- getRef/toDataURL for base64 export, newline stripping issue
- [Supabase Pagination in React](https://makerkit.dev/blog/tutorials/pagination-supabase-react) -- .range() with .order() pattern
- [date-fns npm](https://www.npmjs.com/package/date-fns) -- v4 API, es locale, tree-shaking

### Tertiary (LOW confidence)
- react-native-qrcode-svg exact latest version (v6.3.5 from search results, needs npm verification at install time)
- expo-sharing exact version for SDK 54 (should auto-resolve via `npx expo install`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- libraries verified via npm, Expo docs, community consensus
- Architecture patterns (TanStack Query): HIGH -- standard v5 patterns from official docs
- Architecture patterns (QR flow): HIGH -- database functions inspected, edge function code read
- Architecture patterns (NativeWind UI): HIGH -- continuing from Phase 9 established patterns
- Database schema: HIGH -- every column, FK, enum, and function inspected live
- Pitfalls: HIGH -- RLS mismatch discovered via live policy inspection, QR secret gap found via edge function + vault inspection
- Open questions: Flagged honestly with specific recommendations

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- stable domain; QR secret infrastructure is the most time-sensitive item)
