'use server';

import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData, assertSessionSecretConfigured, sessionOptions } from './session';

/**
 * Mendapatkan session object dari cookie terenkripsi.
 * Pengganti getSessionUser(token) dari Auth.gs
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  // Only validate SESSION_SECRET when actually reading cookies (runtime request)
  // During build/prerender, cookies() will throw if called, so we validate after
  const cookieStore = await cookies();
  assertSessionSecretConfigured();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

/**
 * Mendapatkan data user yang sedang login.
 * Return null jika belum login.
 */
export async function getCurrentUser(): Promise<SessionData | null> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) return null;
    return {
      id: session.id,
      username: session.username,
      role: session.role,
      nama: session.nama,
      profile_url: session.profile_url,
      isLoggedIn: session.isLoggedIn,
    };
  } catch {
    return null;
  }
}

/**
 * Authentication guard for server actions.
 * Throws error if user is not logged in.
 * Returns session data if authenticated.
 */
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    throw new Error('Unauthorized: Silakan login terlebih dahulu.');
  }
  return session;
}

/**
 * Authorization guard untuk action khusus ADMIN.
 */
export async function requireAdmin(): Promise<SessionData> {
  const session = await requireAuth();
  if (session.role !== 'ADMIN') {
    throw new Error('Forbidden: Anda tidak memiliki akses admin.');
  }
  return session;
}
