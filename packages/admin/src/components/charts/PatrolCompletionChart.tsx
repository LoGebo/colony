'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PatrolCompletionChartProps {
  data: Array<{
    guard_name: string;
    patrols_completed: number;
    patrols_scheduled: number;
  }>;
}

/**
 * Bar chart comparing completed vs scheduled patrols by guard.
 * Uses green for completed and indigo for scheduled.
 */
export function PatrolCompletionChart({ data }: PatrolCompletionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        Sin datos de patrullaje disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="guard_name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="patrols_completed"
          name="Completados"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="patrols_scheduled"
          name="Programados"
          fill="#6366f1"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
