import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAnnouncementFeed, type AnnouncementFeedItem } from '@/hooks/useAnnouncements';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRelative } from '@/lib/dates';

function AnnouncementCard({
  item,
  onPress,
}: {
  item: AnnouncementFeedItem;
  onPress: () => void;
}) {
  const announcement = item.announcements;
  const isUnread = !item.read_at;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm flex-row active:opacity-80"
    >
      {/* Unread indicator */}
      {isUnread && (
        <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 mr-3 flex-shrink-0" />
      )}
      {!isUnread && <View className="w-2.5 mr-3 flex-shrink-0" />}

      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className={`text-base flex-1 mr-2 ${
              isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
            }`}
            numberOfLines={1}
          >
            {announcement.title}
          </Text>
          {announcement.is_urgent && (
            <View className="bg-red-100 rounded-full px-2 py-0.5">
              <Text className="text-red-700 text-xs font-medium">URGENTE</Text>
            </View>
          )}
        </View>

        <Text className="text-sm text-gray-500 mb-2" numberOfLines={2}>
          {announcement.body}
        </Text>

        <Text className="text-xs text-gray-400">
          {announcement.created_at ? formatRelative(announcement.created_at) : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export default function AnnouncementsFeedScreen() {
  const router = useRouter();
  const { data: feed, isLoading, isRefetching, refetch } = useAnnouncementFeed();

  if (isLoading) {
    return <LoadingSpinner message="Cargando avisos..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900 mb-4">Avisos</Text>
      </View>

      {/* Feed */}
      <FlatList
        data={feed ?? []}
        keyExtractor={(item) => item.announcement_id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <AnnouncementCard
            item={item}
            onPress={() =>
              router.push(`/(resident)/announcements/${item.announcement_id}`)
            }
          />
        )}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState message="No hay avisos" icon="📢" />
        }
      />
    </View>
  );
}
