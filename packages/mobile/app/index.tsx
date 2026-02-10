import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { colors } from '@/theme';

export default function IndexRedirect() {
  const { session, isLoading } = useAuth();
  const { isResident, isGuard, isAdminRole, isPendingSetup } = useRole();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isPendingSetup) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (isGuard) {
    return <Redirect href="/(guard)" />;
  }

  if (isAdminRole) {
    return <Redirect href="/(admin)" />;
  }

  // Default: resident
  return <Redirect href="/(resident)" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
