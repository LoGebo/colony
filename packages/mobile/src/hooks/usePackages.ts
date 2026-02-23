import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { Database } from '@upoe/shared';

// ---------- Types ----------

type PackageCarrier = Database['public']['Enums']['package_carrier'];

interface LogPackageInput {
  carrier: PackageCarrier;
  carrier_other?: string;
  tracking_number?: string;
  recipient_unit_id: string;
  recipient_name: string;
  description?: string;
  package_count?: number;
  is_oversized?: boolean;
  label_photo_url?: string;
}

// ---------- usePendingPackages ----------

export function usePendingPackages() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.packages.pending(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select(
          'id, carrier, carrier_other, tracking_number, recipient_name, recipient_unit_id, description, package_count, is_oversized, photo_url, label_photo_url, status, received_at, units:recipient_unit_id(unit_number, building)'
        )
        .eq('community_id', communityId!)
        .in('status', ['received', 'stored', 'notified', 'pending_pickup'])
        .is('deleted_at', null)
        .order('received_at', { ascending: false });

      if (error) throw error;

      // Sort by unit_number first, then by received_at DESC (already ordered)
      const sorted = (data ?? []).sort((a, b) => {
        const unitA = (a.units as { unit_number: string } | null)?.unit_number ?? '';
        const unitB = (b.units as { unit_number: string } | null)?.unit_number ?? '';
        if (unitA !== unitB) return unitA.localeCompare(unitB);
        return 0; // already ordered by received_at DESC from query
      });

      return sorted;
    },
    enabled: !!communityId,
  });
}

// ---------- usePackageDetail ----------

export function usePackageDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.packages.detail(id).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select(
          '*, units:recipient_unit_id(unit_number, building), residents:recipient_resident_id(first_name, paternal_surname, phone), package_pickup_codes(id, code_type, code_value, status, valid_until)'
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// ---------- useLogPackage ----------

export function useLogPackage() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogPackageInput) => {
      const { data, error } = await supabase
        .from('packages')
        .insert({
          carrier: input.carrier,
          carrier_other: input.carrier_other,
          tracking_number: input.tracking_number,
          recipient_unit_id: input.recipient_unit_id,
          recipient_name: input.recipient_name,
          description: input.description,
          package_count: input.package_count ?? 1,
          is_oversized: input.is_oversized ?? false,
          label_photo_url: input.label_photo_url,
          community_id: communityId!,
          received_by: user?.id ?? undefined,
          received_at: new Date().toISOString(),
          status: 'received' as const,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.packages._def });
    },
  });
}

// ---------- useConfirmPickup ----------

export function useConfirmPickup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      packageId,
      pickupCode,
    }: {
      packageId: string;
      pickupCode?: string;
    }) => {
      // 1. If pickup code is provided, verify it
      if (pickupCode) {
        const { data: codes, error: codeError } = await supabase
          .from('package_pickup_codes')
          .select('id, status, valid_until')
          .eq('package_id', packageId)
          .eq('code_value', pickupCode)
          .eq('status', 'active');

        if (codeError) throw codeError;

        const validCode = codes?.find(
          (c) => new Date(c.valid_until) > new Date()
        );

        if (!validCode) {
          throw new Error('Codigo de recoleccion invalido');
        }

        // Mark code as used
        const { error: updateCodeError } = await supabase
          .from('package_pickup_codes')
          .update({
            status: 'used' as const,
            used_at: new Date().toISOString(),
            used_by: user?.id ?? undefined,
          })
          .eq('id', validCode.id);

        if (updateCodeError) throw updateCodeError;
      }

      // 2. Walk through intermediate states to reach picked_up
      //    The DB trigger enforces: received→stored→notified→pending_pickup→picked_up
      const { data: pkg } = await supabase
        .from('packages')
        .select('status')
        .eq('id', packageId)
        .single();

      const currentStatus = pkg?.status as string;
      const stateWalk: string[] = [];

      if (currentStatus === 'received') stateWalk.push('stored', 'notified', 'pending_pickup');
      else if (currentStatus === 'stored') stateWalk.push('notified', 'pending_pickup');
      else if (currentStatus === 'notified') stateWalk.push('pending_pickup');
      // pending_pickup can go directly to picked_up

      for (const intermediateStatus of stateWalk) {
        const { error: walkError } = await supabase
          .from('packages')
          .update({ status: intermediateStatus as any })
          .eq('id', packageId);
        if (walkError) throw walkError;
      }

      const { data, error } = await supabase
        .from('packages')
        .update({
          status: 'picked_up' as const,
          picked_up_at: new Date().toISOString(),
          picked_up_by: user?.id ?? undefined,
        })
        .eq('id', packageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.packages._def });
    },
  });
}
