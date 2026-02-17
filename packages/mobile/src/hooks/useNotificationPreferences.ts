import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { Json } from '@upoe/shared';

/**
 * Notification preferences stored in residents.notification_preferences JSON column.
 * Each resident can customize which notification types they want to receive.
 */
export interface NotificationPreferences {
  /** Per-type toggles (true = enabled, false = disabled) */
  types: {
    visitor_arrived: boolean;
    payment_due: boolean;
    payment_received: boolean;
    ticket_created: boolean;
    ticket_status_changed: boolean;
    announcement: boolean;
    package_arrived: boolean;
    emergency_alert: boolean; // Always true, UI shows as disabled toggle
    survey_published: boolean;
    document_published: boolean;
  };
  /** Master push notification toggle */
  push_enabled: boolean;
  /** Quiet hours (do not disturb) configuration */
  quiet_hours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
  };
}

/**
 * Default preferences: all notifications enabled, no quiet hours.
 * Emergency alerts are always on (cannot be disabled).
 */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  types: {
    visitor_arrived: true,
    payment_due: true,
    payment_received: true,
    ticket_created: true,
    ticket_status_changed: true,
    announcement: true,
    package_arrived: true,
    emergency_alert: true,
    survey_published: true,
    document_published: true,
  },
  push_enabled: true,
  quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
};

/**
 * Hook to load notification preferences from the database.
 * Merges stored preferences with defaults to ensure new types are included.
 */
export function useNotificationPreferences() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: queryKeys.notifications.preferences(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('notification_preferences')
        .eq('id', residentId!)
        .single();

      if (error) throw error;

      // Parse stored preferences and merge with defaults
      const stored = data?.notification_preferences as NotificationPreferences | null;

      if (!stored) {
        return DEFAULT_PREFERENCES;
      }

      // Merge to ensure new types are included
      return {
        ...DEFAULT_PREFERENCES,
        ...stored,
        types: {
          ...DEFAULT_PREFERENCES.types,
          ...(stored.types ?? {}),
        },
        quiet_hours: {
          ...DEFAULT_PREFERENCES.quiet_hours,
          ...(stored.quiet_hours ?? {}),
        },
      };
    },
    enabled: !!residentId,
  });
}

/**
 * Mutation hook to update notification preferences in the database.
 */
export function useUpdateNotificationPreferences() {
  const { residentId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: NotificationPreferences) => {
      const { data, error } = await supabase
        .from('residents')
        .update({
          notification_preferences: preferences as unknown as Json,
        })
        .eq('id', residentId!)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.preferences(residentId!).queryKey,
      });
    },
  });
}
