'use client';

import { Badge } from '@/components/ui/Badge';

const statusVariant: Record<string, 'success' | 'info' | 'neutral' | 'warning' | 'danger'> = {
  open: 'info',
  assigned: 'warning',
  in_progress: 'warning',
  pending_parts: 'neutral',
  pending_resident: 'neutral',
  resolved: 'success',
  closed: 'success',
  cancelled: 'danger',
};

const statusLabel: Record<string, string> = {
  open: 'Abierto',
  assigned: 'Asignado',
  in_progress: 'En progreso',
  pending_parts: 'Pend. refacciones',
  pending_resident: 'Pend. residente',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};

interface TicketStatusBadgeProps {
  status: string;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status] ?? 'neutral'} className={className}>
      {statusLabel[status] ?? status}
    </Badge>
  );
}
