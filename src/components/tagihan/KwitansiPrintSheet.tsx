'use client';

import React from 'react';
import {
  formatDateIdShort,
  formatRupiah,
  KeuanganConfig,
  PembayaranRecord,
  StudentExamEligibility,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import type { TagihanStudentItem } from '@/lib/actions/tagihan';
import { KeuanganKopSurat, KeuanganSignatureImg } from './KeuanganKopSurat';

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

function SingleKwitansiCard({
  kwitansi,
  config,
  settings,
  academicSession,
  copyLabel,
  compact,
}: {
  kwitansi: KwitansiGroupData;
  config: KeuanganConfig;
  settings: Record<string, string>;
  academicSession: { tahunAjaran: string; semester: string };
  copyLabel: string;
  compact: boolean;
}) {
  const kota = settings['kota_sekolah'] || 'Sogokmo';
  const isLunas = kwitansi.eligibility?.status === 'LUNAS';
  const isLayak = kwitansi.eligibility?.eligibleForExamCard;

  const bendaharaName = config.bendaharaNama.trim();
  const kasirName = (kwitansi.namaPetugas || '').trim();
  const showSeparateKasir =
    Boolean(bendaharaName) &&
    Boolean(kasirName) &&
    kasirName.toLowerCase() !== bendaharaName.toLowerCase();

  return (
    <div
      className={`bg-white text-slate-900 border border-slate-500 rounded-md box-border flex flex-col justify-between ${
        compact ? 'p-4' : 'p-6'
      }`}
      style={{
        minHeight: compact ? '132mm' : undefined,
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      }}
    >
      <div>
        {/* Kop Sekolah Resmi (Standar WMVAA) */}
        <KeuanganKopSurat unit={kwitansi.student.jenjang} settings={settings} compact={compact} />

        {/* Judul Kwitansi & Nomor */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`${compact ? 'text-sm' : 'text-base'} font-black uppercase tracking-wide text-black`}>
                KWITANSI PEMBAYARAN BIAYA SEKOLAH
              </h2>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-slate-400 text-slate-700 bg-slate-50">
                {copyLabel}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-600 font-semibold">
              Tahun Ajaran {academicSession.tahunAjaran} • Semester {academicSession.semester}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-block px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-black">
              NO: {kwitansi.noKwitansi}
            </div>
            <div className="text-[10px] font-semibold text-slate-600 mt-0.5">
              {formatDateIdShort(kwitansi.tanggalBayar)} • {kwitansi.metode}
            </div>
          </div>
        </div>

        {/* Identitas Siswa & Status Kelayakan */}
        <div className="grid grid-cols-12 gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-300 text-[11px] mb-2.5">
          <div className="col-span-7 space-y-0.5">
            <div className="flex gap-1.5">
              <span className="w-24 text-slate-500 font-semibold shrink-0">Telah terima dari</span>
              <span className="font-black text-black uppercase">: {kwitansi.student.nama}</span>
            </div>
            <div className="flex gap-1.5">
              <span className="w-24 text-slate-500 font-semibold shrink-0">NIS / Kelas</span>
              <span className="font-bold text-slate-900">
                : {kwitansi.student.nis || '-'} • {kwitansi.student.nama_kelas} ({kwitansi.student.jenjang})
              </span>
            </div>
          </div>
          <div className="col-span-5 text-right flex flex-col justify-center items-end">
            <div className="text-[9.5px] font-semibold text-slate-500">Status Syarat Kartu Ujian:</div>
            <span
              className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                isLunas
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
                  : isLayak
                  ? 'bg-sky-50 text-sky-800 border-sky-400'
                  : 'bg-amber-50 text-amber-800 border-amber-400'
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

        {/* Rincian Pos Pembayaran */}
        <table className="w-full border-collapse border border-slate-400 text-[10.5px] mb-2">
          <thead>
            <tr className="bg-slate-900 text-white font-bold">
              <th className="border border-slate-400 py-1 px-2 text-center w-8">No</th>
              <th className="border border-slate-400 py-1 px-2 text-left">Uraian Pembayaran</th>
              <th className="border border-slate-400 py-1 px-2 text-center w-24">Jenis</th>
              <th className="border border-slate-400 py-1 px-2 text-right w-32">Jumlah Bayar</th>
            </tr>
          </thead>
          <tbody>
            {kwitansi.items.map((item, idx) => (
              <tr key={item.payment.id_pembayaran} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                <td className="border border-slate-400 py-1 px-2 text-center font-mono">{idx + 1}</td>
                <td className="border border-slate-400 py-1 px-2 font-bold text-black">
                  {item.bill?.nama_tagihan || item.payment.id_tagihan}
                  {item.bill && item.bill.status === 'LUNAS' && (
                    <span className="ml-1.5 text-[9.5px] font-extrabold text-emerald-700">(LUNAS)</span>
                  )}
                </td>
                <td className="border border-slate-400 py-1 px-2 text-center font-semibold text-slate-600">
                  {item.bill?.kategori === 'SALDO_AWAL' ? 'TAGIHAN' : item.bill?.kategori || 'SPP'}
                </td>
                <td className="border border-slate-400 py-1 px-2 text-right font-mono font-black">
                  {formatRupiah(item.payment.nominal_bayar)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black text-xs">
              <td colSpan={3} className="border border-slate-400 py-1.5 px-2 text-right uppercase">
                Total Dibayarkan
              </td>
              <td className="border border-slate-400 py-1.5 px-2 text-right font-mono text-black">
                {formatRupiah(kwitansi.totalBayar)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Terbilang + Ringkasan Saldo */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-50 border border-slate-300 text-[10.5px] mb-2">
          <div>
            <span className="text-slate-500 font-semibold">Terbilang: </span>
            <span className="font-bold italic text-black">{terbilangId(kwitansi.totalBayar)}</span>
          </div>
          {kwitansi.eligibility && (
            <div className="flex items-center gap-3 font-bold text-slate-700">
              <span>
                Total Tagihan: <span className="font-mono text-black">{formatRupiah(kwitansi.eligibility.totalTagihan)}</span>
              </span>
              <span>
                Sisa: <span className={`font-mono ${kwitansi.eligibility.sisaTunggakan > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatRupiah(kwitansi.eligibility.sisaTunggakan)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Catatan & Pengesahan Kasir / Bendahara */}
      <div className="pt-1 space-y-1.5">
        {(kwitansi.catatan || config.catatanKwitansi) && (
          <div className="text-[9.5px] text-slate-600 leading-snug">
            {kwitansi.catatan && (
              <span>
                <strong className="text-slate-800">Catatan:</strong> {kwitansi.catatan} •{' '}
              </span>
            )}
            <span className="italic">{config.catatanKwitansi}</span>
          </div>
        )}

        <div
          className={`grid ${
            showSeparateKasir ? 'grid-cols-2' : 'grid-cols-1 justify-items-end'
          } gap-6 items-end pt-0.5`}
        >
          {showSeparateKasir && (
            <div className="text-center text-[10.5px] min-w-[165px]">
              <div className="text-slate-600 font-semibold">Diterima di Loket oleh,</div>
              <div className="font-bold text-black">Petugas Kasir,</div>
              <div className={compact ? 'h-9' : 'h-12'} />
              <div className="font-black text-black underline underline-offset-2">
                {kasirName}
              </div>
            </div>
          )}

          <div className="text-center text-[10.5px] min-w-[175px]">
            <div className="text-slate-700 font-semibold">
              {kota}, {formatDateIdShort(kwitansi.tanggalBayar)}
            </div>
            <div className="font-bold text-black">
              {showSeparateKasir ? 'Mengetahui, ' : ''}
              {config.bendaharaJabatan || 'Bendahara Sekolah'},
            </div>
            <KeuanganSignatureImg
              src={config.bendaharaTtdUrl}
              alt="TTD Bendahara"
              heightClass={compact ? 'h-10' : 'h-12'}
            />
            <div className="font-black text-black underline underline-offset-2">
              {bendaharaName || kasirName || '( ............................ )'}
            </div>
            {config.bendaharaNip && (
              <div className="text-[9px] font-mono text-slate-600">
                NIP/NRG. {config.bendaharaNip}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function KwitansiPrintSheet({
  kwitansi,
  config,
  settings,
  academicSession,
  copies = 2,
}: {
  kwitansi: KwitansiGroupData;
  config: KeuanganConfig;
  settings: Record<string, string>;
  academicSession: { tahunAjaran: string; semester: string };
  copies?: 1 | 2;
}) {
  if (copies === 1) {
    return (
      <div
        className="tagihan-print-page bg-white mx-auto box-border"
        style={{ width: '196mm', padding: '8mm 4mm' }}
      >
        <SingleKwitansiCard
          kwitansi={kwitansi}
          config={config}
          settings={settings}
          academicSession={academicSession}
          copyLabel="BUKTI PEMBAYARAN RESMI"
          compact={false}
        />
      </div>
    );
  }

  return (
    <div
      className="tagihan-print-page bg-white mx-auto box-border flex flex-col justify-between"
      style={{
        width: '204mm',
        minHeight: '286mm',
        padding: '6mm 6mm',
        gap: '4mm',
      }}
    >
      <SingleKwitansiCard
        kwitansi={kwitansi}
        config={config}
        settings={settings}
        academicSession={academicSession}
        copyLabel="LEMBAR 1 — UNTUK SISWA / ORANG TUA"
        compact
      />

      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 select-none">
        <div className="flex-1 border-t border-dashed border-slate-400" />
        <span>✂ POTONG DI SINI</span>
        <div className="flex-1 border-t border-dashed border-slate-400" />
      </div>

      <SingleKwitansiCard
        kwitansi={kwitansi}
        config={config}
        settings={settings}
        academicSession={academicSession}
        copyLabel="LEMBAR 2 — ARSIP KEUANGAN / KASIR"
        compact
      />
    </div>
  );
}
