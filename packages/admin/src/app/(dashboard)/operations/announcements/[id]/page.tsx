'use client';

export const dynamic = 'force-dynamic';

import { use } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { RecipientTable } from '@/components/announcements/RecipientTable';
import { useAnnouncement } from '@/hooks/useAnnouncements';
import { formatDate } from '@/lib/formatters';

const segmentLabel: Record<string, string> = {
  all: 'Todos',
  owners: 'Propietarios',
  tenants: 'Inquilinos',
  building: 'Edificio',
  delinquent: 'Morosos',
  role: 'Por rol',
};

export default function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: announcement, isLoading, error } = useAnnouncement(id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="py-12 text-center text-gray-500">
        Aviso no encontrado
      </div>
    );
  }

  const readPct =
    announcement.total_recipients > 0
      ? Math.round(
          (announcement.read_count / announcement.total_recipients) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/operations/announcements"
        className="text-sm text-indigo-600 hover:text-indigo-800"
      >
        &larr; Volver a Avisos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {announcement.title}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant="info">
              {segmentLabel[announcement.target_segment] ??
                announcement.target_segment}
            </Badge>
            {announcement.publish_at && (
              <span className="text-sm text-gray-500">
                {formatDate(announcement.publish_at)}
              </span>
            )}
            {announcement.is_urgent && (
              <Badge variant="danger">Urgente</Badge>
            )}
            {announcement.requires_acknowledgment && (
              <Badge variant="warning">Requiere confirmacion</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <Card>
        <p className="whitespace-pre-wrap text-sm text-gray-800">
          {announcement.body}
        </p>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase text-gray-500">
            Destinatarios
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {announcement.total_recipients}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-gray-500">
            Leidos
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {announcement.read_count}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-gray-500">
            Porcentaje de Lectura
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{readPct}%</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-gray-500">
            Creado
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatDate(announcement.created_at)}
          </p>
        </Card>
      </div>

      {/* Recipient table */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Recibos de Lectura
        </h2>
        <RecipientTable
          announcementId={id}
          requiresAcknowledgment={announcement.requires_acknowledgment}
        />
      </div>
    </div>
  );
}
