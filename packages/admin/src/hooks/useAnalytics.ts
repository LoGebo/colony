'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface GuardPerformanceMetrics {
  totalPatrols: number;
  completedPatrols: number;
  completionRate: number;
  totalIncidents: number;
  avgResponseMinutes: number;
  patrolByGuard: Array<{
    guard_id: string;
    guard_name: string;
    patrols_completed: number;
    patrols_scheduled: number;
    completion_rate: number;
  }>;
  incidentsBySeverity: Array<{
    severity: string;
    count: number;
  }>;
}

export interface AuditLogEntry {
  id: string;
  entity_name: string;
  entity_type: string;
  action: string;
  timestamp: string;
  user_id: string | null;
}

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  entity_type?: string;
  page: number;
  pageSize: number;
}

/* ------------------------------------------------------------------ */
/*  Guard Performance                                                 */
/* ------------------------------------------------------------------ */

/**
 * Aggregate guard performance metrics from patrol_logs and incidents.
 * Computes completion rates, incident counts, and per-guard statistics.
 */
export function useGuardPerformance(dateFrom: string, dateTo: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [
      ...queryKeys['guard-metrics'].performance(communityId!, { from: dateFrom, to: dateTo })
        .queryKey,
    ],
    queryFn: async () => {
      const supabase = createClient();

      // Fetch patrol logs with guard info
      const { data: patrolLogs, error: patrolError } = await supabase
        .from('patrol_logs')
        .select('id, guard_id, checkpoints_total, checkpoints_visited, status, started_at, completed_at, guards(first_name, paternal_surname)')
        .eq('community_id', communityId!)
        .gte('started_at', dateFrom)
        .lte('started_at', dateTo + 'T23:59:59');

      if (patrolError) throw patrolError;

      // Fetch incidents
      const { data: incidents, error: incidentError } = await supabase
        .from('incidents')
        .select('id, severity, status, created_at, first_response_at')
        .eq('community_id', communityId!)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');

      if (incidentError) throw incidentError;

      // Compute aggregations
      const logs = patrolLogs ?? [];
      const totalPatrols = logs.length;
      const completedPatrols = logs.filter((log) => log.status === 'completed').length;
      const completionRate = totalPatrols > 0 ? (completedPatrols / totalPatrols) * 100 : 0;

      const incidentList = incidents ?? [];
      const totalIncidents = incidentList.length;

      // Calculate average response time (created_at to first_response_at)
      const responseTimesMs = incidentList
        .filter((inc) => inc.first_response_at)
        .map((inc) => {
          const created = new Date(inc.created_at).getTime();
          const responded = new Date(inc.first_response_at!).getTime();
          return responded - created;
        });

      const avgResponseMinutes =
        responseTimesMs.length > 0
          ? responseTimesMs.reduce((sum, ms) => sum + ms, 0) / responseTimesMs.length / 1000 / 60
          : 0;

      // Group patrols by guard
      const guardMap = new Map<
        string,
        {
          guard_name: string;
          completed: number;
          scheduled: number;
        }
      >();

      logs.forEach((log) => {
        const guardName = log.guards
          ? `${log.guards.first_name} ${log.guards.paternal_surname}`
          : `Guardia ${log.guard_id.slice(0, 8)}`;

        if (!guardMap.has(log.guard_id)) {
          guardMap.set(log.guard_id, { guard_name: guardName, completed: 0, scheduled: 0 });
        }

        const guard = guardMap.get(log.guard_id)!;
        guard.scheduled += 1;
        if (log.status === 'completed') {
          guard.completed += 1;
        }
      });

      const patrolByGuard = Array.from(guardMap.entries()).map(([guard_id, data]) => ({
        guard_id,
        guard_name: data.guard_name,
        patrols_completed: data.completed,
        patrols_scheduled: data.scheduled,
        completion_rate: data.scheduled > 0 ? (data.completed / data.scheduled) * 100 : 0,
      }));

      // Group incidents by severity
      const severityMap = new Map<string, number>();
      incidentList.forEach((inc) => {
        const count = severityMap.get(inc.severity) ?? 0;
        severityMap.set(inc.severity, count + 1);
      });

      const incidentsBySeverity = Array.from(severityMap.entries()).map(
        ([severity, count]) => ({
          severity,
          count,
        })
      );

      const metrics: GuardPerformanceMetrics = {
        totalPatrols,
        completedPatrols,
        completionRate,
        totalIncidents,
        avgResponseMinutes: Math.round(avgResponseMinutes),
        patrolByGuard,
        incidentsBySeverity,
      };

      return metrics;
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Audit Trail                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch recent activity across governance tables as an audit trail.
 * Queries elections, assemblies, violations, announcements, and tickets.
 * Client-side filtering and pagination.
 */
export function useAuditLogs(filters: AuditLogFilters) {
  const { communityId } = useAuth();
  const { dateFrom, dateTo, action, entity_type, page, pageSize } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.audit.logs(communityId!, {
        dateFrom,
        dateTo,
        action,
        entity_type,
        page,
        pageSize,
      }).queryKey,
    ],
    queryFn: async () => {
      const supabase = createClient();

      // Parallel queries to governance tables
      const [electionsRes, assembliesRes, violationsRes, announcementsRes, ticketsRes] =
        await Promise.all([
          supabase
            .from('elections')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(100),

          supabase
            .from('assemblies')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(100),

          supabase
            .from('violations')
            .select('id, violation_number, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(100),

          supabase
            .from('announcements')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(100),

          supabase
            .from('tickets')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(100),
        ]);

      // Map results to unified audit log format
      const entries: AuditLogEntry[] = [];

      (electionsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'elections',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (assembliesRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'assemblies',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (violationsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.violation_number,
          entity_type: 'violations',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (announcementsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'announcements',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (ticketsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'tickets',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      // Sort by timestamp descending
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Client-side filtering
      let filtered = entries;

      if (dateFrom) {
        filtered = filtered.filter((e) => e.timestamp >= dateFrom);
      }
      if (dateTo) {
        filtered = filtered.filter((e) => e.timestamp <= dateTo + 'T23:59:59');
      }
      if (action) {
        filtered = filtered.filter((e) => e.action === action);
      }
      if (entity_type) {
        filtered = filtered.filter((e) => e.entity_type === entity_type);
      }

      // Client-side pagination
      const total = filtered.length;
      const from = page * pageSize;
      const paginated = filtered.slice(from, from + pageSize);

      return {
        data: paginated,
        count: total,
      };
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch all audit logs matching filters (no pagination) for CSV export.
 * Disabled by default -- call refetch() to trigger.
 */
export function useAuditLogsForExport(filters: Omit<AuditLogFilters, 'page' | 'pageSize'>) {
  const { communityId } = useAuth();
  const { dateFrom, dateTo, action, entity_type } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.audit.logs(communityId!, {
        dateFrom,
        dateTo,
        action,
        entity_type,
        export: true,
      }).queryKey,
    ],
    queryFn: async () => {
      const supabase = createClient();

      // Same parallel queries as useAuditLogs
      const [electionsRes, assembliesRes, violationsRes, announcementsRes, ticketsRes] =
        await Promise.all([
          supabase
            .from('elections')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(1000),

          supabase
            .from('assemblies')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(1000),

          supabase
            .from('violations')
            .select('id, violation_number, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(1000),

          supabase
            .from('announcements')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(1000),

          supabase
            .from('tickets')
            .select('id, title, created_at, updated_at, created_by')
            .eq('community_id', communityId!)
            .order('updated_at', { ascending: false })
            .limit(1000),
        ]);

      const entries: AuditLogEntry[] = [];

      (electionsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'elections',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (assembliesRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'assemblies',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (violationsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.violation_number,
          entity_type: 'violations',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (announcementsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'announcements',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      (ticketsRes.data ?? []).forEach((item) => {
        const isCreate = item.created_at === item.updated_at;
        entries.push({
          id: item.id,
          entity_name: item.title,
          entity_type: 'tickets',
          action: isCreate ? 'Creado' : 'Actualizado',
          timestamp: item.updated_at,
          user_id: item.created_by,
        });
      });

      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply filters
      let filtered = entries;

      if (dateFrom) {
        filtered = filtered.filter((e) => e.timestamp >= dateFrom);
      }
      if (dateTo) {
        filtered = filtered.filter((e) => e.timestamp <= dateTo + 'T23:59:59');
      }
      if (action) {
        filtered = filtered.filter((e) => e.action === action);
      }
      if (entity_type) {
        filtered = filtered.filter((e) => e.entity_type === entity_type);
      }

      return filtered.slice(0, 5000); // Limit to 5000 for export
    },
    enabled: false, // Only fetch when refetch() is called
  });
}
