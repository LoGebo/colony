import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StatusBadge } from '@/components/ui/Badge';
import { formatRelative } from '@/lib/dates';

const PACKAGE_STATUS_VARIANTS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  received: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Recibido' },
  stored: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Almacenado' },
  notified: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Notificado' },
  pending_pickup: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'Pendiente recoleccion',
  },
  picked_up: { bg: 'bg-green-100', text: 'text-green-800', label: 'Entregado' },
};

const CARRIER_LABELS: Record<string, string> = {
  fedex: 'FedEx',
  dhl: 'DHL',
  ups: 'UPS',
  estafeta: 'Estafeta',
  redpack: 'Redpack',
  mercado_libre: 'Mercado Libre',
  amazon: 'Amazon',
  correos_mexico: 'Correos de Mexico',
  other: 'Otro',
};

interface PackageCardProps {
  pkg: {
    id: string;
    carrier: string;
    carrier_other: string | null;
    recipient_name: string;
    package_count: number;
    is_oversized: boolean;
    status: string;
    received_at: string;
    units: { unit_number: string; building: string | null } | null;
  };
  onPress: () => void;
}

function PackageCardInner({ pkg, onPress }: PackageCardProps) {
  const carrierLabel =
    pkg.carrier === 'other' && pkg.carrier_other
      ? pkg.carrier_other
      : CARRIER_LABELS[pkg.carrier] ?? pkg.carrier;

  const unitLabel = pkg.units?.unit_number ?? 'Sin unidad';

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm active:opacity-80"
    >
      {/* Top row: carrier + status */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-gray-900">
          {carrierLabel}
        </Text>
        <StatusBadge status={pkg.status} variants={PACKAGE_STATUS_VARIANTS} />
      </View>

      {/* Recipient + unit */}
      <Text className="text-sm text-gray-700">{pkg.recipient_name}</Text>
      <Text className="text-sm text-gray-500 mt-0.5">{unitLabel}</Text>

      {/* Package count + oversized */}
      <View className="flex-row items-center mt-2 gap-2">
        {pkg.package_count > 1 ? (
          <View className="bg-gray-100 rounded-md px-2 py-0.5">
            <Text className="text-xs text-gray-700 font-medium">
              {pkg.package_count} paquetes
            </Text>
          </View>
        ) : null}
        {pkg.is_oversized ? (
          <View className="bg-red-50 rounded-md px-2 py-0.5">
            <Text className="text-xs text-red-700 font-medium">
              Sobredimensionado
            </Text>
          </View>
        ) : null}
      </View>

      {/* Received time */}
      <Text className="text-xs text-gray-400 mt-2">
        {formatRelative(pkg.received_at)}
      </Text>
    </Pressable>
  );
}

export const PackageCard = React.memo(PackageCardInner);
