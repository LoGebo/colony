import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useChannels, useCreatePost } from '@/hooks/usePosts';
import { useAuth } from '@/hooks/useAuth';
import { pickAndUploadImage } from '@/lib/upload';

const POST_TYPES = [
  { key: 'discussion', label: 'Discusion' },
  { key: 'question', label: 'Pregunta' },
  { key: 'event', label: 'Evento' },
  { key: 'poll', label: 'Encuesta' },
] as const;

export default function CreatePostScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { data: channels, isLoading: channelsLoading } = useChannels();
  const createPost = useCreatePost();

  const [channelId, setChannelId] = useState<string | null>(null);
  const [postType, setPostType] = useState<string>('discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [uploading, setUploading] = useState(false);

  const canSubmit =
    channelId &&
    content.trim().length > 0 &&
    !createPost.isPending &&
    (postType !== 'poll' ||
      pollOptions.filter((o) => o.trim().length > 0).length >= 2);

  const handleAddPhoto = async () => {
    if (!communityId) return;
    setUploading(true);
    try {
      const path = await pickAndUploadImage(
        'community-assets',
        communityId,
        'posts'
      );
      if (path) {
        setMediaUrls((prev) => [...prev, path]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await createPost.mutateAsync({
        channel_id: channelId!,
        post_type: postType,
        title: title.trim() || undefined,
        content: content.trim(),
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
        poll_options:
          postType === 'poll'
            ? pollOptions
                .filter((o) => o.trim().length > 0)
                .map((text) => ({ text: text.trim() }))
            : undefined,
      });
      router.back();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'No se pudo crear la publicacion'
      );
    }
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 10) {
      setPollOptions((prev) => [...prev, '']);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handlePollOptionChange = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <Text className="text-blue-600 text-base">Cancelar</Text>
          </Pressable>
          <Text className="text-lg font-bold text-gray-900">
            Nueva Publicacion
          </Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`px-4 py-1.5 rounded-full ${
              canSubmit ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            {createPost.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                className={`font-semibold ${
                  canSubmit ? 'text-white' : 'text-gray-400'
                }`}
              >
                Publicar
              </Text>
            )}
          </Pressable>
        </View>

        <View className="p-4">
          {/* Channel selection */}
          <Text className="text-sm font-medium text-gray-700 mb-2">Canal</Text>
          {channelsLoading ? (
            <ActivityIndicator size="small" className="mb-4" />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              contentContainerStyle={{ gap: 8 }}
            >
              {(channels ?? []).map((ch) => (
                <Pressable
                  key={ch.id}
                  onPress={() => setChannelId(ch.id)}
                  className={`rounded-full px-4 py-2 ${
                    channelId === ch.id
                      ? 'bg-blue-600'
                      : 'bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Text
                    className={
                      channelId === ch.id
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
          )}

          {/* Post type selector */}
          <Text className="text-sm font-medium text-gray-700 mb-2">Tipo</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {POST_TYPES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setPostType(t.key)}
                className={`rounded-full px-4 py-2 ${
                  postType === t.key
                    ? 'bg-blue-600'
                    : 'bg-gray-100 border border-gray-200'
                }`}
              >
                <Text
                  className={
                    postType === t.key
                      ? 'text-white font-medium'
                      : 'text-gray-700'
                  }
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Title (optional, except for events) */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Titulo{postType === 'event' ? '' : ' (opcional)'}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titulo de la publicacion"
            placeholderTextColor="#9ca3af"
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-900 mb-4"
          />

          {/* Content */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Contenido
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Escribe tu publicacion..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-base text-gray-900 mb-4 min-h-[120px]"
          />

          {/* Poll options */}
          {postType === 'poll' ? (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Opciones de encuesta
              </Text>
              {pollOptions.map((opt, i) => (
                <View key={i} className="flex-row items-center gap-2 mb-2">
                  <TextInput
                    value={opt}
                    onChangeText={(v) => handlePollOptionChange(i, v)}
                    placeholder={`Opcion ${i + 1}`}
                    placeholderTextColor="#9ca3af"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900"
                  />
                  {pollOptions.length > 2 ? (
                    <Pressable
                      onPress={() => handleRemovePollOption(i)}
                      className="p-2 active:opacity-70"
                    >
                      <Text className="text-red-500 text-base">X</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {pollOptions.length < 10 ? (
                <Pressable
                  onPress={handleAddPollOption}
                  className="self-start active:opacity-70"
                >
                  <Text className="text-blue-600 text-sm font-medium">
                    + Agregar opcion
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Media */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-gray-700">Fotos</Text>
              <Pressable
                onPress={handleAddPhoto}
                disabled={uploading}
                className="active:opacity-70"
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Text className="text-blue-600 text-sm font-medium">
                    + Agregar foto
                  </Text>
                )}
              </Pressable>
            </View>
            {mediaUrls.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {mediaUrls.map((url, i) => (
                  <View key={i} className="relative">
                    <Image
                      source={{ uri: url }}
                      className="w-20 h-20 rounded-lg bg-gray-200"
                    />
                    <Pressable
                      onPress={() =>
                        setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center"
                    >
                      <Text className="text-white text-xs">X</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
