import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAnnouncementDetail,
  useMarkAnnouncementRead,
  useAcknowledgeAnnouncement,
} from '@/hooks/useAnnouncements';
import { formatDateTime, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function AnnouncementDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: announcement, isLoading } = useAnnouncementDetail(id!);
  const markReadMutation = useMarkAnnouncementRead();
  const acknowledgeMutation = useAcknowledgeAnnouncement();
  const hasMarkedRead = useRef(false);

  // Mark as read on mount
  useEffect(() => {
    if (id && !hasMarkedRead.current) {
      hasMarkedRead.current = true;
      markReadMutation.mutate(id);
    }
  }, [id]);

  const getSegmentLabel = (segment: string): string => {
    switch (segment) {
      case 'all':
        return 'All Residents';
      case 'owners':
        return 'Owners Only';
      case 'tenants':
        return 'Tenants Only';
      default:
        return segment;
    }
  };

  if (isLoading || !announcement) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const readPercentage =
    announcement.total_recipients > 0
      ? Math.round(
          (announcement.read_count / announcement.total_recipients) * 100
        )
      : 0;

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcement</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Badges */}
        <View style={styles.badgeRow}>
          {announcement.is_urgent && (
            <View style={styles.urgentBadge}>
              <Ionicons name="warning" size={12} color={colors.danger} />
              <Text style={styles.urgentBadgeText}>Urgent</Text>
            </View>
          )}
          <View style={styles.segmentBadge}>
            <Text style={styles.segmentBadgeText}>
              {getSegmentLabel(announcement.target_segment)}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{announcement.title}</Text>

        {/* Meta */}
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={colors.textCaption} />
          <Text style={styles.metaText}>
            {formatDateTime(announcement.created_at)}
          </Text>
          <Text style={styles.metaDot}>-</Text>
          <Text style={styles.metaRelative}>
            {formatRelative(announcement.created_at)}
          </Text>
        </View>

        {/* Body */}
        <View style={styles.bodyCard}>
          <Text style={styles.bodyText}>{announcement.body}</Text>
        </View>

        {/* Read count stats */}
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Ionicons name="eye-outline" size={18} color={colors.textMuted} />
            <Text style={styles.statsTitle}>Read Status</Text>
          </View>

          <View style={styles.statsBarContainer}>
            <View style={styles.statsBarBackground}>
              <View
                style={[styles.statsBarFill, { width: `${readPercentage}%` }]}
              />
            </View>
            <Text style={styles.statsBarPercentage}>{readPercentage}%</Text>
          </View>

          <View style={styles.statsDetailRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{announcement.read_count}</Text>
              <Text style={styles.statLabel}>Read</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {announcement.total_recipients}
              </Text>
              <Text style={styles.statLabel}>Total Recipients</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {announcement.total_recipients - announcement.read_count}
              </Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
          </View>
        </View>

        {/* Acknowledge button */}
        {announcement.requires_acknowledgment && (
          <View style={styles.ackSection}>
            <View style={styles.ackCard}>
              <View style={styles.ackIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.ackTitle}>Acknowledgment Required</Text>
              <Text style={styles.ackDescription}>
                Please confirm that you have read and understood this
                announcement.
              </Text>
              <TouchableOpacity
                style={styles.ackButton}
                onPress={() => acknowledgeMutation.mutate(id!)}
                disabled={acknowledgeMutation.isPending}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={colors.textOnDark}
                />
                <Text style={styles.ackButtonText}>
                  {acknowledgeMutation.isPending
                    ? 'Confirming...'
                    : 'I Acknowledge'}
                </Text>
              </TouchableOpacity>
            </View>
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
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
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  // Badges
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.dangerBgLight,
    borderRadius: borderRadius.sm,
  },
  urgentBadgeText: {
    fontFamily: fonts.black,
    fontSize: 11,
    color: colors.danger,
    textTransform: 'uppercase',
  },
  segmentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  segmentBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  // Title
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.textPrimary,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing['3xl'],
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
  },
  metaDot: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textCaption,
  },
  metaRelative: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  // Body
  bodyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    marginBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  bodyText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textBody,
    lineHeight: 26,
  },
  // Stats
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    marginBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  statsBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statsBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  statsBarPercentage: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    width: 40,
    textAlign: 'right',
  },
  statsDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  // Acknowledge
  ackSection: {
    marginBottom: spacing['3xl'],
  },
  ackCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
  },
  ackIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  ackTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  ackDescription: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textBody,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['3xl'],
  },
  ackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%',
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
  },
  ackButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
