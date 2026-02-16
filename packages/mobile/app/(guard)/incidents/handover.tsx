import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  useRecentHandovers,
  useCreateHandover,
  useAcknowledgeHandover,
} from '@/hooks/useHandovers';
import { formatRelative, formatDateTime } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'normal', label: 'Normal' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

function getPriorityStyle(priority: string) {
  switch (priority) {
    case 'urgent':
      return { bg: colors.dangerBg, color: colors.dangerText, label: 'Urgent' };
    case 'high':
      return { bg: colors.orangeBg, color: colors.orange, label: 'High' };
    case 'normal':
      return { bg: colors.primaryLight, color: colors.primary, label: 'Normal' };
    case 'low':
    default:
      return { bg: colors.border, color: colors.textCaption, label: 'Low' };
  }
}

export default function HandoverScreen() {
  const router = useRouter();
  const { communityId, guardId } = useAuth();
  const { data: handovers, isLoading } = useRecentHandovers(communityId);
  const createMutation = useCreateHandover();
  const acknowledgeMutation = useAcknowledgeHandover();

  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [pendingItem, setPendingItem] = useState('');
  const [pendingItems, setPendingItems] = useState<
    Array<{ description: string; completed: boolean }>
  >([]);

  const canSubmit = notes.trim().length > 0 && !createMutation.isPending;

  const handleAddPendingItem = useCallback(() => {
    if (!pendingItem.trim()) return;
    setPendingItems((prev) => [...prev, { description: pendingItem.trim(), completed: false }]);
    setPendingItem('');
  }, [pendingItem]);

  const handleRemovePendingItem = useCallback((index: number) => {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await createMutation.mutateAsync({
        notes: notes.trim(),
        priority,
        pending_items: pendingItems.length > 0 ? pendingItems : undefined,
      });

      if (Platform.OS === 'web') {
        window.alert('Your shift handover notes have been submitted.');
        setShowForm(false);
        setNotes('');
        setPriority('normal');
        setPendingItems([]);
      } else {
        Alert.alert('Handover Created', 'Your shift handover notes have been submitted.', [
          {
            text: 'OK',
            onPress: () => {
              setShowForm(false);
              setNotes('');
              setPriority('normal');
              setPendingItems([]);
            },
          },
        ]);
      }
    } catch (error: any) {
      const msg = error?.message ?? 'Something went wrong. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleAcknowledge = useCallback(
    async (handoverId: string) => {
      try {
        await acknowledgeMutation.mutateAsync(handoverId);
      } catch (error: any) {
        const msg = error?.message ?? 'Failed to acknowledge handover.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Error', msg);
        }
      }
    },
    [acknowledgeMutation],
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shift Handover</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Ionicons
            name={showForm ? 'close' : 'add'}
            size={22}
            color={colors.textOnDark}
          />
        </TouchableOpacity>
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
          {/* Create Form */}
          {showForm && (
            <GlassCard variant="dense" style={styles.formCard}>
              <Text style={styles.formTitle}>New Handover Note</Text>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOTES</Text>
                <View style={styles.textAreaContainer}>
                  <TextInput
                    style={styles.textArea}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Describe shift events, observations, and instructions..."
                    placeholderTextColor={colors.textDisabled}
                    multiline
                    textAlignVertical="top"
                    maxLength={2000}
                  />
                </View>
              </View>

              {/* Priority */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PRIORITY</Text>
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((p) => {
                    const active = priority === p.key;
                    const style = getPriorityStyle(p.key);
                    return (
                      <TouchableOpacity
                        key={p.key}
                        style={[
                          styles.priorityPill,
                          active && {
                            backgroundColor: style.bg,
                            borderColor: style.color,
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => setPriority(p.key)}
                      >
                        <Text
                          style={[
                            styles.priorityText,
                            active && { color: style.color },
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Pending Items */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>PENDING ITEMS</Text>
                {pendingItems.map((item, idx) => (
                  <View key={idx} style={styles.pendingItemRow}>
                    <Ionicons name="ellipse-outline" size={16} color={colors.textCaption} />
                    <Text style={styles.pendingItemText}>{item.description}</Text>
                    <TouchableOpacity onPress={() => handleRemovePendingItem(idx)}>
                      <Ionicons name="close-circle" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addItemRow}>
                  <TextInput
                    style={styles.addItemInput}
                    value={pendingItem}
                    onChangeText={setPendingItem}
                    placeholder="Add pending item..."
                    placeholderTextColor={colors.textDisabled}
                    onSubmitEditing={handleAddPendingItem}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={handleAddPendingItem}
                    disabled={!pendingItem.trim()}
                  >
                    <Ionicons
                      name="add-circle"
                      size={28}
                      color={pendingItem.trim() ? colors.primary : colors.textDisabled}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color={colors.textOnDark} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Handover</Text>
                )}
              </TouchableOpacity>
            </GlassCard>
          )}

          {/* Recent Handovers */}
          <Text style={styles.listSectionLabel}>RECENT HANDOVERS</Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (handovers ?? []).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={40} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No handover notes yet</Text>
            </View>
          ) : (
            (handovers ?? []).map((handover: any) => {
              const pStyle = getPriorityStyle(handover.priority ?? 'normal');
              const guardName =
                handover.guards?.full_name ?? 'Unknown Guard';
              const items = (handover.pending_items ?? []) as Array<{
                description: string;
                completed: boolean;
              }>;
              const isAcknowledged = !!handover.acknowledged_at;
              const isOwnHandover = handover.guard_id === guardId;

              return (
                <GlassCard key={handover.id} style={styles.handoverCard}>
                  <View style={styles.handoverHeader}>
                    <View style={styles.handoverHeaderLeft}>
                      <View style={styles.guardAvatar}>
                        <Ionicons name="person" size={18} color={colors.textOnDark} />
                      </View>
                      <View>
                        <Text style={styles.guardName}>{guardName}</Text>
                        <Text style={styles.handoverTime}>
                          {formatRelative(handover.created_at)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: pStyle.bg }]}>
                      <Text style={[styles.priorityBadgeText, { color: pStyle.color }]}>
                        {pStyle.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.handoverNotes} numberOfLines={4}>
                    {handover.notes}
                  </Text>

                  {items.length > 0 && (
                    <View style={styles.pendingSection}>
                      <Text style={styles.pendingSectionLabel}>
                        {items.length} pending item{items.length !== 1 ? 's' : ''}
                      </Text>
                      {items.slice(0, 3).map((item, idx) => (
                        <View key={idx} style={styles.pendingItemPreview}>
                          <Ionicons
                            name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={item.completed ? colors.success : colors.textCaption}
                          />
                          <Text style={styles.pendingItemPreviewText} numberOfLines={1}>
                            {item.description}
                          </Text>
                        </View>
                      ))}
                      {items.length > 3 && (
                        <Text style={styles.moreItems}>
                          +{items.length - 3} more
                        </Text>
                      )}
                    </View>
                  )}

                  {handover.shift_started_at && (
                    <Text style={styles.shiftTime}>
                      Shift: {formatDateTime(handover.shift_started_at)}
                      {handover.shift_ended_at
                        ? ` - ${formatDateTime(handover.shift_ended_at)}`
                        : ' (ongoing)'}
                    </Text>
                  )}

                  {!isAcknowledged && !isOwnHandover && (
                    <TouchableOpacity
                      style={styles.acknowledgeButton}
                      onPress={() => handleAcknowledge(handover.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      {acknowledgeMutation.isPending ? (
                        <ActivityIndicator color={colors.textOnDark} size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color={colors.textOnDark}
                          />
                          <Text style={styles.acknowledgeButtonText}>Acknowledge</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {isAcknowledged && (
                    <View style={styles.acknowledgedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.successText} />
                      <Text style={styles.acknowledgedText}>Acknowledged</Text>
                    </View>
                  )}
                </GlassCard>
              );
            })
          )}
        </ScrollView>
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
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.md,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.xl,
  },
  formCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
  },
  formTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  fieldGroup: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
    marginBottom: spacing.md,
  },
  textAreaContainer: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    padding: spacing.xl,
    minHeight: 120,
  },
  textArea: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  priorityText: {
    fontFamily: fonts.black,
    fontSize: 10,
    textTransform: 'uppercase',
    color: colors.textCaption,
  },
  pendingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pendingItemText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textBody,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  addItemInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  submitButton: {
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.darkGlow,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  listSectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  loader: {
    paddingVertical: spacing['5xl'],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  handoverCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
  },
  handoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  handoverHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  guardAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  handoverTime: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
  },
  priorityBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  priorityBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  handoverNotes: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textBody,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  pendingSection: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pendingSectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  pendingItemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingItemPreviewText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textBody,
    flex: 1,
  },
  moreItems: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    marginTop: spacing.xs,
  },
  shiftTime: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    marginBottom: spacing.lg,
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    borderRadius: borderRadius.md,
    backgroundColor: colors.dark,
    ...shadows.md,
  },
  acknowledgeButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textOnDark,
    textTransform: 'uppercase',
  },
  acknowledgedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acknowledgedText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.successText,
  },
});
