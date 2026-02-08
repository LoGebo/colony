import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { STORAGE_BUCKETS } from '@upoe/shared';
import { useAuth } from '@/hooks/useAuth';
import { useManualCheckIn, useBlacklistCheck } from '@/hooks/useGateOps';
import { BlacklistAlert } from '@/components/guard/BlacklistAlert';
import { pickAndUploadImage } from '@/lib/upload';

type Direction = 'entry' | 'exit';

export default function ManualCheckInScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const manualCheckIn = useManualCheckIn();

  // Form state
  const [visitorName, setVisitorName] = useState('');
  const [personDocument, setPersonDocument] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [direction, setDirection] = useState<Direction>('entry');
  const [guardNotes, setGuardNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Debounced values for blacklist check
  const [debouncedName, setDebouncedName] = useState('');
  const [debouncedPlate, setDebouncedPlate] = useState('');

  // Debounce visitor name
  useEffect(() => {
    if (visitorName.length < 3) {
      setDebouncedName('');
      return;
    }
    const timer = setTimeout(() => setDebouncedName(visitorName), 500);
    return () => clearTimeout(timer);
  }, [visitorName]);

  // Debounce vehicle plate
  useEffect(() => {
    if (vehiclePlate.length < 3) {
      setDebouncedPlate('');
      return;
    }
    const normalized = vehiclePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const timer = setTimeout(() => setDebouncedPlate(normalized), 500);
    return () => clearTimeout(timer);
  }, [vehiclePlate]);

  // Blacklist check
  const blacklistCheck = useBlacklistCheck({
    communityId: communityId ?? '',
    personName: debouncedName || undefined,
    plateNormalized: debouncedPlate || undefined,
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

  const handleSubmit = useCallback(() => {
    if (!visitorName.trim()) {
      Alert.alert('Error', 'El nombre del visitante es requerido');
      return;
    }

    const plateNormalized = vehiclePlate
      ? vehiclePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      : undefined;

    manualCheckIn.mutate(
      {
        person_name: visitorName.trim(),
        person_type: 'visitor',
        person_document: personDocument.trim() || undefined,
        vehicle_plate: plateNormalized,
        plate_detected: vehiclePlate.trim() || undefined,
        direction,
        method: 'manual',
        decision: blacklistCheck.data?.is_blocked ? 'denied' : 'allowed',
        photo_url: photoUrl ?? undefined,
        guard_notes: guardNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Registrado', 'Acceso registrado exitosamente', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (error) => {
          Alert.alert('Error', error.message);
        },
      }
    );
  }, [
    visitorName,
    personDocument,
    vehiclePlate,
    direction,
    guardNotes,
    photoUrl,
    blacklistCheck.data,
    manualCheckIn,
    router,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Pressable onPress={() => router.back()}>
              <Text className="text-blue-600 text-base">Cancelar</Text>
            </Pressable>
            <Text className="text-lg font-bold text-gray-900">
              Registro Manual
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Blacklist Alert */}
          {blacklistCheck.data?.is_blocked ? (
            <BlacklistAlert blacklistResult={blacklistCheck.data} />
          ) : null}

          {/* Direction Toggle */}
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Direccion
          </Text>
          <View className="flex-row gap-2 mb-5">
            <Pressable
              onPress={() => setDirection('entry')}
              className={`flex-1 rounded-lg py-3 items-center ${
                direction === 'entry'
                  ? 'bg-blue-600'
                  : 'bg-gray-100'
              }`}
            >
              <Text
                className={`font-semibold ${
                  direction === 'entry' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Entrada
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDirection('exit')}
              className={`flex-1 rounded-lg py-3 items-center ${
                direction === 'exit'
                  ? 'bg-blue-600'
                  : 'bg-gray-100'
              }`}
            >
              <Text
                className={`font-semibold ${
                  direction === 'exit' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Salida
              </Text>
            </Pressable>
          </View>

          {/* Visitor Name */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Nombre del visitante *
          </Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900"
            placeholder="Nombre completo"
            value={visitorName}
            onChangeText={setVisitorName}
            autoCapitalize="words"
          />

          {/* Document */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Documento de identidad
          </Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900"
            placeholder="INE, pasaporte, etc."
            value={personDocument}
            onChangeText={setPersonDocument}
            autoCapitalize="characters"
          />

          {/* Vehicle Plate */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Placa del vehiculo
          </Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900"
            placeholder="ABC-123-A"
            value={vehiclePlate}
            onChangeText={setVehiclePlate}
            autoCapitalize="characters"
          />

          {/* Guard Notes */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Notas del guardia
          </Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-900"
            placeholder="Observaciones adicionales..."
            value={guardNotes}
            onChangeText={setGuardNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />

          {/* Photo */}
          <Pressable
            onPress={handleTakePhoto}
            className="bg-gray-100 border border-dashed border-gray-300 rounded-lg py-4 items-center mb-4 active:opacity-80"
          >
            <Text className="text-gray-600 text-sm">
              {photoUrl ? 'Cambiar foto' : 'Tomar foto del visitante'}
            </Text>
          </Pressable>

          {photoUrl ? (
            <View className="mb-4 items-center">
              <View className="bg-green-100 rounded-lg px-3 py-2">
                <Text className="text-green-800 text-sm">
                  Foto capturada correctamente
                </Text>
              </View>
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={manualCheckIn.isPending || !visitorName.trim()}
            className={`rounded-xl py-4 items-center mb-8 ${
              manualCheckIn.isPending || !visitorName.trim()
                ? 'bg-gray-300'
                : blacklistCheck.data?.is_blocked
                  ? 'bg-red-600 active:opacity-80'
                  : 'bg-green-600 active:opacity-80'
            }`}
          >
            <Text className="text-white font-bold text-base">
              {manualCheckIn.isPending
                ? 'Registrando...'
                : blacklistCheck.data?.is_blocked
                  ? `Registrar ${direction === 'entry' ? 'Entrada' : 'Salida'} (BLOQUEADO)`
                  : `Registrar ${direction === 'entry' ? 'Entrada' : 'Salida'}`}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
