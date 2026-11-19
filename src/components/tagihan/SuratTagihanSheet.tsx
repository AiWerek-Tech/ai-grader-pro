'use client';

import React from 'react';
import {
  formatDateIdShort,
  formatRupiah,
  getTodayYmd,
  KeuanganConfig,
  StudentExamEligibility,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import type { TagihanStudentItem } from '@/lib/actions/tagihan';
import { KeuanganKopSurat, KeuanganSignatureImg } from './KeuanganKopSurat';

export interface SuratTagihanItem {
  student: TagihanStudentItem;
  eligibility: StudentExamEligibility;
  unpaidBills: TagihanRecord[];
}

export function SuratTagihanSheet({
  items,
  config,
  settings,
  academicSession,
}: {
  items: SuratTagihanItem[];
  config: KeuanganConfig;
  settings: Record<string, string>;
  academicSession: { tahunAjaran: string; semester: string };
}) {
  const today = getTodayYmd();
  const kota = settings['kota_sekolah'] || 'Sogokmo';

  // Paginasi 2 surat pemberitahuan per lembar A4 agar hemat kertas saat cetak massal
  const pages: SuratTagihanItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pages.push(items.slice(i, i + 2));
  }

  return (
    <>
      {pages.map((pair, pageIdx) => (
        <div
          key={`surat-page-${pageIdx}`}
          className="tagihan-print-page bg-white mx-auto box-border flex flex-col justify-between"
          style={{
            width: '204mm',
            minHeight: '286mm',
            padding: '6mm 6mm',
            gap: '4mm',
            fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
          }}
        >
          {pair.map((entry, idx) => (
            <React.Fragment key={entry.student.id_siswa}>
              <div
                className="bg-white text-slate-900 border border-slate-500 rounded-md p-4 box-border flex flex-col justify-between"
                style={{ minHeight: '132mm' }}
              >
                <div>
                  {/* Kop Surat Resmi Sekolah (Logo Kiri + Kanan + Garis Ganda) */}
                  <KeuanganKopSurat unit={entry.student.jenjang} settings={settings} compact />

                  {/* Judul & Periode */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-black">
                        SURAT PEMBERITAHUAN TAGIHAN BIAYA SEKOLAH
                      </div>
                      <div className="text-[10px] font-semibold text-slate-600">
                        Persiapan Administrasi Ujian • TA {academicSession.tahunAjaran} (Semester {academicSession.semester})
                      </div>
                    </div>
                    <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-white shrink-0">
                      UNIT {entry.student.jenjang}
                    </span>
                  </div>

                  {/* Kepada & Ringkasan Nominal */}
                  <div className="flex items-start justify-between gap-3 text-[10.5px] mb-2">
                    <div className="min-w-0">
                      <div className="text-slate-600">Kepada Yth. Bapak/Ibu Orang Tua / Wali dari:</div>
                      <div className="text-sm font-black uppercase text-black mt-0.5">
                        {entry.student.nama}
                      </div>
                      <div className="font-semibold text-slate-700">
                        Kelas {entry.student.nama_kelas} ({entry.student.jenjang}) • NIS:{' '}
                        {entry.student.nis || '-'}
                      </div>
                    </div>
                    <div className="text-right text-[10px] bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 shrink-0">
                      <div>
                        Total Tagihan:{' '}
                        <strong className="font-mono text-black">
                          {formatRupiah(entry.eligibility.totalTagihan)}
                        </strong>
                      </div>
                      <div>
                        Sudah Dibayar:{' '}
                        <strong className="font-mono text-emerald-700">
                          {formatRupiah(entry.eligibility.totalTerbayar)}
                        </strong>{' '}
                        ({entry.eligibility.persentaseTerbayar}%)
                      </div>
                      <div className="border-t border-slate-300 mt-0.5 pt-0.5 text-rose-700 font-black">
                        Sisa Tunggakan:{' '}
                        <span className="font-mono">{formatRupiah(entry.eligibility.sisaTunggakan)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Rincian Tagihan Belum Lunas */}
                  <table className="w-full border-collapse border border-slate-400 text-[10px] mb-2">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold">
                        <th className="border border-slate-400 py-1 px-1.5 text-center w-7">No</th>
                        <th className="border border-slate-400 py-1 px-2 text-left">Uraian Tagihan / Keterangan</th>
                        <th className="border border-slate-400 py-1 px-2 text-right w-24">Tagihan</th>
                        <th className="border border-slate-400 py-1 px-2 text-right w-24">Terbayar</th>
                        <th className="border border-slate-400 py-1 px-2 text-right w-24">Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.unpaidBills.slice(0, 5).map((b, bIdx) => (
                        <tr key={b.id_tagihan} className={bIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                          <td className="border border-slate-400 py-1 px-1.5 text-center font-mono">{bIdx + 1}</td>
                          <td className="border border-slate-400 py-1 px-2 font-bold text-black">
                            {b.nama_tagihan}
                            {b.catatan && b.catatan !== b.nama_tagihan && !b.catatan.startsWith('Posting Sisa') && (
                              <span className="font-normal text-slate-600"> — {b.catatan}</span>
                            )}
                          </td>
                          <td className="border border-slate-400 py-1 px-2 text-right font-mono">
                            {formatRupiah(b.nominal_akhir)}
                          </td>
                          <td className="border border-slate-400 py-1 px-2 text-right font-mono text-emerald-700">
                            {formatRupiah(b.terbayar)}
                          </td>
                          <td className="border border-slate-400 py-1 px-2 text-right font-mono font-black text-rose-700">
                            {formatRupiah(Math.max(0, b.nominal_akhir - b.terbayar))}
                          </td>
                        </tr>
                      ))}
                      {entry.unpaidBills.length > 5 && (
                        <tr>
                          <td colSpan={5} className="border border-slate-400 py-1 px-2 text-center italic text-slate-500">
                            + {entry.unpaidBills.length - 5} item tagihan lainnya terakumulasi pada total sisa di atas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Kotak Syarat Kartu Peserta Ujian */}
                  {!entry.eligibility.eligibleForExamCard && entry.eligibility.minimalAgarLayak > 0 ? (
                    <div className="p-2 rounded bg-amber-50 border border-amber-400 text-[10px] text-amber-950 leading-snug">
                      <strong>Syarat Pengambilan Kartu Peserta Ujian:</strong> Siswa wajib melunasi penuh atau minimal{' '}
                      <strong>{entry.eligibility.minPercentRequired}%</strong> dari tagihan tersisa. Untuk mendapatkan Kartu Ujian, mohon melakukan pembayaran minimal sebesar{' '}
                      <strong className="font-mono underline">{formatRupiah(entry.eligibility.minimalAgarLayak)}</strong> di Loket Keuangan Sekolah.
                    </div>
                  ) : (
                    <div className="p-2 rounded bg-emerald-50 border border-emerald-300 text-[10px] text-emerald-950 leading-snug">
                      <strong>Status Kartu Ujian:</strong> Memenuhi syarat ({entry.eligibility.persentaseTerbayar}%). Mohon pelunasan sisa sebesar{' '}
                      <strong className="font-mono">{formatRupiah(entry.eligibility.sisaTunggakan)}</strong> dapat diselesaikan sesuai jadwal.
                    </div>
                  )}
                </div>

                {/* Footer Rekening & TTD Bendahara */}
                <div className="flex items-end justify-between gap-4 pt-1.5 border-t border-slate-300 mt-1.5">
                  <div className="text-[9px] text-slate-600 max-w-[60%] leading-snug">
                    {config.rekeningInfo ? (
                      <>
                        <div className="font-bold text-slate-900">Informasi Pembayaran / Transfer:</div>
                        <div className="whitespace-pre-line">{config.rekeningInfo}</div>
                      </>
                    ) : (
                      <div className="italic">
                        Pembayaran dapat dilakukan langsung di Loket Kasir / Bendahara Sekolah pada jam kerja. Bawa surat ini saat melakukan pembayaran.
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[10px] min-w-[160px]">
                    <div className="text-slate-700">
                      {kota}, {formatDateIdShort(today)}
                    </div>
                    <div className="font-bold text-black">
                      {config.bendaharaJabatan || 'Bendahara Sekolah'},
                    </div>
                    <KeuanganSignatureImg
                      src={config.bendaharaTtdUrl}
                      alt="TTD Bendahara"
                      heightClass="h-9"
                    />
                    <div className="font-black text-black underline underline-offset-2">
                      {config.bendaharaNama || '( ............................ )'}
                    </div>
                    {config.bendaharaNip && (
                      <div className="text-[8.5px] font-mono text-slate-600">
                        NIP/NRG. {config.bendaharaNip}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {idx === 0 && pair.length === 2 && (
                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 select-none">
                  <div className="flex-1 border-t border-dashed border-slate-400" />
                  <span>✂ POTONG DI SINI</span>
                  <div className="flex-1 border-t border-dashed border-slate-400" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      ))}
    </>
  );
}
