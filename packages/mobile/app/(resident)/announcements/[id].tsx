import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useAnnouncementDetail,
  useMarkAnnouncementRead,
  useAcknowledgeAnnouncement,
} from '@/hooks/useAnnouncements';
import { SectionCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDateTime } from '@/lib/dates';

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: announcement, isLoading, error } = useAnnouncementDetail(id ?? '');
  const markRead = useMarkAnnouncementRead();
  const acknowledge = useAcknowledgeAnnouncement();

  // Track whether we have already triggered the mark-read to avoid re-firing
  const markedRef = useRef(false);

  // Auto-mark as read on mount
  useEffect(() => {
    if (id && !markedRef.current) {
      markedRef.current = true;
      markRead.mutate(id);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <LoadingSpinner message="Cargando aviso..." />;
  }

  if (error || !announcement) {
    return <EmptyState message="Aviso no encontrado" />;
  }

  const handleAcknowledge = () => {
    if (id) {
      acknowledge.mutate(id);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Pressable onPress={() => router.back()} className="mb-3 active:opacity-70">
          <Text className="text-blue-600 text-sm">&larr; Volver</Text>
        </Pressable>

        <Text className="text-xl font-bold text-gray-900 mb-2">
          {announcement.title}
        </Text>

        <View className="flex-row items-center gap-2 mb-1">
          {announcement.publish_at && (
            <Text className="text-sm text-gray-500">
              {formatDateTime(announcement.publish_at)}
            </Text>
          )}
          {announcement.is_urgent && (
            <View className="bg-red-100 rounded-full px-2 py-0.5">
              <Text className="text-red-700 text-xs font-medium">URGENTE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Body */}
      <View className="px-4">
        <SectionCard className="mb-4">
          <Text className="text-base text-gray-800 leading-6">
            {announcement.body}
          </Text>
        </SectionCard>

        {/* Acknowledge button */}
        {announcement.requires_acknowledgment && (
          <View className="mt-2">
            {acknowledge.isSuccess ? (
              <View className="bg-green-50 rounded-xl p-4 items-center">
                <Text className="text-green-700 font-semibold text-base">
                  Confirmado
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleAcknowledge}
                disabled={acknowledge.isPending}
                className="bg-blue-600 rounded-xl p-4 items-center active:opacity-80"
              >
                <Text className="text-white font-semibold text-base">
                  {acknowledge.isPending
                    ? 'Confirmando...'
                    : 'Confirmar lectura'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
