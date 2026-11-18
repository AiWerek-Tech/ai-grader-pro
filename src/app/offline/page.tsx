'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, ShieldCheck, ArrowLeft, Radio } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { withBasePath } from '@/lib/base-path';

export default function OfflinePage() {
  const [checking, setChecking] = useState(false);
  const [statusNote, setStatusNote] = useState(
    'Perangkat Anda sedang terputus dari internet atau server sekolah.'
  );
  const [isOnlineNow, setIsOnlineNow] = useState(false);
  const checkingRef = useRef(false);

  const attemptReconnect = useCallback(async (manual = false) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    if (manual) {
      setStatusNote('Memeriksa koneksi ke server WMVAA...');
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(withBasePath(`/manifest.webmanifest?ping=${Date.now()}`), {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        setIsOnlineNow(true);
        setStatusNote('Koneksi kembali aktif! Mengalihkan ke aplikasi...');
        setTimeout(() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.assign(withBasePath('/dashboard'));
          }
        }, 400);
        return;
      }
    } catch {
      // Masih offline
    }

    setIsOnlineNow(false);
    checkingRef.current = false;
    setChecking(false);
    if (manual) {
      setStatusNote('Jaringan masih belum tersedia. Pastikan Wi-Fi atau Data Seluler aktif.');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnlineNow(navigator.onLine);

    const handleOnline = () => {
      setIsOnlineNow(true);
      attemptReconnect(false);
    };
    const handleOffline = () => {
      setIsOnlineNow(false);
      setStatusNote('Koneksi terputus. Menunggu sinyal Wi-Fi atau Data Seluler...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [attemptReconnect]);

  return (
    <div className="min-h-screen bg-[#050314] text-slate-100 flex flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="absolute top-[-120px] left-[-120px] w-[360px] h-[360px] rounded-full bg-rose-600/15 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-120px] right-[-120px] w-[360px] h-[360px] rounded-full bg-purple-600/20 blur-[100px] pointer-events-none" />

      {/* Brand Header Pill */}
      <div className="mb-5 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[#0e0a2a] border border-purple-500/25 shadow-lg">
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
          <BrandLogo variant="symbol" className="w-full h-full" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
          WMVAA AI Grader Pro
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-[#0e0a2a]/95 border border-purple-500/20 rounded-[2rem] p-6 sm:p-8 shadow-2xl text-center space-y-5 relative z-10">
        {/* Status Pill */}
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            isOnlineNow
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnlineNow ? 'bg-emerald-400 animate-ping' : 'bg-rose-400 animate-pulse'
            }`}
          />
          {isOnlineNow ? 'Mencoba Menyambung...' : 'Tidak Ada Koneksi Internet'}
        </div>

        {/* Hero Disconnected Icon */}
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-rose-500/20 via-purple-600/20 to-cyan-500/10 border border-rose-500/30 flex items-center justify-center shadow-inner">
          <WifiOff className="w-11 h-11 text-white" />
        </div>

        {/* Title & Copy */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Koneksi Terputus
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
            {statusNote}
          </p>
        </div>

        {/* Auto-reconnect indicator */}
        <div className="inline-flex items-center gap-2 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3.5 py-2 rounded-xl">
          <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
          <span>Halaman otomatis dimuat ulang saat sinyal kembali</span>
        </div>

        {/* Local Draft Safety Card */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-left">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black text-emerald-400">
              Draft Scan Lokal Tetap Aman
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Foto dan antrean LJK yang belum tersimpan tetap tersimpan aman di memori perangkat Anda.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => attemptReconnect(true)}
            disabled={checking}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:brightness-110 disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Memeriksa Koneksi...' : 'Coba Sambungkan Lagi'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.assign(withBasePath('/dashboard'));
              }
            }}
            className="w-full py-3 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Halaman Sebelumnya</span>
          </button>
        </div>

        {/* Checklist */}
        <div className="p-4 rounded-2xl bg-[#09051f] border border-purple-500/15 text-left space-y-1.5">
          <div className="text-[11px] font-black text-slate-200">
            Langkah Pemeriksaan Cepat:
          </div>
          <ul className="text-[11px] text-slate-400 space-y-1 leading-relaxed list-disc pl-4">
            <li>Pastikan Wi-Fi atau Data Seluler pada perangkat aktif.</li>
            <li>Jika memakai server lokal sekolah, pastikan terhubung ke Wi-Fi yang sama dengan server.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
