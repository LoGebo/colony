import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useIncidentTypes, useCreateIncident } from '@/hooks/useIncidents';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITIES: { key: Severity; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'critical', label: 'Critical' },
];

function getSeverityColors(severity: Severity, active: boolean) {
  if (!active) {
    return { bg: colors.surface, border: colors.border, text: colors.textCaption };
  }
  switch (severity) {
    case 'low':
      return { bg: colors.border, border: colors.borderMedium, text: colors.textBody };
    case 'medium':
      return { bg: colors.warningBg, border: colors.warning, text: colors.warningText };
    case 'high':
      return { bg: colors.orangeBg, border: colors.orange, text: colors.orange };
    case 'critical':
      return { bg: colors.dangerBg, border: colors.danger, text: colors.dangerText };
  }
}

export default function CreateIncidentScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { data: incidentTypes, isLoading: typesLoading } = useIncidentTypes(communityId);
  const createMutation = useCreateIncident();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [locationDescription, setLocationDescription] = useState('');

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !createMutation.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        severity,
        incident_type_id: selectedTypeId ?? undefined,
        location_description: locationDescription.trim() || undefined,
      });

      if (Platform.OS === 'web') {
        window.alert('Your incident report has been submitted.');
        router.back();
      } else {
        Alert.alert('Incident Reported', 'Your incident report has been submitted.', [
          { text: 'OK', onPress: () => router.back() },
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

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Incident</Text>
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
          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Brief description of the incident"
                placeholderTextColor={colors.textDisabled}
                maxLength={120}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="Provide detailed information about the incident..."
                placeholderTextColor={colors.textDisabled}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
            </View>
          </View>

          {/* Severity */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>SEVERITY</Text>
            <View style={styles.severityRow}>
              {SEVERITIES.map((s) => {
                const active = severity === s.key;
                const sColors = getSeverityColors(s.key, active);
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[
                      styles.severityPill,
                      { backgroundColor: sColors.bg, borderColor: sColors.border },
                      active && { borderWidth: 2 },
                    ]}
                    onPress={() => setSeverity(s.key)}
                  >
                    <Text style={[styles.severityText, { color: sColors.text }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Incident Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>INCIDENT TYPE (OPTIONAL)</Text>
            {typesLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.typeLoader} />
            ) : (
              <View style={styles.typeGrid}>
                {(incidentTypes ?? []).map((type) => {
                  const active = selectedTypeId === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeCard, active && styles.typeCardActive]}
                      onPress={() => setSelectedTypeId(active ? null : type.id)}
                    >
                      <Text
                        style={[styles.typeName, active && styles.typeNameActive]}
                        numberOfLines={1}
                      >
                        {type.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>LOCATION (OPTIONAL)</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="location-outline"
                size={20}
                color={colors.textCaption}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={locationDescription}
                onChangeText={setLocationDescription}
                placeholder="e.g. Gate 3, Parking lot B"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Submit */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={colors.textOnDark} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
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
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.bottomNavClearance + 16,
  },
  fieldGroup: {
    marginBottom: spacing['3xl'],
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: spacing.inputHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
  },
  inputIcon: {
    marginRight: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textAreaContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    padding: spacing.xl,
    minHeight: 128,
  },
  textArea: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  severityPill: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  severityText: {
    fontFamily: fonts.black,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  typeLoader: {
    paddingVertical: spacing['3xl'],
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  typeCard: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeCardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeName: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBody,
  },
  typeNameActive: {
    color: colors.primary,
  },
  actionsRow: {
    marginTop: spacing.lg,
  },
  submitButton: {
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
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
});
