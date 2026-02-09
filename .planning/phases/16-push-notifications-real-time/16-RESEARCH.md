# Phase 16: Push Notifications & Real-time Polish - Research

**Researched:** 2026-02-08
**Domain:** Push notifications (Expo/FCM/APNs), Supabase Realtime subscriptions, notification preferences
**Confidence:** HIGH

## Summary

This phase integrates push notification delivery with Expo's notification system (wrapping FCM/APNs) and adds real-time data synchronization using Supabase Realtime for time-sensitive features. The database infrastructure already exists (push_tokens, notifications, notification_preferences tables from earlier migrations), simplifying implementation to client-side integration and event-driven delivery logic.

**Key findings:**
- Expo's expo-notifications library handles FCM/APNs complexity, requiring only token registration and event listeners client-side
- The existing `send-push` edge function (deployed) needs integration with database webhooks for event-driven delivery
- Supabase Realtime Postgres Changes respects RLS and provides filtered real-time subscriptions with minimal setup
- TanStack Query integrates with real-time events via query invalidation pattern for cache consistency
- Notification preferences infrastructure already exists with sophisticated DND, per-type, and per-channel settings

**Primary recommendation:** Use Expo's push notification service (ExpoPushToken) rather than direct FCM/APNs communication for simplicity. Integrate Supabase Realtime with TanStack Query invalidation for real-time UI updates without full re-renders.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-notifications | 0.29+ | Push notification registration, handlers, permissions | Official Expo SDK; abstracts FCM/APNs, handles platform differences |
| expo-device | Latest | Physical device detection | Required for push token verification (no tokens on emulators) |
| expo-constants | Latest | Project configuration access | Provides projectId for ExpoPushToken generation |
| @supabase/supabase-js | 2.48+ | Realtime subscriptions | Official Supabase client; includes Realtime via `channel().on('postgres_changes')` |
| @tanstack/react-query | 5.x | Cache invalidation, optimistic updates | Universal data layer already in use; integrates with real-time via `queryClient.invalidateQueries()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-task-manager | Latest | Background notification handling | Only if background task processing needed (headless notifications) |
| react-native-notifee | Latest | Cross-platform badge management | Only if fine-grained badge control needed (Expo handles basic badges) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ExpoPushToken | Direct FCM/APNs | More control but requires managing device tokens, certificates, service accounts, platform-specific code |
| Supabase Realtime | WebSockets (socket.io) | More control but lose RLS integration, requires custom auth, more complex server setup |
| Database webhooks | Polling | Simpler but higher latency, more database load, doesn't scale |

**Installation:**
```bash
# Already have @supabase/supabase-js and @tanstack/react-query
npx expo install expo-notifications expo-device expo-constants
```

## Architecture Patterns

### Recommended Project Structure
```
packages/mobile/src/
├── services/
│   ├── notifications/
│   │   ├── NotificationService.ts       # Singleton for registration, handlers
│   │   ├── NotificationPermissions.ts   # Permission flow
│   │   ├── NotificationHandlers.ts      # Foreground/background handlers
│   │   └── NotificationActions.ts       # Deep link routing
│   └── realtime/
│       ├── RealtimeService.ts           # Supabase Realtime wrapper
│       └── RealtimeSubscriptions.ts     # Channel subscription management
├── hooks/
│   ├── useNotifications.ts              # Hook for notification state
│   ├── usePushToken.ts                  # Hook for token management
│   ├── useRealtimeSubscription.ts       # Hook for Realtime channels
│   └── useNotificationPreferences.ts    # Hook for preference management
└── components/
    └── notifications/
        ├── NotificationBadge.tsx        # Badge display
        └── NotificationPreferences.tsx  # Settings UI
```

### Pattern 1: Push Notification Registration & Token Management
**What:** Register for push notifications on app launch, store token in database, refresh on token changes
**When to use:** Every user login/session start
**Example:**
```typescript
// Source: Expo Notifications Docs + Supabase pattern
// https://docs.expo.dev/versions/latest/sdk/notifications/

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

async function registerForPushNotifications() {
  // 1. Check if physical device
  if (!Device.isDevice) {
    console.warn('Push notifications require physical device');
    return null;
  }

  // 2. Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 3. Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Permission not granted for push notifications');
    return null;
  }

  // 4. Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  // 5. Store token in database
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      platform: Device.osName === 'iOS' ? 'ios' : 'android',
      token: tokenData.data,
      device_name: Device.deviceName,
      last_used_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,device_name',
    });
  }

  return tokenData.data;
}

// 6. Listen for token refresh (rare but critical)
Notifications.addPushTokenListener(async (tokenData) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      token: tokenData.data,
      last_used_at: new Date().toISOString(),
    });
  }
});
```

### Pattern 2: Foreground Notification Handling
**What:** Configure how notifications display when app is in foreground
**When to use:** App initialization (root component)
**Example:**
```typescript
// Source: Expo Notifications Docs - setNotificationHandler
// https://docs.expo.dev/push-notifications/receiving-notifications/

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Determine behavior based on notification type
    const notificationType = notification.request.content.data?.notification_type;

    // Emergency alerts always show
    if (notificationType === 'emergency_alert') {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      };
    }

    // Visitor arrivals show with sound
    if (notificationType === 'visitor_arrived') {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }

    // Default: show banner, no sound (user is in app)
    return {
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    };
  },
});
```

### Pattern 3: Notification Response Handling (Deep Links)
**What:** Route user to appropriate screen when tapping notification
**When to use:** App initialization, set up once
**Example:**
```typescript
// Source: Expo Notifications Docs - addNotificationResponseReceivedListener
// https://docs.expo.dev/push-notifications/receiving-notifications/

import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

function useNotificationResponseHandler() {
  const navigation = useNavigation();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const actionType = data.action_type;
        const actionData = data.action_data;

        // Route based on action type
        switch (actionType) {
          case 'open_visitor':
            navigation.navigate('VisitorDetail', {
              visitorId: actionData.visitor_id
            });
            break;
          case 'open_payment':
            navigation.navigate('PaymentDetail', {
              paymentId: actionData.payment_id
            });
            break;
          case 'open_ticket':
            navigation.navigate('TicketDetail', {
              ticketId: actionData.ticket_id
            });
            break;
          case 'open_announcement':
            navigation.navigate('AnnouncementDetail', {
              announcementId: actionData.announcement_id
            });
            break;
          default:
            navigation.navigate('Notifications');
        }

        // Mark notification as read
        if (data.notification_id) {
          supabase.rpc('mark_notification_read', {
            p_notification_id: data.notification_id,
          });
        }
      }
    );

    return () => subscription.remove();
  }, [navigation]);
}
```

### Pattern 4: Supabase Realtime Subscription with RLS
**What:** Subscribe to database changes filtered by user permissions and specific conditions
**When to use:** Real-time features like visitor queue, guard dashboard
**Example:**
```typescript
// Source: Supabase Realtime Postgres Changes Docs
// https://supabase.com/docs/guides/realtime/postgres-changes

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function useVisitorQueueRealtime(guardId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to visitor status changes
    const channel = supabase
      .channel('visitor-queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'visitors',
          filter: `status=eq.pending`, // Only pending visitors
        },
        (payload) => {
          console.log('Visitor queue updated:', payload);

          // Invalidate visitor queue query to refetch
          queryClient.invalidateQueries({
            queryKey: ['visitors', 'queue', guardId]
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [guardId, queryClient]);
}
```

### Pattern 5: TanStack Query + Realtime Integration
**What:** Integrate real-time events with TanStack Query cache for optimistic updates and invalidation
**When to use:** Any real-time feature that needs UI updates
**Example:**
```typescript
// Source: TanStack Query Invalidation + Supabase pattern
// https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

function useVisitorsWithRealtime(unitId: string) {
  const queryClient = useQueryClient();

  // Query visitors
  const query = useQuery({
    queryKey: ['visitors', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel(`visitors-${unitId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visitors',
          filter: `unit_id=eq.${unitId}`,
        },
        (payload) => {
          // Option 1: Invalidate and refetch
          queryClient.invalidateQueries({
            queryKey: ['visitors', unitId]
          });

          // Option 2: Optimistic update (faster, no refetch)
          queryClient.setQueryData(['visitors', unitId], (old: any[]) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new, ...old];
            }
            if (payload.eventType === 'UPDATE') {
              return old.map(v => v.id === payload.new.id ? payload.new : v);
            }
            if (payload.eventType === 'DELETE') {
              return old.filter(v => v.id !== payload.old.id);
            }
            return old;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [unitId, queryClient]);

  return query;
}
```

### Pattern 6: Android Notification Channels (Required Android 8.0+)
**What:** Create notification channels before sending notifications on Android
**When to use:** App initialization, before requesting first notification
**Example:**
```typescript
// Source: Expo Notifications - Android Channels
// https://docs.expo.dev/versions/latest/sdk/notifications/#android-channels

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  // High priority: Visitor arrivals, emergency alerts
  await Notifications.setNotificationChannelAsync('visitor-arrivals', {
    name: 'Visitor Arrivals',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'doorbell.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B6B',
    enableVibrate: true,
  });

  // Critical: Emergency alerts
  await Notifications.setNotificationChannelAsync('emergency', {
    name: 'Emergency Alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'emergency.wav',
    vibrationPattern: [0, 500, 500, 500],
    lightColor: '#FF0000',
    enableVibrate: true,
    bypassDnd: true, // Bypass Do Not Disturb
  });

  // Default: General notifications
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General Notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });

  // Note: Once released, channel importance cannot be changed
  // Only name/description can be updated
}
```

### Anti-Patterns to Avoid
- **Don't test on emulators/simulators:** Push notifications require physical devices. Testing on emulators wastes time and produces misleading errors.
- **Don't request permissions without context:** Ask for notification permissions at a logical moment (e.g., after first login), not immediately on app launch. Provide UI explaining why notifications are valuable.
- **Don't subscribe to Realtime without cleanup:** Failing to unsubscribe causes memory leaks. Always return cleanup function from useEffect.
- **Don't re-register tokens on every render:** Token registration is expensive. Only register on login/session start and listen for token refresh events.
- **Don't ignore token refresh events:** Tokens rarely change, but when they do (e.g., Android reinstall), failing to update causes delivery failures.
- **Don't set notification channels after release:** Android doesn't allow changing channel importance after creation. Plan channels carefully before first production release.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push token registration | Custom FCM/APNs setup | expo-notifications with ExpoPushToken | Handles certificates, service accounts, platform differences, token refresh |
| Notification permission flow | Custom permission UI | Notifications.requestPermissionsAsync() | Handles iOS provisional auth, Android 13+ runtime permissions, permission status checking |
| Foreground notification display | Custom in-app notification UI | Notifications.setNotificationHandler() | Platform-consistent UX, respects system settings, handles priority/sound/badge |
| Notification action routing | Custom URL parsing | addNotificationResponseReceivedListener with action_type | Type-safe, testable, handles app state (foreground/background/killed) |
| Real-time updates | Polling or custom WebSockets | Supabase Realtime postgres_changes | RLS integration, automatic reconnection, filtered subscriptions, no server code |
| Badge count management | Manual counting logic | Notifications badge in setNotificationHandler | Platform-consistent, syncs with system notification tray, clears automatically |
| Token expiration tracking | Custom token refresh cron | addPushTokenListener | Fires automatically on token changes (rare), updates immediately |

**Key insight:** Push notifications and real-time subscriptions have hidden complexity (platform differences, edge cases, error handling, reconnection logic). Expo and Supabase abstract this complexity reliably. Custom solutions require months of testing to match reliability.

## Common Pitfalls

### Pitfall 1: Testing on Emulators/Simulators
**What goes wrong:** Developer tests push notifications on iOS Simulator or Android Emulator, sees errors or no tokens, concludes implementation is broken
**Why it happens:** Push notifications require physical device authentication with APNs/FCM. Emulators lack this capability by design
**How to avoid:**
- Use Device.isDevice check before token registration
- Set up development build on physical device early in development
- Document in README that push testing requires physical device
**Warning signs:** getExpoPushTokenAsync() hangs or returns error on emulator

### Pitfall 2: Android 13+ Permission Denial
**What goes wrong:** Notifications work on Android 12 but fail silently on Android 13+ without prompting user
**Why it happens:** Android 13 introduced runtime notification permission (POST_NOTIFICATIONS), but only if notification channel exists first
**How to avoid:**
- Create notification channels via setNotificationChannelAsync() BEFORE requesting permissions
- Request permissions at logical moment (after login, before first notification event)
- Handle denial gracefully with UI explaining value proposition
**Warning signs:** requestPermissionsAsync() immediately returns 'denied' without showing system prompt

### Pitfall 3: Token Changes Not Updated (Android Reinstalls)
**What goes wrong:** User reinstalls app on Android, receives no notifications. Token in database is stale
**Why it happens:** Android generates new FCM token on reinstall, but app only registers token on first login
**How to avoid:**
- Register token on every app launch (upsert, not insert)
- Add pushTokenListener to catch token refresh events
- Implement monthly token refresh pattern (recommended by FCM: once per month)
- Handle DeviceNotRegistered errors in send-push edge function by deleting stale tokens
**Warning signs:** DeviceNotRegistered error from FCM API in edge function logs

### Pitfall 4: Memory Leaks from Realtime Subscriptions
**What goes wrong:** App memory usage grows over time, eventually crashes. Navigation between screens becomes sluggish
**Why it happens:** Supabase Realtime channels not unsubscribed when component unmounts. Each channel maintains WebSocket connection
**How to avoid:**
- Always return cleanup function from useEffect: `return () => channel.unsubscribe()`
- Use custom hooks to encapsulate subscription lifecycle
- Unsubscribe before navigating away from screens with realtime
- Monitor active channels in development: `supabase.getChannels()` should match expected count
**Warning signs:** Growing number of active WebSocket connections in network inspector, app slowdown after navigation

### Pitfall 5: Notification Channel Locked After Release (Android)
**What goes wrong:** Production app has wrong notification importance (e.g., visitor arrivals don't vibrate). Changing importance in code has no effect
**Why it happens:** Android locks channel importance on first creation. Users can change it, but app cannot programmatically update
**How to avoid:**
- Plan notification channels carefully before first production release
- Test channel behavior (sound, vibration, priority) on physical devices before release
- If change needed post-release, create new channel with different ID (e.g., 'visitor-arrivals-v2')
- Document channel IDs and importance levels in code comments
**Warning signs:** setNotificationChannelAsync() succeeds but notification behavior unchanged

### Pitfall 6: Badge Count Exceeds Double Digits
**What goes wrong:** Users see badge count like "47" on app icon, feel overwhelmed, stop opening app
**Why it happens:** Badge auto-increments without capping or grouping logic
**How to avoid:**
- Cap badge display at "9+" or "99+" (use setBadgeCountAsync with max value)
- Clear badge when app opens: `Notifications.setBadgeCountAsync(0)`
- Group notifications by type (e.g., "3 visitors" instead of 3 separate badges)
- Respect user preferences: some users disable badges entirely
**Warning signs:** User engagement drops after initial period, badge counts consistently high

### Pitfall 7: Supabase Realtime RLS Performance Bottleneck
**What goes wrong:** Real-time updates become slow (5-10 second delay) or timeout completely
**Why it happens:** Every postgres_changes event runs RLS check per subscribed client. Complex RLS policies with joins cause bottleneck
**How to avoid:**
- For high-throughput tables (chat messages, live events), use Broadcast channel instead of postgres_changes
- Simplify RLS policies on real-time tables (avoid multi-table joins in RLS)
- Use filters on channel subscription to reduce events: `filter: 'status=eq.pending'`
- Consider separate "public" table without RLS for real-time data, stream to Broadcast channel manually
**Warning signs:** Realtime subscriptions timing out, database CPU spikes during real-time events

### Pitfall 8: DND/Preferences Not Respected by Edge Function
**What goes wrong:** User sets Do Not Disturb 10 PM - 8 AM, still receives push notifications at midnight
**Why it happens:** Edge function sends push directly without checking notification_preferences table
**How to avoid:**
- Database already has get_notification_channels() function that respects DND
- Use create_notification() function (not direct INSERT) which calls get_notification_channels()
- Edge function should read from notification_deliveries table (already filtered by preferences)
- Emergency alerts should bypass DND: check notification_type in preference logic
**Warning signs:** User complaints about notifications during quiet hours, preference settings not affecting delivery

### Pitfall 9: ExpoPushToken Changes When applicationId Changes
**What goes wrong:** Development and production builds have different tokens, database has stale tokens from switching environments
**Why it happens:** ExpoPushToken includes applicationId/experienceId in hash. Different bundle IDs = different tokens
**How to avoid:**
- Use separate Supabase projects for dev/staging/production OR
- Tag tokens with environment in push_tokens table: `environment: 'dev' | 'staging' | 'prod'`
- Filter tokens by environment when sending notifications
- Clean up stale tokens: delete tokens with last_used_at > 60 days
**Warning signs:** Push works in dev but not production (or vice versa), multiple tokens per user

### Pitfall 10: Notification Rate Limiting (600/second Expo Limit)
**What goes wrong:** Mass notification (e.g., emergency alert to 1000 users) fails partially, some users never receive notification
**Why it happens:** Expo imposes 600 notifications/second limit per project. Exceeding this causes 429 errors and dropped notifications
**How to avoid:**
- Implement exponential backoff retry in edge function
- Batch notifications in chunks of 100 with 200ms delay between batches
- Use expo-server-sdk-node (automatically implements throttling and retry)
- For urgent mass notifications, consider SMS fallback for delivery failures
**Warning signs:** 429 rate limit errors in edge function logs during mass notifications

## Code Examples

Verified patterns from official sources:

### Complete Notification Service Setup
```typescript
// Source: Expo Notifications Setup Docs
// https://docs.expo.dev/push-notifications/push-notifications-setup/

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    // 1. Set up notification handler
    this.setupNotificationHandler();

    // 2. Set up Android channels (must be before permissions)
    if (Platform.OS === 'android') {
      await this.setupAndroidChannels();
    }

    // 3. Register for push notifications
    await this.registerForPushNotifications();

    // 4. Set up listeners
    this.setupNotificationListeners();
  }

  private setupNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const type = notification.request.content.data?.notification_type;

        // Emergency bypasses all settings
        if (type === 'emergency_alert') {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          };
        }

        // Default foreground behavior
        return {
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
        };
      },
    });
  }

  private async setupAndroidChannels() {
    await Notifications.setNotificationChannelAsync('visitor-arrivals', {
      name: 'Visitor Arrivals',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'doorbell.wav',
      vibrationPattern: [0, 250, 250, 250],
    });

    await Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'emergency.wav',
      bypassDnd: true,
    });

    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  private async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.warn('Push notifications require physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    await this.storeToken(tokenData.data);
    return tokenData.data;
  }

  private async storeToken(token: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('push_tokens').upsert({
      user_id: user.id,
      platform: Device.osName === 'iOS' ? 'ios' : 'android',
      token,
      device_name: Device.deviceName,
      device_model: Device.modelName,
      os_version: Device.osVersion,
      app_version: Constants.expoConfig?.version,
      last_used_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,device_name',
    });
  }

  private setupNotificationListeners() {
    // Token refresh listener (rare but critical)
    Notifications.addPushTokenListener(async (tokenData) => {
      await this.storeToken(tokenData.data);
    });

    // Notification received while app is foregrounded
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // User tapped notification
    Notifications.addNotificationResponseReceivedListener((response) => {
      this.handleNotificationResponse(response);
    });
  }

  private handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;
    // Deep link routing handled elsewhere (NavigationService)
    console.log('User tapped notification:', data);
  }

  async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }

  async clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export default NotificationService.getInstance();
```

### Realtime Subscription with Cleanup Hook
```typescript
// Source: Supabase Realtime Docs + React patterns
// https://supabase.com/docs/guides/realtime/postgres-changes

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionOptions {
  table: string;
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  queryKey: any[];
  onEvent?: (payload: any) => void;
}

export function useRealtimeSubscription({
  table,
  event,
  filter,
  queryKey,
  onEvent,
}: UseRealtimeSubscriptionOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      // Get current user for JWT-based RLS
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No session, skipping realtime subscription');
        return;
      }

      // Set custom JWT (optional if using default)
      // supabase.realtime.setAuth(session.access_token);

      // Subscribe to postgres changes
      channel = supabase
        .channel(`${table}-changes-${Date.now()}`) // Unique channel name
        .on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table,
            filter, // e.g., 'status=eq.pending'
          },
          (payload) => {
            console.log(`Realtime ${event} on ${table}:`, payload);

            // Custom handler
            onEvent?.(payload);

            // Invalidate query to trigger refetch
            queryClient.invalidateQueries({ queryKey });
          }
        )
        .subscribe((status) => {
          console.log(`Subscription status: ${status}`);
        });
    };

    setupSubscription();

    // CRITICAL: Cleanup to prevent memory leaks
    return () => {
      if (channel) {
        console.log(`Unsubscribing from ${table}`);
        channel.unsubscribe();
      }
    };
  }, [table, event, filter, JSON.stringify(queryKey)]);
}

// Usage example:
function VisitorQueueScreen({ guardId }: { guardId: string }) {
  const queryKey = ['visitors', 'queue', guardId];

  // Query visitors
  const { data: visitors } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('visitors')
        .select('*')
        .eq('status', 'pending')
        .order('arrival_time', { ascending: true });
      return data;
    },
  });

  // Subscribe to real-time updates
  useRealtimeSubscription({
    table: 'visitors',
    event: '*',
    filter: 'status=eq.pending',
    queryKey,
    onEvent: (payload) => {
      // Optional: play sound on new visitor
      if (payload.eventType === 'INSERT') {
        playVisitorArrivedSound();
      }
    },
  });

  return <VisitorList visitors={visitors} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct FCM/APNs SDK integration | Expo Notifications with ExpoPushToken | Expo SDK 44+ (2021) | Simplified token management, no native certificates needed, works with EAS Build |
| Manual polling for updates | Supabase Realtime postgres_changes | Supabase v2 (2022), RLS support (2023) | Real-time updates with RLS authorization, no custom WebSocket server |
| Redux/Zustand for notification state | TanStack Query with invalidation | TanStack Query v4+ (2022) | Server state separated from client state, automatic cache management |
| expo-server-sdk-node for sending | Database webhooks + Edge Functions | Supabase Edge Functions (2023) | No separate Node.js server needed, JWT-based auth, automatic scaling |
| Notification preferences in client | Database-driven preferences with DND | Modern pattern (2024+) | Per-user, per-type settings, timezone-aware DND, template system |

**Deprecated/outdated:**
- expo-permissions package: Merged into expo-notifications (SDK 41+)
- Legacy FCM API: Google requires FCM HTTP v1 API as of June 2024
- Notification channel changes post-release: Android permanently locks importance on first creation

## Open Questions

Things that couldn't be fully resolved:

1. **Edge function send-push implementation details**
   - What we know: Edge function deployed, JWT required, mentioned in MEMORY.md
   - What's unclear: Current implementation (database webhook trigger vs. manual invocation, retry logic, error handling)
   - Recommendation: Review existing edge function code to determine integration points. Implement database webhook trigger on notifications table INSERT if not already done.

2. **Token expiration and cleanup strategy**
   - What we know: FCM considers tokens stale after 270 days inactivity. Android tokens may change on reinstall.
   - What's unclear: Automated cleanup strategy for stale tokens in push_tokens table
   - Recommendation: Implement monthly cleanup job (Supabase cron or pg_cron) to delete tokens with last_used_at > 90 days AND mark failed DeviceNotRegistered responses in edge function

3. **Badge count strategy for multiple notification types**
   - What we know: Badge should cap at double digits to avoid overwhelming users
   - What's unclear: Whether to show total count or prioritized count (e.g., visitor arrivals only)
   - Recommendation: Start with total unread count capped at 9+, gather user feedback, potentially switch to priority-based counting if users report noise

4. **Performance at scale for real-time subscriptions**
   - What we know: Supabase Realtime RLS checks can bottleneck at high throughput
   - What's unclear: Expected volume for visitor arrivals and guard queue updates (current community size)
   - Recommendation: Start with postgres_changes (simpler). If performance issues arise with >100 concurrent guard connections, migrate to Broadcast channel pattern.

## Sources

### Primary (HIGH confidence)
- [Expo Notifications API Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/) - Complete API reference
- [Expo Push Notifications Setup Guide](https://docs.expo.dev/push-notifications/push-notifications-setup/) - Official setup workflow
- [Expo Push Notifications FAQ & Troubleshooting](https://docs.expo.dev/push-notifications/faq/) - Common issues and solutions
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) - Real-time subscription API
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) - RLS integration details
- [Supabase Push Notifications Example](https://supabase.com/docs/guides/functions/examples/push-notifications) - Database webhook + Edge Function pattern

### Secondary (MEDIUM confidence)
- [Firebase FCM Token Management Best Practices](https://firebase.google.com/docs/cloud-messaging/manage-tokens) - Token refresh frequency, expiration handling
- [TanStack Query Invalidation Guide](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) - Cache invalidation patterns
- [Making Expo Notifications Work (Android 12+, iOS)](https://medium.com/@gligor99/making-expo-notifications-actually-work-even-on-android-12-and-ios-206ff632a845) - Platform-specific gotchas
- [Avoid Common Supabase Gotchas in React Native](https://www.prosperasoft.com/blog/database/supabase/supabase-react-native-gotchas/) - Memory leaks, subscription cleanup

### Tertiary (LOW confidence - validate before using)
- [Notification System Database Design](https://www.pingram.io/blog/notification-service-design-with-architectural-diagrams) - Schema patterns (general, not Supabase-specific)
- [iOS Badge Notification Best Practices](https://www.willowtreeapps.com/craft/best-practices-for-driving-engagement-with-ios-app-notification-badges) - Badge count psychology
- Community discussions on TanStack Query + Realtime integration (no official guide exists)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Expo and Supabase are official, mature solutions with extensive documentation
- Architecture: HIGH - Patterns verified with official documentation and code examples
- Pitfalls: HIGH - Based on official troubleshooting guides and verified community issues
- Integration details: MEDIUM - Some edge function implementation details need verification in codebase

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - Expo and Supabase are stable, but notification platform requirements can change quarterly)
