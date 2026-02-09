import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '@/hooks/useAuth';
import {
  useIncidentTypes,
  useCreateIncident,
  useUploadIncidentMedia,
} from '@/hooks/useIncidents';

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Baja', color: 'bg-green-100 border-green-400' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-100 border-yellow-400' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 border-orange-400' },
  {
    value: 'critical',
    label: 'Crítica',
    color: 'bg-red-100 border-red-400',
  },
];

interface PhotoAsset {
  uri: string;
  width: number;
  height: number;
}

export default function CreateIncidentScreen() {
  const { communityId } = useAuth();
  const router = useRouter();

  const { data: incidentTypes } = useIncidentTypes(communityId);
  const createIncident = useCreateIncident();
  const uploadMedia = useUploadIncidentMedia();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>();
  const [severity, setSeverity] = useState('medium');
  const [locationDescription, setLocationDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);

  const selectedType = incidentTypes?.find((t) => t.id === selectedTypeId);

  const handlePickImage = async () => {
    if (photos.length >= 5) {
      Alert.alert(
        'Límite alcanzado',
        'Solo puedes agregar hasta 5 fotos por incidente'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0]]);
    }
  };

  const handleTakePhoto = async () => {
    if (photos.length >= 5) {
      Alert.alert(
        'Límite alcanzado',
        'Solo puedes agregar hasta 5 fotos por incidente'
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a tu cámara para tomar fotos'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0]]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return;
    }

    try {
      // Get GPS coordinates if permission granted
      let latitude: number | undefined;
      let longitude: number | undefined;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        } catch {
          // GPS failed, continue without coordinates
        }
      }

      // Create incident
      const incident = await createIncident.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        incident_type_id: selectedTypeId,
        severity,
        location_description: locationDescription.trim() || undefined,
        gps_latitude: latitude,
        gps_longitude: longitude,
      });

      // Upload photos
      for (const photo of photos) {
        await uploadMedia.mutateAsync({
          incidentId: incident.id,
          communityId: communityId!,
          imageUri: photo.uri,
          mediaType: 'photo',
        });
      }

      Alert.alert('Éxito', 'Incidente reportado correctamente', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Error al crear incidente'
      );
    }
  };

  const isSubmitting = createIncident.isPending || uploadMedia.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">
            Reportar Incidente
          </Text>
          <Pressable
            onPress={() => router.back()}
            disabled={isSubmitting}
            className="px-3 py-1"
          >
            <Text className="text-blue-600 font-semibold">Cancelar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="p-4">
        {/* Title */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Título *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Breve descripción del incidente"
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            editable={!isSubmitting}
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Descripción *
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Detalles del incidente..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            editable={!isSubmitting}
          />
        </View>

        {/* Incident Type */}
        {incidentTypes && incidentTypes.length > 0 ? (
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Tipo de Incidente
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {incidentTypes.map((type) => (
                <Pressable
                  key={type.id}
                  onPress={() => {
                    setSelectedTypeId(type.id);
                    if (type.severity_default) {
                      setSeverity(type.severity_default);
                    }
                  }}
                  disabled={isSubmitting}
                  className={`border rounded-lg px-3 py-2 ${
                    selectedTypeId === type.id
                      ? 'bg-blue-100 border-blue-400'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selectedTypeId === type.id
                        ? 'text-blue-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {type.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Severity */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Gravedad *
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {SEVERITY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setSeverity(option.value)}
                disabled={isSubmitting}
                className={`border rounded-lg px-4 py-2 ${
                  severity === option.value
                    ? option.color
                    : 'bg-white border-gray-300'
                }`}
              >
                <Text
                  className={`text-sm ${
                    severity === option.value
                      ? 'font-semibold'
                      : 'text-gray-700'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Location */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Ubicación
          </Text>
          <TextInput
            value={locationDescription}
            onChangeText={setLocationDescription}
            placeholder="Ej: Caseta norte, Area de estacionamiento, etc."
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base"
            editable={!isSubmitting}
          />
        </View>

        {/* Photos */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Evidencia Fotográfica ({photos.length}/5)
          </Text>
          {photos.length > 0 ? (
            <View className="flex-row flex-wrap gap-2 mb-2">
              {photos.map((photo, index) => (
                <View key={index} className="relative">
                  <Image
                    source={{ uri: photo.uri }}
                    className="w-20 h-20 rounded-lg"
                  />
                  <Pressable
                    onPress={() => handleRemovePhoto(index)}
                    disabled={isSubmitting}
                    className="absolute -top-1 -right-1 bg-red-500 rounded-full w-6 h-6 items-center justify-center"
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 1.5,
                      elevation: 2,
                    }}
                  >
                    <Text className="text-white text-sm leading-none">×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleTakePhoto}
              disabled={isSubmitting || photos.length >= 5}
              className={`flex-1 border border-gray-300 rounded-lg py-2.5 items-center ${
                photos.length >= 5 ? 'bg-gray-100' : 'bg-white active:bg-gray-50'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  photos.length >= 5 ? 'text-gray-400' : 'text-gray-700'
                }`}
              >
                📷 Tomar Foto
              </Text>
            </Pressable>
            <Pressable
              onPress={handlePickImage}
              disabled={isSubmitting || photos.length >= 5}
              className={`flex-1 border border-gray-300 rounded-lg py-2.5 items-center ${
                photos.length >= 5 ? 'bg-gray-100' : 'bg-white active:bg-gray-50'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  photos.length >= 5 ? 'text-gray-400' : 'text-gray-700'
                }`}
              >
                🖼️ Galería
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          className={`rounded-lg py-3 items-center mb-6 ${
            isSubmitting ? 'bg-blue-400' : 'bg-blue-600 active:bg-blue-700'
          }`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Reportar Incidente
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
