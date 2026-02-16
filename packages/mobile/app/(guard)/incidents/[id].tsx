import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIncidentDetail, useAddIncidentComment } from '@/hooks/useIncidents';
import { formatDateTime, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

function getSeverityStyle(severity: string) {
  switch (severity) {
    case 'critical':
      return { bg: colors.dangerBg, color: colors.dangerText, label: 'Critical' };
    case 'high':
      return { bg: colors.orangeBg, color: colors.orange, label: 'High' };
    case 'medium':
      return { bg: colors.warningBg, color: colors.warningText, label: 'Medium' };
    case 'low':
    default:
      return { bg: colors.border, color: colors.textCaption, label: 'Low' };
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'open':
      return { bg: colors.primaryLight, color: colors.primary, label: 'Open' };
    case 'in_progress':
      return { bg: colors.warningBg, color: colors.warningText, label: 'In Progress' };
    case 'resolved':
      return { bg: colors.successBg, color: colors.successText, label: 'Resolved' };
    case 'closed':
      return { bg: colors.border, color: colors.textCaption, label: 'Closed' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: status };
  }
}

interface TimelineEntry {
  action: string;
  actor?: string;
  timestamp?: string;
  note?: string;
}

export default function IncidentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: incident, isLoading } = useIncidentDetail(id);
  const addCommentMutation = useAddIncidentComment();

  const [comment, setComment] = useState('');

  const handleSendComment = useCallback(async () => {
    if (!comment.trim() || !id) return;

    try {
      await addCommentMutation.mutateAsync({
        incidentId: id,
        commentText: comment.trim(),
        isInternal: false,
      });
      setComment('');
    } catch {
      // Error handled by mutation
    }
  }, [comment, id, addCommentMutation]);

  if (isLoading || !incident) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Incident Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  const severityStyle = getSeverityStyle(incident.severity);
  const statusStyle = getStatusStyle(incident.status);
  const timeline = (incident.timeline as TimelineEntry[] | null) ?? [];
  const media = incident.media ?? [];

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {incident.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Badges Row */}
          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: severityStyle.bg }]}>
              <Ionicons name="alert-circle" size={14} color={severityStyle.color} />
              <Text style={[styles.badgeText, { color: severityStyle.color }]}>
                {severityStyle.label}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.badgeText, { color: statusStyle.color }]}>
                {statusStyle.label}
              </Text>
            </View>
            {incident.incident_number && (
              <Text style={styles.incidentNumber}>#{incident.incident_number}</Text>
            )}
          </View>

          {/* Description */}
          <GlassCard style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.descriptionText}>
              {incident.description || 'No description provided.'}
            </Text>
          </GlassCard>

          {/* Details */}
          <GlassCard style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>DETAILS</Text>
            <View style={styles.detailGrid}>
              {incident.location_description && (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textCaption} />
                  <Text style={styles.detailText}>{incident.location_description}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.textCaption} />
                <Text style={styles.detailText}>
                  {formatDateTime(incident.created_at)}
                </Text>
              </View>
              {incident.location_type && (
                <View style={styles.detailRow}>
                  <Ionicons name="map-outline" size={16} color={colors.textCaption} />
                  <Text style={styles.detailText}>{incident.location_type}</Text>
                </View>
              )}
            </View>
          </GlassCard>

          {/* Media Gallery */}
          {media.length > 0 && (
            <View style={styles.mediaSection}>
              <Text style={styles.sectionLabel}>EVIDENCE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mediaRow}
              >
                {media.map((m: any) => (
                  <View key={m.id} style={styles.mediaThumb}>
                    {m.media_type === 'photo' ? (
                      <Ionicons name="image-outline" size={28} color={colors.primary} />
                    ) : (
                      <Ionicons name="videocam-outline" size={28} color={colors.primary} />
                    )}
                    {m.caption && (
                      <Text style={styles.mediaCaption} numberOfLines={1}>
                        {m.caption}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <View style={styles.timelineSection}>
              <Text style={styles.sectionLabel}>TIMELINE</Text>
              {timeline.map((entry, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  {idx < timeline.length - 1 && <View style={styles.timelineLine} />}
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineAction}>{entry.action}</Text>
                    {entry.actor && (
                      <Text style={styles.timelineActor}>{entry.actor}</Text>
                    )}
                    {entry.note && (
                      <Text style={styles.timelineNote}>{entry.note}</Text>
                    )}
                    {entry.timestamp && (
                      <Text style={styles.timelineTime}>
                        {formatRelative(entry.timestamp)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Comment Input */}
        <View style={styles.commentBar}>
          <View style={styles.commentInputWrap}>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textDisabled}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!comment.trim() || addCommentMutation.isPending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendComment}
            disabled={!comment.trim() || addCommentMutation.isPending}
          >
            {addCommentMutation.isPending ? (
              <ActivityIndicator color={colors.textOnDark} size="small" />
            ) : (
              <Ionicons name="send" size={18} color={colors.textOnDark} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  incidentNumber: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    marginLeft: 'auto',
  },
  sectionCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.lg,
  },
  descriptionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 22,
  },
  detailGrid: {
    gap: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textBody,
    flex: 1,
  },
  mediaSection: {
    gap: spacing.md,
  },
  mediaRow: {
    gap: spacing.lg,
  },
  mediaThumb: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
    gap: spacing.xs,
  },
  mediaCaption: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    paddingHorizontal: spacing.xs,
  },
  timelineSection: {
    gap: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    position: 'relative',
    paddingLeft: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  timelineDot: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: 0,
    width: 2,
    backgroundColor: colors.borderMedium,
  },
  timelineContent: {
    flex: 1,
  },
  timelineAction: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  timelineActor: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  timelineNote: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textBody,
    marginTop: spacing.xs,
  },
  timelineTime: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    marginTop: spacing.xs,
  },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.pagePaddingX,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.bottomNavClearance,
    borderTopWidth: 1,
    borderTopColor: colors.borderMedium,
    backgroundColor: colors.surface,
  },
  commentInputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  commentInput: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
});
