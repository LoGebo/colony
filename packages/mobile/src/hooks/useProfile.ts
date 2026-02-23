import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useGuardProfile ----------

export function useGuardProfile() {
  const { guardId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.guards.detail(guardId!).queryKey, 'profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guards')
        .select('id, first_name, paternal_surname, email, phone, photo_url')
        .eq('id', guardId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!guardId,
  });
}

// ---------- useResidentProfile ----------

export function useResidentProfile() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.residents.detail(residentId!).queryKey, 'profile'],
    queryFn: async () => {
      // Fetch resident info
      const { data: resident, error: resError } = await supabase
        .from('residents')
        .select('id, first_name, paternal_surname, maternal_surname, email, phone, phone_secondary, photo_url, onboarding_status')
        .eq('id', residentId!)
        .single();

      if (resError) throw resError;

      // Fetch emergency contacts
      const { data: contacts, error: contactsError } = await supabase
        .from('emergency_contacts')
        .select('id, contact_name, phone_primary, phone_secondary, relationship, is_active, priority')
        .eq('resident_id', residentId!)
        .is('deleted_at', null)
        .order('priority', { ascending: true });

      if (contactsError) throw contactsError;

      return {
        ...resident,
        emergencyContacts: contacts ?? [],
      };
    },
    enabled: !!residentId,
  });
}

// ---------- useUpdateProfile ----------

interface UpdateProfileInput {
  phone?: string;
  phone_secondary?: string;
  photo_url?: string;
}

export function useUpdateProfile() {
  const { residentId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { error } = await supabase
        .from('residents')
        .update(input)
        .eq('id', residentId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
    },
  });
}

// ---------- useUpdateEmergencyContact ----------

interface UpsertEmergencyContactInput {
  id?: string;
  contact_name: string;
  phone_primary: string;
  relationship: string;
  is_active?: boolean;
}

export function useUpdateEmergencyContact() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertEmergencyContactInput) => {
      if (input.id) {
        // Update existing contact
        const { error } = await supabase
          .from('emergency_contacts')
          .update({
            contact_name: input.contact_name,
            phone_primary: input.phone_primary,
            relationship: input.relationship as never,
            is_active: input.is_active ?? true,
          })
          .eq('id', input.id);

        if (error) throw error;
      } else {
        // Insert new contact
        const { error } = await supabase
          .from('emergency_contacts')
          .insert({
            community_id: communityId!,
            resident_id: residentId!,
            contact_name: input.contact_name,
            phone_primary: input.phone_primary,
            relationship: input.relationship as never,
            is_active: input.is_active ?? true,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
    },
  });
}
