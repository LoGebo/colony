import { Tabs, Redirect } from 'expo-router';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadConversations } from '@/hooks/useChat';
import { colors, fonts, shadows } from '@/theme';

type TabIconName =
  | 'home'
  | 'home-outline'
  | 'people'
  | 'people-outline'
  | 'chatbubble'
  | 'chatbubble-outline'
  | 'calendar'
  | 'calendar-outline'
  | 'person'
  | 'person-outline';

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

export default function ResidentLayout() {
  const { session, isLoading } = useAuth();

  // Redirect to sign-in when session is cleared (e.g. after logout)
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
      screenListeners={({ navigation }) => ({
        tabPress: (e) => {
          // When a tab is pressed, pop its nested stack back to root
          const target = e.target;
          if (!target) return;
          const tabName = target.split('-')[0];
          const state = navigation.getState();
          const tabRoute = state.routes.find((r: any) => r.name === tabName);
          if (tabRoute?.state?.index && tabRoute.state.index > 0) {
            navigation.navigate(tabName, { screen: 'index' });
          }
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="visitors"
        options={{
          title: 'VISITORS',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'COMMUNITY',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'BILLING',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} />
          ),
        }}
      />
      {/* Hidden stack screens accessible via navigation */}
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="maintenance" options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
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
