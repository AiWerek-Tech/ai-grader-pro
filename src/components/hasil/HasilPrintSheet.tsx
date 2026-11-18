'use client';

import React, { useMemo, useState } from 'react';
import { withBasePath } from '@/lib/base-path';

const parseDriveUrl = (url?: string) => {
  if (!url) return '';
  const idMatch = url.match(/\/d\/([^/?]+)/) || url.match(/id=([^/?&]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }
  return url;
};

function PrintLogo({
  src,
  defaultSrc,
  alt,
}: {
  src?: string;
  defaultSrc: string;
  alt: string;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [hideAll, setHideAll] = useState(false);
  const primaryUrl = parseDriveUrl(src);
  const activeUrl = !useFallback && primaryUrl ? primaryUrl : defaultSrc;

  if (hideAll || !activeUrl) {
    return <div className="w-[64px] h-[64px]" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!useFallback && primaryUrl && primaryUrl !== defaultSrc) {
          setUseFallback(true);
        } else {
          setHideAll(true);
        }
      }}
      className="max-w-[64px] max-h-[64px] w-auto h-auto object-contain select-none"
    />
  );
}

interface HasilPrintSheetProps {
  items: any[];
  settings: Record<string, string>;
  filterKelas: string;
  filterKunci: string;
  selectedKunciObj?: any | null;
}

/**
 * Lembar Cetak PDF / Kertas A4 Daftar Nilai Siswa Per Kelas Ber-Kop Sekolah Resmi.
 * Otomatis mengelompokkan halaman per kelas jika filterKelas === 'ALL'.
 */
export default function HasilPrintSheet({
  items,
  settings = {},
  filterKelas,
  selectedKunciObj,
}: HasilPrintSheetProps) {
  const groups = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (filterKelas !== 'ALL') {
      return [{ kelasName: filterKelas, rows: items }];
    }
    const map = new Map<string, any[]>();
    items.forEach((h) => {
      const kls = h.kelasLabel || 'Tanpa Kelas';
      if (!map.has(kls)) map.set(kls, []);
      map.get(kls)!.push(h);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'id'))
      .map(([kelasName, rows]) => ({ kelasName, rows }));
  }, [items, filterKelas]);

  if (groups.length === 0) return null;

  const printDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const tahunAjaran = settings.tahun_ajaran || '2026/2027';

  return (
    <div id="hasil-print-root" className="hidden print:block bg-white text-black w-full">
      {groups.map((group, groupIdx) => {
        const kelasUpper = String(group.kelasName || '').toUpperCase();
        const isSmp =
          kelasUpper.includes('SMP') ||
          /^(KELAS\s+)?(VII|VIII|IX|7|8|9)\b/i.test(kelasUpper.trim());
        const jenjang = isSmp ? 'smp' : 'sma';

        const logoKiri =
          settings[`${jenjang}_logo_kiri_url`] || settings.logo_kiri_url || '/logo/logo_advent.png';
        const logoKanan =
          settings[`${jenjang}_logo_kanan_url`] || settings.logo_kanan_url || '/logo/tut_wuri.png';
        const namaYayasan = settings.nama_yayasan || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
        const sekolahBaris1 =
          settings[`${jenjang}_nama_sekolah_1`] ||
          settings.nama_sekolah_1 ||
          'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
        const sekolahBaris2 =
          settings[`${jenjang}_nama_sekolah_2`] ||
          settings.nama_sekolah_2 ||
          (jenjang === 'smp' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO');
        const alamat =
          settings.alamat_sekolah ||
          'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya';
        const namaKepsek =
          settings[`${jenjang}_kepala_nama`] ||
          settings[`${jenjang}_kepala_sekolah`] ||
          settings.nama_kepsek ||
          '';
        const nipKepsek = settings[`${jenjang}_kepala_nip`] || '';

        const firstRow = group.rows[0];
        const kInfo = selectedKunciObj || firstRow?.kInfo;
        const judulUjian = kInfo?.judul_ujian || 'Semua Asesmen Terfilter';
        const namaMapel = kInfo?.nama_mapel || firstRow?.kInfo?.nama_mapel || '—';
        const namaGuru = kInfo?.nama_guru || firstRow?.kInfo?.nama_guru || 'Guru Mata Pelajaran';
        const semStr = String(
          kInfo?.semester || firstRow?.semester || settings.semester || 'GANJIL'
        ).toUpperCase();
        const kkmVal = Number(firstRow?.kkm_referensi) || 70;

        // Urutkan siswa berdasarkan nama A-Z untuk daftar nilai resmi kelas
        const sortedRows = [...group.rows].sort((a, b) =>
          String(a.sInfo?.nama || '').localeCompare(String(b.sInfo?.nama || ''), 'id')
        );

        const scores = sortedRows.map((r) => Number(r.skor) || 0);
        const avgScore =
          scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
        const tuntasCount = sortedRows.filter((r) => (Number(r.skor) || 0) >= (Number(r.kkm_referensi) || 70)).length;
        const tidakTuntasCount = sortedRows.length - tuntasCount;
        const ketuntasanPct =
          sortedRows.length > 0 ? Math.round((tuntasCount / sortedRows.length) * 100) : 0;

        return (
          <div
            key={`${group.kelasName}-${groupIdx}`}
            className="hasil-print-page bg-white text-black w-full max-w-[190mm] mx-auto py-1 print:break-after-page last:print:break-after-auto"
          >
            {/* 1. KOP SURAT RESMI SEKOLAH */}
            <div className="border-b-[3px] border-double border-black pb-2.5 mb-3.5 flex items-center justify-between gap-4">
              <div className="w-[64px] h-[64px] flex items-center justify-center shrink-0">
                <PrintLogo
                  src={logoKiri}
                  defaultSrc={withBasePath('/logo/logo_advent.png')}
                  alt="Logo Yayasan"
                />
              </div>

              <div className="flex-1 text-center">
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-800">
                  {namaYayasan}
                </div>
                <div className="text-[13px] font-black uppercase tracking-[0.04em] text-black mt-0.5">
                  {sekolahBaris1}
                </div>
                <div className="text-[17px] font-black uppercase tracking-[0.04em] text-black leading-tight">
                  {sekolahBaris2}
                </div>
                <div className="text-[8.5px] italic text-slate-700 mt-0.5">{alamat}</div>
              </div>

              <div className="w-[64px] h-[64px] flex items-center justify-center shrink-0">
                <PrintLogo
                  src={logoKanan}
                  defaultSrc={withBasePath('/logo/tut_wuri.png')}
                  alt="Logo Sekolah"
                />
              </div>
            </div>

            {/* 2. JUDUL LAPORAN & IDENTITAS KELAS/ASESMEN */}
            <div className="text-center mb-3">
              <h2 className="text-[14px] font-black uppercase tracking-[0.14em] underline underline-offset-4">
                DAFTAR NILAI HASIL ASESMEN SISWA
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700 mt-1">
                {namaMapel && namaMapel !== '—' ? `${namaMapel} — ${judulUjian}` : judulUjian}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[9.5px] border border-black rounded px-3.5 py-2.5 mb-3.5 bg-slate-50/70">
              <div className="space-y-1">
                <div className="grid grid-cols-[92px_8px_1fr] items-start">
                  <span className="font-bold text-slate-700">Mata Pelajaran</span>
                  <span className="font-bold text-center">:</span>
                  <span className="font-black text-black">{namaMapel}</span>
                </div>
                <div className="grid grid-cols-[92px_8px_1fr] items-start">
                  <span className="font-bold text-slate-700">Kelas</span>
                  <span className="font-bold text-center">:</span>
                  <span className="font-black text-black">{group.kelasName}</span>
                </div>
                <div className="grid grid-cols-[92px_8px_1fr] items-start">
                  <span className="font-bold text-slate-700">Guru Pengampu</span>
                  <span className="font-bold text-center">:</span>
                  <span className="font-semibold text-black">{namaGuru}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-[112px_8px_1fr] items-start">
                  <span className="font-bold text-slate-700">Tahun Ajaran / Smt</span>
                  <span className="font-bold text-center">:</span>
                  <span className="font-black text-black">
                    {tahunAjaran} ({semStr === 'GENAP' ? 'Genap' : 'Ganjil'})
                  </span>
                </div>
                <div className="grid grid-cols-[112px_8px_1fr] items-start">
                  <span className="font-bold text-slate-700">KKM / Ketuntasan</span>
                  <span className="font-bold text-center">:</span>
                  <span className="font-black text-black">
                    {kkmVal} ({ketuntasanPct}% Tuntas — {tuntasCount}/{sortedRows.length} Siswa)
                  </span>
                </div>
                <div className="grid grid-cols-[112px_8px_1fr] items-start">
                  <span className="font-bold text-slate-700">Rata-Rata / Nilai</span>
                  <span className="font-bold text-center">:</span>
                  <span className="font-black text-black">
                    {avgScore} (Tertinggi: {maxScore} · Terendah: {minScore})
                  </span>
                </div>
              </div>
            </div>

            {/* 3. TABEL NILAI SISWA */}
            <table className="w-full table-fixed border-collapse border border-black text-[9.5px] mb-5">
              <thead className="table-header-group">
                <tr className="bg-slate-200 text-black font-black uppercase text-[8.5px]">
                  <th className="border border-black py-2 px-1 text-center w-[5%]">No</th>
                  <th className="border border-black py-2 px-1.5 text-center w-[9%]">NIS</th>
                  <th className="border border-black py-2 px-2.5 text-left w-[31%]">Nama Lengkap Siswa</th>
                  <th className="border border-black py-2 px-1.5 text-center w-[11%]">Kelas</th>
                  <th className="border border-black py-2 px-1 text-center w-[6%]">Benar</th>
                  <th className="border border-black py-2 px-1 text-center w-[6%]">Salah</th>
                  <th className="border border-black py-2 px-1 text-center w-[6.5%]">Kosong</th>
                  <th className="border border-black py-2 px-1 text-center w-[6.5%]">Nilai</th>
                  <th className="border border-black py-2 px-1 text-center w-[7%]">Predikat</th>
                  <th className="border border-black py-2 px-1.5 text-center w-[12%]">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((h, idx) => {
                  const skorNum = Number(h.skor) || 0;
                  const kkmNum = Number(h.kkm_referensi) || 70;
                  const lulus = skorNum >= kkmNum;
                  const predikat =
                    skorNum >= 90 ? 'A' : skorNum >= 80 ? 'B' : skorNum >= kkmNum ? 'C' : 'D';

                  return (
                    <tr key={h.id_hasil || idx} className="even:bg-slate-50/70 break-inside-avoid">
                      <td className="border border-black py-1.5 px-1 text-center font-bold">
                        {idx + 1}
                      </td>
                      <td className="border border-black py-1.5 px-1.5 text-center font-mono whitespace-nowrap">
                        {h.sInfo?.nis || '—'}
                      </td>
                      <td className="border border-black py-1.5 px-2.5 font-bold uppercase text-left leading-snug">
                        {h.sInfo?.nama || h.id_siswa}
                      </td>
                      <td className="border border-black py-1.5 px-1.5 text-center whitespace-nowrap">
                        {h.kelasLabel || '—'}
                      </td>
                      <td className="border border-black py-1.5 px-1 text-center">
                        {h.det?.benar ?? 0}
                      </td>
                      <td className="border border-black py-1.5 px-1 text-center">
                        {h.det?.salah ?? 0}
                      </td>
                      <td className="border border-black py-1.5 px-1 text-center">
                        {h.det?.tidak_dijawab ?? 0}
                      </td>
                      <td className="border border-black py-1.5 px-1 text-center font-black text-[10.5px]">
                        {skorNum}
                      </td>
                      <td className="border border-black py-1.5 px-1 text-center font-bold">
                        {predikat}
                      </td>
                      <td
                        className={`border border-black py-1.5 px-1.5 text-center font-black text-[8.5px] whitespace-nowrap ${
                          lulus ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                      >
                        {lulus ? 'TUNTAS' : 'TIDAK TUNTAS'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-[9px] break-inside-avoid">
                  <td colSpan={7} className="border border-black py-2 px-2.5 text-right uppercase tracking-wide">
                    Rata-Rata Kelas ({sortedRows.length} Siswa) • Tuntas: {tuntasCount} • Tidak Tuntas: {tidakTuntasCount}
                  </td>
                  <td className="border border-black py-2 px-1 text-center text-[10.5px]">
                    {avgScore}
                  </td>
                  <td colSpan={2} className="border border-black py-2 px-2 text-center whitespace-nowrap">
                    {ketuntasanPct}% Tuntas
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* 4. BLOK TANDA TANGAN PENGESAHAN */}
            <div className="grid grid-cols-2 gap-10 text-[10px] mt-6 pt-2 break-inside-avoid">
              <div className="text-center">
                <p>Mengetahui,</p>
                <p className="font-bold">Kepala {sekolahBaris2}</p>
                <div className="h-16" />
                {namaKepsek ? (
                  <>
                    <p className="font-black underline underline-offset-2">{namaKepsek}</p>
                    {nipKepsek && (
                      <p className="text-[9px] font-mono text-slate-700 mt-0.5">
                        NIP/NRG. {nipKepsek}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-bold text-slate-600">( ........................................ )</p>
                )}
              </div>
              <div className="text-center">
                <p>Wamena, {printDate}</p>
                <p className="font-bold">Guru Mata Pelajaran</p>
                <div className="h-16" />
                <p className="font-black underline underline-offset-2">{namaGuru}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
