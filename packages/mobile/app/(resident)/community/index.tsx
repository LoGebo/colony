import { useState } from 'react';
import { View, Text, FlatList, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useChannels, usePosts } from '@/hooks/usePosts';
import { PostCard } from '@/components/posts/PostCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function CommunityFeedScreen() {
  const router = useRouter();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const { data: channels } = useChannels();
  const { data: posts, isLoading, isRefetching, refetch } = usePosts(selectedChannel);

  if (isLoading) {
    return <LoadingSpinner message="Cargando publicaciones..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-4 pb-2 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900 mb-3">Comunidad</Text>

        {/* Channel filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
        >
          <Pressable
            onPress={() => setSelectedChannel(null)}
            className={`rounded-full px-4 py-2 ${
              !selectedChannel
                ? 'bg-blue-600'
                : 'bg-white border border-gray-300'
            }`}
          >
            <Text
              className={
                !selectedChannel ? 'text-white font-medium' : 'text-gray-700'
              }
            >
              Todos
            </Text>
          </Pressable>
          {(channels ?? []).map((ch) => (
            <Pressable
              key={ch.id}
              onPress={() =>
                setSelectedChannel(
                  selectedChannel === ch.id ? null : ch.id
                )
              }
              className={`rounded-full px-4 py-2 ${
                selectedChannel === ch.id
                  ? 'bg-blue-600'
                  : 'bg-white border border-gray-300'
              }`}
            >
              <Text
                className={
                  selectedChannel === ch.id
                    ? 'text-white font-medium'
                    : 'text-gray-700'
                }
              >
                {ch.icon ? `${ch.icon} ` : ''}
                {ch.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Post feed */}
      <FlatList
        data={posts ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => <PostCard post={item as never} />}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
            message="No hay publicaciones en este canal"
            icon="{ }"
          />
        }
      />

      {/* FAB: Create post */}
      <Pressable
        onPress={() => router.push('/(resident)/community/post/create')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg active:opacity-80"
        style={{
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>
    </View>
  );
}
