'use client';

import React from 'react';
import { Lock } from 'lucide-react';

export function ReadOnlyBanner({ menuLabel }: { menuLabel: string }) {
  return (
    <div className="print:hidden flex items-center gap-3 px-4 py-3 rounded-2xl bg-sky-50/90 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-sky-900 dark:text-sky-200 shadow-xs">
      <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
        <Lock className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
          Mode Hanya Lihat (Read-Only) — {menuLabel}
        </div>
        <p className="text-[11px] font-medium text-sky-800/80 dark:text-sky-200/80 mt-0.5 leading-snug">
          Anda dapat melihat, mencari, dan mencetak data pada halaman ini. Tombol tambah, edit, hapus, dan simpan dikunci oleh Administrator.
        </p>
      </div>
    </div>
  );
}
