import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useResidentProfile, useUpdateProfile, useUpdateEmergencyContact } from '@/hooks/useProfile';
import { pickAndUploadImage } from '@/lib/upload';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Conyugue' },
  { value: 'parent', label: 'Padre/Madre' },
  { value: 'child', label: 'Hijo/a' },
  { value: 'sibling', label: 'Hermano/a' },
  { value: 'friend', label: 'Amigo/a' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'employer', label: 'Empleador' },
  { value: 'neighbor', label: 'Vecino/a' },
  { value: 'other', label: 'Otro' },
];

export default function ProfileScreen() {
  const { communityId } = useAuth();
  const { data: profile, isLoading } = useResidentProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile();
  const { mutate: upsertContact, isPending: isContactUpdating } = useUpdateEmergencyContact();

  const [phone, setPhone] = useState('');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelationship, setContactRelationship] = useState('spouse');
  const [showAddContact, setShowAddContact] = useState(false);

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? '');
      setPhoneSecondary(profile.phone_secondary ?? '');
    }
  }, [profile]);

  const handleSaveProfile = useCallback(() => {
    updateProfile(
      {
        phone: phone.trim() || undefined,
        phone_secondary: phoneSecondary.trim() || undefined,
      },
      {
        onSuccess: () => Alert.alert('Exito', 'Perfil actualizado'),
        onError: (err) => Alert.alert('Error', err.message),
      },
    );
  }, [phone, phoneSecondary, updateProfile]);

  const handleChangePhoto = useCallback(async () => {
    if (!communityId) return;
    const path = await pickAndUploadImage('avatars', communityId, 'residents');
    if (path) {
      updateProfile(
        { photo_url: path },
        {
          onSuccess: () => Alert.alert('Exito', 'Foto actualizada'),
          onError: (err) => Alert.alert('Error', err.message),
        },
      );
    }
  }, [communityId, updateProfile]);

  const handleSaveContact = useCallback(() => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Error', 'Nombre y telefono son requeridos');
      return;
    }

    upsertContact(
      {
        id: editingContactId ?? undefined,
        contact_name: contactName.trim(),
        phone_primary: contactPhone.trim(),
        relationship: contactRelationship,
      },
      {
        onSuccess: () => {
          setEditingContactId(null);
          setShowAddContact(false);
          setContactName('');
          setContactPhone('');
          setContactRelationship('spouse');
          Alert.alert('Exito', 'Contacto guardado');
        },
        onError: (err) => Alert.alert('Error', err.message),
      },
    );
  }, [editingContactId, contactName, contactPhone, contactRelationship, upsertContact]);

  const startEditContact = useCallback(
    (contact: { id: string; contact_name: string; phone_primary: string; relationship: string }) => {
      setEditingContactId(contact.id);
      setContactName(contact.contact_name);
      setContactPhone(contact.phone_primary);
      setContactRelationship(contact.relationship);
      setShowAddContact(true);
    },
    [],
  );

  if (isLoading || !profile) {
    return <LoadingSpinner message="Cargando perfil..." />;
  }

  const fullName = [profile.first_name, profile.paternal_surname, profile.maternal_surname]
    .filter(Boolean)
    .join(' ');

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-xl font-bold text-gray-900 mb-6">Mi Perfil</Text>

        {/* Photo */}
        <Pressable onPress={handleChangePhoto} className="items-center mb-6">
          {profile.photo_url ? (
            <Image
              source={{ uri: profile.photo_url }}
              className="w-24 h-24 rounded-full bg-gray-200"
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-3xl">{'\u{1F464}'}</Text>
            </View>
          )}
          <Text className="text-blue-600 text-sm mt-2">Cambiar foto</Text>
        </Pressable>

        {/* Read-only fields */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Nombre</Text>
        <View className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-100">
          <Text className="text-gray-600">{fullName}</Text>
        </View>

        <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
        <View className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-100">
          <Text className="text-gray-600">{profile.email}</Text>
        </View>

        {/* Editable fields */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Telefono</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="+52 123 456 7890"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">Telefono secundario</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="+52 123 456 7890"
          value={phoneSecondary}
          onChangeText={setPhoneSecondary}
          keyboardType="phone-pad"
        />

        <Pressable
          onPress={handleSaveProfile}
          disabled={isUpdating}
          className={`rounded-lg p-3 items-center mb-8 ${
            isUpdating ? 'bg-blue-400' : 'bg-blue-600 active:opacity-80'
          }`}
        >
          <Text className="text-white font-semibold">
            {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
          </Text>
        </Pressable>

        {/* Emergency Contacts */}
        <Text className="text-lg font-bold text-gray-900 mb-3">Contactos de Emergencia</Text>

        {profile.emergencyContacts.map((contact) => (
          <Pressable
            key={contact.id}
            onPress={() => startEditContact(contact)}
            className="bg-white rounded-xl p-4 mb-2 shadow-sm active:opacity-80"
          >
            <Text className="font-semibold text-gray-900">{contact.contact_name}</Text>
            <Text className="text-sm text-gray-600 mt-1">{contact.phone_primary}</Text>
            <Text className="text-xs text-gray-400 mt-1">
              {RELATIONSHIP_OPTIONS.find((r) => r.value === contact.relationship)?.label ?? contact.relationship}
            </Text>
          </Pressable>
        ))}

        {/* Add/Edit contact form */}
        {showAddContact ? (
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <Text className="font-semibold text-gray-900 mb-3">
              {editingContactId ? 'Editar Contacto' : 'Nuevo Contacto'}
            </Text>

            <Text className="text-sm font-medium text-gray-700 mb-1">Nombre *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3 bg-white"
              placeholder="Nombre completo"
              value={contactName}
              onChangeText={setContactName}
              autoCapitalize="words"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">Telefono *</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3 bg-white"
              placeholder="+52 123 456 7890"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />

            <Text className="text-sm font-medium text-gray-700 mb-2">Relacion</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 12 }}
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setContactRelationship(opt.value)}
                  className={`rounded-full px-3 py-1.5 ${
                    contactRelationship === opt.value
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      contactRelationship === opt.value
                        ? 'text-white font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setShowAddContact(false);
                  setEditingContactId(null);
                  setContactName('');
                  setContactPhone('');
                }}
                className="flex-1 rounded-lg p-3 items-center bg-gray-200 active:opacity-80"
              >
                <Text className="text-gray-700 font-medium">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveContact}
                disabled={isContactUpdating}
                className={`flex-1 rounded-lg p-3 items-center ${
                  isContactUpdating ? 'bg-blue-400' : 'bg-blue-600 active:opacity-80'
                }`}
              >
                <Text className="text-white font-semibold">
                  {isContactUpdating ? 'Guardando...' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setShowAddContact(true);
              setEditingContactId(null);
              setContactName('');
              setContactPhone('');
              setContactRelationship('spouse');
            }}
            className="border border-dashed border-gray-300 rounded-xl p-4 items-center active:opacity-80"
          >
            <Text className="text-blue-600 font-medium">+ Agregar Contacto</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
