import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyVehicles, useDeleteVehicle } from '@/hooks/useVehicles';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusBadge } from '@/components/ui/Badge';

const STATUS_VARIANTS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activo' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactivo' },
  suspended: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspendido' },
};

export default function VehiclesListScreen() {
  const router = useRouter();
  const { data: vehicles, isLoading, isRefetching, refetch } = useMyVehicles();
  const { mutate: deleteVehicle } = useDeleteVehicle();

  const handleDelete = (vehicleId: string, plate: string) => {
    Alert.alert(
      'Eliminar Vehiculo',
      `Deseas eliminar el vehiculo con placas ${plate}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            deleteVehicle(vehicleId, {
              onSuccess: () => Alert.alert('Exito', 'Vehiculo eliminado'),
              onError: (err) => Alert.alert('Error', err.message),
            }),
        },
      ],
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Cargando vehiculos..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900 mb-4">Mis Vehiculos</Text>

        <Pressable
          onPress={() => router.push('/(resident)/more/vehicles/create')}
          className="bg-blue-600 rounded-lg px-4 py-2 items-center active:opacity-80"
        >
          <Text className="text-white font-semibold">Agregar Vehiculo</Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={vehicles ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderItem={({ item }) => (
          <View className="bg-white rounded-xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-bold text-gray-900">
                {item.plate_number}
              </Text>
              <StatusBadge status={item.status} variants={STATUS_VARIANTS} />
            </View>

            {item.make || item.model ? (
              <Text className="text-sm text-gray-600 mb-1">
                {[item.make, item.model].filter(Boolean).join(' ')}
              </Text>
            ) : null}

            <View className="flex-row items-center gap-3 mb-2">
              {item.color ? (
                <View className="flex-row items-center">
                  <View
                    className="w-4 h-4 rounded-full mr-1 border border-gray-200"
                    style={{ backgroundColor: item.color }}
                  />
                  <Text className="text-xs text-gray-500">{item.color}</Text>
                </View>
              ) : null}
              {item.year ? (
                <Text className="text-xs text-gray-500">{item.year}</Text>
              ) : null}
              <Text className="text-xs text-gray-400">{item.plate_state}</Text>
            </View>

            {item.access_enabled ? (
              <View className="bg-green-50 rounded-md px-2 py-1 self-start mb-2">
                <Text className="text-xs text-green-700">Acceso habilitado</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => handleDelete(item.id, item.plate_number)}
              className="self-end active:opacity-70"
            >
              <Text className="text-red-500 text-sm">Eliminar</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState message="No tienes vehiculos registrados" icon={'\u{1F697}'} />
        }
      />
    </View>
  );
}
