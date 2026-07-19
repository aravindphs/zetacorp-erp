/**
 * Global middleware (spec §55, §73): session refresh + authentication gate.
 *
 * Responsibilities kept here: authentication, session validation, and
 * redirecting unauthorized users. Fine-grained permission checks and all
 * business logic live in Server Components / Route Handlers, not here.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/** Paths that never require authentication. */
const PUBLIC_PATHS = ['/login', '/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const isAuthenticated = userId !== null;
  const { pathname, search } = request.nextUrl;

  // Send authenticated users away from the login page and the bare root.
  if (isAuthenticated && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Unauthenticated users may only reach public paths.
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on all routes except Next internals and static assets. API routes are
  // included so their session cookies refresh, but they enforce their own auth.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
