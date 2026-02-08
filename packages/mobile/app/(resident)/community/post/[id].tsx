import { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  usePostDetail,
  usePostComments,
  useCreateComment,
  useVotePoll,
} from '@/hooks/usePosts';
import { ReactionBar } from '@/components/posts/ReactionBar';
import { CommentItem } from '@/components/posts/CommentItem';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const { data: post, isLoading: postLoading } = usePostDetail(id!);
  const { data: comments, isLoading: commentsLoading } = usePostComments(id!);
  const createComment = useCreateComment();
  const votePoll = useVotePoll();

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  if (postLoading || !post) {
    return <LoadingSpinner message="Cargando publicacion..." />;
  }

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

  const pollOptions = post.poll_options as { text: string }[] | null;
  const pollResults = post.poll_results as Record<string, number> | null;
  const totalVotes = pollResults
    ? Object.values(pollResults).reduce((sum, v) => sum + v, 0)
    : 0;
  const pollEnded = post.poll_ends_at
    ? new Date(post.poll_ends_at) < new Date()
    : false;

  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text) return;

    try {
      await createComment.mutateAsync({
        post_id: id!,
        content: text,
        parent_comment_id: replyTo ?? undefined,
      });
      setCommentText('');
      setReplyTo(null);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'No se pudo enviar el comentario'
      );
    }
  };

  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
    inputRef.current?.focus();
  };

  const handleVote = (optionIndex: number) => {
    if (pollEnded) return;
    votePoll.mutate({ postId: id!, optionIndex });
  };

  const renderHeader = () => (
    <View className="bg-white px-4 pb-3">
      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        className="py-3 active:opacity-70"
      >
        <Text className="text-blue-600 text-base">Volver</Text>
      </Pressable>

      {/* Author row */}
      <View className="flex-row items-center gap-3 mb-3">
        {author?.photo_url ? (
          <Image
            source={{ uri: author.photo_url }}
            className="w-11 h-11 rounded-full bg-gray-200"
          />
        ) : (
          <View className="w-11 h-11 rounded-full bg-blue-100 items-center justify-center">
            <Text className="text-blue-600 font-bold text-lg">
              {author?.first_name?.[0] ?? '?'}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
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
        <Text className="text-lg font-bold text-gray-900 mb-2">
          {post.title}
        </Text>
      ) : null}

      {/* Full content */}
      {post.content ? (
        <Text className="text-base text-gray-700 mb-3 leading-6">
          {post.content}
        </Text>
      ) : null}

      {/* Media gallery */}
      {post.media_urls && (post.media_urls as string[]).length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {(post.media_urls as string[]).map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              className="w-64 h-48 rounded-lg bg-gray-200"
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Poll widget - interactive */}
      {post.post_type === 'poll' && pollOptions ? (
        <View className="mb-3 bg-gray-50 rounded-lg p-3">
          <Text className="text-xs text-gray-500 mb-2">
            {pollEnded
              ? 'Encuesta cerrada'
              : post.poll_ends_at
                ? `Cierra ${formatDistanceToNow(new Date(post.poll_ends_at), { addSuffix: true, locale: es })}`
                : 'Encuesta abierta'}
          </Text>
          {pollOptions.map((opt, i) => {
            const votes = pollResults?.[String(i)] ?? 0;
            const pct =
              totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            return (
              <Pressable
                key={i}
                onPress={() => handleVote(i)}
                disabled={pollEnded || votePoll.isPending}
                className="mb-2 active:opacity-80"
              >
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-sm text-gray-800 font-medium">
                    {opt.text}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {votes} ({pct}%)
                  </Text>
                </View>
                <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </View>
              </Pressable>
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
        reactionCounts={post.reaction_counts as Record<string, number> | null}
        commentCount={post.comment_count ?? 0}
      />

      {/* Comments header */}
      <View className="mt-4 pt-3 border-t border-gray-100">
        <Text className="text-sm font-semibold text-gray-900">
          Comentarios ({post.comment_count ?? 0})
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Comments list */}
      <FlatList
        data={comments ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => (
          <View className="px-4">
            <CommentItem
              comment={item as never}
              onReply={post.is_locked ? undefined : handleReply}
            />
          </View>
        )}
        ListEmptyComponent={
          commentsLoading ? (
            <View className="py-8">
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          ) : (
            <View className="py-8 items-center">
              <Text className="text-sm text-gray-400">
                Se el primero en comentar
              </Text>
            </View>
          )
        }
      />

      {/* Comment input */}
      {!post.is_locked ? (
        <View className="bg-white border-t border-gray-200 px-4 py-2 flex-row items-end gap-2">
          <View className="flex-1">
            {replyTo ? (
              <View className="flex-row items-center mb-1">
                <Text className="text-xs text-blue-600">
                  Respondiendo a un comentario
                </Text>
                <Pressable
                  onPress={() => setReplyTo(null)}
                  className="ml-2 active:opacity-70"
                >
                  <Text className="text-xs text-gray-400">X</Text>
                </Pressable>
              </View>
            ) : null}
            <TextInput
              ref={inputRef}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Escribe un comentario..."
              placeholderTextColor="#9ca3af"
              multiline
              className="border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900 max-h-24"
            />
          </View>
          <Pressable
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || createComment.isPending}
            className={`px-4 py-2.5 rounded-lg ${
              commentText.trim() && !createComment.isPending
                ? 'bg-blue-600'
                : 'bg-gray-200'
            }`}
          >
            {createComment.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                className={`font-semibold ${
                  commentText.trim() ? 'text-white' : 'text-gray-400'
                }`}
              >
                Enviar
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View className="bg-gray-100 px-4 py-3 border-t border-gray-200">
          <Text className="text-sm text-gray-500 text-center">
            Los comentarios estan deshabilitados para esta publicacion
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
