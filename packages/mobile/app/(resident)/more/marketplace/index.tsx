import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMarketplaceListings, useMyListings } from '@/hooks/useMarketplace';
import { formatCurrency, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 16;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.pagePaddingX * 2 - CARD_GAP) / 2;

type Tab = 'browse' | 'my';

const CATEGORIES = [
  { key: null, label: 'All Items' },
  { key: 'sale', label: 'For Sale' },
  { key: 'service', label: 'Services' },
  { key: 'rental', label: 'Rentals' },
  { key: 'wanted', label: 'Wanted' },
] as const;

const CATEGORY_BADGE_CONFIG: Record<string, { bg: string; color: string }> = {
  sale: { bg: 'rgba(255,255,255,0.9)', color: colors.textPrimary },
  service: { bg: 'rgba(99,102,241,0.9)', color: colors.textOnDark },
  rental: { bg: 'rgba(245,158,11,0.9)', color: colors.textOnDark },
  wanted: { bg: 'rgba(239,68,68,0.9)', color: colors.textOnDark },
};

const MODERATION_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: colors.warningBg, color: colors.warningText },
  in_review: { label: 'In Review', bg: colors.warningBg, color: colors.warningText },
  approved: { label: 'Active', bg: colors.successBg, color: colors.successText },
  rejected: { label: 'Rejected', bg: colors.dangerBg, color: colors.dangerText },
  flagged: { label: 'Flagged', bg: colors.dangerBg, color: colors.dangerText },
};

export default function MarketplaceIndexScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: listings, isLoading: browsing, refetch: refetchBrowse } = useMarketplaceListings(selectedCategory);
  const { data: myListings, isLoading: loadingMine, refetch: refetchMine } = useMyListings();

  const onRefresh = useCallback(() => {
    if (activeTab === 'browse') {
      refetchBrowse();
    } else {
      refetchMine();
    }
  }, [activeTab, refetchBrowse, refetchMine]);

  const isLoading = activeTab === 'browse' ? browsing : loadingMine;
  const items = activeTab === 'browse' ? (listings ?? []) : (myListings ?? []);

  const getSeller = (item: any): { name: string; photo_url: string | null } => {
    const resident = Array.isArray(item.residents) ? item.residents[0] : item.residents;
    if (!resident) return { name: 'Unknown', photo_url: null };
    return {
      name: `${resident.first_name} ${resident.paternal_surname ?? ''}`.trim(),
      photo_url: resident.photo_url,
    };
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
            <Text style={styles.headerTitle}>Marketplace</Text>
            <Text style={styles.headerSubtitle}>Buy and sell with neighbors</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(resident)/more/marketplace/create')}
        >
          <Ionicons name="add" size={24} color={colors.textOnDark} />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
            onPress={() => setActiveTab('browse')}
          >
            <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
              Browse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
              My Listings
            </Text>
          </TouchableOpacity>
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
        {/* Category Filters - only in browse mode */}
        {activeTab === 'browse' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key ?? 'all'}
                style={[
                  styles.categoryPill,
                  selectedCategory === cat.key && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selectedCategory === cat.key && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Content */}
        {isLoading ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerMessage}>
            <Ionicons name="pricetag-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'browse' ? 'No listings found' : 'No listings yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'browse'
                ? 'Be the first to post something!'
                : 'Tap the + button to create your first listing.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item: any) => {
              const seller = getSeller(item);
              const isSold = item.is_sold;
              const imageUrl = item.image_urls?.[0];
              const catBadge = CATEGORY_BADGE_CONFIG[item.category] ?? CATEGORY_BADGE_CONFIG.sale;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/(resident)/more/marketplace/${item.id}`)}
                >
                  {/* Image */}
                  <View style={[styles.imageContainer, isSold && styles.imageSold]}>
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="image-outline" size={32} color={colors.textDisabled} />
                      </View>
                    )}
                    {/* Category Badge */}
                    <View style={[styles.catBadge, { backgroundColor: catBadge.bg }]}>
                      <Text style={[styles.catBadgeText, { color: catBadge.color }]}>
                        {item.category}
                      </Text>
                    </View>
                    {isSold && (
                      <View style={styles.soldOverlay}>
                        <View style={styles.soldBadge}>
                          <Text style={styles.soldBadgeText}>Sold</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, isSold && styles.cardTitleSold]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.cardPrice, isSold && styles.cardPriceSold]}>
                        {item.price ? formatCurrency(item.price) : 'Free'}
                      </Text>
                      {item.price_negotiable && !isSold && (
                        <View style={styles.negotiableBadge}>
                          <Text style={styles.negotiableBadgeText}>Neg.</Text>
                        </View>
                      )}
                    </View>

                    {/* Seller + View Count */}
                    <View style={styles.cardFooter}>
                      <View style={styles.sellerInfo}>
                        <View style={styles.sellerAvatar}>
                          {seller.photo_url ? (
                            <Image
                              source={{ uri: seller.photo_url }}
                              style={styles.sellerAvatarImg}
                            />
                          ) : (
                            <Ionicons name="person" size={8} color={colors.textCaption} />
                          )}
                        </View>
                        <Text style={styles.sellerName} numberOfLines={1}>
                          {seller.name}
                        </Text>
                      </View>
                      {activeTab === 'browse' && (
                        <View style={styles.viewCount}>
                          <Ionicons name="eye-outline" size={12} color={colors.textCaption} />
                          <Text style={styles.viewCountText}>{item.view_count ?? 0}</Text>
                        </View>
                      )}
                    </View>

                    {/* Status badge for my listings */}
                    {activeTab === 'my' && (
                      <View style={styles.myStatusRow}>
                        {isSold ? (
                          <View style={[styles.myStatusBadge, { backgroundColor: colors.border }]}>
                            <Text style={[styles.myStatusText, { color: colors.textCaption }]}>Sold</Text>
                          </View>
                        ) : (
                          (() => {
                            const mod = MODERATION_CONFIG[item.moderation_status] ?? MODERATION_CONFIG.pending;
                            return (
                              <View style={[styles.myStatusBadge, { backgroundColor: mod.bg }]}>
                                <Text style={[styles.myStatusText, { color: mod.color }]}>{mod.label}</Text>
                              </View>
                            );
                          })()
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(resident)/more/marketplace/create')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={24} color={colors.textOnDark} />
      </TouchableOpacity>
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
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  // Tabs
  tabContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['2xl'],
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(226,232,240,0.5)',
    borderRadius: borderRadius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  tabText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 40,
  },
  // Category
  categoryScroll: {
    marginBottom: spacing['3xl'],
  },
  categoryContent: {
    gap: spacing.md,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  categoryPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBody,
  },
  categoryPillTextActive: {
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
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  imageContainer: {
    aspectRatio: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginBottom: spacing.md,
    position: 'relative',
  },
  imageSold: {
    opacity: 0.6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  catBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  catBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  soldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
  },
  soldBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: colors.textPrimary,
  },
  // Card Body
  cardBody: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  cardTitleSold: {
    color: colors.textCaption,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardPrice: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  cardPriceSold: {
    color: colors.textCaption,
  },
  negotiableBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.tealLight,
    borderRadius: borderRadius.sm,
  },
  negotiableBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.tealDark,
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sellerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarImg: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  sellerName: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    flex: 1,
  },
  viewCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewCountText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
  },
  // My Listings status
  myStatusRow: {
    marginTop: spacing.md,
  },
  myStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  myStatusText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance + 12,
    right: spacing.pagePaddingX,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
});
