import { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityBranding } from '@/hooks/useCommunity';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { formatCurrency } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { DashboardCard } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function ResidentDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { residentId, communityId } = useAuth();
  const { data: community } = useCommunityBranding(communityId);
  const { unitId, isLoading: unitLoading } = useResidentUnit();

  // Fetch unit balance
  const { data: balanceData } = useQuery({
    queryKey: queryKeys.payments.balance(unitId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unit_balance', {
        p_unit_id: unitId!,
      });
      if (error) throw error;
      // RPC returns an array; take first row
      const row = Array.isArray(data) ? data[0] : data;
      return row as {
        current_balance: number;
        days_overdue: number;
        last_charge_date: string;
        last_payment_date: string;
        total_charges: number;
        total_payments: number;
      } | null;
    },
    enabled: !!unitId,
  });

  // Count active invitations
  const { data: visitorsCount } = useQuery({
    queryKey: queryKeys.visitors.active(communityId!).queryKey,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('invitations')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_resident_id', residentId!)
        .eq('community_id', communityId!)
        .in('status', ['approved', 'pending'])
        .is('cancelled_at', null)
        .is('deleted_at', null)
        .gte('valid_until', new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!residentId && !!communityId,
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['visitors'] });
    queryClient.invalidateQueries({ queryKey: ['communities'] });
    queryClient.invalidateQueries({ queryKey: ['occupancies'] });
  }, [queryClient]);

  if (unitLoading) {
    return <LoadingSpinner message="Cargando..." />;
  }

  const balance = balanceData?.current_balance ?? 0;
  const daysOverdue = balanceData?.days_overdue ?? 0;
  const isOverdue = daysOverdue > 0;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-5 pt-14"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View className="mb-6">
        <Text className="text-2xl font-bold text-gray-900">
          {community?.name ?? 'Comunidad'}
        </Text>
        <Text className="text-base text-gray-500 mt-1">Bienvenido</Text>
      </View>

      {/* Balance Card */}
      <DashboardCard
        title="Saldo"
        value={formatCurrency(balance)}
        subtitle={isOverdue ? `${daysOverdue} dias de atraso` : 'Al corriente'}
        color={isOverdue ? 'bg-red-50' : 'bg-green-50'}
        onPress={() => router.push('/(resident)/payments')}
      />

      {/* Active Visitors Card */}
      <DashboardCard
        title="Visitantes activos"
        value={String(visitorsCount ?? 0)}
        color="bg-blue-50"
        onPress={() => router.push('/(resident)/visitors')}
      />
    </ScrollView>
  );
}
