import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTicketDetail, useAddComment } from '@/hooks/useTickets';
import { StatusBadge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelative, formatDateTime } from '@/lib/dates';
import { STORAGE_BUCKETS } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

const STATUS_VARIANTS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Abierto' },
  assigned: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Asignado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En progreso' },
  pending_parts: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Esperando piezas' },
  pending_resident: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Esperando residente' },
  resolved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Resuelto' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cerrado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Baja', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Media', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
};

const ROLE_LABELS: Record<string, string> = {
  reporter: 'Residente',
  admin: 'Administrador',
  manager: 'Gerente',
  maintenance: 'Mantenimiento',
  system: 'Sistema',
};

type TicketComment = {
  id: string;
  content: string | null;
  author_id: string;
  author_role: string;
  is_system: boolean;
  is_internal: boolean;
  photo_urls: string[] | null;
  created_at: string;
  status_from?: string | null;
  status_to?: string | null;
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: ticket, isLoading, error } = useTicketDetail(id ?? '');
  const { mutate: addComment, isPending: isAddingComment } = useAddComment();

  const [commentText, setCommentText] = useState('');

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage
      .from(STORAGE_BUCKETS.TICKET_ATTACHMENTS)
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAddComment = useCallback(() => {
    if (!commentText.trim() || !id) return;

    addComment(
      { ticket_id: id, content: commentText.trim() },
      {
        onSuccess: () => {
          setCommentText('');
        },
      }
    );
  }, [commentText, id, addComment]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando ticket..." />;
  }

  if (error || !ticket) {
    return <EmptyState message="Ticket no encontrado" />;
  }

  const category = ticket.ticket_categories as {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;

  const comments = (
    (ticket.ticket_comments ?? []) as TicketComment[]
  )
    .filter((c) => !c.is_internal)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const priorityInfo = PRIORITY_LABELS[ticket.priority] ?? {
    label: ticket.priority,
    color: 'bg-gray-100 text-gray-700',
  };

  const canComment =
    ticket.status !== 'closed' && ticket.status !== 'cancelled';

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 bg-gray-50">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: canComment ? 80 : 32 }}
        >
          {/* Header */}
          <View className="px-4 pt-4 pb-2">
            <Pressable onPress={() => router.back()} className="mb-3 active:opacity-70">
              <Text className="text-blue-600 text-base">Volver</Text>
            </Pressable>
            <Text className="text-xl font-bold text-gray-900 mb-2">{ticket.title}</Text>

            {/* Status + Priority + Category badges */}
            <View className="flex-row items-center flex-wrap gap-2 mb-4">
              <StatusBadge status={ticket.status} variants={STATUS_VARIANTS} />
              <View className={`rounded-full px-2 py-0.5 ${priorityInfo.color.split(' ')[0]}`}>
                <Text className={`text-xs font-medium ${priorityInfo.color.split(' ')[1]}`}>
                  {priorityInfo.label}
                </Text>
              </View>
              {category ? (
                <View className="bg-gray-100 rounded-full px-2 py-0.5">
                  <Text className="text-xs text-gray-700 font-medium">
                    {category.icon ? `${category.icon} ` : ''}{category.name}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* SLA Info */}
          {(ticket.response_due_at || ticket.resolution_due_at) ? (
            <View className="px-4 mb-3">
              <SectionCard>
                {ticket.response_due_at ? (
                  <View className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-500">Respuesta esperada</Text>
                    <Text
                      className={`text-sm font-medium ${
                        ticket.response_breached ? 'text-red-600' : 'text-gray-900'
                      }`}
                    >
                      {formatDateTime(ticket.response_due_at)}
                      {ticket.response_breached ? ' (vencido)' : ''}
                    </Text>
                  </View>
                ) : null}
                {ticket.resolution_due_at ? (
                  <View className="flex-row justify-between py-1">
                    <Text className="text-sm text-gray-500">Resolucion esperada</Text>
                    <Text
                      className={`text-sm font-medium ${
                        ticket.resolution_breached ? 'text-red-600' : 'text-gray-900'
                      }`}
                    >
                      {formatDateTime(ticket.resolution_due_at)}
                      {ticket.resolution_breached ? ' (vencido)' : ''}
                    </Text>
                  </View>
                ) : null}
              </SectionCard>
            </View>
          ) : null}

          {/* Description */}
          <View className="px-4 mb-3">
            <SectionCard>
              <Text className="text-sm font-medium text-gray-700 mb-1">Descripcion</Text>
              <Text className="text-sm text-gray-600 leading-5">{ticket.description}</Text>
              {ticket.location ? (
                <View className="mt-2 pt-2 border-t border-gray-100">
                  <Text className="text-xs text-gray-500">Ubicacion: {ticket.location}</Text>
                </View>
              ) : null}
            </SectionCard>
          </View>

          {/* Timeline / Comments */}
          <View className="px-4 mb-3">
            <Text className="text-base font-semibold text-gray-900 mb-2">Historial</Text>

            {comments.length === 0 ? (
              <Text className="text-sm text-gray-400 italic">Sin comentarios aun</Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} className="mb-3">
                  {comment.is_system ? (
                    // System comment
                    <View className="bg-gray-100 rounded-lg p-3">
                      <Text className="text-sm text-gray-500 italic">
                        {comment.content ?? 'Accion del sistema'}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-1">
                        {formatRelative(comment.created_at)}
                      </Text>
                    </View>
                  ) : (
                    // User comment
                    <View className="bg-white rounded-lg p-3 shadow-sm">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-medium text-blue-600">
                          {ROLE_LABELS[comment.author_role] ?? comment.author_role}
                        </Text>
                        <Text className="text-xs text-gray-400">
                          {formatRelative(comment.created_at)}
                        </Text>
                      </View>
                      {comment.content ? (
                        <Text className="text-sm text-gray-700 leading-5">
                          {comment.content}
                        </Text>
                      ) : null}

                      {/* Photo thumbnails */}
                      {comment.photo_urls && comment.photo_urls.length > 0 ? (
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          {comment.photo_urls.map((url, idx) => (
                            <Image
                              key={`${comment.id}-photo-${idx}`}
                              source={{ uri: getPublicUrl(url) }}
                              className="w-16 h-16 rounded-md"
                              resizeMode="cover"
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Add comment form - fixed at bottom */}
        {canComment ? (
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-sm"
                placeholder="Escribe un comentario..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={1000}
              />
              <Pressable
                onPress={handleAddComment}
                disabled={isAddingComment || !commentText.trim()}
                className={`rounded-lg px-4 py-2 ${
                  isAddingComment || !commentText.trim()
                    ? 'bg-gray-300'
                    : 'bg-blue-600 active:opacity-80'
                }`}
              >
                {isAddingComment ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Enviar</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
