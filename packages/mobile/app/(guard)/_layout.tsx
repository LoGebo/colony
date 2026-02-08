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
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'🛡️'}</Text>,
        }}
      />
      <Tabs.Screen
        name="visitors"
        options={{
          tabBarLabel: 'Visitantes',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'👥'}</Text>,
        }}
      />
      <Tabs.Screen
        name="patrol"
        options={{
          tabBarLabel: 'Patrulla',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'🗺️'}</Text>,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          tabBarLabel: 'Incidentes',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'⚠️'}</Text>,
        }}
      />
    </Tabs>
  );
}
