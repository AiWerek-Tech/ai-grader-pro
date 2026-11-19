import { dbGetAll } from '@/lib/google-sheets';
import { requireAuth } from '@/lib/session-server';
import { SessionData } from '@/lib/session';
import {
  FlexibleMenuKey,
  getMenuAccessLevel,
  hasMenuAccess,
  MenuAccessLevel,
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

export async function getUserMenuAccessLevel(
  user: Pick<SessionData, 'id' | 'role'> | null | undefined,
  menuKey: FlexibleMenuKey
): Promise<MenuAccessLevel> {
  if (!user) return 'none';
  if (user.role === 'ADMIN') return 'full';
  const rbac = await getRbacConfigServer();
  return getMenuAccessLevel(user.role, user.id, menuKey, rbac);
}

export async function checkUserMenuAccess(
  user: Pick<SessionData, 'id' | 'role'> | null | undefined,
  menuKey: FlexibleMenuKey,
  required: 'read' | 'full' = 'read'
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const rbac = await getRbacConfigServer();
  return hasMenuAccess(user.role, user.id, menuKey, rbac, required);
}

/**
 * Authorization guard 2-tingkat ('read' | 'full') untuk Server Actions yang didelegasikan ke Guru.
 */
export async function requireMenuAccess(
  menuKey: FlexibleMenuKey,
  required: 'read' | 'full' = 'read'
): Promise<SessionData> {
  const session = await requireAuth();
  if (session.role === 'ADMIN') return session;

  const rbac = await getRbacConfigServer();
  const level = getMenuAccessLevel(session.role, session.id, menuKey, rbac);

  if (required === 'full' && level !== 'full') {
    throw new Error(
      level === 'read'
        ? 'Forbidden: Akses Anda pada menu ini hanya Lihat Saja (Read-Only). Hubungi Admin untuk akses edit.'
        : 'Forbidden: Anda tidak memiliki izin akses untuk menu ini.'
    );
  }

  if (level === 'none') {
    throw new Error('Forbidden: Anda tidak memiliki izin akses untuk menu ini.');
  }

  return session;
}
