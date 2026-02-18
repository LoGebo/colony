import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCreateConversation } from '@/hooks/useChat';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius } from '@/theme';

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#DC2626',
  '#D97706', '#0891B2', '#4F46E5', '#BE185D',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ContactItem {
  user_id: string;
  first_name: string;
  paternal_surname: string;
  photo_url: string | null;
  type: 'resident' | 'guard';
}

export default function GuardNewConversationScreen() {
  const router = useRouter();
  const { communityId, user } = useAuth();
  const createConversation = useCreateConversation();
  const [search, setSearch] = useState('');

  const { data: contacts, isLoading } = useQuery({
    queryKey: [...queryKeys.residents.list(communityId!).queryKey, 'guard-chat-contacts'],
    queryFn: async () => {
      const [residentsRes, guardsRes] = await Promise.all([
        supabase
          .from('residents')
          .select('user_id, first_name, paternal_surname, photo_url')
          .eq('community_id', communityId!)
          .not('user_id', 'is', null),
        supabase
          .from('guards')
          .select('user_id, first_name, paternal_surname, photo_url')
          .eq('community_id', communityId!)
          .not('user_id', 'is', null)
          .neq('user_id', user!.id),
      ]);

      const residents: ContactItem[] = (residentsRes.data ?? []).map((r) => ({
        user_id: r.user_id!,
        first_name: r.first_name,
        paternal_surname: r.paternal_surname,
        photo_url: r.photo_url,
        type: 'resident' as const,
      }));

      const guards: ContactItem[] = (guardsRes.data ?? []).map((g) => ({
        user_id: g.user_id!,
        first_name: g.first_name,
        paternal_surname: g.paternal_surname,
        photo_url: g.photo_url,
        type: 'guard' as const,
      }));

      return [...guards, ...residents];
    },
    enabled: !!communityId && !!user?.id,
  });

  const filtered = useMemo(() => {
    const list = contacts ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) => c.first_name.toLowerCase().includes(q) || c.paternal_surname.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const handleSelect = useCallback(
    async (contact: ContactItem) => {
      try {
        const conversationId = await createConversation.mutateAsync(contact.user_id);
        router.replace(`/(guard)/messages/${conversationId}`);
      } catch (err) {
        console.error('Failed to create conversation:', err);
      }
    },
    [createConversation, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ContactItem }) => {
      const name = `${item.first_name} ${item.paternal_surname}`;
      return (
        <TouchableOpacity style={styles.contactRow} onPress={() => handleSelect(item)} activeOpacity={0.7}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(name) }]}>
              <Text style={styles.avatarInitials}>{item.first_name[0]}{item.paternal_surname[0]}</Text>
            </View>
          )}
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{name}</Text>
            <Text style={styles.contactType}>{item.type === 'guard' ? 'Guard' : 'Resident'}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelect]
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textCaption} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people..."
          placeholderTextColor={colors.textCaption}
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
      </View>
      {isLoading ? (
        <View style={styles.centerMessage}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered} renderItem={renderItem}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.centerMessage}><Text style={styles.emptyText}>No contacts found</Text></View>}
        />
      )}
      {createConversation.isPending && (
        <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={colors.primary} /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: spacing.safeAreaTop, paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl, gap: spacing.lg,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fonts.black, fontSize: 20, color: colors.textPrimary, letterSpacing: -0.5 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.pagePaddingX, marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl, height: 44,
    backgroundColor: colors.glass, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.borderMedium, gap: spacing.md,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary },
  listContent: { paddingBottom: spacing.bottomNavClearance + 20, flexGrow: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.pagePaddingX, gap: spacing.lg },
  avatar: { width: 44, height: 44, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: fonts.bold, fontSize: 15, color: colors.textOnDark },
  contactInfo: { flex: 1, gap: 2 },
  contactName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  contactType: { fontFamily: fonts.medium, fontSize: 12, color: colors.textCaption, textTransform: 'uppercase', letterSpacing: 0.5 },
  centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
});
