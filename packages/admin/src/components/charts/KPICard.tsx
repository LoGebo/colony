'use client';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
}

/**
 * KPI metric card displaying a title, formatted value,
 * and optional trend change percentage.
 */
export function KPICard({ title, value, change, changeLabel, icon }: KPICardProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <p
          className={`mt-1 text-sm ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? '+' : ''}
          {change.toFixed(1)}%
          {changeLabel && (
            <span className="text-gray-500"> {changeLabel}</span>
          )}
        </p>
      )}
    </div>
  );
}
