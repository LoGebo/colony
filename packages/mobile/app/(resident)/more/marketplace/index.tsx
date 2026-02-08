import { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useMarketplaceListings, useMyListings } from '@/hooks/useMarketplace';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { CategoryFilter } from '@/components/marketplace/CategoryFilter';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';

type TabKey = 'community' | 'mine';

export default function MarketplaceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('community');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const {
    data: communityListings,
    isLoading: loadingCommunity,
    isRefetching: refetchingCommunity,
    refetch: refetchCommunity,
  } = useMarketplaceListings(selectedCategory);

  const {
    data: myListings,
    isLoading: loadingMine,
    isRefetching: refetchingMine,
    refetch: refetchMine,
  } = useMyListings();

  const isLoading = activeTab === 'community' ? loadingCommunity : loadingMine;
  const isRefetching = activeTab === 'community' ? refetchingCommunity : refetchingMine;
  const listings = activeTab === 'community' ? communityListings : myListings;

  const handleRefresh = useCallback(() => {
    if (activeTab === 'community') {
      refetchCommunity();
    } else {
      refetchMine();
    }
  }, [activeTab, refetchCommunity, refetchMine]);

  const emptyMessage =
    activeTab === 'community'
      ? 'No hay publicaciones en esta categoria'
      : 'No has publicado nada aun';

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof listings extends (infer U)[] | undefined | null ? U : never); index: number }) => (
      <View
        className="flex-1 p-1.5"
        style={{ maxWidth: '50%' }}
      >
        <ListingCard listing={item} showStatus={activeTab === 'mine'} />
      </View>
    ),
    [activeTab],
  );

  if (isLoading) {
    return <LoadingSpinner message="Cargando publicaciones..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900">Marketplace</Text>
      </View>

      {/* Tab switcher */}
      <View className="flex-row mx-4 mb-2 bg-gray-200 rounded-lg p-1">
        <Pressable
          onPress={() => setActiveTab('community')}
          className={`flex-1 items-center py-2 rounded-md ${
            activeTab === 'community' ? 'bg-white shadow-sm' : ''
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === 'community' ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            Comunidad
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('mine')}
          className={`flex-1 items-center py-2 rounded-md ${
            activeTab === 'mine' ? 'bg-white shadow-sm' : ''
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === 'mine' ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            Mis Publicaciones
          </Text>
        </Pressable>
      </View>

      {/* Category filter (only for community tab) */}
      {activeTab === 'community' ? (
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      ) : null}

      {/* Listing grid */}
      <FlatList
        data={listings ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={<EmptyState message={emptyMessage} icon={'🏪'} />}
      />

      {/* FAB - Create listing */}
      <Pressable
        onPress={() => router.push('/(resident)/more/marketplace/create')}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg active:opacity-80"
        style={{ elevation: 6 }}
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </Pressable>
    </View>
  );
}
