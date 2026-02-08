import { parseISO, format, formatDistanceToNow, isBefore, isAfter, addHours } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Format a date string as "dd MMM yyyy" (e.g., "08 feb 2026")
 */
export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy', { locale: es });
}

/**
 * Format a date string as "dd MMM yyyy, HH:mm"
 */
export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm', { locale: es });
}

/**
 * Extract HH:mm from a time or datetime string.
 * Handles both "HH:mm:ss" time strings and full ISO datetime strings.
 */
export function formatTime(timeStr: string): string {
  // If it looks like a time-only string (HH:mm or HH:mm:ss)
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return timeStr.slice(0, 5);
  }
  // Otherwise treat as ISO date
  return format(parseISO(timeStr), 'HH:mm', { locale: es });
}

/**
 * Format a date string as relative time in Spanish (e.g., "hace 5 minutos")
 */
export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: es });
}

/**
 * Format a number as currency (e.g., "$1,234.56 MXN")
 */
export function formatCurrency(amount: number, currency: string = 'MXN'): string {
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

/**
 * Check if a date string is in the past (expired)
 */
export function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return isBefore(parseISO(dateStr), new Date());
}

/**
 * Check if a date string is within the next 24 hours
 */
export function isUpcoming(dateStr: string): boolean {
  const date = parseISO(dateStr);
  const now = new Date();
  return isAfter(date, now) && isBefore(date, addHours(now, 24));
}

/**
 * Spanish day name labels indexed by JS day number (0=Sunday)
 */
export const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miercoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sabado',
};
