import { toast } from 'sonner';

/**
 * Common Supabase/Postgres error patterns → user-friendly Spanish messages.
 */
const ERROR_MAP: [RegExp, string][] = [
  [/duplicate key.*unique/i, 'Ya existe un registro con estos datos'],
  [/violates foreign key/i, 'No se puede realizar porque hay datos relacionados'],
  [/violates check constraint/i, 'El valor ingresado no es válido'],
  [/new row violates.*policy/i, 'No tienes permisos para esta acción'],
  [/permission denied/i, 'No tienes permisos para esta acción'],
  [/row-level security/i, 'No tienes permisos para esta acción'],
  [/JWT expired/i, 'Tu sesión expiró. Inicia sesión nuevamente'],
  [/not authenticated/i, 'No estás autenticado. Inicia sesión nuevamente'],
  [/could not find.*function/i, 'Función no disponible. Contacta al administrador'],
  [/timeout/i, 'La operación tardó demasiado. Intenta de nuevo'],
  [/network/i, 'Error de conexión. Verifica tu internet'],
  [/fetch failed/i, 'Error de conexión. Verifica tu internet'],
];

/**
 * Sanitize a Supabase/Postgres error message into a user-friendly string.
 * Falls back to a generic message if no pattern matches a known internal error.
 */
export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  for (const [pattern, friendly] of ERROR_MAP) {
    if (pattern.test(message)) return friendly;
  }

  // If the message looks like an internal/technical Supabase error, hide it
  if (
    message.includes('pg_') ||
    message.includes('supabase') ||
    message.includes('relation "') ||
    message.includes('column "') ||
    message.includes('syntax error')
  ) {
    return 'Ocurrió un error inesperado. Intenta de nuevo';
  }

  // Otherwise return the original message (it's likely already user-friendly)
  return message;
}

/**
 * Show a toast.error with a sanitized message.
 * Use in onError callbacks: `onError: (err) => toastError('Error al crear', err)`
 */
export function toastError(prefix: string, error: unknown): void {
  const sanitized = sanitizeError(error);
  toast.error(`${prefix}: ${sanitized}`);
}
