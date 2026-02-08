import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useResidentUnit } from './useOccupancy';

// ---------- useMyTickets ----------

export function useMyTickets() {
  const { residentId, communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.tickets.list(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, title, status, priority, created_at, ticket_categories(name, icon, color)')
        .eq('community_id', communityId!)
        .eq('reported_by', residentId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId && !!communityId,
  });
}

// ---------- useTicketDetail ----------

export function useTicketDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.tickets.detail(id).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(
          '*, ticket_categories(name, icon, color), ticket_comments(id, content, author_id, author_role, is_system, is_internal, photo_urls, created_at, status_from, status_to)'
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// ---------- useTicketCategories ----------

export function useTicketCategories() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['ticket-categories', communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_categories')
        .select('id, name, icon, color, description')
        .eq('community_id', communityId!)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useCreateTicket ----------

interface CreateTicketInput {
  title: string;
  description: string;
  category_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location?: string;
  photo_paths?: string[];
}

export function useCreateTicket() {
  const { residentId, communityId } = useAuth();
  const { unitId } = useResidentUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      // 1. Insert the ticket (reported_by = residentId, NOT auth.uid())
      const { data: ticket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          community_id: communityId!,
          reported_by: residentId!,
          unit_id: unitId ?? undefined,
          title: input.title,
          description: input.description,
          category_id: input.category_id,
          priority: input.priority,
          location: input.location ?? undefined,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. If photos were uploaded, attach them as a comment
      if (input.photo_paths && input.photo_paths.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { error: commentError } = await supabase
            .from('ticket_comments')
            .insert({
              ticket_id: ticket.id,
              author_id: user.id,
              author_role: 'reporter',
              content: 'Fotos adjuntas al reporte',
              photo_urls: input.photo_paths,
              is_internal: false,
              is_system: false,
            });

          if (commentError) {
            console.error('[useCreateTicket] Failed to attach photos:', commentError.message);
            // Don't throw -- ticket was created successfully, photo comment is secondary
          }
        }
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets._def });
    },
  });
}

// ---------- useAddComment ----------

interface AddCommentInput {
  ticket_id: string;
  content: string;
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddCommentInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: input.ticket_id,
          author_id: user.id,
          author_role: 'reporter',
          content: input.content,
          is_internal: false,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tickets.detail(variables.ticket_id).queryKey,
      });
    },
  });
}
