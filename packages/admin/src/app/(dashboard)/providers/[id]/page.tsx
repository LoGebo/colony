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

const DOC_TYPE_LABELS: Record<string, string> = {
  insurance_liability: 'Seguro de responsabilidad civil',
  insurance_workers_comp: 'Seguro de accidentes laborales',
  business_license: 'Licencia de negocio',
  tax_registration: 'Registro fiscal (RFC)',
  certification: 'Certificacion',
  contract: 'Contrato',
  background_check: 'Antecedentes penales',
  other: 'Otro',
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
    specialties: ((provider.specialties as string[]) ?? []).join(', '),
    rfc: (provider.rfc as string) ?? '',
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
        contact_phone: form.contact_phone.replace(/[\s\-()]/g, '').trim() || null,
        specialties: form.specialties.trim() ? form.specialties.split(',').map(s => s.trim()) : null,
        rfc: form.rfc.trim() || null,
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
                value={form.specialties}
                onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">RFC</label>
              <input
                type="text"
                value={form.rfc}
                onChange={(e) => setForm({ ...form, rfc: e.target.value })}
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
              <dd className="mt-1 text-sm text-gray-900">{((provider.specialties as string[]) ?? []).join(', ') || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">RFC</dt>
              <dd className="mt-1 text-sm text-gray-900">{(provider.rfc as string) ?? '-'}</dd>
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
        issuing_authority: form.issued_by.trim() || undefined,
        issued_at: form.issue_date || undefined,
        expires_at: form.expiry_date || undefined,
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
    d.expires_at && new Date(d.expires_at) < new Date();

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
                <select
                  required
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Seleccionar...</option>
                  {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
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
                    {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.document_number ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.issuing_authority ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.issued_at ? formatDate(doc.issued_at) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {doc.expires_at ? formatDate(doc.expires_at) : '-'}
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
    paternal_surname: '',
    maternal_surname: '',
    ine_number: '',
    phone: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.paternal_surname.trim()) return;
    createPersonnel.mutate(
      {
        provider_id: providerId,
        first_name: form.first_name.trim(),
        paternal_surname: form.paternal_surname.trim(),
        maternal_surname: form.maternal_surname.trim() || undefined,
        ine_number: form.ine_number.trim() || undefined,
        phone: form.phone.replace(/[\s\-()]/g, '').trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ first_name: '', paternal_surname: '', maternal_surname: '', ine_number: '', phone: '' });
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
                  Apellido Paterno <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.paternal_surname}
                  onChange={(e) => setForm({ ...form, paternal_surname: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Apellido Materno</label>
                <input
                  type="text"
                  value={form.maternal_surname}
                  onChange={(e) => setForm({ ...form, maternal_surname: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">INE</label>
                <input
                  type="text"
                  value={form.ine_number}
                  onChange={(e) => setForm({ ...form, ine_number: e.target.value })}
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
                    {p.first_name.charAt(0)}{p.paternal_surname.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {p.first_name} {p.paternal_surname}{p.maternal_surname ? ` ${p.maternal_surname}` : ''}
                    </p>
                    {p.ine_number && (
                      <p className="text-xs text-gray-500">
                        INE: {p.ine_number}
                      </p>
                    )}
                    {p.phone && (
                      <p className="text-xs text-gray-500">{p.phone}</p>
                    )}
                  </div>
                </div>
                <Badge variant={p.is_authorized ? 'success' : 'neutral'}>
                  {p.is_authorized ? 'Autorizado' : 'No autorizado'}
                </Badge>
              </div>
              <div className="mt-3">
                <Button
                  variant={p.is_authorized ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() =>
                    toggleActive.mutate({
                      id: p.id,
                      provider_id: providerId,
                      is_authorized: p.is_authorized,
                    })
                  }
                  isLoading={toggleActive.isPending}
                >
                  {p.is_authorized ? 'Desautorizar' : 'Autorizar'}
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
    name: '',
    allowed_days: [1, 2, 3, 4, 5] as number[],
    start_time: '08:00',
    end_time: '17:00',
    effective_from: new Date().toISOString().split('T')[0],
    effective_until: '',
  });

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      allowed_days: prev.allowed_days.includes(day)
        ? prev.allowed_days.filter((d) => d !== day)
        : [...prev.allowed_days, day].sort(),
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.allowed_days.length === 0) return;
    createSchedule.mutate(
      {
        provider_id: providerId,
        name: form.name.trim(),
        allowed_days: form.allowed_days,
        start_time: form.start_time,
        end_time: form.end_time,
        effective_from: form.effective_from,
        effective_until: form.effective_until || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ name: '', allowed_days: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '17:00', effective_from: new Date().toISOString().split('T')[0], effective_until: '' });
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="Ej: Horario semanal de mantenimiento"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">Dias permitidos</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        form.allowed_days.includes(i)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  ))}
                </div>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Desde <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
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
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Dias</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Horario</th>
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
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="flex flex-wrap gap-1">
                      {s.allowed_days.map((d) => (
                        <span key={d} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                          {DAY_NAMES[d]?.slice(0, 3) ?? d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {formatDate(s.effective_from)}
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
