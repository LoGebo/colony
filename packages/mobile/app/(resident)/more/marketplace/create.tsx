import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCreateListing } from '@/hooks/useMarketplace';
import { useAuth } from '@/hooks/useAuth';
import { pickAndUploadImage } from '@/lib/upload';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const CATEGORIES = [
  { value: 'sale', label: 'For Sale', icon: 'pricetag-outline' as const, color: colors.primary },
  { value: 'service', label: 'Services', icon: 'construct-outline' as const, color: colors.indigo },
  { value: 'rental', label: 'Rentals', icon: 'key-outline' as const, color: colors.warning },
  { value: 'wanted', label: 'Wanted', icon: 'search-outline' as const, color: colors.teal },
];

export default function CreateListingScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const createListing = useCreateListing();

  const [category, setCategory] = useState('for_sale');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleAddImage = async () => {
    if (imageUrls.length >= 4) {
      Alert.alert('Limit', 'Maximum 4 images allowed.');
      return;
    }
    try {
      setUploading(true);
      const url = await pickAndUploadImage('chat-media', communityId!, 'marketplace');
      if (url) setImageUrls((prev) => [...prev, url]);
    } catch {
      Alert.alert('Error', 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }
    try {
      await createListing.mutateAsync({
        category,
        title: title.trim(),
        description: description.trim(),
        price: price ? parseFloat(price) : null,
        price_negotiable: negotiable,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      });
      Alert.alert('Success', 'Your listing has been submitted for review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create listing.');
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Listing</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category Selector */}
          <Text style={styles.sectionLabel}>CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryCard, active && styles.categoryCardActive]}
                  onPress={() => setCategory(cat.value)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: active ? cat.color : colors.border }]}>
                    <Ionicons name={cat.icon} size={18} color={active ? colors.textOnDark : colors.textCaption} />
                  </View>
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Title */}
          <Text style={styles.sectionLabel}>TITLE</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="What are you selling?"
              placeholderTextColor={colors.textDisabled}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <View style={[styles.inputRow, styles.textAreaRow]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your item..."
              placeholderTextColor={colors.textDisabled}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Price */}
          <Text style={styles.sectionLabel}>PRICE</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00 (leave empty for free)"
              placeholderTextColor={colors.textDisabled}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Negotiable Toggle */}
          <GlassCard style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Price Negotiable</Text>
                <Text style={styles.toggleSubtitle}>Buyers can make offers</Text>
              </View>
              <Switch
                value={negotiable}
                onValueChange={setNegotiable}
                trackColor={{ false: colors.borderMedium, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
          </GlassCard>

          {/* Images */}
          <Text style={styles.sectionLabel}>PHOTOS</Text>
          <View style={styles.imageGrid}>
            {imageUrls.map((url, i) => (
              <View key={i} style={styles.imageThumb}>
                <Image source={{ uri: url }} style={styles.imageThumbImg} />
                <TouchableOpacity
                  style={styles.imageRemove}
                  onPress={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close" size={14} color={colors.textOnDark} />
                </TouchableOpacity>
              </View>
            ))}
            {imageUrls.length < 4 && (
              <TouchableOpacity style={styles.imageAddButton} onPress={handleAddImage} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color={colors.textCaption} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color={colors.textCaption} />
                    <Text style={styles.imageAddText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={createListing.isPending}
            activeOpacity={0.9}
          >
            {createListing.isPending ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <Text style={styles.submitButtonText}>Publish Listing</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMedium,
    alignItems: 'center', justifyContent: 'center', ...shadows.sm,
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary },
  spacer: { width: 40 },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['6xl'],
    gap: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fonts.bold, fontSize: 12, color: colors.textCaption,
    textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4,
  },
  categoryGrid: { flexDirection: 'row', gap: spacing.lg },
  categoryCard: {
    flex: 1, alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.xl, backgroundColor: colors.surface,
    borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.borderMedium, ...shadows.sm,
  },
  categoryCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  categoryIcon: {
    width: 40, height: 40, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
  },
  categoryLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.textCaption },
  categoryLabelActive: { color: colors.primary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.borderMedium, paddingHorizontal: spacing.xl, height: spacing.inputHeight,
  },
  textAreaRow: { height: 120, alignItems: 'flex-start', paddingVertical: spacing.xl },
  input: {
    flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, height: '100%',
  },
  textArea: { textAlignVertical: 'top' },
  currencyPrefix: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginRight: spacing.md },
  toggleCard: { padding: spacing.xl, borderRadius: borderRadius.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleInfo: { flex: 1 },
  toggleTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  toggleSubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  imageGrid: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  imageThumb: {
    width: 80, height: 80, borderRadius: borderRadius.lg, overflow: 'hidden',
  },
  imageThumbImg: { width: '100%', height: '100%' },
  imageRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageAddButton: {
    width: 80, height: 80, borderRadius: borderRadius.lg,
    borderWidth: 2, borderColor: colors.borderMedium, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  imageAddText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textCaption },
  submitButton: {
    height: spacing.buttonHeight, backgroundColor: colors.dark,
    borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.xl, ...shadows.xl,
  },
  submitButtonText: { fontFamily: fonts.bold, fontSize: 18, color: colors.textOnDark },
});
