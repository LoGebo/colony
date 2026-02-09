import { Tabs } from 'expo-router';
import { StyleSheet, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, shadows } from '@/theme';

type TabIconName =
  | 'grid'
  | 'grid-outline'
  | 'people'
  | 'people-outline'
  | 'settings'
  | 'settings-outline';

function TabBarIcon({ name, color }: { name: TabIconName; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function AdminLayout() {
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
          title: 'DASHBOARD',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'grid' : 'grid-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'MANAGE',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
          ),
        }}
      />
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
});
