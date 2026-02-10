import { useState, useCallback } from 'react';
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
import { useMyDocuments, usePendingSignatures } from '@/hooks/useDocuments';
import { formatDate } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const CATEGORIES = ['All', 'legal', 'assembly', 'financial', 'operational', 'communication'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  All: 'All Files',
  legal: 'Legal',
  assembly: 'Assembly',
  financial: 'Financial',
  operational: 'Operational',
  communication: 'Communication',
};

const CATEGORY_ICON_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  legal: { icon: 'shield-checkmark-outline', bg: colors.primaryLightAlt, color: colors.primary },
  assembly: { icon: 'people-outline', bg: colors.warningBg, color: colors.warningText },
  financial: { icon: 'stats-chart-outline', bg: colors.tealLight, color: colors.tealDark },
  operational: { icon: 'construct-outline', bg: '#FCE7F3', color: '#DB2777' },
  communication: { icon: 'megaphone-outline', bg: '#E0E7FF', color: colors.indigo },
};

const DEFAULT_ICON_CONFIG = { icon: 'document-outline' as keyof typeof Ionicons.glyphMap, bg: colors.border, color: colors.textMuted };

export default function DocumentsIndexScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const { data: documents, isLoading, refetch } = useMyDocuments();
  const { data: pendingSignatures } = usePendingSignatures();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const filtered = (documents ?? []).filter((doc) => {
    if (selectedCategory === 'All') return true;
    return doc.category === selectedCategory;
  });

  const pendingCount = (pendingSignatures ?? []).length;

  const getIconConfig = (category: string) => {
    return CATEGORY_ICON_CONFIG[category] ?? DEFAULT_ICON_CONFIG;
  };

  const getSignatureStatus = (doc: { requires_signature: boolean }) => {
    if (!doc.requires_signature) {
      return { label: 'No Signature', bg: colors.border, color: colors.textCaption, icon: 'remove-circle-outline' as keyof typeof Ionicons.glyphMap };
    }
    return { label: 'Signature Req.', bg: colors.warningBg, color: colors.warningText, icon: 'time-outline' as keyof typeof Ionicons.glyphMap };
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Documents</Text>
            <Text style={styles.headerSubtitle}>Manage contracts and regulations</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Pending Signatures Banner */}
        {pendingCount > 0 && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingBannerOrb} />
            <View style={styles.pendingBannerHeader}>
              <View style={styles.pendingBannerIconWrap}>
                <Ionicons name="create-outline" size={24} color={colors.textOnDark} />
              </View>
              <View style={styles.pendingBannerTextWrap}>
                <Text style={styles.pendingBannerLabel}>Pending Action</Text>
                <Text style={styles.pendingBannerTitle}>
                  {pendingCount} Signature{pendingCount !== 1 ? 's' : ''} Required
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pendingBannerButton}
              onPress={() => {
                const first = (pendingSignatures ?? [])[0];
                if (first) router.push(`/(resident)/more/documents/${first.document_id}`);
              }}
            >
              <Text style={styles.pendingBannerButtonText}>Review & Sign Now</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.indigo} />
            </TouchableOpacity>
          </View>
        )}

        {/* Category Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterPill, selectedCategory === cat && styles.filterPillActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCategory === cat && styles.filterPillTextActive,
                ]}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Document List */}
        {isLoading ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerMessage}>
            <Ionicons name="document-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No documents found</Text>
            <Text style={styles.emptySubtitle}>
              Documents shared by your community will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.documentsList}>
            {filtered.map((doc) => {
              const iconCfg = getIconConfig(doc.category);
              const sigStatus = getSignatureStatus(doc);

              return (
                <TouchableOpacity
                  key={doc.document_id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(resident)/more/documents/${doc.document_id}`)}
                >
                  <GlassCard style={styles.docCard}>
                    <View style={styles.docCardContent}>
                      <View style={[styles.docIcon, { backgroundColor: iconCfg.bg }]}>
                        <Ionicons name={iconCfg.icon as any} size={24} color={iconCfg.color} />
                      </View>
                      <View style={styles.docInfo}>
                        <View style={styles.docNameRow}>
                          <Text style={styles.docName} numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <View style={[styles.sigBadge, { backgroundColor: sigStatus.bg }]}>
                            <Text style={[styles.sigBadgeText, { color: sigStatus.color }]}>
                              {sigStatus.label}
                            </Text>
                          </View>
                        </View>
                        {doc.description ? (
                          <Text style={styles.docDescription} numberOfLines={1}>
                            {doc.description}
                          </Text>
                        ) : null}
                        <Text style={styles.docMeta}>
                          {doc.access_source === 'public' ? 'Public' : 'Shared'}
                        </Text>
                      </View>
                      <View style={styles.docChevron}>
                        <Ionicons name="chevron-forward" size={20} color={colors.textCaption} />
                      </View>
                    </View>
                  </GlassCard>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: fonts.bold,
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
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  // Pending Banner
  pendingBanner: {
    padding: spacing.cardPadding,
    backgroundColor: colors.indigo,
    borderRadius: borderRadius['3xl'],
    marginBottom: spacing['3xl'],
    overflow: 'hidden',
    position: 'relative',
  },
  pendingBannerOrb: {
    position: 'absolute',
    right: -24,
    top: -24,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pendingBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  pendingBannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBannerTextWrap: {
    flex: 1,
  },
  pendingBannerLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: 'rgba(199,210,254,1)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  pendingBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
    marginTop: 2,
  },
  pendingBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  pendingBannerButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.indigo,
  },
  // Filter
  filterScroll: {
    marginBottom: spacing['3xl'],
  },
  filterContent: {
    gap: spacing.md,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: spacing.cardPadding,
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
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: colors.textOnDark,
  },
  // Center / Empty
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
  // Document List
  documentsList: {
    gap: spacing.xl,
  },
  docCard: {
    padding: spacing.xl,
    borderRadius: borderRadius['3xl'],
  },
  docCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docInfo: {
    flex: 1,
  },
  docNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: 2,
  },
  docName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  sigBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  sigBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  docDescription: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  docMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  docChevron: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
