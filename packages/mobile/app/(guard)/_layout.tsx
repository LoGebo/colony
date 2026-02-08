import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function GuardLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Caseta',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{'🛡️'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          tabBarLabel: 'Directorio',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{'🔍'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="packages"
        options={{
          tabBarLabel: 'Paquetes',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>{'📦'}</Text>
          ),
        }}
      />
      {/* Hide gate stack from tabs -- accessed via router.push from index */}
      <Tabs.Screen
        name="gate"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
