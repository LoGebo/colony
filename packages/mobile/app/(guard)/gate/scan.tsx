import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useVerifyQR } from '@/hooks/useGateOps';

export default function ScanScreen() {
  const router = useRouter();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const verifyQR = useVerifyQR();
  const [permission, requestPermission] = useCameraPermissions();

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanned || processing) return;
      setScanned(true);
      setProcessing(true);

      try {
        const result = await verifyQR.mutateAsync(data);

        if (result.valid && result.data) {
          router.push({
            pathname: '/(guard)/gate/visitor-result',
            params: {
              qrId: result.data.qr_code_id ?? '',
              communityId: result.data.community_id ?? '',
              invitationId: result.data.invitation_id ?? '',
              visitorName: result.data.visitor_name ?? '',
              valid: 'true',
            },
          });
        } else {
          Alert.alert(
            'Codigo Invalido',
            result.error ?? 'El codigo QR no es valido o ha expirado',
            [
              {
                text: 'Escanear otro',
                onPress: () => setScanned(false),
              },
            ]
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al verificar el codigo QR';
        Alert.alert('Error', message, [
          {
            text: 'Escanear otro',
            onPress: () => setScanned(false),
          },
        ]);
      } finally {
        setProcessing(false);
      }
    },
    [scanned, processing, verifyQR, router]
  );

  // Permission not yet determined
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center p-8">
        <Text className="text-white text-lg text-center mb-6">
          Se necesita permiso de camara para escanear codigos QR
        </Text>
        <Pressable
          onPress={requestPermission}
          className="bg-blue-600 rounded-xl px-8 py-4 active:opacity-80"
        >
          <Text className="text-white font-semibold text-base">
            Permitir Camara
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Camera */}
      <CameraView
        className="flex-1"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        {/* Overlay */}
        <View className="flex-1 items-center justify-center">
          {/* Top dark region */}
          <View className="flex-1 w-full bg-black/50" />

          {/* Center row */}
          <View className="flex-row items-center" style={{ height: 280 }}>
            <View className="flex-1 bg-black/50" />
            {/* Transparent viewfinder */}
            <View
              className="border-2 border-white/80 rounded-2xl"
              style={{ width: 280, height: 280 }}
            />
            <View className="flex-1 bg-black/50" />
          </View>

          {/* Bottom dark region */}
          <View className="flex-1 w-full bg-black/50 items-center pt-8">
            <Text className="text-white text-base mb-2">
              Apunta al codigo QR
            </Text>

            {processing ? (
              <ActivityIndicator color="#fff" className="mt-4" />
            ) : null}
          </View>
        </View>
      </CameraView>

      {/* Bottom controls */}
      <View className="bg-black px-6 py-4">
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 bg-gray-800 rounded-xl py-4 items-center active:opacity-80"
          >
            <Text className="text-white font-semibold">Volver</Text>
          </Pressable>

          {scanned ? (
            <Pressable
              onPress={() => setScanned(false)}
              className="flex-1 bg-blue-600 rounded-xl py-4 items-center active:opacity-80"
            >
              <Text className="text-white font-semibold">Escanear otro</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
