import { Stack } from 'expo-router';

export default function CommunityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="post/create" />
      <Stack.Screen name="amenities/index" />
      <Stack.Screen name="amenities/[id]" />
      <Stack.Screen name="amenities/reserve" />
      <Stack.Screen name="reservations/index" />
      <Stack.Screen name="reservations/[id]" />
    </Stack>
  );
}
