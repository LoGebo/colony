import { useMemo } from 'react';
import { View, Text, SectionList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyDocuments, usePendingSignatures } from '@/hooks/useDocuments';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

const CATEGORY_LABELS: Record<string, string> = {
  regulation: 'Reglamentos',
  policy: 'Politicas',
  guideline: 'Guias',
  form: 'Formularios',
  template: 'Plantillas',
  report: 'Reportes',
  other: 'Otros',
};

export default function DocumentsListScreen() {
  const router = useRouter();
  const { data: documents, isLoading, isRefetching, refetch } = useMyDocuments();
  const { data: pendingSignatures } = usePendingSignatures();

  const pendingIds = useMemo(
    () => new Set((pendingSignatures ?? []).map((p) => p.id)),
    [pendingSignatures],
  );

  const sections = useMemo(() => {
    if (!documents) return [];

    const result: Array<{ title: string; data: typeof documents; isPending?: boolean }> = [];

    // Pending signatures section at the top
    if (pendingSignatures && pendingSignatures.length > 0) {
      result.push({
        title: 'Pendientes de Firma',
        data: pendingSignatures.map((p) => ({
          ...p,
          is_public: false,
          requires_signature: true,
          is_signed: false,
          created_at: '',
        })),
        isPending: true,
      });
    }

    // Group remaining documents by category
    const byCategory: Record<string, typeof documents> = {};
    for (const doc of documents) {
      // Skip pending docs from the main list to avoid duplicates
      if (pendingIds.has(doc.id)) continue;
      const cat = doc.category ?? 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(doc);
    }

    // Add category sections in order
    const categoryOrder = ['regulation', 'policy', 'guideline', 'form', 'template', 'report', 'other'];
    for (const cat of categoryOrder) {
      if (byCategory[cat] && byCategory[cat].length > 0) {
        result.push({
          title: CATEGORY_LABELS[cat] ?? cat,
          data: byCategory[cat],
        });
      }
    }

    return result;
  }, [documents, pendingSignatures, pendingIds]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando documentos..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900">Documentos</Text>
        {pendingSignatures && pendingSignatures.length > 0 ? (
          <Text className="text-sm text-orange-600 mt-1">
            {pendingSignatures.length} documento(s) pendiente(s) de firma
          </Text>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderSectionHeader={({ section }) => (
          <View
            className={`py-2 mt-2 ${
              (section as typeof sections[number]).isPending ? 'bg-orange-50 rounded-lg px-3 mb-1' : ''
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                (section as typeof sections[number]).isPending ? 'text-orange-700' : 'text-gray-500'
              }`}
            >
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <DocumentCard
            document={item}
            onPress={() => router.push(`/(resident)/more/documents/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState message="No hay documentos disponibles" icon={'\u{1F4C4}'} />
        }
      />
    </View>
  );
}
