import { Stack } from 'expo-router';

export default function GateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }}>
      <Stack.Screen name="scan" />
      <Stack.Screen name="visitor-result" />
      <Stack.Screen name="manual-checkin" />
    </Stack>
  );
}
