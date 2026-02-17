'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastError } from '@/lib/toast-error';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

// ── Types ──────────────────────────────────────────────────────────

interface CommunityUpdate {
  name?: string;
  description?: string | null;
  timezone?: string;
  locale?: string;
  currency?: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

interface CommunitySettingsUpdate {
  management_phone?: string | null;
  management_email?: string | null;
  emergency_phone?: string | null;
  office_hours_start?: string | null;
  office_hours_end?: string | null;
  office_days?: number[] | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  pet_policy?: string | null;
  custom_rules?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  timezone?: string;
  locale?: string;
  currency?: string;
}

export interface AdminUser {
  id: string;
  firstName: string;
  paternalSurname: string;
  maternalSurname: string | null;
  email: string | null;
  phone: string | null;
  role: 'resident' | 'guard';
  status: string;
  userId: string;
  createdAt: string;
}

// ── Query: Community ───────────────────────────────────────────────

/**
 * Fetch the current community record.
 */
export function useCommunity() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.communities.detail(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('communities')
        .select(
          'id, name, slug, description, status, timezone, locale, currency, logo_url, cover_image_url, primary_color, secondary_color, settings, phone, email'
        )
        .eq('id', communityId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ── Query: Community Settings ──────────────────────────────────────

/**
 * Fetch community_settings for the current community.
 */
export function useCommunitySettings() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.communities.settings(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('community_settings')
        .select('*')
        .eq('community_id', communityId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ── Mutation: Update Community ─────────────────────────────────────

/**
 * Update the communities table (name, description, branding, etc.).
 */
export function useUpdateCommunity() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: CommunityUpdate) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('communities')
        .update(updates)
        .eq('id', communityId!)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Comunidad actualizada');
      queryClient.invalidateQueries({
        queryKey: queryKeys.communities.detail(communityId!).queryKey,
      });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar', error);
    },
  });
}

// ── Mutation: Update Community Settings ────────────────────────────

/**
 * Update the community_settings table (contact info, rules, etc.).
 */
export function useUpdateCommunitySettings() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: CommunitySettingsUpdate) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('community_settings')
        .update(updates)
        .eq('community_id', communityId!)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Configuracion guardada');
      queryClient.invalidateQueries({
        queryKey: queryKeys.communities.settings(communityId!).queryKey,
      });
    },
    onError: (error: Error) => {
      toastError('Error al guardar', error);
    },
  });
}

// ── Mutation: Update Feature Flags ─────────────────────────────────

/**
 * Update only the feature_flags JSONB column in community_settings.
 */
export function useUpdateFeatureFlags() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flags: Record<string, boolean>) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('community_settings')
        .update({ feature_flags: flags })
        .eq('community_id', communityId!)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Funcionalidades actualizadas');
      queryClient.invalidateQueries({
        queryKey: queryKeys.communities.settings(communityId!).queryKey,
      });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar funcionalidades', error);
    },
  });
}

// ── Query: Admin Users (Residents + Guards with user_id) ───────────

/**
 * Fetch all residents and guards who have signed up (user_id not null).
 * Combined into a unified list for the role management page.
 */
export function useAdminUsers() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['admin-users', communityId],
    queryFn: async () => {
      const supabase = createClient();

      // Fetch residents with user accounts
      const { data: residents, error: resError } = await supabase
        .from('residents')
        .select(
          'id, first_name, paternal_surname, maternal_surname, email, phone, onboarding_status, user_id, created_at'
        )
        .eq('community_id', communityId!)
        .not('user_id', 'is', null)
        .is('deleted_at', null)
        .order('first_name', { ascending: true });

      if (resError) throw resError;

      // Fetch guards with user accounts
      const { data: guards, error: guardError } = await supabase
        .from('guards')
        .select(
          'id, first_name, paternal_surname, maternal_surname, email, phone, employment_status, user_id, created_at'
        )
        .eq('community_id', communityId!)
        .not('user_id', 'is', null)
        .is('deleted_at', null)
        .order('first_name', { ascending: true });

      if (guardError) throw guardError;

      const users: AdminUser[] = [];

      for (const r of residents ?? []) {
        users.push({
          id: r.id,
          firstName: r.first_name,
          paternalSurname: r.paternal_surname,
          maternalSurname: r.maternal_surname,
          email: r.email,
          phone: r.phone,
          role: 'resident',
          status: r.onboarding_status,
          userId: r.user_id!,
          createdAt: r.created_at,
        });
      }

      for (const g of guards ?? []) {
        users.push({
          id: g.id,
          firstName: g.first_name,
          paternalSurname: g.paternal_surname,
          maternalSurname: g.maternal_surname,
          email: g.email,
          phone: g.phone,
          role: 'guard',
          status: g.employment_status,
          userId: g.user_id!,
          createdAt: g.created_at,
        });
      }

      return users;
    },
    enabled: !!communityId,
  });
}
