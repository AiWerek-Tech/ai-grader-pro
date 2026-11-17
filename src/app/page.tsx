import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";
import { ArrowRight, BrainCircuit, Infinity, Activity, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050314] text-slate-800 dark:text-slate-200 transition-colors duration-300 relative">
      
      {/* Brand Ambient Orbs (Violet & Electric Cyan - Desktop/Tablet only untuk GPU ringan) */}
      <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[8%] left-[18%] w-[520px] h-[520px] rounded-full -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(147,51,234,0.18),transparent_70%)]" />
        <div className="absolute bottom-[15%] right-[10%] w-[460px] h-[460px] rounded-full translate-x-1/2 translate-y-1/2 bg-[radial-gradient(circle,rgba(6,182,212,0.15),transparent_70%)]" />
      </div>

      <div className="max-w-[1200px] mx-auto px-6 pb-20 relative z-10 w-full">
        {/* Navbar */}
        <nav className="py-7 flex justify-between items-center relative z-20 gap-4">
          <div className="flex items-center group">
            <BrandLogo
              variant="horizontal"
              priority
              className="h-12 sm:h-14 w-auto group-hover:scale-[1.02] transition-transform duration-300 drop-shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <ThemeToggle />
            <Link 
              href="/login" 
              className="px-5 sm:px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest bg-white/90 dark:bg-white/[0.06] border border-purple-200/80 dark:border-purple-500/25 text-slate-800 dark:text-slate-200 hover:border-cyan-400 dark:hover:border-cyan-400/50 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              Login Portal
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="mt-16 sm:mt-24 text-center flex flex-col items-center animate-[fadeIn_0.6s_ease-out_forwards] relative z-10">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-purple-200 dark:border-purple-500/30 bg-purple-50/90 dark:bg-purple-500/10 backdrop-blur-md text-purple-700 dark:text-cyan-300 font-extrabold text-[10px] uppercase tracking-[0.2em] mb-8 transition-colors shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-cyan-400" />
            <span>WMVAA AI Ecosystem v2.0 • Enterprise Edition</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-black text-slate-900 dark:text-white leading-[1.08] tracking-tighter mb-8 max-w-5xl transition-colors drop-shadow-sm">
            Penilaian Ujian <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 dark:from-purple-400 dark:via-blue-400 dark:to-cyan-300 drop-shadow-sm">
              Level Enterprise
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-12 font-medium transition-colors">
            Platform verifikasi LJK cerdas tanpa batas template. Akurasi tinggi menggunakan agregasi kapabilitas Gemini AI Vision &amp; Hybrid OMR secara seketika (<em>real-time</em>).
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/login" 
              className="group px-10 py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 text-white shadow-xl shadow-purple-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-cyan-500/35 flex items-center gap-3"
            >
              Mulai Penilaian
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 group-hover:scale-110 transition-transform" />
            </Link>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mt-28 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 animate-[fadeIn_0.8s_ease-out_forwards] relative z-10">
          {[
            {
              icon: <BrainCircuit className="w-7 h-7" />,
              title: 'Zero-Template Scanning',
              desc: 'Tinggalkan standar LJK konvensional yang kaku. AI mampu membaca form acak & LJK hybrid secara akurat via Visi Komputer.',
              bgClass: 'bg-purple-500',
              textClass: 'text-purple-600 dark:text-purple-400',
              borderHover: 'hover:border-purple-300 dark:hover:border-purple-500/30',
            },
            {
              icon: <Infinity className="w-7 h-7" />,
              title: 'Consensus Engine',
              desc: 'Kesalahan pembacaan dicegah berkat konfirmasi data terarah via kecerdasan asisten gabungan hibrida OMR + AI.',
              bgClass: 'bg-cyan-500',
              textClass: 'text-cyan-600 dark:text-cyan-400',
              borderHover: 'hover:border-cyan-300 dark:hover:border-cyan-500/30',
            },
            {
              icon: <Activity className="w-7 h-7" />,
              title: 'Global Analytics',
              desc: 'Terintegrasi dengan Google Sheets. Semua hasil disinkronisasi secara real-time lengkap dengan diagnostik butir soal.',
              bgClass: 'bg-emerald-500',
              textClass: 'text-emerald-600 dark:text-emerald-400',
              borderHover: 'hover:border-emerald-300 dark:hover:border-emerald-500/30',
            }
          ].map((f, i) => (
            <div key={i} className={`group bg-white/80 dark:bg-[#09051f]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.06] ${f.borderHover} p-8 sm:p-10 rounded-[2.5rem] hover:-translate-y-2 hover:bg-white dark:hover:bg-[#0e0a2a] transition-all duration-500 shadow-xl shadow-purple-500/5 dark:shadow-none min-w-0`}>
              <div className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center mb-8 bg-gradient-to-br from-white to-transparent dark:from-white/5 dark:to-transparent overflow-hidden relative shadow-sm dark:shadow-inner transition-colors group-hover:scale-110 duration-500 border border-slate-100 dark:border-white/10">
                 <div className={`absolute inset-0 opacity-15 ${f.bgClass}`} />
                 <div className={`relative z-10 ${f.textClass}`}>{f.icon}</div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter transition-colors">{f.title}</h3>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">{f.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
