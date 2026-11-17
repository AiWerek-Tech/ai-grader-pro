'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { withBasePath } from '@/lib/base-path';

declare global {
  interface Window {
    WMVAANative?: {
      printCurrentPage?: () => void;
      openServerSettings?: () => void;
      saveBase64File?: (base64Data: string, fileName: string, mimeType: string) => void;
      getAppVersion?: () => string;
      setSwipeRefreshEnabled?: (enabled: boolean) => void;
    };
  }
}

export function PwaOfflineBridge() {
  const [isOffline, setIsOffline] = useState(false);
  const [hasNativeSettings, setHasNativeSettings] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.WMVAANative?.openServerSettings === 'function') {
      setHasNativeSettings(true);
    }

    // 1. Register / update Service Worker pembersih cache lama (tanpa intersepsi fetch)
    if ('serviceWorker' in navigator) {
      const swScope = withBasePath('/');
      navigator.serviceWorker
        .register(withBasePath('/sw.js'), { scope: swScope.endsWith('/') ? swScope : `${swScope}/` })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }

    // Bersihkan Cache Storage versi v2.0.0–v2.0.2 yang pernah menyimpan respons HTML/redirect lama
    if (typeof caches !== 'undefined') {
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wmvaa-')).map((k) => caches.delete(k))))
        .catch(() => {});
    }

    // 2. Bridge window.print() untuk Android Kotlin WebView
    const origPrint = window.print.bind(window);
    window.print = () => {
      if (window.WMVAANative && typeof window.WMVAANative.printCurrentPage === 'function') {
        window.WMVAANative.printCurrentPage();
      } else {
        origPrint();
      }
    };

    // 3. Bridge unduhan blob: (Excel/CSV/Kartu Login) untuk Android Kotlin WebView
    const handleAnchorClick = (event: MouseEvent) => {
      const nativeBridge = window.WMVAANative;
      if (!nativeBridge || typeof nativeBridge.saveBase64File !== 'function') return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('blob:')) return;

      event.preventDefault();
      const fileName = anchor.getAttribute('download') || `wmvaa-export-${Date.now()}.bin`;

      fetch(href)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            if (base64) {
              nativeBridge.saveBase64File?.(base64, fileName, blob.type || 'application/octet-stream');
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {});
    };

    document.addEventListener('click', handleAnchorClick, true);

    // 4. Monitor Koneksi Jaringan
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 5. Smart Android Pull-to-Refresh Guard (mencegah refresh tidak sengaja saat scroll balik ke atas / modal terbuka)
    let lastSwipeState: boolean | null = null;
    const syncSwipeState = (targetEl?: EventTarget | null) => {
      const bridge = window.WMVAANative;
      if (!bridge || typeof bridge.setSwipeRefreshEnabled !== 'function') return;

      const docScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      let canRefresh = docScrollY <= 2;

      if (canRefresh) {
        // Nonaktifkan pull-to-refresh jika ada modal/drawer/scanner aktif di layar
        const overlays = document.querySelectorAll('.fixed.inset-0');
        for (let i = 0; i < overlays.length; i++) {
          const ov = overlays[i] as HTMLElement;
          if (!ov.classList.contains('pointer-events-none')) {
            canRefresh = false;
            break;
          }
        }
      }

      if (canRefresh && targetEl && targetEl instanceof HTMLElement) {
        // Nonaktifkan jika user menyentuh container tabel/list internal yang sedang ter-scroll
        let cur: HTMLElement | null = targetEl;
        while (cur && cur !== document.body && cur !== document.documentElement) {
          if (cur.scrollTop > 2 && cur.scrollHeight > cur.clientHeight + 4) {
            canRefresh = false;
            break;
          }
          cur = cur.parentElement;
        }
      }

      if (canRefresh !== lastSwipeState) {
        lastSwipeState = canRefresh;
        try {
          // PENTING: wajib dipanggil sebagai method langsung pada `bridge` (Android WebView @JavascriptInterface menolak fungsi terlepas dari objeknya)
          bridge.setSwipeRefreshEnabled(canRefresh);
        } catch {
          // Abaikan jika WebView bridge belum siap atau versi APK lama
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => syncSwipeState(e.target);
    const handleScroll = () => syncSwipeState(null);

    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    syncSwipeState(null);

    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-2 inset-x-3 z-[200] max-w-md mx-auto bg-amber-500/95 backdrop-blur-xl text-slate-950 px-4 py-2.5 rounded-2xl shadow-2xl border border-amber-300 flex items-center justify-between gap-3 print:hidden animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <WifiOff className="w-4 h-4 shrink-0" />
        <div className="text-[11px] font-black leading-tight truncate">
          Mode Offline Aktif · Draft scan tetap aman di perangkat
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {hasNativeSettings && (
          <button
            type="button"
            onClick={() => window.WMVAANative?.openServerSettings?.()}
            className="px-2.5 py-1 rounded-xl bg-white/80 text-slate-950 text-[9px] font-black uppercase tracking-wider shrink-0 active:scale-95"
          >
            Server
          </button>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-2.5 py-1 rounded-xl bg-slate-950 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 active:scale-95"
        >
          <RefreshCw className="w-3 h-3" /> Muat Ulang
        </button>
      </div>
    </div>
  );
}
