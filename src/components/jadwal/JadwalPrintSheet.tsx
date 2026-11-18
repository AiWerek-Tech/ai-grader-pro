'use client';

import React, { useMemo, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { buildImageFallbackCandidates } from '@/lib/utils';
import { JadwalUjianUnitConfig, resolveJadwalSigner } from '@/lib/jadwal-ujian-utils';

function JadwalLogo({
  src,
  defaultSrc,
  alt,
}: {
  src?: string;
  defaultSrc: string;
  alt: string;
}) {
  const candidates = useMemo(() => buildImageFallbackCandidates(src, defaultSrc), [src, defaultSrc]);
  const [idx, setIdx] = useState(0);
  const [prevKey, setPrevKey] = useState(`${src || ''}|${defaultSrc}`);

  const currentKey = `${src || ''}|${defaultSrc}`;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setIdx(0);
  }

  const activeUrl = candidates[idx] || '';
  if (!activeUrl) return <div className="w-[62px] h-[62px] shrink-0" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => i + 1)}
      className="max-w-[62px] max-h-[62px] w-auto h-auto object-contain select-none shrink-0"
    />
  );
}

function JadwalSignatureImage({ src }: { src?: string }) {
  const candidates = useMemo(() => buildImageFallbackCandidates(src, ''), [src]);
  const [idx, setIdx] = useState(0);
  const [prevSrc, setPrevSrc] = useState(src || '');

  if ((src || '') !== prevSrc) {
    setPrevSrc(src || '');
    setIdx(0);
  }

  const activeUrl = candidates[idx] || '';
  if (!activeUrl) return <div className="h-14" />;

  return (
    <div className="h-14 flex items-center justify-center -my-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeUrl}
        alt="Tanda Tangan"
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
        className="max-h-14 max-w-[140px] w-auto h-auto object-contain mix-blend-multiply select-none"
      />
    </div>
  );
}

interface JadwalPrintSheetProps {
  config: JadwalUjianUnitConfig;
  settings: Record<string, string>;
  rootId?: string;
  className?: string;
}

/**
 * Lembar Cetak A4 Resmi Jadwal Ujian (SMP / SMA) sesuai format surat sekolah.
 */
export default function JadwalPrintSheet({
  config,
  settings = {},
  rootId = 'jadwal-print-root',
  className = '',
}: JadwalPrintSheetProps) {
  const prefix = config.unit === 'SMP' ? 'smp_' : 'sma_';
  const namaYayasan = settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
  const sekolah1 =
    settings[`${prefix}nama_sekolah_1`] ||
    settings['nama_sekolah_1'] ||
    'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
  const sekolah2 =
    settings[`${prefix}nama_sekolah_2`] ||
    settings['nama_sekolah_2'] ||
    (config.unit === 'SMP' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO');
  const alamat =
    settings['alamat_sekolah'] ||
    'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya - Papua';

  const logoKiri = settings[`${prefix}logo_kiri_url`] || settings['logo_kiri_url'] || '/logo/logo_advent.png';
  const logoKanan = settings[`${prefix}logo_kanan_url`] || settings['logo_kanan_url'] || '/logo/tut_wuri.png';

  const columns = config.columns.length > 0 ? config.columns : ['KELAS'];
  const totalTableCols = 1 + columns.length + 2; // HARI/TANGGAL + columns + WAKTU + KET
  const signer = resolveJadwalSigner(config, settings);

  return (
    <div
      id={rootId}
      className={`bg-white text-black w-full max-w-[200mm] mx-auto p-6 sm:p-7 print:p-0 print:max-w-none font-serif ${className}`}
    >
      {/* 1. KOP SURAT RESMI SEKOLAH */}
      <div className="border-b-[2.5px] border-black pb-2 mb-3">
        <div className="border-b border-black pb-2 flex items-center justify-between gap-3">
          <div className="w-[62px] h-[62px] flex items-center justify-center shrink-0">
            <JadwalLogo
              src={logoKiri}
              defaultSrc={withBasePath('/logo/logo_advent.png')}
              alt="Logo Sekolah"
            />
          </div>

          <div className="flex-1 text-center leading-tight">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black">
              {namaYayasan}
            </div>
            <div className="text-[12.5px] font-black uppercase tracking-[0.03em] text-black mt-0.5">
              {sekolah1}
            </div>
            <div className="text-[16px] font-black uppercase tracking-[0.03em] text-black">
              {sekolah2}
            </div>
            <div className="text-[9px] italic text-slate-900 mt-0.5">{alamat}</div>
          </div>

          <div className="w-[62px] h-[62px] flex items-center justify-center shrink-0">
            <JadwalLogo
              src={logoKanan}
              defaultSrc={withBasePath('/logo/tut_wuri.png')}
              alt="Logo Tut Wuri"
            />
          </div>
        </div>
      </div>

      {/* 2. JUDUL JADWAL UJIAN */}
      <div className="text-center mb-3.5 leading-snug">
        <h2 className="text-[13.5px] font-black uppercase tracking-[0.03em] text-black">
          {config.judulUjian}
        </h2>
        <div className="text-[12px] font-black uppercase tracking-[0.03em] text-black">
          {config.subJudul}
        </div>
      </div>

      {/* 3. TABEL MATRIKS JADWAL UJIAN */}
      <table className="w-full border-collapse border-[1.2px] border-black text-[10px] text-black">
        <thead>
          <tr className="bg-slate-100/80 font-black uppercase text-center">
            <th
              rowSpan={2}
              className="border border-black py-1.5 px-2 w-[23%] align-middle"
            >
              HARI/TANGGAL
            </th>
            <th
              colSpan={columns.length}
              className="border border-black py-1 px-2 text-center"
            >
              MATA PELAJARAN
            </th>
            <th
              rowSpan={2}
              className="border border-black py-1.5 px-2 w-[14%] align-middle"
            >
              WAKTU
            </th>
            <th
              rowSpan={2}
              className="border border-black py-1.5 px-1.5 w-[7%] align-middle"
            >
              KET.
            </th>
          </tr>
          <tr className="bg-slate-50 font-black uppercase text-center">
            {columns.map((col, idx) => (
              <th key={`${col}-${idx}`} className="border border-black py-1 px-2 text-[9.5px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {config.days.map((day, dayIdx) => {
            const slots = day.slots.length > 0 ? day.slots : [];
            const isLastDay = dayIdx === config.days.length - 1;

            return (
              <React.Fragment key={day.id || dayIdx}>
                {slots.map((slot, slotIdx) => {
                  const isFirstSlot = slotIdx === 0;
                  const isBreak = slot.type === 'BREAK';

                  return (
                    <tr key={slot.id || slotIdx}>
                      {isFirstSlot && (
                        <td
                          rowSpan={slots.length}
                          className="border border-black py-1.5 px-2 font-semibold align-middle text-left"
                        >
                          {day.hariTanggal}
                        </td>
                      )}

                      {isBreak ? (
                        <td
                          colSpan={columns.length}
                          className="border border-black py-1 px-2 text-center italic font-semibold bg-slate-50/70"
                        >
                          Istirahat
                        </td>
                      ) : (
                        columns.map((col, cIdx) => {
                          const mapelVal = String(slot.mapelByColumn?.[col] || '').trim();
                          return (
                            <td
                              key={`${col}-${cIdx}`}
                              className={`border border-black py-1 px-2 font-medium align-middle ${
                                mapelVal === '-' || mapelVal === '—' || !mapelVal
                                  ? 'text-center'
                                  : 'text-left'
                              }`}
                            >
                              {mapelVal || '-'}
                            </td>
                          );
                        })
                      )}

                      <td
                        className={`border border-black py-1 px-1.5 text-center whitespace-nowrap font-sans text-[9.5px] ${
                          isBreak ? 'italic' : 'font-medium'
                        }`}
                      >
                        {slot.waktu}
                      </td>

                      <td className="border border-black py-1 px-1.5 text-center text-[9px]">
                        {slot.ket || ''}
                      </td>
                    </tr>
                  );
                })}

                {/* Baris pemisah abu-abu solid antar hari (persis seperti contoh surat resmi) */}
                {!isLastDay && (
                  <tr>
                    <td
                      colSpan={totalTableCols}
                      className="border border-black bg-[#b0b0b0] h-[9px] p-0"
                    />
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* 4. BLOK PENGESAHAN KANAN & KETERANGAN KIRI */}
      <div className="mt-4 flex flex-col justify-between gap-3 break-inside-avoid">
        {/* Tanda Tangan Panitia / Kepala Sekolah di Kanan */}
        <div className="flex justify-end pr-4">
          <div className="text-center min-w-[190px] text-[10.5px] leading-snug">
            <p>{config.kotaTanggal}</p>
            <p className="font-bold">{signer.jabatan}</p>
            <JadwalSignatureImage src={signer.ttdUrl} />
            <p className="font-bold underline underline-offset-2 mt-0.5">
              {signer.nama || '........................................'}
            </p>
            {signer.nip && (
              <p className="text-[9px] text-slate-800 mt-0.5">NIP. {signer.nip}</p>
            )}
          </div>
        </div>

        {/* Catatan / Keterangan di Kiri Bawah */}
        {config.keteranganLines && config.keteranganLines.length > 0 && (
          <div className="text-[10px] leading-relaxed text-black mt-1">
            <p className="font-bold italic mb-0.5">Keterangan :</p>
            <ol className="list-decimal list-inside italic space-y-0.5 pl-1">
              {config.keteranganLines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
