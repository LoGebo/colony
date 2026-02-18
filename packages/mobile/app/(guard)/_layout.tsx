import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadConversations } from '@/hooks/useChat';
import { colors, fonts, shadows } from '@/theme';

type TabIconName =
  | 'shield'
  | 'shield-outline'
  | 'alert-circle'
  | 'alert-circle-outline'
  | 'chatbubble'
  | 'chatbubble-outline'
  | 'navigate'
  | 'navigate-outline'
  | 'ellipsis-horizontal'
  | 'ellipsis-horizontal-outline';

function TabBarIcon({ name, color }: { name: TabIconName; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
}

function ChatTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const { data: unreadCount } = useUnreadConversations();
  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <View>
      <Ionicons
        name={focused ? 'chatbubble' : 'chatbubble-outline'}
        size={24}
        color={color}
      />
      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {(unreadCount ?? 0) > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function GuardLayout() {
  const { session, isLoading } = useAuth();

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textCaption,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassTabBar }]} />
          </BlurView>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'GATE',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'shield' : 'shield-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'INCIDENTS',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'alert-circle' : 'alert-circle-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'MESSAGES',
          tabBarIcon: ({ focused, color }) => (
            <ChatTabIcon focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="patrol"
        options={{
          title: 'PATROL',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'navigate' : 'navigate-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gate"
        options={{
          title: 'MORE',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon
              name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
              color={color}
            />
          ),
          href: null,
        }}
      />
      {/* Hidden screens accessible via navigation */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="packages" options={{ href: null }} />
      <Tabs.Screen name="directory" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    height: Platform.OS === 'ios' ? 88 : 68,
    ...shadows.navShadow,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabLabel: {
    fontFamily: fonts.black,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textOnDark,
  },
});
