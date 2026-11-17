// ============================================================
// Session Configuration — Encrypted Cookie-Based Auth
// Pengganti CacheService.getScriptCache() dari GAS
// ============================================================

export interface SessionData {
  id: string;
  username: string;
  role: 'ADMIN' | 'GURU';
  nama: string;
  profile_url?: string;
  isLoggedIn: boolean;
}

function resolveSecureCookieSetting(isHttpsRequest?: boolean) {
  const override = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;
  if (typeof isHttpsRequest === 'boolean') return isHttpsRequest;
  // Default false agar akses via jaringan lokal sekolah (http://192.168.x.x:3000 di HP Android)
  // tidak ditolak oleh browser mobile akibat atribut Secure pada koneksi HTTP lokal.
  return false;
}

export function assertSessionSecretConfigured() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required in production.');
  }

  if (secret.length < 32) {
    throw new Error('SESSION_SECRET minimal 32 karakter di production.');
  }
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
  cookieName: 'wmvaa_grader_session',
  ttl: 21600, // 6 jam (sama seperti GAS: CONFIG.SESSION_EXP_SECONDS)
  cookieOptions: {
    path: process.env.NEXT_PUBLIC_BASE_PATH || '/ai-grader',
    secure: resolveSecureCookieSetting(),
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};

export function getDynamicSessionOptions(isHttpsRequest?: boolean) {
  return {
    ...sessionOptions,
    cookieOptions: {
      ...sessionOptions.cookieOptions,
      secure: resolveSecureCookieSetting(isHttpsRequest),
    },
  };
}
