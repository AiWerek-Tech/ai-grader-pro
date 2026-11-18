import Link from "next/link";
import { getAdminDashboardStatsAction, getSystemLogsAction } from "@/lib/actions/admin";
import { getHasilAction } from "@/lib/actions/hasil";
import { getKunciListAction } from "@/lib/actions/kunci";
import { getSiswaAction } from "@/lib/actions/siswa";
import { getCurrentUser } from "@/lib/session-server";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_VERSION } from "@/lib/app-version";
import { 
  Scan, GraduationCap, Users, BookOpen, School, Activity, 
  Terminal, Stethoscope, Settings, FileText, Award,
  Key, Printer, ScanLine
} from 'lucide-react';

export default async function Dashboard() {
  const user = await getCurrentUser();
  const isGuru = user?.role === 'GURU';

  const [statsRes, logsRes, hasilRes, siswaRes, kunciRes] = await Promise.all([
    getAdminDashboardStatsAction(),
    isGuru ? Promise.resolve({ success: true, data: [] }) : getSystemLogsAction(5),
    isGuru ? getHasilAction(undefined, 'ALL') : Promise.resolve({ success: true, data: [] }),
    isGuru ? getSiswaAction() : Promise.resolve({ success: true, data: [] }),
    isGuru ? getKunciListAction(undefined, 'ALL') : Promise.resolve({ success: true, data: [] }),
  ]);

  const stats = statsRes.success && statsRes.data ? statsRes.data : { 
    counters: { totalGuru: 0, totalSiswa: 0, totalKelas: 0, totalMapel: 0, totalScan: 0 }, 
    jenjang: { smp: { kelas: 0, siswa: 0 }, sma: { kelas: 0, siswa: 0 } } 
  };
  const logs = logsRes.success && logsRes.data ? logsRes.data : [];

  const recentAssessments = (() => {
    if (!isGuru || !hasilRes.success || !Array.isArray(hasilRes.data)) return [];
    const siswaMap = new Map<string, any>(
      (siswaRes.success && Array.isArray(siswaRes.data) ? siswaRes.data : []).map((s: any) => [String(s.id_siswa), s])
    );
    const kunciMap = new Map<string, any>(
      (kunciRes.success && Array.isArray(kunciRes.data) ? kunciRes.data : []).map((k: any) => [String(k.id_kunci), k])
    );
    return hasilRes.data.slice(0, 5).map((h: any) => {
      const s = siswaMap.get(String(h.id_siswa));
      const k = kunciMap.get(String(h.id_kunci));
      return {
        id: h.id_hasil || `${h.id_kunci}-${h.id_siswa}`,
        siswaNama: s?.nama || h.id_siswa || 'Siswa',
        kelasNama: k?.nama_kelas || s?.nama_kelas || '',
        mapelNama: k?.nama_mapel || '',
        ujianJudul: k?.judul_ujian || h.id_kunci || 'Asesmen',
        skor: Number(h.skor ?? 0),
        isLulus: Boolean(h.is_lulus),
        timestamp: h.timestamp,
      };
    });
  })();

  const statsData = [
    { label: 'Terproses', val: stats.counters.totalScan, icon: <Scan className="w-6 h-6" />, color: 'indigo', desc: isGuru ? 'Scan LJK Saya' : 'Scan LJK Selesai', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/20' },
    { label: 'Peserta', val: stats.counters.totalSiswa, icon: <GraduationCap className="w-6 h-6" />, color: 'emerald', desc: isGuru ? 'Siswa Diajar' : 'Siswa Terdaftar', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20' },
    { label: isGuru ? 'Mapel' : 'Pelajaran', val: stats.counters.totalMapel, icon: <BookOpen className="w-6 h-6" />, color: 'sky', desc: isGuru ? 'Tugas Mapel' : 'Mata Pelajaran', bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-500/20' },
    { label: isGuru ? 'Kelas' : 'Rombel', val: stats.counters.totalKelas, icon: <School className="w-6 h-6" />, color: 'violet', desc: isGuru ? 'Unit Kelas Saya' : 'Unit Kelas', bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-500/20' },
  ];

  // Tambahkan statistik pengajar jika ADMIN
  if (!isGuru) {
    statsData.splice(2, 0, { label: 'Pengajar', val: stats.counters.totalGuru, icon: <Users className="w-6 h-6" />, color: 'amber', desc: 'Staff Guru Aktif', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20' });
  }

  const firstName = user?.nama?.trim()?.split(/\s+/)?.[0] || 'User';

  // Quick Access items based on role
  const quickAccessItems = isGuru ? [
    { label: 'Buat Kunci', icon: <Key className="w-6 h-6 sm:w-7 sm:h-7" />, href: '/dashboard/kunci', color: 'indigo', hover: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 text-indigo-500' },
    { label: 'Cetak LJK', icon: <Printer className="w-6 h-6 sm:w-7 sm:h-7" />, href: '/dashboard/ljk', color: 'amber', hover: 'hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/30 text-amber-500' },
    { label: 'Scan AI', icon: <ScanLine className="w-6 h-6 sm:w-7 sm:h-7" />, href: '/dashboard/analisis', color: 'emerald', hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 text-emerald-500' },
    { label: 'Hasil', icon: <Award className="w-6 h-6 sm:w-7 sm:h-7" />, href: '/dashboard/hasil', color: 'rose', hover: 'hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 text-rose-500' },
  ] : [
    { label: 'Doctor', icon: <Stethoscope className="w-7 h-7" />, href: '/dashboard/doctor', color: 'rose', hover: 'hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 text-rose-500' },
    { label: 'Settings', icon: <Settings className="w-7 h-7" />, href: '/dashboard/settings', color: 'emerald', hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 text-emerald-500' },
    { label: 'Audit', icon: <FileText className="w-7 h-7" />, href: '/dashboard/logs', color: 'indigo', hover: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 text-indigo-500' },
    { label: 'Reports', icon: <Award className="w-7 h-7" />, href: '/dashboard/hasil', color: 'amber', hover: 'hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/30 text-amber-500' },
  ];

  // Tailwind class harus statis agar JIT bisa menghasilkan CSS.
  const statsGlowToClass: Record<string, string> = {
    indigo: 'to-indigo-500',
    emerald: 'to-emerald-500',
    amber: 'to-amber-500',
    sky: 'to-sky-500',
    violet: 'to-violet-500',
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 space-y-6 sm:space-y-8 fade-in w-full max-w-[1600px] mx-auto z-0">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 sm:gap-6">
        <div className="relative">
          <div className="absolute -inset-4 bg-purple-500/10 dark:bg-purple-500/15 blur-[60px] rounded-full pointer-events-none transition-colors" />
          <h2 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-purple-900 to-cyan-700 dark:from-white dark:via-purple-200 dark:to-cyan-300 tracking-tighter relative z-10 transition-colors">
            Selamat Datang, {firstName} 👋
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1.5 sm:mt-2 font-medium text-xs sm:text-sm lg:text-base relative z-10 max-w-xl transition-colors">
            {isGuru 
              ? 'Kelola penilaian kelas Anda secara cerdas dengan teknologi AI Grader tercanggih.' 
              : 'Pusat monitoring kontrol terpadu. Pantau performa ujian dan aktivitas AI grader secara real-time.'}
          </p>
        </div>
        <div className="flex-shrink-0 relative z-10">
          <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-white dark:bg-[#09051f] border border-purple-200/70 dark:border-purple-500/20 rounded-2xl sm:rounded-[1rem] flex items-center gap-3 lg:backdrop-blur-xl shadow-lg shadow-purple-500/10 transition-colors">
             <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
               <BrandLogo variant="symbol" className="w-full h-full" />
             </div>
             <div className="flex flex-col">
               <span className="text-[9px] font-black tracking-[0.2em] uppercase text-emerald-600 dark:text-cyan-400 flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> System Live
               </span>
               <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 tracking-widest">WMVAA AI GRADER v{APP_VERSION}</span>
             </div>
          </div>
        </div>
      </div>
      
      {/* ── STAT CARDS ── */}
      <div className={`grid grid-cols-2 ${isGuru ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-3 sm:gap-6`}>
        {statsData.map((item, i) => (
          <div 
            key={i} 
            className="group relative bg-white dark:bg-[#0a0e1a]/80 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] hover:bg-slate-50 dark:hover:bg-[#0a0e1a] transition-all duration-300 shadow-sm dark:shadow-inner min-w-0"
          >
            {/* Hover Glow */}
            <div className={`absolute inset-0 rounded-2xl sm:rounded-[2rem] opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br from-transparent ${statsGlowToClass[item.color]} blur-xl pointer-events-none`} />
            
            <div className="flex items-start justify-between relative z-10 gap-2 mb-3 sm:mb-6">
              <div className={`p-2.5 sm:p-4 ${item.bg} ${item.border} border rounded-xl sm:rounded-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                <div className={`${item.text} drop-shadow-sm`}>{item.icon}</div>
              </div>
            </div>
            
            <div className="relative z-10 w-full">
              <div className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter truncate transition-colors pr-1 sm:pr-2">
                {item.val.toLocaleString('id-ID')}
              </div>
              <div className="flex items-center justify-between mt-1 sm:mt-2 min-w-0 w-full">
                <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                  {item.label}
                </span>
                <span className={`text-[8px] sm:text-[9px] font-black ${item.text} uppercase tracking-tight truncate ml-1 sm:ml-2 bg-black/5 dark:bg-white/5 px-1.5 sm:px-2 py-0.5 rounded-lg border border-black/5 dark:border-white/5 hidden sm:inline`}>
                  {item.desc}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── AKES CEPAT KHUSUS MOBILE (Langsung di atas tanpa perlu scroll ke bawah) ── */}
      <div className="lg:hidden bg-white dark:bg-[#0a0e1a]/75 border border-slate-200 dark:border-white/[0.05] p-4 rounded-2xl shadow-sm">
        <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.22em] mb-3 flex items-center gap-2">
          <span className="w-3 h-[1px] bg-slate-300 dark:bg-slate-700" />
          Akses Cepat
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {quickAccessItems.map((link, idx) => (
            <Link
              key={idx}
              href={link.href}
              className="flex flex-col items-center justify-center py-3 px-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] rounded-xl active:scale-95 transition-all min-w-0"
            >
              <div className={`mb-1.5 ${link.color}`}>{link.icon}</div>
              <div className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 tracking-tight truncate w-full text-center">
                {link.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
        
        {/* ── LEFT COLUMN (Distribusi & Logs/Riwayat Penilaian) ── */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-10 min-w-0">
          
          {/* Distribusi */}
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.25em] flex-shrink-0 transition-colors">
                {isGuru ? 'Distribusi Pengajaran' : 'Distribusi Satu Atap'}
              </h3>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-200 dark:from-white/[0.05] to-transparent transition-colors" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {[
              { unit: 'SMP', stats: stats.jenjang.smp, color: 'indigo', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500 relative after:absolute after:inset-0 after:bg-indigo-500 after:animate-ping after:opacity-50 after:rounded-full', glow: 'from-indigo-100/50 dark:from-indigo-900/40', hoverBorder: 'hover:border-indigo-300 dark:hover:border-indigo-500/20' },
              { unit: 'SMA', stats: stats.jenjang.sma, color: 'violet', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500 relative after:absolute after:inset-0 after:bg-violet-500 after:animate-ping after:opacity-50 after:rounded-full', glow: 'from-violet-100/50 dark:from-violet-900/40', hoverBorder: 'hover:border-violet-300 dark:hover:border-violet-500/20' }
              ].map((unit, i) => (
              <div key={i} className={`bg-gradient-to-br ${unit.glow} to-white dark:to-[#0a0e1a]/80 lg:backdrop-blur-md border border-slate-200 dark:border-white/[0.03] p-7 rounded-[2rem] relative overflow-hidden group ${unit.hoverBorder} transition-all shadow-sm dark:shadow-none min-w-0`}>
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    <div className={`text-[11px] font-black ${unit.text} uppercase tracking-[0.2em] mb-6 flex items-center gap-2.5 transition-colors`}>
                      <span className={`w-2 h-2 rounded-full ${unit.dot} shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_10px_currentColor]`} />
                      UNIT {unit.unit}
                    </div>
                    
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter truncate transition-colors">{unit.stats.kelas}</div>
                        <div className="text-[10px] font-extrabold text-slate-600 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors">Kelas</div>
                      </div>
                      <div className="min-w-0 flex-1 text-right">
                        <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter truncate transition-colors">{unit.stats.siswa}</div>
                        <div className="text-[10px] font-extrabold text-slate-600 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors">Siswa</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aktivitas Sistem (Admin) / Riwayat Penilaian Terbaru (Guru) */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.03] rounded-3xl sm:rounded-[2.5rem] overflow-hidden flex flex-col min-w-0 shadow-sm dark:shadow-none transition-colors">
            <div className="p-4 sm:p-8 border-b border-slate-100 dark:border-white/[0.03] flex items-center justify-between gap-3 bg-slate-50 dark:bg-white/[0.01] transition-colors">
              <h3 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 sm:gap-3 min-w-0 transition-colors">
                <span className="p-2 sm:p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm dark:shadow-inner flex-shrink-0 transition-colors">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                </span>
                <span className="truncate">{isGuru ? 'Riwayat Penilaian' : 'Aktivitas Sistem'}</span>
              </h3>
              <Link href={isGuru ? "/dashboard/hasil" : "/dashboard/logs"} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 uppercase tracking-wider transition-colors flex-shrink-0 flex items-center gap-1 bg-indigo-50 dark:bg-white/5 py-1.5 px-3 sm:py-2 sm:px-4 rounded-full hover:bg-indigo-100 dark:hover:bg-white/10">
                <span>Semua</span> <span aria-hidden="true">→</span>
              </Link>
            </div>
            
            <div className="p-3 sm:p-6 space-y-2 relative">
              {isGuru ? (
                recentAssessments.length > 0 ? recentAssessments.map((item) => (
                  <Link
                    key={item.id}
                    href="/dashboard/hasil"
                    className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/[0.03] group min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.siswaNama}
                        </span>
                        {item.kelasNama && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-[9px] font-black text-slate-500 dark:text-slate-400 shrink-0">
                            {item.kelasNama}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold truncate mt-0.5">
                        {item.mapelNama ? (
                          <>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{item.mapelNama}</span>
                            <span className="text-slate-400"> · {item.ujianJudul}</span>
                          </>
                        ) : (
                          item.ujianJudul
                        )}
                      </div>
                      {item.timestamp && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {new Date(item.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div className={`px-2.5 py-1 rounded-xl text-center shrink-0 border ${item.isLulus ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                      <div className="text-sm font-black tabular-nums leading-none">{item.skor}</div>
                      <div className="text-[8px] font-black uppercase mt-0.5">{item.isLulus ? 'Tuntas' : 'Remedial'}</div>
                    </div>
                  </Link>
                )) : (
                  <div className="py-12 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-3">
                      <Award className="w-6 h-6" />
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Belum ada LJK yang dinilai.</div>
                  </div>
                )
              ) : (
                logs.length > 0 ? logs.map((log: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 p-3.5 sm:p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/[0.03] group min-w-0">
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        log.level === 'ERROR' ? 'bg-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]' : 
                        log.level === 'WARN' ? 'bg-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'bg-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      }`} />
                      <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em] w-24 truncate transition-colors">{log.action}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0 ml-5 sm:ml-0">
                      <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-300 group-hover:text-indigo-950 dark:group-hover:text-white transition-colors truncate">{log.message}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-500 font-medium mt-1 truncate transition-colors">{new Date(log.timestamp).toLocaleString('id-ID')} · {log.userId}</div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-3 transition-colors">
                       <Terminal className="w-6 h-6" />
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.25em] transition-colors">Belum ada aktivitas terekam.</div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (Enterprise Banner & Quick Access) ── */}
        <div className="space-y-6 sm:space-y-8 flex flex-col min-w-0">
          
          {/* Banner */}
          <div className="bg-gradient-to-br from-purple-700 via-indigo-700 to-cyan-700 dark:from-[#1f0e4f] dark:via-[#14174c] dark:to-[#083358] border border-purple-500/30 p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] relative overflow-hidden shadow-[0_20px_40px_-15px_rgba(124,58,237,0.4)] flex-shrink-0 group transition-colors">
            {/* Decorators */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/20 blur-[60px] rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-400/25 blur-[40px] rounded-full -ml-10 -mb-10" />
            <div className="absolute -bottom-6 -right-6 w-44 h-44 opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all pointer-events-none">
              <BrandLogo variant="symbol" className="w-full h-full" />
            </div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 lg:backdrop-blur-md rounded-full border border-white/25 mb-4 sm:mb-6 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                <span className="text-[9px] font-black text-white tracking-[0.2em] uppercase drop-shadow-sm">{isGuru ? 'Teacher Panel' : `Enterprise v${APP_VERSION}`}</span>
              </div>
              <h3 className="text-xl sm:text-3xl font-black text-white leading-tight tracking-tighter mb-2 drop-shadow-md">
                {isGuru ? 'Teacher' : 'WMVAA AI'}<br className="hidden sm:block"/> Grader Pro
              </h3>
              <p className="text-[10px] sm:text-[11px] text-cyan-100/90 font-semibold uppercase tracking-widest mt-2 sm:mt-4 drop-shadow-sm">
                Sistem Penilaian LJK Masa Depan.
              </p>
              
              <div className="mt-6 sm:mt-8 space-y-2.5 sm:space-y-3.5">
                {[
                  'Gemini AI Vision Engine',
                  'Hybrid OMR + QR Anchor v2.0',
                  'Zero-Template Dynamic Scan'
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 sm:gap-3 opacity-95 hover:opacity-100 transition-opacity">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-cyan-400/25 lg:backdrop-blur-md flex items-center justify-center text-[9px] sm:text-[10px] text-cyan-200 flex-shrink-0 shadow-sm border border-cyan-300/30">✓</div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-white uppercase tracking-wider truncate drop-shadow-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Access (Desktop Only — di Mobile sudah ditampilkan tepat di bawah Stat Cards) */}
          <div className="hidden lg:flex bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.03] p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex-1 flex-col min-w-0 shadow-sm dark:shadow-none transition-colors">
            <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.25em] mb-4 sm:mb-6 flex items-center gap-3 transition-colors">
              <span className="w-4 h-[1px] bg-slate-300 dark:bg-slate-700 transition-colors" />
              Akses Cepat
            </h4>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 flex-1">
              {quickAccessItems.map((link, idx) => (
                <Link key={idx} href={link.href} className={`flex flex-col items-center justify-center p-3.5 sm:p-6 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] rounded-2xl sm:rounded-3xl group transition-all duration-300 min-w-0 active:scale-95 ${link.hover}`}>
                  <div className={`mb-2 sm:mb-4 group-hover:-translate-y-1 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm ${link.color}`}>
                    {link.icon}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-extrabold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-widest truncate w-full text-center transition-colors">
                    {link.label}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
