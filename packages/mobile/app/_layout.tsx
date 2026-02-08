import '../global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { SYSTEM_ROLES } from '@upoe/shared';

// Keep splash screen visible until we determine auth state
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useSession();
  const role = session?.user?.app_metadata?.role as string | undefined;

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null; // SplashScreen stays visible
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Unauthenticated: show auth screens */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Resident role */}
      <Stack.Protected guard={role === SYSTEM_ROLES.RESIDENT}>
        <Stack.Screen name="(resident)" />
      </Stack.Protected>

      {/* Guard role */}
      <Stack.Protected guard={role === SYSTEM_ROLES.GUARD}>
        <Stack.Screen name="(guard)" />
      </Stack.Protected>

      {/* Admin roles (community_admin + manager) on mobile */}
      <Stack.Protected
        guard={
          role === SYSTEM_ROLES.COMMUNITY_ADMIN ||
          role === SYSTEM_ROLES.MANAGER
        }
      >
        <Stack.Screen name="(admin)" />
      </Stack.Protected>

      {/* Pending setup: show onboarding (within auth group) */}
      <Stack.Protected guard={!!session && role === 'pending_setup'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <QueryProvider>
        <RootNavigator />
      </QueryProvider>
    </SessionProvider>
  );
}
