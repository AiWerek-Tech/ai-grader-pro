'use client';

import React, { useMemo, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { buildImageFallbackCandidates } from '@/lib/utils';

export function KeuanganLogo({
  src,
  defaultSrc,
  alt,
  sizeClass = 'w-[58px] h-[58px]',
}: {
  src?: string;
  defaultSrc: string;
  alt: string;
  sizeClass?: string;
}) {
  const candidates = useMemo(
    () => buildImageFallbackCandidates(src, defaultSrc),
    [src, defaultSrc]
  );
  const [idx, setIdx] = useState(0);
  const [prevKey, setPrevKey] = useState(`${src || ''}|${defaultSrc}`);

  const currentKey = `${src || ''}|${defaultSrc}`;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setIdx(0);
  }

  const activeUrl = candidates[idx] || defaultSrc;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx + 1 < candidates.length) setIdx((i) => i + 1);
      }}
      className={`${sizeClass} object-contain select-none shrink-0`}
    />
  );
}

export function KeuanganSignatureImg({
  src,
  alt = 'Tanda Tangan',
  heightClass = 'h-14',
}: {
  src?: string;
  alt?: string;
  heightClass?: string;
}) {
  const candidates = useMemo(() => buildImageFallbackCandidates(src, ''), [src]);
  const [idx, setIdx] = useState(0);
  const [prevSrc, setPrevSrc] = useState(src || '');

  if ((src || '') !== prevSrc) {
    setPrevSrc(src || '');
    setIdx(0);
  }

  const activeUrl = candidates[idx] || '';
  if (!activeUrl) return <div className={heightClass} />;

  return (
    <div className={`${heightClass} flex items-center justify-center my-0.5`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
        className={`max-h-full max-w-[140px] w-auto h-auto object-contain mix-blend-multiply select-none`}
      />
    </div>
  );
}

export interface KeuanganLeaderSigner {
  jabatan: string;
  jabatanLengkap: string;
  nama: string;
  nip: string;
  ttdUrl: string;
}

/**
 * Menentukan penandatangan pimpinan resmi laporan keuangan:
 * - Unit SMP  -> Kepala Sekolah (Kepsek SMP)
 * - Unit SMA  -> Kepala Sekolah (Kepsek SMA)
 * - Gabungan SMP & SMA ('ALL') -> Direktur (menggunakan Kepsek tertinggi yaitu Kepsek SMA)
 */
export function resolveKeuanganLeaderSigner(
  unit: 'SMP' | 'SMA' | 'ALL',
  settings: Record<string, string>
): KeuanganLeaderSigner {
  if (unit === 'SMP') {
    return {
      jabatan: 'Kepala Sekolah,',
      jabatanLengkap: `Kepala ${settings['smp_nama_sekolah_2'] || 'SMP Advent Sogokmo'}`,
      nama:
        settings['smp_kepala_nama'] ||
        settings['smp_kepsek_nama'] ||
        settings['kepala_nama'] ||
        '',
      nip: settings['smp_kepala_nip'] || settings['smp_kepsek_nip'] || '',
      ttdUrl:
        settings['smp_kepala_ttd_url'] ||
        settings['smp_kepsek_ttd_url'] ||
        '',
    };
  }

  if (unit === 'SMA') {
    return {
      jabatan: 'Kepala Sekolah,',
      jabatanLengkap: `Kepala ${settings['sma_nama_sekolah_2'] || 'SMA Advent Sogokmo'}`,
      nama:
        settings['sma_kepala_nama'] ||
        settings['sma_kepsek_nama'] ||
        settings['kepala_nama'] ||
        '',
      nip: settings['sma_kepala_nip'] || settings['sma_kepsek_nip'] || '',
      ttdUrl:
        settings['sma_kepala_ttd_url'] ||
        settings['sma_kepsek_ttd_url'] ||
        '',
    };
  }

  // Gabungan SMP & SMA -> Kepsek tertinggi (SMA) menjabat sebagai Direktur
  return {
    jabatan: 'Direktur,',
    jabatanLengkap: 'Direktur (Gabungan Unit SMP & SMA)',
    nama:
      settings['sma_kepala_nama'] ||
      settings['sma_kepsek_nama'] ||
      settings['kepala_nama'] ||
      settings['smp_kepala_nama'] ||
      '',
    nip:
      settings['sma_kepala_nip'] ||
      settings['sma_kepsek_nip'] ||
      settings['kepala_nip'] ||
      '',
    ttdUrl:
      settings['sma_kepala_ttd_url'] ||
      settings['sma_kepsek_ttd_url'] ||
      settings['kepala_ttd_url'] ||
      '',
  };
}

/**
 * Kop Surat Resmi Sekolah — mengikuti standar desain WMVAA (Daftar Hadir, Jadwal, & Pengaturan Sekolah)
 * lengkap dengan Logo Kiri + Logo Kanan (fallback universal), garis ganda resmi, alamat, dan NPSN.
 */
export function KeuanganKopSurat({
  unit,
  settings,
  compact = false,
}: {
  unit: 'SMP' | 'SMA' | 'ALL';
  settings: Record<string, string>;
  compact?: boolean;
}) {
  const prefix = unit === 'SMP' ? 'smp_' : unit === 'SMA' ? 'sma_' : '';
  const yayasan = settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
  const akademi =
    (prefix ? settings[`${prefix}nama_sekolah_1`] : '') ||
    settings['sma_nama_sekolah_1'] ||
    settings['smp_nama_sekolah_1'] ||
    settings['nama_sekolah_1'] ||
    'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';

  let sekolah = '';
  if (unit === 'SMP') {
    sekolah = settings['smp_nama_sekolah_2'] || settings['nama_sekolah_2'] || 'SMP ADVENT SOGOKMO';
  } else if (unit === 'SMA') {
    sekolah = settings['sma_nama_sekolah_2'] || settings['nama_sekolah_2'] || 'SMA ADVENT SOGOKMO';
  } else {
    const smpName = (settings['smp_nama_sekolah_2'] || '').trim();
    const smaName = (settings['sma_nama_sekolah_2'] || '').trim();
    if (smpName && smaName) {
      // Ringkas bila akhiran sama (mis. "SMP ADVENT SOGOKMO" & "SMA ADVENT SOGOKMO" -> "SMP & SMA ADVENT SOGOKMO")
      const smpRest = smpName.replace(/^SMP\s+/i, '').trim();
      const smaRest = smaName.replace(/^SMA\s+/i, '').trim();
      sekolah =
        smpRest && smpRest.toLowerCase() === smaRest.toLowerCase()
          ? `SMP & SMA ${smpRest}`
          : `${smpName} & ${smaName}`;
    } else {
      sekolah = settings['nama_sekolah_2'] || 'SMP & SMA ADVENT SOGOKMO';
    }
  }

  const alamat =
    settings['alamat_sekolah'] ||
    'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya - Papua';

  const npsnSmp = (settings['smp_npsn'] || '').trim();
  const npsnSma = (settings['sma_npsn'] || '').trim();
  const npsnLine =
    unit === 'SMP'
      ? npsnSmp
        ? `NPSN: ${npsnSmp}`
        : ''
      : unit === 'SMA'
      ? npsnSma
        ? `NPSN: ${npsnSma}`
        : ''
      : npsnSmp && npsnSma
      ? `NPSN SMP: ${npsnSmp} • NPSN SMA: ${npsnSma}`
      : npsnSma
      ? `NPSN: ${npsnSma}`
      : npsnSmp
      ? `NPSN: ${npsnSmp}`
      : '';

  const logoKiri =
    (prefix ? settings[`${prefix}logo_kiri_url`] : '') ||
    settings['sma_logo_kiri_url'] ||
    settings['smp_logo_kiri_url'] ||
    settings['logo_kiri_url'] ||
    '/logo/logo_advent.png';
  const logoKanan =
    (prefix ? settings[`${prefix}logo_kanan_url`] : '') ||
    settings['sma_logo_kanan_url'] ||
    settings['smp_logo_kanan_url'] ||
    settings['logo_kanan_url'] ||
    '/logo/tut_wuri.png';

  const logoBox = compact ? 'w-[44px] h-[44px]' : 'w-[58px] h-[58px]';

  return (
    <div className={`border-b-[2.5px] border-black ${compact ? 'pb-1 mb-2.5' : 'pb-1.5 mb-3.5'} font-serif`}>
      <div className={`border-b border-black ${compact ? 'pb-1' : 'pb-1.5'} flex items-center justify-between gap-3`}>
        <div className={`${logoBox} flex items-center justify-center shrink-0`}>
          <KeuanganLogo
            src={logoKiri}
            defaultSrc={withBasePath('/logo/logo_advent.png')}
            alt="Logo Sekolah"
            sizeClass={logoBox}
          />
        </div>

        <div className="flex-1 text-center leading-tight min-w-0">
          <div
            className={`${
              compact ? 'text-[8.5px]' : 'text-[10px]'
            } font-bold uppercase tracking-[0.06em] text-black`}
          >
            {yayasan}
          </div>
          <div
            className={`${
              compact ? 'text-[10.5px]' : 'text-[12px]'
            } font-black uppercase tracking-[0.03em] text-black mt-0.5`}
          >
            {akademi}
          </div>
          <div
            className={`${
              compact ? 'text-[13.5px]' : 'text-[15.5px]'
            } font-black uppercase tracking-[0.03em] text-black`}
          >
            {sekolah}
          </div>
          <div
            className={`${
              compact ? 'text-[8px]' : 'text-[8.5px]'
            } italic text-slate-900 mt-0.5`}
          >
            {alamat}
            {npsnLine ? ` • ${npsnLine}` : ''}
          </div>
        </div>

        <div className={`${logoBox} flex items-center justify-center shrink-0`}>
          <KeuanganLogo
            src={logoKanan}
            defaultSrc={withBasePath('/logo/tut_wuri.png')}
            alt="Logo Tut Wuri Handayani"
            sizeClass={logoBox}
          />
        </div>
      </div>
    </div>
  );
}
