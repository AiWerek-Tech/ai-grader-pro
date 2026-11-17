/**
 * Siswa Analytics Dashboard Component
 * Visual analytics and insights for student data
 */

import { useMemo } from 'react';
import { 
  Users, 
  GraduationCap, 
  School, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  BarChart3
} from 'lucide-react';

interface SiswaAnalyticsProps {
  siswa: any[];
  kelas: any[];
}

export default function SiswaAnalytics({ siswa, kelas }: SiswaAnalyticsProps) {
  const analytics = useMemo(() => {
    const totalSiswa = siswa.length;
    
    // By Jenjang
    const byJenjang = {
      SMP: siswa.filter(s => {
        const k = kelas.find(kelas => kelas.id_kelas === s.id_kelas);
        return k?.jenjang === 'SMP';
      }).length,
      SMA: siswa.filter(s => {
        const k = kelas.find(kelas => kelas.id_kelas === s.id_kelas);
        return k?.jenjang === 'SMA';
      }).length
    };

    // By Kelas (top 5)
    const byKelas = kelas.map(k => ({
      nama_kelas: k.nama_kelas,
      jenjang: k.jenjang,
      count: siswa.filter(s => s.id_kelas === k.id_kelas).length
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    // Recent additions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAdditions = siswa.filter(s => {
      const createdDate = s.created_at ? new Date(s.created_at) : null;
      return createdDate && createdDate >= thirtyDaysAgo;
    }).length;

    // Calculate percentages
    const smpPercentage = totalSiswa > 0 ? Math.round((byJenjang.SMP / totalSiswa) * 100) : 0;
    const smaPercentage = totalSiswa > 0 ? Math.round((byJenjang.SMA / totalSiswa) * 100) : 0;

    // Check for potential issues
    const issues = [];
    if (totalSiswa === 0) {
      issues.push('Belum ada data siswa');
    }
    if (byJenjang.SMP === 0 && byJenjang.SMA > 0) {
      issues.push('Tidak ada data SMP');
    }
    if (byJenjang.SMA === 0 && byJenjang.SMP > 0) {
      issues.push('Tidak ada data SMA');
    }

    return {
      totalSiswa,
      byJenjang,
      byKelas,
      recentAdditions,
      smpPercentage,
      smaPercentage,
      issues
    };
  }, [siswa, kelas]);

  return (
    <div className="space-y-6">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Students */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-200 dark:border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 blur-[40px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Total Siswa
              </span>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              {analytics.totalSiswa.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {analytics.recentAdditions} siswa baru bulan ini
            </div>
          </div>
        </div>

        {/* SMP Stats */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-200 dark:border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 blur-[40px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Unit SMP
              </span>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              {analytics.byJenjang.SMP.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {analytics.smpPercentage}% dari total siswa
            </div>
          </div>
        </div>

        {/* SMA Stats */}
        <div className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-200 dark:border-violet-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 blur-[40px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                <School className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                Unit SMA
              </span>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              {analytics.byJenjang.SMA.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {analytics.smaPercentage}% dari total siswa
            </div>
          </div>
        </div>

        {/* Class Count */}
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 blur-[40px] rounded-full" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                Total Kelas
              </span>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              {kelas.length.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {analytics.byKelas.filter(k => k.count > 0).length} kelas aktif
            </div>
          </div>
        </div>
      </div>

      {/* Top Classes & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 Kelas by Student Count */}
        <div className="bg-white dark:bg-[#0a0e1a]/40 border border-slate-200 dark:border-white/[0.03] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                Top 5 Kelas
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Berdasarkan jumlah siswa
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {analytics.byKelas.map((kelas, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-100 dark:bg-white/5 rounded-lg flex items-center justify-center text-xs font-black text-slate-500 dark:text-slate-400">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      [{kelas.jenjang}] {kelas.nama_kelas}
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {kelas.count} siswa
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ 
                        width: `${analytics.totalSiswa > 0 ? (kelas.count / analytics.totalSiswa) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {analytics.byKelas.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                Belum ada data kelas
              </div>
            )}
          </div>
        </div>

        {/* System Alerts & Insights */}
        <div className="bg-white dark:bg-[#0a0e1a]/40 border border-slate-200 dark:border-white/[0.03] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                Insight & Alerts
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Informasi penting sistem
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {analytics.issues.length > 0 ? (
              analytics.issues.map((issue, index) => (
                <div key={index} className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-200">{issue}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Sistem Berjalan Optimal
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    Semua data siswa dan kelas dalam kondisi baik
                  </p>
                </div>
              </div>
            )}

            {/* Recent Activity Summary */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/[0.03]">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                Aktivitas 30 Hari Terakhir
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-slate-50 dark:bg-white/[0.03] rounded-xl">
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {analytics.recentAdditions}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Siswa Baru
                  </div>
                </div>
                <div className="text-center p-4 bg-slate-50 dark:bg-white/[0.03] rounded-xl">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {kelas.length}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Total Kelas
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
