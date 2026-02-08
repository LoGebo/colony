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
import { Link } from 'expo-router';
import { signUpSchema } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSignUp() {
    setError('');

    const result = signUpSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        Alert.alert('Error', authError.message);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Ocurrio un error inesperado');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Text className="text-3xl">✓</Text>
        </View>
        <Text className="text-xl font-bold text-gray-900 text-center">
          Cuenta creada
        </Text>
        <Text className="mt-3 text-center text-gray-500">
          Revisa tu email para confirmar tu cuenta
        </Text>
        <Link href="/sign-in" asChild>
          <Pressable className="mt-6 rounded-lg bg-indigo-600 px-8 py-3">
            <Text className="text-base font-semibold text-white">
              Ir a Iniciar Sesion
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-center text-gray-900">
            Crear Cuenta
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            Registrate para acceder a tu comunidad
          </Text>
        </View>

        {error ? (
          <View className="mb-4 rounded-lg bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Text className="mb-1 text-sm font-medium text-gray-700">
            Correo electronico
          </Text>
          <TextInput
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />
        </View>

        <View className="mb-4">
          <Text className="mb-1 text-sm font-medium text-gray-700">
            Contrasena
          </Text>
          <TextInput
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            placeholder="Minimo 8 caracteres"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!loading}
          />
        </View>

        <View className="mb-6">
          <Text className="mb-1 text-sm font-medium text-gray-700">
            Confirmar contrasena
          </Text>
          <TextInput
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            placeholder="Repite tu contrasena"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!loading}
          />
        </View>

        <Pressable
          className={`rounded-lg py-3.5 items-center ${
            loading ? 'bg-indigo-400' : 'bg-indigo-600'
          }`}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">
              Crear Cuenta
            </Text>
          )}
        </Pressable>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-sm text-gray-500">Ya tienes cuenta? </Text>
          <Link href="/sign-in" asChild>
            <Pressable>
              <Text className="text-sm font-semibold text-indigo-600">
                Iniciar Sesion
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
