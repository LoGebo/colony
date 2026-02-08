import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePackageDetail, useConfirmPickup } from '@/hooks/usePackages';
import { SectionCard } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime, formatRelative } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKETS } from '@upoe/shared';

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
  forwarded: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Reenviado' },
  returned: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Devuelto' },
  abandoned: { bg: 'bg-red-100', text: 'text-red-800', label: 'Abandonado' },
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

// ---------- Timeline step ----------

function TimelineStep({
  label,
  date,
  isLast,
}: {
  label: string;
  date: string | null;
  isLast?: boolean;
}) {
  const completed = !!date;

  return (
    <View className="flex-row items-start mb-0">
      <View className="items-center mr-3">
        <View
          className={`w-3 h-3 rounded-full ${
            completed ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        />
        {!isLast ? (
          <View
            className={`w-0.5 h-6 ${
              completed ? 'bg-blue-300' : 'bg-gray-200'
            }`}
          />
        ) : null}
      </View>
      <View className="flex-1 pb-2">
        <Text
          className={`text-sm ${
            completed ? 'text-gray-900 font-medium' : 'text-gray-400'
          }`}
        >
          {label}
        </Text>
        {date ? (
          <Text className="text-xs text-gray-500 mt-0.5">
            {formatDateTime(date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------- Screen ----------

export default function PackageDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pkg, isLoading, error } = usePackageDetail(id ?? '');
  const confirmPickup = useConfirmPickup();
  const [pickupCode, setPickupCode] = useState('');

  const handleConfirmPickup = useCallback(() => {
    if (!id) return;

    // Check if code is required
    const activeCodes = (pkg?.package_pickup_codes as Array<{
      id: string;
      code_type: string;
      code_value: string;
      status: string;
      valid_until: string;
    }> | undefined)?.filter(
      (c) => c.status === 'active' && new Date(c.valid_until) > new Date()
    );

    const needsCode = activeCodes && activeCodes.length > 0;

    if (needsCode && !pickupCode.trim()) {
      Alert.alert('Error', 'Ingresa el codigo de recoleccion');
      return;
    }

    confirmPickup.mutate(
      {
        packageId: id,
        pickupCode: needsCode ? pickupCode.trim() : undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Entregado', 'Paquete marcado como entregado');
          router.back();
        },
        onError: (err) => {
          Alert.alert('Error', err.message);
        },
      }
    );
  }, [id, pkg, pickupCode, confirmPickup, router]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando paquete..." />;
  }

  if (error || !pkg) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <EmptyState message="No se encontro el paquete" />
      </SafeAreaView>
    );
  }

  const carrierLabel =
    pkg.carrier === 'other' && pkg.carrier_other
      ? pkg.carrier_other
      : CARRIER_LABELS[pkg.carrier] ?? pkg.carrier;

  const unitInfo = pkg.units as { unit_number: string; building: string | null } | null;
  const residentInfo = pkg.residents as {
    first_name: string;
    paternal_surname: string;
    phone: string | null;
  } | null;

  const pickupCodes = (pkg.package_pickup_codes as Array<{
    id: string;
    code_type: string;
    code_value: string;
    status: string;
    valid_until: string;
  }> | undefined) ?? [];

  const activeCodes = pickupCodes.filter(
    (c) => c.status === 'active' && new Date(c.valid_until) > new Date()
  );

  const isPickedUp = pkg.status === 'picked_up';

  // Build photo URLs
  const getPhotoUrl = (path: string | null) => {
    if (!path) return null;
    return supabase.storage
      .from(STORAGE_BUCKETS.DOCUMENT_FILES)
      .getPublicUrl(path).data.publicUrl;
  };

  const labelPhotoUri = getPhotoUrl(pkg.label_photo_url);
  const photoUri = getPhotoUrl(pkg.photo_url);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Package info */}
        <SectionCard className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900">{carrierLabel}</Text>
            <StatusBadge
              status={pkg.status}
              variants={PACKAGE_STATUS_VARIANTS}
            />
          </View>

          {pkg.tracking_number ? (
            <View className="mb-2">
              <Text className="text-xs text-gray-500">Rastreo</Text>
              <Text className="text-sm text-gray-900 font-medium">
                {pkg.tracking_number}
              </Text>
            </View>
          ) : null}

          <View className="mb-2">
            <Text className="text-xs text-gray-500">Destinatario</Text>
            <Text className="text-sm text-gray-900">{pkg.recipient_name}</Text>
          </View>

          {unitInfo ? (
            <View className="mb-2">
              <Text className="text-xs text-gray-500">Unidad</Text>
              <Text className="text-sm text-gray-900">
                {unitInfo.unit_number}
                {unitInfo.building ? ` - ${unitInfo.building}` : ''}
              </Text>
            </View>
          ) : null}

          {residentInfo ? (
            <View className="mb-2">
              <Text className="text-xs text-gray-500">Residente</Text>
              <Text className="text-sm text-gray-900">
                {residentInfo.first_name} {residentInfo.paternal_surname}
              </Text>
              {residentInfo.phone ? (
                <Text className="text-xs text-gray-500">{residentInfo.phone}</Text>
              ) : null}
            </View>
          ) : null}

          {pkg.description ? (
            <View className="mb-2">
              <Text className="text-xs text-gray-500">Descripcion</Text>
              <Text className="text-sm text-gray-900">{pkg.description}</Text>
            </View>
          ) : null}

          <View className="flex-row gap-3 mt-1">
            <View>
              <Text className="text-xs text-gray-500">Cantidad</Text>
              <Text className="text-sm text-gray-900">{pkg.package_count}</Text>
            </View>
            {pkg.is_oversized ? (
              <View className="bg-red-50 rounded-md px-2 py-0.5 self-end">
                <Text className="text-xs text-red-700 font-medium">
                  Sobredimensionado
                </Text>
              </View>
            ) : null}
          </View>
        </SectionCard>

        {/* Photos */}
        {(labelPhotoUri || photoUri) ? (
          <SectionCard className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Fotos</Text>
            <View className="flex-row gap-3">
              {labelPhotoUri ? (
                <Image
                  source={{ uri: labelPhotoUri }}
                  className="w-32 h-32 rounded-lg"
                  resizeMode="cover"
                />
              ) : null}
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  className="w-32 h-32 rounded-lg"
                  resizeMode="cover"
                />
              ) : null}
            </View>
          </SectionCard>
        ) : null}

        {/* Timeline */}
        <SectionCard className="mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-3">
            Historial
          </Text>
          <TimelineStep label="Recibido" date={pkg.received_at} />
          <TimelineStep label="Almacenado" date={pkg.stored_at} />
          <TimelineStep label="Notificado" date={pkg.notified_at} />
          <TimelineStep
            label="Entregado"
            date={pkg.picked_up_at}
            isLast
          />
        </SectionCard>

        {/* Pickup section */}
        {!isPickedUp ? (
          <SectionCard>
            <Text className="text-sm font-semibold text-gray-700 mb-3">
              Entrega
            </Text>

            {activeCodes.length > 0 ? (
              <>
                <Text className="text-sm text-gray-600 mb-2">
                  Codigo de recoleccion
                </Text>
                <TextInput
                  className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 mb-4 text-center tracking-widest"
                  placeholder="Ingresa el codigo..."
                  placeholderTextColor="#9ca3af"
                  value={pickupCode}
                  onChangeText={setPickupCode}
                  autoCapitalize="characters"
                  keyboardType="number-pad"
                />
                <Pressable
                  onPress={handleConfirmPickup}
                  disabled={confirmPickup.isPending}
                  className={`rounded-xl py-4 items-center ${
                    confirmPickup.isPending
                      ? 'bg-green-400'
                      : 'bg-green-600 active:opacity-80'
                  }`}
                >
                  <Text className="text-white font-bold text-base">
                    {confirmPickup.isPending
                      ? 'Verificando...'
                      : 'Verificar y Entregar'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleConfirmPickup}
                disabled={confirmPickup.isPending}
                className={`rounded-xl py-4 items-center ${
                  confirmPickup.isPending
                    ? 'bg-green-400'
                    : 'bg-green-600 active:opacity-80'
                }`}
              >
                <Text className="text-white font-bold text-base">
                  {confirmPickup.isPending
                    ? 'Procesando...'
                    : 'Confirmar Entrega'}
                </Text>
              </Pressable>
            )}
          </SectionCard>
        ) : (
          <SectionCard>
            <View className="items-center py-2">
              <View className="bg-green-100 rounded-full px-4 py-2 mb-2">
                <Text className="text-green-800 font-bold text-base">
                  Entregado
                </Text>
              </View>
              {pkg.picked_up_at ? (
                <Text className="text-sm text-gray-600">
                  {formatDateTime(pkg.picked_up_at)}
                </Text>
              ) : null}
              {pkg.picked_up_by ? (
                <Text className="text-xs text-gray-400 mt-0.5">
                  Entregado por: {pkg.picked_up_by}
                </Text>
              ) : null}
            </View>
          </SectionCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
