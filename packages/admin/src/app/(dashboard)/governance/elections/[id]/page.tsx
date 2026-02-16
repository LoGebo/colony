'use client';

export const dynamic = 'force-dynamic';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useElectionDetail, useUpdateElectionStatus } from '@/hooks/useGovernance';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/formatters';

const electionStatusVariants = {
  draft: 'neutral' as const,
  open: 'info' as const,
  closed: 'success' as const,
  cancelled: 'danger' as const,
};

const electionTypeVariants = {
  board_election: 'info' as const,
  extraordinary_expense: 'warning' as const,
  bylaw_amendment: 'neutral' as const,
  general_decision: 'success' as const,
};

const electionTypeLabels: Record<string, string> = {
  board_election: 'Elección de Mesa',
  extraordinary_expense: 'Gasto Extraordinario',
  bylaw_amendment: 'Enmienda Reglamento',
  general_decision: 'Decisión General',
};

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  open: 'Abierta',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

export default function ElectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading } = useElectionDetail(id);
  const updateStatus = useUpdateElectionStatus();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-sm text-gray-500">
        Elección no encontrada
      </div>
    );
  }

  const { election, options } = data;
  const quorumPercentage =
    election.quorum_required > 0
      ? (election.total_coefficient_voted / election.quorum_required) * 100
      : 0;

  const chartData = options.map((opt) => ({
    name: opt.title.length > 20 ? opt.title.substring(0, 20) + '...' : opt.title,
    votos: opt.coefficient_total,
  }));

  const handleOpenVoting = () => {
    updateStatus.mutate({ id: election.id, status: 'open' });
  };

  const handleCloseVoting = () => {
    updateStatus.mutate({ id: election.id, status: 'closed' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{election.title}</h1>
            <Badge
              variant={
                electionStatusVariants[election.status as keyof typeof electionStatusVariants] ||
                'neutral'
              }
            >
              {statusLabels[election.status] || election.status}
            </Badge>
            <Badge
              variant={
                electionTypeVariants[
                  election.election_type as keyof typeof electionTypeVariants
                ] || 'neutral'
              }
            >
              {electionTypeLabels[election.election_type] || election.election_type}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">{election.election_number}</p>
          {election.description && (
            <p className="mt-2 text-sm text-gray-700">{election.description}</p>
          )}
          <div className="mt-2 flex gap-4 text-sm text-gray-600">
            <span>Apertura: {formatDate(election.opens_at)}</span>
            <span>Cierre: {formatDate(election.closes_at)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {election.status === 'draft' && (
            <button
              onClick={handleOpenVoting}
              disabled={updateStatus.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Abrir Votación
            </button>
          )}
          {election.status === 'open' && (
            <button
              onClick={handleCloseVoting}
              disabled={updateStatus.isPending}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Cerrar Votación
            </button>
          )}
          <button
            onClick={() => router.push('/governance/elections')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver
          </button>
        </div>
      </div>

      {/* Quorum Progress */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quórum</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Coeficiente votado: {election.total_coefficient_voted}% / {election.quorum_required}%
            </span>
            <Badge variant={election.quorum_met ? 'success' : 'warning'}>
              {election.quorum_met ? 'Alcanzado' : 'Pendiente'}
            </Badge>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all ${
                election.quorum_met ? 'bg-green-600' : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(quorumPercentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {quorumPercentage.toFixed(1)}% del quórum requerido
          </p>
        </div>
      </div>

      {/* Results Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Resultados</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`${Number(value)}%`, 'Coeficiente']}
              />
              <Bar dataKey="votos" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
            Sin resultados disponibles
          </div>
        )}
      </div>

      {/* Options Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Opciones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Opción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Votos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Coeficiente
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {options.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    Sin opciones disponibles
                  </td>
                </tr>
              ) : (
                options.map((option) => (
                  <tr key={option.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {option.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {option.description || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {option.votes_count}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {option.coefficient_total}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
