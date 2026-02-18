import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCreateGroupConversation } from '@/hooks/useChat';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { showAlert } from '@/lib/alert';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

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
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const { communityId, user } = useAuth();
  const createGroup = useCreateGroupConversation();
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Map<string, ContactItem>>(new Map());

  const { data: contacts, isLoading } = useQuery({
    queryKey: [...queryKeys.residents.list(communityId!).queryKey, 'group-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('user_id, first_name, paternal_surname, photo_url')
        .eq('community_id', communityId!)
        .not('user_id', 'is', null)
        .neq('user_id', user!.id)
        .order('first_name');

      if (error) throw error;
      return (data ?? []) as ContactItem[];
    },
    enabled: !!communityId && !!user?.id,
  });

  const filtered = useMemo(() => {
    const list = contacts ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.first_name.toLowerCase().includes(q) ||
        c.paternal_surname.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const toggleMember = useCallback((contact: ContactItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(contact.user_id)) {
        next.delete(contact.user_id);
      } else {
        next.set(contact.user_id, contact);
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!groupName.trim()) {
      showAlert('Group Name Required', 'Please enter a name for the group.');
      return;
    }
    if (selected.size < 1) {
      showAlert('Members Required', 'Please select at least one member.');
      return;
    }

    try {
      const conversationId = await createGroup.mutateAsync({
        name: groupName.trim(),
        memberUserIds: Array.from(selected.keys()),
      });
      router.replace(`/(resident)/messages/${conversationId}`);
    } catch (err) {
      showAlert('Error', 'Failed to create group. Please try again.');
    }
  }, [groupName, selected, createGroup, router]);

  const renderItem = useCallback(
    ({ item }: { item: ContactItem }) => {
      const name = `${item.first_name} ${item.paternal_surname}`;
      const isSelected = selected.has(item.user_id);

      return (
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => toggleMember(item)}
          activeOpacity={0.7}
        >
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: getAvatarColor(name) },
              ]}
            >
              <Text style={styles.avatarInitials}>
                {item.first_name[0]}
                {item.paternal_surname[0]}
              </Text>
            </View>
          )}
          <Text style={styles.contactName}>{name}</Text>
          <View
            style={[styles.checkbox, isSelected && styles.checkboxSelected]}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={16} color={colors.textOnDark} />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [selected, toggleMember]
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity
          style={[
            styles.createButton,
            (!groupName.trim() || selected.size < 1) && styles.createButtonDisabled,
          ]}
          onPress={handleCreate}
          disabled={createGroup.isPending}
        >
          {createGroup.isPending ? (
            <ActivityIndicator size="small" color={colors.textOnDark} />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Group Name Input */}
      <View style={styles.groupNameContainer}>
        <View style={styles.groupIcon}>
          <Ionicons name="people" size={20} color={colors.primary} />
        </View>
        <TextInput
          style={styles.groupNameInput}
          placeholder="Group name"
          placeholderTextColor={colors.textCaption}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
      </View>

      {/* Selected members */}
      {selected.size > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.selectedContainer}
          contentContainerStyle={styles.selectedContent}
        >
          {Array.from(selected.values()).map((c) => {
            const name = `${c.first_name} ${c.paternal_surname}`;
            return (
              <TouchableOpacity
                key={c.user_id}
                style={styles.selectedChip}
                onPress={() => toggleMember(c)}
              >
                <Text style={styles.selectedChipText} numberOfLines={1}>
                  {c.first_name}
                </Text>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textCaption} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people..."
          placeholderTextColor={colors.textCaption}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  createButton: {
    paddingHorizontal: 20,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.pagePaddingX,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    gap: spacing.lg,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNameInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  selectedContainer: {
    maxHeight: 48,
    marginBottom: spacing.lg,
  },
  selectedContent: {
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.md,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
  },
  selectedChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
    maxWidth: 80,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.pagePaddingX,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    height: 44,
    backgroundColor: colors.glass,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  listContent: {
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  contactName: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
