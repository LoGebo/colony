import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useUploadPaymentProof } from '@/hooks/usePayments';
import { pickAndUploadImage } from '@/lib/upload';
import { STORAGE_BUCKETS } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

export default function UploadProofScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { unitId } = useResidentUnit();
  const uploadMutation = useUploadPaymentProof();

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async () => {
    if (!communityId) return;
    setUploading(true);
    try {
      const path = await pickAndUploadImage(
        STORAGE_BUCKETS.PAYMENT_PROOFS,
        communityId,
        'receipts'
      );
      if (path) {
        setDocumentPath(path);
      }
    } finally {
      setUploading(false);
    }
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage
      .from(STORAGE_BUCKETS.PAYMENT_PROOFS)
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Ingresa un monto valido');
      return;
    }
    if (!paymentDate) {
      Alert.alert('Error', 'Ingresa la fecha de pago');
      return;
    }
    if (!documentPath) {
      Alert.alert('Error', 'Sube una imagen del comprobante');
      return;
    }
    if (!unitId) {
      Alert.alert('Error', 'No se encontro unidad asociada');
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        amount: parsedAmount,
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
        bank_name: bankName || undefined,
        document_url: documentPath,
        proof_type: 'bank_transfer',
        unit_id: unitId,
      });

      Alert.alert('Comprobante enviado', 'Tu comprobante sera revisado por administracion.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo enviar el comprobante. Intenta de nuevo.');
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text className="text-xl font-bold text-gray-900 mb-6">Subir Comprobante</Text>

        {/* Image Upload */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Imagen del comprobante *
          </Text>
          {documentPath ? (
            <View className="items-center">
              <Image
                source={{ uri: getPublicUrl(documentPath) }}
                className="w-full h-48 rounded-lg mb-2"
                resizeMode="cover"
              />
              <Pressable
                onPress={handlePickImage}
                className="active:opacity-70"
                disabled={uploading}
              >
                <Text className="text-blue-600 text-sm underline">
                  {uploading ? 'Subiendo...' : 'Cambiar imagen'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handlePickImage}
              disabled={uploading}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 items-center active:opacity-80"
            >
              <Text className="text-3xl mb-2">📷</Text>
              <Text className="text-gray-500 text-sm">
                {uploading ? 'Subiendo imagen...' : 'Toca para seleccionar imagen'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Amount */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Monto *</Text>
          <TextInput
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Payment Date */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Fecha de pago *</Text>
          <TextInput
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
            value={paymentDate}
            onChangeText={setPaymentDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Reference Number */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Numero de referencia
          </Text>
          <TextInput
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
            value={referenceNumber}
            onChangeText={setReferenceNumber}
            placeholder="Opcional"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Bank Name */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-1">Banco</Text>
          <TextInput
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
            value={bankName}
            onChangeText={setBankName}
            placeholder="Opcional"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Submit Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={uploadMutation.isPending || uploading}
          className={`rounded-lg px-4 py-3 items-center active:opacity-80 ${
            uploadMutation.isPending || uploading ? 'bg-gray-400' : 'bg-blue-600'
          }`}
        >
          <Text className="text-white font-semibold">
            {uploadMutation.isPending ? 'Enviando...' : 'Enviar Comprobante'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
