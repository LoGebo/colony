import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export function useResidentOccupancy(residentId?: string) {
  return useQuery({
    queryKey: queryKeys.occupancies.byResident(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('occupancies')
        .select('id, unit_id, occupancy_type, units(id, unit_number, building, floor_number)')
        .eq('resident_id', residentId!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId,
  });
}

/**
 * Convenience hook that resolves the current resident's primary unit.
 * Prioritizes "owner" occupancy type, then falls back to the first active occupancy.
 */
export function useResidentUnit() {
  const { residentId } = useAuth();
  const { data: occupancies, isLoading } = useResidentOccupancy(residentId);

  // Prefer owner occupancy, fall back to first active
  const primary =
    occupancies?.find((o) => o.occupancy_type === 'owner') ?? occupancies?.[0] ?? null;

  const unit = primary?.units as
    | { id: string; unit_number: string; building: string | null; floor_number: number | null }
    | null;

  return {
    unitId: unit?.id ?? null,
    unitNumber: unit?.unit_number ?? null,
    building: unit?.building ?? null,
    floorNumber: unit?.floor_number ?? null,
    isLoading,
  };
}
