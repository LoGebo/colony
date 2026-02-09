import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  DEFAULT_PREFERENCES,
  type NotificationPreferences as NotificationPreferencesType,
} from '@/hooks/useNotificationPreferences';

/**
 * Notification preferences settings screen.
 * Allows residents to customize which notification types they receive.
 */
export function NotificationPreferences() {
  const { data: serverPreferences, isLoading, error } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  // Local state for optimistic updates
  const [preferences, setPreferences] = useState<NotificationPreferencesType>(DEFAULT_PREFERENCES);

  // Sync with server data when loaded
  useEffect(() => {
    if (serverPreferences) {
      setPreferences(serverPreferences);
    }
  }, [serverPreferences]);

  // Save all changes to database
  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(preferences);
      Alert.alert('Guardado', 'Tus preferencias han sido actualizadas correctamente');
    } catch (err) {
      Alert.alert('Error', 'No se pudieron guardar las preferencias. Intenta de nuevo.');
    }
  };

  // Toggle master push notifications
  const togglePushEnabled = () => {
    setPreferences((prev) => ({ ...prev, push_enabled: !prev.push_enabled }));
  };

  // Toggle individual notification type
  const toggleNotificationType = (type: keyof NotificationPreferencesType['types']) => {
    // Emergency alerts cannot be disabled
    if (type === 'emergency_alert') return;

    setPreferences((prev) => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: !prev.types[type],
      },
    }));
  };

  // Toggle quiet hours
  const toggleQuietHours = () => {
    setPreferences((prev) => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        enabled: !prev.quiet_hours.enabled,
      },
    }));
  };

  // Update quiet hours time
  const updateQuietHoursTime = (field: 'start' | 'end', value: string) => {
    setPreferences((prev) => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-gray-600">Cargando preferencias...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-red-600 text-center">Error al cargar las preferencias</Text>
          <Text className="text-gray-600 text-center mt-2">
            Intenta de nuevo más tarde
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPushDisabled = !preferences.push_enabled;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6">
        {/* Header */}
        <Text className="text-2xl font-bold text-gray-900 mt-6 mb-2">
          Preferencias de Notificaciones
        </Text>
        <Text className="text-gray-600 mb-6">
          Personaliza qué notificaciones quieres recibir
        </Text>

        {/* Section: General */}
        <Text className="text-lg font-semibold text-gray-800 mt-6 mb-2">General</Text>
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <View className="flex-1">
            <Text className="text-gray-900 font-medium">Notificaciones Push</Text>
            <Text className="text-gray-500 text-sm">Activar o desactivar todas las notificaciones</Text>
          </View>
          <Switch
            value={preferences.push_enabled}
            onValueChange={togglePushEnabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Section: Notification Types */}
        <Text className="text-lg font-semibold text-gray-800 mt-6 mb-2">Tipos de Notificación</Text>

        {/* Visitor Arrived */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Llegada de visitantes</Text>
          <Switch
            value={preferences.types.visitor_arrived}
            onValueChange={() => toggleNotificationType('visitor_arrived')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Payment Due */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Pagos pendientes</Text>
          <Switch
            value={preferences.types.payment_due}
            onValueChange={() => toggleNotificationType('payment_due')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Payment Received */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Confirmación de pago</Text>
          <Switch
            value={preferences.types.payment_received}
            onValueChange={() => toggleNotificationType('payment_received')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Ticket Created */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Tickets de mantenimiento</Text>
          <Switch
            value={preferences.types.ticket_created}
            onValueChange={() => toggleNotificationType('ticket_created')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Ticket Status Changed */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Actualización de tickets</Text>
          <Switch
            value={preferences.types.ticket_status_changed}
            onValueChange={() => toggleNotificationType('ticket_status_changed')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Announcements */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Anuncios</Text>
          <Switch
            value={preferences.types.announcement}
            onValueChange={() => toggleNotificationType('announcement')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Package Arrived */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Paquetes recibidos</Text>
          <Switch
            value={preferences.types.package_arrived}
            onValueChange={() => toggleNotificationType('package_arrived')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Emergency Alert (always on, disabled switch) */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <View className="flex-1">
            <Text className="text-gray-900">Alertas de emergencia</Text>
            <Text className="text-gray-500 text-xs">(siempre activo)</Text>
          </View>
          <Switch
            value={true}
            disabled={true}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Survey Published */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Encuestas</Text>
          <Switch
            value={preferences.types.survey_published}
            onValueChange={() => toggleNotificationType('survey_published')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Document Published */}
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <Text className="text-gray-900 flex-1">Documentos</Text>
          <Switch
            value={preferences.types.document_published}
            onValueChange={() => toggleNotificationType('document_published')}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Section: Quiet Hours */}
        <Text className="text-lg font-semibold text-gray-800 mt-6 mb-2">Horario Silencioso</Text>
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
          <View className="flex-1">
            <Text className="text-gray-900 font-medium">Activar horario silencioso</Text>
            <Text className="text-gray-500 text-sm">
              No recibir notificaciones durante estas horas
            </Text>
          </View>
          <Switch
            value={preferences.quiet_hours.enabled}
            onValueChange={toggleQuietHours}
            disabled={isPushDisabled}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Quiet Hours Time Inputs */}
        {preferences.quiet_hours.enabled && (
          <View className="mt-4">
            <View className="flex-row items-center mb-3">
              <Text className="text-gray-700 w-16">Inicio:</Text>
              <TextInput
                value={preferences.quiet_hours.start}
                onChangeText={(text) => updateQuietHoursTime('start', text)}
                placeholder="22:00"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View className="flex-row items-center">
              <Text className="text-gray-700 w-16">Fin:</Text>
              <TextInput
                value={preferences.quiet_hours.end}
                onChangeText={(text) => updateQuietHoursTime('end', text)}
                placeholder="08:00"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={updateMutation.isPending}
          className="bg-blue-600 rounded-lg py-3 mt-8 mb-8"
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-center font-semibold text-lg">Guardar</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
