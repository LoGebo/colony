import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useResidentSearch ----------

export function useResidentSearch(query: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.residents.list(communityId!).queryKey, { search: query }],
    queryFn: async () => {
      let q = supabase
        .from('residents')
        .select(
          'id, first_name, paternal_surname, maternal_surname, email, phone, occupancies(unit_id, units(unit_number, building))'
        )
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('paternal_surname', { ascending: true })
        .limit(50);

      const trimmed = query.trim();
      if (trimmed) {
        q = q.or(
          `first_name.ilike.%${trimmed}%,paternal_surname.ilike.%${trimmed}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!communityId && query.length >= 2,
  });
}

// ---------- useUnitSearch ----------

export function useUnitSearch(unitNumber: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.units.list(communityId!).queryKey, { search: unitNumber }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select(
          'id, unit_number, building, floor_number, occupancies(resident_id, residents(id, first_name, paternal_surname, phone))'
        )
        .eq('community_id', communityId!)
        .ilike('unit_number', `%${unitNumber}%`)
        .is('deleted_at', null)
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && unitNumber.length >= 1,
  });
}

// ---------- useVehicleSearch ----------

export function useVehicleSearch(plate: string) {
  const { communityId } = useAuth();
  const normalized = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  return useQuery({
    queryKey: ['vehicles', communityId, { search: plate }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(
          'id, plate_number, plate_normalized, plate_state, make, model, year, color, access_enabled, residents(id, first_name, paternal_surname, occupancies(units(unit_number)))'
        )
        .eq('community_id', communityId!)
        .ilike('plate_normalized', `%${normalized}%`)
        .is('deleted_at', null)
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && plate.length >= 3,
  });
}

// ---------- useBlacklistCheck ----------
// Local implementation since useGateOps (10-04) may not exist yet

export function useBlacklistCheck(params: {
  personName?: string;
  personDocument?: string;
  plateNormalized?: string;
}) {
  const { communityId } = useAuth();
  const { personName, personDocument, plateNormalized } = params;

  const hasInput = !!(personName || personDocument || plateNormalized);

  return useQuery({
    queryKey: ['blacklist-check', communityId, { personName, personDocument, plateNormalized }],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_blacklisted', {
        p_community_id: communityId!,
        p_person_name: personName,
        p_person_document: personDocument,
        p_plate_normalized: plateNormalized,
      });

      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!communityId && hasInput,
  });
}
