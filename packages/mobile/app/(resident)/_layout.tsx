import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function ResidentLayout() {
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
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'🏠'}</Text>,
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
        name="payments"
        options={{
          tabBarLabel: 'Pagos',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'💳'}</Text>,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarLabel: 'Comunidad',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'💬'}</Text>,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarLabel: 'Mas',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'☰'}</Text>,
        }}
      />
    </Tabs>
  );
}
