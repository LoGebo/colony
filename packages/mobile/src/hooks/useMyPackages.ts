import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useResidentOccupancy } from './useOccupancy';

// ---------- useMyPackages ----------

/**
 * Fetch packages for the current resident's unit(s).
 * Uses the resident's occupancy to find their unit IDs,
 * then queries packages for those units.
 */
export function useMyPackages() {
  const { residentId, communityId } = useAuth();
  const { data: occupancies } = useResidentOccupancy(residentId);

  const unitIds = (occupancies ?? [])
    .map((o) => o.unit_id)
    .filter(Boolean) as string[];

  return useQuery({
    queryKey: [...queryKeys.packages.list(communityId!).queryKey, 'my', residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select(
          'id, tracking_number, carrier, carrier_other, description, status, received_at, picked_up_at, photo_url, recipient_name, package_pickup_codes(id, code_type, code_value, status, valid_until, used_at)'
        )
        .eq('community_id', communityId!)
        .in('recipient_unit_id', unitIds)
        .is('deleted_at', null)
        .order('received_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && !!residentId && unitIds.length > 0,
  });
}
