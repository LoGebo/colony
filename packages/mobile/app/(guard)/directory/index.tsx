import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useResidentSearch, useUnitSearch, useBlacklistCheck } from '@/hooks/useDirectory';
import { EmptyState } from '@/components/ui/EmptyState';

type SearchMode = 'name' | 'unit';

// ---------- BlacklistAlert (inline since 10-04 runs in parallel) ----------

function BlacklistAlert({ reason, protocol }: { reason: string; protocol: string }) {
  return (
    <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
      <Text className="text-red-800 font-bold text-base mb-1">
        Alerta de Lista Negra
      </Text>
      <Text className="text-red-700 text-sm">{reason}</Text>
      {protocol ? (
        <Text className="text-red-600 text-xs mt-1">Protocolo: {protocol}</Text>
      ) : null}
    </View>
  );
}

// ---------- Resident result item ----------

interface ResidentResult {
  id: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  email: string | null;
  phone: string | null;
  occupancies: Array<{
    unit_id: string;
    units: { unit_number: string; building: string | null } | null;
  }>;
}

const ResidentRow = React.memo(function ResidentRow({ item }: { item: ResidentResult }) {
  const fullName = [item.first_name, item.paternal_surname, item.maternal_surname]
    .filter(Boolean)
    .join(' ');

  const unitLabels = item.occupancies
    .map((o) => o.units?.unit_number)
    .filter(Boolean)
    .join(', ');

  return (
    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
      <Text className="text-base font-medium text-gray-900">{fullName}</Text>
      {item.phone ? (
        <Text className="text-sm text-gray-500 mt-0.5">{item.phone}</Text>
      ) : null}
      {unitLabels ? (
        <View className="flex-row mt-1">
          <View className="bg-gray-100 rounded-md px-2 py-0.5">
            <Text className="text-xs font-medium text-gray-700">{unitLabels}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

// ---------- Unit result item ----------

interface UnitResult {
  id: string;
  unit_number: string;
  building: string | null;
  floor_number: number | null;
  occupancies: Array<{
    resident_id: string;
    residents: {
      id: string;
      first_name: string;
      paternal_surname: string;
      phone: string | null;
    } | null;
  }>;
}

const UnitRow = React.memo(function UnitRow({ item }: { item: UnitResult }) {
  return (
    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
      <View className="flex-row items-center mb-1">
        <Text className="text-base font-semibold text-gray-900">
          {item.unit_number}
        </Text>
        {item.building ? (
          <Text className="text-sm text-gray-500 ml-2">{item.building}</Text>
        ) : null}
      </View>
      {item.occupancies.length > 0 ? (
        item.occupancies.map((occ) =>
          occ.residents ? (
            <View key={occ.resident_id} className="ml-2 mt-1">
              <Text className="text-sm text-gray-700">
                {occ.residents.first_name} {occ.residents.paternal_surname}
              </Text>
              {occ.residents.phone ? (
                <Text className="text-xs text-gray-500">{occ.residents.phone}</Text>
              ) : null}
            </View>
          ) : null
        )
      ) : (
        <Text className="text-sm text-gray-400 ml-2 mt-1">Sin residentes</Text>
      )}
    </View>
  );
});

// ---------- Screen ----------

export default function DirectoryScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('name');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search hooks (only one will be enabled at a time)
  const residentSearch = useResidentSearch(
    searchMode === 'name' ? debouncedQuery : ''
  );
  const unitSearch = useUnitSearch(
    searchMode === 'unit' ? debouncedQuery : ''
  );

  // Blacklist check on debounced query (name mode only)
  const blacklistCheck = useBlacklistCheck({
    personName: searchMode === 'name' && debouncedQuery.length >= 2 ? debouncedQuery : undefined,
  });

  const isLoading =
    searchMode === 'name' ? residentSearch.isFetching : unitSearch.isFetching;

  const placeholder =
    searchMode === 'name' ? 'Buscar por nombre...' : 'Buscar por unidad...';

  const emptyMessage =
    searchMode === 'name'
      ? 'Ingresa al menos 2 caracteres para buscar'
      : 'Ingresa un numero de unidad';

  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 p-5">
        {/* Header */}
        <Text className="text-2xl font-bold text-gray-900 mb-4">Directorio</Text>

        {/* Vehicle search link */}
        <Pressable
          onPress={() => router.push('/(guard)/directory/vehicles')}
          className="bg-blue-50 rounded-xl p-3 mb-4 active:opacity-80"
        >
          <Text className="text-blue-600 font-medium text-center">
            Buscar vehiculo por placa
          </Text>
        </Pressable>

        {/* Mode toggle */}
        <View className="flex-row bg-gray-200 rounded-xl p-1 mb-4">
          <Pressable
            onPress={() => handleModeChange('name')}
            className={`flex-1 py-2 rounded-lg items-center ${
              searchMode === 'name' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`font-medium ${
                searchMode === 'name' ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              Por nombre
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleModeChange('unit')}
            className={`flex-1 py-2 rounded-lg items-center ${
              searchMode === 'unit' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`font-medium ${
                searchMode === 'unit' ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              Por unidad
            </Text>
          </Pressable>
        </View>

        {/* Search bar */}
        <TextInput
          className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Blacklist alert */}
        {blacklistCheck.data?.is_blocked ? (
          <BlacklistAlert
            reason={blacklistCheck.data.reason}
            protocol={blacklistCheck.data.protocol}
          />
        ) : null}

        {/* Loading indicator */}
        {isLoading ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : null}

        {/* Results */}
        {searchMode === 'name' ? (
          <FlatList
            data={(residentSearch.data ?? []) as ResidentResult[]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ResidentRow item={item} />}
            ListEmptyComponent={
              !isLoading && debouncedQuery.length < 2 ? (
                <EmptyState message={emptyMessage} />
              ) : !isLoading && residentSearch.data?.length === 0 ? (
                <EmptyState message="Sin resultados" />
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <FlatList
            data={(unitSearch.data ?? []) as UnitResult[]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <UnitRow item={item} />}
            ListEmptyComponent={
              !isLoading && debouncedQuery.length < 1 ? (
                <EmptyState message={emptyMessage} />
              ) : !isLoading && unitSearch.data?.length === 0 ? (
                <EmptyState message="Sin resultados" />
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
