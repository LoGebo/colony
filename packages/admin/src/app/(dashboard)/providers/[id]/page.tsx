'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  useProviderDetail,
  useUpdateProvider,
  useProviderDocuments,
  useCreateProviderDocument,
  useUpdateProviderDocument,
  useProviderPersonnel,
  useCreateProviderPersonnel,
  useTogglePersonnelActive,
  useProviderSchedules,
  useCreateProviderSchedule,
  useDeleteProviderSchedule,
  type ProviderDocumentRow,
  type ProviderPersonnelRow,
  type ProviderScheduleRow,
} from '@/hooks/useProviders';
import { useWorkOrdersByProvider } from '@/hooks/useWorkOrders';
import { formatDate } from '@/lib/formatters';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  inactive: 'Inactivo',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending_approval: 'warning',
  active: 'success',
  suspended: 'danger',
  inactive: 'neutral',
};

const DOC_STATUS_LABELS: Record<string, string> = {
  pending_verification: 'Pendiente',
  verified: 'Verificado',
  expired: 'Vencido',
  rejected: 'Rechazado',
};

const DOC_STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending_verification: 'warning',
  verified: 'success',
  expired: 'danger',
  rejected: 'neutral',
};

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const TABS = ['Informacion', 'Documentos', 'Personal', 'Horarios'] as const;
type TabName = (typeof TABS)[number];

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

/* ------------------------------------------------------------------ */
/*  Info Tab                                                           */
/* ------------------------------------------------------------------ */

function InfoTab({ provider }: { provider: Record<string, unknown> }) {
  const updateProvider = useUpdateProvider();
  const { data: workOrders } = useWorkOrdersByProvider(provider.id as string);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    company_name: (provider.company_name as string) ?? '',
    contact_name: (provider.contact_name as string) ?? '',
    contact_email: (provider.contact_email as string) ?? '',
    contact_phone: (provider.contact_phone as string) ?? '',
    specialty: (provider.specialty as string) ?? '',
    tax_id: (provider.tax_id as string) ?? '',
    address: (provider.address as string) ?? '',
    notes: (provider.notes as string) ?? '',
  });

  const handleSave = () => {
    updateProvider.mutate(
      {
        id: provider.id as string,
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        specialty: form.specialty.trim() || null,
        tax_id: form.tax_id.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    updateProvider.mutate({
      id: provider.id as string,
      status: newStatus,
    });
  };

  const totalOrders = workOrders?.length ?? (provider.total_work_orders as number) ?? 0;
  const avgRating = provider.average_rating as number | null;

  return (
    <div className="space-y-6">
      {/* Status change */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Estado:</span>
            <Badge variant={STATUS_VARIANTS[(provider.status as string)] ?? 'neutral'}>
              {STATUS_LABELS[(provider.status as string)] ?? provider.status}
            </Badge>
          </div>
          <select
            value={provider.status as string}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="pending_approval">Pendiente</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </Card>

      {/* Provider info */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Datos del Proveedor</h3>
          <Button
            variant={editing ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Cancelar' : 'Editar'}
          </Button>
        </div>

        {editing ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Empresa</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contacto</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Telefono</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Especialidad</label>
              <input
                type="text"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">RFC</label>
              <input
                type="text"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Direccion</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
                rows={3}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={handleSave} isLoading={updateProvider.isPending}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Empresa</dt>
              <dd className="mt-1 text-sm text-gray-900">{provider.company_name as string}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Contacto</dt>
              <dd className="mt-1 text-sm text-gray-900">{(provider.contact_name as string) ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{(provider.contact_email as string) ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Telefono</dt>
              <dd className="mt-1 text-sm text-gray-900">{(provider.contact_phone as string) ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Especialidad</dt>
              <dd className="mt-1 text-sm text-gray-900">{(provider.specialty as string) ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">RFC</dt>
              <dd className="mt-1 text-sm text-gray-900">{(provider.tax_id as string) ?? '-'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Direccion</dt>
              <dd className="mt-1 text-sm text-gray-900">{(provider.address as string) ?? '-'}</dd>
            </div>
            {(provider.notes as string) && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Notas</dt>
                <dd className="mt-1 text-sm text-gray-900">{provider.notes as string}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      {/* Work orders summary */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900">Ordenes de Trabajo</h3>
        <div className="mt-3 flex items-center gap-6">
          <div>
            <span className="text-2xl font-bold text-gray-900">{totalOrders}</span>
            <span className="ml-1 text-sm text-gray-500">ordenes</span>
          </div>
          {avgRating != null && (
            <div>
              <span className="text-2xl font-bold text-yellow-500">{'★'.repeat(Math.round(avgRating))}</span>
              <span className="ml-1 text-sm text-gray-500">({avgRating.toFixed(1)})</span>
            </div>
          )}
          <Link
            href={`/providers/work-orders?provider=${provider.id}`}
            className="ml-auto text-sm text-indigo-600 hover:text-indigo-800"
          >
            Ver ordenes →
          </Link>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Documents Tab                                                      */
/* ------------------------------------------------------------------ */

function DocumentsTab({ providerId }: { providerId: string }) {
  const { data: docs, isLoading } = useProviderDocuments(providerId);
  const createDoc = useCreateProviderDocument();
  const updateDoc = useUpdateProviderDocument();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    document_type: '',
    document_number: '',
    issued_by: '',
    issue_date: '',
    expiry_date: '',
    notes: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.document_type.trim()) return;
    createDoc.mutate(
      {
        provider_id: providerId,
        document_type: form.document_type.trim(),
        document_number: form.document_number.trim() || undefined,
        issued_by: form.issued_by.trim() || undefined,
        issue_date: form.issue_date || undefined,
        expiry_date: form.expiry_date || undefined,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ document_type: '', document_number: '', issued_by: '', issue_date: '', expiry_date: '', notes: '' });
        },
      }
    );
  };

  const handleStatusAction = (doc: ProviderDocumentRow, newStatus: string) => {
    updateDoc.mutate({
      id: doc.id,
      provider_id: providerId,
      status: newStatus,
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}</div>;
  }

  const isExpired = (d: ProviderDocumentRow) =>
    d.expiry_date && new Date(d.expiry_date) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Documentos</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cerrar' : '+ Documento'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  className={inputClass}
                  placeholder="Poliza de seguro, licencia, etc."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Numero</label>
                <input
                  type="text"
                  value={form.document_number}
                  onChange={(e) => setForm({ ...form, document_number: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Emitido por</label>
                <input
                  type="text"
                  value={form.issued_by}
                  onChange={(e) => setForm({ ...form, issued_by: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Fecha emision</label>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Fecha vencimiento</label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <Button type="submit" size="sm" isLoading={createDoc.isPending}>
              Agregar Documento
            </Button>
          </form>
        </Card>
      )}

      {/* Document list */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Numero</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Emitido por</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Emision</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Vencimiento</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(!docs || docs.length === 0) ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  Sin documentos registrados
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <tr key={doc.id} className={isExpired(doc) ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {doc.document_type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.document_number ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.issued_by ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.issue_date ? formatDate(doc.issue_date) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.expiry_date ? formatDate(doc.expiry_date) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={DOC_STATUS_VARIANTS[doc.status] ?? 'neutral'}>
                      {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {doc.status === 'pending_verification' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStatusAction(doc, 'verified')}
                          className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200"
                        >
                          Verificar
                        </button>
                        <button
                          onClick={() => handleStatusAction(doc, 'rejected')}
                          className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Personnel Tab                                                      */
/* ------------------------------------------------------------------ */

function PersonnelTab({ providerId }: { providerId: string }) {
  const { data: personnel, isLoading } = useProviderPersonnel(providerId);
  const createPersonnel = useCreateProviderPersonnel();
  const toggleActive = useTogglePersonnelActive();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    document_type: '',
    document_number: '',
    phone: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    createPersonnel.mutate(
      {
        provider_id: providerId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        document_type: form.document_type.trim() || undefined,
        document_number: form.document_number.trim() || undefined,
        phone: form.phone.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ first_name: '', last_name: '', document_type: '', document_number: '', phone: '' });
        },
      }
    );
  };

  if (isLoading) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Personal Autorizado</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cerrar' : '+ Personal'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tipo documento</label>
                <select
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Seleccionar...</option>
                  <option value="INE">INE</option>
                  <option value="passport">Pasaporte</option>
                  <option value="license">Licencia</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Numero documento</label>
                <input
                  type="text"
                  value={form.document_number}
                  onChange={(e) => setForm({ ...form, document_number: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Telefono</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <Button type="submit" size="sm" isLoading={createPersonnel.isPending}>
              Agregar Personal
            </Button>
          </form>
        </Card>
      )}

      {/* Personnel grid */}
      {(!personnel || personnel.length === 0) ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          Sin personal registrado
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personnel.map((p: ProviderPersonnelRow) => (
            <Card key={p.id} padding="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                    {p.first_name.charAt(0)}{p.last_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {p.first_name} {p.last_name}
                    </p>
                    {p.document_type && (
                      <p className="text-xs text-gray-500">
                        {p.document_type}: {p.document_number ?? '-'}
                      </p>
                    )}
                    {p.phone && (
                      <p className="text-xs text-gray-500">{p.phone}</p>
                    )}
                  </div>
                </div>
                <Badge variant={p.is_active ? 'success' : 'neutral'}>
                  {p.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="mt-3">
                <Button
                  variant={p.is_active ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() =>
                    toggleActive.mutate({
                      id: p.id,
                      provider_id: providerId,
                      is_active: p.is_active,
                    })
                  }
                  isLoading={toggleActive.isPending}
                >
                  {p.is_active ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Schedules Tab                                                      */
/* ------------------------------------------------------------------ */

function SchedulesTab({ providerId }: { providerId: string }) {
  const { data: schedules, isLoading } = useProviderSchedules(providerId);
  const createSchedule = useCreateProviderSchedule();
  const deleteSchedule = useDeleteProviderSchedule();
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    day_of_week: '1',
    start_time: '08:00',
    end_time: '17:00',
    effective_from: '',
    effective_until: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createSchedule.mutate(
      {
        provider_id: providerId,
        day_of_week: parseInt(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        effective_from: form.effective_from || undefined,
        effective_until: form.effective_until || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ day_of_week: '1', start_time: '08:00', end_time: '17:00', effective_from: '', effective_until: '' });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteSchedule.mutate(
      { id, provider_id: providerId },
      { onSuccess: () => setConfirmDelete(null) }
    );
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Horarios de Acceso</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cerrar' : '+ Horario'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Dia</label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                  className={inputClass}
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hora inicio</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hora fin</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
                <input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
                <input
                  type="date"
                  value={form.effective_until}
                  onChange={(e) => setForm({ ...form, effective_until: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <Button type="submit" size="sm" isLoading={createSchedule.isPending}>
              Agregar Horario
            </Button>
          </form>
        </Card>
      )}

      {/* Schedule table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Dia</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Hora inicio</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Hora fin</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Periodo</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(!schedules || schedules.length === 0) ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  Sin horarios configurados
                </td>
              </tr>
            ) : (
              schedules.map((s: ProviderScheduleRow) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {DAY_NAMES[s.day_of_week]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {s.start_time}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {s.end_time}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {s.effective_from ? formatDate(s.effective_from) : '-'}
                    {s.effective_until ? ` - ${formatDate(s.effective_until)}` : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={s.is_active ? 'success' : 'neutral'}>
                      {s.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {confirmDelete === s.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(s.id)}
                        className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ProviderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: provider, isLoading } = useProviderDetail(id);
  const [activeTab, setActiveTab] = useState<TabName>('Informacion');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Proveedor no encontrado</p>
        <Link href="/providers" className="mt-2 text-sm text-indigo-600 hover:text-indigo-800">
          Volver a proveedores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/providers" className="text-sm text-gray-500 hover:text-gray-700">
          Proveedores
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-2xl font-bold text-gray-900">
          {provider.company_name as string}
        </h1>
        <Badge variant={STATUS_VARIANTS[(provider.status as string)] ?? 'neutral'}>
          {STATUS_LABELS[(provider.status as string)] ?? provider.status}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 text-sm font-medium transition ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'Informacion' && <InfoTab provider={provider as unknown as Record<string, unknown>} />}
      {activeTab === 'Documentos' && <DocumentsTab providerId={id} />}
      {activeTab === 'Personal' && <PersonnelTab providerId={id} />}
      {activeTab === 'Horarios' && <SchedulesTab providerId={id} />}
    </div>
  );
}
