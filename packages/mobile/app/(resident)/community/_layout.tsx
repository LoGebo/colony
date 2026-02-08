import { Stack } from 'expo-router';

export default function CommunityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Comunidad' }} />
      <Stack.Screen name="post/create" options={{ title: 'Nuevo Post' }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="amenities/index" options={{ title: 'Amenidades' }} />
      <Stack.Screen name="amenities/[id]" options={{ title: 'Amenidad' }} />
      <Stack.Screen name="amenities/reserve" options={{ title: 'Reservar' }} />
      <Stack.Screen name="reservations/index" options={{ title: 'Mis Reservaciones' }} />
      <Stack.Screen name="reservations/[id]" options={{ title: 'Reservacion' }} />
    </Stack>
  );
}
