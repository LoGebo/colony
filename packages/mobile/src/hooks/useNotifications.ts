import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@upoe/shared';
import NotificationService from '@/services/notifications/NotificationService';
import type { Database } from '@upoe/shared';

type Notification = Database['public']['Tables']['notifications']['Row'];

/**
 * Hook to initialize push notification registration
 * Call this in the root layout after authentication
 */
export function usePushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Initialize notification service
    NotificationService.initialize(user.id);

    // Cleanup on unmount or sign-out
    return () => {
      NotificationService.cleanup();
    };
  }, [user?.id]);
}

/**
 * Hook to fetch notification list
 * Returns non-dismissed notifications ordered by creation date
 */
export function useNotificationList() {
  const { user, communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.notifications.unread(user?.id ?? '').queryKey, 'list'],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Hook to get unread notification count
 * Returns count of notifications that are not read and not dismissed
 */
export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.notifications.unread(user?.id ?? '').queryKey, 'count'],
    queryFn: async () => {
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null)
        .is('dismissed_at', null);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });
}

/**
 * Hook to mark a notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate notification queries to refresh the list and count
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unread(user?.id ?? '').queryKey,
      });
    },
  });
}
