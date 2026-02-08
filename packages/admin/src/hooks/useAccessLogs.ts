'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AccessLogRow {
  id: string;
  logged_at: string;
  person_name: string | null;
  person_type: string | null;
  direction: string | null;
  method: string | null;
  decision: string | null;
  denial_reason: string | null;
  plate_number: string | null;
  guard_notes: string | null;
  access_points: { name: string; access_point_type: string } | null;
}

export interface AccessPoint {
  id: string;
  name: string;
  access_point_type: string;
}

export interface AccessLogFilters {
  dateFrom?: string;
  dateTo?: string;
  accessPointId?: string;
  personType?: string;
  direction?: string;
  page: number;
  pageSize: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ACCESS_LOG_SELECT =
  'id, logged_at, person_name, person_type, direction, method, decision, denial_reason, plate_number, guard_notes, access_points!inner(name, access_point_type)';

/**
 * Helper to get default date range (last 7 days).
 */
export function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { dateFrom: fmt(weekAgo), dateTo: fmt(today) };
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Paginated access log list with date range, gate, person type, and direction filters.
 * Always enforces date range (defaults to last 7 days in the UI).
 */
export function useAccessLogs(filters: AccessLogFilters) {
  const { communityId } = useAuth();
  const { dateFrom, dateTo, accessPointId, personType, direction, page, pageSize } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys['access-logs'].today(communityId!).queryKey,
      { dateFrom, dateTo, accessPointId, personType, direction, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('access_logs')
        .select(ACCESS_LOG_SELECT, { count: 'exact' })
        .eq('community_id', communityId!)
        .order('logged_at', { ascending: false });

      if (dateFrom) query = query.gte('logged_at', dateFrom);
      if (dateTo) query = query.lte('logged_at', dateTo + 'T23:59:59');
      if (accessPointId) query = query.eq('access_point_id', accessPointId);
      if (personType) query = query.eq('person_type', personType as never);
      if (direction) query = query.eq('direction', direction as never);

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as unknown as AccessLogRow[], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

/**
 * Access points for the gate filter dropdown.
 */
export function useAccessPoints() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys['access-logs'].today(communityId!).queryKey, 'access-points'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('access_points')
        .select('id, name, access_point_type')
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      return (data ?? []) as AccessPoint[];
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch ALL access logs matching filters (no pagination) for CSV export.
 * Limited to 10,000 rows to prevent memory issues.
 * Disabled by default -- call refetch() to trigger.
 */
export function useAccessLogsForExport(filters: Omit<AccessLogFilters, 'page' | 'pageSize'>) {
  const { communityId } = useAuth();
  const { dateFrom, dateTo, accessPointId, personType, direction } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys['access-logs'].today(communityId!).queryKey,
      'export',
      { dateFrom, dateTo, accessPointId, personType, direction },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('access_logs')
        .select(ACCESS_LOG_SELECT)
        .eq('community_id', communityId!)
        .order('logged_at', { ascending: false })
        .limit(10000);

      if (dateFrom) query = query.gte('logged_at', dateFrom);
      if (dateTo) query = query.lte('logged_at', dateTo + 'T23:59:59');
      if (accessPointId) query = query.eq('access_point_id', accessPointId);
      if (personType) query = query.eq('person_type', personType as never);
      if (direction) query = query.eq('direction', direction as never);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AccessLogRow[];
    },
    enabled: false, // Only fetch when refetch() is called
  });
}
