import { View, Text, Pressable } from 'react-native';

const CATEGORY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  regulation: { bg: 'bg-red-100', text: 'text-red-800', label: 'Reglamento' },
  policy: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Politica' },
  guideline: { bg: 'bg-green-100', text: 'text-green-800', label: 'Guia' },
  form: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Formulario' },
  template: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Plantilla' },
  report: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Reporte' },
  other: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Otro' },
};

interface DocumentCardProps {
  document: {
    id: string;
    name: string;
    description?: string | null;
    category: string;
    is_public: boolean;
    requires_signature?: boolean;
    is_signed?: boolean;
  };
  onPress: () => void;
}

export function DocumentCard({ document, onPress }: DocumentCardProps) {
  const categoryBadge = CATEGORY_BADGES[document.category] ?? CATEGORY_BADGES.other;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-2 shadow-sm active:opacity-80"
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-base font-semibold text-gray-900 flex-1 mr-2" numberOfLines={2}>
          {document.name}
        </Text>
        <View className={`${categoryBadge.bg} rounded-full px-2 py-0.5`}>
          <Text className={`${categoryBadge.text} text-xs font-medium`}>
            {categoryBadge.label}
          </Text>
        </View>
      </View>

      {document.description ? (
        <Text className="text-sm text-gray-500 mb-2" numberOfLines={2}>
          {document.description}
        </Text>
      ) : null}

      <View className="flex-row items-center gap-2">
        {document.is_public ? (
          <View className="bg-gray-100 rounded-full px-2 py-0.5">
            <Text className="text-gray-600 text-xs">Publico</Text>
          </View>
        ) : null}

        {document.requires_signature ? (
          document.is_signed ? (
            <View className="bg-green-100 rounded-full px-2 py-0.5">
              <Text className="text-green-800 text-xs font-medium">Firmado</Text>
            </View>
          ) : (
            <View className="bg-orange-100 rounded-full px-2 py-0.5">
              <Text className="text-orange-800 text-xs font-medium">Firma requerida</Text>
            </View>
          )
        ) : null}
      </View>
    </Pressable>
  );
}
