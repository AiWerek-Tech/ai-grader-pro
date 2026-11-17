import Link from "next/link";
import { getAdminDashboardStatsAction, getSystemLogsAction } from "@/lib/actions/admin";
import { getCurrentUser } from "@/lib/session-server";
import { BrandLogo } from "@/components/BrandLogo";
import { 
  Scan, GraduationCap, Users, BookOpen, School, Activity, 
  ShieldCheck, Terminal, Stethoscope, Settings, FileText, Award,
  Key, Printer, ScanLine, Smartphone, Download, ExternalLink, Info, CheckCircle2, Globe
} from 'lucide-react';

export default async function Dashboard() {
  const [statsRes, logsRes, user] = await Promise.all([
    getAdminDashboardStatsAction(),
    getSystemLogsAction(5),
    getCurrentUser()
  ]);

  const stats = statsRes.success && statsRes.data ? statsRes.data : { 
    counters: { totalGuru: 0, totalSiswa: 0, totalKelas: 0, totalMapel: 0, totalScan: 0 }, 
    jenjang: { smp: { kelas: 0, siswa: 0 }, sma: { kelas: 0, siswa: 0 } } 
  };
  const logs = logsRes.success && logsRes.data ? logsRes.data : [];

  const isGuru = user?.role === 'GURU';

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

  const androidApkDownloadUrl =
    'https://github.com/AiWerek-Tech/ai-grader-pro-mobile/releases/download/v2.0.5/wmvaa-ai-grader-pro-v2.0.5-android.apk';
  const androidReleasePageUrl =
    'https://github.com/AiWerek-Tech/ai-grader-pro-mobile/releases/tag/v2.0.5';
  const webRepoUrl = 'https://github.com/AiWerek-Tech/ai-grader-pro';

  const importantInfos = isGuru
    ? [
        {
          title: 'Alur Koreksi LJK Terpadu',
          desc: 'Siapkan kunci di menu Kunci Jawaban, cetak lembar LJK ber-QR di menu LJK, pindai melalui Scan LJK, lalu tinjau & ekspor Excel di menu Hasil.',
        },
        {
          title: 'Keamanan Draft Scan Otomatis',
          desc: 'Antrean foto hasil scan yang belum disimpan otomatis dicadangkan di perangkat. Pastikan klik Simpan ke Database sebelum keluar atau berganti perangkat.',
        },
        {
          title: 'Koneksi Cepat Aplikasi HP Guru',
          desc: 'Buka aplikasi Android WMVAA AI Grader Pro (otomatis terhubung ke https://app.wmvaa.id/ai-grader) atau ketuk QR Akses HP Guru di pojok kanan atas.',
        },
      ]
    : [
        {
          title: 'Pemantauan Integritas Spreadsheet',
          desc: 'Gunakan menu System Doctor secara berkala untuk memastikan struktur sheet Google Spreadsheet tetap sinkron dan melakukan self-healing bila perlu.',
        },
        {
          title: 'Kapasitas & Multi-Key Gemini AI',
          desc: 'Atur pool multi API Key Gemini dan model AI aktif di menu Pengaturan Sistem agar pemindaian serentak oleh banyak guru tetap lancar tanpa rate-limit.',
        },
        {
          title: 'Keamanan Onboarding Produksi',
          desc: 'Pastikan mode setup runtime tertutup setelah inisialisasi awal dan distribusikan aplikasi Android resmi kepada guru melalui tautan unduhan di samping.',
        },
      ];

  // Quick Access items based on role
  const quickAccessItems = isGuru ? [
    { label: 'Buat LJK', icon: <Key className="w-7 h-7" />, href: '/dashboard/kunci', color: 'indigo', hover: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 text-indigo-500' },
    { label: 'Cetak LJK', icon: <Printer className="w-7 h-7" />, href: '/dashboard/ljk', color: 'amber', hover: 'hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/30 text-amber-500' },
    { label: 'Scan AI', icon: <ScanLine className="w-7 h-7" />, href: '/dashboard/analisis', color: 'emerald', hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 text-emerald-500' },
    { label: 'Hasil', icon: <Award className="w-7 h-7" />, href: '/dashboard/hasil', color: 'rose', hover: 'hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 text-rose-500' },
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
          <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-white dark:bg-[#09051f] border border-purple-200/70 dark:border-purple-500/20 rounded-2xl sm:rounded-[1rem] flex items-center gap-3 backdrop-blur-xl shadow-lg shadow-purple-500/10 transition-colors">
             <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
               <BrandLogo variant="symbol" className="w-full h-full" />
             </div>
             <div className="flex flex-col">
               <span className="text-[9px] font-black tracking-[0.2em] uppercase text-emerald-600 dark:text-cyan-400 flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> System Live
               </span>
               <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 tracking-widest">WMVAA AI GRADER v2.0</span>
             </div>
          </div>
        </div>
      </div>
      
      {/* ── STAT CARDS ── */}
      <div className={`grid grid-cols-2 ${isGuru ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-3 sm:gap-6`}>
        {statsData.map((item, i) => (
          <div 
            key={i} 
            className="group relative bg-white dark:bg-[#0a0e1a]/80 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] hover:bg-slate-50 dark:hover:bg-[#0a0e1a] transition-all duration-300 shadow-sm dark:shadow-inner min-w-0"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
        
        {/* ── LEFT COLUMN (Distribusi & Logs) ── */}
        <div className="lg:col-span-2 space-y-8 sm:space-y-10 min-w-0">
          
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
              <div key={i} className={`bg-gradient-to-br ${unit.glow} to-white dark:to-[#0a0e1a]/80 backdrop-blur-md border border-slate-200 dark:border-white/[0.03] p-7 rounded-[2rem] relative overflow-hidden group ${unit.hoverBorder} transition-all shadow-sm dark:shadow-none min-w-0`}>
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

          {/* Aktivitas Sistem */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.03] rounded-[2.5rem] overflow-hidden flex flex-col min-w-0 shadow-sm dark:shadow-none transition-colors">
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-white/[0.01] transition-colors">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3 transition-colors">
                <span className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm dark:shadow-inner flex-shrink-0 transition-colors">
                  <Activity className="w-5 h-5" />
                </span>
                {isGuru ? 'Riwayat Penilaian' : 'Aktivitas Sistem'}
              </h3>
              <Link href={isGuru ? "/dashboard/hasil" : "/dashboard/logs"} className="text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-widest transition-colors flex-shrink-0 flex items-center gap-2 bg-slate-100 dark:bg-white/5 py-2 px-4 rounded-full hover:bg-slate-200 dark:hover:bg-white/10">
                Lihat Selengkapnya <span className="opacity-70">→</span>
              </Link>
            </div>
            
            <div className="p-4 sm:p-6 space-y-2 relative">
              {logs.length > 0 ? logs.map((log: any, i: number) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors border border-transparent hover:border-slate-100 dark:hover:border-white/[0.03] group min-w-0">
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      log.level === 'ERROR' ? 'bg-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]' : 
                      log.level === 'WARN' ? 'bg-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'bg-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    }`} />
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em] w-20 truncate transition-colors">{log.action}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0 ml-5 sm:ml-0">
                    <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-300 group-hover:text-indigo-950 dark:group-hover:text-white transition-colors truncate">{log.message}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-500 font-medium mt-1 truncate transition-colors">{new Date(log.timestamp).toLocaleString('id-ID')} · {log.userId}</div>
                  </div>
                </div>
              )) : (
                <div className="py-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4 transition-colors">
                     <Terminal className="w-8 h-8" />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.25em] transition-colors">Belum ada aktivitas terekam.</div>
                </div>
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
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full border border-white/25 mb-4 sm:mb-6 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                <span className="text-[9px] font-black text-white tracking-[0.2em] uppercase drop-shadow-sm">{isGuru ? 'Teacher Panel' : 'Enterprise v2.0'}</span>
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
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-cyan-400/25 backdrop-blur-md flex items-center justify-center text-[9px] sm:text-[10px] text-cyan-200 flex-shrink-0 shadow-sm border border-cyan-300/30">✓</div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-white uppercase tracking-wider truncate drop-shadow-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.03] p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex-1 flex flex-col min-w-0 shadow-sm dark:shadow-none transition-colors">
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

      {/* ── INFORMASI PENTING & DOWNLOAD APLIKASI ANDROID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
        
        {/* Card Download APK Android */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-50 via-white to-cyan-50/70 dark:from-emerald-950/35 dark:via-[#0a0e1a] dark:to-cyan-950/30 border border-emerald-200/80 dark:border-emerald-500/20 p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between gap-6 shadow-sm dark:shadow-none min-w-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Aplikasi Android</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                v2.0.5 · APK
              </span>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Download WMVAA Grader Mobile
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Gunakan aplikasi Android resmi untuk pemindaian LJK 1-klik dengan kamera HP, multi-upload galeri, scan QR server, cetak A4, dan ekspor laporan langsung ke folder Downloads.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Default terhubung ke <span className="font-mono text-emerald-700 dark:text-cyan-400">app.wmvaa.id/ai-grader</span></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Mendukung Android 7.0+ (API 24) &amp; Mode Layar Tetap Menyala</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <a
              href={androidApkDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download APK v2.0.5 (7.96 MB)</span>
            </a>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-bold">
              <a
                href={androidReleasePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-cyan-400 hover:underline"
              >
                <span>Catatan Rilis GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                Aktifkan &ldquo;Sumber Tidak Dikenal&rdquo; saat install
              </span>
            </div>
          </div>
        </div>

        {/* Card Info Penting & Tautan Resmi */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0a0e1a]/75 border border-slate-200 dark:border-white/[0.05] p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] flex flex-col justify-between gap-5 shadow-sm dark:shadow-none min-w-0">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-cyan-400 border border-purple-500/20">
                  <Info className="w-4 h-4" />
                </span>
                <span>Informasi Penting &amp; Panduan Cepat</span>
              </h3>
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-cyan-400">
                {isGuru ? 'Panduan Guru' : 'Panduan Admin'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {importantInfos.map((info, idx) => (
                <div
                  key={idx}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] flex items-start gap-3"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {info.title}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {info.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://app.wmvaa.id/ai-grader"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-700 dark:text-cyan-300 border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>app.wmvaa.id/ai-grader</span>
              </a>
              <a
                href="https://wmvaa.id"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Portal wmvaa.id</span>
              </a>
            </div>
            <a
              href={webRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-cyan-400 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dokumentasi &amp; Rilis Web v2.0.5</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
