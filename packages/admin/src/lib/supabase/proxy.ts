import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_ROUTES = ['/sign-in', '/sign-up', '/forgot-password', '/auth/callback'];
const ONBOARDING_ROUTE = '/onboarding';

/**
 * Middleware session handler. Refreshes the auth session and
 * handles route protection based on JWT claims.
 *
 * Uses getClaims() to validate the JWT signature via JWKS.
 * getClaims() is fast (no network call to Auth server) and secure
 * (validates signature, unlike getSession which is spoofable).
 *
 * If getClaims() is not available in the installed @supabase/ssr version,
 * falls back to getUser() which validates with the Auth server on every call.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validate JWT via getClaims() (preferred) or fall back to getUser()
  let userRole: string | undefined;
  let isAuthenticated = false;

  if (typeof supabase.auth.getClaims === 'function') {
    // getClaims() validates JWT signature locally via JWKS -- fast and secure
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) {
      isAuthenticated = true;
      const appMetadata = (data.claims as Record<string, unknown>).app_metadata as
        | Record<string, unknown>
        | undefined;
      userRole = appMetadata?.role as string | undefined;
    }
  } else {
    // Fallback: getUser() validates with Auth server on every call (slower but secure)
    // This path is used if @supabase/ssr does not yet support getClaims()
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      isAuthenticated = true;
      userRole = user.app_metadata?.role;
    }
  }

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isOnboardingRoute = pathname.startsWith(ONBOARDING_ROUTE);

  // Redirect unauthenticated users to sign-in (except auth routes)
  if (!isAuthenticated && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages (except onboarding)
  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Handle pending_setup role: must complete onboarding first
  if (isAuthenticated && userRole === 'pending_setup' && !isOnboardingRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    return NextResponse.redirect(url);
  }

  // Redirect away from onboarding if role is NOT pending_setup
  if (isAuthenticated && userRole !== 'pending_setup' && isOnboardingRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
