'use server';

import { getCurrentUser } from '@/lib/session-server';
import { getRbacConfigServer } from '@/lib/rbac-server';
import {
  FLEXIBLE_MENU_DEFINITIONS,
  FlexibleMenuKey,
  getMenuAccessLevel,
  MenuAccessLevel,
} from '@/lib/rbac-config';

export async function getMyMenuAccessAction(): Promise<{
  success: boolean;
  isAdmin: boolean;
  permissions: Record<FlexibleMenuKey, MenuAccessLevel>;
}> {
  const empty = Object.fromEntries(
    FLEXIBLE_MENU_DEFINITIONS.map((d) => [d.key, 'none'])
  ) as Record<FlexibleMenuKey, MenuAccessLevel>;

  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, isAdmin: false, permissions: empty };

    const isAdmin = user.role === 'ADMIN';
    const rbac = await getRbacConfigServer();
    const permissions = Object.fromEntries(
      FLEXIBLE_MENU_DEFINITIONS.map((d) => [
        d.key,
        isAdmin ? 'full' : getMenuAccessLevel(user.role, user.id, d.key, rbac),
      ])
    ) as Record<FlexibleMenuKey, MenuAccessLevel>;

    return { success: true, isAdmin, permissions };
  } catch {
    return { success: false, isAdmin: false, permissions: empty };
  }
}
