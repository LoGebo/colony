'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DelinquencyChartProps {
  data: Array<{
    month: string;
    d30: number;
    d60: number;
    d90: number;
  }>;
}

/**
 * Line chart showing delinquency trend across 30/60/90 day buckets.
 * Yellow for 30 days, orange for 60 days, red for 90+ days.
 */
export function DelinquencyChart({ data }: DelinquencyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        Sin datos de morosidad disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="d30"
          name="30 dias"
          stroke="#eab308"
          strokeWidth={2}
          dot={{ fill: '#eab308', r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="d60"
          name="60 dias"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ fill: '#f97316', r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="d90"
          name="90+ dias"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: '#ef4444', r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
