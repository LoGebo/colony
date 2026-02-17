import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Linking } from 'react-native';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useResidentUnit } from './useOccupancy';

// ---------- Shared select string for listings ----------

const LISTING_SELECT = `
  id, category, title, description, price, price_negotiable,
  image_urls, view_count, inquiry_count, moderation_status,
  is_sold, sold_at, created_at, expires_at, seller_id, deleted_at,
  residents!marketplace_listings_seller_id_fkey(
    id, first_name, paternal_surname, photo_url, phone
  )
`;

// ---------- useMarketplaceListings ----------

export function useMarketplaceListings(category?: string | null) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.marketplace.list(communityId!).queryKey, category ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_listings')
        .select(LISTING_SELECT)
        .eq('community_id', communityId!)
        .eq('moderation_status', 'approved')
        .eq('is_sold', false)
        .is('deleted_at', null)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (category) {
        query = query.eq('category', category as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useMyListings ----------

export function useMyListings() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: queryKeys.marketplace.myListings(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select(LISTING_SELECT)
        .eq('seller_id', residentId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId,
  });
}

// ---------- useListingDetail ----------

export function useListingDetail(listingId: string) {
  return useQuery({
    queryKey: queryKeys.marketplace.detail(listingId).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select(LISTING_SELECT)
        .eq('id', listingId)
        .single();

      if (error) throw error;

      // Fire-and-forget view count increment
      supabase.rpc('increment_listing_view_count', { p_listing_id: listingId })
        .then(({ error: rpcErr }) => { if (rpcErr) console.warn('View count RPC failed:', rpcErr.message); });

      return data;
    },
    enabled: !!listingId,
  });
}

// ---------- useCreateListing ----------

interface CreateListingInput {
  category: string;
  title: string;
  description: string;
  price?: number | null;
  price_negotiable?: boolean;
  image_urls?: string[];
}

export function useCreateListing() {
  const { residentId, communityId } = useAuth();
  const { unitId } = useResidentUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateListingInput) => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .insert({
          community_id: communityId!,
          seller_id: residentId!,
          unit_id: unitId ?? undefined,
          category: input.category as any,
          title: input.title,
          description: input.description,
          price: input.price ?? undefined,
          price_negotiable: input.price_negotiable ?? false,
          image_urls: input.image_urls && input.image_urls.length > 0
            ? input.image_urls
            : undefined,
          moderation_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace._def });
    },
  });
}

// ---------- useMarkAsSold ----------

export function useMarkAsSold(listingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .update({
          is_sold: true,
          sold_at: new Date().toISOString(),
        })
        .eq('id', listingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace._def });
    },
  });
}

// ---------- useDeleteListing ----------

export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from('marketplace_listings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace._def });
    },
  });
}

// ---------- handleContactSeller ----------

export async function handleContactSeller(
  sellerPhone: string,
  listingTitle: string,
  listingId: string,
) {
  const message = `Hola! Me interesa tu publicacion: "${listingTitle}" en UPOE Marketplace`;
  const encoded = encodeURIComponent(message);

  // Fire-and-forget inquiry count increment
  supabase.rpc('increment_listing_inquiry_count', { p_listing_id: listingId })
    .then(({ error: rpcErr }) => { if (rpcErr) console.warn('Inquiry count RPC failed:', rpcErr.message); });

  // Try WhatsApp first
  const waUrl = `whatsapp://send?phone=${sellerPhone}&text=${encoded}`;
  const canOpenWA = await Linking.canOpenURL(waUrl);

  if (canOpenWA) {
    await Linking.openURL(waUrl);
    return;
  }

  // Fallback to SMS
  const smsUrl = `sms:${sellerPhone}?body=${encoded}`;
  await Linking.openURL(smsUrl);
}
