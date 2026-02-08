import { Stack } from 'expo-router';

export default function GateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="scan" options={{ title: 'Escanear QR' }} />
      <Stack.Screen name="manual-checkin" options={{ title: 'Registro Manual' }} />
      <Stack.Screen name="visitor-result" options={{ title: 'Resultado' }} />
    </Stack>
  );
}
