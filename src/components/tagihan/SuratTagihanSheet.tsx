'use client';

import React from 'react';
import { withBasePath } from '@/lib/base-path';
import {
  formatDateIdShort,
  formatRupiah,
  getTodayYmd,
  KeuanganConfig,
  StudentExamEligibility,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import type { TagihanStudentItem } from '@/lib/actions/tagihan';

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
            width: '210mm',
            minHeight: '295mm',
            padding: '10mm 12mm',
            gap: '8mm',
            fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
          }}
        >
          {pair.map((entry, idx) => {
            const prefix = entry.student.jenjang === 'SMP' ? 'smp_' : 'sma_';
            const yayasan = settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA';
            const akademi =
              settings[prefix + 'nama_sekolah_1'] ||
              settings['nama_sekolah_1'] ||
              'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY';
            const sekolah =
              settings[prefix + 'nama_sekolah_2'] ||
              settings['nama_sekolah_2'] ||
              (entry.student.jenjang === 'SMP' ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO');
            const alamat =
              settings['alamat_sekolah'] ||
              'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya';
            const kota = settings['kota_sekolah'] || 'Sogokmo';
            const logoKiri =
              settings[prefix + 'logo_kiri_url'] ||
              settings['logo_kiri_url'] ||
              withBasePath('/logo/logo_advent.png');

            return (
              <div
                key={entry.student.id_siswa}
                className={`bg-white text-slate-900 border border-slate-400 rounded-lg p-5 box-border flex flex-col justify-between ${
                  idx === 0 && pair.length === 2 ? 'relative' : ''
                }`}
                style={{ minHeight: '132mm' }}
              >
                <div>
                  {/* Kop Mini Resmi */}
                  <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoKiri} alt="Logo" className="w-11 h-11 object-contain shrink-0" />
                    <div className="flex-1 leading-tight">
                      <div className="text-[9px] font-bold uppercase text-slate-600">{yayasan}</div>
                      <div className="text-[11px] font-black uppercase text-slate-900">{akademi}</div>
                      <div className="text-sm font-black uppercase text-slate-950">{sekolah}</div>
                      <div className="text-[9px] text-slate-600">{alamat}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-black uppercase px-2.5 py-1 rounded bg-slate-900 text-white">
                        PEMBERITAHUAN TAGIHAN
                      </div>
                      <div className="text-[9.5px] font-semibold text-slate-600 mt-1">
                        TA {academicSession.tahunAjaran} • Sem. {academicSession.semester}
                      </div>
                    </div>
                  </div>

                  {/* Kepada & Data Siswa */}
                  <div className="flex items-start justify-between gap-4 text-[11px] mb-2.5">
                    <div>
                      <div className="text-slate-600">Kepada Yth. Bapak/Ibu Orang Tua / Wali dari:</div>
                      <div className="text-sm font-black uppercase text-slate-950 mt-0.5">
                        {entry.student.nama}
                      </div>
                      <div className="font-semibold text-slate-700">
                        Kelas {entry.student.nama_kelas} ({entry.student.jenjang}) • NIS:{' '}
                        {entry.student.nis || '-'}
                      </div>
                    </div>
                    <div className="text-right text-[10.5px] bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                      <div>
                        Total Tagihan: <strong className="font-mono">{formatRupiah(entry.eligibility.totalTagihan)}</strong>
                      </div>
                      <div>
                        Terbayar: <strong className="font-mono text-emerald-700">{formatRupiah(entry.eligibility.totalTerbayar)}</strong> ({entry.eligibility.persentaseTerbayar}%)
                      </div>
                      <div className="border-t border-slate-200 mt-0.5 pt-0.5 text-rose-700 font-black">
                        Sisa Tunggakan: <span className="font-mono">{formatRupiah(entry.eligibility.sisaTunggakan)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Rincian Bulan Belum Lunas */}
                  <table className="w-full border-collapse border border-slate-300 text-[10.5px] mb-2.5">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold">
                        <th className="border border-slate-300 py-1 px-2 text-center w-8">No</th>
                        <th className="border border-slate-300 py-1 px-2 text-left">Tagihan Belum Lunas</th>
                        <th className="border border-slate-300 py-1 px-2 text-right w-28">Tagihan</th>
                        <th className="border border-slate-300 py-1 px-2 text-right w-28">Terbayar</th>
                        <th className="border border-slate-300 py-1 px-2 text-right w-28">Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.unpaidBills.slice(0, 6).map((b, bIdx) => (
                        <tr key={b.id_tagihan} className={bIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                          <td className="border border-slate-300 py-1 px-2 text-center font-mono">{bIdx + 1}</td>
                          <td className="border border-slate-300 py-1 px-2 font-bold">{b.nama_tagihan}</td>
                          <td className="border border-slate-300 py-1 px-2 text-right font-mono">{formatRupiah(b.nominal_akhir)}</td>
                          <td className="border border-slate-300 py-1 px-2 text-right font-mono text-emerald-700">{formatRupiah(b.terbayar)}</td>
                          <td className="border border-slate-300 py-1 px-2 text-right font-mono font-black text-rose-700">
                            {formatRupiah(Math.max(0, b.nominal_akhir - b.terbayar))}
                          </td>
                        </tr>
                      ))}
                      {entry.unpaidBills.length > 6 && (
                        <tr>
                          <td colSpan={5} className="border border-slate-300 py-1 px-2 text-center italic text-slate-500">
                            + {entry.unpaidBills.length - 6} tagihan lainnya terakumulasi pada total sisa di atas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Kotak Informasi Syarat Kartu Ujian */}
                  {!entry.eligibility.eligibleForExamCard && entry.eligibility.minimalAgarLayak > 0 && (
                    <div className="p-2.5 rounded-md bg-amber-50 border border-amber-300 text-[10.5px] text-amber-950 mb-2">
                      <strong>Syarat Pengambilan Kartu Peserta Ujian:</strong> Siswa wajib melunasi penuh atau minimal{' '}
                      <strong>{entry.eligibility.minPercentRequired}%</strong> dari tagihan periode ujian. Agar memenuhi syarat kartu ujian, mohon pembayaran minimal sebesar{' '}
                      <strong className="font-mono underline">{formatRupiah(entry.eligibility.minimalAgarLayak)}</strong>.
                    </div>
                  )}
                </div>

                {/* Footer Rekening & TTD Bendahara */}
                <div className="flex items-end justify-between gap-4 pt-1 border-t border-slate-200">
                  <div className="text-[9.5px] text-slate-600 max-w-[60%] leading-snug">
                    {config.rekeningInfo ? (
                      <>
                        <div className="font-bold text-slate-800">Informasi Pembayaran / Transfer:</div>
                        <div className="whitespace-pre-line">{config.rekeningInfo}</div>
                      </>
                    ) : (
                      <div className="italic">
                        Pembayaran dapat dilakukan langsung ke bagian Keuangan / Bendahara Sekolah pada jam kerja.
                      </div>
                    )}
                  </div>
                  <div className="text-center text-[10.5px] min-w-[155px]">
                    <div>
                      {kota}, {formatDateIdShort(today)}
                    </div>
                    <div className="font-bold">{config.bendaharaJabatan || 'Bendahara Sekolah'},</div>
                    {config.bendaharaTtdUrl ? (
                      <div className="h-10 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={config.bendaharaTtdUrl}
                          alt="TTD Bendahara"
                          className="max-h-10 w-auto object-contain mix-blend-multiply"
                        />
                      </div>
                    ) : (
                      <div className="h-9" />
                    )}
                    <div className="font-black underline underline-offset-2">
                      {config.bendaharaNama || '( ............................ )'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
