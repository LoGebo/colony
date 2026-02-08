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
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateTicket, useTicketCategories } from '@/hooks/useTickets';
import { useAuth } from '@/hooks/useAuth';
import { pickAndUploadImage } from '@/lib/upload';
import { STORAGE_BUCKETS } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string; activeColor: string }[] = [
  { value: 'low', label: 'Baja', color: 'bg-gray-200', activeColor: 'bg-gray-600' },
  { value: 'medium', label: 'Media', color: 'bg-blue-100', activeColor: 'bg-blue-600' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100', activeColor: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100', activeColor: 'bg-red-500' },
];

const MAX_PHOTOS = 5;

export default function CreateTicketScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { mutate: createTicket, isPending } = useCreateTicket();
  const { data: categories, isLoading: categoriesLoading } = useTicketCategories();

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [location, setLocation] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePickPhoto = useCallback(async () => {
    if (!communityId) return;
    if (photoPaths.length >= MAX_PHOTOS) {
      Alert.alert('Limite', `Maximo ${MAX_PHOTOS} fotos por reporte`);
      return;
    }

    setUploading(true);
    try {
      const path = await pickAndUploadImage(
        STORAGE_BUCKETS.TICKET_ATTACHMENTS,
        communityId,
        'tickets'
      );
      if (path) {
        setPhotoPaths((prev) => [...prev, path]);
      }
    } finally {
      setUploading(false);
    }
  }, [communityId, photoPaths.length]);

  const removePhoto = useCallback((index: number) => {
    setPhotoPaths((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage
      .from(STORAGE_BUCKETS.TICKET_ATTACHMENTS)
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!categoryId) {
      newErrors.category = 'Selecciona una categoria';
    }
    if (!title.trim() || title.trim().length < 5) {
      newErrors.title = 'El titulo debe tener al menos 5 caracteres';
    }
    if (!description.trim() || description.trim().length < 10) {
      newErrors.description = 'La descripcion debe tener al menos 10 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [categoryId, title, description]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;

    createTicket(
      {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        priority,
        location: location.trim() || undefined,
        photo_paths: photoPaths.length > 0 ? photoPaths : undefined,
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: (error) => {
          Alert.alert('Error', error.message);
        },
      }
    );
  }, [title, description, categoryId, priority, location, photoPaths, validate, createTicket, router]);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
            <Text className="text-blue-600 text-base">Cancelar</Text>
          </Pressable>
          <Text className="text-xl font-bold text-gray-900">Nuevo Reporte</Text>
        </View>

        {/* Category picker */}
        <Text className="text-sm font-medium text-gray-700 mb-2">Categoria *</Text>
        {categoriesLoading ? (
          <ActivityIndicator size="small" color="#2563eb" className="mb-4" />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-1"
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {(categories ?? []).map((cat) => {
              const selected = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setCategoryId(cat.id);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.category;
                      return next;
                    });
                  }}
                  className={`rounded-full px-4 py-2 border ${
                    selected
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selected ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {errors.category ? (
          <Text className="text-red-500 text-xs mb-3">{errors.category}</Text>
        ) : (
          <View className="mb-3" />
        )}

        {/* Title */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Titulo *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-1 bg-white"
          placeholder="Titulo breve del problema"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (errors.title) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.title;
                return next;
              });
            }
          }}
          autoCapitalize="sentences"
          maxLength={200}
        />
        {errors.title ? (
          <Text className="text-red-500 text-xs mb-3">{errors.title}</Text>
        ) : (
          <View className="mb-3" />
        )}

        {/* Description */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Descripcion *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-1 bg-white"
          placeholder="Describe el problema en detalle..."
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            if (errors.description) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.description;
                return next;
              });
            }
          }}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{ minHeight: 100 }}
        />
        {errors.description ? (
          <Text className="text-red-500 text-xs mb-3">{errors.description}</Text>
        ) : (
          <View className="mb-3" />
        )}

        {/* Priority */}
        <Text className="text-sm font-medium text-gray-700 mb-2">Prioridad</Text>
        <View className="flex-row gap-2 mb-4">
          {PRIORITY_OPTIONS.map((opt) => {
            const selected = priority === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setPriority(opt.value)}
                className={`flex-1 rounded-lg py-2 items-center ${
                  selected ? opt.activeColor : opt.color
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    selected ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Location */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Ubicacion (opcional)</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="Ubicacion (ej: Estacionamiento nivel 2)"
          value={location}
          onChangeText={setLocation}
        />

        {/* Photos */}
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Fotos ({photoPaths.length}/{MAX_PHOTOS})
        </Text>

        {/* Photo previews */}
        {photoPaths.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mb-3">
            {photoPaths.map((path, index) => (
              <View key={path} className="relative">
                <Image
                  source={{ uri: getPublicUrl(path) }}
                  className="w-20 h-20 rounded-lg"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => removePhoto(index)}
                  className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
                >
                  <Text className="text-white text-xs font-bold">X</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {photoPaths.length < MAX_PHOTOS ? (
          <Pressable
            onPress={handlePickPhoto}
            disabled={uploading}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 items-center mb-6 active:opacity-80"
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <>
                <Text className="text-2xl mb-1">+</Text>
                <Text className="text-gray-500 text-sm">Agregar foto</Text>
              </>
            )}
          </Pressable>
        ) : (
          <View className="mb-6" />
        )}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={isPending || uploading}
          className={`rounded-lg p-4 items-center ${
            isPending || uploading ? 'bg-blue-400' : 'bg-blue-600 active:opacity-80'
          }`}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-white font-semibold text-base">Enviar Reporte</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
