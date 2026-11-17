'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FilePlus2,
  Grid2x2,
  History,
  Info,
  Layers,
  ListChecks,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { saveKunciAction } from '@/lib/actions/kunci';
import { getTipeMeta, TIPE_COLOR, TIPE_SOAL_AKM, TipeSoalKode } from '@/lib/constants/tipe-soal';
import BulkPastePanel from './BulkPastePanel';
import JawabanInput, { SafeNumberInput } from './JawabanInput';
import QuickTapGrid from './QuickTapGrid';
import WeightingStudioPanel from './WeightingStudioPanel';
import {
  autoScalePoinTo100,
  buildSoalItem,
  calcTotalPoin,
  changeSoalTipe,
  computePgDistribution,
  estimateLjkPreview,
  hydrateSoalItems,
  inferDominantTipe,
  isSoalFilled,
  KompleksMode,
  parsePengaturanPoinSafe,
  PerlakuanSoal,
  PRESET_TEMPLATES,
  PresetTemplate,
  resizeSoalItems,
  SoalItem,
} from './kunci-utils';

export type EditorMode = 'create' | 'edit' | 'duplicate';

const DRAFT_KEY = 'wmvaa_kunci_editor_draft_v1';

interface KunciEditorModalProps {
  open: boolean;
  mode: EditorMode;
  editingKunci: any | null;
  masterData: { kelas: any[]; mapel: any[] };
  onClose: () => void;
  onSaved: (idKunci?: string, goToLjk?: boolean) => Promise<void> | void;
}

const STEPS = [
  { id: 1 as const, label: 'Info & Paket' },
  { id: 2 as const, label: 'Tipe & Kilat' },
  { id: 3 as const, label: 'Isi Kunci' },
];

/** Studio Terpandu 3-Langkah: Auto-Draft, Mode Papan Cepat, Multi-Kelas, Ekstrak AI/Excel & Pratinjau LJK. */
export default function KunciEditorModal({
  open,
  mode,
  editingKunci,
  masterData,
  onClose,
  onSaved,
}: KunciEditorModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [judulUjian, setJudulUjian] = useState('');
  const [idMapel, setIdMapel] = useState('');
  const [idKelas, setIdKelas] = useState('');
  const [multiKelasMode, setMultiKelasMode] = useState(false);
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([]);

  const [poinBenar, setPoinBenar] = useState(1);
  const [poinSalah, setPoinSalah] = useState(0);
  const [kompleksMode, setKompleksMode] = useState<KompleksMode>('mutlak');

  const [defaultTipe, setDefaultTipe] = useState<TipeSoalKode>('single_choice');
  const [soalItems, setSoalItems] = useState<SoalItem[]>([]);

  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(5);
  const [rangeTipe, setRangeTipe] = useState<TipeSoalKode>('single_choice');
  const [rangePoin, setRangePoin] = useState(1);

  const [butirSearch, setButirSearch] = useState('');
  const [butirFilter, setButirFilter] = useState<'all' | 'unfilled' | 'complex'>('all');
  const [step3Layout, setStep3Layout] = useState<'detail' | 'grid'>('detail');

  const [saving, setSaving] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<any | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const initialSnapshotRef = useRef<string>('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const detailRowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // Inisialisasi state saat modal dibuka
  useEffect(() => {
    if (!open) return;

    setConfirmDiscardOpen(false);
    setPendingDraft(null);
    setButirSearch('');
    setButirFilter('all');
    setStep3Layout('detail');
    setSaving(false);

    if (editingKunci) {
      const hydrated = hydrateSoalItems(editingKunci);
      const items =
        hydrated.length > 0
          ? hydrated
          : Array.from({ length: 20 }, (_, i) => buildSoalItem(i + 1, 'single_choice', 5));
      const poinCfg = parsePengaturanPoinSafe(editingKunci.pengaturan_poin);
      const pb = poinCfg.benar !== undefined ? Number(poinCfg.benar) : 1;
      const ps = poinCfg.salah !== undefined ? Number(poinCfg.salah) : 0;
      const firstTipe = items[0]?.tipe || 'single_choice';
      const baseJudul =
        mode === 'duplicate'
          ? `${String(editingKunci.judul_ujian || 'Ujian').replace(/\s*\(Salinan\)$/i, '')} (Salinan)`
          : String(editingKunci.judul_ujian || '');
      const baseMapel = editingKunci.id_mapel || masterData.mapel[0]?.id_mapel || '';
      const baseKelas = editingKunci.id_kelas || masterData.kelas[0]?.id_kelas || '';
      const initMulti = mode === 'duplicate';
      const defaultMultiSel =
        mode === 'duplicate'
          ? masterData.kelas
              .filter((k) => k.id_kelas !== editingKunci.id_kelas)
              .slice(0, 1)
              .map((k) => k.id_kelas)
          : [baseKelas].filter(Boolean);

      setJudulUjian(baseJudul);
      setIdMapel(baseMapel);
      setIdKelas(baseKelas);
      setMultiKelasMode(initMulti);
      setSelectedKelasIds(defaultMultiSel.length > 0 ? defaultMultiSel : baseKelas ? [baseKelas] : []);
      setPoinBenar(Number.isFinite(pb) ? pb : 1);
      setPoinSalah(Number.isFinite(ps) && ps < 0 ? ps : 0);
      setKompleksMode(poinCfg.kompleks_mode === 'parsial' ? 'parsial' : 'mutlak');
      setDefaultTipe(firstTipe);
      setSoalItems(items);
      setRangeStart(1);
      setRangeEnd(Math.min(5, items.length));
      setRangeTipe(firstTipe);
      setRangePoin(items[0]?.poin || 1);
      setStep(mode === 'edit' ? 3 : 1);
      setActivePresetId(null);

      initialSnapshotRef.current = JSON.stringify({
        judul: baseJudul,
        mapel: baseMapel,
        kelas: baseKelas,
        multi: initMulti ? defaultMultiSel : [baseKelas],
        ps: Number.isFinite(ps) && ps < 0 ? ps : 0,
        km: poinCfg.kompleks_mode === 'parsial' ? 'parsial' : 'mutlak',
        items,
      });
    } else {
      const items = Array.from({ length: 20 }, (_, i) => buildSoalItem(i + 1, 'single_choice', 5));
      const baseMapel = masterData.mapel[0]?.id_mapel || '';
      const baseKelas = masterData.kelas[0]?.id_kelas || '';

      setJudulUjian('');
      setIdMapel(baseMapel);
      setIdKelas(baseKelas);
      setMultiKelasMode(false);
      setSelectedKelasIds(baseKelas ? [baseKelas] : []);
      setPoinBenar(1);
      setPoinSalah(0);
      setKompleksMode('mutlak');
      setDefaultTipe('single_choice');
      setSoalItems(items);
      setRangeStart(1);
      setRangeEnd(5);
      setRangeTipe('single_choice');
      setRangePoin(5);
      setStep(1);
      setActivePresetId('pg20_harian');

      initialSnapshotRef.current = JSON.stringify({
        judul: '',
        mapel: baseMapel,
        kelas: baseKelas,
        multi: [baseKelas],
        ps: 0,
        km: 'mutlak',
        items,
      });

      // Cek draf tersimpan di localStorage untuk pemulihan aman
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.soalItems) && parsed.soalItems.length > 0) {
            setPendingDraft(parsed);
          }
        }
      } catch {}
    }
  }, [open, editingKunci, mode, masterData.kelas, masterData.mapel]);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        judul: judulUjian,
        mapel: idMapel,
        kelas: idKelas,
        multi: multiKelasMode ? selectedKelasIds : [idKelas],
        ps: poinSalah,
        km: kompleksMode,
        items: soalItems,
      }),
    [judulUjian, idMapel, idKelas, multiKelasMode, selectedKelasIds, poinSalah, kompleksMode, soalItems]
  );

  const isDirty = open && initialSnapshotRef.current !== '' && currentSnapshot !== initialSnapshotRef.current;

  // Auto-save draft di mode Create saat user sudah mengedit
  useEffect(() => {
    if (!open || mode !== 'create' || !isDirty) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            judulUjian,
            idMapel,
            idKelas,
            soalItems,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }, 600);
    return () => clearTimeout(timer);
  }, [open, mode, isDirty, judulUjian, idMapel, idKelas, soalItems]);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  }, [saving, isDirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  const totalPoin = useMemo(() => calcTotalPoin(soalItems), [soalItems]);
  const filledCount = useMemo(() => soalItems.filter((s) => isSoalFilled(s)).length, [soalItems]);
  const unfilledCount = soalItems.length - filledCount;
  const pgStats = useMemo(() => computePgDistribution(soalItems), [soalItems]);
  const ljkEstimate = useMemo(() => estimateLjkPreview(soalItems), [soalItems]);

  const filteredItems = useMemo(() => {
    const q = butirSearch.trim().toLowerCase();
    return soalItems.filter((s) => {
      if (butirFilter === 'unfilled' && isSoalFilled(s)) return false;
      if (
        butirFilter === 'complex' &&
        ['single_choice', 'single_choice_4', 'true_false'].includes(s.tipe)
      ) {
        return false;
      }
      if (!q) return true;
      const noMatch = String(s.no) === q || `#${s.no}`.includes(q);
      const ansStr = typeof s.jawaban === 'string' ? s.jawaban.toLowerCase() : '';
      return noMatch || ansStr.includes(q);
    });
  }, [soalItems, butirFilter, butirSearch]);

  if (!open) return null;

  const hasilCount = Number(editingKunci?.hasil_count) || 0;

  const restoreDraft = () => {
    if (!pendingDraft) return;
    setJudulUjian(pendingDraft.judulUjian || '');
    if (pendingDraft.idMapel) setIdMapel(pendingDraft.idMapel);
    if (pendingDraft.idKelas) setIdKelas(pendingDraft.idKelas);
    if (Array.isArray(pendingDraft.soalItems) && pendingDraft.soalItems.length > 0) {
      setSoalItems(pendingDraft.soalItems);
    }
    setPendingDraft(null);
    toast.success('Draf kunci jawaban berhasil dipulihkan.');
  };

  const dismissDraft = () => {
    setPendingDraft(null);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const handleApplyPreset = (preset: PresetTemplate) => {
    const built = preset.buildItems();
    setSoalItems(built);
    setDefaultTipe(preset.defaultTipe);
    setRangeStart(1);
    setRangeEnd(Math.min(10, built.length));
    setRangeTipe(preset.defaultTipe);
    setRangePoin(built[0]?.poin || 1);
    setActivePresetId(preset.id);
    toast.success(`Paket "${preset.nama}" diterapkan (${built.length} soal = ${preset.totalPoin} poin).`);
  };

  const handleCountChange = (nextCount: number) => {
    const clamped = Math.max(1, Math.min(100, Math.round(nextCount) || 1));
    setSoalItems((prev) => resizeSoalItems(prev, clamped, defaultTipe, prev[0]?.poin || 1));
    setRangeEnd((prev) => Math.min(clamped, Math.max(1, prev)));
  };

  const handlePatchItem = (index: number, patch: Partial<SoalItem>) => {
    setSoalItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const handleChangeJawabanByNo = (no: number, val: any) => {
    setSoalItems((prev) => prev.map((item) => (item.no === no ? { ...item, jawaban: val } : item)));
  };

  const handleChangeTipeItem = (index: number, newTipe: TipeSoalKode) => {
    setSoalItems((prev) => prev.map((item, idx) => (idx === index ? changeSoalTipe(item, newTipe) : item)));
  };

  const handleApplyRange = () => {
    const start = Math.max(1, Math.min(rangeStart, rangeEnd));
    const end = Math.min(soalItems.length, Math.max(rangeStart, rangeEnd));
    const clampedPoin = Math.max(0.05, Math.round((rangePoin || 1) * 100) / 100);
    setSoalItems((prev) =>
      prev.map((item) => {
        if (item.no < start || item.no > end) return item;
        const updated = changeSoalTipe(item, rangeTipe);
        return {
          ...updated,
          poin: item.perlakuan === 'anulir' ? 0 : clampedPoin,
        };
      })
    );
    toast.success(`Nomor ${start}–${end} diubah ke ${getTipeMeta(rangeTipe).short} (${clampedPoin} poin/soal).`);
  };

  const handleUniformAll = (tipe: TipeSoalKode) => {
    setDefaultTipe(tipe);
    setRangeTipe(tipe);
    setSoalItems((prev) => prev.map((item) => changeSoalTipe(item, tipe)));
    toast.success(`Semua ${soalItems.length} soal diseragamkan ke ${getTipeMeta(tipe).label}.`);
  };

  const handleAuto100 = (scaleMode: 'proportional' | 'equal' = 'proportional') => {
    setSoalItems((prev) => autoScalePoinTo100(prev, scaleMode));
    toast.success(
      scaleMode === 'proportional'
        ? 'Bobot diskalakan proporsional hingga Total = 100 poin.'
        : 'Bobot dibagi rata hingga Total = 100 poin.'
    );
  };

  const handleChangePerlakuan = (idx: number, nextPerlakuan: PerlakuanSoal) => {
    setSoalItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (nextPerlakuan === 'anulir') {
          return { ...item, perlakuan: 'anulir', poin: 0 };
        }
        const restoredPoin = item.poin > 0 ? item.poin : 1;
        if (nextPerlakuan === 'normal') {
          const copy = { ...item, poin: restoredPoin };
          delete copy.perlakuan;
          return copy;
        }
        return { ...item, perlakuan: 'bonus', poin: restoredPoin };
      })
    );
  };

  const toggleMultiKelas = (kelasId: string) => {
    setSelectedKelasIds((prev) =>
      prev.includes(kelasId) ? prev.filter((x) => x !== kelasId) : [...prev, kelasId]
    );
  };

  const handleInspectInDetail = (no: number) => {
    setButirFilter('all');
    setButirSearch('');
    setStep3Layout('detail');
    setTimeout(() => {
      detailRowRefs.current[no]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handleSave = async (goToLjk = false) => {
    if (!judulUjian.trim()) {
      setStep(1);
      toast.error('Judul ujian wajib diisi terlebih dahulu.');
      return;
    }

    const effectiveKelasIds =
      mode !== 'edit' && multiKelasMode ? selectedKelasIds : idKelas ? [idKelas] : [];

    if (!idMapel || effectiveKelasIds.length === 0) {
      setStep(1);
      toast.error('Pilih Mata Pelajaran dan minimal 1 Kelas target terlebih dahulu.');
      return;
    }
    if (soalItems.length === 0) {
      setStep(2);
      toast.error('Minimal harus ada 1 butir soal.');
      return;
    }

    setSaving(true);
    try {
      const poinMap: Record<string, any> = {
        benar: poinBenar,
        salah: poinSalah < 0 ? poinSalah : 0,
        kompleks_mode: kompleksMode,
      };
      soalItems.forEach((s) => {
        poinMap[String(s.no)] = s.perlakuan === 'anulir' ? 0 : Number(s.poin) || 1;
      });

      const res = await saveKunciAction({
        id_kunci: mode === 'edit' ? editingKunci?.id_kunci : undefined,
        judul_ujian: judulUjian.trim(),
        id_mapel: idMapel,
        id_kelas: effectiveKelasIds[0],
        target_kelas_ids: mode !== 'edit' ? effectiveKelasIds : undefined,
        tipe_soal: inferDominantTipe(soalItems),
        pengaturan_poin: poinMap,
        data_json: soalItems,
        segmen: [],
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menyimpan kunci jawaban.');
        return;
      }

      if (mode === 'create') {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {}
      }

      toast.success(
        goToLjk
          ? 'Kunci tersimpan! Membuka Generator LJK...'
          : res.message || 'Kunci ujian berhasil disimpan!'
      );
      await onSaved(res.id_kunci, goToLjk);
    } finally {
      setSaving(false);
    }
  };

  const activeTipeMeta = getTipeMeta(defaultTipe);
  const modalTitle =
    mode === 'edit'
      ? 'Edit Kunci Jawaban'
      : mode === 'duplicate'
        ? 'Duplikat Kunci ke Kelas Lain'
        : 'Buat Kunci Jawaban Baru';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 lg:backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kunci-studio-title">
      <div className="bg-white dark:bg-[#0d111d] border border-slate-200 dark:border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-5xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Studio */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="kunci-studio-title"
                  className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {modalTitle}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                  {soalItems.length} Soal · Total {totalPoin} Poin
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  LJK: {ljkEstimate.columns} Kolom · {ljkEstimate.densityLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Mendukung 8 tipe soal AKM, impor Excel/AI, dan sinkron otomatis ke LJK + AI Scanner.
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="p-2 rounded-xl bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 shrink-0 transition-colors"
              aria-label="Tutup modal">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3-Step Nav Pills */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {STEPS.map((st) => {
              const active = step === st.id;
              const passed = step > st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStep(st.id)}
                  className={`flex items-center justify-center sm:justify-start gap-2 px-2.5 py-2 rounded-xl text-[11px] sm:text-xs font-black border transition-colors duration-100 ${
                    active
                      ? 'bg-purple-600 text-white border-purple-500 ring-2 ring-purple-500/35 shadow-sm'
                      : passed
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/15'
                        : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300'
                  }`}>
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                      active
                        ? 'bg-white text-purple-600'
                        : passed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}>
                    {passed ? <Check className="w-3 h-3" /> : st.id}
                  </span>
                  <span className="truncate">{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto touch-scroll p-4 sm:p-6 space-y-5">
          {/* Recovery Draft Banner (Mode Create) */}
          {pendingDraft && mode === 'create' && (
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-cyan-800 dark:text-cyan-200">
                <History className="w-4 h-4 shrink-0" />
                <span>
                  Draf tersimpan ditemukan (<strong>{pendingDraft.judulUjian || 'Tanpa Judul'}</strong>,{' '}
                  {pendingDraft.soalItems.length} soal). Lanjutkan pengisian sebelumnya?
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={dismissDraft}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5">
                  Abaikan
                </button>
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-[11px] font-black hover:bg-cyan-500">
                  Pulihkan Draf
                </button>
              </div>
            </div>
          )}

          {/* Peringatan Edit Ujian yang Sudah Ada Hasil Scan */}
          {mode === 'edit' && hasilCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs font-medium leading-relaxed">
                Ujian ini sudah memiliki <strong>{hasilCount} hasil scan siswa</strong>. Hindari mengurangi jumlah nomor soal agar data analisis butir &amp; hasil tetap selaras.
              </p>
            </div>
          )}

          {/* STEP 1: INFO UJIAN, MULTI-KELAS & PAKET TEMPLATE */}
          {step === 1 && (
            <div className="space-y-5">
              {(masterData.mapel.length === 0 || masterData.kelas.length === 0) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    Daftar Kelas atau Mata Pelajaran masih kosong untuk akun Anda. Jika Anda Guru, minta Admin menugaskan kelas di menu <strong>Tugas Mengajar</strong>.
                  </p>
                </div>
              )}

              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-purple-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      Identitas Ujian
                    </h4>
                  </div>

                  {mode !== 'edit' && masterData.kelas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMultiKelasMode((v) => !v)}
                      className={`px-3 py-1 rounded-xl text-[10px] font-black border inline-flex items-center gap-1.5 transition-all ${
                        multiKelasMode
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                      }`}>
                      <Copy className="w-3 h-3" />
                      {multiKelasMode ? `Multi-Kelas Aktif (${selectedKelasIds.length})` : 'Salin ke Banyak Kelas?'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      Judul Ujian *
                    </label>
                    <input
                      type="text"
                      value={judulUjian}
                      onChange={(e) => setJudulUjian(e.target.value)}
                      placeholder="Contoh: Sumatif Tengah Semester 1"
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      Mata Pelajaran *
                    </label>
                    <select
                      value={idMapel}
                      onChange={(e) => setIdMapel(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-purple-500">
                      <option value="">-- Pilih Mapel --</option>
                      {masterData.mapel.map((m) => (
                        <option key={m.id_mapel} value={m.id_mapel}>
                          {m.nama_mapel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Pilihan Kelas Tunggal vs Multi-Kelas */}
                {mode !== 'edit' && multiKelasMode ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-cyan-700 dark:text-cyan-300 uppercase tracking-widest">
                        Pilih Kelas Tujuan Sekaligus ({selectedKelasIds.length} terpilih) *
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedKelasIds(
                            selectedKelasIds.length === masterData.kelas.length
                              ? []
                              : masterData.kelas.map((k) => k.id_kelas)
                          )
                        }
                        className="text-[10px] font-black text-purple-600 dark:text-purple-400 hover:underline">
                        {selectedKelasIds.length === masterData.kelas.length ? 'Kosongkan' : 'Pilih Semua Kelas'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {masterData.kelas.map((k) => {
                        const checked = selectedKelasIds.includes(k.id_kelas);
                        return (
                          <button
                            key={k.id_kelas}
                            type="button"
                            onClick={() => toggleMultiKelas(k.id_kelas)}
                            className={`px-3 py-2 rounded-xl text-xs font-black border inline-flex items-center gap-1.5 transition-all ${
                              checked
                                ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-cyan-400'
                            }`}>
                            {checked && <Check className="w-3.5 h-3.5" />}
                            {k.nama_kelas}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      Kelas Target *
                    </label>
                    <select
                      value={idKelas}
                      onChange={(e) => setIdKelas(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-purple-500">
                      <option value="">-- Pilih Kelas --</option>
                      {masterData.kelas.map((k) => (
                        <option key={k.id_kelas} value={k.id_kelas}>
                          {k.nama_kelas}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Paket Template Siap Pakai */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Pilih Paket Template Cepat (Opsional)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cocok untuk pemula: klik satu paket untuk langsung mengatur jumlah soal &amp; bobot nilai Total = 100.
                    </p>
                  </div>
                  {mode === 'edit' && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      Hati-hati: klik paket akan mengganti komposisi soal saat ini
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESET_TEMPLATES.map((tpl) => {
                    const selected = activePresetId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyPreset(tpl)}
                        className={`p-4 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2.5 ${
                          selected
                            ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/20'
                            : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-purple-400'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                            {tpl.nama}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 shrink-0">
                            {tpl.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{tpl.desc}</p>
                        <div className="flex items-center justify-between pt-1 text-[10px] font-black text-purple-600 dark:text-purple-400">
                          <span>
                            {tpl.totalSoal} Butir · {tpl.totalPoin} Poin
                          </span>
                          <span>{selected ? '✓ Terpilih' : 'Pakai Paket →'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: STRUKTUR, TIPE SOAL, BOBOT & INPUT KILAT */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Bar Jumlah Soal & Auto Total 100 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Jumlah Butir Soal (1–100)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCountChange(soalItems.length - 1)}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-100"
                        aria-label="Kurangi jumlah soal">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <SafeNumberInput
                        value={soalItems.length}
                        min={1}
                        max={100}
                        step={1}
                        onChangeValue={handleCountChange}
                        ariaLabel="Jumlah soal"
                        className="w-16 h-8 text-center rounded-xl bg-white dark:bg-[#050314] border border-purple-500/40 text-purple-600 dark:text-purple-400 font-black text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCountChange(soalItems.length + 1)}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-100"
                        aria-label="Tambah jumlah soal">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[10, 20, 25, 30, 40, 50].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleCountChange(n)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${
                          soalItems.length === n
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-purple-400'
                        }`}>
                        {n} Soal
                      </button>
                    ))}
                  </div>
                  <div className="pt-1 border-t border-slate-200/70 dark:border-white/10 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                    Pratinjau Kertas LJK: {ljkEstimate.columns} Kolom · {ljkEstimate.densityLabel} (
                    {ljkEstimate.objectiveCount} objektif
                    {ljkEstimate.essayCount > 0 ? ` + ${ljkEstimate.essayCount} esai` : ''})
                  </div>
                </div>

                {/* Panel Pembobotan Fleksibel & Kewenangan Guru */}
                <WeightingStudioPanel
                  soalItems={soalItems}
                  onUpdateItems={setSoalItems}
                  kompleksMode={kompleksMode}
                  onChangeKompleksMode={setKompleksMode}
                  poinSalah={poinSalah}
                  onChangePoinSalah={setPoinSalah}
                />
              </div>

              {/* Pemilih Tipe Soal AKM dengan Deskripsi Ramah Pemula */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-500" />
                    8 Tipe Soal AKM &amp; Standar
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUniformAll(defaultTipe)}
                    className="px-3 py-1 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 text-[10px] font-black border border-purple-500/25 transition-all">
                    Seragamkan Semua {soalItems.length} Soal ke {activeTipeMeta.short}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIPE_SOAL_AKM.map((t) => {
                    const active = defaultTipe === t.kode;
                    return (
                      <button
                        key={t.kode}
                        type="button"
                        onClick={() => setDefaultTipe(t.kode)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          active
                            ? `${TIPE_COLOR[t.color]} ring-2 ring-current/25`
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                        }`}>
                        <div className="text-[11px] font-black">
                          {t.short} · {t.label.split(' ')[0]}
                        </div>
                        <div className="text-[10px] opacity-80 truncate">{t.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-700 dark:text-slate-200 font-medium">
                    <strong className="font-black text-purple-600 dark:text-purple-400">{activeTipeMeta.label}:</strong>{' '}
                    {activeTipeMeta.desc}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    Contoh: {activeTipeMeta.contoh}
                  </span>
                </div>
              </div>

              {/* Atur Rentang Nomor Soal */}
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Atur Rentang Nomor (Untuk Soal Campuran, Misal No. 26–30 = Esai)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Dari No.</label>
                    <SafeNumberInput
                      value={rangeStart}
                      min={1}
                      max={soalItems.length}
                      step={1}
                      onChangeValue={setRangeStart}
                      className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-black text-center outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Sampai No.</label>
                    <SafeNumberInput
                      value={rangeEnd}
                      min={1}
                      max={soalItems.length}
                      step={1}
                      onChangeValue={setRangeEnd}
                      className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-black text-center outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipe Soal</label>
                    <select
                      value={rangeTipe}
                      onChange={(e) => setRangeTipe(e.target.value as TipeSoalKode)}
                      className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-bold outline-none">
                      {TIPE_SOAL_AKM.map((t) => (
                        <option key={t.kode} value={t.kode}>
                          {t.short} — {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Poin / Soal</label>
                    <SafeNumberInput
                      value={rangePoin}
                      min={0.05}
                      max={100}
                      step={0.25}
                      onChangeValue={setRangePoin}
                      className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-black text-center text-emerald-600 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyRange}
                    className="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all">
                    Terapkan Rentang
                  </button>
                </div>
              </div>

              {/* Input Kilat: Teks, Excel (.xlsx), Ekstrak AI */}
              <BulkPastePanel
                soalItems={soalItems}
                onApply={(updated) => setSoalItems(updated)}
                onSuggestJudul={(suggested) => {
                  if (!judulUjian.trim()) setJudulUjian(suggested);
                }}
                onAppliedJumpToReview={() => setStep(3)}
              />
            </div>
          )}

          {/* STEP 3: ISI KUNCI JAWABAN PER BUTIR */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Toolbar Filter, Switch Mode & Kelengkapan */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={butirSearch}
                      onChange={(e) => setButirSearch(e.target.value)}
                      placeholder="Cari nomor soal (mis. 15) atau kata kunci..."
                      className="w-full h-9 pl-8 pr-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-semibold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Layout Mode Toggle */}
                    <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-white/10 border border-slate-200 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setStep3Layout('detail')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          step3Layout === 'detail'
                            ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                        <ListChecks className="w-3 h-3" /> Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep3Layout('grid')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          step3Layout === 'grid'
                            ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                        <Grid2x2 className="w-3 h-3" /> Papan Cepat
                      </button>
                    </div>

                    {[
                      { id: 'all' as const, label: `Semua (${soalItems.length})` },
                      { id: 'unfilled' as const, label: `Belum (${unfilledCount})` },
                      { id: 'complex' as const, label: 'AKM/Esai' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setButirFilter(tab.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                          butirFilter === tab.id
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                        }`}>
                        {tab.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAuto100('proportional')}
                      className="px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20">
                      Total=100
                    </button>
                  </div>
                </div>

                {/* Progress + Balance PG */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          unfilledCount === 0 ? 'bg-emerald-500' : 'bg-purple-500'
                        }`}
                        style={{
                          width: `${
                            soalItems.length > 0 ? Math.round((filledCount / soalItems.length) * 100) : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 shrink-0 inline-flex items-center gap-1">
                      {unfilledCount === 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Semua siap ({filledCount}/
                          {soalItems.length})
                        </>
                      ) : (
                        <>
                          Terisi {filledCount}/{soalItems.length} ·{' '}
                          <strong className="text-amber-500">{unfilledCount} belum lengkap</strong>
                        </>
                      )}
                    </span>
                  </div>

                  {pgStats.totalPg > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] pt-1 border-t border-slate-200/70 dark:border-white/10">
                      <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400">
                        <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Sebaran PG:</span>
                        {(['A', 'B', 'C', 'D', 'E'] as const).map((opt) => (
                          <span
                            key={opt}
                            className="px-1.5 py-0.5 rounded bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-slate-700 dark:text-slate-200">
                            {opt}:{pgStats.counts[opt]}
                          </span>
                        ))}
                      </div>
                      {pgStats.totalPg >= 10 && pgStats.dominantPct > 45 && pgStats.dominantLetter && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          Catatan: opsi {pgStats.dominantLetter} mendominasi ({pgStats.dominantPct}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* List or QuickTap Grid */}
              {filteredItems.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                  <ClipboardCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Tidak ada butir soal yang cocok dengan filter ini.
                  </p>
                </div>
              ) : step3Layout === 'grid' ? (
                <QuickTapGrid
                  items={filteredItems}
                  onChangeJawaban={handleChangeJawabanByNo}
                  onInspectInDetail={handleInspectInDetail}
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredItems.map((s) => {
                    const idx = soalItems.findIndex((x) => x.no === s.no);
                    const meta = getTipeMeta(s.tipe);
                    const filled = isSoalFilled(s);

                    return (
                      <div
                        key={s.no}
                        ref={(el) => {
                          detailRowRefs.current[s.no] = el;
                        }}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center gap-3 ${
                          filled
                            ? 'bg-white dark:bg-white/[0.025] border-slate-200 dark:border-white/10'
                            : 'bg-amber-500/5 border-amber-500/35'
                        }`}>
                        {/* Baris kiri: Nomor + Tipe + Poin */}
                        <div className="flex flex-wrap items-center justify-between gap-2 lg:w-[370px] shrink-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center border shrink-0 ${
                                s.perlakuan === 'anulir'
                                  ? 'bg-slate-400 dark:bg-slate-700 text-white border-transparent'
                                  : s.perlakuan === 'bonus'
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : filled
                                      ? 'bg-slate-900 dark:bg-white/10 text-white border-transparent'
                                      : 'bg-amber-500 text-white border-amber-500'
                              }`}>
                              {s.no}
                            </span>
                            <select
                              value={s.tipe}
                              onChange={(e) => handleChangeTipeItem(idx, e.target.value as TipeSoalKode)}
                              aria-label={`Tipe soal nomor ${s.no}`}
                              className={`h-8 flex-1 min-w-0 px-2 rounded-xl text-[11px] font-black border outline-none cursor-pointer truncate ${TIPE_COLOR[meta.color]}`}>
                              {TIPE_SOAL_AKM.map((t) => (
                                <option
                                  key={t.kode}
                                  value={t.kode}
                                  className="bg-white dark:bg-[#0d111d] text-slate-900 dark:text-white">
                                  {t.short} — {t.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              value={s.perlakuan || 'normal'}
                              onChange={(e) =>
                                handleChangePerlakuan(idx, e.target.value as PerlakuanSoal)
                              }
                              aria-label={`Perlakuan soal nomor ${s.no}`}
                              title="Kewenangan Guru: Normal, Bonus (semua siswa dapat poin penuh), atau Anulir (tidak dihitung)"
                              className={`h-8 px-1.5 rounded-xl text-[10px] font-black border outline-none cursor-pointer ${
                                s.perlakuan === 'bonus'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                                  : s.perlakuan === 'anulir'
                                    ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-white/20'
                                    : 'bg-slate-50 dark:bg-[#050314] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                              }`}>
                              <option value="normal">Normal</option>
                              <option value="bonus">Bonus</option>
                              <option value="anulir">Anulir</option>
                            </select>

                            {s.perlakuan === 'anulir' ? (
                              <span className="w-14 h-8 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-400 flex items-center justify-center">
                                0p
                              </span>
                            ) : (
                              <label className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 dark:text-slate-400">
                                <span>Poin</span>
                                <SafeNumberInput
                                  value={s.poin}
                                  min={0.05}
                                  max={100}
                                  step={0.25}
                                  ariaLabel={`Poin soal nomor ${s.no}`}
                                  onChangeValue={(val) => handlePatchItem(idx, { poin: val })}
                                  className="w-14 h-8 px-1.5 rounded-xl bg-slate-50 dark:bg-[#050314] border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-xs text-center outline-none focus:border-emerald-500"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Baris kanan: Jawaban Interaktif atau info Bonus/Anulir */}
                        <div className="flex-1 min-w-0">
                          {s.perlakuan === 'bonus' ? (
                            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              Soal Bonus — Seluruh siswa otomatis memperoleh poin penuh ({s.poin}p).
                            </div>
                          ) : s.perlakuan === 'anulir' ? (
                            <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              Soal Dianulir — Dikecualikan dari pembagi skor akhir (0 poin).
                            </div>
                          ) : (
                            <JawabanInput
                              item={s}
                              onChangeJawaban={(val) => handlePatchItem(idx, { jawaban: val })}
                              onPatchItem={(patch) => handlePatchItem(idx, patch)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unsaved Changes Inline Confirmation */}
        {confirmDiscardOpen && (
          <div className="px-4 py-3 sm:px-6 bg-amber-500/15 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Ada perubahan yang belum disimpan. Tutup editor?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscardOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-white">
                Lanjut Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDiscardOpen(false);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black">
                Tutup Tanpa Simpan
              </button>
            </div>
          </div>
        )}

        {/* Sticky Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 pb-safe border-t border-slate-200 dark:border-white/10 bg-slate-50/95 dark:bg-[#0a0e1a] shrink-0 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
                <ArrowLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            ) : (
              <button
                type="button"
                onClick={requestClose}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100">
                Batal
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm transition-all">
                <span>{step === 1 ? 'Lanjut: Atur Soal' : 'Lanjut: Isi Kunci'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-lg shadow-purple-500/20 transition-all">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
              <span>
                {mode === 'edit'
                  ? 'Simpan Perubahan'
                  : multiKelasMode && selectedKelasIds.length > 1
                    ? `Simpan (${selectedKelasIds.length} Kelas)`
                    : 'Simpan Kunci'}
              </span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
              title="Simpan kunci lalu langsung cetak lembar jawab (LJK)">
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simpan &amp; Cetak LJK</span>
              <span className="sm:hidden">LJK</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
