'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/../../supabase/database.types';

/* ------------------------------------------------------------------ */
/*  Manual Types (tables not in database.types.ts)                   */
/* ------------------------------------------------------------------ */

export interface DeviceRow {
  id: string;
  community_id: string;
  device_type_id: string;
  serial_number: string;
  internal_code: string | null;
  batch_number: string | null;
  purchased_at: string | null;
  vendor: string | null;
  status: Database['public']['Enums']['device_status'];
  status_changed_at: string;
  current_assignment_id: string | null;
  created_at: string;
  // Joined
  access_device_types?: {
    name: string;
    device_type: Database['public']['Enums']['device_type'];
  };
}

export interface DeviceTypeRow {
  id: string;
  community_id: string;
  device_type: Database['public']['Enums']['device_type'];
  name: string;
  description: string | null;
  deposit_amount: number;
  replacement_fee: number;
  is_active: boolean;
  created_at: string;
}

export interface DeviceAssignmentRow {
  id: string;
  access_device_id: string;
  unit_id: string;
  resident_id: string | null;
  assigned_at: string;
  returned_at: string | null;
  deposit_collected: boolean;
  deposit_amount: number | null;
  deposit_returned_at: string | null;
  replacement_fee_charged: boolean;
  condition_notes: string | null;
  assigned_by: string | null;
  returned_to: string | null;
  is_active: boolean;
  // Joined
  units?: {
    unit_number: string;
  };
  residents?: {
    first_name: string;
    paternal_surname: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

export interface DeviceFilters {
  status?: Database['public']['Enums']['device_status'];
  deviceTypeId?: string;
  page: number;
  pageSize: number;
}

/**
 * List devices with filters and pagination.
 * Joins with device types for display.
 */
export function useDevices(filters: DeviceFilters) {
  const { communityId } = useAuth();
  const { status, deviceTypeId, page, pageSize } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.devices.list(communityId!).queryKey,
      { status, deviceTypeId, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      const from = page * pageSize;

      let query = supabase
        .from('access_devices' as any)
        .select('*, access_device_types(name, device_type)', { count: 'exact' })
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (status) query = query.eq('status', status);
      if (deviceTypeId) query = query.eq('device_type_id', deviceTypeId);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        data: (data ?? []) as unknown as DeviceRow[],
        count: count ?? 0,
      };
    },
    enabled: !!communityId,
  });
}

/**
 * Get single device detail with type info.
 */
export function useDeviceDetail(id: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.devices.detail(id).queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('access_devices' as any)
        .select('*, access_device_types(name, device_type)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as DeviceRow;
    },
    enabled: !!communityId && !!id,
  });
}

/**
 * Get assignment history for a device.
 * Joins with units and residents.
 */
export function useDeviceAssignments(deviceId: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.devices.assignments(deviceId).queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('access_device_assignments' as any)
        .select('*, units(unit_number), residents(first_name, paternal_surname)')
        .eq('access_device_id', deviceId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DeviceAssignmentRow[];
    },
    enabled: !!communityId && !!deviceId,
  });
}

/**
 * Get device types for community (active only).
 */
export function useDeviceTypes() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.devices.types(communityId!).queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('access_device_types' as any)
        .select('*')
        .eq('community_id', communityId!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data ?? []) as unknown as DeviceTypeRow[];
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

export interface CreateDeviceInput {
  device_type_id: string;
  serial_number: string;
  internal_code?: string;
  batch_number?: string;
  purchased_at?: string;
  vendor?: string;
  notes?: string;
}

/**
 * Create a new device (initial status: in_inventory).
 */
export function useCreateDevice() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDeviceInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('access_devices' as any)
        .insert({
          community_id: communityId!,
          device_type_id: input.device_type_id,
          serial_number: input.serial_number,
          internal_code: input.internal_code ?? null,
          batch_number: input.batch_number ?? null,
          purchased_at: input.purchased_at ?? null,
          vendor: input.vendor ?? null,
          status: 'in_inventory',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.list(communityId!).queryKey,
      });
    },
  });
}

export interface AssignDeviceInput {
  device_id: string;
  unit_id: string;
  resident_id?: string;
  deposit_amount: number;
  condition_notes?: string;
}

/**
 * Assign device to unit/resident.
 * Updates device status to 'assigned' and creates assignment record.
 */
export function useAssignDevice() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignDeviceInput) => {
      const supabase = createClient();

      // 1. Create assignment
      const { data: assignment, error: assignError } = await supabase
        .from('access_device_assignments' as any)
        .insert({
          access_device_id: input.device_id,
          unit_id: input.unit_id,
          resident_id: input.resident_id ?? null,
          deposit_collected: input.deposit_amount > 0,
          deposit_amount: input.deposit_amount,
          condition_notes: input.condition_notes ?? null,
          assigned_by: user?.id ?? null,
        } as any)
        .select()
        .single();

      if (assignError) throw assignError;

      // 2. Update device status and current_assignment_id
      const { error: updateError } = await supabase
        .from('access_devices' as any)
        .update({
          status: 'assigned',
          current_assignment_id: (assignment as unknown as { id: string }).id,
        } as any)
        .eq('id', input.device_id);

      if (updateError) throw updateError;

      return assignment;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.list(communityId!).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.detail(vars.device_id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.assignments(vars.device_id).queryKey,
      });
    },
  });
}

export interface ReturnDeviceInput {
  device_id: string;
  assignment_id: string;
  return_deposit: boolean;
  condition_notes?: string;
}

/**
 * Process device return.
 * Updates assignment returned_at and device status to 'in_inventory'.
 */
export function useReturnDevice() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReturnDeviceInput) => {
      const supabase = createClient();

      // 1. Update assignment as returned
      const { error: assignError } = await supabase
        .from('access_device_assignments' as any)
        .update({
          returned_at: new Date().toISOString(),
          deposit_returned_at: input.return_deposit ? new Date().toISOString() : null,
          returned_to: user?.id ?? null,
          condition_notes: input.condition_notes ?? null,
          is_active: false,
        } as any)
        .eq('id', input.assignment_id);

      if (assignError) throw assignError;

      // 2. Update device status back to in_inventory
      const { error: updateError } = await supabase
        .from('access_devices' as any)
        .update({
          status: 'in_inventory',
          current_assignment_id: null,
        } as any)
        .eq('id', input.device_id);

      if (updateError) throw updateError;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.list(communityId!).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.detail(vars.device_id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.assignments(vars.device_id).queryKey,
      });
    },
  });
}

export interface ReportLostInput {
  device_id: string;
  assignment_id?: string;
  charge_replacement_fee?: boolean;
}

/**
 * Report device as lost.
 * Updates device status to 'lost' and optionally charges replacement fee.
 */
export function useReportLost() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReportLostInput) => {
      const supabase = createClient();

      // 1. If assignment exists, charge replacement fee
      if (input.assignment_id && input.charge_replacement_fee) {
        const { error: feeError } = await supabase
          .from('access_device_assignments' as any)
          .update({
            replacement_fee_charged: true,
            is_active: false,
          } as any)
          .eq('id', input.assignment_id);

        if (feeError) throw feeError;
      }

      // 2. Update device status to lost
      const { error: updateError } = await supabase
        .from('access_devices' as any)
        .update({
          status: 'lost',
        } as any)
        .eq('id', input.device_id);

      if (updateError) throw updateError;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.list(communityId!).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices.detail(vars.device_id).queryKey,
      });
      if (vars.assignment_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.devices.assignments(vars.device_id).queryKey,
        });
      }
    },
  });
}
