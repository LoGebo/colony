import { Stack } from 'expo-router';

export default function VisitorsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Visitantes' }} />
      <Stack.Screen name="create" options={{ title: 'Nueva Invitacion' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle Invitacion' }} />
      <Stack.Screen name="history" options={{ title: 'Historial' }} />
    </Stack>
  );
}
