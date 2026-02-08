'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface ResidentFormData {
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  email: string;
  phone: string;
}

interface ResidentFormProps {
  resident?: {
    first_name: string;
    paternal_surname: string;
    maternal_surname: string | null;
    email: string;
    phone: string | null;
  };
  onSubmit: (data: ResidentFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Reusable form for creating or editing resident profiles.
 * Pre-fills fields when `resident` prop is provided (edit mode).
 */
export function ResidentForm({ resident, onSubmit, onCancel, isLoading = false }: ResidentFormProps) {
  const [form, setForm] = useState<ResidentFormData>({
    first_name: '',
    paternal_surname: '',
    maternal_surname: '',
    email: '',
    phone: '',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (resident) {
      setForm({
        first_name: resident.first_name,
        paternal_surname: resident.paternal_surname,
        maternal_surname: resident.maternal_surname ?? '',
        email: resident.email,
        phone: resident.phone ?? '',
      });
    }
  }, [resident]);

  const handleChange = (field: keyof ResidentFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getError = (field: keyof ResidentFormData): string | null => {
    if (!touched[field]) return null;
    if (field === 'first_name' && !form.first_name.trim()) return 'Campo requerido';
    if (field === 'paternal_surname' && !form.paternal_surname.trim()) return 'Campo requerido';
    if (field === 'email') {
      if (!form.email.trim()) return 'Campo requerido';
      if (!isValidEmail(form.email)) return 'Email invalido';
    }
    return null;
  };

  const isValid =
    form.first_name.trim() &&
    form.paternal_surname.trim() &&
    form.email.trim() &&
    isValidEmail(form.email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ first_name: true, paternal_surname: true, email: true });
    if (!isValid) return;
    onSubmit(form);
  };

  const title = resident ? 'Editar Residente' : 'Nuevo Residente';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

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
          Apellido Materno
        </label>
        <input
          type="text"
          value={form.maternal_surname}
          onChange={(e) => handleChange('maternal_surname', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Apellido Materno"
        />
      </div>

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
          Telefono
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="+52 55 1234 5678"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading} disabled={!isValid}>
          {resident ? 'Guardar Cambios' : 'Crear Residente'}
        </Button>
      </div>
    </form>
  );
}
