import React, { useCallback, useRef } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { usePendingPackages } from '@/hooks/usePackages';
import { PackageCard } from '@/components/guard/PackageCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function PackagesListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: packages, isLoading, isRefetching } = usePendingPackages();
  const prevUnitRef = useRef<string | null>(null);

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.packages._def });
  }, [queryClient]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando paquetes..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 p-5">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            Paquetes Pendientes
          </Text>
          <Pressable
            onPress={() => router.push('/(guard)/packages/log')}
            className="bg-blue-600 rounded-lg px-4 py-2 active:opacity-80"
          >
            <Text className="text-white font-semibold text-sm">
              Registrar Paquete
            </Text>
          </Pressable>
        </View>

        {/* Package list */}
        <FlatList
          data={packages ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const currentUnit =
              (item.units as { unit_number: string } | null)?.unit_number ?? '';
            const prevUnit =
              index > 0
                ? ((packages![index - 1].units as { unit_number: string } | null)
                    ?.unit_number ?? '')
                : null;

            const showSectionHeader = currentUnit !== prevUnit;

            return (
              <View>
                {showSectionHeader && currentUnit ? (
                  <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-3">
                    Unidad {currentUnit}
                  </Text>
                ) : null}
                <PackageCard
                  pkg={item as Parameters<typeof PackageCard>[0]['pkg']}
                  onPress={() =>
                    router.push(`/(guard)/packages/${item.id}`)
                  }
                />
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState message="Sin paquetes pendientes" />
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            packages?.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
          }
        />
      </View>
    </SafeAreaView>
  );
}
