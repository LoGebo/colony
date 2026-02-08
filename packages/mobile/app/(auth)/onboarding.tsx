import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { adminOnboardingSchema } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

export default function OnboardingScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Organization & Community
  const [orgName, setOrgName] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [communityAddress, setCommunityAddress] = useState('');
  const [communityCity, setCommunityCity] = useState('');
  const [communityState, setCommunityState] = useState('');
  const [communityZip, setCommunityZip] = useState('');

  // Step 2: Admin name
  const [firstName, setFirstName] = useState('');
  const [paternalSurname, setPaternalSurname] = useState('');

  function handleNextStep() {
    // Validate required fields for step 1
    if (!orgName.trim()) {
      setError('Nombre de organizacion requerido');
      return;
    }
    if (!communityName.trim()) {
      setError('Nombre de comunidad requerido');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleSubmit() {
    setError('');

    const formData = {
      orgName,
      communityName,
      communityAddress: communityAddress || undefined,
      communityCity: communityCity || undefined,
      communityState: communityState || undefined,
      communityZip: communityZip || undefined,
      firstName: firstName || undefined,
      paternalSurname: paternalSurname || undefined,
    };

    const result = adminOnboardingSchema.safeParse(formData);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc(
        'complete_admin_onboarding',
        {
          p_org_name: orgName,
          p_community_name: communityName,
          p_community_address: communityAddress || undefined,
          p_community_city: communityCity || undefined,
          p_community_state: communityState || undefined,
          p_community_zip: communityZip || undefined,
          p_first_name: firstName || undefined,
          p_paternal_surname: paternalSurname || undefined,
        }
      );

      if (rpcError) {
        Alert.alert('Error', rpcError.message);
        return;
      }

      // CRITICAL: Refresh session to get updated app_metadata
      // (role changes from pending_setup to community_admin)
      await supabase.auth.refreshSession();

      // Session state change triggers Stack.Protected re-evaluation
      // and routes to the admin group automatically
    } catch (err) {
      Alert.alert('Error', 'Ocurrio un error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-center text-gray-900">
            Configuracion Inicial
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            {step === 1
              ? 'Configura tu organizacion y comunidad'
              : 'Informacion del administrador'}
          </Text>
          {/* Step indicator */}
          <View className="mt-4 flex-row justify-center gap-2">
            <View
              className={`h-2 w-16 rounded-full ${
                step === 1 ? 'bg-indigo-600' : 'bg-indigo-200'
              }`}
            />
            <View
              className={`h-2 w-16 rounded-full ${
                step === 2 ? 'bg-indigo-600' : 'bg-indigo-200'
              }`}
            />
          </View>
        </View>

        {error ? (
          <View className="mb-4 rounded-lg bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <>
            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-gray-700">
                Nombre de la organizacion *
              </Text>
              <TextInput
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                placeholder="Ej: Administradora Central"
                value={orgName}
                onChangeText={setOrgName}
                editable={!loading}
              />
            </View>

            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-gray-700">
                Nombre de la comunidad *
              </Text>
              <TextInput
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                placeholder="Ej: Residencial Las Palmas"
                value={communityName}
                onChangeText={setCommunityName}
                editable={!loading}
              />
            </View>

            <Text className="mb-3 text-sm font-medium text-gray-400">
              Direccion (opcional)
            </Text>

            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-gray-700">
                Calle y numero
              </Text>
              <TextInput
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                placeholder="Calle, numero"
                value={communityAddress}
                onChangeText={setCommunityAddress}
                editable={!loading}
              />
            </View>

            <View className="mb-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-sm font-medium text-gray-700">
                  Ciudad
                </Text>
                <TextInput
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                  placeholder="Ciudad"
                  value={communityCity}
                  onChangeText={setCommunityCity}
                  editable={!loading}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-sm font-medium text-gray-700">
                  Estado
                </Text>
                <TextInput
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                  placeholder="Estado"
                  value={communityState}
                  onChangeText={setCommunityState}
                  editable={!loading}
                />
              </View>
            </View>

            <View className="mb-6">
              <Text className="mb-1 text-sm font-medium text-gray-700">
                Codigo postal
              </Text>
              <TextInput
                className="w-32 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                placeholder="00000"
                value={communityZip}
                onChangeText={setCommunityZip}
                keyboardType="numeric"
                editable={!loading}
              />
            </View>

            <Pressable
              className="rounded-lg bg-indigo-600 py-3.5 items-center"
              onPress={handleNextStep}
            >
              <Text className="text-base font-semibold text-white">
                Siguiente
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text className="mb-3 text-sm text-gray-400">
              Tu nombre aparecera como administrador principal (opcional)
            </Text>

            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-gray-700">
                Nombre
              </Text>
              <TextInput
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                placeholder="Tu nombre"
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading}
              />
            </View>

            <View className="mb-6">
              <Text className="mb-1 text-sm font-medium text-gray-700">
                Apellido paterno
              </Text>
              <TextInput
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
                placeholder="Tu apellido"
                value={paternalSurname}
                onChangeText={setPaternalSurname}
                editable={!loading}
              />
            </View>

            {/* Review summary */}
            <View className="mb-6 rounded-lg bg-gray-50 p-4">
              <Text className="mb-2 text-sm font-semibold text-gray-700">
                Resumen
              </Text>
              <Text className="text-sm text-gray-600">
                Organizacion: {orgName}
              </Text>
              <Text className="text-sm text-gray-600">
                Comunidad: {communityName}
              </Text>
              {communityAddress ? (
                <Text className="text-sm text-gray-600">
                  Direccion: {communityAddress}
                  {communityCity ? `, ${communityCity}` : ''}
                  {communityState ? `, ${communityState}` : ''}
                  {communityZip ? ` ${communityZip}` : ''}
                </Text>
              ) : null}
              {firstName ? (
                <Text className="text-sm text-gray-600">
                  Administrador: {firstName} {paternalSurname}
                </Text>
              ) : null}
            </View>

            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 rounded-lg border border-gray-300 py-3.5 items-center"
                onPress={() => {
                  setStep(1);
                  setError('');
                }}
                disabled={loading}
              >
                <Text className="text-base font-semibold text-gray-700">
                  Atras
                </Text>
              </Pressable>

              <Pressable
                className={`flex-1 rounded-lg py-3.5 items-center ${
                  loading ? 'bg-indigo-400' : 'bg-indigo-600'
                }`}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    Crear
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
