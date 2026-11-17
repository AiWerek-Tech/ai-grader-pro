'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/app/dashboard/LogoutButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { transformDriveLink } from '@/lib/utils';
import Image from 'next/image';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { withBasePath } from '@/lib/base-path';
import { BrandLogo } from '@/components/BrandLogo';
import {
  Menu, X, LayoutDashboard, Key, ScanLine, Award,
  ChevronRight, QrCode, Smartphone, Wifi, Copy, Check
} from 'lucide-react';

interface ResponsiveDashboardWrapperProps {
  children: React.ReactNode;
  user: {
    id: string;
    username: string;
    role: 'ADMIN' | 'GURU';
    nama: string;
    profile_url?: string;
    isLoggedIn: boolean;
  };
  adminSections: Array<{
    label: string;
    adminOnly?: boolean;
    items: Array<{ href: string; icon: string; label: string }>;
  }>;
  academicLabel?: string;
}

export default function ResponsiveDashboardWrapper({
  children,
  user,
  adminSections,
  academicLabel = 'Akademik 2026/2027 • GANJIL'
}: ResponsiveDashboardWrapperProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLanModal, setShowLanModal] = useState(false);
  const [lanInfo, setLanInfo] = useState<{
    hostname?: string;
    port?: string;
    primaryUrl: string;
    interfaces: Array<{ name: string; ip: string; url: string }>;
  }>({
    primaryUrl: 'http://192.168.1.62:3000',
    interfaces: [],
  });
  const [selectedLanUrl, setSelectedLanUrl] = useState('http://192.168.1.62:3000');
  const [copiedLan, setCopiedLan] = useState(false);
  const [isAndroidApp, setIsAndroidApp] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.WMVAANative?.openServerSettings === 'function') {
      setIsAndroidApp(true);
    }
  }, []);

  const pathname = usePathname();
  const isAdmin = user?.role === 'ADMIN';
  const visibleSections = adminSections.filter(s => !s.adminOnly || isAdmin);

  useEffect(() => {
    if (!showLanModal) return;
    fetch(withBasePath('/api/system/network'))
      .then(r => r.json())
      .then(res => {
        if (res?.status === 'success' && res.data) {
          setLanInfo(res.data);
          setSelectedLanUrl(res.data.primaryUrl);
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          setSelectedLanUrl(`${window.location.origin}${withBasePath('')}`);
        }
      });
  }, [showLanModal]);

  const isRouteActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const isOtherActive =
    pathname !== '/dashboard' &&
    !pathname.startsWith('/dashboard/kunci') &&
    !pathname.startsWith('/dashboard/analisis') &&
    !pathname.startsWith('/dashboard/hasil');

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#050314] text-slate-900 dark:text-slate-100 transition-colors duration-300 print:block print:bg-white print:text-black print:overflow-visible print:min-h-0">
      
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden print:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop Sticky + Mobile Drawer) */}
      <aside className={`
        fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50
        w-[290px] sm:w-[320px] lg:w-[280px] bg-white dark:bg-[#09051f] 
        border-r border-slate-200 dark:border-purple-500/10 
        flex flex-col py-6 px-4 lg:py-8 lg:px-5 flex-shrink-0 h-[100dvh]
        transition-transform duration-300 ease-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        shadow-2xl lg:shadow-none dark:shadow-none
        print:hidden
      `}>
        {/* Brand Header */}
        <div className="px-2 mb-6 lg:mb-8 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex flex-col min-w-0 group" onClick={() => setIsMobileMenuOpen(false)}>
            <BrandLogo variant="horizontal" priority className="h-11 w-auto max-w-[185px] object-left group-hover:scale-[1.02] transition-transform" />
            <div className="text-[9px] font-black text-purple-600 dark:text-cyan-400 uppercase tracking-[0.22em] mt-1.5 pl-0.5 opacity-90">
              Enterprise v2.0
            </div>
          </Link>

          {/* Close button inside mobile drawer */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all shrink-0"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card inside Sidebar */}
        {user && (
          <Link
            href="/dashboard/profile"
            onClick={() => setIsMobileMenuOpen(false)}
            className="mb-6 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] hover:border-purple-500/35 dark:hover:border-cyan-400/35 transition-all group block"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-400 p-[1.5px] overflow-hidden flex-shrink-0">
                <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#09051f] flex items-center justify-center text-slate-900 dark:text-white text-sm font-black overflow-hidden">
                  {user.profile_url ? (
                    <Image src={transformDriveLink(user.profile_url)} alt={user.nama} width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    user.nama.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-cyan-400 transition-colors">
                  {user.nama}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                  <div className={`text-[9px] font-black uppercase tracking-widest ${isAdmin ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {user.role}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 space-y-6 overflow-y-auto pr-1 custom-scrollbar touch-scroll">
          {visibleSections.map(section => (
            <div key={section.label}>
              <div className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map(item => {
                  const active = isRouteActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-[13px] font-bold transition-all group relative ${
                        active
                          ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-purple-500/25 dark:shadow-cyan-500/10'
                          : 'text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-white hover:bg-purple-50/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="text-lg opacity-90 group-hover:scale-110 transition-transform font-emoji flex-shrink-0">
                        {item.icon}
                      </span>
                      <span className="tracking-tight truncate">{item.label}</span>
                      {active && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-200 animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Actions inside Sidebar */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
          <LogoutButton />
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 print:block">
        
        {/* Top Header */}
        <header className="h-16 lg:h-20 px-3 sm:px-6 lg:px-10 flex justify-between items-center bg-white/95 dark:bg-[#050314]/95 lg:bg-white/85 lg:dark:bg-[#050314]/85 lg:backdrop-blur-xl sticky top-0 z-30 border-b border-slate-200/80 dark:border-purple-500/10 transition-colors duration-300 print:hidden">
          
          {/* Left: Mobile Brand & Hamburger Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors active:scale-95"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Brand Pill */}
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-md shadow-purple-500/20 border border-purple-200/60 dark:border-purple-500/30 bg-[#09051f]">
                <BrandLogo variant="app-icon" priority className="w-full h-full" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white leading-none">
                  WMVAA Grader
                </span>
                <span className="text-[8px] font-bold text-purple-600 dark:text-cyan-400 uppercase tracking-widest mt-0.5">
                  AI Pro v2.0
                </span>
              </div>
            </Link>

            {/* Desktop Academic Session Label */}
            <div className="h-8 w-[2.5px] bg-gradient-to-b from-purple-500 to-cyan-400 rounded-full hidden sm:block" />
            <div className="hidden sm:block">
              <h1 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest transition-colors">{academicLabel}</h1>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-bold transition-colors">
                Status: <span className="text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter">● Online</span> · Kurikulum Merdeka
              </p>
            </div>
          </div>
          
          {/* Right: Android Server Switcher (khusus Android Wrapper), QR LAN Access, Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAndroidApp && (
              <button
                type="button"
                onClick={() => window.WMVAANative?.openServerSettings?.()}
                title="Pengaturan Koneksi Server Android"
                className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider transition-all shadow-sm active:scale-95"
              >
                <Wifi className="w-4 h-4 shrink-0" />
                <span>Server</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowLanModal(true)}
              title="QR Code Akses HP Guru"
              className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 flex items-center gap-1.5 text-purple-600 dark:text-cyan-400 font-black text-[10px] uppercase tracking-wider transition-all shadow-sm active:scale-95"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">QR Akses HP Guru</span>
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Native Window-Scrolled Main Body — Tanpa nested overflow-y-auto agar scroll naik-turun di HP/Android mulus & tidak terkandas */}
        <div className="flex-1 relative">
          {/* Subtle Ambient Glows (Desktop only agar GPU HP ultra ringan & bebas crash) */}
          <div className="hidden lg:block fixed inset-0 left-[280px] overflow-hidden pointer-events-none z-0 print:hidden">
            <div className="absolute top-0 right-0 w-[460px] h-[460px] rounded-full -mr-40 -mt-40 bg-[radial-gradient(circle,rgba(124,58,237,0.12),transparent_70%)] dark:bg-[radial-gradient(circle,rgba(147,51,234,0.14),transparent_70%)]" />
            <div className="absolute bottom-0 left-0 w-[380px] h-[380px] rounded-full -ml-32 -mb-32 bg-[radial-gradient(circle,rgba(6,182,212,0.10),transparent_70%)] dark:bg-[radial-gradient(circle,rgba(0,229,255,0.08),transparent_70%)]" />
          </div>

          <div className="pb-[calc(9.5rem+env(safe-area-inset-bottom,0px))] lg:pb-12 print:pb-0">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav 
          aria-label="Navigasi Bawah Mobile"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#09051f] border-t border-slate-200/90 dark:border-purple-500/15 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.6)] pb-safe pt-2 px-3 print:hidden transition-colors"
        >
          <div className="max-w-md mx-auto grid grid-cols-5 items-center justify-items-center">
            
            {/* 1. Overview */}
            <Link
              href="/dashboard"
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all active:scale-90 ${
                pathname === '/dashboard'
                  ? 'text-purple-600 dark:text-cyan-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 mb-1" />
              <span className="text-[10px] tracking-tight">Overview</span>
              {pathname === '/dashboard' && (
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 mt-0.5" />
              )}
            </Link>

            {/* 2. Kunci */}
            <Link
              href="/dashboard/kunci"
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all active:scale-90 ${
                pathname.startsWith('/dashboard/kunci')
                  ? 'text-purple-600 dark:text-cyan-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'
              }`}
            >
              <Key className="w-5 h-5 mb-1" />
              <span className="text-[10px] tracking-tight">Kunci</span>
              {pathname.startsWith('/dashboard/kunci') && (
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 mt-0.5" />
              )}
            </Link>

            {/* 3. Center Featured: Scan LJK */}
            <Link
              href="/dashboard/analisis"
              className="flex flex-col items-center justify-center -mt-6 group active:scale-95 transition-transform"
              aria-label="Scan LJK Kamera"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                pathname.startsWith('/dashboard/analisis')
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 text-white shadow-cyan-500/40 ring-4 ring-purple-500/20 scale-105'
                  : 'bg-gradient-to-tr from-purple-600 to-cyan-500 text-white shadow-purple-500/30'
              }`}>
                <ScanLine className="w-6 h-6 animate-pulse" />
              </div>
              <span className={`text-[10px] mt-1 tracking-tight ${
                pathname.startsWith('/dashboard/analisis')
                  ? 'text-purple-600 dark:text-cyan-400 font-black'
                  : 'text-slate-600 dark:text-slate-300 font-bold'
              }`}>
                Scan LJK
              </span>
            </Link>

            {/* 4. Hasil */}
            <Link
              href="/dashboard/hasil"
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all active:scale-90 ${
                pathname.startsWith('/dashboard/hasil')
                  ? 'text-purple-600 dark:text-cyan-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'
              }`}
            >
              <Award className="w-5 h-5 mb-1" />
              <span className="text-[10px] tracking-tight">Hasil</span>
              {pathname.startsWith('/dashboard/hasil') && (
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 mt-0.5" />
              )}
            </Link>

            {/* 5. Menu Drawer Trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all active:scale-90 ${
                isMobileMenuOpen || isOtherActive
                  ? 'text-purple-600 dark:text-cyan-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'
              }`}
              aria-label="Buka Semua Menu"
            >
              <Menu className="w-5 h-5 mb-1" />
              <span className="text-[10px] tracking-tight">Menu</span>
              {isOtherActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 mt-0.5" />
              )}
            </button>

          </div>
        </nav>

        {/* Modal QR Akses HP Guru (Cloud / Jaringan Lokal) */}
        {showLanModal && (
          <div
            className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 print:hidden animate-in fade-in duration-150"
            onClick={() => setShowLanModal(false)}
          >
            <div
              className="bg-white dark:bg-[#09051f] border border-slate-200 dark:border-purple-500/20 rounded-[2rem] max-w-md w-full p-6 shadow-2xl space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-cyan-400">
                    <Wifi className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      Akses Cepat HP Guru
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Scan QR ini dengan kamera HP atau aplikasi Android WMVAA Grader
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLanModal(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-rose-500 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* QR Code Box */}
              <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3">
                <div className="p-3.5 bg-white rounded-2xl shadow-md border border-slate-200">
                  <QRCodeCanvas
                    value={`${selectedLanUrl.replace(/\/+$/, '')}/dashboard/analisis`}
                    size={190}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    URL Server Aktif
                  </div>
                  <div className="text-sm font-mono font-black text-purple-600 dark:text-cyan-400 mt-0.5 select-all break-all">
                    {selectedLanUrl}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(selectedLanUrl);
                    setCopiedLan(true);
                    toast.success('Alamat server disalin!');
                    setTimeout(() => setCopiedLan(false), 2000);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-purple-500/20 active:scale-95"
                >
                  {copiedLan ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLan ? 'Tersalin!' : 'Salin Alamat URL'}</span>
                </button>
              </div>

              {/* Pilihan Adapter Jaringan jika lebih dari 1 */}
              {lanInfo.interfaces.length > 1 && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Pilih Adapter Jaringan (Wi-Fi / LAN):
                  </label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-28 overflow-y-auto">
                    {lanInfo.interfaces.map((iface) => (
                      <button
                        key={iface.url}
                        type="button"
                        onClick={() => setSelectedLanUrl(iface.url)}
                        className={`px-3 py-2 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                          selectedLanUrl === iface.url
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-black'
                            : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="truncate">{iface.name}</span>
                        <span className="font-mono text-[11px]">{iface.ip}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips Install Aplikasi Native (PWA) di HP */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <b className="text-emerald-600 dark:text-emerald-400">Tips Aplikasi Layar Penuh di HP:</b> Setelah terbuka di Chrome/Safari HP, ketuk menu browser lalu pilih <b>&ldquo;Tambahkan ke Layar Utama&rdquo; (Add to Home Screen)</b> agar aplikasi terpasang permanen seperti aplikasi native.
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}