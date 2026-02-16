'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import { TicketSLAIndicator } from '@/components/tickets/TicketSLAIndicator';
import {
  useTicket,
  useAssignTicket,
  useUpdateTicketStatus,
  useAddTicketComment,
  VALID_TRANSITIONS,
} from '@/hooks/useTickets';
import { formatDate } from '@/lib/formatters';

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

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `hace ${diffDays}d`;
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const { data: ticket, isLoading } = useTicket(ticketId);
  const assignTicket = useAssignTicket();
  const updateStatus = useUpdateTicketStatus();
  const addComment = useAddTicketComment();

  // Assignment form
  const [assigneeId, setAssigneeId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // Comment form
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Link
          href="/operations/tickets"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          &larr; Volver a tickets
        </Link>
        <p className="text-gray-500">Ticket no encontrado.</p>
      </div>
    );
  }

  const validNextStatuses = VALID_TRANSITIONS[ticket.status] ?? [];
  const reporterName = ticket.residents
    ? `${ticket.residents.first_name} ${ticket.residents.paternal_surname}`
    : 'Sin reportante';
  const comments = [...(ticket.ticket_comments ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const handleAssign = () => {
    if (!assigneeId.trim()) return;
    assignTicket.mutate(
      { ticketId, assignedTo: assigneeId.trim(), notes: assignNotes || undefined },
      {
        onSuccess: () => {
          setAssigneeId('');
          setAssignNotes('');
        },
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate({ ticketId, newStatus });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate(
      { ticketId, content: commentText.trim(), isInternal },
      {
        onSuccess: () => {
          setCommentText('');
          setIsInternal(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/operations/tickets"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
      >
        &larr; Volver a tickets
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
        <TicketStatusBadge status={ticket.status} />
        <Badge variant={priorityVariant[ticket.priority] ?? 'neutral'}>
          {priorityLabel[ticket.priority] ?? ticket.priority}
        </Badge>
        <TicketSLAIndicator
          responseDueAt={ticket.response_due_at}
          resolutionDueAt={ticket.resolution_due_at}
          responseBreached={ticket.response_breached}
          resolutionBreached={ticket.resolution_breached}
          firstRespondedAt={ticket.first_responded_at}
          resolvedAt={ticket.resolved_at}
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: description + timeline */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">
              Descripcion
            </h2>
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {ticket.description || 'Sin descripcion.'}
            </p>
          </Card>

          {/* Timeline */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-gray-700">
              Comentarios ({comments.length})
            </h2>
            {comments.length === 0 ? (
              <p className="text-sm text-gray-400">Sin comentarios aun.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`rounded-lg border p-3 ${
                      comment.is_system
                        ? 'border-gray-200 bg-gray-50'
                        : comment.is_internal
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          comment.is_system ? 'italic text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        {comment.is_system
                          ? 'Sistema'
                          : comment.author_role ?? 'Desconocido'}
                        {comment.is_internal && (
                          <span className="ml-1 text-yellow-600">(interno)</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">
                        {relativeTime(comment.created_at)}
                      </span>
                    </div>
                    <p
                      className={`text-sm ${
                        comment.is_system ? 'italic text-gray-500' : 'text-gray-700'
                      }`}
                    >
                      {comment.content}
                    </p>
                    {comment.photo_urls && comment.photo_urls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {comment.photo_urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            Foto {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add comment form */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Agregar comentario
              </h3>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                placeholder="Escribe un comentario..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Nota interna
                </label>
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  isLoading={addComment.isPending}
                >
                  Enviar
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: info + assignment + status workflow */}
        <div className="space-y-6">
          {/* Info card */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Informacion
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Categoria</dt>
                <dd className="font-medium text-gray-900">
                  {ticket.ticket_categories?.name ?? '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Reportante</dt>
                <dd className="font-medium text-gray-900">{reporterName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Creado</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(ticket.created_at)}
                </dd>
              </div>
              {ticket.response_due_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Resp. vence</dt>
                  <dd className="font-medium text-gray-900">
                    {formatDate(ticket.response_due_at)}
                  </dd>
                </div>
              )}
              {ticket.resolution_due_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Resol. vence</dt>
                  <dd className="font-medium text-gray-900">
                    {formatDate(ticket.resolution_due_at)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Assignment card */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Asignacion
            </h2>
            {ticket.assigned_to ? (
              <p className="mb-3 text-sm text-gray-600">
                Asignado a:{' '}
                <span className="font-mono text-xs">{ticket.assigned_to.slice(0, 8)}...</span>
              </p>
            ) : (
              <p className="mb-3 text-sm text-gray-400">Sin asignar</p>
            )}

            {/* Assignment history */}
            {ticket.ticket_assignments && ticket.ticket_assignments.length > 0 && (
              <div className="mb-3 space-y-1">
                <p className="text-xs font-medium text-gray-500">Historial:</p>
                {ticket.ticket_assignments.map((a) => (
                  <div key={a.id} className="text-xs text-gray-400">
                    <span className="font-mono">{a.assigned_to.slice(0, 8)}</span>
                    {' - '}
                    {relativeTime(a.assigned_at)}
                    {a.notes && <span className="italic"> ({a.notes})</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                placeholder="ID del asignado (UUID)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Notas (opcional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button
                size="sm"
                className="w-full"
                onClick={handleAssign}
                disabled={!assigneeId.trim()}
                isLoading={assignTicket.isPending}
              >
                Asignar
              </Button>
            </div>
          </Card>

          {/* Status workflow card */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Flujo de estado
            </h2>
            <p className="mb-3 text-sm text-gray-500">
              Estado actual:{' '}
              <TicketStatusBadge status={ticket.status} />
            </p>
            {validNextStatuses.length === 0 ? (
              <p className="text-sm text-gray-400">
                No hay transiciones disponibles.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {validNextStatuses.map((nextStatus) => (
                  <Button
                    key={nextStatus}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusChange(nextStatus)}
                    isLoading={updateStatus.isPending}
                  >
                    {statusLabel[nextStatus] ?? nextStatus}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
