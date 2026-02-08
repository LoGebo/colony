import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { formatTime } from '@/lib/dates';

const TYPE_LABELS: Record<string, string> = {
  single_use: 'Unica vez',
  recurring: 'Recurrente',
  event: 'Evento',
  vehicle_preauth: 'Vehiculo',
};

interface VisitorQueueCardProps {
  visitor: {
    id: string;
    visitor_name: string;
    valid_from: string;
    valid_until: string | null;
    invitation_type: string;
    units: { unit_number: string } | null;
  };
  onPress?: () => void;
}

function VisitorQueueCardInner({ visitor, onPress }: VisitorQueueCardProps) {
  const timeWindow = visitor.valid_until
    ? `${formatTime(visitor.valid_from)} - ${formatTime(visitor.valid_until)}`
    : 'Todo el dia';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="bg-white rounded-lg p-4 mb-2 active:opacity-80"
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text
          className="font-semibold text-gray-900 text-base flex-1"
          numberOfLines={1}
        >
          {visitor.visitor_name}
        </Text>
        {visitor.units ? (
          <View className="bg-gray-100 rounded-md px-2 py-0.5 ml-2">
            <Text className="text-sm text-gray-400">
              {visitor.units.unit_number}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">{timeWindow}</Text>
        <View className="bg-blue-50 rounded-full px-2 py-0.5">
          <Text className="text-xs text-blue-700">
            {TYPE_LABELS[visitor.invitation_type] ?? visitor.invitation_type}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const VisitorQueueCard = React.memo(VisitorQueueCardInner);
