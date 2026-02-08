import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useInvitationDetail, useCancelInvitation } from '@/hooks/useVisitors';
import { useCommunityBranding } from '@/hooks/useCommunity';
import { QRCodeDisplay } from '@/components/visitors/QRCodeDisplay';
import { VisitorStatusBadge } from '@/components/visitors/VisitorStatusBadge';
import { SectionCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDateTime, formatTime, DAY_LABELS } from '@/lib/dates';

const TYPE_LABELS: Record<string, string> = {
  single_use: 'Unica vez',
  recurring: 'Recurrente',
  event: 'Evento',
  vehicle_preauth: 'Vehiculo',
};

export default function InvitationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { communityId } = useAuth();
  const { data: invitation, isLoading, error } = useInvitationDetail(id ?? '');
  const { data: community } = useCommunityBranding(communityId);
  const { mutate: cancelInvitation, isPending: isCancelling } = useCancelInvitation();

  if (isLoading) {
    return <LoadingSpinner message="Cargando invitacion..." />;
  }

  if (error || !invitation) {
    return <EmptyState message="Invitacion no encontrada" />;
  }

  // Get the first QR code if available
  const qrCodes = invitation.qr_codes as Array<{
    id: string;
    payload: string;
    status: string;
  }>;
  const qr = qrCodes?.[0] ?? null;

  // TODO: Replace with server-side HMAC-signed payload when QR_HMAC_SECRET is configured
  const fallbackPayload = JSON.stringify({
    invitation_id: invitation.id,
    community_id: invitation.community_id,
    created_at: new Date(invitation.created_at).getTime(),
  });

  const canCancel = invitation.status === 'pending' || invitation.status === 'approved';

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Invitacion',
      'Esta seguro que desea cancelar esta invitacion? Esta accion no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, cancelar',
          style: 'destructive',
          onPress: () => {
            cancelInvitation(invitation.id, {
              onSuccess: () => {
                router.back();
              },
              onError: (err) => {
                Alert.alert('Error', err.message);
              },
            });
          },
        },
      ],
    );
  };

  const unit = invitation.units as { unit_number: string } | null;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 32 }}>
      {/* QR Code Section */}
      {qr ? (
        <QRCodeDisplay
          payload={qr.payload || fallbackPayload}
          visitorName={invitation.visitor_name}
          communityName={community?.name ?? 'Tu comunidad'}
          validUntil={invitation.valid_until ?? undefined}
        />
      ) : (
        <View className="items-center py-8">
          <Text className="text-gray-400 text-base">QR no disponible</Text>
        </View>
      )}

      {/* Invitation Details */}
      <View className="px-4">
        <SectionCard className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-gray-900">
              {invitation.visitor_name}
            </Text>
            <VisitorStatusBadge status={invitation.status} />
          </View>

          {invitation.visitor_phone ? (
            <DetailRow label="Telefono" value={invitation.visitor_phone} />
          ) : null}

          {invitation.vehicle_plate ? (
            <DetailRow label="Placas" value={invitation.vehicle_plate} />
          ) : null}

          <DetailRow
            label="Tipo"
            value={TYPE_LABELS[invitation.invitation_type] ?? invitation.invitation_type}
          />

          <DetailRow
            label="Desde"
            value={formatDateTime(invitation.valid_from)}
          />

          {invitation.valid_until ? (
            <DetailRow
              label="Hasta"
              value={formatDateTime(invitation.valid_until)}
            />
          ) : null}

          {unit ? (
            <DetailRow label="Unidad" value={unit.unit_number} />
          ) : null}
        </SectionCard>

        {/* Recurring info */}
        {invitation.invitation_type === 'recurring' && invitation.recurring_days ? (
          <SectionCard className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Dias recurrentes
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {(invitation.recurring_days as number[]).map((day) => (
                <View key={day} className="bg-blue-100 rounded-full px-3 py-1">
                  <Text className="text-blue-800 text-xs font-medium">
                    {DAY_LABELS[day] ?? `Dia ${day}`}
                  </Text>
                </View>
              ))}
            </View>

            {invitation.recurring_start_time || invitation.recurring_end_time ? (
              <Text className="text-sm text-gray-600">
                {invitation.recurring_start_time
                  ? formatTime(invitation.recurring_start_time)
                  : '--:--'}
                {' - '}
                {invitation.recurring_end_time
                  ? formatTime(invitation.recurring_end_time)
                  : '--:--'}
              </Text>
            ) : null}
          </SectionCard>
        ) : null}

        {/* Cancel button */}
        {canCancel ? (
          <Pressable
            onPress={handleCancel}
            disabled={isCancelling}
            className="border-2 border-red-500 rounded-lg p-4 items-center active:opacity-80"
          >
            <Text className="text-red-500 font-semibold text-base">
              {isCancelling ? 'Cancelando...' : 'Cancelar Invitacion'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm text-gray-900 font-medium">{value}</Text>
    </View>
  );
}
