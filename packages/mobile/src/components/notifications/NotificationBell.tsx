import { View, Text, TouchableOpacity } from 'react-native';
import { useUnreadCount } from '@/hooks/useNotifications';

interface NotificationBellProps {
  onPress: () => void;
}

export function NotificationBell({ onPress }: NotificationBellProps) {
  const { data: unreadCount = 0 } = useUnreadCount();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="relative"
      accessibilityLabel={`Notifications, ${unreadCount} unread`}
      accessibilityRole="button"
    >
      <Text style={{ fontSize: 22 }}>🔔</Text>

      {unreadCount > 0 && (
        <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
          <Text className="text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
