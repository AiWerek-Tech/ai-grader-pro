'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Copy,
  Edit2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
  Scan,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { regradeKunciHasilAction } from '@/lib/actions/kunci';
import { formatJawaban, getTipeDistribusi, getTipeMeta, TIPE_COLOR } from '@/lib/constants/tipe-soal';
import {
  calcTotalPoin,
  downloadSingleKunciXlsx,
  formatTanggalSingkat,
  hydrateSoalItems,
} from './kunci-utils';

interface DetailModalProps {
  kunci: any | null;
  getMapelLabel: (id: string) => string;
  getKelasLabel: (id: string) => string;
  onClose: () => void;
  onEdit: (k: any) => void;
  onDuplicate: (k: any) => void;
  onLjk: (k: any) => void;
  onScan: (k: any) => void;
  onPrintKunci: (k: any) => void;
  onRegraded?: () => Promise<void> | void;
}

/** Modal Pratinjau Detail Master Kunci Jawaban dengan aksi cetak kunci, LJK, Scan, Hitung Ulang, Duplikat & Edit. */
export function KunciDetailModal({
  kunci,
  getMapelLabel,
  getKelasLabel,
  onClose,
  onEdit,
  onDuplicate,
  onLjk,
  onScan,
  onPrintKunci,
  onRegraded,
}: DetailModalProps) {
  const [regrading, setRegrading] = useState(false);

  useEffect(() => {
    if (!kunci) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kunci, onClose]);

  if (!kunci) return null;
  const items = hydrateSoalItems(kunci);
  const totalPoin = calcTotalPoin(items);
  const dist = getTipeDistribusi(items);
  const hasilCount = Number(kunci.hasil_count) || 0;
  const kompleksLabel =
    kunci.pengaturan_poin?.kompleks_mode === 'parsial' ? 'Parsial Proporsional' : 'Mutlak';

  const handleRegradeAll = async () => {
    setRegrading(true);
    try {
      const res = await regradeKunciHasilAction(kunci.id_kunci);
      if (res.success) {
        toast.success(res.message || 'Nilai siswa berhasil dihitung ulang.');
        await onRegraded?.();
      } else {
        toast.error(res.message || 'Gagal menghitung ulang nilai.');
      }
    } catch {
      toast.error('Gangguan jaringan saat menghitung ulang nilai.');
    } finally {
      setRegrading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 lg:backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-kunci-title">
      <div className="bg-white dark:bg-[#0d111d] border border-slate-200 dark:border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-black uppercase tracking-widest">
                {kunci.id_kunci}
              </span>
              {kunci.semester && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase">
                  Semester {kunci.semester === 'GANJIL' ? 'Ganjil (1)' : kunci.semester === 'GENAP' ? 'Genap (2)' : kunci.semester}
                </span>
              )}
              {hasilCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-black inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {hasilCount} Siswa Terkoreksi
                </span>
              )}
            </div>
            <h3
              id="detail-kunci-title"
              className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate mt-0.5">
              {getMapelLabel(kunci.id_mapel)} · {getKelasLabel(kunci.id_kelas)}
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {kunci.judul_ujian} · Oleh {kunci.nama_guru || kunci.id_guru} · {formatTanggalSingkat(kunci.timestamp)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300 shrink-0"
            aria-label="Tutup detail">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto touch-scroll p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Jumlah Soal', val: `${items.length} Butir` },
              { label: 'Total Bobot', val: `${totalPoin} Poin` },
              { label: 'Skoring AKM Kompleks', val: kompleksLabel },
              { label: 'Penalti Salah', val: kunci.pengaturan_poin?.salah ?? 0 },
            ].map((s) => (
              <div
                key={s.label}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{s.val}</p>
              </div>
            ))}
          </div>

          {hasilCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-wrap items-center justify-between gap-2.5">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                Ada <strong>{hasilCount} nilai siswa</strong> tersimpan. Baru mengubah kunci/bobot? Sinkronkan semua nilai secara otomatis.
              </p>
              <button
                type="button"
                disabled={regrading}
                onClick={handleRegradeAll}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-black inline-flex items-center gap-1.5 shrink-0">
                {regrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Hitung Ulang {hasilCount} Nilai
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(dist).map(([kode, count]) => {
              const meta = getTipeMeta(kode);
              return (
                <span
                  key={kode}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black border ${TIPE_COLOR[meta.color]}`}>
                  <span>{meta.short}:</span>
                  <span>{count} soal</span>
                </span>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((item) => {
              const meta = getTipeMeta(item.tipe);
              return (
                <div
                  key={item.no}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.025] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white/10 text-white text-xs font-black flex items-center justify-center shrink-0">
                      {item.no}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[meta.color]}`}>
                          {meta.short}
                        </span>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                          {item.perlakuan === 'anulir' ? '0 pts (Anulir)' : `${item.poin} pts`}
                        </span>
                        {item.perlakuan === 'bonus' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[8px] font-black">
                            BONUS
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                        {item.perlakuan === 'bonus'
                          ? 'Semua Siswa Benar (Bonus)'
                          : item.perlakuan === 'anulir'
                            ? 'Soal Dianulir (Tidak Dihitung)'
                            : formatJawaban(item)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 sm:px-6 pb-safe border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0e1a] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onPrintKunci(kunci)}
              className="px-3 py-2 rounded-xl bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 text-slate-800 dark:text-white text-xs font-black inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Cetak Kunci
            </button>
            <button
              type="button"
              onClick={() =>
                downloadSingleKunciXlsx(kunci, getMapelLabel(kunci.id_mapel), getKelasLabel(kunci.id_kelas))
              }
              className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-black inline-flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLjk(kunci);
              }}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black inline-flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Cetak LJK
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onScan(kunci);
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5">
              <Scan className="w-3.5 h-3.5" /> Scan LJK
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDuplicate(kunci);
              }}
              className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-black inline-flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Duplikat
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(kunci);
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black inline-flex items-center gap-1.5">
            <Edit2 className="w-3.5 h-3.5" /> Edit Kunci
          </button>
        </div>
      </div>
    </div>
  );
}

interface IrtModalProps {
  kunci: any | null;
  irtStats: any[];
  loading: boolean;
  onClose: () => void;
}

/** Modal Statistik Analisis Butir Soal Psikometri CTT & IRT Rasch (ramah mobile & pemula). */
export function KunciIrtModal({ kunci, irtStats, loading, onClose }: IrtModalProps) {
  useEffect(() => {
    if (!kunci) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kunci, onClose]);

  const summary = useMemo(() => {
    let mudah = 0;
    let sedang = 0;
    let sulit = 0;
    irtStats.forEach((r) => {
      if (r.category === 'Mudah') mudah++;
      else if (r.category === 'Sulit') sulit++;
      else sedang++;
    });
    return { mudah, sedang, sulit };
  }, [irtStats]);

  if (!kunci) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 lg:backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="irt-kunci-title">
      <div className="bg-white dark:bg-[#0d111d] border border-slate-200 dark:border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[88dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="irt-kunci-title"
                className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                Analisis Butir Soal (IRT / CTT)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {kunci.nama_mapel || kunci.id_mapel} {kunci.nama_kelas ? `· ${kunci.nama_kelas}` : ''} — {kunci.judul_ujian}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0"
            aria-label="Tutup analisis IRT">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto touch-scroll p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Menghitung tingkat kesukaran tiap butir soal...
              </p>
            </div>
          ) : irtStats.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <BarChart3 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Belum ada hasil koreksi siswa untuk ujian ini.
              </p>
            </div>
          ) : (
            <>
              {/* Ringkasan Mudah / Sedang / Sulit untuk Pemula */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center">
                  <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase">Mudah</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{summary.mudah} soal</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center">
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase">Sedang</p>
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400">{summary.sedang} soal</p>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-center">
                  <p className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase">Sulit</p>
                  <p className="text-lg font-black text-rose-600 dark:text-rose-400">{summary.sulit} soal</p>
                </div>
              </div>

              {/* Mobile Compact Cards */}
              <div className="space-y-2 sm:hidden">
                {irtStats.map((row: any) => {
                  const cat = String(row.category || 'Sedang');
                  const badgeCls =
                    cat === 'Mudah'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : cat === 'Sulit'
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
                  const pct = Math.round((Number(row.ctt_difficulty) || 0) * 100);
                  return (
                    <div
                      key={row.no}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.025] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white/10 text-white text-xs font-black flex items-center justify-center">
                          {row.no}
                        </span>
                        <div className="text-xs">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {pct}% benar ({row.benar}B / {row.salah}S)
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            P: {row.ctt_difficulty} · IRT b: {row.irt_difficulty}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${badgeCls}`}>
                        {cat}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-2.5 pr-3">No</th>
                      <th className="py-2.5 px-3">Benar / Salah</th>
                      <th className="py-2.5 px-3">Indeks P (CTT)</th>
                      <th className="py-2.5 px-3">Logit b (IRT)</th>
                      <th className="py-2.5 pl-3 text-right">Kategori</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                    {irtStats.map((row: any) => {
                      const cat = String(row.category || 'Sedang');
                      const badgeCls =
                        cat === 'Mudah'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : cat === 'Sulit'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
                      return (
                        <tr key={row.no} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 pr-3 font-black text-slate-900 dark:text-white">#{row.no}</td>
                          <td className="py-2.5 px-3 font-bold">
                            <span className="text-emerald-600 dark:text-emerald-400">{row.benar}</span>
                            {' / '}
                            <span className="text-rose-500">{row.salah}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {row.ctt_difficulty}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {row.irt_difficulty}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${badgeCls}`}>
                              {cat}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  kunci: any | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Modal Konfirmasi Hapus Master Kunci Jawaban dengan proteksi hasil scan siswa. */
export function KunciDeleteModal({ kunci, deleting, onCancel, onConfirm }: DeleteModalProps) {
  useEffect(() => {
    if (!kunci) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kunci, deleting, onCancel]);

  if (!kunci) return null;
  const hasilCount = Number(kunci.hasil_count) || 0;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 lg:backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-kunci-title">
      <div className="bg-white dark:bg-[#0d111d] border border-rose-500/30 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
            {hasilCount > 0 ? <Lock className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h3 id="delete-kunci-title" className="text-base font-black text-slate-900 dark:text-white">
              {hasilCount > 0 ? 'Kunci Dilindungi Hasil Siswa' : 'Hapus Kunci Jawaban?'}
            </h3>
            {hasilCount > 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Kunci <strong className="text-slate-900 dark:text-white">{kunci.nama_mapel || kunci.id_mapel} ({kunci.judul_ujian})</strong> sudah memiliki{' '}
                <strong className="text-rose-500">{hasilCount} hasil scan siswa</strong> di database. Sistem menolak penghapusan agar nilai siswa dan analisis butir tidak rusak. Hapus hasil terkait di menu Hasil terlebih dahulu bila perlu.
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Kunci <strong className="text-slate-800 dark:text-slate-200">{kunci.nama_mapel || kunci.id_mapel} ({kunci.judul_ujian})</strong> [{kunci.id_kunci}] akan dihapus permanen.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200">
            {hasilCount > 0 ? 'Tutup' : 'Batal'}
          </button>
          {hasilCount === 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={onConfirm}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-lg shadow-rose-500/20">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Ya, Hapus Permanen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
