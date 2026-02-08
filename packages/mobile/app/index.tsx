import { Redirect } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';
import { SYSTEM_ROLES } from '@upoe/shared';

export default function IndexRedirect() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const role = session.user?.app_metadata?.role as string | undefined;

  switch (role) {
    case SYSTEM_ROLES.RESIDENT:
      return <Redirect href="/(resident)" />;
    case SYSTEM_ROLES.GUARD:
      return <Redirect href="/(guard)" />;
    case SYSTEM_ROLES.COMMUNITY_ADMIN:
    case SYSTEM_ROLES.MANAGER:
      return <Redirect href="/(admin)" />;
    case 'pending_setup':
      return <Redirect href="/(auth)/onboarding" />;
    default:
      return <Redirect href="/(auth)/sign-in" />;
  }
}
