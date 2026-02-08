import { Stack } from 'expo-router';

export default function AnnouncementsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Avisos' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle Aviso' }} />
    </Stack>
  );
}
