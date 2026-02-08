import { Stack } from 'expo-router';

export default function DirectoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Directorio' }} />
      <Stack.Screen name="vehicles" options={{ title: 'Vehiculos' }} />
    </Stack>
  );
}
