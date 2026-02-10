import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDocumentDetail, useSignDocument } from '@/hooks/useDocuments';
import { formatDate, formatDateTime } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';
import { supabase } from '@/lib/supabase';

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal',
  assembly: 'Assembly',
  financial: 'Financial',
  operational: 'Operational',
  communication: 'Communication',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Active', bg: colors.successBg, color: colors.successText },
  inactive: { label: 'Inactive', bg: colors.border, color: colors.textCaption },
  pending: { label: 'Pending', bg: colors.warningBg, color: colors.warningText },
  archived: { label: 'Archived', bg: colors.border, color: colors.textCaption },
  suspended: { label: 'Suspended', bg: colors.dangerBg, color: colors.dangerText },
};

export default function DocumentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: document, isLoading } = useDocumentDetail(id!);
  const signMutation = useSignDocument();
  const [consentText] = useState(
    'I have read and agree to the terms described in this document.'
  );

  const handleSign = () => {
    if (!document || !document.latestVersion) return;

    const doSign = () => {
      signMutation.mutate({
        document_id: document.id,
        document_version_id: document.latestVersion!.id,
        consent_text: consentText,
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm(consentText)) doSign();
    } else {
      Alert.alert('Sign Document', consentText, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign', onPress: doSign },
      ]);
    }
  };

  const handleDownload = async () => {
    if (!document?.latestVersion) return;
    const { storage_bucket, storage_path } = document.latestVersion;

    const { data } = await supabase.storage
      .from(storage_bucket)
      .createSignedUrl(storage_path, 600);

    if (data?.signedUrl) {
      Linking.openURL(data.signedUrl);
    } else {
      Alert.alert('Error', 'Could not generate download link.');
    }
  };

  if (isLoading || !document) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[document.status] ?? STATUS_CONFIG.published;
  const categoryLabel = CATEGORY_LABELS[document.category] ?? document.category;
  const isSigned = !!document.signature;
  const needsSignature = document.requires_signature && !isSigned;

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {document.name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{categoryLabel}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
          {document.requires_signature && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isSigned ? colors.successBg : colors.warningBg,
                },
              ]}
            >
              <Ionicons
                name={isSigned ? 'checkmark-circle' : 'time-outline'}
                size={12}
                color={isSigned ? colors.successText : colors.warningText}
              />
              <Text
                style={[
                  styles.badgeText,
                  { color: isSigned ? colors.successText : colors.warningText },
                ]}
              >
                {isSigned ? 'Signed' : 'Signature Required'}
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        {document.description ? (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{document.description}</Text>
          </View>
        ) : null}

        {/* Version Info */}
        {document.latestVersion && (
          <GlassCard style={styles.versionCard}>
            <View style={styles.versionHeader}>
              <Ionicons name="document-outline" size={18} color={colors.textMuted} />
              <Text style={styles.versionTitle}>Latest Version</Text>
            </View>

            <View style={styles.versionDetails}>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Version</Text>
                <Text style={styles.versionValue}>v{document.latestVersion.version_number}</Text>
              </View>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>File</Text>
                <Text style={styles.versionValue} numberOfLines={1}>
                  {document.latestVersion.file_name}
                </Text>
              </View>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Size</Text>
                <Text style={styles.versionValue}>
                  {formatFileSize(document.latestVersion.file_size_bytes)}
                </Text>
              </View>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Uploaded</Text>
                <Text style={styles.versionValue}>
                  {formatDate(document.latestVersion.created_at)}
                </Text>
              </View>
            </View>

            {document.latestVersion.change_summary ? (
              <View style={styles.changeSummary}>
                <Text style={styles.changeSummaryLabel}>Change Summary</Text>
                <Text style={styles.changeSummaryText}>
                  {document.latestVersion.change_summary}
                </Text>
              </View>
            ) : null}
          </GlassCard>
        )}

        {/* Created Date */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textCaption} />
          <Text style={styles.metaText}>Created {formatDate(document.created_at)}</Text>
          {document.signature_deadline && (
            <>
              <Text style={styles.metaDot}>{'\u00B7'}</Text>
              <Ionicons name="time-outline" size={14} color={colors.warningText} />
              <Text style={[styles.metaText, { color: colors.warningText }]}>
                Due {formatDate(document.signature_deadline)}
              </Text>
            </>
          )}
        </View>

        {/* Signature Section */}
        {isSigned && document.signature && (
          <View style={styles.signedCard}>
            <View style={styles.signedIconWrap}>
              <Ionicons name="checkmark-circle" size={32} color={colors.successText} />
            </View>
            <Text style={styles.signedTitle}>Document Signed</Text>
            <Text style={styles.signedDate}>
              Signed on {formatDateTime(document.signature.signed_at)}
            </Text>
            {document.signature.consent_text && (
              <Text style={styles.signedConsent}>
                &quot;{document.signature.consent_text}&quot;
              </Text>
            )}
          </View>
        )}

        {needsSignature && (
          <View style={styles.signSection}>
            <View style={styles.signCard}>
              <View style={styles.signIconWrap}>
                <Ionicons name="create-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.signTitle}>Signature Required</Text>
              <Text style={styles.signConsent}>{consentText}</Text>
              <TouchableOpacity
                style={styles.signButton}
                onPress={handleSign}
                disabled={signMutation.isPending}
              >
                <Ionicons name="create" size={20} color={colors.textOnDark} />
                <Text style={styles.signButtonText}>
                  {signMutation.isPending ? 'Signing...' : 'Sign Document'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Download / View Button */}
        {document.latestVersion && (
          <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
            <Ionicons name="download-outline" size={20} color={colors.primary} />
            <Text style={styles.downloadButtonText}>Download / View File</Text>
          </TouchableOpacity>
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
  // Scroll
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
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing['3xl'],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Description
  descriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    marginBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  descriptionText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textBody,
    lineHeight: 26,
  },
  // Version
  versionCard: {
    padding: spacing.cardPadding,
    borderRadius: borderRadius['2xl'],
    marginBottom: spacing['3xl'],
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  versionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  versionDetails: {
    gap: spacing.lg,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
  },
  versionValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  changeSummary: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  changeSummaryLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  changeSummaryText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 22,
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
  // Signed
  signedCard: {
    backgroundColor: colors.successBg,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    marginBottom: spacing['3xl'],
  },
  signedIconWrap: {
    marginBottom: spacing.lg,
  },
  signedTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.successText,
    marginBottom: spacing.xs,
  },
  signedDate: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.successText,
    marginBottom: spacing.md,
  },
  signedConsent: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Sign
  signSection: {
    marginBottom: spacing['3xl'],
  },
  signCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
  },
  signIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  signTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  signConsent: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textBody,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['3xl'],
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%',
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
  },
  signButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  // Download
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    marginBottom: spacing['3xl'],
  },
  downloadButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },
});
