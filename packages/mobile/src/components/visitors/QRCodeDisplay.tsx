import { useRef, useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, Linking, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatDateTime } from '@/lib/dates';

interface QRCodeDisplayProps {
  payload: string;
  visitorName: string;
  communityName: string;
  validUntil?: string;
}

export function QRCodeDisplay({
  payload,
  visitorName,
  communityName,
  validUntil,
}: QRCodeDisplayProps) {
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);

    try {
      // Extract base64 from QR code SVG ref
      const base64 = await new Promise<string>((resolve, reject) => {
        if (!qrRef.current) {
          reject(new Error('QR ref not available'));
          return;
        }
        qrRef.current.toDataURL((data: string) => {
          // Strip newlines -- react-native-qrcode-svg quirk
          resolve(data.replace(/\n/g, ''));
        });
      });

      // Write base64 to a temp file using expo-file-system v19 API
      const file = new File(Paths.cache, 'qr-invitation.png');
      file.write(base64, { encoding: 'base64' });
      const fileUri = file.uri;

      const message = `Te invito a ${communityName}. Visitante: ${visitorName}`;

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir invitacion',
        });
      } else {
        // Fallback: try WhatsApp deep link, then native share
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
        const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

        if (canOpenWhatsApp) {
          await Linking.openURL(whatsappUrl);
        } else {
          await Share.share({ message });
        }
      }
    } catch {
      Alert.alert('Error', 'No se pudo compartir la invitacion');
    } finally {
      setSharing(false);
    }
  }, [sharing, communityName, visitorName]);

  return (
    <View className="items-center py-6">
      <View className="bg-white rounded-2xl p-6 shadow-sm items-center">
        <QRCode
          value={payload}
          size={220}
          getRef={(ref) => {
            qrRef.current = ref as typeof qrRef.current;
          }}
        />

        <Text className="text-lg font-semibold text-gray-900 mt-4 text-center">
          {visitorName}
        </Text>

        {validUntil ? (
          <Text className="text-sm text-gray-500 mt-1">
            Valido hasta: {formatDateTime(validUntil)}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={handleShare}
        disabled={sharing}
        className="bg-green-500 rounded-lg px-6 py-3 mt-6 active:opacity-80"
      >
        <Text className="text-white font-semibold text-base text-center">
          {sharing ? 'Compartiendo...' : 'Compartir'}
        </Text>
      </Pressable>
    </View>
  );
}
