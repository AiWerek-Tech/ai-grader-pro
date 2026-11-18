'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global app error:', error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen bg-[#050314] text-slate-100 flex items-center justify-center p-6 font-sans antialiased">
        <div className="bg-[#0e0a2a] border border-purple-500/20 rounded-[2rem] p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Terjadi Gangguan Sementara
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Aplikasi mengalami kendala koneksi atau pembaruan sesi. Silakan muat ulang halaman untuk melanjutkan.
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
              className="py-3 px-4 rounded-xl bg-white/5 text-slate-200 font-bold text-xs active:scale-95"
            >
              Coba Lagi
            </button>
            <a
              href={withBasePath('/dashboard')}
              className="py-3 px-4 rounded-xl border border-white/10 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              Beranda
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
