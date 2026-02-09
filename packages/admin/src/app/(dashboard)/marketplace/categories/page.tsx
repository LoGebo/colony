'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useCommunitySettings, useUpdateCommunitySettings } from '@/hooks/useCommunitySettings';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Categories (PostgreSQL enum values)                               */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { value: 'sale', label: 'Venta', icon: '🏷️', description: 'Venta de articulos' },
  { value: 'service', label: 'Servicio', icon: '🛠️', description: 'Servicios ofrecidos' },
  { value: 'rental', label: 'Renta', icon: '🔑', description: 'Renta de articulos' },
  { value: 'wanted', label: 'Buscado', icon: '🔍', description: 'Busquedas de articulos' },
];

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function CategoriesPage() {
  const { communityId } = useAuth();
  const { data: settings, isLoading } = useCommunitySettings();
  const updateSettings = useUpdateCommunitySettings();

  const [disabledCategories, setDisabledCategories] = useState<string[]>([]);

  useEffect(() => {
    if (settings) {
      const customRules = settings.custom_rules as Record<string, unknown> | null;
      if (customRules && Array.isArray(customRules.marketplace_disabled_categories)) {
        setDisabledCategories(customRules.marketplace_disabled_categories as string[]);
      }
    }
  }, [settings]);

  const handleToggle = (category: string) => {
    const newDisabled = disabledCategories.includes(category)
      ? disabledCategories.filter((c) => c !== category)
      : [...disabledCategories, category];

    setDisabledCategories(newDisabled);

    const currentCustomRules = (settings?.custom_rules as Record<string, unknown>) || {};
    updateSettings.mutate(
      {
        custom_rules: {
          ...currentCustomRules,
          marketplace_disabled_categories: newDisabled,
        } as never,
      },
      {
        onSuccess: () => {
          toast.success('Categoria actualizada');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categorias Marketplace</h1>
        <p className="mt-1 text-sm text-gray-600">
          Activa o desactiva categorias para tu comunidad
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <svg
            className="mt-0.5 h-5 w-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <div className="text-sm text-blue-800">
            Las categorias desactivadas no estaran disponibles para crear nuevas publicaciones.
            Las publicaciones existentes en categorias desactivadas permaneceran visibles.
          </div>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => {
          const isEnabled = !disabledCategories.includes(category.value);
          return (
            <Card
              key={category.value}
              className={`transition-all ${
                isEnabled
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{category.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{category.label}</h3>
                      <p className="text-xs text-gray-600">{category.description}</p>
                    </div>
                  </div>
                </div>
                <Badge variant={isEnabled ? 'success' : 'neutral'}>
                  {isEnabled ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {isEnabled ? 'Disponible para residentes' : 'No disponible'}
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggle(category.value)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300"></div>
                </label>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
