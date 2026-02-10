import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAnnouncementFeed,
  useAcknowledgeAnnouncement,
  type AnnouncementFeedItem,
} from '@/hooks/useAnnouncements';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type FilterTab = 'all' | 'urgent' | 'unread';

export default function AnnouncementsIndexScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const { data: feedItems, isLoading, refetch } = useAnnouncementFeed();
  const acknowledgeMutation = useAcknowledgeAnnouncement();

  const filtered = (feedItems ?? []).filter((item) => {
    if (activeFilter === 'urgent') return item.announcements.is_urgent;
    if (activeFilter === 'unread') return !item.read_at;
    return true;
  });

  const handleAcknowledge = useCallback(
    (announcementId: string) => {
      acknowledgeMutation.mutate(announcementId);
    },
    [acknowledgeMutation]
  );

  const getSegmentLabel = (segment: string): string => {
    switch (segment) {
      case 'all':
        return 'Community';
      case 'owners':
        return 'Owners';
      case 'tenants':
        return 'Tenants';
      default:
        return 'Info';
    }
  };

  const getSegmentStyle = (
    item: AnnouncementFeedItem
  ): { bg: string; color: string } => {
    if (item.announcements.is_urgent) {
      return { bg: colors.dangerBgLight, color: colors.danger };
    }
    if (!item.read_at) {
      return { bg: colors.primaryLight, color: colors.primary };
    }
    return { bg: colors.border, color: colors.textCaption };
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Lumina Central</Text>
          <Text style={styles.headerTitle}>Announcements</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(
            [
              { key: 'all', label: 'All Posts' },
              { key: 'unread', label: 'Unread' },
              { key: 'urgent', label: 'Urgent' },
            ] as { key: FilterTab; label: string }[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterPill,
                activeFilter === tab.key && styles.filterPillActive,
              ]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === tab.key && styles.filterPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerMessage}>
            <Ionicons
              name="megaphone-outline"
              size={48}
              color={colors.textDisabled}
            />
            <Text style={styles.emptyTitle}>No announcements</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'unread'
                ? 'All announcements have been read.'
                : activeFilter === 'urgent'
                  ? 'No urgent announcements right now.'
                  : 'There are no announcements yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((item) => {
              const isUrgent = item.announcements.is_urgent;
              const isUnread = !item.read_at;
              const isAcknowledged = !!item.acknowledged_at;
              const segmentStyle = getSegmentStyle(item);

              return (
                <TouchableOpacity
                  key={item.announcement_id}
                  style={[
                    styles.card,
                    isUrgent && styles.cardUrgent,
                    !isUnread && !isUrgent && styles.cardRead,
                  ]}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push(
                      `/(resident)/announcements/${item.announcement_id}`
                    )
                  }
                >
                  {/* Card Header */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardBadgeRow}>
                      <View
                        style={[
                          styles.segmentBadge,
                          { backgroundColor: segmentStyle.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentBadgeText,
                            { color: segmentStyle.color },
                          ]}
                        >
                          {isUrgent
                            ? 'Critical'
                            : getSegmentLabel(
                                item.announcements.target_segment
                              )}
                        </Text>
                      </View>
                      {isUrgent && <View style={styles.urgentDot} />}
                      {isUnread && !isUrgent && (
                        <View style={styles.unreadDot} />
                      )}
                    </View>
                    <Text style={styles.cardTime}>
                      {formatRelative(item.announcements.created_at)}
                    </Text>
                  </View>

                  {/* Title */}
                  <Text
                    style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}
                    numberOfLines={2}
                  >
                    {item.announcements.title}
                  </Text>

                  {/* Body preview */}
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {item.announcements.body}
                  </Text>

                  {/* Acknowledge button if required */}
                  {item.announcements.requires_acknowledgment &&
                    !isAcknowledged && (
                      <View style={styles.ackContainer}>
                        <View style={styles.ackIconContainer}>
                          <Ionicons
                            name="document-text-outline"
                            size={18}
                            color={colors.textCaption}
                          />
                        </View>
                        <View style={styles.ackTextContainer}>
                          <Text style={styles.ackLabel}>Action Required</Text>
                          <Text style={styles.ackDescription}>
                            Read Acknowledgment
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.ackButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAcknowledge(item.announcement_id);
                          }}
                          disabled={acknowledgeMutation.isPending}
                        >
                          <Text style={styles.ackButtonText}>
                            {acknowledgeMutation.isPending
                              ? 'Confirming...'
                              : 'Accept'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                  {/* Already acknowledged indicator */}
                  {item.announcements.requires_acknowledgment &&
                    isAcknowledged && (
                      <View style={styles.acknowledgedRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={colors.success}
                        />
                        <Text style={styles.acknowledgedText}>Acknowledged</Text>
                      </View>
                    )}
                </TouchableOpacity>
              );
            })}
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
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  // Filters
  filterContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
  },
  filterScroll: {
    gap: spacing.md,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 20,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  filterPillText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
  },
  filterPillTextActive: {
    fontFamily: fonts.bold,
    color: colors.textOnDark,
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  // Empty / Loading
  centerMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // List
  list: {
    gap: spacing.xl,
  },
  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['3xl'],
    padding: spacing.cardPadding,
    ...shadows.sm,
  },
  cardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  cardRead: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.85,
  },
  // Card top row
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  segmentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  segmentBadgeText: {
    fontFamily: fonts.black,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  urgentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cardTime: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  // Card body
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  cardTitleUnread: {
    fontFamily: fonts.black,
  },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  // Acknowledge
  ackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
  },
  ackIconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackTextContainer: {
    flex: 1,
  },
  ackLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
  },
  ackDescription: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  ackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.md,
  },
  ackButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textOnDark,
  },
  // Acknowledged
  acknowledgedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  acknowledgedText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
  },
});
