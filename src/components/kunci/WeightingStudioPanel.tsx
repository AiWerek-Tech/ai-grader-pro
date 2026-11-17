'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Percent, Scale, ShieldCheck, Sliders, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { TIPE_COLOR, TipeSoalKode } from '@/lib/constants/tipe-soal';
import { SafeNumberInput } from './JawabanInput';
import {
  applyPercentagesByType,
  applyWeightsByType,
  autoScalePoinTo100,
  calcTotalPoin,
  KompleksMode,
  SoalItem,
  summarizeTypeGroups,
} from './kunci-utils';

export type WeightTab = 'percent' | 'per_type' | 'rules';

interface WeightingStudioPanelProps {
  soalItems: SoalItem[];
  onUpdateItems: (next: SoalItem[]) => void;
  kompleksMode: KompleksMode;
  onChangeKompleksMode: (mode: KompleksMode) => void;
  poinSalah: number;
  onChangePoinSalah: (val: number) => void;
}

/**
 * Panel Kewenangan Pembobotan Guru:
 * 1) Persentase (%) per Tipe Soal = 100%
 * 2) Poin Kustom per Tipe Soal (Skor Bebas / Proporsional 100)
 * 3) Aturan Skoring AKM Parsial vs Mutlak & Penalti Salah
 */
export default function WeightingStudioPanel({
  soalItems,
  onUpdateItems,
  kompleksMode,
  onChangeKompleksMode,
  poinSalah,
  onChangePoinSalah,
}: WeightingStudioPanelProps) {
  const [tab, setTab] = useState<WeightTab>('percent');

  const typeSummaries = useMemo(() => summarizeTypeGroups(soalItems), [soalItems]);
  const totalPoin = useMemo(() => calcTotalPoin(soalItems), [soalItems]);

  const [pctInputs, setPctInputs] = useState<Record<string, number>>({});
  const [poinInputs, setPoinInputs] = useState<Record<string, number>>({});

  // Sinkronkan nilai input default tiap tipe aktif ketika daftar tipe/butir berubah
  const typeKeySig = useMemo(
    () =>
      typeSummaries
        .map((g) => `${g.kode}:${g.activeCount}:${g.totalPoin}:${g.pctOfTotal}`)
        .join('|'),
    [typeSummaries]
  );

  useEffect(() => {
    const nextPct: Record<string, number> = {};
    const nextPoin: Record<string, number> = {};
    typeKeySig
      .split('|')
      .filter(Boolean)
      .forEach((entry) => {
        const [kode, activeStr, totalStr, pctStr] = entry.split(':');
        const activeCount = Number(activeStr) || 0;
        const totalPoinGroup = Number(totalStr) || 0;
        const pct = Number(pctStr) || 0;
        nextPct[kode] = Math.round(pct * 10) / 10;
        nextPoin[kode] =
          activeCount > 0 ? Math.round((totalPoinGroup / activeCount) * 100) / 100 : 1;
      });
    setPctInputs(nextPct);
    setPoinInputs(nextPoin);
  }, [typeKeySig]);

  const sumPct = useMemo(
    () =>
      Math.round(
        typeSummaries.reduce((acc, g) => acc + Math.max(0, Number(pctInputs[g.kode]) || 0), 0) * 10
      ) / 10,
    [typeSummaries, pctInputs]
  );

  const handleApplyPercentages = () => {
    if (sumPct <= 0) {
      toast.error('Masukkan persentase lebih dari 0%.');
      return;
    }
    const cleanMap: Partial<Record<TipeSoalKode, number>> = {};
    typeSummaries.forEach((g) => {
      cleanMap[g.kode] = Math.max(0, Number(pctInputs[g.kode]) || 0);
    });
    const next = applyPercentagesByType(soalItems, cleanMap);
    onUpdateItems(next);
    toast.success('Bobot persentase per tipe diterapkan (Total = 100 Poin).');
  };

  const handleApplyTypeWeights = () => {
    const cleanMap: Partial<Record<TipeSoalKode, number>> = {};
    typeSummaries.forEach((g) => {
      cleanMap[g.kode] = Math.max(0.05, Number(poinInputs[g.kode]) || 1);
    });
    const next = applyWeightsByType(soalItems, cleanMap);
    onUpdateItems(next);
    toast.success(`Poin per tipe diterapkan (Total skor mentah: ${calcTotalPoin(next)} poin).`);
  };

  const handleScale = (mode: 'proportional' | 'equal') => {
    const next = autoScalePoinTo100(soalItems, mode);
    onUpdateItems(next);
    toast.success(
      mode === 'proportional'
        ? 'Seluruh poin diskalakan proporsional ke Total = 100.'
        : 'Seluruh poin soal dibagi rata ke Total = 100.'
    );
  };

  const isExact100 = Math.abs(totalPoin - 100) < 0.05;

  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3.5">
      {/* Header & Ringkasan Transparansi Skor */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-500" />
            Pengaturan Pembobotan &amp; Penilaian Guru
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Total Skor Mentah:{' '}
            <strong
              className={
                isExact100
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-indigo-600 dark:text-indigo-400'
              }>
              {totalPoin} Poin
            </strong>{' '}
            · Nilai akhir siswa otomatis dikonversi ke skala <strong>0–100</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'percent' as const, label: 'Persen (%)', icon: Percent },
            { id: 'per_type' as const, label: 'Poin / Tipe', icon: Calculator },
            { id: 'rules' as const, label: 'Aturan Koreksi', icon: Sliders },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black inline-flex items-center gap-1 border transition-colors ${
                tab === t.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
              }`}>
              <t.icon className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: PERSENTASE PER TIPE = 100% */}
      {tab === 'percent' && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tentukan porsi persentase tiap tipe soal yang ada (total 100%). Sistem otomatis membagi rata poin ke semua butir pada tipe tersebut.
          </p>

          <div className="space-y-2">
            {typeSummaries.map((g) => {
              const pctVal = Number(pctInputs[g.kode]) || 0;
              const estPerSoal =
                g.activeCount > 0 && sumPct > 0
                  ? Math.round((((pctVal / sumPct) * 100) / g.activeCount) * 100) / 100
                  : 0;
              return (
                <div
                  key={g.kode}
                  className="p-2.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${TIPE_COLOR[g.color]}`}>
                      {g.short}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                        {g.label}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {g.activeCount} soal aktif · ±<strong>{estPerSoal}</strong> poin/soal
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
                    <SafeNumberInput
                      value={pctVal}
                      min={0}
                      max={100}
                      step={1}
                      ariaLabel={`Persentase ${g.label}`}
                      onChangeValue={(v) => setPctInputs((p) => ({ ...p, [g.kode]: v }))}
                      className="w-16 h-8 px-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-emerald-500/35 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none"
                    />
                    <span>%</span>
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Jumlah Input:{' '}
              <strong className={Math.abs(sumPct - 100) < 0.2 ? 'text-emerald-600' : 'text-amber-500'}>
                {sumPct}%
              </strong>
              {Math.abs(sumPct - 100) >= 0.2 && ' (otomatis dinormalkan ke 100%)'}
            </span>
            <button
              type="button"
              onClick={handleApplyPercentages}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm">
              <Wand2 className="w-3.5 h-3.5" /> Terapkan Persentase
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: POIN BEBAS PER TIPE + AUTO SCALE 100 */}
      {tab === 'per_type' && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Atur poin bebas tiap jenis soal (mendukung desimal seperti 0.25, 1.5, 2.5). Total skor mentah tidak harus 100 karena nilai akhir otomatis dinormalisasi ke 0–100.
          </p>

          <div className="space-y-2">
            {typeSummaries.map((g) => {
              const unitVal = Number(poinInputs[g.kode]) || 1;
              const subTotal = Math.round(unitVal * g.activeCount * 100) / 100;
              return (
                <div
                  key={g.kode}
                  className="p-2.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${TIPE_COLOR[g.color]}`}>
                      {g.short}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                        {g.label}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {g.activeCount} soal × {unitVal}p = <strong>{subTotal} poin</strong>
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span>Poin/soal</span>
                    <SafeNumberInput
                      value={unitVal}
                      min={0.05}
                      max={100}
                      step={0.25}
                      ariaLabel={`Poin per soal ${g.label}`}
                      onChangeValue={(v) => setPoinInputs((p) => ({ ...p, [g.kode]: v }))}
                      className="w-16 h-8 px-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-indigo-500/35 text-center text-xs font-black text-indigo-600 dark:text-indigo-400 outline-none"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleScale('proportional')}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-700 dark:text-slate-200 hover:border-emerald-400">
                Skala Proporsional → 100
              </button>
              <button
                type="button"
                onClick={() => handleScale('equal')}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-700 dark:text-slate-200 hover:border-emerald-400">
                Samakan Semua → 100
              </button>
            </div>
            <button
              type="button"
              onClick={handleApplyTypeWeights}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm">
              Terapkan Poin Tipe
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: ATURAN KOREKSI GURU (AKM PARSIAL & PENALTI SALAH) */}
      {tab === 'rules' && (
        <div className="space-y-3.5">
          <div className="space-y-2">
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
              Penilaian Soal AKM Kompleks (PGK, MTF, Menjodohkan)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: 'mutlak' as const,
                  title: 'Mutlak (Semua Harus Tepat)',
                  desc: 'Poin penuh hanya diberikan jika seluruh sub-pernyataan / pasangan tepat.',
                },
                {
                  id: 'parsial' as const,
                  title: 'Parsial Proporsional',
                  desc: 'Siswa mendapat poin sebagian sesuai proporsi sub-jawaban yang benar.',
                },
              ].map((opt) => {
                const active = kompleksMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeKompleksMode(opt.id)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      active
                        ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/20'
                        : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10 hover:border-purple-400'
                    }`}>
                    <div className="text-xs font-black text-slate-900 dark:text-white">{opt.title}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/10">
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">
              Penalti Jawaban Salah (Khusus Soal Objektif)
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Berlaku jika siswa memilih jawaban salah; soal yang dikosongkan tetap bernilai 0 (tidak dikurangi).
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: 'Tanpa Penalti (0)', val: 0 },
                { label: '-0.25 poin', val: -0.25 },
                { label: '-0.5 poin', val: -0.5 },
                { label: '-1 poin (UTBK)', val: -1 },
              ].map((p) => {
                const active = Math.abs(poinSalah - p.val) < 0.001;
                return (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => onChangePoinSalah(p.val)}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                      active
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                    }`}>
                    {p.label}
                  </button>
                );
              })}
              <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">
                Kustom:
                <SafeNumberInput
                  value={poinSalah}
                  min={-10}
                  max={0}
                  step={0.25}
                  ariaLabel="Penalti salah kustom"
                  onChangeValue={onChangePoinSalah}
                  className="w-16 h-7 px-2 rounded-lg bg-white dark:bg-[#050314] border border-rose-500/30 text-rose-500 font-black text-xs text-center outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
