import { Stack } from 'expo-router';

export default function DirectoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="vehicles" />
    </Stack>
  );
}
