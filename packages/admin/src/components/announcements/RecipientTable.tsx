'use client';

import { useState, useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import {
  useAnnouncementRecipients,
  type AnnouncementRecipientRow,
} from '@/hooks/useAnnouncements';
import { formatDate } from '@/lib/formatters';

interface RecipientTableProps {
  announcementId: string;
  requiresAcknowledgment: boolean;
}

export function RecipientTable({
  announcementId,
  requiresAcknowledgment,
}: RecipientTableProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const { data, isLoading } = useAnnouncementRecipients(
    announcementId,
    pagination.pageIndex,
    pagination.pageSize,
  );

  const columns = useMemo<ColumnDef<AnnouncementRecipientRow, unknown>[]>(() => {
    const cols: ColumnDef<AnnouncementRecipientRow, unknown>[] = [
      {
        accessorKey: 'resident_name',
        header: 'Residente',
        cell: ({ row }) => {
          const r = row.original.residents;
          return `${r.first_name} ${r.paternal_surname}`;
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.original.residents.email,
      },
      {
        accessorKey: 'read_at',
        header: 'Estado de Lectura',
        cell: ({ row }) => {
          const readAt = row.original.read_at;
          if (readAt) {
            return (
              <Badge variant="success">
                Leido - {formatDate(readAt)}
              </Badge>
            );
          }
          return <Badge variant="neutral">No leido</Badge>;
        },
      },
    ];

    if (requiresAcknowledgment) {
      cols.push({
        accessorKey: 'acknowledged_at',
        header: 'Confirmacion',
        cell: ({ row }) => {
          const ackAt = row.original.acknowledged_at;
          if (ackAt) {
            return (
              <Badge variant="success">
                Confirmado - {formatDate(ackAt)}
              </Badge>
            );
          }
          return <Badge variant="warning">Pendiente</Badge>;
        },
      });
    }

    return cols;
  }, [requiresAcknowledgment]);

  const totalRecipients = data?.count ?? 0;
  const readCount = (data?.data ?? []).filter((r) => r.read_at).length;
  const pageCount = Math.ceil(totalRecipients / pagination.pageSize);

  return (
    <div className="space-y-4">
      {/* Summary */}
      {totalRecipients > 0 && (
        <p className="text-sm text-gray-600">
          {readCount} de {totalRecipients} destinatarios han leido este aviso
          {totalRecipients > 0 && (
            <span className="ml-1 font-medium">
              ({Math.round((readCount / totalRecipients) * 100)}%)
            </span>
          )}
        </p>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
      />
    </div>
  );
}
