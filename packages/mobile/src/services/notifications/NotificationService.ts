import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str: unknown): str is string {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

type NotificationType =
  | 'emergency_alert'
  | 'visitor_arrived'
  | 'ticket_created'
  | 'ticket_assigned'
  | 'ticket_status_changed'
  | 'ticket_comment_added'
  | 'sla_warning'
  | 'sla_breach'
  | 'new_message'
  | 'message_reaction'
  | 'conversation_mention'
  | 'document_published'
  | 'signature_required'
  | 'signature_reminder'
  | 'announcement'
  | 'survey_published'
  | 'payment_due'
  | 'payment_received'
  | 'package_arrived';

interface NotificationData {
  notification_id?: string;
  action_type?: string;
  visitor_id?: string;
  ticket_id?: string;
  announcement_id?: string;
  type?: NotificationType;
  [key: string]: unknown;
}

/**
 * NotificationService - Singleton service for push notification management
 *
 * Handles:
 * - Push token registration with FCM/APNs via Expo
 * - Android notification channels setup
 * - Foreground notification display with type-based priority
 * - Notification tap deep linking
 * - Token storage in push_tokens table
 */
class NotificationService {
  private static instance: NotificationService;
  private notificationListener?: Notifications.Subscription;
  private responseListener?: Notifications.Subscription;
  private tokenListener?: Notifications.Subscription;
  private currentUserId?: string;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Main initialization - call after user authentication
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;

    // Set up foreground notification handler
    this.setupNotificationHandler();

    // Set up Android channels (must happen before permission request)
    if (Platform.OS === 'android') {
      await this.setupAndroidChannels();
    }

    // Register for push notifications and store token
    await this.registerForPushNotifications(userId);

    // Set up listeners for token refresh and notification events
    this.setupListeners();

    // Clear badge count
    await this.clearBadge();
  }

  /**
   * Configure foreground notification display behavior
   */
  private setupNotificationHandler(): void {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as NotificationData;
        const type = data.type;

        // Emergency alerts: MAX priority with sound
        if (type === 'emergency_alert') {
          return {
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          };
        }

        // Visitor arrivals: HIGH priority with sound
        if (type === 'visitor_arrived') {
          return {
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          };
        }

        // Default: banner only, no sound
        return {
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        };
      },
    });
  }

  /**
   * Create Android notification channels
   * Must be called before requesting permissions
   */
  private async setupAndroidChannels(): Promise<void> {
    // Visitor arrivals channel
    await Notifications.setNotificationChannelAsync('visitor-arrivals', {
      name: 'Visitor Arrivals',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });

    // Emergency channel
    await Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: '#dc2626',
      bypassDnd: true,
    });

    // Default channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  /**
   * Register for push notifications and get Expo push token
   */
  private async registerForPushNotifications(userId: string): Promise<string | null> {
    // Only physical devices can receive push notifications
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      // Store token in database
      await this.storeToken(token.data, userId);

      return token.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Store push token in database
   */
  private async storeToken(token: string, userId: string): Promise<void> {
    try {
      const deviceName = Device.deviceName ?? `${Platform.OS} device`;

      // Query existing token for this user
      const { data: existing } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('token', token)
        .single();

      if (existing) {
        // Update existing token
        await supabase
          .from('push_tokens')
          .update({
            device_name: deviceName,
            is_active: true,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Insert new token
        await supabase.from('push_tokens').insert({
          user_id: userId,
          platform: Platform.OS as 'ios' | 'android',
          token,
          device_name: deviceName,
          is_active: true,
          last_used_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error storing push token:', error);
    }
  }

  /**
   * Set up notification event listeners
   */
  private setupListeners(): void {
    // Token refresh listener
    this.tokenListener = Notifications.addPushTokenListener((token) => {
      if (this.currentUserId) {
        this.storeToken(token.data, this.currentUserId);
      }
    });

    // Foreground notification received listener
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received in foreground:', notification);
    });

    // Notification tap listener
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      this.handleNotificationTap(response);
    });
  }

  /**
   * Handle notification tap - route to appropriate screen
   */
  private async handleNotificationTap(response: Notifications.NotificationResponse): Promise<void> {
    const data = response.notification.request.content.data as NotificationData;
    const actionType = data.action_type;

    // Mark notification as read (fire-and-forget)
    if (data.notification_id) {
      supabase.rpc('mark_notification_read', {
        p_notification_id: data.notification_id,
      } as never).then(({ error }) => {
        if (error) console.error('Error marking notification as read:', error);
      });
    }

    // Route based on action type
    try {
      switch (actionType) {
        case 'open_visitor':
          if (isValidUUID(data.visitor_id)) {
            router.push(`/(resident)/visitors/${data.visitor_id}`);
          }
          break;

        case 'open_payment':
          router.push('/(resident)/payments/');
          break;

        case 'open_ticket':
          if (isValidUUID(data.ticket_id)) {
            router.push(`/(resident)/maintenance/${data.ticket_id}`);
          }
          break;

        case 'open_announcement':
          if (isValidUUID(data.announcement_id)) {
            router.push(`/(resident)/announcements/${data.announcement_id}`);
          }
          break;

        case 'open_package':
          router.push('/(resident)/more/packages');
          break;

        default:
          // Navigate to root if no specific action
          router.push('/(resident)/');
          break;
      }
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  }

  /**
   * Clear app badge count
   */
  async clearBadge(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  /**
   * Clean up listeners (call on sign-out)
   */
  cleanup(): void {
    this.notificationListener?.remove();
    this.responseListener?.remove();
    this.tokenListener?.remove();
    this.currentUserId = undefined;
  }
}

// Export singleton instance
export default NotificationService.getInstance();
