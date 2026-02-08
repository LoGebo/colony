import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { usePendingSignatures } from '@/hooks/useDocuments';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

export default function MoreMenuScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { unitNumber, building } = useResidentUnit();
  const { data: pendingSignatures } = usePendingSignatures();

  const pendingCount = pendingSignatures?.length ?? 0;

  const menuItems: MenuItem[] = [
    { label: 'Mi Perfil', icon: '\u{1F464}', route: '/(resident)/more/profile' },
    { label: 'Mi Unidad', icon: '\u{1F3E0}', route: '/(resident)/more/profile/unit' },
    { label: 'Mis Vehiculos', icon: '\u{1F697}', route: '/(resident)/more/vehicles' },
    { label: 'Documentos', icon: '\u{1F4C4}', route: '/(resident)/more/documents', badge: pendingCount },
    { label: 'Marketplace', icon: '\u{1F6D2}', route: '/(resident)/more/marketplace' },
    { label: 'Mis Paquetes', icon: '\u{1F4E6}', route: '/(resident)/more/packages' },
  ];

  const unitLabel = building
    ? `${building} - ${unitNumber}`
    : unitNumber ?? '';

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header */}
      <View className="px-4 pt-4 pb-6">
        <Text className="text-xl font-bold text-gray-900">Mas</Text>
        {unitLabel ? (
          <Text className="text-sm text-gray-500 mt-1">{unitLabel}</Text>
        ) : null}
      </View>

      {/* Menu items */}
      <View className="px-4">
        {menuItems.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as never)}
            className="flex-row items-center bg-white rounded-xl px-4 py-4 mb-2 shadow-sm active:opacity-80"
          >
            <Text className="text-xl mr-3">{item.icon}</Text>
            <Text className="flex-1 text-base text-gray-900 font-medium">
              {item.label}
            </Text>
            {item.badge && item.badge > 0 ? (
              <View className="bg-orange-500 rounded-full px-2 py-0.5 mr-2">
                <Text className="text-white text-xs font-bold">{item.badge}</Text>
              </View>
            ) : null}
            <Text className="text-gray-400 text-lg">{'\u{203A}'}</Text>
          </Pressable>
        ))}
      </View>

      {/* Sign out */}
      <View className="px-4 mt-8">
        <Pressable
          onPress={signOut}
          className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 items-center active:opacity-80"
        >
          <Text className="text-red-600 font-semibold">Cerrar Sesion</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
