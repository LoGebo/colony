import { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  usePatrolRoutes,
  useActivePatrolLog,
  useStartPatrol,
} from '@/hooks/usePatrol';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

interface RouteItem {
  id: string;
  name: string;
  description: string | null;
  checkpoint_sequence: string[] | null;
  estimated_duration_minutes: number | null;
  status: string;
}

export default function PatrolIndexScreen() {
  const router = useRouter();
  const { communityId, guardId } = useAuth();
  const { data: routes, isLoading, refetch, isRefetching } = usePatrolRoutes(communityId);
  const { data: activePatrol } = useActivePatrolLog(guardId);
  const startPatrol = useStartPatrol();

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleStartPatrol = useCallback(
    async (routeId: string) => {
      if (!guardId || !communityId) return;

      try {
        const result = await startPatrol.mutateAsync({
          routeId,
          guardId,
          communityId,
        });
        router.push(`/(guard)/patrol/${result.id}`);
      } catch (error: any) {
        Alert.alert('Error', error?.message ?? 'Failed to start patrol.');
      }
    },
    [guardId, communityId, startPatrol, router],
  );

  const renderRoute = useCallback(
    ({ item }: { item: RouteItem }) => {
      const checkpointCount = item.checkpoint_sequence?.length ?? 0;

      return (
        <GlassCard style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <View style={styles.routeIconBox}>
              <Ionicons name="navigate" size={24} color={colors.primary} />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.routeDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.routeStats}>
            <View style={styles.statItem}>
              <Ionicons name="flag-outline" size={16} color={colors.textCaption} />
              <Text style={styles.statText}>
                {checkpointCount} checkpoint{checkpointCount !== 1 ? 's' : ''}
              </Text>
            </View>
            {item.estimated_duration_minutes && (
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color={colors.textCaption} />
                <Text style={styles.statText}>
                  ~{item.estimated_duration_minutes} min
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleStartPatrol(item.id)}
            disabled={startPatrol.isPending || !!activePatrol}
          >
            {startPatrol.isPending ? (
              <ActivityIndicator color={colors.textOnDark} size="small" />
            ) : (
              <>
                <Ionicons name="play" size={18} color={colors.textOnDark} />
                <Text style={styles.startButtonText}>Start Patrol</Text>
              </>
            )}
          </TouchableOpacity>
        </GlassCard>
      );
    },
    [handleStartPatrol, startPatrol.isPending, activePatrol],
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patrol</Text>
        <Text style={styles.headerSubtitle}>Security checkpoint routes</Text>
      </View>

      {/* Active Patrol Banner */}
      {activePatrol && (
        <TouchableOpacity
          style={styles.activeBanner}
          onPress={() => router.push(`/(guard)/patrol/${activePatrol.id}`)}
        >
          <View style={styles.activeBannerOrb} />
          <View style={styles.activeBannerContent}>
            <View style={styles.activeBannerLeft}>
              <View style={styles.activePulse}>
                <Ionicons name="navigate" size={20} color={colors.textOnDark} />
              </View>
              <View>
                <Text style={styles.activeBannerLabel}>PATROL IN PROGRESS</Text>
                <Text style={styles.activeBannerProgress}>
                  {activePatrol.checkpoints_visited ?? 0} / {activePatrol.checkpoints_total ?? 0}{' '}
                  checkpoints
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>
      )}

      {/* Route List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={(routes ?? []) as RouteItem[]}
          keyExtractor={(item) => item.id}
          renderItem={renderRoute}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>No Routes Available</Text>
              <Text style={styles.emptySubtitle}>
                Patrol routes are configured by community administrators.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  activeBanner: {
    marginHorizontal: spacing.pagePaddingX,
    padding: spacing['3xl'],
    borderRadius: borderRadius['3xl'],
    backgroundColor: colors.teal,
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
    ...shadows.lg,
  },
  activeBannerOrb: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  activeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  activePulse: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBannerLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  activeBannerProgress: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.xl,
  },
  routeCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  routeIconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  routeDescription: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  routeStats: {
    flexDirection: 'row',
    gap: spacing['3xl'],
    marginBottom: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    ...shadows.blueGlow,
  },
  startButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'] * 1.5,
    gap: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
});
