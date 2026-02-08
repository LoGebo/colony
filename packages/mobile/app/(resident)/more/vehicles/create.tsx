import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateVehicle } from '@/hooks/useVehicles';

const MEXICAN_STATES = [
  'AGS', 'BC', 'BCS', 'CAM', 'CDMX', 'CHIH', 'CHIS', 'COAH',
  'COL', 'DGO', 'GRO', 'GTO', 'HGO', 'JAL', 'MEX', 'MICH',
  'MOR', 'NAY', 'NL', 'OAX', 'PUE', 'QRO', 'QROO', 'SIN',
  'SLP', 'SON', 'TAB', 'TAM', 'TLAX', 'VER', 'YUC', 'ZAC',
];

export default function CreateVehicleScreen() {
  const router = useRouter();
  const { mutate: createVehicle, isPending } = useCreateVehicle();

  const [plateNumber, setPlateNumber] = useState('');
  const [plateState, setPlateState] = useState('CDMX');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');

  const handleSubmit = useCallback(() => {
    if (!plateNumber.trim()) {
      Alert.alert('Error', 'Las placas son requeridas');
      return;
    }

    const yearNum = year.trim() ? parseInt(year.trim(), 10) : undefined;
    if (yearNum !== undefined && (isNaN(yearNum) || yearNum < 1950 || yearNum > new Date().getFullYear() + 1)) {
      Alert.alert('Error', 'Ano invalido');
      return;
    }

    createVehicle(
      {
        plate_number: plateNumber.trim(),
        plate_state: plateState,
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        year: yearNum,
      },
      {
        onSuccess: () => {
          Alert.alert('Exito', 'Vehiculo registrado', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (err) => Alert.alert('Error', err.message),
      },
    );
  }, [plateNumber, plateState, make, model, color, year, createVehicle, router]);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-xl font-bold text-gray-900 mb-6">Agregar Vehiculo</Text>

        {/* Plate number */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Placas *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="ABC-1234"
          value={plateNumber}
          onChangeText={setPlateNumber}
          autoCapitalize="characters"
        />

        {/* Plate state */}
        <Text className="text-sm font-medium text-gray-700 mb-2">Estado de las placas</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginBottom: 16 }}
        >
          {MEXICAN_STATES.map((state) => (
            <Pressable
              key={state}
              onPress={() => setPlateState(state)}
              className={`rounded-full px-3 py-1.5 ${
                plateState === state ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  plateState === state ? 'text-white' : 'text-gray-700'
                }`}
              >
                {state}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Make */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Marca</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="Ej. Toyota"
          value={make}
          onChangeText={setMake}
          autoCapitalize="words"
        />

        {/* Model */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Modelo</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="Ej. Corolla"
          value={model}
          onChangeText={setModel}
          autoCapitalize="words"
        />

        {/* Color */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Color</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="Ej. Blanco"
          value={color}
          onChangeText={setColor}
          autoCapitalize="words"
        />

        {/* Year */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Ano</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="Ej. 2022"
          value={year}
          onChangeText={setYear}
          keyboardType="numeric"
          maxLength={4}
        />

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={isPending}
          className={`rounded-lg p-4 items-center mt-2 mb-8 ${
            isPending ? 'bg-blue-400' : 'bg-blue-600 active:opacity-80'
          }`}
        >
          <Text className="text-white font-semibold text-base">
            {isPending ? 'Registrando...' : 'Registrar Vehiculo'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
