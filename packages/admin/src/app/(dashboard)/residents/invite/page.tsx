'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { inviteResident } from './actions';
import { toast } from 'sonner';

/**
 * Minimal unit list for the dropdown (full useUnits hook created in Task 2).
 */
function useUnitOptions() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.units.list(communityId!).queryKey, 'options'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number')
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('unit_number', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId,
  });
}

export default function InviteResidentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    paternal_surname: '',
    unit_id: '',
    occupancy_type: 'owner' as 'owner' | 'tenant' | 'authorized',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { data: units } = useUnitOptions();

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getError = (field: string): string | null => {
    if (!touched[field]) return null;
    if (field === 'email') {
      if (!form.email.trim()) return 'Campo requerido';
      if (!isValidEmail(form.email)) return 'Email invalido';
    }
    if (field === 'first_name' && !form.first_name.trim()) return 'Campo requerido';
    if (field === 'paternal_surname' && !form.paternal_surname.trim()) return 'Campo requerido';
    return null;
  };

  const isValid =
    form.email.trim() &&
    isValidEmail(form.email) &&
    form.first_name.trim() &&
    form.paternal_surname.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, first_name: true, paternal_surname: true });
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const result = await inviteResident({
        email: form.email,
        first_name: form.first_name,
        paternal_surname: form.paternal_surname,
        unit_id: form.unit_id || undefined,
        occupancy_type: form.unit_id ? form.occupancy_type : undefined,
      });

      if (result.success) {
        toast.success(`Invitacion enviada a ${form.email}`);
        router.push('/residents');
      } else {
        toast.error(result.error ?? 'Error al enviar invitacion');
      }
    } catch {
      toast.error('Error inesperado al enviar invitacion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/residents" className="hover:text-indigo-600">Residentes</Link>
        <span>/</span>
        <span className="text-gray-900">Invitar Residente</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">Invitar Residente</h1>

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="correo@ejemplo.com"
            />
            {getError('email') && (
              <p className="mt-1 text-xs text-red-600">{getError('email')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              onBlur={() => handleBlur('first_name')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Nombre"
            />
            {getError('first_name') && (
              <p className="mt-1 text-xs text-red-600">{getError('first_name')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Apellido Paterno <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.paternal_surname}
              onChange={(e) => handleChange('paternal_surname', e.target.value)}
              onBlur={() => handleBlur('paternal_surname')}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Apellido Paterno"
            />
            {getError('paternal_surname') && (
              <p className="mt-1 text-xs text-red-600">{getError('paternal_surname')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Unidad
            </label>
            <select
              value={form.unit_id}
              onChange={(e) => handleChange('unit_id', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Sin asignar</option>
              {(units ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_number}
                </option>
              ))}
            </select>
          </div>

          {form.unit_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tipo de Ocupacion
              </label>
              <select
                value={form.occupancy_type}
                onChange={(e) => handleChange('occupancy_type', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="owner">Propietario</option>
                <option value="tenant">Inquilino</option>
                <option value="authorized">Autorizado</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/residents">
              <Button type="button" variant="secondary">Cancelar</Button>
            </Link>
            <Button type="submit" isLoading={isSubmitting} disabled={!isValid}>
              Enviar Invitacion
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
