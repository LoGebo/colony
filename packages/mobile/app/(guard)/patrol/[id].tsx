import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  usePatrolLogDetail,
  usePatrolCheckpoints,
  useAbandonPatrol,
} from '@/hooks/usePatrol';
import { formatTime } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function PatrolDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { communityId } = useAuth();
  const { data, isLoading } = usePatrolLogDetail(id);
  const { data: allCheckpoints } = usePatrolCheckpoints(communityId);
  const abandonPatrol = useAbandonPatrol();

  const checkpointMap = useMemo(() => {
    const map: Record<string, { name: string; description: string | null }> = {};
    (allCheckpoints ?? []).forEach((cp: any) => {
      map[cp.id] = { name: cp.name, description: cp.description };
    });
    return map;
  }, [allCheckpoints]);

  const visitedIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.checkpoint_logs.map((cl: any) => cl.checkpoint_id));
  }, [data]);

  const handleAbandon = useCallback(() => {
    if (!id) return;
    Alert.alert(
      'Abandon Patrol',
      'Are you sure you want to abandon this patrol? Progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            try {
              await abandonPatrol.mutateAsync(id);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error?.message ?? 'Failed to abandon patrol.');
            }
          },
        },
      ],
    );
  }, [id, abandonPatrol, router]);

  if (isLoading || !data) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Patrol</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  const { log, checkpoint_logs } = data;
  const total = log.checkpoints_total ?? 0;
  const visited = log.checkpoints_visited ?? 0;
  const progressPercent = total > 0 ? (visited / total) * 100 : 0;
  const isComplete = log.status === 'completed';
  const isAbandoned = log.status === 'abandoned';
  const isActive = log.status === 'in_progress';

  // Build ordered checkpoint list from route
  const routeCheckpointIds = (log as any).checkpoint_sequence ?? [];

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isComplete ? 'Patrol Complete' : isAbandoned ? 'Patrol Abandoned' : 'Active Patrol'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Card */}
        <GlassCard variant="dense" style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>PROGRESS</Text>
            <Text style={styles.progressCount}>
              {visited} / {total}
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: isComplete
                    ? colors.success
                    : isAbandoned
                      ? colors.danger
                      : colors.primary,
                },
              ]}
            />
          </View>
          {isComplete && (
            <View style={styles.completeBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.successText} />
              <Text style={styles.completeBadgeText}>Patrol completed successfully</Text>
            </View>
          )}
          {isAbandoned && (
            <View style={styles.abandonedBadge}>
              <Ionicons name="close-circle" size={16} color={colors.dangerText} />
              <Text style={styles.abandonedBadgeText}>Patrol was abandoned</Text>
            </View>
          )}
        </GlassCard>

        {/* Checkpoint List */}
        <Text style={styles.sectionLabel}>CHECKPOINTS</Text>
        <View style={styles.checkpointList}>
          {(allCheckpoints ?? []).map((cp: any, idx: number) => {
            const isVisited = visitedIds.has(cp.id);
            const checkpointLog = checkpoint_logs.find(
              (cl: any) => cl.checkpoint_id === cp.id,
            );

            return (
              <View
                key={cp.id}
                style={[
                  styles.checkpointItem,
                  idx < (allCheckpoints ?? []).length - 1 && styles.checkpointItemBorder,
                ]}
              >
                <View
                  style={[
                    styles.checkpointDot,
                    isVisited
                      ? styles.checkpointDotVisited
                      : styles.checkpointDotPending,
                  ]}
                >
                  {isVisited ? (
                    <Ionicons name="checkmark" size={14} color={colors.textOnDark} />
                  ) : (
                    <Text style={styles.checkpointDotNumber}>{idx + 1}</Text>
                  )}
                </View>
                <View style={styles.checkpointInfo}>
                  <Text
                    style={[
                      styles.checkpointName,
                      isVisited && styles.checkpointNameVisited,
                    ]}
                  >
                    {cp.name}
                  </Text>
                  {cp.description && (
                    <Text style={styles.checkpointDescription} numberOfLines={1}>
                      {cp.description}
                    </Text>
                  )}
                  {checkpointLog && (
                    <Text style={styles.checkpointTime}>
                      Scanned at {formatTime(checkpointLog.scanned_at)}
                    </Text>
                  )}
                </View>
                {isVisited && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                )}
              </View>
            );
          })}
        </View>

        {/* Actions */}
        {isActive && (
          <View style={styles.actionsGroup}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => router.push('/(guard)/patrol/scan')}
            >
              <Ionicons name="scan" size={22} color={colors.textOnDark} />
              <Text style={styles.scanButtonText}>Scan Checkpoint</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.abandonButton}
              onPress={handleAbandon}
              disabled={abandonPatrol.isPending}
            >
              {abandonPatrol.isPending ? (
                <ActivityIndicator color={colors.dangerText} size="small" />
              ) : (
                <Text style={styles.abandonButtonText}>Abandon Patrol</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.md,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing['3xl'],
  },
  progressCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  progressLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  progressCount: {
    fontFamily: fonts.black,
    fontSize: 18,
    color: colors.textPrimary,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  completeBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.successText,
  },
  abandonedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  abandonedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.dangerText,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  checkpointList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderMedium,
    overflow: 'hidden',
  },
  checkpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  checkpointItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkpointDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointDotVisited: {
    backgroundColor: colors.success,
  },
  checkpointDotPending: {
    backgroundColor: colors.border,
  },
  checkpointDotNumber: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
  },
  checkpointInfo: {
    flex: 1,
  },
  checkpointName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  checkpointNameVisited: {
    color: colors.successText,
  },
  checkpointDescription: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    marginTop: 2,
  },
  checkpointTime: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    marginTop: 4,
  },
  actionsGroup: {
    gap: spacing.xl,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    ...shadows.blueGlow,
  },
  scanButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  abandonButton: {
    height: spacing.smallButtonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.dangerBgLight,
    borderWidth: 1,
    borderColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dangerText,
  },
});
