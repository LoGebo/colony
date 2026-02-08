import { Stack } from 'expo-router';

export default function PackagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Paquetes' }} />
      <Stack.Screen name="log" options={{ title: 'Registrar Paquete' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle Paquete' }} />
    </Stack>
  );
}
