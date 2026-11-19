'use client';

import React from 'react';
import { withBasePath } from '@/lib/base-path';
import {
  formatDateIdShort,
  formatRupiah,
  getTodayYmd,
  KeuanganConfig,
  PembayaranRecord,
  StudentExamEligibility,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import type { TagihanKelasItem, TagihanStudentItem } from '@/lib/actions/tagihan';

export type LaporanKeuanganMode = 'KAS_MASUK' | 'REKAP_KELAS' | 'KESIAPAN_UJIAN';

export function LaporanKeuanganSheet({
  mode,
  dateFrom,
  dateTo,
  jenjangFilter,
  students,
  kelasList,
  bills,
  payments,
  eligibilityMap,
  config,
  settings,
  academicSession,
}: {
  mode: LaporanKeuanganMode;
  dateFrom: string;
  dateTo: string;
  jenjangFilter: 'ALL' | 'SMP' | 'SMA';
  students: TagihanStudentItem[];
  kelasList: TagihanKelasItem[];
  bills: TagihanRecord[];
  payments: PembayaranRecord[];
  eligibilityMap: Record<string, StudentExamEligibility>;
  config: KeuanganConfig;
  settings: Record<string, string>;
  academicSession: { tahunAjaran: string; semester: string };
}) {
  const today = getTodayYmd();
  const prefix = jenjangFilter === 'SMP' ? 'smp_' : jenjangFilter === 'SMA' ? 'sma_' : '';
  const yayasan = settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
  const akademi =
    (prefix ? settings[prefix + 'nama_sekolah_1'] : '') ||
    settings['nama_sekolah_1'] ||
    'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
  const sekolah =
    (prefix ? settings[prefix + 'nama_sekolah_2'] : '') ||
    settings['nama_sekolah_2'] ||
    'SMP & SMA ADVENT SOGOKMO';
  const alamat =
    settings['alamat_sekolah'] ||
    'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya';
  const kota = settings['kota_sekolah'] || 'Sogokmo';
  const logoKiri = settings['logo_kiri_url'] || withBasePath('/logo/logo_advent.png');
  const logoKanan = settings['logo_kanan_url'] || withBasePath('/logo/tut_wuri.png');

  const kepalaNama =
    jenjangFilter === 'SMP'
      ? settings['smp_kepala_nama'] || settings['kepala_nama'] || ''
      : jenjangFilter === 'SMA'
      ? settings['sma_kepala_nama'] || settings['kepala_nama'] || ''
      : settings['kepala_nama'] || settings['sma_kepala_nama'] || settings['smp_kepala_nama'] || '';
  const kepalaTtd =
    jenjangFilter === 'SMP'
      ? settings['smp_kepala_ttd_url'] || ''
      : jenjangFilter === 'SMA'
      ? settings['sma_kepala_ttd_url'] || ''
      : '';

  const filteredStudents = students.filter(
    (s) => jenjangFilter === 'ALL' || s.jenjang === jenjangFilter
  );
  const studentMap = new Map(students.map((s) => [s.id_siswa, s]));
  const billMap = new Map(bills.map((b) => [b.id_tagihan, b]));

  // Data untuk KAS_MASUK
  const validPayments = payments.filter((p) => {
    if (p.status_transaksi !== 'VALID') return false;
    const stu = studentMap.get(p.id_siswa);
    if (jenjangFilter !== 'ALL' && stu?.jenjang !== jenjangFilter) return false;
    if (dateFrom && p.tanggal_bayar < dateFrom) return false;
    if (dateTo && p.tanggal_bayar > dateTo) return false;
    return true;
  });
  const totalTunai = validPayments
    .filter((p) => p.metode === 'TUNAI')
    .reduce((acc, p) => acc + p.nominal_bayar, 0);
  const totalTransfer = validPayments
    .filter((p) => p.metode === 'TRANSFER')
    .reduce((acc, p) => acc + p.nominal_bayar, 0);
  const totalLain = validPayments
    .filter((p) => p.metode === 'LAINNYA')
    .reduce((acc, p) => acc + p.nominal_bayar, 0);
  const totalKasMasuk = totalTunai + totalTransfer + totalLain;

  // Data untuk REKAP_KELAS
  const filteredKelas = kelasList.filter(
    (k) => jenjangFilter === 'ALL' || k.jenjang === jenjangFilter
  );
  const kelasSummary = filteredKelas.map((k) => {
    const kStudents = filteredStudents.filter((s) => s.id_kelas === k.id_kelas);
    let totalTagihan = 0;
    let totalTerbayar = 0;
    let totalSisa = 0;
    let layakCount = 0;
    let lunasCount = 0;
    let dispensasiCount = 0;
    let belumLayakCount = 0;

    for (const st of kStudents) {
      const el = eligibilityMap[st.id_siswa];
      if (!el) continue;
      totalTagihan += el.totalTagihan;
      totalTerbayar += el.totalTerbayar;
      totalSisa += el.sisaTunggakan;
      if (el.status === 'LUNAS') lunasCount++;
      if (el.status === 'DISPENSASI') dispensasiCount++;
      if (el.eligibleForExamCard) layakCount++;
      else belumLayakCount++;
    }
    const pct = totalTagihan > 0 ? Math.round((totalTerbayar / totalTagihan) * 1000) / 10 : 0;
    return {
      kelas: k,
      studentCount: kStudents.length,
      totalTagihan,
      totalTerbayar,
      totalSisa,
      pct,
      lunasCount,
      layakCount,
      dispensasiCount,
      belumLayakCount,
    };
  });

  const grandTagihan = kelasSummary.reduce((a, b) => a + b.totalTagihan, 0);
  const grandTerbayar = kelasSummary.reduce((a, b) => a + b.totalTerbayar, 0);
  const grandSisa = kelasSummary.reduce((a, b) => a + b.totalSisa, 0);
  const grandPct = grandTagihan > 0 ? Math.round((grandTerbayar / grandTagihan) * 1000) / 10 : 0;
  const grandLayak = kelasSummary.reduce((a, b) => a + b.layakCount, 0);
  const grandBelumLayak = kelasSummary.reduce((a, b) => a + b.belumLayakCount, 0);

  const reportTitle =
    mode === 'KAS_MASUK'
      ? 'LAPORAN PEMASUKAN KAS BIAYA SEKOLAH'
      : mode === 'REKAP_KELAS'
      ? 'REKAPITULASI TAGIHAN & TUNGGAKAN PER KELAS'
      : 'LAPORAN KESIAPAN ADMINISTRASI KARTU PESERTA UJIAN';

  return (
    <div
      className="tagihan-print-page bg-white text-slate-900 mx-auto box-border"
      style={{
        width: '210mm',
        minHeight: '295mm',
        padding: '12mm 14mm',
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      }}
    >
      {/* Kop Resmi */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-slate-900 pb-3 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoKiri} alt="Logo" className="w-14 h-14 object-contain shrink-0" />
        <div className="flex-1 text-center leading-tight">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{yayasan}</div>
          <div className="text-xs font-black uppercase text-slate-900">{akademi}</div>
          <div className="text-base font-black uppercase text-slate-950">{sekolah}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{alamat}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoKanan} alt="Logo Kemendikbud" className="w-14 h-14 object-contain shrink-0" />
      </div>

      {/* Judul Laporan */}
      <div className="text-center mb-4">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-950">{reportTitle}</h2>
        <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
          Tahun Ajaran {academicSession.tahunAjaran} • Semester {academicSession.semester}
          {jenjangFilter !== 'ALL' ? ` • Unit ${jenjangFilter}` : ' • Semua Unit (SMP & SMA)'}
          {mode === 'KAS_MASUK' && (dateFrom || dateTo)
            ? ` • Periode ${formatDateIdShort(dateFrom)} s.d. ${formatDateIdShort(dateTo)}`
            : ''}
        </p>
      </div>

      {mode === 'KAS_MASUK' && (
        <>
          <div className="grid grid-cols-3 gap-2.5 mb-4 text-xs">
            <div className="p-2.5 rounded border border-slate-300 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Total Tunai</div>
              <div className="text-sm font-black font-mono text-slate-950 mt-0.5">
                {formatRupiah(totalTunai)}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-300 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Total Transfer</div>
              <div className="text-sm font-black font-mono text-slate-950 mt-0.5">
                {formatRupiah(totalTransfer)}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-900 bg-slate-900 text-white">
              <div className="text-[10px] font-bold uppercase opacity-80">Total Kas Masuk</div>
              <div className="text-sm font-black font-mono mt-0.5">
                {formatRupiah(totalKasMasuk)}
              </div>
            </div>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="border border-slate-300 py-1.5 px-1.5 text-center w-8">No</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left w-24">Tanggal</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left w-28">No. Kwitansi</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">Siswa &amp; Kelas</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">Uraian Tagihan</th>
                <th className="border border-slate-300 py-1.5 px-1.5 text-center w-16">Metode</th>
                <th className="border border-slate-300 py-1.5 px-2 text-right w-24">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {validPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-slate-300 py-6 text-center text-slate-500 italic">
                    Tidak ada transaksi pembayaran valid pada periode ini.
                  </td>
                </tr>
              ) : (
                validPayments.map((p, idx) => {
                  const st = studentMap.get(p.id_siswa);
                  const bl = billMap.get(p.id_tagihan);
                  return (
                    <tr key={p.id_pembayaran} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border border-slate-300 py-1 px-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-300 py-1 px-2 whitespace-nowrap">{formatDateIdShort(p.tanggal_bayar)}</td>
                      <td className="border border-slate-300 py-1 px-2 font-mono font-bold">{p.no_kwitansi}</td>
                      <td className="border border-slate-300 py-1 px-2">
                        <div className="font-bold">{st?.nama || p.id_siswa}</div>
                        <div className="text-[9.5px] text-slate-500">{st?.nama_kelas || '-'}</div>
                      </td>
                      <td className="border border-slate-300 py-1 px-2">{bl?.nama_tagihan || p.id_tagihan}</td>
                      <td className="border border-slate-300 py-1 px-1.5 text-center font-semibold">{p.metode}</td>
                      <td className="border border-slate-300 py-1 px-2 text-right font-mono font-bold">
                        {formatRupiah(p.nominal_bayar)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black text-xs">
                <td colSpan={6} className="border border-slate-300 py-1.5 px-2 text-right uppercase">
                  Total Pemasukan ({validPayments.length} Item)
                </td>
                <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                  {formatRupiah(totalKasMasuk)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      {mode === 'REKAP_KELAS' && (
        <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
          <thead>
            <tr className="bg-slate-900 text-white font-bold">
              <th className="border border-slate-300 py-1.5 px-1.5 text-center w-8">No</th>
              <th className="border border-slate-300 py-1.5 px-2 text-left">Kelas / Unit</th>
              <th className="border border-slate-300 py-1.5 px-1.5 text-center w-14">Siswa</th>
              <th className="border border-slate-300 py-1.5 px-2 text-right">Target Tagihan</th>
              <th className="border border-slate-300 py-1.5 px-2 text-right">Terkumpul</th>
              <th className="border border-slate-300 py-1.5 px-2 text-right">Sisa Tunggakan</th>
              <th className="border border-slate-300 py-1.5 px-1.5 text-center w-14">%</th>
              <th className="border border-slate-300 py-1.5 px-1.5 text-center w-24">Layak / Belum</th>
            </tr>
          </thead>
          <tbody>
            {kelasSummary.map((row, idx) => (
              <tr key={row.kelas.id_kelas} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                <td className="border border-slate-300 py-1.5 px-1.5 text-center font-mono">{idx + 1}</td>
                <td className="border border-slate-300 py-1.5 px-2 font-bold">
                  {row.kelas.nama_kelas} <span className="text-slate-500 font-semibold">({row.kelas.jenjang})</span>
                </td>
                <td className="border border-slate-300 py-1.5 px-1.5 text-center font-mono">{row.studentCount}</td>
                <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">{formatRupiah(row.totalTagihan)}</td>
                <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold text-emerald-700">{formatRupiah(row.totalTerbayar)}</td>
                <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold text-rose-700">{formatRupiah(row.totalSisa)}</td>
                <td className="border border-slate-300 py-1.5 px-1.5 text-center font-mono font-bold">{row.pct}%</td>
                <td className="border border-slate-300 py-1.5 px-1.5 text-center font-mono font-bold">
                  <span className="text-emerald-700">{row.layakCount}</span> / <span className="text-rose-700">{row.belumLayakCount}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black text-xs">
              <td colSpan={2} className="border border-slate-300 py-2 px-2 text-right uppercase">Grand Total</td>
              <td className="border border-slate-300 py-2 px-1.5 text-center font-mono">{filteredStudents.length}</td>
              <td className="border border-slate-300 py-2 px-2 text-right font-mono">{formatRupiah(grandTagihan)}</td>
              <td className="border border-slate-300 py-2 px-2 text-right font-mono text-emerald-800">{formatRupiah(grandTerbayar)}</td>
              <td className="border border-slate-300 py-2 px-2 text-right font-mono text-rose-800">{formatRupiah(grandSisa)}</td>
              <td className="border border-slate-300 py-2 px-1.5 text-center font-mono">{grandPct}%</td>
              <td className="border border-slate-300 py-2 px-1.5 text-center font-mono">
                {grandLayak} / {grandBelumLayak}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {mode === 'KESIAPAN_UJIAN' && (
        <>
          <div className="mb-3 p-2.5 rounded border border-slate-300 bg-slate-50 text-[11px] flex flex-wrap justify-between gap-2">
            <span>
              Ambang Syarat Kartu Ujian: <strong>Minimal {config.minPercentForExamCard}%</strong>
            </span>
            <span>
              Layak Cetak: <strong className="text-emerald-700">{grandLayak} siswa</strong> • Belum Layak:{' '}
              <strong className="text-rose-700">{grandBelumLayak} siswa</strong>
            </span>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-[10px]">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="border border-slate-300 py-1.5 px-1.5 text-center w-8">No</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">Nama Siswa</th>
                <th className="border border-slate-300 py-1.5 px-1.5 text-center w-20">Kelas</th>
                <th className="border border-slate-300 py-1.5 px-2 text-right w-24">Tagihan</th>
                <th className="border border-slate-300 py-1.5 px-2 text-right w-24">Terbayar</th>
                <th className="border border-slate-300 py-1.5 px-1.5 text-center w-12">%</th>
                <th className="border border-slate-300 py-1.5 px-2 text-center w-28">Status Kartu</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">Keterangan / Min. Bayar</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((st, idx) => {
                const el = eligibilityMap[st.id_siswa];
                const statusLabel =
                  el?.status === 'LUNAS'
                    ? 'LUNAS'
                    : el?.status === 'MEMENUHI_SYARAT'
                    ? `LAYAK (${el.persentaseTerbayar}%)`
                    : el?.status === 'DISPENSASI'
                    ? 'DISPENSASI'
                    : el?.status === 'BELUM_ADA_TAGIHAN'
                    ? 'BELUM DITAGIH'
                    : 'BELUM LAYAK';
                return (
                  <tr key={st.id_siswa} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="border border-slate-300 py-1 px-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-300 py-1 px-2 font-bold uppercase">{st.nama}</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-center">{st.nama_kelas}</td>
                    <td className="border border-slate-300 py-1 px-2 text-right font-mono">{formatRupiah(el?.totalTagihan || 0)}</td>
                    <td className="border border-slate-300 py-1 px-2 text-right font-mono">{formatRupiah(el?.totalTerbayar || 0)}</td>
                    <td className="border border-slate-300 py-1 px-1.5 text-center font-mono font-bold">{el?.persentaseTerbayar ?? 0}%</td>
                    <td className="border border-slate-300 py-1 px-2 text-center font-black">
                      <span
                        className={
                          el?.eligibleForExamCard ? 'text-emerald-700' : 'text-rose-700'
                        }
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="border border-slate-300 py-1 px-2 text-slate-600">
                      {el?.status === 'DISPENSASI'
                        ? `Dispensasi: ${el.dispensasi?.alasan}`
                        : !el?.eligibleForExamCard && el?.minimalAgarLayak
                        ? `Min. bayar ${formatRupiah(el.minimalAgarLayak)} utk ${el.minPercentRequired}%`
                        : el?.sisaTunggakan
                        ? `Sisa ${formatRupiah(el.sisaTunggakan)}`
                        : 'Selesai'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* Pengesahan Kepala Sekolah & Bendahara */}
      <div className="grid grid-cols-2 gap-12 mt-8 text-xs text-center">
        <div>
          <div className="text-slate-600">Mengetahui,</div>
          <div className="font-bold text-slate-900 mt-0.5">Kepala Sekolah,</div>
          {kepalaTtd ? (
            <div className="h-14 flex items-center justify-center my-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kepalaTtd} alt="TTD Kepala Sekolah" className="max-h-14 w-auto object-contain mix-blend-multiply" />
            </div>
          ) : (
            <div className="h-14" />
          )}
          <div className="font-black underline underline-offset-2">
            {kepalaNama || '( ............................ )'}
          </div>
        </div>
        <div>
          <div className="text-slate-600">
            {kota}, {formatDateIdShort(today)}
          </div>
          <div className="font-bold text-slate-900 mt-0.5">
            {config.bendaharaJabatan || 'Bendahara Sekolah'},
          </div>
          {config.bendaharaTtdUrl ? (
            <div className="h-14 flex items-center justify-center my-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.bendaharaTtdUrl} alt="TTD Bendahara" className="max-h-14 w-auto object-contain mix-blend-multiply" />
            </div>
          ) : (
            <div className="h-14" />
          )}
          <div className="font-black underline underline-offset-2">
            {config.bendaharaNama || '( ............................ )'}
          </div>
          {config.bendaharaNip && (
            <div className="text-[10px] font-mono text-slate-600 mt-0.5">NIP/NRG. {config.bendaharaNip}</div>
          )}
        </div>
      </div>
    </div>
  );
}
