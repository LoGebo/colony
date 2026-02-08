import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDocumentDetail } from '@/hooks/useDocuments';
import { SignatureModal } from '@/components/documents/SignatureModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CATEGORY_LABELS: Record<string, string> = {
  regulation: 'Reglamento',
  policy: 'Politica',
  guideline: 'Guia',
  form: 'Formulario',
  template: 'Plantilla',
  report: 'Reporte',
  other: 'Otro',
};

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: doc, isLoading } = useDocumentDetail(id!);
  const [showSignModal, setShowSignModal] = useState(false);

  if (isLoading || !doc) {
    return <LoadingSpinner message="Cargando documento..." />;
  }

  const handleDownload = async () => {
    if (!doc.latestVersion) {
      Alert.alert('Error', 'No hay archivo disponible');
      return;
    }

    const { data } = supabase.storage
      .from(doc.latestVersion.storage_bucket)
      .getPublicUrl(doc.latestVersion.storage_path);

    if (data?.publicUrl) {
      await Linking.openURL(data.publicUrl);
    } else {
      // For private buckets, generate signed URL
      const { data: signedData, error } = await supabase.storage
        .from(doc.latestVersion.storage_bucket)
        .createSignedUrl(doc.latestVersion.storage_path, 3600);

      if (error || !signedData?.signedUrl) {
        Alert.alert('Error', 'No se pudo generar el enlace de descarga');
        return;
      }

      await Linking.openURL(signedData.signedUrl);
    }
  };

  const isSigned = !!doc.signature;
  const requiresSignature = doc.requires_signature;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text className="text-xl font-bold text-gray-900 mb-2">{doc.name}</Text>

      {/* Category and status */}
      <View className="flex-row items-center gap-2 mb-4">
        <View className="bg-blue-100 rounded-full px-2 py-0.5">
          <Text className="text-blue-800 text-xs font-medium">
            {CATEGORY_LABELS[doc.category] ?? doc.category}
          </Text>
        </View>
        {doc.is_public ? (
          <View className="bg-gray-100 rounded-full px-2 py-0.5">
            <Text className="text-gray-600 text-xs">Publico</Text>
          </View>
        ) : null}
      </View>

      {/* Description */}
      {doc.description ? (
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-sm text-gray-700">{doc.description}</Text>
        </View>
      ) : null}

      {/* Version info */}
      {doc.latestVersion ? (
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-sm font-semibold text-gray-900 mb-2">Archivo</Text>
          <View className="flex-row mb-1">
            <Text className="text-sm text-gray-500 w-24">Nombre:</Text>
            <Text className="text-sm text-gray-900 flex-1">{doc.latestVersion.file_name}</Text>
          </View>
          <View className="flex-row mb-1">
            <Text className="text-sm text-gray-500 w-24">Version:</Text>
            <Text className="text-sm text-gray-900">v{doc.latestVersion.version_number}</Text>
          </View>
          {doc.latestVersion.file_size_bytes ? (
            <View className="flex-row mb-1">
              <Text className="text-sm text-gray-500 w-24">Tamano:</Text>
              <Text className="text-sm text-gray-900">
                {(doc.latestVersion.file_size_bytes / 1024).toFixed(1)} KB
              </Text>
            </View>
          ) : null}
          <View className="flex-row mb-3">
            <Text className="text-sm text-gray-500 w-24">Subido:</Text>
            <Text className="text-sm text-gray-900">
              {format(new Date(doc.latestVersion.created_at), 'dd MMM yyyy', { locale: es })}
            </Text>
          </View>

          {doc.latestVersion.change_summary ? (
            <Text className="text-xs text-gray-500 italic">
              {doc.latestVersion.change_summary}
            </Text>
          ) : null}

          <Pressable
            onPress={handleDownload}
            className="bg-blue-600 rounded-lg px-4 py-2 items-center mt-3 active:opacity-80"
          >
            <Text className="text-white font-semibold">Descargar Documento</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Signature section */}
      {requiresSignature ? (
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-sm font-semibold text-gray-900 mb-2">Firma</Text>

          {isSigned ? (
            <View className="bg-green-50 rounded-lg p-3">
              <View className="flex-row items-center mb-1">
                <Text className="text-green-700 font-medium">{'\u{2705}'} Firmado</Text>
              </View>
              <Text className="text-xs text-green-600">
                Firmado el{' '}
                {format(new Date(doc.signature!.signed_at), "dd MMM yyyy 'a las' HH:mm", {
                  locale: es,
                })}
              </Text>
            </View>
          ) : (
            <View>
              <View className="bg-orange-50 rounded-lg p-3 mb-3">
                <Text className="text-orange-700 font-medium mb-1">Firma Requerida</Text>
                <Text className="text-xs text-orange-600">
                  Este documento requiere tu firma para confirmar que lo has leido y aceptado.
                </Text>
                {doc.signature_deadline ? (
                  <Text className="text-xs text-orange-800 mt-1 font-medium">
                    Fecha limite:{' '}
                    {format(new Date(doc.signature_deadline), 'dd MMM yyyy', { locale: es })}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => setShowSignModal(true)}
                className="bg-blue-600 rounded-lg px-4 py-3 items-center active:opacity-80"
              >
                <Text className="text-white font-semibold">Firmar Documento</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {/* Date info */}
      <View className="mt-2">
        <Text className="text-xs text-gray-400 text-center">
          Creado el {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: es })}
        </Text>
      </View>

      {/* Signature modal */}
      {requiresSignature && doc.latestVersion ? (
        <SignatureModal
          visible={showSignModal}
          onClose={() => setShowSignModal(false)}
          documentName={doc.name}
          documentId={doc.id}
          documentVersionId={doc.latestVersion.id}
        />
      ) : null}
    </ScrollView>
  );
}
