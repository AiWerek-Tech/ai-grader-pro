'use client';

import React, { useRef, useState } from 'react';
import { Keyboard, SlidersHorizontal } from 'lucide-react';
import { formatJawaban, getTipeMeta, TIPE_COLOR } from '@/lib/constants/tipe-soal';
import { isSoalFilled, SoalItem } from './kunci-utils';

interface QuickTapGridProps {
  items: SoalItem[];
  onChangeJawaban: (no: number, jawaban: any) => void;
  onInspectInDetail: (no: number) => void;
}

/**
 * Mode Papan Cepat (Matriks Ringkas LJK): memungkinkan pengisian cepat 40-100 soal
 * dengan satu ketukan atau pintasan keyboard (tekan A-E / B-S lalu otomatis lanjut nomor).
 */
export default function QuickTapGrid({
  items,
  onChangeJawaban,
  onInspectInDetail,
}: QuickTapGridProps) {
  const [focusedNo, setFocusedNo] = useState<number | null>(items[0]?.no ?? null);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const moveNext = (currentIdx: number) => {
    const nextItem = items[currentIdx + 1];
    if (nextItem) {
      setFocusedNo(nextItem.no);
      rowRefs.current[nextItem.no]?.focus();
    }
  };

  const movePrev = (currentIdx: number) => {
    const prevItem = items[currentIdx - 1];
    if (prevItem) {
      setFocusedNo(prevItem.no);
      rowRefs.current[prevItem.no]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: SoalItem, idx: number) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      moveNext(idx);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      movePrev(idx);
      return;
    }

    const key = e.key.toUpperCase();
    if (item.tipe === 'single_choice' || item.tipe === 'single_choice_4') {
      const allowed = item.tipe === 'single_choice_4' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
      if (allowed.includes(key)) {
        e.preventDefault();
        onChangeJawaban(item.no, key);
        moveNext(idx);
      }
    } else if (item.tipe === 'true_false') {
      if (key === 'B' || key === 'S') {
        e.preventDefault();
        onChangeJawaban(item.no, key);
        moveNext(idx);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
        <Keyboard className="w-3.5 h-3.5 shrink-0" />
        <span>
          Tips Keyboard: klik nomor soal lalu tekan huruf <strong>A–E</strong> (atau <strong>B/S</strong>) untuk langsung mengisi dan pindah ke nomor berikutnya.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((item, idx) => {
          const meta = getTipeMeta(item.tipe);
          const filled = isSoalFilled(item);
          const isFocused = focusedNo === item.no;

          const isSinglePg = item.tipe === 'single_choice' || item.tipe === 'single_choice_4';
          const isTf = item.tipe === 'true_false';
          const isPgk = item.tipe === 'multiple_select';

          return (
            <div
              key={item.no}
              ref={(el) => {
                rowRefs.current[item.no] = el;
              }}
              tabIndex={0}
              onFocus={() => setFocusedNo(item.no)}
              onKeyDown={(e) => handleKeyDown(e, item, idx)}
              className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 outline-none transition-colors ${
                isFocused
                  ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/5'
                  : filled
                    ? 'bg-white dark:bg-white/[0.025] border-slate-200 dark:border-white/10'
                    : 'bg-amber-500/5 border-amber-500/35'
              }`}>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`w-7 h-7 rounded-lg text-[11px] font-black flex items-center justify-center ${
                    filled
                      ? 'bg-slate-900 dark:bg-white/10 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                  {item.no}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${TIPE_COLOR[meta.color]}`}>
                  {meta.short}
                </span>
              </div>

              <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
                {item.perlakuan === 'bonus' || item.perlakuan === 'anulir' ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onInspectInDetail(item.no)}
                    className={`px-2.5 h-7 rounded-lg text-[10px] font-black border ${
                      item.perlakuan === 'bonus'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-white/20'
                    }`}>
                    {item.perlakuan === 'bonus' ? 'BONUS PENUH' : 'DIANULIR (0p)'}
                  </button>
                ) : (
                  isSinglePg &&
                  (item.opsi?.length ? item.opsi : meta.opsi).map((o) => (
                    <button
                      key={o}
                      type="button"
                      tabIndex={-1}
                      onClick={() => onChangeJawaban(item.no, o)}
                      className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all ${
                        item.jawaban === o
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-purple-400'
                      }`}>
                      {o}
                    </button>
                  ))
                )}

                {item.perlakuan !== 'bonus' &&
                  item.perlakuan !== 'anulir' &&
                  isTf &&
                  ['B', 'S'].map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      tabIndex={-1}
                      onClick={() => onChangeJawaban(item.no, tf)}
                      className={`px-3 h-7 rounded-lg text-[11px] font-black transition-all ${
                        item.jawaban === tf
                          ? tf === 'B'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                      }`}>
                      {tf}
                    </button>
                  ))}

                {item.perlakuan !== 'bonus' &&
                  item.perlakuan !== 'anulir' &&
                  isPgk &&
                  (item.opsi?.length ? item.opsi : ['A', 'B', 'C', 'D', 'E']).map((o) => {
                    const sel: string[] = Array.isArray(item.jawaban) ? item.jawaban : [];
                    const active = sel.includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          const next = active ? sel.filter((x) => x !== o) : [...sel, o].sort();
                          onChangeJawaban(item.no, next);
                        }}
                        className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all ${
                          active
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                        }`}>
                        {o}
                      </button>
                    );
                  })}

                {item.perlakuan !== 'bonus' &&
                  item.perlakuan !== 'anulir' &&
                  !isSinglePg &&
                  !isTf &&
                  !isPgk && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onInspectInDetail(item.no)}
                    className="max-w-full px-2.5 h-7 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-purple-500/15 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 truncate">
                    <SlidersHorizontal className="w-3 h-3 text-purple-500 shrink-0" />
                    <span className="truncate">{formatJawaban(item) || 'Atur detail'}</span>
                  </button>
                )}
              </div>

              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                {item.poin}p
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
