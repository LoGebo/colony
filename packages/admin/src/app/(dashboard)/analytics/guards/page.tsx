'use client';

import { useState } from 'react';
import { useGuardPerformance } from '@/hooks/useAnalytics';
import { PatrolCompletionChart } from '@/components/charts/PatrolCompletionChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const dynamic = 'force-dynamic';

/**
 * Guard analytics dashboard showing patrol completion rates,
 * incident statistics, and per-guard performance metrics.
 */
export default function GuardAnalyticsPage() {
  // Default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(fmt(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(fmt(today));

  const { data: metrics, isLoading } = useGuardPerformance(dateFrom, dateTo);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Metricas de Guardias</h1>
            <p className="mt-1 text-sm text-gray-500">
              Desempeno y estadisticas del equipo de seguridad
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-[400px] animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-500">
        Error al cargar metricas de guardias
      </div>
    );
  }

  const hasData = metrics.totalPatrols > 0;

  return (
    <div className="space-y-6">
      {/* Header with date filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metricas de Guardias</h1>
          <p className="mt-1 text-sm text-gray-500">
            Desempeno y estadisticas del equipo de seguridad
          </p>
        </div>

        <div className="flex gap-3">
          <div>
            <label htmlFor="dateFrom" className="block text-xs font-medium text-gray-700">
              Desde
            </label>
            <input
              type="date"
              id="dateFrom"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="dateTo" className="block text-xs font-medium text-gray-700">
              Hasta
            </label>
            <input
              type="date"
              id="dateTo"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-500">
          No hay datos de patrullaje para el periodo seleccionado
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Total Patrullajes</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.totalPatrols}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Tasa de Completitud</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {metrics.completionRate.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Incidentes Atendidos</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.totalIncidents}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Patrullajes Completos</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{metrics.completedPatrols}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Patrol Completion Chart */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Patrullajes por Guardia</h2>
              <PatrolCompletionChart data={metrics.patrolByGuard} />
            </div>

            {/* Incidents by Severity */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Incidentes por Severidad
              </h2>
              {metrics.incidentsBySeverity.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
                  Sin incidentes registrados
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.incidentsBySeverity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="severity" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Cantidad" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
