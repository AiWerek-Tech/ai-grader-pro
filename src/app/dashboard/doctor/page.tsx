'use client';

import { runSystemDoctorAction, healSystemAction } from '@/lib/actions/doctor';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Stethoscope, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Activity, Zap } from 'lucide-react';

export default function DoctorPage() {
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [healing, setHealing] = useState(false);
  const [showHealConfirm, setShowHealConfirm] = useState(false);
  const [error, setError] = useState('');

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await runSystemDoctorAction();
      if (res.success) {
        setDiagnostics(res.data || []);
      } else {
        setError(res.message || 'Gagal memuat diagnosa');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleHeal = () => {
    setShowHealConfirm(true);
  };

  const executeHeal = async () => {
    setHealing(true);
    try {
      const res = await healSystemAction();
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
      setShowHealConfirm(false);
      fetchDiagnostics();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setHealing(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === 'HEALTHY') return <CheckCircle2 className="w-8 h-8 text-emerald-500" />;
    if (s === 'WARNING') return <AlertTriangle className="w-8 h-8 text-amber-500" />;
    return <XCircle className="w-8 h-8 text-rose-500" />;
  };

  const statusColor = (s: string) => {
    if (s === 'HEALTHY') return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
    if (s === 'WARNING') return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
    return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';
  };

  const healthyCount = diagnostics.filter(d => d.status === 'HEALTHY').length;
  const totalCount = diagnostics.length;

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full" />
        <Activity className="w-16 h-16 text-rose-500 animate-pulse relative z-10" />
      </div>
      <div>
        <div className="text-slate-900 dark:text-slate-400 font-black text-lg tracking-tight">Menghubungkan ke Ruang Server</div>
        <div className="text-slate-500 text-xs font-bold mt-1">Mengumpulkan matrix kesehatan sistem...</div>
      </div>
    </div>
  );

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-10 fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-4">
            <span className="p-3 bg-rose-500/10 dark:bg-rose-500/20 rounded-[1.5rem] shadow-inner border border-rose-500/10 dark:border-rose-500/20">
              <Stethoscope className="w-7 h-7 text-rose-500" />
            </span>
            System Doctor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 font-semibold text-sm max-w-xl">Deteksi anomali pada arsitektur database, cari *orphan data*, perbaiki relasi kelas, dan jalankan pemulihan otomatis.</p>
        </div>
        <button 
          onClick={handleHeal}
          disabled={healing}
          className="w-full md:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-95"
        >
          {healing ? <Activity className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {healing ? 'Pembedahan Aktif...' : 'Jalankan Bedah Laser (Auto-Heal)'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-500 p-5 rounded-2xl font-bold flex items-center gap-4 shadow-sm">
          <ShieldAlert className="w-6 h-6 text-rose-500" /> {error}
        </div>
      )}

      {/* Ringkasan Kesehatan */}
      <div className="bg-white dark:bg-[#0a0e1a]/90 lg:dark:bg-[#0a0e1a]/80 lg:backdrop-blur-2xl border border-slate-200 dark:border-white/[0.05] rounded-3xl sm:rounded-[3rem] p-6 sm:p-10 lg:p-12 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 lg:gap-12 relative overflow-hidden shadow-sm dark:shadow-2xl transition-colors">
        <div className={`hidden lg:block absolute top-0 right-0 w-64 h-64 ${healthyCount === totalCount ? 'bg-emerald-500/10' : 'bg-amber-500/10'} blur-[100px] rounded-full -mr-32 -mt-32`} />
        
        <div className={`w-32 h-32 rounded-[2.5rem] flex-shrink-0 flex items-center justify-center shadow-inner relative z-10 ${healthyCount === totalCount ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-500' : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-500'}`}>
          {healthyCount === totalCount ? <CheckCircle2 className="w-16 h-16" /> : <ShieldAlert className="w-16 h-16" />}
        </div>
        <div className="flex-1 relative z-10 text-center sm:text-left">
          <div className="text-3xl font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">STATUS SERVER</div>
          <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
            {healthyCount}/{totalCount} Modul Inti Sehat
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-4 font-medium leading-relaxed max-w-2xl bg-slate-50 dark:bg-white/[0.03] p-4 rounded-xl border border-slate-200 dark:border-white/5">
            {healthyCount === totalCount
              ? 'Seluruh relasi database bekerja sangat sempurna. Tidak ada orphan data, skema kolom konsisten, dan latensi aman.'
              : 'Terdeteksi kerusakan mikro atau data mengambang (orphan) pada spreadsheet operasional. Fungsi aplikasi mungkin sedikit terpengaruh.'}
          </p>
        </div>
      </div>

      {/* Kartu Diagnostik */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {diagnostics.map((d, i) => (
          <div key={i} className="bg-white dark:bg-[#0a0e1a]/90 lg:dark:bg-[#0a0e1a]/60 lg:backdrop-blur-md border border-slate-200 dark:border-white/[0.05] rounded-[2rem] p-6 sm:p-8 hover:bg-slate-50 dark:hover:bg-[#0d1326] transition-all group relative overflow-hidden shadow-sm dark:shadow-none min-h-[180px] sm:min-h-[200px] flex flex-col justify-between">
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="group-hover:scale-110 transition-transform">{statusIcon(d.status)}</div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white tracking-tight text-lg line-clamp-1 truncate">{d.name}</h3>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-[0.2em] ${statusColor(d.status)}`}>
                    {d.status}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed relative z-10 flex-1">{d.message}</p>
            {d.details && (
              <div className="mt-6 p-4 bg-slate-50 dark:bg-black/50 rounded-2xl text-[9px] font-mono font-bold text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-white/[0.03] break-all relative z-10 shadow-inner max-h-[100px] overflow-y-auto custom-scrollbar">
                {JSON.stringify(d.details, null, 2)}
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={showHealConfirm}
        title="Jalankan Auto-Heal Database?"
        description="Sistem akan memeriksa dan memulihkan struktur sheet Google Spreadsheet yang tidak sinkron secara otomatis."
        confirmText="Ya, Jalankan Auto-Heal"
        variant="warning"
        loading={healing}
        onConfirm={executeHeal}
        onCancel={() => setShowHealConfirm(false)}
      />
    </div>
  );
}
