'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useCommunitySettings, useUpdateFeatureFlags } from '@/hooks/useCommunitySettings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ── Feature Flag Definitions ───────────────────────────────────────

interface FeatureFlags {
  enable_payments: boolean;
  enable_visitors: boolean;
  enable_packages: boolean;
  enable_amenities: boolean;
  enable_marketplace: boolean;
  enable_maintenance: boolean;
  enable_social_wall: boolean;
  enable_documents: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  enable_payments: true,
  enable_visitors: true,
  enable_packages: true,
  enable_amenities: true,
  enable_marketplace: true,
  enable_maintenance: true,
  enable_social_wall: true,
  enable_documents: true,
};

interface FeatureDefinition {
  key: keyof FeatureFlags;
  name: string;
  description: string;
  icon: string;
}

const FEATURES: FeatureDefinition[] = [
  {
    key: 'enable_payments',
    name: 'Pagos',
    description: 'Permite a los residentes realizar pagos de cuotas y ver su estado de cuenta.',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  },
  {
    key: 'enable_visitors',
    name: 'Visitantes',
    description: 'Gestion de acceso de visitantes con QR y registro en caseta.',
    icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  },
  {
    key: 'enable_packages',
    name: 'Paquetes',
    description: 'Registro y notificacion de paqueteria recibida en caseta.',
    icon: 'm20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  },
  {
    key: 'enable_amenities',
    name: 'Amenidades',
    description: 'Reserva de areas comunes como salon de fiestas, gimnasio, alberca.',
    icon: 'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Z',
  },
  {
    key: 'enable_marketplace',
    name: 'Marketplace',
    description: 'Compraventa de articulos entre residentes de la comunidad.',
    icon: 'M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z',
  },
  {
    key: 'enable_maintenance',
    name: 'Mantenimiento',
    description: 'Reportes y seguimiento de tickets de mantenimiento.',
    icon: 'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z',
  },
  {
    key: 'enable_social_wall',
    name: 'Muro Social',
    description: 'Publicaciones y comunicados visibles para toda la comunidad.',
    icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
  },
  {
    key: 'enable_documents',
    name: 'Documentos',
    description: 'Repositorio de documentos compartidos: reglamentos, actas, minutas.',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
];

// ── Toggle Component ───────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        enabled ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────

function FeatureSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function FeaturesPage() {
  const { data: settings, isLoading } = useCommunitySettings();
  const updateFlags = useUpdateFeatureFlags();

  const [flags, setFlags] = useState<FeatureFlags>({ ...DEFAULT_FLAGS });
  const [hasChanges, setHasChanges] = useState(false);

  // Merge loaded flags with defaults
  useEffect(() => {
    if (settings?.feature_flags) {
      const loaded = settings.feature_flags as Record<string, boolean>;
      const merged: FeatureFlags = { ...DEFAULT_FLAGS };
      for (const key of Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]) {
        if (typeof loaded[key] === 'boolean') {
          merged[key] = loaded[key];
        }
      }
      setFlags(merged);
      setHasChanges(false);
    }
  }, [settings]);

  function handleToggle(key: keyof FeatureFlags, value: boolean) {
    setFlags((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }

  function handleSave() {
    updateFlags.mutate(flags as unknown as Record<string, boolean>, {
      onSuccess: () => setHasChanges(false),
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Funcionalidades</h1>
          <p className="mt-1 text-sm text-gray-500">
            Activa o desactiva las funcionalidades disponibles para tu comunidad
          </p>
        </div>
        <Button
          onClick={handleSave}
          isLoading={updateFlags.isPending}
          disabled={!hasChanges}
        >
          Guardar Cambios
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p className="text-sm text-blue-800">
            Las funcionalidades desactivadas no seran visibles para los residentes en la aplicacion movil. Los datos existentes se conservan y estaran disponibles al reactivar.
          </p>
        </div>
      </div>

      {/* Features List */}
      {isLoading ? (
        <FeatureSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {FEATURES.map((feature) => {
            const enabled = flags[feature.key];
            return (
              <Card key={feature.key} className={enabled ? '' : 'opacity-75'}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                        enabled ? 'bg-green-100' : 'bg-gray-100'
                      }`}
                    >
                      <svg
                        className={`h-5 w-5 ${enabled ? 'text-green-600' : 'text-gray-400'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{feature.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">{feature.description}</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={enabled}
                    onChange={(v) => handleToggle(feature.key, v)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom save button for mobile */}
      {hasChanges && (
        <div className="flex justify-end lg:hidden">
          <Button
            onClick={handleSave}
            isLoading={updateFlags.isPending}
          >
            Guardar Cambios
          </Button>
        </div>
      )}
    </div>
  );
}
