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
import { signInSchema } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    setError('');

    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        Alert.alert('Error', authError.message);
      }
      // On success: session state change triggers Stack.Protected re-evaluation
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
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-center text-gray-900">
            Iniciar Sesion
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            Ingresa tus credenciales para continuar
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

        <View className="mb-6">
          <Text className="mb-1 text-sm font-medium text-gray-700">
            Contrasena
          </Text>
          <TextInput
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            placeholder="Minimo 8 caracteres"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={!loading}
          />
        </View>

        <Pressable
          className={`rounded-lg py-3.5 items-center ${
            loading ? 'bg-indigo-400' : 'bg-indigo-600'
          }`}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">
              Iniciar Sesion
            </Text>
          )}
        </Pressable>

        <Link href="/forgot-password" asChild>
          <Pressable className="mt-4 items-center py-2">
            <Text className="text-sm text-indigo-600">
              Olvidaste tu contrasena?
            </Text>
          </Pressable>
        </Link>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-sm text-gray-500">No tienes cuenta? </Text>
          <Link href="/sign-up" asChild>
            <Pressable>
              <Text className="text-sm font-semibold text-indigo-600">
                Crear cuenta
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
