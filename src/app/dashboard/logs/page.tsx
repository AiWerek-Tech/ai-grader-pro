export const dynamic = 'force-dynamic';

import { getSystemLogsAction } from '@/lib/actions/admin';
import { ScrollText, AlertOctagon, Ghost } from 'lucide-react';

export default async function LogsPage() {
  const { success, data, message } = await getSystemLogsAction(100);
  const logs = data || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4">
            <span className="p-2.5 sm:p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl sm:rounded-[1.5rem] shadow-inner border border-indigo-500/10 dark:border-indigo-500/20">
              <ScrollText className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" />
            </span>
            Histori Audit Sistem
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 sm:mt-3 font-semibold text-xs sm:text-sm max-w-xl">Log aktivitas lengkap untuk pemantauan keamanan dan integritas operasional.</p>
        </div>
      </div>

      {!success && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-500 p-4 sm:p-5 rounded-2xl font-bold flex items-center gap-4 animate-shake shadow-sm text-xs sm:text-sm">
          <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500 flex-shrink-0" /> Gagal mengambil data log: {message}
        </div>
      )}

      <div className="bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-3xl sm:rounded-[3rem] overflow-hidden shadow-sm dark:shadow-2xl relative transition-colors">
        {/* ── Mobile Native Card View (Hanya tampil di layar HP <640px) ── */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/[0.05]">
          {logs.length > 0 ? logs.map((log: any, i: number) => (
            <div key={i} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black tracking-widest uppercase border ${
                  log.level === 'ERROR' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-500 border-rose-500/20' :
                  log.level === 'WARN' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 border-emerald-500/20'
                }`}>
                  {log.level}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {new Date(log.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{log.action}</span>
                <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/5">
                  {log.userId}
                </span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                {log.message}
              </div>
            </div>
          )) : (
            <div className="p-12 text-center">
              <Ghost className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum Ada Aktivitas Terdeteksi</div>
            </div>
          )}
        </div>

        {/* ── Desktop & Tablet Table View ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap lg:whitespace-normal">
            <thead className="bg-slate-50 dark:bg-white/[0.03] text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 border-b border-slate-200 dark:border-white/[0.05]">
              <tr>
                <th className="px-6 lg:px-10 py-6">Waktu Kejadian</th>
                <th className="px-6 lg:px-10 py-6 text-center">Level</th>
                <th className="px-6 lg:px-10 py-6">Aksi & Deskripsi Aktivitas</th>
                <th className="px-6 lg:px-10 py-6 text-right">User ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.02]">
              {logs.length > 0 ? logs.map((log: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-all group">
                  <td className="px-6 lg:px-10 py-6 lg:py-8 align-top lg:align-middle">
                    <div className="text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                      {new Date(log.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 lg:px-10 py-6 lg:py-8 text-center align-top lg:align-middle">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                      log.level === 'ERROR' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-500 border-rose-500/20 shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 
                      log.level === 'WARN' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/20' : 
                      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 border-emerald-500/20'
                    }`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 lg:px-10 py-6 lg:py-8">
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                      <div className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.15em]">{log.action}</div>
                      <div className="text-slate-800 dark:text-slate-300 font-medium text-sm leading-relaxed max-w-2xl">{log.message}</div>
                    </div>
                  </td>
                  <td className="px-6 lg:px-10 py-6 lg:py-8 text-right align-top lg:align-middle">
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-700 bg-slate-100 dark:bg-white/[0.03] px-3 lg:px-4 py-2 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner whitespace-nowrap">
                      {log.userId}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-10 py-24 text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Ghost className="w-10 h-10 text-slate-300 dark:text-slate-600 transition-colors" />
                    </div>
                    <div className="text-[11px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.3em]">Belum Ada Aktivitas Terdeteksi</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 sm:px-10 py-4 sm:py-6 border-t border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.01] text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em] flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-4">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-800" />
            Menampilkan <span className="text-indigo-700 dark:text-indigo-400 mx-1">100</span> log terbaru
          </div>
          <div className="flex items-center gap-4">
            Database Logging: <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-500 font-black"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
