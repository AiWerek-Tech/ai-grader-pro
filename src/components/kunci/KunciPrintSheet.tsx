'use client';

import React from 'react';
import { formatJawaban, getTipeDistribusi, getTipeMeta } from '@/lib/constants/tipe-soal';
import { calcTotalPoin, formatTanggalSingkat, hydrateSoalItems } from './kunci-utils';

interface KunciPrintSheetProps {
  kunci: any | null;
  getMapelLabel: (id: string) => string;
  getKelasLabel: (id: string) => string;
}

/** Lembar Kunci Jawaban Pegangan Guru (khusus mode cetak window.print()). */
export default function KunciPrintSheet({
  kunci,
  getMapelLabel,
  getKelasLabel,
}: KunciPrintSheetProps) {
  if (!kunci) return null;
  const items = hydrateSoalItems(kunci);
  const totalPoin = calcTotalPoin(items);
  const dist = getTipeDistribusi(items);

  return (
    <div id="kunci-print-root" className="hidden print:block bg-white text-black p-6 max-w-[210mm] mx-auto">
      <div className="border-b-2 border-black pb-3 mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
            WMVAA AI GRADER PRO — LEMBAR KUNCI JAWABAN PEGANGAN GURU
          </p>
          <h1 className="text-xl font-black mt-0.5">{kunci.judul_ujian}</h1>
          <p className="text-xs font-semibold mt-1">
            Mapel: <strong>{getMapelLabel(kunci.id_mapel)}</strong> · Kelas:{' '}
            <strong>{getKelasLabel(kunci.id_kelas)}</strong> · ID:{' '}
            <span className="font-mono">{kunci.id_kunci}</span>
          </p>
        </div>
        <div className="text-right text-xs">
          <p>
            Jumlah Soal: <strong>{items.length} Butir</strong>
          </p>
          <p>
            Total Bobot: <strong>{totalPoin} Poin</strong>
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Diperbarui: {formatTanggalSingkat(kunci.timestamp)}
          </p>
        </div>
      </div>

      <div className="mb-3 text-[11px] flex flex-wrap gap-2">
        {Object.entries(dist).map(([kode, count]) => {
          const meta = getTipeMeta(kode);
          return (
            <span key={kode} className="px-2 py-0.5 border border-black/40 rounded font-bold">
              {meta.short}: {count} soal
            </span>
          );
        })}
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-400 px-2 py-1.5 text-center w-12">No</th>
            <th className="border border-slate-400 px-2 py-1.5 text-center w-20">Tipe</th>
            <th className="border border-slate-400 px-2.5 py-1.5 text-left">Kunci Jawaban</th>
            <th className="border border-slate-400 px-2 py-1.5 text-center w-16">Poin</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const meta = getTipeMeta(item.tipe);
            return (
              <tr key={item.no}>
                <td className="border border-slate-300 px-2 py-1 text-center font-bold">{item.no}</td>
                <td className="border border-slate-300 px-2 py-1 text-center font-mono text-[10px]">
                  {meta.short}
                </td>
                <td className="border border-slate-300 px-2.5 py-1 font-bold break-words">
                  {item.perlakuan === 'bonus'
                    ? 'BONUS (Semua Benar)'
                    : item.perlakuan === 'anulir'
                      ? 'DIANULIR (Tidak Dihitung)'
                      : formatJawaban(item)}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-center">
                  {item.perlakuan === 'anulir' ? 0 : item.poin}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-8 pt-4 flex justify-between text-xs">
        <div>
          <p className="text-slate-600">Dicetak melalui WMVAA AI Grader Pro</p>
        </div>
        <div className="text-center min-w-[180px]">
          <p>Guru Mata Pelajaran</p>
          <div className="h-14" />
          <p className="font-bold border-t border-black pt-1">
            {kunci.nama_guru || '........................................'}
          </p>
        </div>
      </div>
    </div>
  );
}
