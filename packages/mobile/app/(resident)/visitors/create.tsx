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
import { useCreateInvitation } from '@/hooks/useVisitors';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { DAY_LABELS } from '@/lib/dates';

const DAY_CHIPS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mie' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
];

type InvitationType = 'single_use' | 'recurring';

export default function CreateInvitationScreen() {
  const router = useRouter();
  const { mutate: createInvitation, isPending } = useCreateInvitation();
  const { unitId } = useResidentUnit();

  // Form state
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [invitationType, setInvitationType] = useState<InvitationType>('single_use');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringStartTime, setRecurringStartTime] = useState('');
  const [recurringEndTime, setRecurringEndTime] = useState('');

  const toggleDay = useCallback((day: number) => {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (!visitorName.trim()) {
      Alert.alert('Error', 'El nombre del visitante es requerido');
      return;
    }

    if (invitationType === 'single_use' && !validFrom.trim()) {
      Alert.alert('Error', 'La fecha de inicio es requerida');
      return;
    }

    const payload = {
      visitor_name: visitorName.trim(),
      invitation_type: invitationType as 'single_use' | 'recurring',
      valid_from:
        invitationType === 'recurring'
          ? new Date().toISOString()
          : new Date(validFrom).toISOString(),
      valid_until: validUntil.trim()
        ? new Date(validUntil).toISOString()
        : undefined,
      visitor_phone: visitorPhone.trim() || undefined,
      vehicle_plate: vehiclePlate.trim() || undefined,
      recurring_days:
        invitationType === 'recurring' && recurringDays.length > 0
          ? recurringDays
          : undefined,
      recurring_start_time:
        invitationType === 'recurring' && recurringStartTime.trim()
          ? recurringStartTime.trim()
          : undefined,
      recurring_end_time:
        invitationType === 'recurring' && recurringEndTime.trim()
          ? recurringEndTime.trim()
          : undefined,
      unit_id: unitId ?? undefined,
    };

    createInvitation(payload, {
      onSuccess: (data) => {
        router.push(`/(resident)/visitors/${data.id}`);
      },
      onError: (error) => {
        Alert.alert('Error', error.message);
      },
    });
  }, [
    visitorName,
    visitorPhone,
    vehiclePlate,
    invitationType,
    validFrom,
    validUntil,
    recurringDays,
    recurringStartTime,
    recurringEndTime,
    unitId,
    createInvitation,
    router,
  ]);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-xl font-bold text-gray-900 mb-6">Nueva Invitacion</Text>

        {/* Invitation type selector */}
        <View className="flex-row mb-6 bg-gray-100 rounded-lg p-1">
          <Pressable
            onPress={() => setInvitationType('single_use')}
            className={`flex-1 rounded-md py-2 items-center ${
              invitationType === 'single_use' ? 'bg-blue-600' : ''
            }`}
          >
            <Text
              className={`font-medium ${
                invitationType === 'single_use' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Una vez
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setInvitationType('recurring')}
            className={`flex-1 rounded-md py-2 items-center ${
              invitationType === 'recurring' ? 'bg-blue-600' : ''
            }`}
          >
            <Text
              className={`font-medium ${
                invitationType === 'recurring' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Recurrente
            </Text>
          </Pressable>
        </View>

        {/* Visitor name */}
        <Text className="text-sm font-medium text-gray-700 mb-1">
          Nombre del visitante *
        </Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="Nombre completo"
          value={visitorName}
          onChangeText={setVisitorName}
          autoCapitalize="words"
        />

        {/* Visitor phone */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Telefono (opcional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="+52 123 456 7890"
          value={visitorPhone}
          onChangeText={setVisitorPhone}
          keyboardType="phone-pad"
        />

        {/* Vehicle plate */}
        <Text className="text-sm font-medium text-gray-700 mb-1">
          Placas del vehiculo (opcional)
        </Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="ABC-1234"
          value={vehiclePlate}
          onChangeText={setVehiclePlate}
          autoCapitalize="characters"
        />

        {/* Single-use specific fields */}
        {invitationType === 'single_use' ? (
          <>
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Fecha y hora de inicio *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
              placeholder="YYYY-MM-DD HH:mm"
              value={validFrom}
              onChangeText={setValidFrom}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">
              Fecha y hora limite (opcional)
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
              placeholder="YYYY-MM-DD HH:mm"
              value={validUntil}
              onChangeText={setValidUntil}
            />
          </>
        ) : null}

        {/* Recurring specific fields */}
        {invitationType === 'recurring' ? (
          <>
            <Text className="text-sm font-medium text-gray-700 mb-2">Dias de la semana</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {DAY_CHIPS.map((day) => {
                const selected = recurringDays.includes(day.value);
                return (
                  <Pressable
                    key={day.value}
                    onPress={() => toggleDay(day.value)}
                    className={`rounded-full px-4 py-2 ${
                      selected ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        selected ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">Hora de inicio</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
              placeholder="HH:mm (ej. 08:00)"
              value={recurringStartTime}
              onChangeText={setRecurringStartTime}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">Hora de fin</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
              placeholder="HH:mm (ej. 18:00)"
              value={recurringEndTime}
              onChangeText={setRecurringEndTime}
            />
          </>
        ) : null}

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={isPending}
          className={`rounded-lg p-4 items-center mt-2 mb-8 ${
            isPending ? 'bg-blue-400' : 'bg-blue-600 active:opacity-80'
          }`}
        >
          <Text className="text-white font-semibold text-base">
            {isPending ? 'Creando...' : 'Crear Invitacion'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
