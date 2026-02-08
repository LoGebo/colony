import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useCreateListing } from '@/hooks/useMarketplace';
import { pickAndUploadImage } from '@/lib/upload';

const CATEGORIES = [
  { label: 'Venta', value: 'sale' },
  { label: 'Servicio', value: 'service' },
  { label: 'Renta', value: 'rental' },
  { label: 'Buscado', value: 'wanted' },
] as const;

const MAX_PHOTOS = 5;

export default function CreateListingScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { mutate: createListing, isPending } = useCreateListing();

  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleAddPhoto = useCallback(async () => {
    if (imageUrls.length >= MAX_PHOTOS) {
      Alert.alert('Limite', `Maximo ${MAX_PHOTOS} fotos por publicacion`);
      return;
    }

    if (!communityId) return;

    setUploading(true);
    try {
      const path = await pickAndUploadImage(
        'community-assets',
        communityId,
        'marketplace',
      );
      if (path) {
        setImageUrls((prev) => [...prev, path]);
      }
    } finally {
      setUploading(false);
    }
  }, [imageUrls.length, communityId]);

  const handleRemovePhoto = useCallback((index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    // Validation
    if (!category) {
      Alert.alert('Error', 'Selecciona una categoria');
      return;
    }
    if (title.trim().length < 3) {
      Alert.alert('Error', 'El titulo debe tener al menos 3 caracteres');
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert('Error', 'La descripcion debe tener al menos 10 caracteres');
      return;
    }

    const priceNum = isFree ? null : price.trim() ? parseFloat(price.trim()) : null;
    if (!isFree && price.trim() && (isNaN(priceNum!) || priceNum! < 0)) {
      Alert.alert('Error', 'Precio invalido');
      return;
    }

    createListing(
      {
        category,
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        price_negotiable: priceNegotiable,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      },
      {
        onSuccess: () => {
          Alert.alert(
            'Publicacion enviada',
            'Tu publicacion esta en revision. Sera visible cuando un administrador la apruebe.',
            [{ text: 'OK', onPress: () => router.back() }],
          );
        },
        onError: (err) => Alert.alert('Error', err.message),
      },
    );
  }, [category, title, description, price, isFree, priceNegotiable, imageUrls, createListing, router]);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-xl font-bold text-gray-900 mb-6">Nueva Publicacion</Text>

        {/* Category picker */}
        <Text className="text-sm font-medium text-gray-700 mb-2">Categoria *</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.value}
              onPress={() => setCategory(cat.value)}
              className={`rounded-full px-4 py-2 ${
                category === cat.value ? 'bg-blue-600' : 'bg-white border border-gray-300'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  category === cat.value ? 'text-white' : 'text-gray-700'
                }`}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Title */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Titulo *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
          placeholder="Ej. Sofa de 3 plazas como nuevo"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          autoCapitalize="sentences"
        />

        {/* Description */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Descripcion *</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 mb-4 bg-white min-h-[100px]"
          placeholder="Describe tu publicacion con detalle..."
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
          textAlignVertical="top"
        />
        <Text className="text-xs text-gray-400 -mt-3 mb-4 text-right">
          {description.length}/500
        </Text>

        {/* Price */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-medium text-gray-700">Precio</Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-gray-500">Gratis</Text>
            <Switch
              value={isFree}
              onValueChange={(val) => {
                setIsFree(val);
                if (val) setPrice('');
              }}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
        {!isFree ? (
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-4 bg-white"
            placeholder="$0.00"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        ) : (
          <View className="mb-4" />
        )}

        {/* Price negotiable */}
        {!isFree ? (
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm text-gray-700">Precio negociable</Text>
            <Switch
              value={priceNegotiable}
              onValueChange={setPriceNegotiable}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor="#ffffff"
            />
          </View>
        ) : null}

        {/* Photos */}
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Fotos ({imageUrls.length}/{MAX_PHOTOS})
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {imageUrls.map((url, index) => (
            <View key={index} className="relative">
              <Image
                source={{ uri: url }}
                className="w-20 h-20 rounded-lg bg-gray-200"
                resizeMode="cover"
              />
              <Pressable
                onPress={() => handleRemovePhoto(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 items-center justify-center"
              >
                <Text className="text-white text-xs font-bold">X</Text>
              </Pressable>
            </View>
          ))}
          {imageUrls.length < MAX_PHOTOS ? (
            <Pressable
              onPress={handleAddPhoto}
              disabled={uploading}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 items-center justify-center"
            >
              {uploading ? (
                <Text className="text-gray-400 text-xs">...</Text>
              ) : (
                <Text className="text-gray-400 text-2xl">+</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={isPending || uploading}
          className={`rounded-lg p-4 items-center mt-2 mb-8 ${
            isPending || uploading ? 'bg-blue-400' : 'bg-blue-600 active:opacity-80'
          }`}
        >
          <Text className="text-white font-semibold text-base">
            {isPending ? 'Publicando...' : 'Publicar'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
