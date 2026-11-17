'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Scale,
  Sliders,
  Wand2,
} from 'lucide-react';
import { SafeNumberInput } from './JawabanInput';
import {
  autoDistributeCompositionPct,
  CompositionConfig,
  getCompositionTotals,
  KompleksMode,
  LjkEstimateSummary,
} from './kunci-utils';

interface CompositionConfiguratorProps {
  config: CompositionConfig;
  onChange: (next: CompositionConfig) => void;
  ljkEstimate: LjkEstimateSummary;
  kompleksMode: KompleksMode;
  onChangeKompleksMode: (mode: KompleksMode) => void;
  poinSalah: number;
  onChangePoinSalah: (val: number) => void;
  isLegacyInterleaved?: boolean;
}

/** Konfigurator Komposisi Soal & Bobot Nilai (%) gaya Bank Soal Modern (bersih & tanpa fitur membingungkan). */
export default function CompositionConfigurator({
  config,
  onChange,
  ljkEstimate,
  kompleksMode,
  onChangeKompleksMode,
  poinSalah,
  onChangePoinSalah,
  isLegacyInterleaved = false,
}: CompositionConfiguratorProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    kompleksMode === 'parsial' || poinSalah < 0
  );

  const { totalSoal, totalPct } = useMemo(() => getCompositionTotals(config), [config]);
  const isExact100 = Math.abs(totalPct - 100) < 0.05;
  const diffPct = Math.round((100 - totalPct) * 10) / 10;

  const update = (patch: Partial<CompositionConfig>) => onChange({ ...config, ...patch });

  const perItemText = (count: number, pct: number) => {
    if (count <= 0) return null;
    const per = Math.round((pct / count) * 100) / 100;
    return `±${per} poin / soal`;
  };

  const activeTypeCount = [
    config.pgCount,
    config.tfCount,
    config.pgkCount,
    config.mtfCount,
    config.jdhCount,
    config.isnCount,
    config.esiCount,
  ].filter((c) => c > 0).length;

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Konfigurasi Jumlah Soal &amp; Bobot Nilai
            </h4>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-[10px] font-black text-slate-600 dark:text-slate-300">
            {activeTypeCount} Jenis Aktif
          </span>
        </div>

        {isLegacyInterleaved && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] font-medium text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Kunci lama ini memiliki susunan tipe nomor yang berselang-seling. Mengubah angka komposisi di bawah akan menyusun ulang nomor berurutan per jenis soal.
            </span>
          </div>
        )}

        {/* Grid Kartu 7 Jenis Soal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Pilihan Ganda (PG) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
              config.pgCount > 0
                ? 'bg-indigo-500/5 border-indigo-500/40 ring-1 ring-indigo-500/15'
                : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                Soal Pilihan Ganda (PG)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[9px] font-black">
                Paling Umum
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Jml. Soal
                <SafeNumberInput
                  value={config.pgCount}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Jumlah Soal PG"
                  onChangeValue={(v) => update({ pgCount: Math.round(v) })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Bobot %
                <SafeNumberInput
                  value={config.pgPct}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Bobot Persen PG"
                  onChangeValue={(v) => update({ pgPct: v })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Pilihan Opsi
                <select
                  value={config.pgOpsi}
                  onChange={(e) => update({ pgOpsi: e.target.value as '4' | '5' })}
                  aria-label="Pilihan Opsi PG"
                  className="mt-1 w-full h-9 px-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-black text-slate-800 dark:text-white outline-none">
                  <option value="5" className="bg-white dark:bg-[#0d111d]">
                    A–E (5)
                  </option>
                  <option value="4" className="bg-white dark:bg-[#0d111d]">
                    A–D (4)
                  </option>
                </select>
              </label>
            </div>
            {config.pgCount > 0 && (
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {perItemText(config.pgCount, config.pgPct)}
              </p>
            )}
          </div>

          {/* 2. Benar / Salah */}
          <div
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
              config.tfCount > 0
                ? 'bg-teal-500/5 border-teal-500/40 ring-1 ring-teal-500/15'
                : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-teal-700 dark:text-teal-300">
                Soal Benar / Salah (B/S)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[9px] font-black">
                Tunggal
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Jml. Soal
                <SafeNumberInput
                  value={config.tfCount}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Jumlah Soal Benar Salah"
                  onChangeValue={(v) => update({ tfCount: Math.round(v) })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-slate-900 dark:text-white outline-none focus:border-teal-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Bobot Nilai %
                <SafeNumberInput
                  value={config.tfPct}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Bobot Persen Benar Salah"
                  onChangeValue={(v) => update({ tfPct: v })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            {config.tfCount > 0 && (
              <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                {perItemText(config.tfCount, config.tfPct)}
              </p>
            )}
          </div>

          {/* 3. Ganda Kompleks (PGK) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
              config.pgkCount > 0
                ? 'bg-sky-500/5 border-sky-500/40 ring-1 ring-sky-500/15'
                : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-sky-700 dark:text-sky-300">
                Soal Ganda Kompleks
              </span>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[9px] font-black">
                Multi Jawaban
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Jml. Soal
                <SafeNumberInput
                  value={config.pgkCount}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Jumlah Soal PGK"
                  onChangeValue={(v) => update({ pgkCount: Math.round(v) })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-slate-900 dark:text-white outline-none focus:border-sky-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Bobot Nilai %
                <SafeNumberInput
                  value={config.pgkPct}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Bobot Persen PGK"
                  onChangeValue={(v) => update({ pgkPct: v })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            {config.pgkCount > 0 && (
              <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                {perItemText(config.pgkCount, config.pgkPct)}
              </p>
            )}
          </div>

          {/* 4. Benar-Salah Majemuk (MTF) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
              config.mtfCount > 0
                ? 'bg-cyan-500/5 border-cyan-500/40 ring-1 ring-cyan-500/15'
                : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-cyan-700 dark:text-cyan-300">
                Benar-Salah Majemuk (MTF)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[9px] font-black">
                AKM
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Jml. Soal
                <SafeNumberInput
                  value={config.mtfCount}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Jumlah Soal MTF"
                  onChangeValue={(v) => update({ mtfCount: Math.round(v) })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Bobot Nilai %
                <SafeNumberInput
                  value={config.mtfPct}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Bobot Persen MTF"
                  onChangeValue={(v) => update({ mtfPct: v })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            {config.mtfCount > 0 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                  {perItemText(config.mtfCount, config.mtfPct)}
                </p>
                <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Pernyataan:</span>
                  <SafeNumberInput
                    value={config.mtfPernyataan}
                    min={2}
                    max={10}
                    step={1}
                    ariaLabel="Default pernyataan MTF"
                    onChangeValue={(v) => update({ mtfPernyataan: Math.round(v) })}
                    className="w-11 h-6 px-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-[11px] font-black"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 5. Menjodohkan */}
          <div
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
              config.jdhCount > 0
                ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/15'
                : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                Soal Menjodohkan
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black">
                Pasangan
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Jml. Soal
                <SafeNumberInput
                  value={config.jdhCount}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Jumlah Soal Menjodohkan"
                  onChangeValue={(v) => update({ jdhCount: Math.round(v) })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Bobot Nilai %
                <SafeNumberInput
                  value={config.jdhPct}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Bobot Persen Menjodohkan"
                  onChangeValue={(v) => update({ jdhPct: v })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            {config.jdhCount > 0 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {perItemText(config.jdhCount, config.jdhPct)}
                </p>
                <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Pasang:</span>
                  <SafeNumberInput
                    value={config.jdhPasang}
                    min={2}
                    max={5}
                    step={1}
                    ariaLabel="Default pasang Menjodohkan"
                    onChangeValue={(v) => update({ jdhPasang: Math.round(v) })}
                    className="w-11 h-6 px-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-[11px] font-black"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 6. Isian Singkat */}
          <div
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
              config.isnCount > 0
                ? 'bg-orange-500/5 border-orange-500/40 ring-1 ring-orange-500/15'
                : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-orange-700 dark:text-orange-300">
                Soal Isian Singkat
              </span>
              <span className="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-700 dark:text-orange-300 text-[9px] font-black">
                Kata / Angka
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Jml. Soal
                <SafeNumberInput
                  value={config.isnCount}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Jumlah Soal Isian Singkat"
                  onChangeValue={(v) => update({ isnCount: Math.round(v) })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-slate-900 dark:text-white outline-none focus:border-orange-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Bobot Nilai %
                <SafeNumberInput
                  value={config.isnPct}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Bobot Persen Isian Singkat"
                  onChangeValue={(v) => update({ isnPct: v })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            {config.isnCount > 0 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                  {perItemText(config.isnCount, config.isnPct)}
                </p>
                <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Kotak LJK:</span>
                  <SafeNumberInput
                    value={config.isnPanjang}
                    min={3}
                    max={20}
                    step={1}
                    ariaLabel="Default panjang kotak Isian"
                    onChangeValue={(v) => update({ isnPanjang: Math.round(v) })}
                    className="w-11 h-6 px-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-[11px] font-black"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 7. Uraian / Esai */}
          <div
            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 lg:col-span-3 ${
              config.esiCount > 0
                ? 'bg-rose-500/5 border-rose-500/40 ring-1 ring-rose-500/15'
                : 'bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10'
            }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                  Soal Uraian / Esai
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[9px] font-black">
                  Rubrik AI / Nilai Manual
                </span>
              </div>
              {config.esiCount > 0 && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  {perItemText(config.esiCount, config.esiPct)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Jml. Soal
                <SafeNumberInput
                  value={config.esiCount}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Jumlah Soal Esai"
                  onChangeValue={(v) => update({ esiCount: Math.round(v) })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-slate-900 dark:text-white outline-none focus:border-rose-500"
                />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Bobot Nilai %
                <SafeNumberInput
                  value={config.esiPct}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Bobot Persen Esai"
                  onChangeValue={(v) => update({ esiPct: v })}
                  className="mt-1 w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
              <p className="col-span-2 text-[11px] text-slate-500 dark:text-slate-400 leading-snug pb-1">
                Kunci jawaban esai bersifat opsional (bisa diisi kata kunci untuk koreksi AI atau dikosongkan untuk nilai manual guru).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rekapitulasi Soal & Bobot (Gaya Gambar 4) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.025] border border-slate-200 dark:border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-purple-500" />
            Rekapitulasi Soal &amp; Bobot
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {totalSoal > 0 && !isExact100 && (
              <button
                type="button"
                onClick={() => onChange(autoDistributeCompositionPct(config))}
                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black inline-flex items-center gap-1 shadow-sm">
                <Wand2 className="w-3 h-3" /> Bagi Otomatis 100%
              </button>
            )}
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 border ${
                totalSoal === 0
                  ? 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'
                  : isExact100
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : diffPct > 0
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
              }`}>
              {totalSoal === 0 ? (
                'Isi jumlah soal'
              ) : isExact100 ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Siap · Tepat 100%
                </>
              ) : diffPct > 0 ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> Kurang {diffPct}%
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" /> Lebih {Math.abs(diffPct)}%
                </>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Soal</p>
            <p
              className={`text-2xl font-black mt-0.5 ${
                totalSoal > 100 ? 'text-rose-500' : 'text-slate-900 dark:text-white'
              }`}>
              {totalSoal}
            </p>
            <p className="text-[10px] text-slate-500">
              {totalSoal > 100 ? 'Maksimal 100 butir!' : 'Butir Soal (Maks. 100)'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total Bobot Nilai
            </p>
            <p
              className={`text-2xl font-black mt-0.5 ${
                isExact100
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
              {totalPct}%
            </p>
            <p className="text-[10px] text-slate-500">Target Wajib: 100%</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex flex-col justify-between gap-1.5">
            <div>
              <p className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                Ketentuan &amp; LJK Otomatis
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                {totalSoal > 0
                  ? `Tata letak LJK: ${ljkEstimate.columns} Kolom · ${ljkEstimate.densityLabel}. Poin per butir terhitung otomatis dari persentase.`
                  : 'Isi minimal 1 jenis soal dan pastikan total bobot = 100% untuk lanjut mengisi kunci.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-[10px] font-black text-purple-600 dark:text-purple-400 inline-flex items-center gap-1 hover:underline self-start">
              <Sliders className="w-3 h-3" />
              <span>Opsi Koreksi Lanjutan</span>
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Accordion Opsi Koreksi Lanjutan (Tertutup secara default agar bersih) */}
        {showAdvanced && (
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Skoring Soal Kompleks (PGK / MTF / Menjodohkan)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'mutlak' as const, label: 'Mutlak (Semua Tepat)' },
                  { id: 'parsial' as const, label: 'Parsial Proporsional' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeKompleksMode(opt.id)}
                    className={`px-2.5 py-2 rounded-xl text-[10px] font-black border transition-all ${
                      kompleksMode === opt.id
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Penalti Jawaban Salah (Soal Objektif)
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '0 (Tanpa)', val: 0 },
                  { label: '-0.25', val: -0.25 },
                  { label: '-0.5', val: -0.5 },
                  { label: '-1 (UTBK)', val: -1 },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => onChangePoinSalah(p.val)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                      Math.abs(poinSalah - p.val) < 0.001
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                    }`}>
                    {p.label}
                  </button>
                ))}
                <SafeNumberInput
                  value={poinSalah}
                  min={-10}
                  max={0}
                  step={0.25}
                  ariaLabel="Penalti salah kustom"
                  onChangeValue={onChangePoinSalah}
                  className="w-16 h-7 px-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-rose-500/30 text-center text-xs font-black text-rose-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
