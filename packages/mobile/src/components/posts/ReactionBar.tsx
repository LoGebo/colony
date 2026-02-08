import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useToggleReaction } from '@/hooks/usePosts';

interface ReactionBarProps {
  postId: string;
  reactionCounts: Record<string, number> | null;
  commentCount: number;
  onCommentPress?: () => void;
}

export function ReactionBar({
  postId,
  reactionCounts,
  commentCount,
  onCommentPress,
}: ReactionBarProps) {
  const toggleReaction = useToggleReaction();

  const totalReactions = reactionCounts
    ? Object.values(reactionCounts).reduce((sum, count) => sum + count, 0)
    : 0;

  const handleLike = () => {
    toggleReaction.mutate({ postId, reactionType: 'like' });
  };

  return (
    <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
      {/* Reaction count summary */}
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={handleLike}
          disabled={toggleReaction.isPending}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-gray-50 active:bg-gray-200"
        >
          {toggleReaction.isPending ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : (
            <Text className="text-base">{'<3'}</Text>
          )}
          {totalReactions > 0 ? (
            <Text className="text-sm text-gray-600">{totalReactions}</Text>
          ) : null}
        </Pressable>
      </View>

      {/* Comment count */}
      {onCommentPress ? (
        <Pressable
          onPress={onCommentPress}
          className="flex-row items-center gap-1 px-3 py-1.5 active:opacity-70"
        >
          <Text className="text-sm text-gray-500">
            {commentCount > 0
              ? `${commentCount} comentario${commentCount !== 1 ? 's' : ''}`
              : 'Comentar'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
