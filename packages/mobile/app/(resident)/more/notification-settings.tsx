import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationPreferences,
} from '@/hooks/useNotificationPreferences';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const TYPE_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  visitor_arrived: { label: 'Visitor Arrivals', description: 'When a visitor checks in', icon: 'person-add-outline' },
  payment_due: { label: 'Payment Due', description: 'Upcoming payment reminders', icon: 'card-outline' },
  payment_received: { label: 'Payment Received', description: 'When payment is confirmed', icon: 'checkmark-circle-outline' },
  ticket_created: { label: 'Ticket Created', description: 'New maintenance tickets', icon: 'construct-outline' },
  ticket_status_changed: { label: 'Ticket Updates', description: 'Status changes on your tickets', icon: 'refresh-outline' },
  announcement: { label: 'Announcements', description: 'Community announcements', icon: 'megaphone-outline' },
  package_arrived: { label: 'Package Arrived', description: 'When a package is received', icon: 'cube-outline' },
  emergency_alert: { label: 'Emergency Alerts', description: 'Critical safety notifications', icon: 'warning-outline' },
  survey_published: { label: 'Surveys', description: 'New surveys and polls', icon: 'clipboard-outline' },
  document_published: { label: 'Documents', description: 'New documents to review', icon: 'document-text-outline' },
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (preferences && !localPrefs) {
      setLocalPrefs(preferences);
    }
  }, [preferences, localPrefs]);

  const toggleType = useCallback((key: string) => {
    if (key === 'emergency_alert') return; // Cannot disable emergency
    setLocalPrefs((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        types: { ...prev.types, [key]: !prev.types[key as keyof typeof prev.types] },
      };
    });
    setDirty(true);
  }, []);

  const togglePush = useCallback(() => {
    setLocalPrefs((prev) => {
      if (!prev) return prev;
      return { ...prev, push_enabled: !prev.push_enabled };
    });
    setDirty(true);
  }, []);

  const toggleQuietHours = useCallback(() => {
    setLocalPrefs((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        quiet_hours: { ...prev.quiet_hours, enabled: !prev.quiet_hours.enabled },
      };
    });
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!localPrefs) return;
    try {
      await updatePrefs.mutateAsync(localPrefs);
      setDirty(false);
      showAlert('Saved', 'Notification preferences updated.');
    } catch (err: any) {
      const msg = err.message ?? 'Failed to save preferences.';
      showAlert('Error', msg);
    }
  };

  if (isLoading || !localPrefs) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Push Toggle */}
        <GlassCard style={styles.masterCard}>
          <View style={styles.masterRow}>
            <View style={styles.masterIconBox}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.masterInfo}>
              <Text style={styles.masterTitle}>Push Notifications</Text>
              <Text style={styles.masterSubtitle}>Receive push notifications on this device</Text>
            </View>
            <Switch
              value={localPrefs.push_enabled}
              onValueChange={togglePush}
              trackColor={{ false: colors.borderMedium, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </GlassCard>

        {/* Notification Types */}
        <Text style={styles.sectionLabel}>NOTIFICATION TYPES</Text>
        <View style={styles.typesCard}>
          {Object.entries(TYPE_LABELS).map(([key, config], index) => {
            const enabled = localPrefs.types[key as keyof typeof localPrefs.types];
            const isEmergency = key === 'emergency_alert';
            const isLast = index === Object.entries(TYPE_LABELS).length - 1;

            return (
              <View key={key}>
                <View style={styles.typeRow}>
                  <View style={styles.typeIconBox}>
                    <Ionicons name={config.icon as any} size={18} color={isEmergency ? colors.danger : colors.textBody} />
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={styles.typeLabel}>{config.label}</Text>
                    <Text style={styles.typeDescription}>{config.description}</Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => toggleType(key)}
                    disabled={isEmergency}
                    trackColor={{ false: colors.borderMedium, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
                {!isLast && <View style={styles.divider} />}
              </View>
            );
          })}
        </View>

        {/* Quiet Hours */}
        <Text style={styles.sectionLabel}>QUIET HOURS</Text>
        <GlassCard style={styles.quietCard}>
          <View style={styles.quietRow}>
            <View style={styles.typeIconBox}>
              <Ionicons name="moon-outline" size={18} color={colors.indigo} />
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.typeLabel}>Do Not Disturb</Text>
              <Text style={styles.typeDescription}>
                {localPrefs.quiet_hours.start} - {localPrefs.quiet_hours.end}
              </Text>
            </View>
            <Switch
              value={localPrefs.quiet_hours.enabled}
              onValueChange={toggleQuietHours}
              trackColor={{ false: colors.borderMedium, true: colors.indigo }}
              thumbColor={colors.surface}
            />
          </View>
        </GlassCard>

        {/* Save Button */}
        {dirty && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={updatePrefs.isPending}
            activeOpacity={0.9}
          >
            {updatePrefs.isPending ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center' },
  header: {
    paddingTop: spacing.safeAreaTop, paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backButton: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMedium,
    alignItems: 'center', justifyContent: 'center', ...shadows.sm,
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary },
  spacer: { width: 40 },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX, paddingTop: spacing['3xl'],
    paddingBottom: spacing['6xl'], gap: spacing['3xl'],
  },
  masterCard: { padding: spacing.xl, borderRadius: borderRadius.xl },
  masterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  masterIconBox: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  masterInfo: { flex: 1 },
  masterTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  masterSubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  sectionLabel: {
    fontFamily: fonts.bold, fontSize: 11, color: colors.textCaption,
    textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4,
  },
  typesCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.borderMedium, padding: spacing.xl, ...shadows.sm,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.lg },
  typeIconBox: {
    width: 36, height: 36, borderRadius: borderRadius.md,
    backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  typeInfo: { flex: 1 },
  typeLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  typeDescription: { fontFamily: fonts.medium, fontSize: 11, color: colors.textCaption },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 56 },
  quietCard: { padding: spacing.xl, borderRadius: borderRadius.xl },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  saveButton: {
    height: spacing.buttonHeight, backgroundColor: colors.dark,
    borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', ...shadows.xl,
  },
  saveButtonText: { fontFamily: fonts.bold, fontSize: 18, color: colors.textOnDark },
});
