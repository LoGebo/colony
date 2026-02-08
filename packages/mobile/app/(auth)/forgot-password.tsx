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
import { resetPasswordSchema } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleResetPassword() {
    setError('');

    const result = resetPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'upoe://reset-password',
        });

      if (resetError) {
        Alert.alert('Error', resetError.message);
      } else {
        setSent(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Ocurrio un error inesperado');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <Text className="text-3xl">✉</Text>
        </View>
        <Text className="text-xl font-bold text-gray-900 text-center">
          Enlace enviado
        </Text>
        <Text className="mt-3 text-center text-gray-500">
          Te enviamos un enlace para restablecer tu contrasena a {email}
        </Text>
        <Link href="/sign-in" asChild>
          <Pressable className="mt-6 rounded-lg bg-indigo-600 px-8 py-3">
            <Text className="text-base font-semibold text-white">
              Volver a Iniciar Sesion
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
            Recuperar Contrasena
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu
            contrasena
          </Text>
        </View>

        {error ? (
          <View className="mb-4 rounded-lg bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        <View className="mb-6">
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

        <Pressable
          className={`rounded-lg py-3.5 items-center ${
            loading ? 'bg-indigo-400' : 'bg-indigo-600'
          }`}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">
              Enviar Enlace
            </Text>
          )}
        </Pressable>

        <Link href="/sign-in" asChild>
          <Pressable className="mt-4 items-center py-2">
            <Text className="text-sm text-indigo-600">
              Volver a Iniciar Sesion
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
