'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white dark:bg-[#0e0a2a] border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Sesi atau Halaman Perlu Dimuat Ulang
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Terjadi pembaruan sistem atau gangguan sementara saat memuat data. Silakan muat ulang halaman ini.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95"
          >
            Coba Lagi
          </button>
          <a
            href={withBasePath('/login')}
            className="py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            Login
          </a>
        </div>
      </div>
    </div>
  );
}
