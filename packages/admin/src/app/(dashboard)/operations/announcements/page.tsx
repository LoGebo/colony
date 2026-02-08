'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AnnouncementForm } from '@/components/announcements/AnnouncementForm';
import {
  useAnnouncements,
  useCreateAnnouncement,
  type AnnouncementRow,
} from '@/hooks/useAnnouncements';
import { formatDate } from '@/lib/formatters';

const segmentLabel: Record<string, string> = {
  all: 'Todos',
  owners: 'Propietarios',
  tenants: 'Inquilinos',
  building: 'Edificio',
  delinquent: 'Morosos',
  role: 'Por rol',
};

const segmentVariant: Record<string, 'success' | 'info' | 'neutral' | 'warning' | 'danger'> = {
  all: 'info',
  owners: 'success',
  tenants: 'success',
  building: 'neutral',
  delinquent: 'warning',
  role: 'neutral',
};

export default function AnnouncementsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data, isLoading } = useAnnouncements({
    search: debouncedSearch || undefined,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const createAnnouncement = useCreateAnnouncement();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const columns = useMemo<ColumnDef<AnnouncementRow, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Titulo',
        cell: ({ row }) => (
          <Link
            href={`/operations/announcements/${row.original.id}`}
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'target_segment',
        header: 'Destinatarios',
        cell: ({ row }) => {
          const segment = row.original.target_segment;
          return (
            <Badge variant={segmentVariant[segment] ?? 'neutral'}>
              {segmentLabel[segment] ?? segment}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'publish_at',
        header: 'Publicado',
        cell: ({ row }) => {
          const publishAt = row.original.publish_at;
          if (!publishAt) return '-';
          const isScheduled = new Date(publishAt) > new Date();
          if (isScheduled) {
            return (
              <span className="text-yellow-600">
                Programado: {formatDate(publishAt)}
              </span>
            );
          }
          return formatDate(publishAt);
        },
      },
      {
        accessorKey: 'total_recipients',
        header: 'Destinatarios',
        cell: ({ row }) => row.original.total_recipients,
      },
      {
        accessorKey: 'read_count',
        header: 'Lectura',
        cell: ({ row }) => {
          const { read_count, total_recipients } = row.original;
          const pct =
            total_recipients > 0
              ? Math.round((read_count / total_recipients) * 100)
              : 0;
          return (
            <span className="text-sm">
              {read_count}/{total_recipients}{' '}
              <span className="text-gray-400">({pct}%)</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'is_urgent',
        header: 'Urgencia',
        cell: ({ row }) =>
          row.original.is_urgent ? (
            <Badge variant="danger">Urgente</Badge>
          ) : null,
      },
    ],
    [],
  );

  const pageCount = Math.ceil((data?.count ?? 0) / pagination.pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Avisos</h1>
          {data?.count != null && (
            <Badge variant="neutral">{data.count}</Badge>
          )}
        </div>
        <Button onClick={() => setShowCreateForm(true)}>Nuevo Aviso</Button>
      </div>

      {/* Search bar */}
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por titulo..."
          className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <AnnouncementForm
            onSubmit={(formData) => {
              createAnnouncement.mutate(formData, {
                onSuccess: () => setShowCreateForm(false),
              });
            }}
            onCancel={() => setShowCreateForm(false)}
            isSubmitting={createAnnouncement.isPending}
          />
        </Card>
      )}

      {/* Announcements data table */}
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
