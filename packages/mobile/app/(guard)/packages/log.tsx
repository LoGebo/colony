import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { STORAGE_BUCKETS } from '@upoe/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUnitSearch } from '@/hooks/useDirectory';
import { useLogPackage } from '@/hooks/usePackages';
import { pickAndUploadImage } from '@/lib/upload';
import { supabase } from '@/lib/supabase';
import type { Database } from '@upoe/shared';

type PackageCarrier = Database['public']['Enums']['package_carrier'];

const CARRIERS: { value: PackageCarrier; label: string }[] = [
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'ups', label: 'UPS' },
  { value: 'estafeta', label: 'Estafeta' },
  { value: 'redpack', label: 'Redpack' },
  { value: 'mercado_libre', label: 'ML' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'correos_mexico', label: 'Correos' },
  { value: 'other', label: 'Otro' },
];

interface UnitOption {
  id: string;
  unit_number: string;
  building: string | null;
  occupancies: Array<{
    resident_id: string;
    residents: {
      id: string;
      first_name: string;
      paternal_surname: string;
      phone: string | null;
    } | null;
  }>;
}

export default function LogPackageScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const logPackage = useLogPackage();

  // Form state
  const [carrier, setCarrier] = useState<PackageCarrier | null>(null);
  const [carrierOther, setCarrierOther] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [recipientUnitId, setRecipientUnitId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [description, setDescription] = useState('');
  const [packageCount, setPackageCount] = useState('1');
  const [isOversized, setIsOversized] = useState(false);
  const [labelPhotoUrl, setLabelPhotoUrl] = useState<string | null>(null);

  // Unit search
  const [unitQuery, setUnitQuery] = useState('');
  const [debouncedUnitQuery, setDebouncedUnitQuery] = useState('');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [selectedUnitLabel, setSelectedUnitLabel] = useState('');

  // Debounce unit search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUnitQuery(unitQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [unitQuery]);

  const unitSearch = useUnitSearch(debouncedUnitQuery);

  const handleSelectUnit = useCallback((unit: UnitOption) => {
    setRecipientUnitId(unit.id);
    setSelectedUnitLabel(unit.unit_number);
    setUnitQuery(unit.unit_number);
    setShowUnitDropdown(false);

    // Auto-fill recipient name from first resident
    const firstResident = unit.occupancies?.[0]?.residents;
    if (firstResident) {
      setRecipientName(
        `${firstResident.first_name} ${firstResident.paternal_surname}`
      );
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!communityId) return;
    const path = await pickAndUploadImage(
      STORAGE_BUCKETS.DOCUMENT_FILES,
      communityId,
      'package-labels'
    );
    if (path) {
      setLabelPhotoUrl(path);
    }
  }, [communityId]);

  const handleSubmit = useCallback(() => {
    if (!carrier) {
      Alert.alert('Error', 'Selecciona una paqueteria');
      return;
    }
    if (!recipientUnitId) {
      Alert.alert('Error', 'Selecciona una unidad');
      return;
    }
    if (!recipientName.trim()) {
      Alert.alert('Error', 'Ingresa el nombre del destinatario');
      return;
    }

    logPackage.mutate(
      {
        carrier,
        carrier_other: carrier === 'other' ? carrierOther : undefined,
        tracking_number: trackingNumber || undefined,
        recipient_unit_id: recipientUnitId,
        recipient_name: recipientName.trim(),
        description: description || undefined,
        package_count: parseInt(packageCount, 10) || 1,
        is_oversized: isOversized,
        label_photo_url: labelPhotoUrl ?? undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Registrado', 'Paquete registrado exitosamente');
          router.back();
        },
        onError: (error) => {
          Alert.alert('Error', error.message);
        },
      }
    );
  }, [
    carrier,
    carrierOther,
    trackingNumber,
    recipientUnitId,
    recipientName,
    description,
    packageCount,
    isOversized,
    labelPhotoUrl,
    logPackage,
    router,
  ]);

  // Build photo thumbnail URL
  const photoThumbUri = labelPhotoUrl
    ? supabase.storage
        .from(STORAGE_BUCKETS.DOCUMENT_FILES)
        .getPublicUrl(labelPhotoUrl).data.publicUrl
    : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 p-5"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text className="text-2xl font-bold text-gray-900 mb-6">
            Registrar Paquete
          </Text>

          {/* Carrier picker */}
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Paqueteria *
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CARRIERS.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setCarrier(c.value)}
                className={`rounded-lg px-3 py-2 ${
                  carrier === c.value
                    ? 'bg-blue-600'
                    : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    carrier === c.value ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Carrier other */}
          {carrier === 'other' ? (
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Nombre de paqueteria
              </Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900"
                placeholder="Nombre..."
                placeholderTextColor="#9ca3af"
                value={carrierOther}
                onChangeText={setCarrierOther}
              />
            </View>
          ) : null}

          {/* Tracking number */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Numero de rastreo (opcional)
          </Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
            placeholder="Tracking..."
            placeholderTextColor="#9ca3af"
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            autoCapitalize="characters"
          />

          {/* Unit search */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Unidad destino *
          </Text>
          <View className="relative mb-4">
            <TextInput
              className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900"
              placeholder="Buscar unidad..."
              placeholderTextColor="#9ca3af"
              value={unitQuery}
              onChangeText={(text) => {
                setUnitQuery(text);
                setShowUnitDropdown(true);
                if (text !== selectedUnitLabel) {
                  setRecipientUnitId('');
                }
              }}
              onFocus={() => setShowUnitDropdown(true)}
            />
            {showUnitDropdown &&
              unitSearch.data &&
              unitSearch.data.length > 0 &&
              !recipientUnitId ? (
              <View className="bg-white rounded-xl shadow-md mt-1 max-h-48 overflow-hidden border border-gray-200">
                {(unitSearch.data as UnitOption[]).map((unit) => (
                  <Pressable
                    key={unit.id}
                    onPress={() => handleSelectUnit(unit)}
                    className="px-4 py-3 border-b border-gray-100 active:bg-gray-50"
                  >
                    <Text className="text-base text-gray-900">
                      {unit.unit_number}
                      {unit.building ? ` - ${unit.building}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Recipient name */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Nombre del destinatario *
          </Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
            placeholder="Nombre completo..."
            placeholderTextColor="#9ca3af"
            value={recipientName}
            onChangeText={setRecipientName}
          />

          {/* Description */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Descripcion (opcional)
          </Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
            placeholder="Descripcion del paquete..."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
          />

          {/* Package count */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Cantidad de paquetes
          </Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
            placeholder="1"
            placeholderTextColor="#9ca3af"
            value={packageCount}
            onChangeText={setPackageCount}
            keyboardType="number-pad"
          />

          {/* Oversized toggle */}
          <View className="flex-row items-center justify-between bg-gray-100 rounded-xl px-4 py-3 mb-4">
            <Text className="text-base text-gray-900">Sobredimensionado</Text>
            <Switch
              value={isOversized}
              onValueChange={setIsOversized}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={isOversized ? '#2563eb' : '#f3f4f6'}
            />
          </View>

          {/* Label photo */}
          <Pressable
            onPress={handleTakePhoto}
            className="bg-gray-100 rounded-xl px-4 py-3 mb-4 items-center active:opacity-80"
          >
            <Text className="text-blue-600 font-medium">
              {labelPhotoUrl ? 'Cambiar foto de etiqueta' : 'Foto de etiqueta'}
            </Text>
          </Pressable>

          {photoThumbUri ? (
            <View className="mb-4 items-center">
              <Image
                source={{ uri: photoThumbUri }}
                className="w-48 h-48 rounded-xl"
                resizeMode="cover"
              />
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={logPackage.isPending}
            className={`rounded-xl py-4 items-center ${
              logPackage.isPending ? 'bg-blue-400' : 'bg-blue-600 active:opacity-80'
            }`}
          >
            <Text className="text-white font-bold text-base">
              {logPackage.isPending ? 'Registrando...' : 'Registrar Paquete'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
