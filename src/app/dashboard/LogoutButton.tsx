'use client';

import { logoutAction } from '@/lib/actions/auth';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logoutAction();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center justify-center lg:justify-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/[0.06] hover:bg-rose-500/15 border border-rose-500/15 hover:border-rose-500/30 transition-all active:scale-95 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
    >
      <LogOut className="w-4 h-4 shrink-0" />
      <span>Keluar Akun</span>
    </button>
  );
}
