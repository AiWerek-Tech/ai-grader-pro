'use client';

import React, { useEffect, useState } from 'react';
import { buildMatchingSingleOptions, getTipeMeta } from '@/lib/constants/tipe-soal';
import { Check, Minus, Plus, Sparkles, UserCheck } from 'lucide-react';
import { SoalItem } from './kunci-utils';

interface NumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChangeValue: (val: number) => void;
  className?: string;
  ariaLabel?: string;
}

/** Input angka bebas lag ketik: izinkan kosong saat mengetik dan clamp hanya saat blur. */
export function SafeNumberInput({
  value,
  min = 0.5,
  max = 100,
  step = 0.5,
  onChangeValue,
  className = '',
  ariaLabel,
}: NumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const num = Number(raw);
    if (!Number.isFinite(num) || raw.trim() === '') {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, num));
    setDraft(String(clamped));
    if (clamped !== value) onChangeValue(clamped);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const val = e.target.value;
        setDraft(val);
        const parsed = Number(val);
        if (val.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
          onChangeValue(parsed);
        }
      }}
      onBlur={() => commit(draft)}
      className={className}
    />
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}

/** Stepper kompak `- / +` untuk jumlah pernyataan MTF, pasang JDH, atau kotak LJK ISN. */
function SubStepper({ label, value, min, max, onChange }: StepperProps) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-1">
      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-6 h-6 rounded-lg bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-white/10 disabled:opacity-35 hover:bg-slate-50 active:scale-95 transition-all"
        aria-label={`Kurangi ${label}`}>
        <Minus className="w-3 h-3" />
      </button>
      <span className="min-w-[1.25rem] text-center text-xs font-black text-slate-900 dark:text-white">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-6 h-6 rounded-lg bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-white/10 disabled:opacity-35 hover:bg-slate-50 active:scale-95 transition-all"
        aria-label={`Tambah ${label}`}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

interface JawabanInputProps {
  item: SoalItem;
  onChangeJawaban: (val: any) => void;
  onPatchItem?: (patch: Partial<SoalItem>) => void;
}

/** Editor interaktif kunci jawaban & sub-konfigurasi tipe AKM (dipakai konsisten di Mobile & Desktop). */
export default function JawabanInput({ item, onChangeJawaban, onPatchItem }: JawabanInputProps) {
  const tipeDef = getTipeMeta(item.tipe);
  const patch = (next: Partial<SoalItem>) => {
    if (onPatchItem) onPatchItem(next);
    else if (next.jawaban !== undefined) onChangeJawaban(next.jawaban);
  };

  if (item.tipe === 'single_choice' || item.tipe === 'single_choice_4') {
    const opsi = item.opsi?.length ? item.opsi : tipeDef.opsi;
    return (
      <div className="flex flex-wrap gap-1.5">
        {opsi.map((o) => {
          const active = item.jawaban === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChangeJawaban(o)}
              className={`min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
                active
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30 ring-2 ring-purple-500/30'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-purple-400'
              }`}>
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  if (item.tipe === 'true_false') {
    return (
      <div className="flex flex-wrap gap-2">
        {[
          { code: 'B', label: 'Benar', activeCls: 'bg-emerald-600 text-white ring-2 ring-emerald-500/30' },
          { code: 'S', label: 'Salah', activeCls: 'bg-rose-600 text-white ring-2 ring-rose-500/30' },
        ].map((opt) => {
          const active = item.jawaban === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => onChangeJawaban(opt.code)}
              className={`h-9 px-3.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
                active
                  ? opt.activeCls
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-slate-400'
              }`}>
              {opt.code} <span className="font-bold opacity-85">({opt.label})</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (item.tipe === 'multiple_select') {
    const selected: string[] = Array.isArray(item.jawaban) ? item.jawaban : [];
    const opsi = item.opsi?.length ? item.opsi : ['A', 'B', 'C', 'D', 'E'];
    const toggle = (o: string) => {
      const next = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o].sort();
      onChangeJawaban(next);
    };
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1.5">
          {opsi.map((o) => {
            const active = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className={`min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-black inline-flex items-center justify-center gap-1 transition-all active:scale-95 ${
                  active
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/25 ring-2 ring-sky-500/30'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-sky-400'
                }`}>
                {active && <Check className="w-3 h-3" />}
                {o}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Pilih lebih dari 1 opsi benar ({selected.length} dipilih)
        </p>
      </div>
    );
  }

  if (item.tipe === 'multiple_true_false') {
    const jp = Math.max(2, Math.min(10, Number(item.jumlah_pernyataan) || 3));
    const arr: string[] = Array.from({ length: jp }, (_, i) =>
      Array.isArray(item.jawaban) ? item.jawaban[i] || 'B' : 'B'
    );
    const setItem = (idx: number, val: 'B' | 'S') => {
      const next = [...arr];
      next[idx] = val;
      onChangeJawaban(next);
    };
    const updateJumlah = (nextJp: number) => {
      const oldArr = Array.isArray(item.jawaban) ? item.jawaban : [];
      const newArr = Array.from({ length: nextJp }, (_, i) => oldArr[i] || (i % 2 === 0 ? 'B' : 'S'));
      patch({ jumlah_pernyataan: nextJp, jawaban: newArr });
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {arr.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setItem(i, v === 'B' ? 'S' : 'B')}
              className={`h-8 px-2.5 rounded-xl text-[11px] font-black border inline-flex items-center gap-1 transition-all active:scale-95 ${
                v === 'B'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
              }`}
              title={`Klik untuk ganti P${i + 1}`}>
              <span className="opacity-65">P{i + 1}:</span>
              <span>{v === 'B' ? 'Benar' : 'Salah'}</span>
            </button>
          ))}
        </div>
        {onPatchItem && (
          <SubStepper label="Pernyataan" value={jp} min={2} max={10} onChange={updateJumlah} />
        )}
      </div>
    );
  }

  if (item.tipe === 'matching_single') {
    const opsi = item.opsi && item.opsi.length >= 5 ? item.opsi : buildMatchingSingleOptions(10);
    const opsiCount = Math.max(5, Math.min(12, opsi.length));
    const lastLetter = opsi[opsi.length - 1] || 'J';

    const updateOpsiCount = (nextCount: number) => {
      const nextOpsi = buildMatchingSingleOptions(nextCount);
      const curAns = typeof item.jawaban === 'string' ? item.jawaban.trim().toUpperCase() : '';
      patch({
        opsi: nextOpsi,
        jawaban: nextOpsi.includes(curAns) ? curAns : '',
      });
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {opsi.map((o) => {
            const active = item.jawaban === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChangeJawaban(o)}
                aria-label={`Nomor ${item.no} pasangan ${o}`}
                aria-pressed={active}
                className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                  active
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/40'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                }`}>
                {o}
              </button>
            );
          })}
        </div>
        {onPatchItem && (
          <div className="flex flex-wrap items-center gap-2">
            <SubStepper
              label={`Opsi A–${lastLetter}`}
              value={opsiCount}
              min={5}
              max={12}
              onChange={updateOpsiCount}
            />
          </div>
        )}
      </div>
    );
  }

  if (item.tipe === 'matching') {
    const jps = Math.max(2, Math.min(5, Number(item.jumlah_pasang) || 3));
    const obj: Record<string, string> =
      item.jawaban && typeof item.jawaban === 'object' ? item.jawaban : {};
    const pairs = Array.from({ length: jps }, (_, i) => String(i + 1));
    const setPair = (k: string, val: string) => onChangeJawaban({ ...obj, [k]: val });

    const updatePasang = (nextJps: number) => {
      const opts = ['A', 'B', 'C', 'D', 'E'];
      const newMap: Record<string, string> = {};
      for (let i = 1; i <= nextJps; i++) {
        newMap[String(i)] = obj[String(i)] || opts[(i - 1) % 5];
      }
      patch({ jumlah_pasang: nextJps, jawaban: newMap });
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {pairs.map((k) => (
            <label
              key={k}
              className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 rounded-xl px-2 py-1">
              <span className="text-[11px] font-black text-amber-700 dark:text-amber-300">{k}→</span>
              <select
                value={obj[k] || 'A'}
                onChange={(e) => setPair(k, e.target.value)}
                aria-label={`Pasangan nomor ${item.no} baris ${k}`}
                className="bg-transparent text-xs font-black text-slate-900 dark:text-white outline-none cursor-pointer">
                {['A', 'B', 'C', 'D', 'E'].map((o) => (
                  <option key={o} value={o} className="bg-white dark:bg-[#0e0a2a]">
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {onPatchItem && (
          <SubStepper label="Pasangan LJK" value={jps} min={2} max={5} onChange={updatePasang} />
        )}
      </div>
    );
  }

  if (item.tipe === 'short_answer') {
    return (
      <div className="w-full">
        <input
          type="text"
          value={typeof item.jawaban === 'string' ? item.jawaban : ''}
          onChange={(e) => onChangeJawaban(e.target.value)}
          placeholder="Contoh: 42 | 3/4 | Soekarno (pisah variasi jawaban pakai |)"
          className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#050314] border border-orange-400/40 dark:border-orange-500/30 text-slate-900 dark:text-white font-semibold text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
        />
      </div>
    );
  }

  // essay
  const valStr = typeof item.jawaban === 'string' ? item.jawaban : '';
  const isManual = valStr.trim().length === 0;
  return (
    <div className="space-y-1.5 w-full">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChangeJawaban('')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 border transition-all ${
            isManual
              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
          }`}>
          <UserCheck className="w-3 h-3" /> Nilai Manual Guru
        </button>
        <button
          type="button"
          onClick={() => {
            if (isManual) onChangeJawaban('kata kunci 1 | kata kunci 2');
          }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 border transition-all ${
            !isManual
              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
          }`}>
          <Sparkles className="w-3 h-3" /> Rubrik Kata Kunci AI
        </button>
      </div>
      <input
        type="text"
        value={valStr}
        onChange={(e) => onChangeJawaban(e.target.value)}
        placeholder="Kosongkan untuk nilai manual, atau isi kata kunci pisah |"
        className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#050314] border border-rose-400/35 dark:border-rose-500/25 text-slate-900 dark:text-white font-semibold text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
      />
    </div>
  );
}
