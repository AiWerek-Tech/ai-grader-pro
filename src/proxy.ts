import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { assertSessionSecretConfigured, sessionOptions, type SessionData } from '@/lib/session';

// ============================================================
// Proxy — Route Protection
// Pengganti requireAuth() dari Auth.gs baris 134-152
// Next.js 16 menggunakan file convention `proxy.ts`
// ============================================================

const ADMIN_ONLY_ROUTES = [
  '/dashboard/guru',
  '/dashboard/settings',
  '/dashboard/doctor',
  '/dashboard/logs',
  '/dashboard/tugas-mengajar',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  assertSessionSecretConfigured();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === 'GURU' && ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
