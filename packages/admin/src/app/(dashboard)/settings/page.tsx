'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
  useCommunity,
  useCommunitySettings,
  useUpdateCommunity,
  useUpdateCommunitySettings,
} from '@/hooks/useCommunitySettings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ── Timezone options ───────────────────────────────────────────────

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de Mexico (CST)' },
  { value: 'America/Cancun', label: 'Cancun (EST)' },
  { value: 'America/Monterrey', label: 'Monterrey (CST)' },
  { value: 'America/Mazatlan', label: 'Mazatlan (MST)' },
  { value: 'America/Tijuana', label: 'Tijuana (PST)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)' },
  { value: 'America/Merida', label: 'Merida (CST)' },
  { value: 'America/Chihuahua', label: 'Chihuahua (CST)' },
];

const CURRENCIES = [
  { value: 'MXN', label: 'Peso Mexicano (MXN)' },
  { value: 'USD', label: 'Dolar Americano (USD)' },
];

// ── Loading Skeleton ───────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <Card>
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded bg-gray-100" />
          <div className="h-10 animate-pulse rounded bg-gray-100" />
          <div className="h-10 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </Card>
  );
}

// ── Color Preview ──────────────────────────────────────────────────

function ColorPreview({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4">
      <p className="mb-3 text-sm font-medium text-gray-600">Vista previa</p>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div
            className="h-12 w-12 rounded-lg border border-gray-200"
            style={{ backgroundColor: primary || '#4F46E5' }}
          />
          <span className="text-xs text-gray-500">Primario</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div
            className="h-12 w-12 rounded-lg border border-gray-200"
            style={{ backgroundColor: secondary || '#7C3AED' }}
          />
          <span className="text-xs text-gray-500">Secundario</span>
        </div>
        <div className="ml-4 flex-1 rounded-lg p-3" style={{ backgroundColor: primary || '#4F46E5' }}>
          <p className="text-sm font-medium text-white">Ejemplo de boton</p>
        </div>
        <div className="flex-1 rounded-lg border-2 p-3" style={{ borderColor: secondary || '#7C3AED' }}>
          <p className="text-sm font-medium" style={{ color: secondary || '#7C3AED' }}>
            Enlace secundario
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Input Helpers ──────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

// ── Main Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: community, isLoading: communityLoading } = useCommunity();
  const { data: settings, isLoading: settingsLoading } = useCommunitySettings();
  const updateCommunity = useUpdateCommunity();
  const updateSettings = useUpdateCommunitySettings();

  // Section 1: General Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [currency, setCurrency] = useState('MXN');

  // Section 2: Branding
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  // Section 3: Contact Info
  const [managementPhone, setManagementPhone] = useState('');
  const [managementEmail, setManagementEmail] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [officeHoursStart, setOfficeHoursStart] = useState('');
  const [officeHoursEnd, setOfficeHoursEnd] = useState('');

  // Section 4: Community Rules
  const [quietHoursStart, setQuietHoursStart] = useState('');
  const [quietHoursEnd, setQuietHoursEnd] = useState('');
  const [petPolicy, setPetPolicy] = useState('');
  const [customRules, setCustomRules] = useState('');

  // Pre-populate from fetched data
  useEffect(() => {
    if (community) {
      setName(community.name ?? '');
      setDescription(community.description ?? '');
      setTimezone(community.timezone ?? 'America/Mexico_City');
      setCurrency(community.currency ?? 'MXN');
      setLogoUrl(community.logo_url ?? '');
      setPrimaryColor(community.primary_color ?? '');
      setSecondaryColor(community.secondary_color ?? '');
    }
  }, [community]);

  useEffect(() => {
    if (settings) {
      setManagementPhone(settings.management_phone ?? '');
      setManagementEmail(settings.management_email ?? '');
      setEmergencyPhone(settings.emergency_phone ?? '');
      setOfficeHoursStart(settings.office_hours_start ?? '');
      setOfficeHoursEnd(settings.office_hours_end ?? '');
      setQuietHoursStart(settings.quiet_hours_start ?? '');
      setQuietHoursEnd(settings.quiet_hours_end ?? '');
      setPetPolicy(settings.pet_policy ?? '');
      setCustomRules(
        typeof settings.custom_rules === 'string'
          ? settings.custom_rules
          : settings.custom_rules
            ? JSON.stringify(settings.custom_rules, null, 2)
            : ''
      );
    }
  }, [settings]);

  const isLoading = communityLoading || settingsLoading;

  // ── Handlers ───────────────────────────────────────────────────

  function handleSaveGeneral() {
    updateCommunity.mutate({
      name,
      description: description || null,
      timezone,
      currency,
    });
  }

  function handleSaveBranding() {
    updateCommunity.mutate({
      logo_url: logoUrl || null,
      primary_color: primaryColor || null,
      secondary_color: secondaryColor || null,
    });
  }

  function handleSaveContact() {
    updateSettings.mutate({
      management_phone: managementPhone || null,
      management_email: managementEmail || null,
      emergency_phone: emergencyPhone || null,
      office_hours_start: officeHoursStart || null,
      office_hours_end: officeHoursEnd || null,
    });
  }

  function handleSaveRules() {
    updateSettings.mutate({
      quiet_hours_start: quietHoursStart || null,
      quiet_hours_end: quietHoursEnd || null,
      pet_policy: petPolicy || null,
      custom_rules: customRules || null,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuracion de la Comunidad</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administra la informacion, marca e identidad de tu comunidad
          </p>
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuracion de la Comunidad</h1>
        <p className="mt-1 text-sm text-gray-500">
          Administra la informacion, marca e identidad de tu comunidad
        </p>
      </div>

      {/* Section 1: General Info */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Informacion General</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className={labelClass}>
              Nombre de la Comunidad *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="description" className={labelClass}>
              Descripcion
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="timezone" className={labelClass}>
              Zona Horaria
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={inputClass}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="currency" className={labelClass}>
              Moneda
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSaveGeneral}
            isLoading={updateCommunity.isPending}
            disabled={!name.trim()}
          >
            Guardar Cambios
          </Button>
        </div>
      </Card>

      {/* Section 2: Branding */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Marca e Identidad</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="logoUrl" className={labelClass}>
              URL del Logo
            </label>
            <input
              id="logoUrl"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://ejemplo.com/logo.png"
              className={inputClass}
            />
            {logoUrl && (
              <div className="mt-2">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-16 w-16 rounded-lg border border-gray-200 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="primaryColor" className={labelClass}>
              Color Primario
            </label>
            <div className="flex items-center gap-2">
              <input
                id="primaryColor"
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#4F46E5"
                className={inputClass}
              />
              <input
                type="color"
                value={primaryColor || '#4F46E5'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-gray-300"
              />
            </div>
          </div>
          <div>
            <label htmlFor="secondaryColor" className={labelClass}>
              Color Secundario
            </label>
            <div className="flex items-center gap-2">
              <input
                id="secondaryColor"
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#7C3AED"
                className={inputClass}
              />
              <input
                type="color"
                value={secondaryColor || '#7C3AED'}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-gray-300"
              />
            </div>
          </div>
        </div>
        <ColorPreview
          primary={primaryColor}
          secondary={secondaryColor}
        />
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSaveBranding}
            isLoading={updateCommunity.isPending}
          >
            Guardar Cambios
          </Button>
        </div>
      </Card>

      {/* Section 3: Contact Info */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Informacion de Contacto</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="managementPhone" className={labelClass}>
              Telefono de Oficina
            </label>
            <input
              id="managementPhone"
              type="tel"
              value={managementPhone}
              onChange={(e) => setManagementPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="managementEmail" className={labelClass}>
              Email de Administracion
            </label>
            <input
              id="managementEmail"
              type="email"
              value={managementEmail}
              onChange={(e) => setManagementEmail(e.target.value)}
              placeholder="admin@comunidad.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="emergencyPhone" className={labelClass}>
              Telefono de Emergencia
            </label>
            <input
              id="emergencyPhone"
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="+52 55 9876 5432"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="officeHours" className={labelClass}>
              Horario de Oficina
            </label>
            <div className="flex items-center gap-2">
              <input
                id="officeHoursStart"
                type="time"
                value={officeHoursStart}
                onChange={(e) => setOfficeHoursStart(e.target.value)}
                className={inputClass}
              />
              <span className="text-sm text-gray-500">a</span>
              <input
                id="officeHoursEnd"
                type="time"
                value={officeHoursEnd}
                onChange={(e) => setOfficeHoursEnd(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSaveContact}
            isLoading={updateSettings.isPending}
          >
            Guardar Cambios
          </Button>
        </div>
      </Card>

      {/* Section 4: Community Rules */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Reglas de la Comunidad</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="quietHours" className={labelClass}>
              Horario de Silencio
            </label>
            <div className="flex items-center gap-2">
              <input
                id="quietHoursStart"
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
                className={`${inputClass} max-w-[160px]`}
              />
              <span className="text-sm text-gray-500">a</span>
              <input
                id="quietHoursEnd"
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
                className={`${inputClass} max-w-[160px]`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="petPolicy" className={labelClass}>
              Politica de Mascotas
            </label>
            <textarea
              id="petPolicy"
              value={petPolicy}
              onChange={(e) => setPetPolicy(e.target.value)}
              rows={3}
              placeholder="Ej: Se permiten mascotas de hasta 20kg. Deben estar con correa en areas comunes..."
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="customRules" className={labelClass}>
              Reglas Personalizadas
            </label>
            <textarea
              id="customRules"
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
              rows={5}
              placeholder="Agrega reglas adicionales de la comunidad..."
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSaveRules}
            isLoading={updateSettings.isPending}
          >
            Guardar Cambios
          </Button>
        </div>
      </Card>
    </div>
  );
}
