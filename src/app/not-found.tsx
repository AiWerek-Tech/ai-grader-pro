import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050314] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-[#0e0a2a] border border-slate-200 dark:border-purple-500/20 rounded-[2rem] p-8 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-cyan-400">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <BrandLogo variant="symbol" className="w-4 h-4 rounded" />
          <span>Halaman Tidak Ditemukan (404)</span>
        </div>

        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Halaman Tidak Tersedia
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Tautan yang Anda buka mungkin telah dipindahkan atau alamat URL tidak lengkap.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <Link
            href="/dashboard"
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>Ke Dashboard</span>
          </Link>
          <Link
            href="/login"
            className="py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Halaman Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
