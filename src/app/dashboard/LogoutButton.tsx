'use client';

import { logoutAction } from '@/lib/actions/auth';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logoutAction();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all w-full"
    >
      <span>🚪</span>
      <span className="font-medium">Keluar</span>
    </button>
  );
}
