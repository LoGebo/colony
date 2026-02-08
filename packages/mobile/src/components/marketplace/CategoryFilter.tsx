import { ScrollView, Pressable, Text } from 'react-native';

const CATEGORIES = [
  { label: 'Todos', value: null },
  { label: 'Venta', value: 'sale' },
  { label: 'Servicio', value: 'service' },
  { label: 'Renta', value: 'rental' },
  { label: 'Buscado', value: 'wanted' },
] as const;

interface CategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}
    >
      {CATEGORIES.map((cat) => {
        const isActive = selectedCategory === cat.value;
        return (
          <Pressable
            key={cat.label}
            onPress={() => onCategoryChange(cat.value)}
            className={`rounded-full px-4 py-2 ${
              isActive ? 'bg-blue-600' : 'bg-white border border-gray-300'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isActive ? 'text-white' : 'text-gray-700'
              }`}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
