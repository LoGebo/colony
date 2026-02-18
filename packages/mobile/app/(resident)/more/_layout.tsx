import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile/index" />
      <Stack.Screen name="profile/[id]" />
      <Stack.Screen name="profile/unit" />
      <Stack.Screen name="vehicles/index" />
      <Stack.Screen name="vehicles/create" />
      <Stack.Screen name="documents/index" />
      <Stack.Screen name="documents/[id]" />
      <Stack.Screen name="marketplace/index" />
      <Stack.Screen name="marketplace/[id]" />
      <Stack.Screen name="marketplace/create" />
      <Stack.Screen name="pets/index" />
      <Stack.Screen name="pets/create" />
      <Stack.Screen name="packages/index" />
      <Stack.Screen name="notification-settings" />
    </Stack>
  );
}
