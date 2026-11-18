import { dbGetAll } from '@/lib/google-sheets';
import { requireAuth } from '@/lib/session-server';
import { SessionData } from '@/lib/session';
import {
  FlexibleMenuKey,
  hasMenuAccess,
  parseRbacFromSettings,
  RbacConfig,
} from '@/lib/rbac-config';

export async function getRbacConfigServer(): Promise<RbacConfig> {
  try {
    const rows = await dbGetAll('SETTINGS', true);
    const settings: Record<string, string> = {};
    for (const row of rows || []) {
      const k = String(row?.key || '').trim();
      if (k) settings[k] = String(row?.value ?? '');
    }
    return parseRbacFromSettings(settings);
  } catch {
    return parseRbacFromSettings({});
  }
}

export async function checkUserMenuAccess(
  user: Pick<SessionData, 'id' | 'role'> | null | undefined,
  menuKey: FlexibleMenuKey
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const rbac = await getRbacConfigServer();
  return hasMenuAccess(user.role, user.id, menuKey, rbac);
}

/**
 * Authorization guard untuk Server Actions yang bisa didelegasikan ke Guru
 * melalui pengaturan Hak Akses Menu di /dashboard/settings.
 */
export async function requireMenuAccess(menuKey: FlexibleMenuKey): Promise<SessionData> {
  const session = await requireAuth();
  if (session.role === 'ADMIN') return session;

  const rbac = await getRbacConfigServer();
  if (!hasMenuAccess(session.role, session.id, menuKey, rbac)) {
    throw new Error('Forbidden: Anda tidak memiliki izin akses untuk menu ini.');
  }
  return session;
}
