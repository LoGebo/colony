import { View, Text, ScrollView } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useResidentOccupancy } from '@/hooks/useOccupancy';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const OCCUPANCY_TYPE_VARIANTS: Record<string, { bg: string; text: string; label: string }> = {
  owner: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Propietario' },
  tenant: { bg: 'bg-green-100', text: 'text-green-800', label: 'Inquilino' },
  family_member: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Familiar' },
  authorized: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Autorizado' },
};

export default function UnitDetailScreen() {
  const { residentId } = useAuth();
  const { data: occupancies, isLoading } = useResidentOccupancy(residentId);

  if (isLoading) {
    return <LoadingSpinner message="Cargando unidad..." />;
  }

  if (!occupancies || occupancies.length === 0) {
    return <EmptyState message="No tienes una unidad asignada" icon={'\u{1F3E0}'} />;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text className="text-xl font-bold text-gray-900 mb-6">Mi Unidad</Text>

      {occupancies.map((occupancy) => {
        const unit = occupancy.units as {
          id: string;
          unit_number: string;
          building: string | null;
          floor_number: number | null;
        } | null;

        return (
          <View key={occupancy.id} className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            {/* Unit info */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900">
                {unit?.unit_number ?? 'Sin unidad'}
              </Text>
              <StatusBadge
                status={occupancy.occupancy_type}
                variants={OCCUPANCY_TYPE_VARIANTS}
              />
            </View>

            {unit?.building ? (
              <View className="flex-row mb-2">
                <Text className="text-sm text-gray-500 w-24">Edificio:</Text>
                <Text className="text-sm text-gray-900">{unit.building}</Text>
              </View>
            ) : null}

            {unit?.floor_number != null ? (
              <View className="flex-row mb-2">
                <Text className="text-sm text-gray-500 w-24">Piso:</Text>
                <Text className="text-sm text-gray-900">{unit.floor_number}</Text>
              </View>
            ) : null}

            <View className="flex-row mb-2">
              <Text className="text-sm text-gray-500 w-24">Tipo:</Text>
              <Text className="text-sm text-gray-900">
                {OCCUPANCY_TYPE_VARIANTS[occupancy.occupancy_type]?.label ?? occupancy.occupancy_type}
              </Text>
            </View>
          </View>
        );
      })}

      <View className="bg-blue-50 rounded-xl p-4 mt-2">
        <Text className="text-sm text-blue-800">
          Las asignaciones de unidad son administradas por la administracion.
          Si necesitas hacer un cambio, contacta a tu administrador.
        </Text>
      </View>
    </ScrollView>
  );
}
