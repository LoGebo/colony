import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Mas' }} />
      <Stack.Screen name="profile/index" options={{ title: 'Mi Perfil' }} />
      <Stack.Screen name="profile/unit" options={{ title: 'Mi Unidad' }} />
      <Stack.Screen name="vehicles/index" options={{ title: 'Mis Vehiculos' }} />
      <Stack.Screen name="vehicles/create" options={{ title: 'Agregar Vehiculo' }} />
      <Stack.Screen name="documents/index" options={{ title: 'Documentos' }} />
      <Stack.Screen name="documents/[id]" options={{ title: 'Documento' }} />
      <Stack.Screen name="marketplace/index" options={{ title: 'Marketplace' }} />
      <Stack.Screen name="marketplace/create" options={{ title: 'Nueva Publicacion' }} />
      <Stack.Screen name="marketplace/[id]" options={{ title: 'Publicacion' }} />
      <Stack.Screen name="packages/index" options={{ title: 'Mis Paquetes' }} />
    </Stack>
  );
}
