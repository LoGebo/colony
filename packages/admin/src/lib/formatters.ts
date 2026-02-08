/**
 * Locale-aware formatters for currency (MXN), dates, and percentages.
 * Used across all financial dashboard components.
 */

const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const monthNames = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/**
 * Format a number as Mexican Peso currency (MXN).
 * Example: 15000 -> "$15,000.00"
 */
export function formatCurrency(amount: number): string {
  return mxnFormatter.format(amount);
}

/**
 * Format a decimal as percentage.
 * Example: 85.3 -> "85.3%"
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format a date string in Spanish locale.
 * Example: "2026-02-08" -> "8 feb 2026"
 */
export function formatDate(dateStr: string): string {
  return dateFormatter.format(new Date(dateStr));
}

/**
 * Format year and month number into a short month label.
 * Example: (2026, 1) -> "Ene 2026"
 */
export function formatMonth(year: number, month: number): string {
  return `${monthNames[month - 1]} ${year}`;
}
