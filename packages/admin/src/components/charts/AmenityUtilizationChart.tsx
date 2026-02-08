'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Reservation {
  reserved_range: string | null;
  status: string;
  created_at: string;
}

interface AmenityUtilizationChartProps {
  reservations: Reservation[];
}

interface DailyCount {
  date: string;
  bookings: number;
}

interface HourlyCount {
  hour: string;
  count: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse a Postgres tstzrange string to extract the lower bound date/time.
 * Format: ["2026-02-01 10:00:00+00","2026-02-01 12:00:00+00")
 * Falls back to created_at if range is unparseable.
 */
function parseLowerBound(range: string | null, fallback: string): Date {
  if (!range) return new Date(fallback);

  // Remove brackets: [" or ("
  const cleaned = range.replace(/^[\[(]"?/, '').replace(/"?[\])]$/, '');
  const parts = cleaned.split(',');
  if (parts.length < 1) return new Date(fallback);

  const lower = parts[0].replace(/"/g, '').trim();
  const parsed = new Date(lower);
  return isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

function formatShortDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}/${m}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AmenityUtilizationChart({ reservations }: AmenityUtilizationChartProps) {
  const { dailyData, peakHours } = useMemo(() => {
    if (reservations.length === 0) return { dailyData: [], peakHours: [] };

    // Bookings per day
    const dailyMap = new Map<string, number>();
    // Bookings per hour of day
    const hourlyMap = new Map<number, number>();

    for (const r of reservations) {
      const dt = parseLowerBound(r.reserved_range, r.created_at);

      // Daily count
      const dateKey = dt.toISOString().split('T')[0];
      dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1);

      // Hourly count
      const hour = dt.getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
    }

    // Sort daily data chronologically
    const dailyData: DailyCount[] = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bookings]) => ({
        date: formatShortDate(new Date(date)),
        bookings,
      }));

    // Top 5 peak hours
    const peakHours: HourlyCount[] = [...hourlyMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([hour, count]) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count,
      }));

    return { dailyData, peakHours };
  }, [reservations]);

  if (reservations.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        Sin datos de reservaciones disponibles
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily bookings bar chart */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-700">
          Reservaciones por dia
        </h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [Number(value), 'Reservaciones']}
            />
            <Bar
              dataKey="bookings"
              name="Reservaciones"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Peak hours list */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-700">
          Horas pico (Top 5)
        </h4>
        {peakHours.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos</p>
        ) : (
          <div className="space-y-2">
            {peakHours.map((ph) => {
              const maxCount = peakHours[0]?.count ?? 1;
              const pct = (ph.count / maxCount) * 100;
              return (
                <div key={ph.hour} className="flex items-center gap-3">
                  <span className="w-14 text-sm font-mono text-gray-600">
                    {ph.hour}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 rounded-full bg-gray-100">
                      <div
                        className="h-5 rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-gray-700">
                    {ph.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
