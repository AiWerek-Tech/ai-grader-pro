'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { loginAction, getPublicLoginUsersAction } from '@/lib/actions/auth';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BrandLogo } from '@/components/BrandLogo';
import { Loader2, Eye, EyeOff, Lock, AlertTriangle, ShieldCheck, Zap, BrainCircuit, KeyRound, Users } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accountList, setAccountList] = useState<Array<{ username: string; nama: string; role: string }>>([]);
  const [isAndroidApp, setIsAndroidApp] = useState(false);

  useEffect(() => {
    // 1. Ambil list user dari REST API langsung (100% andal di LAN/HP tanpa issue Server Action)
    fetch(withBasePath('/api/auth/users'))
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setAccountList(res.data);
        } else {
          throw new Error('Fallback needed');
        }
      })
      .catch(() => {
        getPublicLoginUsersAction()
          .then((res) => {
            if (res.success && res.data) setAccountList(res.data);
          })
          .catch(() => {});
      });

    // 2. Tangkap error jika ada redirect balik dari form submission native
    if (typeof window !== 'undefined') {
      if (typeof (window as any).WMVAANative?.openServerSettings === 'function') {
        setIsAndroidApp(true);
      }
      const p = new URLSearchParams(window.location.search);
      const qErr = p.get('error');
      if (qErr) {
        setError(qErr);
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Jalur Utama: Direct HTTP API Route (100% stabil di mobile browser Android/iOS & jaringan LAN)
      const res = await fetch(withBasePath('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const result = await res.json().catch(() => null);

      if (result && result.success) {
        const params = new URLSearchParams(window.location.search);
        const targetUrl = params.get('redirect') || '/dashboard';
        window.location.assign(withBasePath(targetUrl.startsWith('/') ? targetUrl : '/dashboard'));
        return;
      }

      if (result && !result.success) {
        setError(result.message || 'Login gagal. Periksa username dan password Anda.');
        if (result.locked) setLocked(true);
        setLoading(false);
        return;
      }

      // 2. Jalur Fallback: Server Action jika fetch API tidak merespon
      const actionResult = await loginAction(username.trim(), password);
      if (actionResult.success) {
        const params = new URLSearchParams(window.location.search);
        const targetUrl = params.get('redirect') || '/dashboard';
        window.location.assign(withBasePath(targetUrl.startsWith('/') ? targetUrl : '/dashboard'));
        return;
      } else {
        setError(actionResult.message || 'Login gagal.');
        if (actionResult.locked) setLocked(true);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan koneksi ke server.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-h-screen flex bg-slate-50 dark:bg-[#050314] transition-colors duration-300 relative">
      
      {/* ── Theme Toggle Absolute ── */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* ── LEFT PANEL: Branding ── */}
      <div className="hidden lg:flex w-[55%] relative overflow-hidden items-center justify-center p-16 bg-gradient-to-br from-purple-100/80 via-slate-50 to-cyan-50/70 dark:from-[#07041a] dark:via-[#0b0724] dark:to-[#040f1e] transition-colors duration-300">
        
        {/* Animated Gradient Blobs (Brand Violet & Electric Cyan) */}
        <div className="absolute w-[620px] h-[620px] rounded-full top-[-120px] left-[-120px] blur-[110px] animate-blob bg-purple-600/20 dark:bg-purple-600/35 mix-blend-multiply dark:mix-blend-normal" />
        <div className="absolute w-[520px] h-[520px] rounded-full bottom-[-90px] right-[-90px] blur-[110px] animate-blob animation-delay-2000 bg-cyan-500/20 dark:bg-cyan-500/25 mix-blend-multiply dark:mix-blend-normal" />
        <div className="absolute w-[400px] h-[400px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-[90px] animate-blob animation-delay-4000 bg-indigo-500/10 dark:bg-indigo-500/15 mix-blend-multiply dark:mix-blend-normal" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.18] dark:opacity-[0.04] bg-[linear-gradient(rgba(124,58,237,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.18)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] bg-[length:40px_40px]" />

        {/* Content */}
        <div className="relative z-10 max-w-[490px]">
          {/* Official Brand Logo Showcase */}
          <div className="inline-flex flex-col gap-2 bg-white/80 dark:bg-[#0e0a2a]/70 backdrop-blur-2xl border border-purple-200/70 dark:border-purple-500/25 rounded-3xl px-6 py-4 mb-10 shadow-2xl shadow-purple-500/10 dark:shadow-black/40 transition-colors duration-300">
            <BrandLogo variant="horizontal" priority className="h-14 w-auto" />
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/70 dark:border-white/10">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-purple-700 dark:text-cyan-300 font-black uppercase tracking-[0.22em]">
                Sogokmo · Enterprise Edition v2.0
              </span>
            </div>
          </div>

          <h1 className="text-[3.4rem] font-black text-slate-900 dark:text-white leading-[1.06] tracking-tighter mb-6 transition-colors drop-shadow-sm">
            Penilaian LJK<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 dark:from-purple-400 dark:via-blue-400 dark:to-cyan-300">
              Tanpa Ruang Batas.
            </span>
          </h1>
          <p className="text-base font-medium text-slate-600 dark:text-slate-400 leading-relaxed mb-11 transition-colors">
            Platform verifikasi akademis berbasis Visi AI &amp; Hybrid OMR yang menyajikan kecepatan baca tingkat turnamen dan ketelitian skala penuh untuk operasional LJK digital.
          </p>

          {/* Feature Badges */}
          <div className="flex flex-col gap-5">
            {[
              { icon: <BrainCircuit className="w-6 h-6 text-purple-600 dark:text-purple-400" />, color: 'bg-purple-50/90 dark:bg-purple-500/15', border: 'border-purple-200 dark:border-purple-500/25', title: 'AI Vision Scanning', desc: 'Sistem pakar visual Gemini Vision terpadu' },
              { icon: <Zap className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />, color: 'bg-cyan-50/90 dark:bg-cyan-500/15', border: 'border-cyan-200 dark:border-cyan-500/25', title: 'Grading Instan', desc: 'Pemindaian LJK hybrid dinilai seketika' },
              { icon: <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />, color: 'bg-emerald-50/90 dark:bg-emerald-500/15', border: 'border-emerald-200 dark:border-emerald-500/25', title: 'Enterprise Security', desc: 'Proteksi session terenkripsi & audit log' },
            ].map(f => (
              <div key={f.title} className="flex items-center gap-5 group">
                <div className={`w-12 h-12 rounded-xl ${f.color} border ${f.border} flex items-center justify-center shrink-0 shadow-sm dark:shadow-none transition-all group-hover:scale-110`}>
                  {f.icon}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-100 transition-colors tracking-tight">{f.title}</div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 transition-colors uppercase tracking-widest mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 pt-8 border-t border-purple-200/60 dark:border-white/10 flex gap-10 transition-colors">
            {[
              { val: '99.8%', label: 'Akurasi AI' },
              { val: '3x', label: 'Verifikasi Ganda' },
              { val: '24/7', label: 'Cloud Ready' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col">
                <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none transition-colors drop-shadow-sm">{s.val}</div>
                <div className="text-[9px] text-purple-600 dark:text-cyan-400 font-black uppercase tracking-[0.2em] mt-2.5 transition-colors">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: Login Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8 py-10 pb-20 lg:pb-8 relative bg-white dark:bg-[#050314] transition-colors duration-300">
        
        {/* Subtle BG Decoration */}
        <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.10),transparent_70%)]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[360px] h-[360px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.08),transparent_70%)]" />
        </div>

        <div className="w-full max-w-[400px] relative z-10">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-start gap-2 mb-10">
            <BrandLogo variant="horizontal" priority className="h-12 w-auto" />
            <div className="text-[9px] text-purple-600 dark:text-cyan-400 font-extrabold uppercase tracking-[0.22em]">
              Sogokmo · Enterprise v2.0
            </div>
          </div>

          {/* Heading */}
          <div className="mb-9">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter leading-tight mb-2.5 transition-colors drop-shadow-sm">
              Sistem Portal
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors tracking-wide">
              Masukkan mandat otorisasi untuk mengelola pusat perintah institusi Anda.
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div className={`mb-8 p-4 rounded-2xl flex items-center gap-4 transition-colors shadow-sm ${
              locked 
                ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400' 
                : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-500'
            } animate-[shake_0.4s_ease-in-out]`}>
              <div className="shrink-0">
                {locked ? <Lock className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <span className={`text-sm font-bold leading-snug`}>
                {error}
              </span>
            </div>
          )}

          {/* Form - Mendukung Native HTML POST MAUPUN Client-Side AJAX Fetch */}
          <form action={withBasePath('/api/auth/login')} method="POST" onSubmit={handleSubmit} className="flex flex-col gap-5">
            {accountList.length > 0 && (
              <div className="group">
                <label className="block text-[10px] font-black text-purple-600 dark:text-cyan-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Pilih Cepat Akun Guru / Admin
                </label>
                <select
                  value={accountList.some(a => a.username === username) ? username : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setUsername(e.target.value);
                      setError('');
                    }
                  }}
                  disabled={locked || loading}
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-purple-500/20 dark:border-purple-500/30 bg-purple-50/40 dark:bg-purple-500/5 text-slate-900 dark:text-slate-100 font-bold text-xs outline-none transition-all focus:border-purple-500 dark:focus:border-cyan-400 cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-[#09051f]">— Pilih Nama Guru / Admin —</option>
                  {accountList.map((acc) => (
                    <option key={acc.username} value={acc.username} className="bg-white dark:bg-[#09051f]">
                      {acc.nama}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="group">
              <label htmlFor="login-username" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 transition-colors group-focus-within:text-purple-600 dark:group-focus-within:text-cyan-400">
                Username
              </label>
              <input
                type="text"
                name="username"
                id="login-username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={locked || loading}
                autoComplete="username"
                placeholder="Masukkan username atau pilih nama di atas"
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800/70 bg-white dark:bg-white/[0.02] text-slate-900 dark:text-slate-100 font-medium text-sm outline-none transition-all focus:border-purple-500 dark:focus:border-cyan-400 focus:bg-white dark:focus:bg-[#09051f] focus:ring-[6px] focus:ring-purple-500/15 dark:focus:ring-cyan-400/15 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm dark:shadow-none"
              />
            </div>

            <div className="group">
              <label htmlFor="login-password" className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2.5 transition-colors group-focus-within:text-purple-600 dark:group-focus-within:text-cyan-400">
                Kata Sandi Validasi
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="login-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={locked || loading}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full pl-5 pr-14 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800/70 bg-white dark:bg-white/[0.02] text-slate-900 dark:text-slate-100 font-medium text-sm outline-none transition-all focus:border-purple-500 dark:focus:border-cyan-400 focus:bg-white dark:focus:bg-[#09051f] focus:ring-[6px] focus:ring-purple-500/15 dark:focus:ring-cyan-400/15 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm dark:shadow-none ${!showPassword && password ? 'tracking-[0.25em]' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 dark:hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-login-submit"
              disabled={locked || loading}
              className={`w-full mt-2 py-4 px-6 rounded-2xl text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 outline-none focus:ring-[6px] focus:ring-purple-500/30 ${
                locked 
                  ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-400 shadow-[0_12px_24px_-8px_rgba(124,58,237,0.5)] hover:shadow-[0_16px_30px_-8px_rgba(6,182,212,0.5)] hover:-translate-y-1'
              } ${loading ? 'opacity-80 cursor-wait' : ''}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifikasi Data...</span>
                </>
              ) : locked ? (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Portal Terkunci</span>
                </>
              ) : (
                <span>Konfirmasi Akses</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-12 flex flex-col items-center gap-3 pt-8 border-t border-slate-200 dark:border-white/[0.06] transition-colors">
            {isAndroidApp && (
              <button
                type="button"
                onClick={() => (window as any).WMVAANative?.openServerSettings?.()}
                className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                ⚙ Pengaturan Server &amp; Koneksi
              </button>
            )}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 dark:bg-white/[0.02] rounded-full border border-slate-200 dark:border-white/[0.06]">
              <KeyRound className="w-3.5 h-3.5 text-purple-500 dark:text-cyan-400" />
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] transition-colors">
                Bcrypt Encrypted · Iron Session
              </span>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400/80 transition-colors mt-2">
              © 2026 WMVAA Enterprise Ecosystem
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
