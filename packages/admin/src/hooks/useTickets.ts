'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Valid status transitions (matches DB trigger)                     */
/* ------------------------------------------------------------------ */

export const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'open', 'cancelled'],
  in_progress: ['pending_parts', 'pending_resident', 'resolved', 'assigned'],
  pending_parts: ['in_progress', 'cancelled'],
  pending_resident: ['in_progress', 'resolved', 'cancelled'],
  resolved: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TicketRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  response_due_at: string | null;
  resolution_due_at: string | null;
  response_breached: boolean | null;
  resolution_breached: boolean | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  assigned_to: string | null;
  reported_by: string | null;
  ticket_categories: { name: string; icon: string | null; color: string | null } | null;
  residents: { first_name: string; paternal_surname: string } | null;
}

export interface TicketDetail extends TicketRow {
  ticket_assignments: {
    id: string;
    assigned_to: string;
    assigned_by: string | null;
    notes: string | null;
    assigned_at: string;
  }[];
  ticket_comments: {
    id: string;
    content: string;
    author_id: string | null;
    author_role: string | null;
    is_system: boolean;
    is_internal: boolean;
    photo_urls: string[] | null;
    created_at: string;
  }[];
}

interface TicketFilters {
  search?: string;
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

const TICKET_SELECT =
  'id, title, description, status, priority, created_at, response_due_at, resolution_due_at, response_breached, resolution_breached, first_responded_at, resolved_at, assigned_to, reported_by, ticket_categories(name, icon, color), residents!tickets_reported_by_fkey(first_name, paternal_surname)';

/**
 * Paginated ticket list with search, status, and priority filters.
 */
export function useTickets(filters: TicketFilters = {}) {
  const { communityId } = useAuth();
  const { search, status, priority, page = 0, pageSize = 20 } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.tickets.list(communityId!).queryKey,
      { search, status, priority, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('tickets')
        .select(TICKET_SELECT, { count: 'exact' })
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%`
        );
      }
      if (status) {
        query = query.eq('status', status as never);
      }
      if (priority) {
        query = query.eq('priority', priority as never);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as unknown as TicketRow[], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

/**
 * Single ticket with assignments and comments.
 */
export function useTicket(id: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.tickets.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tickets')
        .select(
          `${TICKET_SELECT}, ticket_assignments(id, assigned_to, assigned_by, notes, assigned_at), ticket_comments(id, content, author_id, author_role, is_system, is_internal, photo_urls, created_at)`
        )
        .eq('id', id)
        .eq('community_id', communityId!)
        .single();

      if (error) throw error;
      return data as unknown as TicketDetail;
    },
    enabled: !!communityId && !!id,
  });
}

/**
 * Ticket categories for the community.
 */
export function useTicketCategories() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.tickets.list(communityId!).queryKey, 'categories'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('ticket_categories')
        .select('id, name, icon, color')
        .eq('community_id', communityId!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Assign a ticket to a staff member.
 */
export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      assignedTo,
      notes,
    }: {
      ticketId: string;
      assignedTo: string;
      notes?: string;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Insert assignment record
      const { error: assignErr } = await supabase
        .from('ticket_assignments')
        .insert({
          ticket_id: ticketId,
          assigned_to: assignedTo,
          assigned_by: user!.id,
          notes: notes ?? null,
        });
      if (assignErr) throw assignErr;

      // Auto-transition from open -> assigned (no-op if already past open)
      const { error: statusErr } = await supabase
        .from('tickets')
        .update({ status: 'assigned', assigned_to: assignedTo })
        .eq('id', ticketId)
        .eq('status', 'open');
      // Ignore status error -- may already be assigned
      if (statusErr) {
        // Just update assigned_to without status change
        await supabase
          .from('tickets')
          .update({ assigned_to: assignedTo })
          .eq('id', ticketId);
      }
    },
    onSuccess: () => {
      toast.success('Ticket asignado exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al asignar ticket: ${error.message}`);
    },
  });
}

/**
 * Update ticket status. DB trigger validates transitions.
 */
export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      newStatus,
    }: {
      ticketId: string;
      newStatus: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus as never })
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Estado actualizado');
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar estado: ${error.message}`);
    },
  });
}

/**
 * Add a comment to a ticket.
 */
export function useAddTicketComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      content,
      isInternal = false,
    }: {
      ticketId: string;
      content: string;
      isInternal?: boolean;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        author_id: user!.id,
        author_role: 'admin',
        content,
        is_internal: isInternal,
        is_system: false,
      });

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success('Comentario agregado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.tickets.detail(variables.ticketId).queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(`Error al agregar comentario: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  SLA Metrics Utility                                               */
/* ------------------------------------------------------------------ */

export interface SLAMetrics {
  total: number;
  openCount: number;
  responseBreachRate: number;
  resolutionBreachRate: number;
  avgResponseMinutes: number;
  avgResolutionMinutes: number;
}

/**
 * Compute SLA metrics from a list of tickets.
 */
export function computeSLAMetrics(tickets: TicketRow[]): SLAMetrics {
  const total = tickets.length;
  const openCount = tickets.filter((t) => t.status === 'open').length;

  const withResponseDue = tickets.filter((t) => t.response_due_at);
  const responseBreached = withResponseDue.filter((t) => t.response_breached).length;
  const responseBreachRate =
    withResponseDue.length > 0 ? (responseBreached / withResponseDue.length) * 100 : 0;

  const withResolutionDue = tickets.filter((t) => t.resolution_due_at);
  const resolutionBreached = withResolutionDue.filter((t) => t.resolution_breached).length;
  const resolutionBreachRate =
    withResolutionDue.length > 0 ? (resolutionBreached / withResolutionDue.length) * 100 : 0;

  // Avg response time (minutes)
  const responded = tickets.filter((t) => t.first_responded_at && t.created_at);
  const avgResponseMinutes =
    responded.length > 0
      ? responded.reduce((sum, t) => {
          const diff =
            new Date(t.first_responded_at!).getTime() - new Date(t.created_at).getTime();
          return sum + diff / 60000;
        }, 0) / responded.length
      : 0;

  // Avg resolution time (minutes)
  const resolved = tickets.filter((t) => t.resolved_at && t.created_at);
  const avgResolutionMinutes =
    resolved.length > 0
      ? resolved.reduce((sum, t) => {
          const diff =
            new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime();
          return sum + diff / 60000;
        }, 0) / resolved.length
      : 0;

  return {
    total,
    openCount,
    responseBreachRate,
    resolutionBreachRate,
    avgResponseMinutes,
    avgResolutionMinutes,
  };
}
