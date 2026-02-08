'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────

export interface Unit {
  id: string;
  unit_number: string;
  unit_type: string;
  area_m2: number | null;
  floor_number: number | null;
  building: string | null;
  coefficient: number;
  status: string;
  address_line: string | null;
  parking_spaces: number;
  created_at: string;
  occupancy_count?: number;
}

export interface UnitDetail extends Unit {
  occupancies: {
    id: string;
    occupancy_type: string;
    start_date: string;
    end_date: string | null;
    status: string;
    notes: string | null;
    residents: {
      id: string;
      first_name: string;
      paternal_surname: string;
      maternal_surname: string | null;
      email: string | null;
      phone: string | null;
    };
  }[];
}

type UnitType = 'casa' | 'departamento' | 'local' | 'bodega' | 'oficina' | 'terreno' | 'estacionamiento';

interface UpdateUnitInput {
  id: string;
  unit_number?: string;
  unit_type?: UnitType;
  area_m2?: number | null;
  floor_number?: number | null;
  building?: string | null;
  coefficient?: number;
  address_line?: string | null;
  parking_spaces?: number;
}

// ── Query: Unit list ────────────────────────────────────────────────

/**
 * Fetch paginated list of units for the admin's community.
 * Includes a count of active occupancies per unit.
 */
export function useUnits(search?: string, page = 0, pageSize = 20) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.units.list(communityId!).queryKey, { search, page, pageSize }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('units')
        .select(
          'id, unit_number, unit_type, area_m2, floor_number, building, coefficient, status, address_line, parking_spaces, created_at',
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('unit_number', { ascending: true });

      if (search) {
        query = query.or(
          `unit_number.ilike.%${search}%,building.ilike.%${search}%,address_line.ilike.%${search}%`
        );
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

// ── Query: Unit detail with occupancies ─────────────────────────────

/**
 * Fetch a single unit with its active occupancies and resident info.
 */
export function useUnit(id: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.units.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('units')
        .select(
          '*, occupancies!occupancies_unit_id_fkey(id, occupancy_type, start_date, end_date, status, notes, residents!occupancies_resident_id_fkey(id, first_name, paternal_surname, maternal_surname, email, phone))'
        )
        .eq('id', id)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data as unknown as UnitDetail;
    },
    enabled: !!communityId && !!id,
  });
}

// ── Mutation: Update unit ───────────────────────────────────────────

/**
 * Update an existing unit's properties.
 */
export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateUnitInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('units')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Unidad actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.units._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(data.id).queryKey });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar unidad: ${error.message}`);
    },
  });
}

// ── Query: Unit options (for dropdowns) ─────────────────────────────

/**
 * Fetch all active units in the community for use in select dropdowns.
 * Returns a lightweight list with id + label.
 */
export function useUnitOptions() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['unit-options', communityId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, building')
        .eq('community_id', communityId!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('unit_number', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((u) => ({
        value: u.id,
        label: u.building ? `${u.unit_number} - ${u.building}` : u.unit_number,
      }));
    },
    enabled: !!communityId,
  });
}
