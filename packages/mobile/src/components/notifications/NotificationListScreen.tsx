import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNotificationList, useMarkNotificationRead } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@upoe/shared';

type Notification = Database['public']['Tables']['notifications']['Row'];

// Type icon mapping
const TYPE_ICONS: Record<string, string> = {
  ticket_created: '🔧',
  ticket_assigned: '🔧',
  ticket_status_changed: '🔧',
  ticket_comment_added: '🔧',
  sla_warning: '⏰',
  sla_breach: '⏰',
  new_message: '💬',
  message_reaction: '💬',
  conversation_mention: '💬',
  document_published: '📄',
  signature_required: '📄',
  signature_reminder: '📄',
  announcement: '📢',
  survey_published: '📢',
  payment_due: '💳',
  payment_received: '💳',
  visitor_arrived: '👥',
  package_arrived: '📦',
  emergency_alert: '🚨',
};

const getTypeIcon = (type: string): string => {
  return TYPE_ICONS[type] || '🔔';
};

export function NotificationListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: notifications = [], isLoading } = useNotificationList();
  const { mutate: markRead } = useMarkNotificationRead();

  const handleNotificationTap = (notification: Notification) => {
    // Fire-and-forget mark as read
    if (!notification.read_at) {
      markRead(notification.id);
    }

    // Navigate based on notification type and action_url
    if (notification.action_url) {
      router.push(notification.action_url as any);
      return;
    }

    // Fallback navigation based on type
    const data = notification.data as any;
    const type = notification.type;

    if (type.startsWith('ticket_') && data?.ticket_id) {
      router.push(`/(resident)/maintenance/${data.ticket_id}` as any);
    } else if (type === 'announcement' && data?.announcement_id) {
      router.push(`/(resident)/announcements/${data.announcement_id}` as any);
    } else if (type.startsWith('payment_')) {
      router.push('/(resident)/payments/' as any);
    } else if (type === 'package_arrived') {
      router.push('/(resident)/more/packages' as any);
    } else if (type === 'visitor_arrived' && data?.visitor_id) {
      router.push(`/(resident)/visitors/${data.visitor_id}` as any);
    } else if (type.startsWith('document_') && data?.document_id) {
      router.push(`/(resident)/more/documents/${data.document_id}` as any);
    } else if (type.startsWith('message_') || type === 'conversation_mention') {
      router.push('/(resident)/community/' as any);
    }
  };

  const handleMarkAllRead = async () => {
    // Mark all unread notifications as read
    const unreadNotifications = notifications.filter((n) => !n.read_at);
    unreadNotifications.forEach((n) => markRead(n.id));
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isUnread = !item.read_at;
    const relativeTime = formatDistanceToNow(new Date(item.created_at), {
      addSuffix: true,
      locale: es,
    });
    const icon = getTypeIcon(item.type);

    return (
      <TouchableOpacity
        onPress={() => handleNotificationTap(item)}
        className={`flex-row p-4 border-b border-gray-200 ${
          isUnread ? 'bg-blue-50' : 'bg-white'
        }`}
        accessibilityLabel={`${item.title}, ${isUnread ? 'unread' : 'read'}`}
        accessibilityRole="button"
      >
        {/* Icon */}
        <View className="mr-3 pt-1">
          <Text style={{ fontSize: 24 }}>{icon}</Text>
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className={`text-base ${isUnread ? 'font-semibold' : 'font-normal'} mb-1`}>
            {item.title}
          </Text>
          {item.body && (
            <Text className="text-sm text-gray-600 mb-1" numberOfLines={2}>
              {item.body}
            </Text>
          )}
          <Text className="text-xs text-gray-400">{relativeTime}</Text>
        </View>

        {/* Unread indicator */}
        {isUnread && (
          <View className="ml-2 pt-2">
            <View className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-12">
      <Text style={{ fontSize: 48 }} className="mb-4">
        🔔
      </Text>
      <Text className="text-gray-500 text-base">Sin notificaciones</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <Text className="text-xl font-bold">Notificaciones</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            className="px-3 py-1.5 bg-blue-500 rounded-md"
            accessibilityLabel="Mark all as read"
            accessibilityRole="button"
          >
            <Text className="text-white text-sm font-medium">Marcar todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notification List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
}
