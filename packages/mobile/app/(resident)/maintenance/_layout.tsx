import { Stack } from 'expo-router';

export default function MaintenanceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Mantenimiento' }} />
      <Stack.Screen name="create" options={{ title: 'Nuevo Reporte' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle Ticket' }} />
    </Stack>
  );
}
