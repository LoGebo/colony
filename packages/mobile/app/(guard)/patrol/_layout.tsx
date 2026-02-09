import { Stack } from 'expo-router';

export default function PatrolLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Rondas' }} />
      <Stack.Screen name="[id]" options={{ title: 'Ronda Activa' }} />
      <Stack.Screen
        name="scan"
        options={{ title: 'Escanear Punto', presentation: 'modal' }}
      />
    </Stack>
  );
}
