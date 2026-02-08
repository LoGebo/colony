import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVehicleSearch, useBlacklistCheck } from '@/hooks/useDirectory';
import { EmptyState } from '@/components/ui/EmptyState';

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

// ---------- Vehicle result item ----------

interface VehicleResult {
  id: string;
  plate_number: string;
  plate_normalized: string;
  plate_state: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  access_enabled: boolean;
  residents: {
    id: string;
    first_name: string;
    paternal_surname: string;
    occupancies: Array<{ units: { unit_number: string } | null }>;
  } | null;
}

const VehicleRow = React.memo(function VehicleRow({
  item,
}: {
  item: VehicleResult;
}) {
  const vehicleDesc = [item.make, item.model, item.year, item.color]
    .filter(Boolean)
    .join(' ');

  const ownerName = item.residents
    ? `${item.residents.first_name} ${item.residents.paternal_surname}`
    : 'Sin propietario';

  const unitNumber = item.residents?.occupancies?.[0]?.units?.unit_number;

  return (
    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm">
      {/* Plate */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-lg font-bold text-gray-900">
          {item.plate_number}
        </Text>
        <View
          className={`rounded-full px-2 py-0.5 ${
            item.access_enabled ? 'bg-green-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              item.access_enabled ? 'text-green-800' : 'text-gray-600'
            }`}
          >
            {item.access_enabled ? 'Acceso activo' : 'Sin acceso'}
          </Text>
        </View>
      </View>

      {/* Vehicle details */}
      {vehicleDesc ? (
        <Text className="text-sm text-gray-500">{vehicleDesc}</Text>
      ) : null}

      {/* Owner + unit */}
      <View className="flex-row items-center mt-2">
        <Text className="text-sm text-gray-700">{ownerName}</Text>
        {unitNumber ? (
          <View className="bg-gray-100 rounded-md px-2 py-0.5 ml-2">
            <Text className="text-xs font-medium text-gray-700">
              {unitNumber}
            </Text>
          </View>
        ) : null}
      </View>

      {/* State */}
      <Text className="text-xs text-gray-400 mt-1">{item.plate_state}</Text>
    </View>
  );
});

// ---------- Screen ----------

export default function VehicleSearchScreen() {
  const [plateQuery, setPlateQuery] = useState('');
  const [debouncedPlate, setDebouncedPlate] = useState('');

  // Debounce 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPlate(plateQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [plateQuery]);

  const vehicleSearch = useVehicleSearch(debouncedPlate);

  const normalized = debouncedPlate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const blacklistCheck = useBlacklistCheck({
    plateNormalized: normalized.length >= 3 ? normalized : undefined,
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 p-5">
        {/* Header */}
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          Buscar Vehiculo
        </Text>

        {/* Search bar */}
        <TextInput
          className="bg-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
          placeholder="Buscar por placa..."
          placeholderTextColor="#9ca3af"
          value={plateQuery}
          onChangeText={setPlateQuery}
          autoCapitalize="characters"
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
        {vehicleSearch.isFetching ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : null}

        {/* Results */}
        <FlatList
          data={(vehicleSearch.data ?? []) as VehicleResult[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VehicleRow item={item} />}
          ListEmptyComponent={
            !vehicleSearch.isFetching && debouncedPlate.length < 3 ? (
              <EmptyState message="Ingresa al menos 3 caracteres" />
            ) : !vehicleSearch.isFetching && vehicleSearch.data?.length === 0 ? (
              <EmptyState message="Sin resultados" />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </SafeAreaView>
  );
}
