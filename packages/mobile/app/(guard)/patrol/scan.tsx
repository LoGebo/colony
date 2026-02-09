import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import * as Location from 'expo-location';
import { useAuth } from '@/hooks/useAuth';
import { usePatrolCheckpoints, useScanCheckpoint } from '@/hooks/usePatrol';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

/**
 * Normalize NFC serial: strip colons/spaces, uppercase.
 * e.g. "04:A2:E5:1A" -> "04A2E51A"
 */
function normalizeNfcSerial(serial: string): string {
  return serial.replace(/[:\s-]/g, '').toUpperCase();
}

export default function PatrolScanScreen() {
  const { patrolLogId, expectedCheckpointId, sequenceOrder } =
    useLocalSearchParams<{
      patrolLogId: string;
      expectedCheckpointId: string;
      sequenceOrder: string;
    }>();
  const { communityId } = useAuth();
  const router = useRouter();

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(true);
  const [nfcSupported, setNfcSupported] = useState(true);
  const cleanupRef = useRef(false);

  const { data: checkpoints } = usePatrolCheckpoints(communityId);
  const scanCheckpoint = useScanCheckpoint();

  // Request location permission on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();
        setHasLocationPermission(status === 'granted');
      } catch {
        setHasLocationPermission(false);
      }
    })();
  }, []);

  // Check NFC availability on mount
  useEffect(() => {
    (async () => {
      try {
        const supported = await NfcManager.isSupported();
        setNfcSupported(supported);
        if (supported) {
          await NfcManager.start();
        }
      } catch {
        setNfcSupported(false);
      }
    })();

    // Cleanup NFC on unmount
    return () => {
      cleanupRef.current = true;
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const handleScan = useCallback(async () => {
    if (!patrolLogId || !checkpoints) return;

    setScanState('scanning');
    setErrorMessage(null);

    let rawSerial = '';

    try {
      // 1. Read NFC tag
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      if (!tag?.id) {
        throw new Error('No se pudo leer el tag NFC');
      }

      rawSerial = tag.id;
      const normalizedSerial = normalizeNfcSerial(rawSerial);

      // 2. Get GPS location (best effort)
      let gpsLat: number | null = null;
      let gpsLng: number | null = null;
      let gpsAccuracy: number | null = null;

      if (hasLocationPermission) {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          gpsLat = location.coords.latitude;
          gpsLng = location.coords.longitude;
          gpsAccuracy = location.coords.accuracy ?? null;
        } catch {
          // GPS failed -- proceed without it
        }
      }

      // 3. Look up checkpoint by NFC serial
      const matched = checkpoints.find(
        (cp) =>
          cp.nfc_serial &&
          normalizeNfcSerial(cp.nfc_serial) === normalizedSerial
      );

      if (!matched) {
        throw new Error('Punto de control no reconocido');
      }

      // 4. Submit checkpoint scan
      const result = await scanCheckpoint.mutateAsync({
        patrolLogId,
        checkpointId: matched.id,
        nfcSerialScanned: rawSerial,
        gpsLat,
        gpsLng,
        gpsAccuracyMeters: gpsAccuracy,
        sequenceOrder: parseInt(sequenceOrder ?? '0', 10),
      });

      // 5. Show success
      setMatchedName(matched.name);
      setGpsStatus(
        result.gps_within_tolerance !== undefined
          ? (result.gps_within_tolerance as boolean | null)
          : gpsLat !== null
            ? null
            : null
      );
      setScanState('success');

      // 6. Auto-navigate back after delay
      if (!cleanupRef.current) {
        setTimeout(() => {
          if (!cleanupRef.current) {
            router.back();
          }
        }, 1500);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido al escanear';
      setErrorMessage(message);
      setScanState('error');
    } finally {
      // Cleanup NFC tech request
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {
        // Ignore cleanup errors
      }
    }
  }, [
    patrolLogId,
    checkpoints,
    hasLocationPermission,
    sequenceOrder,
    scanCheckpoint,
    router,
  ]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-gray-900">
            Escanear Punto
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="bg-gray-100 rounded-lg px-3 py-2"
          >
            <Text className="text-gray-700 font-medium">Cancelar</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {/* NFC not supported warning */}
        {!nfcSupported ? (
          <View className="items-center">
            <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-4">
              <Text className="text-3xl">{'!'}</Text>
            </View>
            <Text className="text-red-700 text-lg font-semibold text-center">
              NFC no disponible
            </Text>
            <Text className="text-gray-500 text-sm text-center mt-2">
              Este dispositivo no tiene NFC o no esta habilitado.
            </Text>
          </View>
        ) : scanState === 'idle' ? (
          /* Idle - ready to scan */
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-6">
              <Text className="text-4xl">{'NFC'}</Text>
            </View>
            <Text className="text-gray-800 text-lg font-semibold text-center mb-2">
              Acerca el telefono al punto de control NFC
            </Text>
            <Text className="text-gray-500 text-sm text-center mb-8">
              Presiona escanear y luego acerca el dispositivo al tag NFC del
              punto de control.
            </Text>

            {/* Location permission warning */}
            {!hasLocationPermission ? (
              <View className="bg-yellow-50 rounded-lg p-3 mb-4 w-full">
                <Text className="text-yellow-700 text-sm text-center">
                  Sin permiso de ubicacion. El escaneo funcionara pero sin
                  validacion GPS.
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleScan}
              className="bg-blue-600 rounded-xl py-4 px-12 active:bg-blue-700"
            >
              <Text className="text-white font-bold text-base">Escanear</Text>
            </Pressable>
          </View>
        ) : scanState === 'scanning' ? (
          /* Scanning in progress */
          <View className="items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-700 text-lg font-semibold mt-6 text-center">
              Escaneando...
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">
              Acerca el dispositivo al tag NFC
            </Text>
          </View>
        ) : scanState === 'success' ? (
          /* Success */
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-6">
              <Text className="text-4xl text-green-600">{'✓'}</Text>
            </View>
            <Text className="text-green-700 text-xl font-bold text-center">
              Punto Escaneado
            </Text>
            {matchedName ? (
              <Text className="text-gray-700 text-base mt-2 text-center">
                {matchedName}
              </Text>
            ) : null}

            {/* GPS status badge */}
            <View className="mt-4">
              {gpsStatus === true ? (
                <View className="bg-green-100 rounded-lg px-4 py-2">
                  <Text className="text-green-700 font-medium">GPS OK</Text>
                </View>
              ) : gpsStatus === false ? (
                <View className="bg-red-100 rounded-lg px-4 py-2">
                  <Text className="text-red-700 font-medium">
                    Fuera de rango GPS
                  </Text>
                </View>
              ) : (
                <View className="bg-yellow-100 rounded-lg px-4 py-2">
                  <Text className="text-yellow-700 font-medium">Sin GPS</Text>
                </View>
              )}
            </View>

            <Text className="text-gray-400 text-sm mt-4">
              Regresando automaticamente...
            </Text>
          </View>
        ) : (
          /* Error */
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-red-100 items-center justify-center mb-6">
              <Text className="text-4xl text-red-600">{'X'}</Text>
            </View>
            <Text className="text-red-700 text-xl font-bold text-center">
              Error al Escanear
            </Text>
            <Text className="text-gray-600 text-sm mt-2 text-center">
              {errorMessage}
            </Text>

            <Pressable
              onPress={() => {
                setScanState('idle');
                setErrorMessage(null);
              }}
              className="bg-blue-600 rounded-xl py-3 px-8 mt-6 active:bg-blue-700"
            >
              <Text className="text-white font-semibold">
                Intentar de nuevo
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              className="mt-3"
            >
              <Text className="text-gray-500 font-medium">Volver</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
