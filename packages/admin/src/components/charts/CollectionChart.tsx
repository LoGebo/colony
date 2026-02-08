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
import { formatCurrency } from '@/lib/formatters';

interface CollectionChartProps {
  data: Array<{
    month: string;
    billed: number;
    collected: number;
  }>;
}

/**
 * Bar chart comparing billed vs collected amounts by month.
 * Uses indigo for "Facturado" and green for "Cobrado".
 */
export function CollectionChart({ data }: CollectionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        Sin datos de cobranza disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
        />
        <Legend />
        <Bar dataKey="billed" name="Facturado" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="collected" name="Cobrado" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
