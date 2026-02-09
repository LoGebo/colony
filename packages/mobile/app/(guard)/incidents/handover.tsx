import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  useRecentHandovers,
  useCreateHandover,
  useAcknowledgeHandover,
} from '@/hooks/useHandovers';
import { HandoverNoteCard } from '@/components/guard/HandoverNoteCard';

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'important', label: 'Importante' },
  { value: 'urgent', label: 'Urgente' },
];

interface PendingItem {
  description: string;
  completed: boolean;
}

export default function HandoverScreen() {
  const { communityId, guardId } = useAuth();
  const router = useRouter();

  const {
    data: handovers,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useRecentHandovers(communityId);

  const createHandover = useCreateHandover();
  const acknowledgeHandover = useAcknowledgeHandover();

  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('normal');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [newItemDescription, setNewItemDescription] = useState('');

  const handleAddPendingItem = () => {
    if (!newItemDescription.trim()) return;

    setPendingItems((prev) => [
      ...prev,
      { description: newItemDescription.trim(), completed: false },
    ]);
    setNewItemDescription('');
  };

  const handleRemovePendingItem = (index: number) => {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateHandover = async () => {
    if (!notes.trim()) {
      Alert.alert('Error', 'Las notas son requeridas');
      return;
    }

    try {
      await createHandover.mutateAsync({
        notes: notes.trim(),
        priority,
        pending_items: pendingItems,
      });

      // Reset form
      setNotes('');
      setPriority('normal');
      setPendingItems([]);

      Alert.alert('Éxito', 'Nota de turno guardada correctamente');
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Error al guardar nota'
      );
    }
  };

  const handleAcknowledge = async (handoverId: string) => {
    try {
      await acknowledgeHandover.mutateAsync(handoverId);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Error al confirmar lectura'
      );
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-red-600 text-center mb-4">
          Error al cargar notas: {error.message}
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

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 shadow-sm">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Text className="text-blue-600 text-2xl">←</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">
              Notas de Turno
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              Comunicación entre guardias
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2563eb"
          />
        }
      >
        {/* Create form */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-base font-bold text-gray-900 mb-3">
            Crear Nota
          </Text>

          {/* Notes input */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Notas *
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Información importante para el siguiente turno..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </View>

          {/* Priority selector */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Prioridad
            </Text>
            <View className="flex-row gap-2">
              {PRIORITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPriority(option.value)}
                  className={`flex-1 border rounded-lg py-2 items-center ${
                    priority === option.value
                      ? 'bg-blue-100 border-blue-400'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      priority === option.value
                        ? 'text-blue-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Pending items */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Pendientes
            </Text>

            {pendingItems.length > 0 ? (
              <View className="mb-2">
                {pendingItems.map((item, index) => (
                  <View
                    key={index}
                    className="flex-row items-center bg-gray-50 rounded-lg px-3 py-2 mb-1"
                  >
                    <Text className="flex-1 text-sm text-gray-700">
                      {item.description}
                    </Text>
                    <Pressable onPress={() => handleRemovePendingItem(index)}>
                      <Text className="text-red-600 text-lg px-2">×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="flex-row gap-2">
              <TextInput
                value={newItemDescription}
                onChangeText={setNewItemDescription}
                placeholder="Nuevo pendiente..."
                className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                onSubmitEditing={handleAddPendingItem}
              />
              <Pressable
                onPress={handleAddPendingItem}
                disabled={!newItemDescription.trim()}
                className={`rounded-lg px-4 py-2 items-center justify-center ${
                  !newItemDescription.trim()
                    ? 'bg-gray-300'
                    : 'bg-blue-600 active:bg-blue-700'
                }`}
              >
                <Text className="text-white font-semibold text-sm">+</Text>
              </Pressable>
            </View>
          </View>

          {/* Submit button */}
          <Pressable
            onPress={handleCreateHandover}
            disabled={createHandover.isPending || !notes.trim()}
            className={`rounded-lg py-2.5 items-center ${
              createHandover.isPending || !notes.trim()
                ? 'bg-gray-300'
                : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            {createHandover.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Guardar Nota</Text>
            )}
          </Pressable>

          {createHandover.isError ? (
            <Text className="text-red-600 text-xs mt-2 text-center">
              {createHandover.error?.message ?? 'Error al guardar nota'}
            </Text>
          ) : null}
        </View>

        {/* Recent handovers */}
        <View>
          <Text className="text-base font-bold text-gray-900 mb-2 px-1">
            Notas Recientes
          </Text>

          {handovers && handovers.length > 0 ? (
            handovers.map((handover) => {
              const guard = handover.guards as
                | { first_name: string; last_name: string }
                | undefined;
              const guardName = guard
                ? `${guard.first_name} ${guard.last_name}`
                : 'Guardia';

              return (
                <HandoverNoteCard
                  key={handover.id}
                  guardName={guardName}
                  notes={handover.notes}
                  priority={handover.priority}
                  pendingItems={
                    (handover.pending_items as PendingItem[]) ?? []
                  }
                  createdAt={handover.created_at}
                  acknowledged={!!handover.acknowledged_at}
                  onAcknowledge={
                    !handover.acknowledged_at
                      ? () => handleAcknowledge(handover.id)
                      : undefined
                  }
                />
              );
            })
          ) : (
            <View className="items-center justify-center py-8">
              <Text className="text-gray-400">No hay notas recientes</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
