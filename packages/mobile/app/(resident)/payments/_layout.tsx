import { Stack } from 'expo-router';

export default function PaymentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Pagos' }} />
      <Stack.Screen name="history" options={{ title: 'Historial de Pagos' }} />
      <Stack.Screen name="upload-proof" options={{ title: 'Subir Comprobante' }} />
    </Stack>
  );
}
