import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConversations, useChatPresence } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius } from '@/theme';
import type { ConversationListItem } from '@/hooks/useChat';

export default function GuardMessagesIndexScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { data: conversations, isLoading, refetch } = useConversations();
  const { onlineUsers } = useChatPresence(communityId);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = conversations ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => {
      const name =
        c.conversation_type === 'direct'
          ? c.other_participant_name
          : c.name;
      return (
        name?.toLowerCase().includes(q) ||
        c.last_message_preview?.toLowerCase().includes(q)
      );
    });
  }, [conversations, search]);

  const handleConversationPress = useCallback(
    (conversationId: string) => {
      router.push(`/(guard)/messages/${conversationId}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationListItem }) => (
      <ConversationRow
        conversation={item}
        onPress={() => handleConversationPress(item.conversation_id)}
        isOnline={
          item.conversation_type === 'direct' && item.other_participant_user_id
            ? onlineUsers.has(item.other_participant_user_id)
            : false
        }
      />
    ),
    [handleConversationPress, onlineUsers]
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Guard Communications</Text>
        </View>
        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => router.push('/(guard)/messages/new')}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textCaption} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textCaption}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textCaption} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.conversation_id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centerMessage}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.centerMessage}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a conversation with a resident or fellow guard.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={Separator}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
  },
  headerTitle: { fontFamily: fonts.black, fontSize: 24, color: colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textCaption, textTransform: 'uppercase', letterSpacing: 1.5 },
  composeButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.15)',
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.pagePaddingX, marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl, height: 44,
    backgroundColor: colors.glass, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.borderMedium, gap: spacing.md,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.bottomNavClearance + 20, flexGrow: 1 },
  separator: {
    height: 1, backgroundColor: colors.border,
    marginLeft: spacing.pagePaddingX + 48 + spacing.lg, marginRight: spacing.pagePaddingX,
  },
  centerMessage: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.lg },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textSecondary },
  emptySubtitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
