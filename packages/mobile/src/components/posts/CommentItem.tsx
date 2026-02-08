import { View, Text, Pressable, Image } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface CommentAuthor {
  id: string;
  first_name: string;
  paternal_surname: string;
  photo_url: string | null;
}

interface CommentData {
  id: string;
  content: string;
  parent_comment_id: string | null;
  depth: number | null;
  created_at: string;
  residents: CommentAuthor | null;
}

interface CommentItemProps {
  comment: CommentData;
  onReply?: (commentId: string) => void;
}

export function CommentItem({ comment, onReply }: CommentItemProps) {
  const author = comment.residents;
  const depth = comment.depth ?? 0;
  const indentPx = Math.min(depth * 24, 72); // Max 3 levels of indent

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <View style={{ marginLeft: indentPx }} className="flex-row gap-2 py-2">
      {/* Avatar */}
      {author?.photo_url ? (
        <Image
          source={{ uri: author.photo_url }}
          className="w-7 h-7 rounded-full bg-gray-200"
        />
      ) : (
        <View className="w-7 h-7 rounded-full bg-gray-200 items-center justify-center">
          <Text className="text-xs text-gray-500">
            {author?.first_name?.[0] ?? '?'}
          </Text>
        </View>
      )}

      {/* Content */}
      <View className="flex-1">
        <View className="bg-gray-100 rounded-lg px-3 py-2">
          <Text className="text-xs font-semibold text-gray-800">
            {author
              ? `${author.first_name} ${author.paternal_surname}`
              : 'Usuario'}
          </Text>
          <Text className="text-sm text-gray-700 mt-0.5">
            {comment.content}
          </Text>
        </View>

        <View className="flex-row items-center gap-3 mt-1 px-1">
          <Text className="text-xs text-gray-400">{timeAgo}</Text>
          {onReply ? (
            <Pressable
              onPress={() => onReply(comment.id)}
              className="active:opacity-70"
            >
              <Text className="text-xs text-blue-600 font-medium">
                Responder
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
