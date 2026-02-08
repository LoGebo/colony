import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { STORAGE_BUCKETS } from '@upoe/shared';
import { useAuth } from '@/hooks/useAuth';
import { useLogAccess, useBlacklistCheck } from '@/hooks/useGateOps';
import { BlacklistAlert } from '@/components/guard/BlacklistAlert';
import { SectionCard } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { formatTime, formatDate } from '@/lib/dates';
import { pickAndUploadImage } from '@/lib/upload';

export default function VisitorResultScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const params = useLocalSearchParams<{
    qrId: string;
    communityId: string;
    invitationId: string;
    visitorName: string;
    valid: string;
  }>();

  const isValid = params.valid === 'true';
  const logAccess = useLogAccess();
  const [actionTaken, setActionTaken] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Fetch invitation details
  const { data: invitation, isLoading: invitationLoading } = useQuery({
    queryKey: ['gate-verification', params.invitationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select(
          '*, units(unit_number), residents:created_by_resident_id(first_name, paternal_surname)'
        )
        .eq('id', params.invitationId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!params.invitationId,
  });

  // Blacklist check on visitor name
  const blacklistCheck = useBlacklistCheck({
    communityId: communityId ?? '',
    personName: params.visitorName || undefined,
  });

  const handleTakePhoto = useCallback(async () => {
    if (!communityId) return;
    const path = await pickAndUploadImage(
      STORAGE_BUCKETS.INCIDENT_EVIDENCE,
      communityId,
      'visitor-photos'
    );
    if (path) {
      setPhotoUrl(path);
    }
  }, [communityId]);

  const handleAction = useCallback(
    (direction: 'entry' | 'exit', decision: 'allowed' | 'denied') => {
      if (actionTaken) return;

      logAccess.mutate(
        {
          invitation_id: params.invitationId || undefined,
          qr_code_id: params.qrId || undefined,
          person_name: params.visitorName ?? 'Desconocido',
          person_type: 'visitor',
          direction,
          method: 'qr_scan',
          decision,
          photo_url: photoUrl ?? undefined,
        },
        {
          onSuccess: () => {
            setActionTaken(true);
            const actionLabel =
              decision === 'denied'
                ? 'Acceso denegado'
                : direction === 'entry'
                  ? 'Entrada registrada'
                  : 'Salida registrada';
            Alert.alert('Registrado', actionLabel, [
              {
                text: 'OK',
                onPress: () => {
                  // Go back twice: result -> scan -> gate dashboard
                  router.back();
                  router.back();
                },
              },
            ]);
          },
          onError: (error) => {
            Alert.alert('Error', error.message);
          },
        }
      );
    },
    [actionTaken, logAccess, params, photoUrl, router]
  );

  // Resident info from invitation
  const residentInfo = invitation?.residents as {
    first_name: string;
    paternal_surname: string;
  } | null;
  const unitInfo = invitation?.units as { unit_number: string } | null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-5">
        {/* Back button */}
        <Pressable onPress={() => router.back()} className="mb-4">
          <Text className="text-blue-600 text-base">Volver</Text>
        </Pressable>

        {/* Result Banner */}
        {isValid ? (
          <View className="bg-green-500 rounded-xl p-6 items-center mb-4">
            <Text className="text-4xl mb-2">{'OK'}</Text>
            <Text className="text-white text-xl font-bold">
              ACCESO PERMITIDO
            </Text>
            <Text className="text-green-100 text-base mt-1">
              {params.visitorName}
            </Text>
          </View>
        ) : (
          <View className="bg-red-500 rounded-xl p-6 items-center mb-4">
            <Text className="text-4xl mb-2">{'X'}</Text>
            <Text className="text-white text-xl font-bold">
              ACCESO DENEGADO
            </Text>
            <Text className="text-red-100 text-base mt-1">
              Codigo QR invalido o expirado
            </Text>
          </View>
        )}

        {/* Blacklist Alert */}
        {blacklistCheck.data?.is_blocked ? (
          <BlacklistAlert blacklistResult={blacklistCheck.data} />
        ) : null}

        {/* Visitor Details */}
        {invitationLoading ? (
          <ActivityIndicator className="my-4" />
        ) : invitation ? (
          <SectionCard className="mb-4">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Detalles del visitante
            </Text>

            <View className="mb-2">
              <Text className="text-sm text-gray-500">Nombre</Text>
              <Text className="text-base text-gray-900">
                {invitation.visitor_name}
              </Text>
            </View>

            {unitInfo ? (
              <View className="mb-2">
                <Text className="text-sm text-gray-500">Unidad</Text>
                <Text className="text-base text-gray-900">
                  {unitInfo.unit_number}
                </Text>
              </View>
            ) : null}

            {residentInfo ? (
              <View className="mb-2">
                <Text className="text-sm text-gray-500">Invitado por</Text>
                <Text className="text-base text-gray-900">
                  {residentInfo.first_name} {residentInfo.paternal_surname}
                </Text>
              </View>
            ) : null}

            <View className="mb-2">
              <Text className="text-sm text-gray-500">Tipo de invitacion</Text>
              <Text className="text-base text-gray-900">
                {invitation.invitation_type}
              </Text>
            </View>

            {invitation.valid_from ? (
              <View className="mb-2">
                <Text className="text-sm text-gray-500">Ventana de acceso</Text>
                <Text className="text-base text-gray-900">
                  {formatDate(invitation.valid_from)}{' '}
                  {formatTime(invitation.valid_from)}
                  {invitation.valid_until
                    ? ` - ${formatTime(invitation.valid_until)}`
                    : ''}
                </Text>
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        {/* Photo capture */}
        <Pressable
          onPress={handleTakePhoto}
          className="bg-gray-100 border border-dashed border-gray-300 rounded-lg py-4 items-center mb-4 active:opacity-80"
        >
          <Text className="text-gray-600 text-sm">
            {photoUrl
              ? 'Foto capturada - Tomar otra'
              : 'Tomar foto del visitante'}
          </Text>
        </Pressable>

        {/* Action Buttons */}
        {!actionTaken ? (
          <View className="gap-3 mb-8">
            {isValid ? (
              <>
                <Pressable
                  onPress={() => handleAction('entry', 'allowed')}
                  disabled={logAccess.isPending}
                  className={`rounded-xl py-4 items-center ${
                    logAccess.isPending ? 'bg-gray-300' : 'bg-green-600 active:opacity-80'
                  }`}
                >
                  <Text className="text-white font-bold text-base">
                    {logAccess.isPending
                      ? 'Registrando...'
                      : 'Registrar Entrada'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleAction('exit', 'allowed')}
                  disabled={logAccess.isPending}
                  className={`rounded-xl py-4 items-center ${
                    logAccess.isPending ? 'bg-gray-300' : 'bg-blue-600 active:opacity-80'
                  }`}
                >
                  <Text className="text-white font-bold text-base">
                    Registrar Salida
                  </Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              onPress={() => handleAction('entry', 'denied')}
              disabled={logAccess.isPending}
              className={`rounded-xl py-4 items-center ${
                logAccess.isPending ? 'bg-gray-300' : 'bg-red-600 active:opacity-80'
              }`}
            >
              <Text className="text-white font-bold text-base">
                Denegar Acceso
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="bg-gray-100 rounded-xl p-6 items-center mb-8">
            <Text className="text-gray-500 text-base">
              Accion registrada exitosamente
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
