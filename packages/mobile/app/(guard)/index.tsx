import React, { useCallback } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityBranding } from '@/hooks/useCommunity';
import { formatTime } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ExpectedVisitor {
  id: string;
  visitor_name: string;
  valid_from: string;
  valid_until: string | null;
  invitation_type: string;
  units: { unit_number: string } | null;
}

const VisitorRow = React.memo(function VisitorRow({
  item,
}: {
  item: ExpectedVisitor;
}) {
  const timeWindow = item.valid_until
    ? `${formatTime(item.valid_from)} - ${formatTime(item.valid_until)}`
    : formatTime(item.valid_from);

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <View className="flex-1 mr-3">
        <Text className="text-base font-medium text-gray-900">
          {item.visitor_name}
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">{timeWindow}</Text>
      </View>
      {item.units ? (
        <View className="bg-gray-100 rounded-md px-2 py-1">
          <Text className="text-xs font-medium text-gray-700">
            {item.units.unit_number}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

export default function GuardDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { communityId } = useAuth();
  const { data: community } = useCommunityBranding(communityId);

  // Fetch today's expected visitors
  const {
    data: expectedVisitors,
    isLoading,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.visitors.list({ communityId, type: 'expected-today' }).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select(
          'id, visitor_name, valid_from, valid_until, invitation_type, units(unit_number)'
        )
        .eq('community_id', communityId!)
        .in('status', ['approved', 'pending'])
        .is('cancelled_at', null)
        .is('deleted_at', null)
        .gte('valid_until', new Date().toISOString())
        .lte('valid_from', new Date().toISOString())
        .order('valid_from', { ascending: true })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as ExpectedVisitor[];
    },
    enabled: !!communityId,
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['visitors'] });
    queryClient.invalidateQueries({ queryKey: ['communities'] });
  }, [queryClient]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando caseta..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 p-5">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">
            {community?.name ?? 'Comunidad'}
          </Text>
          <Text className="text-lg text-gray-500 mt-1">Caseta</Text>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3 mb-6">
          <Pressable
            onPress={() => router.push('/(guard)/gate/scan')}
            className="flex-1 bg-blue-600 rounded-xl py-4 items-center active:opacity-80"
          >
            <Text className="text-2xl mb-1">{'📷'}</Text>
            <Text className="text-white font-semibold text-base">
              Escanear QR
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(guard)/gate/manual-checkin')}
            className="flex-1 bg-gray-200 rounded-xl py-4 items-center active:opacity-80"
          >
            <Text className="text-2xl mb-1">{'📋'}</Text>
            <Text className="text-gray-900 font-semibold text-base">
              Registro Manual
            </Text>
          </Pressable>
        </View>

        {/* Expected Visitors Section */}
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Visitantes esperados hoy
        </Text>

        <FlatList
          data={expectedVisitors}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VisitorRow item={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="📭"
              message="Sin visitantes esperados"
            />
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            expectedVisitors?.length === 0 ? { flex: 1 } : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}
