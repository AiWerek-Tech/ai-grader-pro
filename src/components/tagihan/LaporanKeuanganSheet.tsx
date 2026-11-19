'use client';

import React from 'react';
import {
  formatDateIdShort,
  formatRupiah,
  getTodayYmd,
  KeuanganConfig,
  PembayaranRecord,
  StudentExamEligibility,
  summarizeCashierHandover,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import type { TagihanKelasItem, TagihanStudentItem } from '@/lib/actions/tagihan';
import {
  KeuanganKopSurat,
  KeuanganSignatureImg,
  resolveKeuanganLeaderSigner,
} from './KeuanganKopSurat';

export type LaporanKeuanganMode =
  | 'REKAP_KELAS'
  | 'KAS_MASUK'
  | 'KESIAPAN_UJIAN'
  | 'RINCIAN_TUNGGAKAN';

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
  const kota = settings['kota_sekolah'] || 'Sogokmo';

  // Penandatangan Pimpinan: SMP -> Kepsek SMP, SMA -> Kepsek SMA, Gabung SMP-SMA -> Direktur (Kepsek tertinggi SMA)
  const leaderSigner = resolveKeuanganLeaderSigner(jenjangFilter, settings);

  const filteredStudents = students.filter(
    (s) => jenjangFilter === 'ALL' || s.jenjang === jenjangFilter
  );
  const studentMap = new Map(students.map((s) => [s.id_siswa, s]));
  const billMap = new Map(bills.map((b) => [b.id_tagihan, b]));

  // Data untuk KAS_MASUK + Rekap Setoran per Kasir
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
  const cashierSummary = summarizeCashierHandover(validPayments);

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

  // Data untuk RINCIAN_TUNGGAKAN (hanya siswa yang masih punya sisa tunggakan)
  const tunggakanStudents = filteredStudents.filter(
    (s) => (eligibilityMap[s.id_siswa]?.sisaTunggakan || 0) > 0
  );

  const reportTitle =
    mode === 'KAS_MASUK'
      ? 'LAPORAN PEMASUKAN KAS & SETORAN KASIR'
      : mode === 'REKAP_KELAS'
      ? 'REKAPITULASI TAGIHAN & TUNGGAKAN PER KELAS'
      : mode === 'RINCIAN_TUNGGAKAN'
      ? 'DAFTAR RINCIAN SISA TUNGGAKAN BIAYA SEKOLAH'
      : 'LAPORAN KESIAPAN ADMINISTRASI KARTU PESERTA UJIAN';

  return (
    <div
      className="tagihan-print-page bg-white text-black mx-auto box-border"
      style={{
        width: '210mm',
        minHeight: '292mm',
        padding: '12mm 14mm',
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      }}
    >
      {/* Kop Resmi Sekolah (Standar WMVAA: Logo Kiri + Kanan + Garis Ganda + NPSN) */}
      <KeuanganKopSurat unit={jenjangFilter} settings={settings} />

      {/* Judul Laporan */}
      <div className="text-center mb-4">
        <h2 className="text-sm font-black uppercase tracking-wide text-black">{reportTitle}</h2>
        <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
          Tahun Ajaran {academicSession.tahunAjaran} • Semester {academicSession.semester}
          {jenjangFilter !== 'ALL' ? ` • Unit ${jenjangFilter}` : ' • Gabungan Unit SMP & SMA'}
          {mode === 'KAS_MASUK' && (dateFrom || dateTo)
            ? ` • Periode ${formatDateIdShort(dateFrom)} s.d. ${formatDateIdShort(dateTo)}`
            : ''}
        </p>
      </div>

      {mode === 'KAS_MASUK' && (
        <>
          <div className="grid grid-cols-3 gap-2.5 mb-3.5 text-xs">
            <div className="p-2.5 rounded border border-slate-400 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-600">Total Tunai</div>
              <div className="text-sm font-black font-mono text-black mt-0.5">
                {formatRupiah(totalTunai)}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-400 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-600">Total Transfer / Lain</div>
              <div className="text-sm font-black font-mono text-black mt-0.5">
                {formatRupiah(totalTransfer + totalLain)}
              </div>
            </div>
            <div className="p-2.5 rounded border border-slate-900 bg-slate-900 text-white">
              <div className="text-[10px] font-bold uppercase opacity-80">Total Kas Masuk</div>
              <div className="text-sm font-black font-mono mt-0.5">
                {formatRupiah(totalKasMasuk)}
              </div>
            </div>
          </div>

          {/* Rekap Setoran per Petugas Kasir */}
          {cashierSummary.length > 0 && (
            <div className="mb-4">
              <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-800 mb-1">
                A. Ringkasan Setoran per Petugas Kasir / Bendahara
              </div>
              <table className="w-full border-collapse border border-slate-400 text-[10px]">
                <thead>
                  <tr className="bg-slate-200 text-black font-black">
                    <th className="border border-slate-400 py-1 px-2 text-left">Nama Petugas</th>
                    <th className="border border-slate-400 py-1 px-2 text-center w-20">Kwitansi</th>
                    <th className="border border-slate-400 py-1 px-2 text-right w-28">Tunai</th>
                    <th className="border border-slate-400 py-1 px-2 text-right w-28">Transfer / Lain</th>
                    <th className="border border-slate-400 py-1 px-2 text-right w-32">Total Setoran</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierSummary.map((c) => (
                    <tr key={c.namaPetugas}>
                      <td className="border border-slate-400 py-1 px-2 font-bold">{c.namaPetugas}</td>
                      <td className="border border-slate-400 py-1 px-2 text-center font-mono">{c.receiptCount}</td>
                      <td className="border border-slate-400 py-1 px-2 text-right font-mono">{formatRupiah(c.tunai)}</td>
                      <td className="border border-slate-400 py-1 px-2 text-right font-mono">
                        {formatRupiah(c.transfer + c.lainnya)}
                      </td>
                      <td className="border border-slate-400 py-1 px-2 text-right font-mono font-black">
                        {formatRupiah(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-800 mb-1">
            {cashierSummary.length > 0 ? 'B. Rincian Transaksi Pembayaran Valid' : 'Rincian Transaksi Pembayaran Valid'}
          </div>
          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="border border-slate-400 py-1.5 px-1.5 text-center w-7">No</th>
                <th className="border border-slate-400 py-1.5 px-1.5 text-left w-20">Tanggal</th>
                <th className="border border-slate-400 py-1.5 px-1.5 text-left w-28">No. Kwitansi</th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">Siswa &amp; Kelas</th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">Uraian &amp; Petugas</th>
                <th className="border border-slate-400 py-1.5 px-1.5 text-center w-16">Metode</th>
                <th className="border border-slate-400 py-1.5 px-2 text-right w-24">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {validPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-slate-400 py-6 text-center text-slate-500 italic">
                    Tidak ada transaksi pembayaran valid pada periode ini.
                  </td>
                </tr>
              ) : (
                validPayments.map((p, idx) => {
                  const st = studentMap.get(p.id_siswa);
                  const bl = billMap.get(p.id_tagihan);
                  return (
                    <tr key={p.id_pembayaran} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border border-slate-400 py-1 px-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-400 py-1 px-1.5 whitespace-nowrap">
                        {formatDateIdShort(p.tanggal_bayar)}
                      </td>
                      <td className="border border-slate-400 py-1 px-1.5 font-mono font-bold">
                        {p.no_kwitansi}
                      </td>
                      <td className="border border-slate-400 py-1 px-2">
                        <div className="font-bold uppercase">{st?.nama || p.id_siswa}</div>
                        <div className="text-[9px] text-slate-600">{st?.nama_kelas || '-'}</div>
                      </td>
                      <td className="border border-slate-400 py-1 px-2">
                        <div className="font-semibold">{bl?.nama_tagihan || p.id_tagihan}</div>
                        <div className="text-[9px] text-slate-500">Kasir: {p.nama_petugas || '-'}</div>
                      </td>
                      <td className="border border-slate-400 py-1 px-1.5 text-center font-semibold">
                        {p.metode}
                      </td>
                      <td className="border border-slate-400 py-1 px-2 text-right font-mono font-bold">
                        {formatRupiah(p.nominal_bayar)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black text-xs">
                <td colSpan={6} className="border border-slate-400 py-1.5 px-2 text-right uppercase">
                  Total Pemasukan ({validPayments.length} Item)
                </td>
                <td className="border border-slate-400 py-1.5 px-2 text-right font-mono">
                  {formatRupiah(totalKasMasuk)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      {mode === 'REKAP_KELAS' && (
        <table className="w-full border-collapse border border-slate-400 text-[10.5px]">
          <thead>
            <tr className="bg-slate-900 text-white font-bold">
              <th className="border border-slate-400 py-1.5 px-1.5 text-center w-8">No</th>
              <th className="border border-slate-400 py-1.5 px-2 text-left">Kelas / Unit</th>
              <th className="border border-slate-400 py-1.5 px-1.5 text-center w-14">Siswa</th>
              <th className="border border-slate-400 py-1.5 px-2 text-right">Target Tagihan</th>
              <th className="border border-slate-400 py-1.5 px-2 text-right">Terkumpul</th>
              <th className="border border-slate-400 py-1.5 px-2 text-right">Sisa Tunggakan</th>
              <th className="border border-slate-400 py-1.5 px-1.5 text-center w-14">%</th>
              <th className="border border-slate-400 py-1.5 px-1.5 text-center w-24">Layak / Belum</th>
            </tr>
          </thead>
          <tbody>
            {kelasSummary.map((row, idx) => (
              <tr key={row.kelas.id_kelas} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                <td className="border border-slate-400 py-1.5 px-1.5 text-center font-mono">{idx + 1}</td>
                <td className="border border-slate-400 py-1.5 px-2 font-bold">
                  {row.kelas.nama_kelas}{' '}
                  <span className="text-slate-600 font-semibold">({row.kelas.jenjang})</span>
                </td>
                <td className="border border-slate-400 py-1.5 px-1.5 text-center font-mono">
                  {row.studentCount}
                </td>
                <td className="border border-slate-400 py-1.5 px-2 text-right font-mono">
                  {formatRupiah(row.totalTagihan)}
                </td>
                <td className="border border-slate-400 py-1.5 px-2 text-right font-mono font-bold text-emerald-700">
                  {formatRupiah(row.totalTerbayar)}
                </td>
                <td className="border border-slate-400 py-1.5 px-2 text-right font-mono font-bold text-rose-700">
                  {formatRupiah(row.totalSisa)}
                </td>
                <td className="border border-slate-400 py-1.5 px-1.5 text-center font-mono font-bold">
                  {row.pct}%
                </td>
                <td className="border border-slate-400 py-1.5 px-1.5 text-center font-mono font-bold">
                  <span className="text-emerald-700">{row.layakCount}</span> /{' '}
                  <span className="text-rose-700">{row.belumLayakCount}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black text-xs">
              <td colSpan={2} className="border border-slate-400 py-2 px-2 text-right uppercase">
                Grand Total
              </td>
              <td className="border border-slate-400 py-2 px-1.5 text-center font-mono">
                {filteredStudents.length}
              </td>
              <td className="border border-slate-400 py-2 px-2 text-right font-mono">
                {formatRupiah(grandTagihan)}
              </td>
              <td className="border border-slate-400 py-2 px-2 text-right font-mono text-emerald-800">
                {formatRupiah(grandTerbayar)}
              </td>
              <td className="border border-slate-400 py-2 px-2 text-right font-mono text-rose-800">
                {formatRupiah(grandSisa)}
              </td>
              <td className="border border-slate-400 py-2 px-1.5 text-center font-mono">
                {grandPct}%
              </td>
              <td className="border border-slate-400 py-2 px-1.5 text-center font-mono">
                {grandLayak} / {grandBelumLayak}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {mode === 'RINCIAN_TUNGGAKAN' && (
        <>
          <div className="mb-3 p-2.5 rounded border border-slate-400 bg-slate-50 text-[11px] flex flex-wrap justify-between gap-2">
            <span>
              Siswa Masih Memiliki Tunggakan: <strong className="text-rose-700">{tunggakanStudents.length} siswa</strong>
            </span>
            <span>
              Total Sisa Tunggakan:{' '}
              <strong className="font-mono text-rose-700">{formatRupiah(grandSisa)}</strong>
            </span>
          </div>
          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="border border-slate-400 py-1.5 px-1.5 text-center w-7">No</th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">Nama Siswa</th>
                <th className="border border-slate-400 py-1.5 px-1.5 text-center w-20">Kelas</th>
                <th className="border border-slate-400 py-1.5 px-2 text-right w-24">Tagihan</th>
                <th className="border border-slate-400 py-1.5 px-2 text-right w-24">Terbayar</th>
                <th className="border border-slate-400 py-1.5 px-2 text-right w-24">Sisa</th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">Keterangan / Syarat Kartu</th>
              </tr>
            </thead>
            <tbody>
              {tunggakanStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-slate-400 py-6 text-center text-emerald-700 font-bold">
                    Seluruh siswa pada unit ini sudah melunasi tagihannya!
                  </td>
                </tr>
              ) : (
                tunggakanStudents.map((st, idx) => {
                  const el = eligibilityMap[st.id_siswa];
                  return (
                    <tr key={st.id_siswa} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border border-slate-400 py-1 px-1.5 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-400 py-1 px-2 font-bold uppercase">{st.nama}</td>
                      <td className="border border-slate-400 py-1 px-1.5 text-center">{st.nama_kelas}</td>
                      <td className="border border-slate-400 py-1 px-2 text-right font-mono">
                        {formatRupiah(el?.totalTagihan || 0)}
                      </td>
                      <td className="border border-slate-400 py-1 px-2 text-right font-mono text-emerald-700">
                        {formatRupiah(el?.totalTerbayar || 0)}
                      </td>
                      <td className="border border-slate-400 py-1 px-2 text-right font-mono font-black text-rose-700">
                        {formatRupiah(el?.sisaTunggakan || 0)}
                      </td>
                      <td className="border border-slate-400 py-1 px-2 text-slate-700">
                        {el?.status === 'DISPENSASI'
                          ? `Dispensasi (${el.dispensasi?.alasan})`
                          : el?.eligibleForExamCard
                          ? `Layak (${el.persentaseTerbayar}%)`
                          : `Belum Layak • Min. ${formatRupiah(el?.minimalAgarLayak || 0)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </>
      )}

      {mode === 'KESIAPAN_UJIAN' && (
        <>
          <div className="mb-3 p-2.5 rounded border border-slate-400 bg-slate-50 text-[11px] flex flex-wrap justify-between gap-2">
            <span>
              Ambang Syarat Kartu Ujian: <strong>Minimal {config.minPercentForExamCard}%</strong>
            </span>
            <span>
              Layak Cetak: <strong className="text-emerald-700">{grandLayak} siswa</strong> • Belum Layak:{' '}
              <strong className="text-rose-700">{grandBelumLayak} siswa</strong>
            </span>
          </div>

          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="border border-slate-400 py-1.5 px-1.5 text-center w-7">No</th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">Nama Siswa</th>
                <th className="border border-slate-400 py-1.5 px-1.5 text-center w-20">Kelas</th>
                <th className="border border-slate-400 py-1.5 px-2 text-right w-24">Tagihan</th>
                <th className="border border-slate-400 py-1.5 px-2 text-right w-24">Terbayar</th>
                <th className="border border-slate-400 py-1.5 px-1.5 text-center w-12">%</th>
                <th className="border border-slate-400 py-1.5 px-2 text-center w-28">Status Kartu</th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">Keterangan / Min. Bayar</th>
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
                    ? 'BELUM DIPOSTING'
                    : 'BELUM LAYAK';
                return (
                  <tr key={st.id_siswa} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="border border-slate-400 py-1 px-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-400 py-1 px-2 font-bold uppercase">{st.nama}</td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center">{st.nama_kelas}</td>
                    <td className="border border-slate-400 py-1 px-2 text-right font-mono">
                      {formatRupiah(el?.totalTagihan || 0)}
                    </td>
                    <td className="border border-slate-400 py-1 px-2 text-right font-mono">
                      {formatRupiah(el?.totalTerbayar || 0)}
                    </td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center font-mono font-bold">
                      {el?.persentaseTerbayar ?? 0}%
                    </td>
                    <td className="border border-slate-400 py-1 px-2 text-center font-black">
                      <span className={el?.eligibleForExamCard ? 'text-emerald-700' : 'text-rose-700'}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="border border-slate-400 py-1 px-2 text-slate-700">
                      {el?.status === 'DISPENSASI'
                        ? `Dispensasi: ${el.dispensasi?.alasan}`
                        : !el?.eligibleForExamCard && el?.minimalAgarLayak
                        ? `Min. bayar ${formatRupiah(el.minimalAgarLayak)} utk ${el.minPercentRequired}%`
                        : el?.sisaTunggakan
                        ? `Sisa ${formatRupiah(el.sisaTunggakan)}`
                        : el?.status === 'BELUM_ADA_TAGIHAN'
                        ? 'Belum diposting'
                        : 'Selesai'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* Pengesahan Pimpinan (Direktur bila SMP-SMA gabung; Kepala Sekolah bila per unit) & Bendahara */}
      <div className="grid grid-cols-2 gap-12 mt-8 text-xs text-center break-inside-avoid">
        <div>
          <div className="text-slate-700">Mengetahui,</div>
          <div className="font-bold text-black mt-0.5">{leaderSigner.jabatan}</div>
          <KeuanganSignatureImg
            src={leaderSigner.ttdUrl}
            alt={`TTD ${leaderSigner.jabatan}`}
            heightClass="h-14"
          />
          <div className="font-black text-black underline underline-offset-2">
            {leaderSigner.nama || '( ............................ )'}
          </div>
          {leaderSigner.nip && (
            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
              NIP/NRG. {leaderSigner.nip}
            </div>
          )}
        </div>
        <div>
          <div className="text-slate-700">
            {kota}, {formatDateIdShort(today)}
          </div>
          <div className="font-bold text-black mt-0.5">
            {config.bendaharaJabatan || 'Bendahara Sekolah'},
          </div>
          <KeuanganSignatureImg
            src={config.bendaharaTtdUrl}
            alt="TTD Bendahara"
            heightClass="h-14"
          />
          <div className="font-black text-black underline underline-offset-2">
            {config.bendaharaNama || '( ............................ )'}
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
}
