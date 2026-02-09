import { useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import * as Location from 'expo-location';

// ---------- useTriggerEmergency ----------

/**
 * Mutation to create an emergency alert with GPS capture.
 * Captures device GPS at trigger time via expo-location.
 * Inserts into emergency_alerts with auto-priority from DB trigger.
 */
export function useTriggerEmergency() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      emergency_type: string;
      location_description?: string;
    }) => {
      // Capture GPS coordinates at trigger time
      let locationLat: number | undefined;
      let locationLng: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          locationLat = location.coords.latitude;
          locationLng = location.coords.longitude;
        }
      } catch {
        // GPS capture is best-effort; continue without coordinates
      }

      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert({
          community_id: communityId!,
          emergency_type: input.emergency_type,
          triggered_by: user!.id,
          location_description: input.location_description,
          location_lat: locationLat,
          location_lng: locationLng,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emergencies._def });
    },
  });
}

// ---------- useActiveEmergencies ----------

/**
 * Query for active (non-resolved, non-false-alarm) emergency alerts.
 * Ordered by creation time descending.
 */
export function useActiveEmergencies(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.emergencies.active(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emergency_alerts')
        .select(
          'id, emergency_type, status, priority_level, triggered_by, triggered_at, location_description'
        )
        .eq('community_id', communityId!)
        .not('status', 'in', '("resolved","false_alarm")')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useProviderAccessCheck ----------

/**
 * Mutation to check if a provider is currently authorized via RPC.
 * Calls is_provider_access_allowed(p_provider_id, p_check_time).
 */
export function useProviderAccessCheck() {
  return useMutation({
    mutationFn: async (providerId: string) => {
      const { data, error } = await supabase.rpc('is_provider_access_allowed', {
        p_provider_id: providerId,
        p_check_time: new Date().toISOString(),
      });

      if (error) throw error;
      return data as boolean;
    },
  });
}

// ---------- useProviderPersonnelSearch ----------

/**
 * Searches provider personnel by first_name or last_name.
 * Joins to providers to get company name and status.
 * Only returns personnel from active providers.
 * Debounce-friendly: enabled when query length >= 2.
 */
export function useProviderPersonnelSearch(
  query: string,
  communityId?: string
) {
  return useQuery({
    queryKey: [...queryKeys.providers.list(communityId!).queryKey, 'personnel-search', query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_personnel')
        .select(
          'id, first_name, last_name, position, photo_url, provider_id, providers(id, company_name, status)'
        )
        .eq('providers.community_id', communityId!)
        .eq('providers.status', 'active' as never)
        .is('deleted_at', null)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && query.length >= 2,
  });
}
