'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/../../supabase/database.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type EmergencyContactRow = Database['public']['Tables']['emergency_contacts']['Row'];
type MedicalConditionRow = Database['public']['Tables']['medical_conditions']['Row'];
type AccessibilityNeedRow = Database['public']['Tables']['accessibility_needs']['Row'];

export interface EmergencyContactWithResident extends EmergencyContactRow {
  residents: {
    first_name: string;
    paternal_surname: string;
  } | null;
}

export interface MedicalConditionWithResident extends MedicalConditionRow {
  residents: {
    first_name: string;
    paternal_surname: string;
  } | null;
}

export interface AccessibilityNeedWithResident extends AccessibilityNeedRow {
  residents: {
    first_name: string;
    paternal_surname: string;
  } | null;
}

export interface EmergencyContactForUnit {
  resident_id: string;
  resident_name: string;
  contact_name: string;
  relationship: Database['public']['Enums']['emergency_contact_relationship'];
  phone_primary: string;
  phone_secondary: string;
  priority: number;
  contact_for: string[];
}

export interface EvacuationListItem {
  resident_id: string;
  resident_name: string;
  unit_id: string;
  unit_number: string;
  floor_number: number;
  needs_evacuation_assistance: boolean;
  uses_mobility_device: boolean;
  mobility_device_type: Database['public']['Enums']['mobility_device_type'] | null;
  need_type: Database['public']['Enums']['accessibility_need_type'] | null;
  evacuation_notes: string;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Get emergency contacts for a specific unit via RPC.
 * Returns all contacts for residents in that unit.
 */
export function useEmergencyContactsByUnit(unitId: string | null) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys['emergency-contacts'].byUnit(unitId ?? '').queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc('get_emergency_contacts_for_unit', { p_unit_id: unitId! })
        .returns<EmergencyContactForUnit[]>();

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId && !!unitId,
  });
}

/**
 * Get all emergency contacts for the community (paginated).
 * Joins with residents table to show resident name.
 */
export function useAllEmergencyContacts(page: number, pageSize: number) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [
      ...queryKeys['emergency-contacts'].all.queryKey,
      { communityId, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      const from = page * pageSize;

      const { data, error, count } = await supabase
        .from('emergency_contacts')
        .select('*, residents(first_name, paternal_surname)', { count: 'exact' })
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('contact_name')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      return {
        data: (data ?? []) as EmergencyContactWithResident[],
        count: count ?? 0,
      };
    },
    enabled: !!communityId,
  });
}

/**
 * Get all medical conditions for the community.
 * Includes resident name for display.
 */
export function useMedicalConditions() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys['emergency-contacts'].medical(communityId!).queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('medical_conditions')
        .select('*, residents(first_name, paternal_surname)')
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as MedicalConditionWithResident[];
    },
    enabled: !!communityId,
  });
}

/**
 * Get all accessibility needs for the community.
 * Includes resident name for display.
 */
export function useAccessibilityNeeds() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [
      ...queryKeys['emergency-contacts'].medical(communityId!).queryKey,
      'accessibility',
    ],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('accessibility_needs')
        .select('*, residents(first_name, paternal_surname)')
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AccessibilityNeedWithResident[];
    },
    enabled: !!communityId,
  });
}

/**
 * Get evacuation priority list from RPC.
 * Returns list sorted by floor (highest first) with medical/accessibility info.
 */
export function useEvacuationList() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys['emergency-contacts'].evacuation(communityId!).queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc('get_evacuation_priority_list', { p_community_id: communityId! })
        .returns<EvacuationListItem[]>();

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId,
  });
}
