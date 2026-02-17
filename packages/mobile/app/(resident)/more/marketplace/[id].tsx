import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useListingDetail,
  useMarkAsSold,
  useDeleteListing,
  handleContactSeller,
} from '@/hooks/useMarketplace';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function MarketplaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { residentId } = useAuth();
  const { data: listing, isLoading } = useListingDetail(id!);
  const markAsSoldMutation = useMarkAsSold(id!);
  const deleteMutation = useDeleteListing();
  const [activeImage, setActiveImage] = useState(0);

  if (isLoading || !listing) {
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

  const resident = Array.isArray(listing.residents) ? listing.residents[0] : listing.residents;
  const sellerName = resident
    ? `${resident.first_name} ${resident.paternal_surname ?? ''}`.trim()
    : 'Unknown';
  const isOwner = resident?.id === residentId;
  const images: string[] = listing.image_urls ?? [];

  const handleMarkSold = () => {
    const doMarkSold = () => {
      markAsSoldMutation.mutate(undefined, {
        onSuccess: () => router.back(),
      });
    };

    showAlert('Mark as Sold', 'This will remove the listing from the marketplace.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Sold', onPress: doMarkSold },
    ]);
  };

  const handleDelete = () => {
    const doDelete = () => {
      deleteMutation.mutate(id!, {
        onSuccess: () => router.back(),
      });
    };

    showAlert('Delete Listing', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleContact = () => {
    if (!resident?.phone) {
      showAlert('No Phone', 'The seller has not shared their phone number.');
      return;
    }
    handleContactSeller(resident.phone, listing.title, listing.id);
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listing Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Gallery */}
        <View style={styles.gallery}>
          {images.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - spacing.pagePaddingX * 2)
                  );
                  setActiveImage(idx);
                }}
              >
                {images.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {images.length > 1 && (
                <View style={styles.galleryDots}>
                  {images.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.galleryDot,
                        activeImage === idx && styles.galleryDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.galleryPlaceholder}>
              <Ionicons name="image-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.galleryPlaceholderText}>No photos</Text>
            </View>
          )}
        </View>

        {/* Title + Price */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {listing.price ? formatCurrency(listing.price) : 'Free'}
            </Text>
            {listing.price_negotiable && (
              <View style={styles.negotiableBadge}>
                <Text style={styles.negotiableBadgeText}>Negotiable</Text>
              </View>
            )}
          </View>
          {listing.is_sold && (
            <View style={styles.soldBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.textCaption} />
              <Text style={styles.soldBannerText}>This item has been sold</Text>
            </View>
          )}
        </View>

        {/* Category badge */}
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{listing.category}</Text>
          </View>
        </View>

        {/* Description */}
        {listing.description ? (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{listing.description}</Text>
          </View>
        ) : null}

        {/* Seller Card */}
        <GlassCard style={styles.sellerCard}>
          <View style={styles.sellerRow}>
            <View style={styles.sellerAvatar}>
              {resident?.photo_url ? (
                <Image source={{ uri: resident.photo_url }} style={styles.sellerAvatarImg} />
              ) : (
                <Ionicons name="person" size={20} color={colors.textCaption} />
              )}
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{sellerName}</Text>
              <Text style={styles.sellerLabel}>Seller</Text>
            </View>
            {!isOwner && (
              <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textOnDark} />
                <Text style={styles.contactButtonText}>Contact</Text>
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={16} color={colors.textCaption} />
            <Text style={styles.statValue}>{listing.view_count ?? 0}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="chatbox-outline" size={16} color={colors.textCaption} />
            <Text style={styles.statValue}>{listing.inquiry_count ?? 0}</Text>
            <Text style={styles.statLabel}>Inquiries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.textCaption} />
            <Text style={styles.statValue}>{formatRelative(listing.created_at)}</Text>
            <Text style={styles.statLabel}>Posted</Text>
          </View>
        </View>

        {/* Owner Actions */}
        {isOwner && !listing.is_sold && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.markSoldButton}
              onPress={handleMarkSold}
              disabled={markAsSoldMutation.isPending}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.textOnDark} />
              <Text style={styles.markSoldButtonText}>
                {markAsSoldMutation.isPending ? 'Marking...' : 'Mark as Sold'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contact Button for non-owners */}
        {!isOwner && !listing.is_sold && (
          <TouchableOpacity style={styles.bigContactButton} onPress={handleContact}>
            <Ionicons name="logo-whatsapp" size={20} color={colors.textOnDark} />
            <Text style={styles.bigContactButtonText}>Contact Seller</Text>
          </TouchableOpacity>
        )}

        {/* Posted date */}
        <Text style={styles.postedDate}>
          Posted {formatDate(listing.created_at)}
          {listing.expires_at ? ` \u00B7 Expires ${formatDate(listing.expires_at)}` : ''}
        </Text>
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
  // Gallery
  gallery: {
    height: 280,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginBottom: spacing['3xl'],
  },
  galleryImage: {
    width: SCREEN_WIDTH - spacing.pagePaddingX * 2,
    height: 280,
  },
  galleryPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  galleryPlaceholderText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textDisabled,
  },
  galleryDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  galleryDotActive: {
    backgroundColor: colors.surface,
    width: 18,
  },
  // Title
  titleSection: {
    marginBottom: spacing['2xl'],
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  price: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  negotiableBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.tealLight,
    borderRadius: borderRadius.sm,
  },
  negotiableBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.tealDark,
    textTransform: 'uppercase',
  },
  soldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.border,
    borderRadius: borderRadius.md,
  },
  soldBannerText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textCaption,
  },
  // Category
  categoryRow: {
    flexDirection: 'row',
    marginBottom: spacing['3xl'],
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  categoryBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
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
    fontSize: 15,
    color: colors.textBody,
    lineHeight: 24,
  },
  // Seller
  sellerCard: {
    padding: spacing.cardPadding,
    borderRadius: borderRadius['2xl'],
    marginBottom: spacing['3xl'],
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  sellerLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    height: 40,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.md,
  },
  contactButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textOnDark,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    marginBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
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
  // Owner Actions
  ownerActions: {
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  markSoldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
  },
  markSoldButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.dangerBgLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.dangerBg,
  },
  deleteButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.danger,
  },
  // Big Contact
  bigContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.buttonHeight,
    backgroundColor: colors.tealDark,
    borderRadius: borderRadius.lg,
    marginBottom: spacing['3xl'],
  },
  bigContactButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  // Posted date
  postedDate: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
});
