/**
 * @deprecated Not currently imported by mobile package. Kept for future centralized routing.
 */
// ---------- Mobile (Expo Router) ----------
export const MOBILE_ROUTES = {
  SIGN_IN: '/(auth)/sign-in',
  SIGN_UP: '/(auth)/sign-up',
  FORGOT_PASSWORD: '/(auth)/forgot-password',
  ONBOARDING: '/(auth)/onboarding',
  RESIDENT_HOME: '/(resident)/',
  GUARD_HOME: '/(guard)/',
  ADMIN_HOME: '/(admin)/',
} as const;

/**
 * @deprecated Not currently imported by admin package. Kept for future centralized routing.
 */
// ---------- Admin Dashboard (Next.js) ----------
export const ADMIN_ROUTES = {
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  DASHBOARD: '/',
  AUTH_CALLBACK: '/auth/callback',
  ONBOARDING: '/onboarding',
  USERS: '/users',
  SETTINGS: '/settings',
} as const;

// Auth paths used by middleware to skip auth checks
export const AUTH_ROUTES = [
  ADMIN_ROUTES.SIGN_IN,
  ADMIN_ROUTES.SIGN_UP,
  ADMIN_ROUTES.AUTH_CALLBACK,
  MOBILE_ROUTES.SIGN_IN,
  MOBILE_ROUTES.SIGN_UP,
  MOBILE_ROUTES.FORGOT_PASSWORD,
] as const;
