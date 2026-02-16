import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useMyPets ----------

export function useMyPets() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: queryKeys.pets.list(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, species, breed, color, weight_kg, date_of_birth, photo_url, status, is_service_animal, microchip_number, registration_number, special_needs, notes')
        .eq('resident_id', residentId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId,
  });
}

// ---------- useCreatePet ----------

interface CreatePetInput {
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'fish' | 'reptile' | 'rodent' | 'other';
  breed?: string;
  color?: string;
  weight_kg?: number;
  date_of_birth?: string;
  is_service_animal?: boolean;
  special_needs?: string;
  notes?: string;
}

export function useCreatePet() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePetInput) => {
      const { data, error } = await supabase
        .from('pets')
        .insert({
          community_id: communityId!,
          resident_id: residentId!,
          name: input.name,
          species: input.species,
          breed: input.breed,
          color: input.color,
          weight_kg: input.weight_kg,
          date_of_birth: input.date_of_birth,
          is_service_animal: input.is_service_animal ?? false,
          special_needs: input.special_needs,
          notes: input.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pets._def });
    },
  });
}

// ---------- useDeletePet ----------

export function useDeletePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (petId: string) => {
      const { error } = await supabase
        .from('pets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', petId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pets._def });
    },
  });
}
