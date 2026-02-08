import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';

export function useCommunityBranding(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.communities.detail(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communities')
        .select('id, name, logo_url, cover_image_url, primary_color, secondary_color')
        .eq('id', communityId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}
