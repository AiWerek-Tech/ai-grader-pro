import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_VERSION, ANDROID_APK_RELEASE, WEB_REPO_URL } from "@/lib/app-version";
import {
  ArrowRight,
  BrainCircuit,
  Activity,
  Sparkles,
  Smartphone,
  Download,
  ExternalLink,
  CheckCircle2,
  Globe,
  ShieldCheck,
  KeyRound,
  Printer,
  ScanLine,
  FileSpreadsheet,
  Users,
  Layers,
  Info,
  Zap,
} from "lucide-react";

const WEB_APP_VERSION = APP_VERSION;
const ANDROID_APK_DOWNLOAD_URL = ANDROID_APK_RELEASE.downloadUrl;
const ANDROID_RELEASE_PAGE_URL = ANDROID_APK_RELEASE.releaseUrl;

const CORE_FEATURES = [
  {
    icon: <KeyRound className="w-6 h-6" />,
    title: "Smart Kunci Jawaban",
    desc: "Dukung PG-4/5, Benar/Salah, PG Kompleks, & Esai. Input instan via Bulk Paste atau ekstraksi AI otomatis.",
    tag: "Multi-Tipe Soal",
    bgClass: "bg-purple-500",
    textClass: "text-purple-600 dark:text-purple-400",
    borderHover: "hover:border-purple-300 dark:hover:border-purple-500/35",
  },
  {
    icon: <Printer className="w-6 h-6" />,
    title: "Cetak LJK Dinamis QR",
    desc: "Generate LJK siap cetak A4/Folio ber-QR identitas siswa & mapel. Tersedia format ringkas atau lampiran esai.",
    tag: "Opsi A / B / A+B",
    bgClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
    borderHover: "hover:border-amber-300 dark:hover:border-amber-500/35",
  },
  {
    icon: <BrainCircuit className="w-6 h-6" />,
    title: "Dual-Engine AI + OMR",
    desc: "Konsensus Gemini AI Vision & Hybrid OMR dengan Multi-Key Pool anti rate-limit saat ujian serentak.",
    tag: "Akurasi Tinggi",
    bgClass: "bg-cyan-500",
    textClass: "text-cyan-600 dark:text-cyan-400",
    borderHover: "hover:border-cyan-300 dark:hover:border-cyan-500/35",
  },
  {
    icon: <ScanLine className="w-6 h-6" />,
    title: "Scan Massal & Koreksi Cepat",
    desc: "Pindai kamera HP atau multi-upload galeri, cocokkan NIS otomatis, dan koreksi nilai cukup 1-ketuk.",
    tag: "Auto-Draft Lokal",
    bgClass: "bg-indigo-500",
    textClass: "text-indigo-600 dark:text-indigo-400",
    borderHover: "hover:border-indigo-300 dark:hover:border-indigo-500/35",
  },
  {
    icon: <FileSpreadsheet className="w-6 h-6" />,
    title: "Analitik & Ekspor Excel",
    desc: "Sinkronisasi real-time ke Google Sheets lengkap dengan diagnostik butir soal dan ekspor laporan .xlsx.",
    tag: "Real-Time Sync",
    bgClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderHover: "hover:border-emerald-300 dark:hover:border-emerald-500/35",
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: "RBAC & System Doctor",
    desc: "Kelola Guru, Kelas, Mapel, Siswa, Audit Log, serta pemulihan struktur sheet otomatis (self-healing).",
    tag: "Enterprise Control",
    bgClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
    borderHover: "hover:border-rose-300 dark:hover:border-rose-500/35",
  },
];

const WORKFLOW_STEPS = [
  { step: "01", title: "Buat Kunci", desc: "Atur kunci & bobot PG/Esai" },
  { step: "02", title: "Cetak LJK QR", desc: "Cetak A4/Folio beridentitas QR" },
  { step: "03", title: "Scan via HP/Web", desc: "Foto LJK dengan AI + Hybrid OMR" },
  { step: "04", title: "Analisis & Ekspor", desc: "Cek statistik & unduh Excel" },
];

const ANDROID_HIGHLIGHTS = [
  "Kamera scan 1-klik, multi-upload galeri & dokumen",
  "Scan QR akses LAN dilengkapi tombol lampu senter (flash)",
  "Ekspor .xlsx/.csv/.pdf langsung Buka & Bagikan",
  "Dukungan penuh Android 7.0–14+ (rilis ringan 3.26 MB)",
  "Cek pembaruan otomatis & buka langsung dari tautan web",
  "Pemulihan offline informatif & akses draft cache lokal",
];

const IMPORTANT_INFOS = [
  {
    title: "Akses Cloud & Mode LAN Sekolah",
    desc: "Aplikasi Android terhubung ke https://app.wmvaa.id/ai-grader dan mendukung koneksi server lokal via QR Akses HP Guru.",
  },
  {
    title: "Alternatif Tanpa Install (PWA / iOS)",
    desc: "Pengguna Chrome/Safari HP dapat membuka portal web ini lalu memilih \"Tambahkan ke Layar Utama\" untuk tampilan penuh.",
  },
  {
    title: "Cadangan Draf & Sinkronisasi Aman",
    desc: "Antrean hasil scan otomatis dicadangkan lokal di perangkat. Pastikan menekan Simpan ke Database setelah verifikasi.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050314] text-slate-800 dark:text-slate-200 transition-colors duration-300 relative overflow-x-hidden">
      {/* Brand Ambient Orbs */}
      <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[6%] left-[18%] w-[520px] h-[520px] rounded-full -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(147,51,234,0.18),transparent_70%)]" />
        <div className="absolute top-[45%] right-[6%] w-[460px] h-[460px] rounded-full translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(6,182,212,0.14),transparent_70%)]" />
        <div className="absolute bottom-[8%] left-[25%] w-[420px] h-[420px] rounded-full -translate-x-1/2 translate-y-1/2 bg-[radial-gradient(circle,rgba(16,185,129,0.12),transparent_70%)]" />
      </div>

      <div className="max-w-[1220px] mx-auto px-4 sm:px-6 pb-16 relative z-10 w-full">
        {/* Navbar */}
        <nav className="py-5 sm:py-7 flex justify-between items-center relative z-20 gap-3">
          <div className="flex items-center group min-w-0 shrink-0">
            <BrandLogo
              variant="horizontal"
              priority
              className="h-12 sm:h-14 md:h-16 w-auto max-w-[170px] sm:max-w-none group-hover:scale-[1.02] transition-transform duration-300 drop-shadow-sm"
            />
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            <a href="#fitur" className="hover:text-purple-600 dark:hover:text-cyan-400 transition-colors">
              Fitur
            </a>
            <a href="#alur-kerja" className="hover:text-purple-600 dark:hover:text-cyan-400 transition-colors">
              Alur Kerja
            </a>
            <a href="#android-app" className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android APK</span>
            </a>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-4 sm:px-6 py-2.5 rounded-full font-black text-[11px] sm:text-xs uppercase tracking-widest bg-white/90 dark:bg-white/[0.06] border border-purple-200/80 dark:border-purple-500/25 text-slate-800 dark:text-slate-200 hover:border-cyan-400 dark:hover:border-cyan-400/50 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              Login Portal
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="mt-10 sm:mt-16 text-center flex flex-col items-center animate-[fadeIn_0.6s_ease-out_forwards] relative z-10">
          <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full border border-purple-200 dark:border-purple-500/30 bg-purple-50/90 dark:bg-purple-500/10 backdrop-blur-md text-purple-700 dark:text-cyan-300 font-extrabold text-[10px] uppercase tracking-[0.18em] mb-6 transition-colors shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-cyan-400 shrink-0" />
            <span>WMVAA AI Ecosystem • Web App v{WEB_APP_VERSION}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-[4.5rem] font-black text-slate-900 dark:text-white leading-[1.08] tracking-tighter mb-5 max-w-4xl transition-colors drop-shadow-sm">
            Koreksi Ujian LJK <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 dark:from-purple-400 dark:via-blue-400 dark:to-cyan-300">
              Cepat, Cerdas &amp; Tanpa Scanner
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8 font-medium transition-colors px-2">
            Platform penilaian LJK berbasis <strong className="text-slate-800 dark:text-slate-200">Gemini AI Vision &amp; Hybrid OMR</strong>. Cukup foto pakai HP Android atau web, nilai langsung teranalisis dan tersinkron ke Google Sheets.
          </p>

          <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 justify-center w-full sm:w-auto px-2">
            <Link
              href="/login"
              className="group px-8 sm:px-9 py-4 sm:py-4.5 rounded-2xl sm:rounded-[1.4rem] font-black text-xs sm:text-sm uppercase tracking-widest bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 text-white shadow-xl shadow-purple-500/25 transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-3"
            >
              <span>Mulai Penilaian</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href="#android-app"
              className="group px-7 sm:px-8 py-4 sm:py-4.5 rounded-2xl sm:rounded-[1.4rem] font-black text-xs sm:text-sm uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300 transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2.5"
            >
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Download APK Android</span>
            </a>
          </div>

          {/* Highlight Metrics Strip */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {[
              { icon: <Zap className="w-3.5 h-3.5 text-amber-500" />, text: "Dual AI + Hybrid OMR" },
              { icon: <Layers className="w-3.5 h-3.5 text-purple-500" />, text: "PG, B/S, Kompleks & Esai" },
              { icon: <Activity className="w-3.5 h-3.5 text-cyan-500" />, text: "Real-Time Google Sheets" },
              { icon: <Users className="w-3.5 h-3.5 text-emerald-500" />, text: "Aplikasi Android & Web" },
            ].map((badge, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-sm dark:shadow-none"
              >
                {badge.icon}
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Grid (6 Cards - Lengkap, Padat, Jelas) */}
        <section id="fitur" className="mt-20 sm:mt-24 scroll-mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-600 dark:text-cyan-400">
                Fitur Lengkap Ekosistem
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                Semua Kebutuhan Penilaian dalam Satu Platform
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold max-w-sm">
              Dirancang khusus agar guru langsung mahir tanpa perlu perangkat scanner mahal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {CORE_FEATURES.map((f, i) => (
              <div
                key={i}
                className={`group bg-white/85 dark:bg-[#09051f]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.06] ${f.borderHover} p-6 sm:p-7 rounded-3xl hover:-translate-y-1 hover:bg-white dark:hover:bg-[#0e0a2a] transition-all duration-300 shadow-lg shadow-purple-500/5 dark:shadow-none min-w-0 flex flex-col justify-between gap-4`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 relative overflow-hidden group-hover:scale-105 transition-transform">
                      <div className={`absolute inset-0 opacity-15 ${f.bgClass}`} />
                      <div className={`relative z-10 ${f.textClass}`}>{f.icon}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alur Kerja 4 Langkah */}
        <section id="alur-kerja" className="mt-16 sm:mt-20 scroll-mt-10">
          <div className="bg-white/80 dark:bg-[#0a0e1a]/75 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.06] rounded-3xl sm:rounded-[2.25rem] p-6 sm:p-8 shadow-sm dark:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Alur Kerja Terpadu — 4 Langkah Selesai
              </h2>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-cyan-400">
                Hemat Waktu Koreksi hingga 90%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {WORKFLOW_STEPS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] flex items-start gap-3.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
                    {item.step}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Download APK Android & Informasi Penting (Dipindahkan dari Dashboard) */}
        <section id="android-app" className="mt-16 sm:mt-20 scroll-mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
            {/* Card Download APK Android */}
            <div className="lg:col-span-2 bg-gradient-to-br from-emerald-50 via-white to-cyan-50/80 dark:from-emerald-950/40 dark:via-[#0a0e1a] dark:to-cyan-950/35 border border-emerald-200/80 dark:border-emerald-500/25 p-6 sm:p-8 rounded-3xl sm:rounded-[2.25rem] flex flex-col justify-between gap-6 shadow-md shadow-emerald-500/5 dark:shadow-none min-w-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Aplikasi Android</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                    v{ANDROID_APK_RELEASE.version} · APK
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Download WMVAA Grader Mobile
                  </h2>
                  <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed font-medium">
                    Pasang aplikasi Android resmi agar guru dapat memindai LJK dari kamera HP kapan saja sebelum login di ruang ujian.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {ANDROID_HIGHLIGHTS.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <a
                  href={ANDROID_APK_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Download APK v{ANDROID_APK_RELEASE.version} ({ANDROID_APK_RELEASE.sizeLabel})</span>
                </a>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-bold">
                  <a
                    href={ANDROID_RELEASE_PAGE_URL}
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

            {/* Card Informasi Penting & Tautan Resmi */}
            <div className="lg:col-span-3 bg-white/85 dark:bg-[#0a0e1a]/75 backdrop-blur-xl border border-slate-200 dark:border-white/[0.06] p-6 sm:p-8 rounded-3xl sm:rounded-[2.25rem] flex flex-col justify-between gap-5 shadow-sm dark:shadow-none min-w-0">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-cyan-400 border border-purple-500/20">
                      <Info className="w-4 h-4" />
                    </span>
                    <span>Informasi Penting &amp; Panduan Cepat</span>
                  </h2>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 dark:bg-cyan-500/10 border border-purple-500/20 dark:border-cyan-500/20 text-[10px] font-mono font-bold text-purple-700 dark:text-cyan-300">
                      Web v{WEB_APP_VERSION}
                    </span>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-cyan-400 hover:underline"
                    >
                      <span>Masuk ke Portal</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {IMPORTANT_INFOS.map((info, idx) => (
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
                <div className="flex flex-wrap items-center gap-2.5">
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
                  href={WEB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-cyan-400 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Dokumentasi &amp; Rilis Web v{WEB_APP_VERSION}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Compact Footer */}
        <footer className="mt-14 pt-8 border-t border-slate-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 font-semibold">
          <div className="flex items-center gap-3">
            <BrandLogo variant="symbol" className="w-8 h-8 rounded-lg" />
            <span>WMVAA AI Grader Pro v{WEB_APP_VERSION} • Wamena Mountain View Adventist Academy</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#android-app" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Unduh APK
            </a>
            <Link href="/login" className="text-purple-600 dark:text-cyan-400 font-black hover:underline">
              Login Guru / Admin →
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
