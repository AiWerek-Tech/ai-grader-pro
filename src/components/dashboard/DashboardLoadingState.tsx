'use client';

interface DashboardLoadingStateProps {
  title?: string;
  subtitle?: string;
  accentClass?: string;
}

/**
 * Indikator muat & skeleton seragam untuk seluruh halaman data dashboard.
 */
export function DashboardLoadingState({
  title = 'Memuat Data Sistem...',
  subtitle = 'Menyinkronkan data terbaru dari server',
  accentClass = 'border-t-indigo-500',
}: DashboardLoadingStateProps) {
  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6 animate-pulse">
      {/* Skeleton Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-white/[0.06]" />
          <div className="space-y-2">
            <div className="h-7 w-48 sm:w-64 rounded-xl bg-slate-200 dark:bg-white/[0.06]" />
            <div className="h-4 w-64 sm:w-80 rounded-lg bg-slate-100 dark:bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-10 w-36 rounded-xl bg-slate-200 dark:bg-white/[0.06]" />
      </div>

      {/* Center Status Card */}
      <div className="min-h-[42vh] bg-white dark:bg-[#0a0e1a]/70 border border-slate-200 dark:border-white/[0.06] rounded-3xl flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className={`w-12 h-12 border-4 border-slate-200 dark:border-white/10 ${accentClass} rounded-full animate-spin`} />
        <div>
          <div className="text-slate-900 dark:text-white font-black text-base tracking-tight">
            {title}
          </div>
          <div className="text-slate-600 dark:text-slate-400 text-xs font-semibold mt-1">
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}
