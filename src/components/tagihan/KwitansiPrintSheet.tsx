'use client';

import React from 'react';
import { withBasePath } from '@/lib/base-path';
import {
  formatDateIdShort,
  formatRupiah,
  KeuanganConfig,
  PembayaranRecord,
  StudentExamEligibility,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import type { TagihanStudentItem } from '@/lib/actions/tagihan';

export interface KwitansiGroupData {
  noKwitansi: string;
  tanggalBayar: string;
  metode: string;
  namaPetugas: string;
  catatan: string;
  student: TagihanStudentItem;
  items: Array<{
    payment: PembayaranRecord;
    bill?: TagihanRecord;
  }>;
  totalBayar: number;
  eligibility?: StudentExamEligibility;
}

function terbilangId(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num === 0) return 'Nol';
  const satuan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas',
  ];
  const helper = (x: number): string => {
    if (x < 12) return satuan[x];
    if (x < 20) return `${helper(x - 10)} Belas`;
    if (x < 100) return `${helper(Math.floor(x / 10))} Puluh${x % 10 ? ` ${helper(x % 10)}` : ''}`;
    if (x < 200) return `Seratus${x - 100 ? ` ${helper(x - 100)}` : ''}`;
    if (x < 1000) return `${helper(Math.floor(x / 100))} Ratus${x % 100 ? ` ${helper(x % 100)}` : ''}`;
    if (x < 2000) return `Seribu${x - 1000 ? ` ${helper(x - 1000)}` : ''}`;
    if (x < 1000000) return `${helper(Math.floor(x / 1000))} Ribu${x % 1000 ? ` ${helper(x % 1000)}` : ''}`;
    if (x < 1000000000) return `${helper(Math.floor(x / 1000000))} Juta${x % 1000000 ? ` ${helper(x % 1000000)}` : ''}`;
    return `${helper(Math.floor(x / 1000000000))} Miliar${x % 1000000000 ? ` ${helper(x % 1000000000)}` : ''}`;
  };
  return `${helper(num)} Rupiah`.replace(/\s+/g, ' ').trim();
}

export function KwitansiPrintSheet({
  kwitansi,
  config,
  settings,
  academicSession,
}: {
  kwitansi: KwitansiGroupData;
  config: KeuanganConfig;
  settings: Record<string, string>;
  academicSession: { tahunAjaran: string; semester: string };
}) {
  const prefix = kwitansi.student.jenjang === 'SMP' ? 'smp_' : 'sma_';
  const yayasan = settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
  const akademi =
    settings[prefix + 'nama_sekolah_1'] ||
    settings['nama_sekolah_1'] ||
    'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
  const sekolah =
    settings[prefix + 'nama_sekolah_2'] ||
    settings['nama_sekolah_2'] ||
    (kwitansi.student.jenjang === 'SMP' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO');
  const alamat =
    settings['alamat_sekolah'] ||
    'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya';
  const kota = settings['kota_sekolah'] || 'Sogokmo';
  const logoKiri = settings[prefix + 'logo_kiri_url'] || settings['logo_kiri_url'] || withBasePath('/logo/logo_advent.png');
  const logoKanan = settings[prefix + 'logo_kanan_url'] || settings['logo_kanan_url'] || withBasePath('/logo/tut_wuri.png');

  const isLunas = kwitansi.eligibility?.status === 'LUNAS';
  const isLayak = kwitansi.eligibility?.eligibleForExamCard;

  return (
    <div
      className="bg-white text-slate-900 mx-auto border border-slate-400 rounded-lg p-6 box-border"
      style={{
        width: '190mm',
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      }}
    >
      {/* Kop Sekolah */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-slate-900 pb-3 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoKiri} alt="Logo" className="w-14 h-14 object-contain shrink-0" />
        <div className="flex-1 text-center leading-tight">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            {yayasan}
          </div>
          <div className="text-xs font-black uppercase tracking-tight text-slate-900">
            {akademi}
          </div>
          <div className="text-base font-black uppercase text-slate-950">{sekolah}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{alamat}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoKanan} alt="Logo Kemendikbud" className="w-14 h-14 object-contain shrink-0" />
      </div>

      {/* Judul Kwitansi & Nomor */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-slate-950">
            KWITANSI PEMBAYARAN BIAYA SEKOLAH
          </h2>
          <p className="text-xs text-slate-600 font-semibold">
            Tahun Ajaran {academicSession.tahunAjaran} • Semester {academicSession.semester}
          </p>
        </div>
        <div className="text-right">
          <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white font-mono text-xs font-black">
            NO: {kwitansi.noKwitansi}
          </div>
          <div className="text-[11px] font-semibold text-slate-600 mt-1">
            Tanggal: {formatDateIdShort(kwitansi.tanggalBayar)} • Metode: {kwitansi.metode}
          </div>
        </div>
      </div>

      {/* Identitas Siswa */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs mb-4">
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="w-24 text-slate-500 font-semibold">Telah terima dari</span>
            <span className="font-black text-slate-950 uppercase">: {kwitansi.student.nama}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-24 text-slate-500 font-semibold">NIS / Kelas</span>
            <span className="font-bold text-slate-900">
              : {kwitansi.student.nis || '-'} • {kwitansi.student.nama_kelas} ({kwitansi.student.jenjang})
            </span>
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-[11px] font-semibold text-slate-500">Status Syarat Kartu Ujian:</div>
          <div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                isLunas
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : isLayak
                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {isLunas
                ? 'LUNAS 100% — LAYAK KARTU UJIAN'
                : isLayak
                ? `LAYAK KARTU UJIAN (${kwitansi.eligibility?.persentaseTerbayar ?? 0}%)`
                : `CICILAN (${kwitansi.eligibility?.persentaseTerbayar ?? 0}%)`}
            </span>
          </div>
        </div>
      </div>

      {/* Rincian Pos Pembayaran */}
      <table className="w-full border-collapse border border-slate-300 text-xs mb-3">
        <thead>
          <tr className="bg-slate-900 text-white font-bold">
            <th className="border border-slate-300 py-1.5 px-2 text-center w-10">No</th>
            <th className="border border-slate-300 py-1.5 px-2.5 text-left">Uraian Tagihan</th>
            <th className="border border-slate-300 py-1.5 px-2 text-center w-24">Kategori</th>
            <th className="border border-slate-300 py-1.5 px-2.5 text-right w-36">Jumlah Bayar</th>
          </tr>
        </thead>
        <tbody>
          {kwitansi.items.map((item, idx) => (
            <tr key={item.payment.id_pembayaran} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
              <td className="border border-slate-300 py-1.5 px-2 text-center font-mono">{idx + 1}</td>
              <td className="border border-slate-300 py-1.5 px-2.5 font-bold text-slate-900">
                {item.bill?.nama_tagihan || item.payment.id_tagihan}
                {item.bill && item.bill.status === 'LUNAS' && (
                  <span className="ml-2 text-[10px] font-extrabold text-emerald-700">(LUNAS)</span>
                )}
              </td>
              <td className="border border-slate-300 py-1.5 px-2 text-center font-semibold text-slate-600">
                {item.bill?.kategori || 'SPP'}
              </td>
              <td className="border border-slate-300 py-1.5 px-2.5 text-right font-mono font-black">
                {formatRupiah(item.payment.nominal_bayar)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-black text-sm">
            <td colSpan={3} className="border border-slate-300 py-2 px-2.5 text-right uppercase">
              Total Dibayarkan
            </td>
            <td className="border border-slate-300 py-2 px-2.5 text-right font-mono text-slate-950">
              {formatRupiah(kwitansi.totalBayar)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Terbilang + Sisa Tunggakan */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded bg-slate-50 border border-slate-200 text-xs mb-4">
        <div>
          <span className="text-slate-500 font-semibold">Terbilang: </span>
          <span className="font-bold italic text-slate-900">{terbilangId(kwitansi.totalBayar)}</span>
        </div>
        {kwitansi.eligibility && (
          <div className="font-bold text-slate-700">
            Sisa Tagihan Periode: <span className="font-mono text-slate-950">{formatRupiah(kwitansi.eligibility.sisaTunggakan)}</span>
          </div>
        )}
      </div>

      {/* Footer Catatan & Pengesahan Kasir / Bendahara */}
      {(() => {
        const bendaharaName = config.bendaharaNama.trim();
        const kasirName = (kwitansi.namaPetugas || '').trim();
        const showSeparateKasir =
          Boolean(bendaharaName) &&
          Boolean(kasirName) &&
          kasirName.toLowerCase() !== bendaharaName.toLowerCase();

        return (
          <div className="pt-2 space-y-3">
            {(kwitansi.catatan || config.catatanKwitansi) && (
              <div className="text-[10px] text-slate-600 space-y-0.5">
                {kwitansi.catatan && (
                  <p>
                    <strong className="text-slate-800">Catatan:</strong> {kwitansi.catatan}
                  </p>
                )}
                <p className="italic">{config.catatanKwitansi}</p>
              </div>
            )}

            <div
              className={`grid ${
                showSeparateKasir ? 'grid-cols-2' : 'grid-cols-1 justify-items-end'
              } gap-6 items-end pt-1`}
            >
              {showSeparateKasir && (
                <div className="text-center text-xs min-w-[170px]">
                  <div className="text-slate-600 font-semibold">Diterima di Loket oleh,</div>
                  <div className="font-bold text-slate-900 mt-0.5">Petugas Kasir,</div>
                  <div className="h-12" />
                  <div className="font-black text-slate-950 underline underline-offset-2">
                    {kasirName}
                  </div>
                </div>
              )}

              <div className="text-center text-xs min-w-[180px]">
                <div className="text-slate-700 font-semibold">
                  {kota}, {formatDateIdShort(kwitansi.tanggalBayar)}
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {showSeparateKasir ? 'Mengetahui, ' : ''}
                  {config.bendaharaJabatan || 'Bendahara Sekolah'},
                </div>
                {config.bendaharaTtdUrl ? (
                  <div className="h-14 flex items-center justify-center my-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={config.bendaharaTtdUrl}
                      alt="TTD Bendahara"
                      className="max-h-14 w-auto object-contain mix-blend-multiply"
                    />
                  </div>
                ) : (
                  <div className="h-12" />
                )}
                <div className="font-black text-slate-950 underline underline-offset-2">
                  {bendaharaName || kasirName || '( ............................ )'}
                </div>
                {config.bendaharaNip && (
                  <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                    NIP/NRG. {config.bendaharaNip}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
