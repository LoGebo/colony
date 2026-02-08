'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { adminOnboardingSchema } from '@upoe/shared';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Organization & Community
  const [orgName, setOrgName] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [communityAddress, setCommunityAddress] = useState('');
  const [communityCity, setCommunityCity] = useState('');
  const [communityState, setCommunityState] = useState('');
  const [communityZip, setCommunityZip] = useState('');

  // Step 2: Admin name
  const [firstName, setFirstName] = useState('');
  const [paternalSurname, setPaternalSurname] = useState('');

  function handleNextStep(e: FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Nombre de organizacion requerido');
      return;
    }
    if (!communityName.trim()) {
      setError('Nombre de comunidad requerido');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const formData = {
      orgName,
      communityName,
      communityAddress: communityAddress || undefined,
      communityCity: communityCity || undefined,
      communityState: communityState || undefined,
      communityZip: communityZip || undefined,
      firstName: firstName || undefined,
      paternalSurname: paternalSurname || undefined,
    };

    const result = adminOnboardingSchema.safeParse(formData);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc(
        'complete_admin_onboarding',
        {
          p_org_name: orgName,
          p_community_name: communityName,
          p_community_address: communityAddress || undefined,
          p_community_city: communityCity || undefined,
          p_community_state: communityState || undefined,
          p_community_zip: communityZip || undefined,
          p_first_name: firstName || undefined,
          p_paternal_surname: paternalSurname || undefined,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      // CRITICAL: Refresh session to get updated app_metadata
      // (role changes from pending_setup to community_admin)
      await supabase.auth.refreshSession();

      // Middleware will now see community_admin role and allow access
      router.push('/');
    } catch {
      setError('Ocurrio un error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900">
        Configuracion Inicial
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        {step === 1
          ? 'Configura tu organizacion y comunidad para comenzar.'
          : 'Informacion del administrador y resumen.'}
      </p>

      {/* Step indicator */}
      <div className="mt-4 flex gap-2">
        <div
          className={`h-1.5 flex-1 rounded-full ${
            step === 1 ? 'bg-indigo-600' : 'bg-indigo-200'
          }`}
        />
        <div
          className={`h-1.5 flex-1 rounded-full ${
            step === 2 ? 'bg-indigo-600' : 'bg-indigo-200'
          }`}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleNextStep} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="orgName"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre de la organizacion *
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ej: Administradora Central"
              disabled={loading}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor="communityName"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre de la comunidad *
            </label>
            <input
              id="communityName"
              type="text"
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              placeholder="Ej: Residencial Las Palmas"
              disabled={loading}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <p className="text-xs font-medium text-gray-400 pt-2">
            Direccion (opcional)
          </p>

          <div>
            <label
              htmlFor="communityAddress"
              className="block text-sm font-medium text-gray-700"
            >
              Calle y numero
            </label>
            <input
              id="communityAddress"
              type="text"
              value={communityAddress}
              onChange={(e) => setCommunityAddress(e.target.value)}
              placeholder="Calle, numero"
              disabled={loading}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="communityCity"
                className="block text-sm font-medium text-gray-700"
              >
                Ciudad
              </label>
              <input
                id="communityCity"
                type="text"
                value={communityCity}
                onChange={(e) => setCommunityCity(e.target.value)}
                placeholder="Ciudad"
                disabled={loading}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="communityState"
                className="block text-sm font-medium text-gray-700"
              >
                Estado
              </label>
              <input
                id="communityState"
                type="text"
                value={communityState}
                onChange={(e) => setCommunityState(e.target.value)}
                placeholder="Estado"
                disabled={loading}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="w-1/3">
            <label
              htmlFor="communityZip"
              className="block text-sm font-medium text-gray-700"
            >
              Codigo postal
            </label>
            <input
              id="communityZip"
              type="text"
              value={communityZip}
              onChange={(e) => setCommunityZip(e.target.value)}
              placeholder="00000"
              disabled={loading}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Siguiente
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <p className="text-xs text-gray-400">
            Tu nombre aparecera como administrador principal (opcional)
          </p>

          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Tu nombre"
              disabled={loading}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor="paternalSurname"
              className="block text-sm font-medium text-gray-700"
            >
              Apellido paterno
            </label>
            <input
              id="paternalSurname"
              type="text"
              value={paternalSurname}
              onChange={(e) => setPaternalSurname(e.target.value)}
              placeholder="Tu apellido"
              disabled={loading}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          {/* Review summary */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Resumen</h3>
            <dl className="mt-2 space-y-1 text-sm text-gray-600">
              <div>
                <dt className="inline font-medium">Organizacion: </dt>
                <dd className="inline">{orgName}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Comunidad: </dt>
                <dd className="inline">{communityName}</dd>
              </div>
              {communityAddress && (
                <div>
                  <dt className="inline font-medium">Direccion: </dt>
                  <dd className="inline">
                    {communityAddress}
                    {communityCity ? `, ${communityCity}` : ''}
                    {communityState ? `, ${communityState}` : ''}
                    {communityZip ? ` ${communityZip}` : ''}
                  </dd>
                </div>
              )}
              {firstName && (
                <div>
                  <dt className="inline font-medium">Administrador: </dt>
                  <dd className="inline">
                    {firstName} {paternalSurname}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError('');
              }}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed"
            >
              Atras
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
