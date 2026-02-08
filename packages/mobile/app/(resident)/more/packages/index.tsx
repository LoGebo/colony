import { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useMyPackages } from '@/hooks/useMyPackages';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_VARIANTS: Record<string, { bg: string; text: string; label: string }> = {
  received: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Recibido' },
  stored: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Almacenado' },
  notified: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Notificado' },
  pending_pickup: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Listo para recoger' },
  picked_up: { bg: 'bg-green-100', text: 'text-green-800', label: 'Recogido' },
  returned: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Devuelto' },
};

type Tab = 'pending' | 'picked_up';

export default function PackagesListScreen() {
  const { data: packages, isLoading, isRefetching, refetch } = useMyPackages();
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  const filtered = useMemo(() => {
    if (!packages) return [];
    if (activeTab === 'picked_up') {
      return packages.filter((p) => p.status === 'picked_up');
    }
    return packages.filter((p) => p.status !== 'picked_up');
  }, [packages, activeTab]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando paquetes..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900 mb-4">Mis Paquetes</Text>

        {/* Tabs */}
        <View className="flex-row bg-gray-100 rounded-lg p-1 mb-2">
          <Pressable
            onPress={() => setActiveTab('pending')}
            className={`flex-1 rounded-md py-2 items-center ${
              activeTab === 'pending' ? 'bg-blue-600' : ''
            }`}
          >
            <Text
              className={`font-medium ${
                activeTab === 'pending' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Pendientes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('picked_up')}
            className={`flex-1 rounded-md py-2 items-center ${
              activeTab === 'picked_up' ? 'bg-blue-600' : ''
            }`}
          >
            <Text
              className={`font-medium ${
                activeTab === 'picked_up' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Recogidos
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => {
          const statusVariant =
            STATUS_VARIANTS[item.status] ?? STATUS_VARIANTS.received;

          // Get active pickup code
          const pickupCodes = item.package_pickup_codes as Array<{
            id: string;
            code_type: string;
            code_value: string;
            status: string;
            valid_until: string;
            used_at: string | null;
          }> | null;

          const activeCode = pickupCodes?.find(
            (c) => c.status === 'active' && new Date(c.valid_until) > new Date(),
          );

          return (
            <View className="bg-white rounded-xl p-4 mb-3 shadow-sm">
              {/* Status badge and carrier */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-gray-500">
                  {item.carrier === 'other' ? item.carrier_other : item.carrier}
                </Text>
                <View className={`${statusVariant.bg} rounded-full px-2 py-0.5`}>
                  <Text className={`${statusVariant.text} text-xs font-medium`}>
                    {statusVariant.label}
                  </Text>
                </View>
              </View>

              {/* Description */}
              {item.description ? (
                <Text className="text-base text-gray-900 mb-1" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Recipient */}
              {item.recipient_name ? (
                <Text className="text-sm text-gray-600 mb-1">
                  Para: {item.recipient_name}
                </Text>
              ) : null}

              {/* Tracking number */}
              {item.tracking_number ? (
                <Text className="text-xs text-gray-400 mb-2">
                  Guia: {item.tracking_number}
                </Text>
              ) : null}

              {/* Pickup code */}
              {activeCode ? (
                <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-1">
                  <Text className="text-xs text-blue-600 mb-1">Codigo de recoleccion:</Text>
                  <Text className="text-2xl font-bold text-blue-800 text-center tracking-wider">
                    {activeCode.code_value}
                  </Text>
                  <Text className="text-xs text-blue-500 text-center mt-1">
                    Valido hasta:{' '}
                    {format(new Date(activeCode.valid_until), "dd MMM yyyy HH:mm", {
                      locale: es,
                    })}
                  </Text>
                </View>
              ) : null}

              {/* Date */}
              <Text className="text-xs text-gray-400 mt-2">
                Recibido:{' '}
                {format(new Date(item.received_at), "dd MMM yyyy HH:mm", {
                  locale: es,
                })}
              </Text>

              {item.picked_up_at ? (
                <Text className="text-xs text-green-600 mt-0.5">
                  Recogido:{' '}
                  {format(new Date(item.picked_up_at), "dd MMM yyyy HH:mm", {
                    locale: es,
                  })}
                </Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            message={
              activeTab === 'pending'
                ? 'No tienes paquetes pendientes'
                : 'No tienes paquetes recogidos'
            }
            icon={'\u{1F4E6}'}
          />
        }
      />
    </View>
  );
}
