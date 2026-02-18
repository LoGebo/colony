import { Stack } from 'expo-router';

export default function GuardMessagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[conversationId]" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
