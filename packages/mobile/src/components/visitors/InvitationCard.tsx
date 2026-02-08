import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { VisitorStatusBadge } from './VisitorStatusBadge';
import { formatDateTime } from '@/lib/dates';

const TYPE_LABELS: Record<string, string> = {
  single_use: 'Unica vez',
  recurring: 'Recurrente',
  event: 'Evento',
  vehicle_preauth: 'Vehiculo',
};

interface InvitationCardProps {
  invitation: {
    id: string;
    visitor_name: string;
    invitation_type: string;
    status: string;
    valid_from: string;
    valid_until: string | null;
    qr_codes: unknown[];
    units: { unit_number: string } | null;
  };
  onPress: () => void;
}

function InvitationCardInner({ invitation, onPress }: InvitationCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm active:opacity-80"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-semibold text-gray-900 text-base flex-1" numberOfLines={1}>
          {invitation.visitor_name}
        </Text>
        <VisitorStatusBadge status={invitation.status} />
      </View>

      {invitation.valid_from ? (
        <Text className="text-sm text-gray-600 mb-1">
          {formatDateTime(invitation.valid_from)}
        </Text>
      ) : null}

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">
          {TYPE_LABELS[invitation.invitation_type] ?? invitation.invitation_type}
        </Text>
        {invitation.units ? (
          <Text className="text-sm text-gray-500">
            {invitation.units.unit_number}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const InvitationCard = React.memo(InvitationCardInner);
