import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUnreadCount } from '@/hooks/useNotifications';
import { colors, fonts, borderRadius, shadows } from '@/theme';

interface Props {
  /** Override the default navigation target */
  href?: string;
}

export function NotificationBell({ href }: Props) {
  const router = useRouter();
  const { data: count = 0 } = useUnreadCount();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.push((href ?? '/(resident)/notifications') as Href)}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={20} color={colors.textBody} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.textOnDark,
    lineHeight: 12,
  },
});
