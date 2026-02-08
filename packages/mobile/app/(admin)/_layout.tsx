import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function AdminLayout() {
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
          tabBarLabel: 'Resumen',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'📊'}</Text>,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          tabBarLabel: 'Usuarios',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'👥'}</Text>,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          tabBarLabel: 'Reportes',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'📁'}</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: 'Config',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'⚙️'}</Text>,
        }}
      />
    </Tabs>
  );
}
