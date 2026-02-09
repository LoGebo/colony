import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  useIncidentDetail,
  useAddIncidentComment,
} from '@/hooks/useIncidents';
import { IncidentTimelineItem } from '@/components/guard/IncidentTimelineItem';
import { formatDateTime } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100', text: 'text-green-700' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  critical: { bg: 'bg-red-100', text: 'text-red-700' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  reported: { bg: 'bg-gray-100', text: 'text-gray-700' },
  acknowledged: { bg: 'bg-blue-100', text: 'text-blue-700' },
  investigating: { bg: 'bg-purple-100', text: 'text-purple-700' },
  in_progress: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  pending_review: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

interface TimelineEvent {
  type: string;
  timestamp: string;
  actor_name: string;
  data: Record<string, unknown>;
}

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { communityId } = useAuth();

  const {
    data: incident,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useIncidentDetail(id);

  const addComment = useAddIncidentComment();

  const [comment, setComment] = useState('');

  const handleAddComment = async () => {
    if (!comment.trim() || !id) return;

    try {
      await addComment.mutateAsync({
        incidentId: id,
        commentText: comment.trim(),
        isInternal: false,
      });
      setComment('');
    } catch {
      // Error is surfaced via mutation state
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error || !incident) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-red-600 text-center mb-4">
          Error al cargar incidente: {error?.message ?? 'No encontrado'}
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="bg-blue-600 rounded-lg px-6 py-3"
        >
          <Text className="text-white font-semibold">Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const severityColor =
    SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.medium;
  const statusColor = STATUS_COLORS[incident.status] ?? STATUS_COLORS.reported;

  const timeline = (incident.timeline as TimelineEvent[] | null) ?? [];
  const sortedTimeline = [...timeline].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Text className="text-blue-600 text-2xl">←</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {incident.incident_number}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="pb-6"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2563eb"
          />
        }
      >
        {/* Incident info card */}
        <View className="bg-white m-4 p-4 rounded-xl shadow-sm">
          {/* Title */}
          <Text className="text-lg font-bold text-gray-900 mb-2">
            {incident.title}
          </Text>

          {/* Description */}
          {incident.description ? (
            <Text className="text-sm text-gray-700 leading-5 mb-3">
              {incident.description}
            </Text>
          ) : null}

          {/* Badges */}
          <View className="flex-row items-center gap-2 mb-3">
            <View className={`${severityColor.bg} rounded-md px-2 py-0.5`}>
              <Text className={`${severityColor.text} text-xs font-medium`}>
                {incident.severity}
              </Text>
            </View>
            <View className={`${statusColor.bg} rounded-md px-2 py-0.5`}>
              <Text className={`${statusColor.text} text-xs font-medium`}>
                {incident.status}
              </Text>
            </View>
          </View>

          {/* Location */}
          {incident.location_description ? (
            <View className="flex-row items-start mb-2">
              <Text className="text-sm text-gray-600">
                📍 {incident.location_description}
              </Text>
            </View>
          ) : null}

          {/* GPS */}
          {incident.gps_latitude && incident.gps_longitude ? (
            <Text className="text-xs text-gray-400">
              GPS: {incident.gps_latitude.toFixed(6)},{' '}
              {incident.gps_longitude.toFixed(6)}
            </Text>
          ) : null}

          {/* Created at */}
          <Text className="text-xs text-gray-400 mt-2">
            Creado: {formatDateTime(incident.created_at)}
          </Text>
        </View>

        {/* Media section */}
        {incident.media && incident.media.length > 0 ? (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Evidencia ({incident.media.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {incident.media.map((media) => {
                const publicUrl = supabase.storage
                  .from(media.storage_bucket ?? 'incident-evidence')
                  .getPublicUrl(media.storage_path).data.publicUrl;

                return (
                  <View key={media.id} className="w-32 h-32">
                    <Image
                      source={{ uri: publicUrl }}
                      className="w-full h-full rounded-lg"
                      resizeMode="cover"
                    />
                    {media.caption ? (
                      <Text
                        className="text-xs text-gray-600 mt-1"
                        numberOfLines={2}
                      >
                        {media.caption}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Timeline */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-sm font-semibold text-gray-700 mb-3">
            Historial del Incidente
          </Text>
          {sortedTimeline.length > 0 ? (
            <View>
              {sortedTimeline.map((event, index) => (
                <IncidentTimelineItem
                  key={index}
                  event={event}
                  isLast={index === sortedTimeline.length - 1}
                />
              ))}
            </View>
          ) : (
            <Text className="text-sm text-gray-400">
              Sin eventos registrados
            </Text>
          )}
        </View>

        {/* Comment input */}
        <View className="bg-white mx-4 p-4 rounded-xl shadow-sm">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Agregar Seguimiento
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Escribe un comentario sobre este incidente..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <Pressable
            onPress={handleAddComment}
            disabled={!comment.trim() || addComment.isPending}
            className={`rounded-lg py-2 items-center ${
              !comment.trim() || addComment.isPending
                ? 'bg-gray-300'
                : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            {addComment.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-sm">
                Enviar Comentario
              </Text>
            )}
          </Pressable>
          {addComment.isError ? (
            <Text className="text-red-600 text-xs mt-2 text-center">
              {addComment.error?.message ?? 'Error al enviar comentario'}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
