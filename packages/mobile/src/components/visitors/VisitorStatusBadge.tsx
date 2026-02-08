import { StatusBadge } from '@/components/ui/Badge';

const INVITATION_VARIANTS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprobada' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelada' },
  expired: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Expirada' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazada' },
};

interface VisitorStatusBadgeProps {
  status: string;
}

export function VisitorStatusBadge({ status }: VisitorStatusBadgeProps) {
  return <StatusBadge status={status} variants={INVITATION_VARIANTS} />;
}
