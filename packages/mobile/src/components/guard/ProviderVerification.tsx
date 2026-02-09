import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  useProviderAccessCheck,
  useProviderPersonnelSearch,
} from '@/hooks/useEmergency';

// ---------- Types ----------

interface AccessResult {
  personnelId: string;
  allowed: boolean | null;
  checking: boolean;
}

// ---------- Component ----------

/**
 * Self-contained provider access verification component.
 * - Search input for provider personnel by name
 * - Results list with company name, position
 * - "Verificar Acceso" button per result that calls is_provider_access_allowed RPC
 * - Shows green "Acceso Autorizado" or red "Acceso Denegado" badge
 */
function ProviderVerificationInner() {
  const { communityId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [accessResults, setAccessResults] = useState<
    Record<string, AccessResult>
  >({});

  const { data: personnel, isLoading: isSearching } =
    useProviderPersonnelSearch(searchQuery, communityId);

  const accessCheck = useProviderAccessCheck();

  const handleCheckAccess = useCallback(
    async (personnelId: string, providerId: string) => {
      setAccessResults((prev) => ({
        ...prev,
        [personnelId]: { personnelId, allowed: null, checking: true },
      }));

      try {
        const allowed = await accessCheck.mutateAsync(providerId);
        setAccessResults((prev) => ({
          ...prev,
          [personnelId]: { personnelId, allowed, checking: false },
        }));
      } catch {
        setAccessResults((prev) => ({
          ...prev,
          [personnelId]: { personnelId, allowed: null, checking: false },
        }));
      }
    },
    [accessCheck]
  );

  const renderPersonnel = useCallback(
    ({
      item,
    }: {
      item: {
        id: string;
        first_name: string;
        last_name: string;
        position: string | null;
        photo_url: string | null;
        provider_id: string;
        providers: {
          id: string;
          company_name: string;
          status: string;
        } | null;
      };
    }) => {
      const result = accessResults[item.id];
      const provider = item.providers;

      return (
        <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
          <View className="flex-row items-center mb-2">
            {/* Photo placeholder */}
            <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-3">
              <Text className="text-gray-500 text-lg">
                {item.first_name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">
                {item.first_name} {item.last_name}
              </Text>
              {provider ? (
                <Text className="text-sm text-gray-500">
                  {provider.company_name}
                  {item.position ? ` - ${item.position}` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Access check result or button */}
          {result?.checking ? (
            <View className="flex-row items-center justify-center py-2">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-sm text-blue-600 ml-2">
                Verificando...
              </Text>
            </View>
          ) : result?.allowed === true ? (
            <View className="bg-green-100 rounded-lg py-2.5 items-center">
              <Text className="text-green-800 font-bold text-sm">
                Acceso Autorizado
              </Text>
            </View>
          ) : result?.allowed === false ? (
            <View className="bg-red-100 rounded-lg py-2.5 items-center">
              <Text className="text-red-800 font-bold text-sm">
                Acceso Denegado
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                handleCheckAccess(item.id, item.provider_id)
              }
              className="bg-blue-600 rounded-lg py-2.5 items-center active:bg-blue-700"
            >
              <Text className="text-white font-semibold text-sm">
                Verificar Acceso
              </Text>
            </Pressable>
          )}
        </View>
      );
    },
    [accessResults, handleCheckAccess]
  );

  return (
    <View className="flex-1 bg-gray-50 p-4">
      {/* Header */}
      <Text className="text-xl font-bold text-gray-900 mb-1">
        Verificar Proveedor
      </Text>
      <Text className="text-sm text-gray-500 mb-4">
        Busca al personal del proveedor para verificar su acceso
      </Text>

      {/* Search input */}
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Buscar por nombre..."
        placeholderTextColor="#9ca3af"
        autoCapitalize="words"
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
      />

      {/* Results */}
      {isSearching && searchQuery.length >= 2 ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-sm text-gray-500 mt-2">Buscando...</Text>
        </View>
      ) : (
        <FlatList
          data={personnel ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderPersonnel}
          ListEmptyComponent={
            searchQuery.length >= 2 ? (
              <View className="items-center py-8">
                <Text className="text-gray-400 text-base">
                  No se encontro personal con ese nombre
                </Text>
              </View>
            ) : (
              <View className="items-center py-8">
                <Text className="text-gray-400 text-base">
                  Escribe al menos 2 caracteres para buscar
                </Text>
              </View>
            )
          }
          contentContainerStyle={
            (personnel ?? []).length === 0 ? { flex: 1 } : undefined
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

export const ProviderVerification = React.memo(ProviderVerificationInner);
