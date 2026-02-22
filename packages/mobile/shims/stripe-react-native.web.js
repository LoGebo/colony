// Shim for @stripe/stripe-react-native (requires dev build)
// Provides no-op implementations so the app can load in Expo Go and web
import React from 'react';

export function StripeProvider({ children }) {
  return children;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
    presentPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
    confirmPayment: async () => ({ error: { message: 'Stripe not available on web' } }),
  };
}

export function CardField() {
  return null;
}
