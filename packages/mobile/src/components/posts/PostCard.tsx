import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReactionBar } from './ReactionBar';

interface PostAuthor {
  id: string;
  first_name: string;
  paternal_surname: string;
  photo_url: string | null;
}

interface PostChannel {
  id: string;
  name: string;
  icon: string | null;
}

interface PostData {
  id: string;
  title: string | null;
  content: string | null;
  post_type: string;
  media_urls: string[] | null;
  poll_options: { text: string }[] | null;
  poll_ends_at: string | null;
  poll_results: Record<string, number> | null;
  reaction_counts: Record<string, number> | null;
  comment_count: number | null;
  view_count: number | null;
  is_pinned: boolean | null;
  created_at: string;
  channels: PostChannel | PostChannel[];
  residents: PostAuthor | PostAuthor[] | null;
}

interface PostCardProps {
  post: PostData;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const author = Array.isArray(post.residents)
    ? post.residents[0]
    : post.residents;
  const channel = Array.isArray(post.channels)
    ? post.channels[0]
    : post.channels;

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  const handlePress = () => {
    router.push(`/(resident)/community/post/${post.id}`);
  };

  const handleCommentPress = () => {
    router.push(`/(resident)/community/post/${post.id}`);
  };

  const pollOptions = post.poll_options as { text: string }[] | null;
  const pollResults = post.poll_results as Record<string, number> | null;
  const totalVotes = pollResults
    ? Object.values(pollResults).reduce((sum, v) => sum + v, 0)
    : 0;

  return (
    <Pressable
      onPress={handlePress}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm active:opacity-90"
    >
      {/* Header: Avatar + Author + Time + Channel */}
      <View className="flex-row items-center gap-3 mb-2">
        {author?.photo_url ? (
          <Image
            source={{ uri: author.photo_url }}
            className="w-10 h-10 rounded-full bg-gray-200"
          />
        ) : (
          <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
            <Text className="text-blue-600 font-bold text-base">
              {author?.first_name?.[0] ?? '?'}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900">
            {author
              ? `${author.first_name} ${author.paternal_surname}`
              : 'Usuario'}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-gray-400">{timeAgo}</Text>
            {channel ? (
              <View className="flex-row items-center bg-gray-100 rounded-full px-2 py-0.5">
                {channel.icon ? (
                  <Text className="text-xs mr-1">{channel.icon}</Text>
                ) : null}
                <Text className="text-xs text-gray-600">{channel.name}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {post.is_pinned ? (
          <View className="bg-yellow-100 rounded-full px-2 py-0.5">
            <Text className="text-xs text-yellow-800">Fijado</Text>
          </View>
        ) : null}
      </View>

      {/* Title */}
      {post.title ? (
        <Text className="text-base font-bold text-gray-900 mb-1">
          {post.title}
        </Text>
      ) : null}

      {/* Content */}
      {post.content ? (
        <Text className="text-sm text-gray-700 mb-2" numberOfLines={4}>
          {post.content}
        </Text>
      ) : null}

      {/* Media gallery */}
      {post.media_urls && post.media_urls.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
          contentContainerStyle={{ gap: 8 }}
        >
          {post.media_urls.map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              className="w-48 h-36 rounded-lg bg-gray-200"
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Poll widget */}
      {post.post_type === 'poll' && pollOptions ? (
        <View className="mb-2 bg-gray-50 rounded-lg p-3">
          <Text className="text-xs text-gray-500 mb-2">
            Encuesta{' '}
            {post.poll_ends_at
              ? `- Cierra ${formatDistanceToNow(new Date(post.poll_ends_at), { addSuffix: true, locale: es })}`
              : ''}
          </Text>
          {pollOptions.map((opt, i) => {
            const votes = pollResults?.[String(i)] ?? 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            return (
              <View key={i} className="mb-1.5">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-sm text-gray-800">{opt.text}</Text>
                  <Text className="text-xs text-gray-500">{pct}%</Text>
                </View>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </View>
              </View>
            );
          })}
          <Text className="text-xs text-gray-400 mt-1">
            {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
          </Text>
        </View>
      ) : null}

      {/* Reaction bar */}
      <ReactionBar
        postId={post.id}
        reactionCounts={post.reaction_counts}
        commentCount={post.comment_count ?? 0}
        onCommentPress={handleCommentPress}
      />
    </Pressable>
  );
}
