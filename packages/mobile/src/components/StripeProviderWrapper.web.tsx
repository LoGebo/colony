// Web: no-op wrapper — Stripe Elements are used per-screen via @stripe/react-stripe-js
import type { ReactNode } from 'react';

export function StripeProvider({ children }: { publishableKey?: string; merchantIdentifier?: string; children: ReactNode }) {
  return <>{children}</>;
}
