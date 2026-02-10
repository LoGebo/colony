'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useModerationQueue,
  useModerationItemDetail,
  useModerationStats,
  useClaimModerationItem,
  useResolveModeration,
} from '@/hooks/useModeration';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ITEM_TYPE_LABELS: Record<string, string> = {
  listing: 'Publicacion',
  post: 'Post',
  comment: 'Comentario',
};

const ITEM_TYPE_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  listing: 'warning',
  post: 'success',
  comment: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_review: 'En revision',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  flagged: 'Marcado',
};

/* ------------------------------------------------------------------ */
/*  Item Content Display                                               */
/* ------------------------------------------------------------------ */

function ItemContent({
  itemId,
  itemType,
  onResolve,
}: {
  itemId: string;
  itemType: string;
  onResolve: (resolution: 'approved' | 'rejected', notes?: string) => void;
}) {
  const { data: itemDetail, isLoading } = useModerationItemDetail(itemId, itemType);
  const [notes, setNotes] = useState('');

  if (isLoading) {
    return <div className="text-sm text-gray-500">Cargando contenido...</div>;
  }

  if (!itemDetail) {
    return <div className="text-sm text-red-600">Error al cargar contenido</div>;
  }

  const { type, data } = itemDetail as { type: string; data: any };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        {type === 'listing' && (
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">{data.title}</h4>
            <p className="text-sm text-gray-600">{data.description}</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-700">
                Precio: <strong>${data.price}</strong>
              </span>
              <Badge variant="neutral">{data.category}</Badge>
            </div>
            {data.image_urls && data.image_urls.length > 0 && (
              <div className="flex gap-2">
                {data.image_urls.slice(0, 3).map((url: string, idx: number) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    className="h-20 w-20 rounded object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {type === 'post' && (
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">{data.title}</h4>
            <p className="text-sm text-gray-600">{data.content}</p>
            <Badge variant="neutral">{data.post_type}</Badge>
          </div>
        )}
        {type === 'comment' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-900">{data.content}</p>
            <span className="text-xs text-gray-500">
              {format(parseISO(data.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Notas (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          rows={3}
          placeholder="Agregar notas sobre esta decision..."
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onResolve('approved', notes)}>Aprobar</Button>
        <Button variant="secondary" onClick={() => onResolve('rejected', notes)}>
          Rechazar
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ModerationPage() {
  const { data: queue, isLoading: queueLoading } = useModerationQueue();
  const { data: stats } = useModerationStats();
  const claimItem = useClaimModerationItem();
  const resolveItem = useResolveModeration();

  const [claimedItem, setClaimedItem] = useState<{
    queueId: string;
    itemId: string;
    itemType: string;
  } | null>(null);

  const handleClaim = () => {
    claimItem.mutate(undefined, {
      onSuccess: (data) => {
        if (data) {
          setClaimedItem({
            queueId: data.id,
            itemId: data.item_id,
            itemType: data.item_type,
          });
        }
      },
    });
  };

  const handleResolve = (resolution: 'approved' | 'rejected', notes?: string) => {
    if (!claimedItem) return;
    resolveItem.mutate(
      {
        queueId: claimedItem.queueId,
        resolution,
        notes,
      },
      {
        onSuccess: () => {
          setClaimedItem(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Moderacion Marketplace</h1>
        <p className="mt-1 text-sm text-gray-600">
          Revisa y modera contenido de la comunidad
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-yellow-500">
            <div className="text-sm text-gray-600">Pendientes</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{stats.pending}</div>
          </Card>
          <Card className="border-l-4 border-blue-500">
            <div className="text-sm text-gray-600">En Revision</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{stats.inReview}</div>
          </Card>
          <Card className="border-l-4 border-green-500">
            <div className="text-sm text-gray-600">Resueltas Hoy</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{stats.resolvedToday}</div>
          </Card>
        </div>
      )}

      {/* Claimed item review */}
      {claimedItem && (
        <Card className="border-2 border-indigo-500">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Item en Revision</h2>
            <Badge variant={ITEM_TYPE_VARIANTS[claimedItem.itemType] ?? 'neutral'}>
              {ITEM_TYPE_LABELS[claimedItem.itemType] ?? claimedItem.itemType}
            </Badge>
          </div>
          <ItemContent
            itemId={claimedItem.itemId}
            itemType={claimedItem.itemType}
            onResolve={handleResolve}
          />
        </Card>
      )}

      {/* Queue section */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Cola de Moderacion</h2>
          {!claimedItem && (
            <Button onClick={handleClaim} isLoading={claimItem.isPending}>
              Reclamar Siguiente
            </Button>
          )}
        </div>

        {queueLoading ? (
          <div className="py-8 text-center text-gray-500">Cargando...</div>
        ) : !queue || queue.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-8 text-center">
            <p className="text-gray-600">No hay items pendientes de moderacion</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-center gap-4">
                  <Badge variant={ITEM_TYPE_VARIANTS[item.item_type] ?? 'neutral'}>
                    {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                  </Badge>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      Prioridad: {item.priority}
                    </div>
                    <div className="text-gray-600">
                      {format(parseISO(item.queued_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="warning">
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                  {item.assigned_to && (
                    <span className="text-xs text-gray-500">
                      Asignado: {format(parseISO(item.assigned_at!), 'HH:mm', { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
