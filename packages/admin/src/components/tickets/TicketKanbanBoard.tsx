'use client';

import { Badge } from '@/components/ui/Badge';
import type { TicketRow } from '@/hooks/useTickets';

const KANBAN_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'pending_parts',
  'pending_resident',
  'resolved',
] as const;

const statusLabel: Record<string, string> = {
  open: 'Abierto',
  assigned: 'Asignado',
  in_progress: 'En progreso',
  pending_parts: 'Pend. refacciones',
  pending_resident: 'Pend. residente',
  resolved: 'Resuelto',
};

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const priorityLabel: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays}d`;
  return `hace ${Math.round(diffDays / 30)}mes`;
}

interface TicketKanbanBoardProps {
  tickets: TicketRow[];
  onTicketClick: (id: string) => void;
}

export function TicketKanbanBoard({ tickets, onTicketClick }: TicketKanbanBoardProps) {
  // Group tickets by status
  const grouped: Record<string, TicketRow[]> = {};
  for (const s of KANBAN_STATUSES) {
    grouped[s] = [];
  }
  for (const ticket of tickets) {
    if (grouped[ticket.status]) {
      grouped[ticket.status].push(ticket);
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid min-w-[1320px] grid-cols-6 gap-4">
        {KANBAN_STATUSES.map((status) => (
          <div key={status} className="flex flex-col rounded-lg bg-gray-100 p-3">
            {/* Column header */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {statusLabel[status]}
              </h3>
              <Badge variant="neutral">{grouped[status].length}</Badge>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2">
              {grouped[status].length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-400">Sin tickets</p>
              ) : (
                grouped[status].map((ticket) => {
                  const reporterName = ticket.residents
                    ? `${ticket.residents.first_name} ${ticket.residents.paternal_surname}`
                    : 'Sin reportante';
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => onTicketClick(ticket.id)}
                      className="rounded-lg bg-white p-3 text-left shadow-sm transition hover:shadow-md"
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {ticket.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={priorityVariant[ticket.priority] ?? 'neutral'}>
                          {priorityLabel[ticket.priority] ?? ticket.priority}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="truncate text-xs text-gray-500">
                          {reporterName}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {relativeTime(ticket.created_at)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
