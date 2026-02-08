import { useState } from 'react';
import { View, Text, Pressable, Modal, Alert, ActivityIndicator } from 'react-native';
import { useSignDocument } from '@/hooks/useDocuments';

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  documentName: string;
  documentId: string;
  documentVersionId: string;
}

const CONSENT_TEXT = 'He leido y acepto el contenido de este documento';

export function SignatureModal({
  visible,
  onClose,
  documentName,
  documentId,
  documentVersionId,
}: SignatureModalProps) {
  const [consented, setConsented] = useState(false);
  const { mutate: signDocument, isPending } = useSignDocument();

  const handleSign = () => {
    signDocument(
      {
        document_id: documentId,
        document_version_id: documentVersionId,
        consent_text: CONSENT_TEXT,
      },
      {
        onSuccess: () => {
          setConsented(false);
          onClose();
          Alert.alert('Exito', 'Documento firmado exitosamente');
        },
        onError: (err) => {
          Alert.alert('Error', err.message);
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-2xl p-6">
          <Text className="text-lg font-bold text-gray-900 mb-2">Firmar Documento</Text>
          <Text className="text-sm text-gray-600 mb-4">{documentName}</Text>

          {/* Consent checkbox */}
          <Pressable
            onPress={() => setConsented(!consented)}
            className="flex-row items-start mb-6"
          >
            <View
              className={`w-5 h-5 rounded border-2 mr-3 mt-0.5 items-center justify-center ${
                consented ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
              }`}
            >
              {consented ? (
                <Text className="text-white text-xs font-bold">{'\u{2713}'}</Text>
              ) : null}
            </View>
            <Text className="flex-1 text-sm text-gray-700">{CONSENT_TEXT}</Text>
          </Pressable>

          {/* Buttons */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setConsented(false);
                onClose();
              }}
              className="flex-1 rounded-lg p-3 items-center bg-gray-200 active:opacity-80"
            >
              <Text className="text-gray-700 font-medium">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSign}
              disabled={!consented || isPending}
              className={`flex-1 rounded-lg p-3 items-center ${
                consented && !isPending
                  ? 'bg-blue-600 active:opacity-80'
                  : 'bg-gray-300'
              }`}
            >
              {isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text
                  className={`font-semibold ${
                    consented ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  Firmar Documento
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
