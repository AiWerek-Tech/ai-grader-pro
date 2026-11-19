'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPaste,
  Copy,
  FilePlus2,
  FileSpreadsheet,
  Grid2x2,
  History,
  Info,
  ListChecks,
  Loader2,
  Printer,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { saveKunciAction } from '@/lib/actions/kunci';
import {
  composeJudulAsesmen,
  detectJenisAsesmen,
  getTipeMeta,
  JENIS_ASESMEN_KM,
  JenisAsesmenKode,
  SEMESTER_OPTIONS,
  SemesterKode,
  TIPE_COLOR,
  TIPE_SOAL_AKM,
  TipeSoalKode,
} from '@/lib/constants/tipe-soal';
import BulkPastePanel from './BulkPastePanel';
import CompositionConfigurator from './CompositionConfigurator';
import JawabanInput, { SafeNumberInput } from './JawabanInput';
import QuickTapGrid from './QuickTapGrid';
import {
  autoScalePoinTo100,
  buildItemsFromComposition,
  calcTotalPoin,
  changeSoalTipe,
  CompositionConfig,
  computePgDistribution,
  DEFAULT_COMPOSITION,
  estimateLjkPreview,
  extractCompositionFromItems,
  getCompositionTotals,
  hasInterleavedTypes,
  hydrateSoalItems,
  inferDominantTipe,
  isSoalFilled,
  KompleksMode,
  parsePengaturanPoinSafe,
  PerlakuanSoal,
  SoalItem,
} from './kunci-utils';

export type EditorMode = 'create' | 'edit' | 'duplicate';

const DRAFT_KEY = 'wmvaa_kunci_editor_draft_v2';

interface KunciEditorModalProps {
  open: boolean;
  mode: EditorMode;
  editingKunci: any | null;
  masterData: { kelas: any[]; mapel: any[] };
  defaultSemester?: SemesterKode;
  onClose: () => void;
  onSaved: (idKunci?: string, goToLjk?: boolean) => Promise<void> | void;
}

const STEPS = [
  { id: 1 as const, label: '1. Identitas & Komposisi Soal' },
  { id: 2 as const, label: '2. Isi Kunci Jawaban' },
];

/** Studio Terpandu 2-Langkah: Identitas Asesmen Kurikulum Merdeka + Bank Soal Configurator + Isi Kunci. */
export default function KunciEditorModal({
  open,
  mode,
  editingKunci,
  masterData,
  defaultSemester = 'GANJIL',
  onClose,
  onSaved,
}: KunciEditorModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Identitas Ujian
  const [jenisAsesmen, setJenisAsesmen] = useState<JenisAsesmenKode>('STS');
  const [semester, setSemester] = useState<SemesterKode>(defaultSemester);
  const [keterangan, setKeterangan] = useState('');
  const [customJudul, setCustomJudul] = useState('');
  const [idMapel, setIdMapel] = useState('');
  const [idKelas, setIdKelas] = useState('');
  const [multiKelasMode, setMultiKelasMode] = useState(false);
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([]);

  // Konfigurasi Komposisi & Penilaian
  const [composition, setComposition] = useState<CompositionConfig>(DEFAULT_COMPOSITION);
  const [poinSalah, setPoinSalah] = useState(0);
  const [kompleksMode, setKompleksMode] = useState<KompleksMode>('mutlak');

  // Daftar Butir Kunci
  const [soalItems, setSoalItems] = useState<SoalItem[]>([]);
  const [isLegacyInterleaved, setIsLegacyInterleaved] = useState(false);
  const [compositionDirty, setCompositionDirty] = useState(false);

  // Kontrol UI Langkah 2
  const [butirSearch, setButirSearch] = useState('');
  const [butirFilter, setButirFilter] = useState<'all' | 'unfilled'>('all');
  const [step2Layout, setStep2Layout] = useState<'detail' | 'grid'>('detail');
  const [showCorrectionTools, setShowCorrectionTools] = useState(false);
  const [showQuickTools, setShowQuickTools] = useState(false);
  const [quickToolsTab, setQuickToolsTab] = useState<'text' | 'excel' | 'ai'>('text');

  const [saving, setSaving] = useState(false);
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
    setStep2Layout('detail');
    setShowCorrectionTools(false);
    setShowQuickTools(false);
    setQuickToolsTab('text');
    setSaving(false);

    if (editingKunci) {
      const hydrated = hydrateSoalItems(editingKunci);
      const poinCfg = parsePengaturanPoinSafe(editingKunci.pengaturan_poin);
      const ps = poinCfg.salah !== undefined ? Number(poinCfg.salah) : 0;
      const km: KompleksMode = poinCfg.kompleks_mode === 'parsial' ? 'parsial' : 'mutlak';

      const rawSem = String(editingKunci.semester || defaultSemester).toUpperCase();
      const initSem: SemesterKode = rawSem === 'GENAP' ? 'GENAP' : 'GANJIL';

      const rawJudul =
        mode === 'duplicate'
          ? `${String(editingKunci.judul_ujian || 'Ujian').replace(/\s*\(Salinan\)$/i, '')} (Salinan)`
          : String(editingKunci.judul_ujian || '');

      const detected = detectJenisAsesmen(rawJudul, poinCfg.jenis_asesmen);
      const initComp = hydrated.length > 0 ? extractCompositionFromItems(hydrated) : DEFAULT_COMPOSITION;
      const interleaved = hasInterleavedTypes(hydrated);

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
      const initMultiArr =
        defaultMultiSel.length > 0 ? defaultMultiSel : baseKelas ? [baseKelas] : [];

      setJenisAsesmen(mode === 'duplicate' && detected.kode !== 'KUSTOM' ? detected.kode : detected.kode);
      setSemester(initSem);
      setKeterangan(
        mode === 'duplicate' && detected.kode !== 'KUSTOM'
          ? detected.keterangan
            ? `${detected.keterangan} - Salinan`
            : 'Salinan'
          : detected.keterangan
      );
      setCustomJudul(detected.kode === 'KUSTOM' ? rawJudul : '');
      setIdMapel(baseMapel);
      setIdKelas(baseKelas);
      setMultiKelasMode(initMulti);
      setSelectedKelasIds(initMultiArr);
      setComposition(initComp);
      setIsLegacyInterleaved(interleaved);
      setCompositionDirty(false);
      setPoinSalah(Number.isFinite(ps) && ps < 0 ? ps : 0);
      setKompleksMode(km);
      setSoalItems(hydrated);
      setStep(mode === 'edit' ? 2 : 1);

      initialSnapshotRef.current = JSON.stringify({
        jenis: detected.kode,
        sem: initSem,
        ket: detected.keterangan,
        cust: detected.kode === 'KUSTOM' ? rawJudul : '',
        mapel: baseMapel,
        kelas: baseKelas,
        multi: initMulti ? initMultiArr : [baseKelas],
        comp: initComp,
        ps: Number.isFinite(ps) && ps < 0 ? ps : 0,
        km,
        items: hydrated,
      });
    } else {
      const baseMapel = masterData.mapel[0]?.id_mapel || '';
      const baseKelas = masterData.kelas[0]?.id_kelas || '';

      setJenisAsesmen('STS');
      setSemester(defaultSemester);
      setKeterangan('');
      setCustomJudul('');
      setIdMapel(baseMapel);
      setIdKelas(baseKelas);
      setMultiKelasMode(false);
      setSelectedKelasIds(baseKelas ? [baseKelas] : []);
      setComposition(DEFAULT_COMPOSITION);
      setIsLegacyInterleaved(false);
      setCompositionDirty(false);
      setPoinSalah(0);
      setKompleksMode('mutlak');
      setSoalItems([]);
      setStep(1);

      initialSnapshotRef.current = JSON.stringify({
        jenis: 'STS',
        sem: defaultSemester,
        ket: '',
        cust: '',
        mapel: baseMapel,
        kelas: baseKelas,
        multi: [baseKelas],
        comp: DEFAULT_COMPOSITION,
        ps: 0,
        km: 'mutlak',
        items: [],
      });

      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (Array.isArray(parsed.soalItems) || parsed.composition)) {
            setPendingDraft(parsed);
          }
        }
      } catch {}
    }
  }, [open, editingKunci, mode, defaultSemester, masterData.kelas, masterData.mapel]);

  const resolvedJudul = useMemo(
    () => composeJudulAsesmen(jenisAsesmen, semester, keterangan, customJudul),
    [jenisAsesmen, semester, keterangan, customJudul]
  );

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        jenis: jenisAsesmen,
        sem: semester,
        ket: keterangan,
        cust: customJudul,
        mapel: idMapel,
        kelas: idKelas,
        multi: multiKelasMode ? selectedKelasIds : [idKelas],
        comp: composition,
        ps: poinSalah,
        km: kompleksMode,
        items: soalItems,
      }),
    [
      jenisAsesmen,
      semester,
      keterangan,
      customJudul,
      idMapel,
      idKelas,
      multiKelasMode,
      selectedKelasIds,
      composition,
      poinSalah,
      kompleksMode,
      soalItems,
    ]
  );

  const isDirty = open && initialSnapshotRef.current !== '' && currentSnapshot !== initialSnapshotRef.current;

  useEffect(() => {
    if (!open || mode !== 'create' || !isDirty) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            jenisAsesmen,
            semester,
            keterangan,
            customJudul,
            idMapel,
            idKelas,
            composition,
            soalItems,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }, 600);
    return () => clearTimeout(timer);
  }, [
    open,
    mode,
    isDirty,
    jenisAsesmen,
    semester,
    keterangan,
    customJudul,
    idMapel,
    idKelas,
    composition,
    soalItems,
  ]);

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

  const { totalSoal: compSoalCount, totalPct: compTotalPct } = useMemo(
    () => getCompositionTotals(composition),
    [composition]
  );

  // Pratinjau layout LJK berdasarkan soalItems aktif atau komposisi saat ini
  const previewItemsForLjk = useMemo(() => {
    if (soalItems.length > 0 && !compositionDirty) return soalItems;
    return buildItemsFromComposition(composition, soalItems);
  }, [soalItems, composition, compositionDirty]);

  const ljkEstimate = useMemo(() => estimateLjkPreview(previewItemsForLjk), [previewItemsForLjk]);
  const totalPoin = useMemo(() => calcTotalPoin(soalItems), [soalItems]);
  const filledCount = useMemo(() => soalItems.filter((s) => isSoalFilled(s)).length, [soalItems]);
  const unfilledCount = soalItems.length - filledCount;
  const pgStats = useMemo(() => computePgDistribution(soalItems), [soalItems]);

  const filteredItems = useMemo(() => {
    const q = butirSearch.trim().toLowerCase();
    return soalItems.filter((s) => {
      if (butirFilter === 'unfilled' && isSoalFilled(s)) return false;
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
    if (pendingDraft.jenisAsesmen) setJenisAsesmen(pendingDraft.jenisAsesmen);
    if (pendingDraft.semester) setSemester(pendingDraft.semester);
    if (pendingDraft.keterangan !== undefined) setKeterangan(pendingDraft.keterangan);
    if (pendingDraft.customJudul !== undefined) setCustomJudul(pendingDraft.customJudul);
    if (pendingDraft.idMapel) setIdMapel(pendingDraft.idMapel);
    if (pendingDraft.idKelas) setIdKelas(pendingDraft.idKelas);
    if (pendingDraft.composition) setComposition({ ...DEFAULT_COMPOSITION, ...pendingDraft.composition });
    if (Array.isArray(pendingDraft.soalItems)) setSoalItems(pendingDraft.soalItems);
    setPendingDraft(null);
    toast.success('Draf kunci jawaban berhasil dipulihkan.');
  };

  const dismissDraft = () => {
    setPendingDraft(null);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const handleCompositionChange = (next: CompositionConfig) => {
    setComposition(next);
    setCompositionDirty(true);
  };

  /** Bangun atau sinkronkan daftar soal sebelum masuk ke Langkah 2 (Isi Kunci). */
  const syncItemsFromStep1AndGo = (): SoalItem[] | null => {
    if (compSoalCount <= 0) {
      toast.error('Isi minimal 1 jumlah soal pada komposisi terlebih dahulu.');
      return null;
    }
    if (compSoalCount > 100) {
      toast.error('Jumlah total soal maksimal 100 butir per ujian.');
      return null;
    }
    if (Math.abs(compTotalPct - 100) >= 0.05) {
      toast.error(
        `Total bobot nilai saat ini ${compTotalPct}%. Pastikan tepat 100% (atau klik "Bagi Otomatis 100%").`
      );
      return null;
    }

    if (soalItems.length > 0 && !compositionDirty) {
      setStep(2);
      return soalItems;
    }

    const built = buildItemsFromComposition(composition, soalItems);
    setSoalItems(built);
    setCompositionDirty(false);
    setIsLegacyInterleaved(false);
    setStep(2);
    return built;
  };

  const handleStepClick = (targetStep: 1 | 2) => {
    if (targetStep === 1) {
      setStep(1);
      return;
    }
    syncItemsFromStep1AndGo();
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
    setStep2Layout('detail');
    setTimeout(() => {
      detailRowRefs.current[no]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handleApplyQuickPaste = (updated: SoalItem[]) => {
    setSoalItems(updated);
    setComposition(extractCompositionFromItems(updated));
    setCompositionDirty(false);
    setStep(2);
  };

  const handleSave = async (goToLjk = false) => {
    if (!resolvedJudul) {
      setStep(1);
      toast.error('Judul ujian wajib diisi.');
      return;
    }

    const effectiveKelasIds =
      mode !== 'edit' && multiKelasMode ? selectedKelasIds : idKelas ? [idKelas] : [];

    if (!idMapel || effectiveKelasIds.length === 0) {
      setStep(1);
      toast.error('Pilih Mata Pelajaran dan minimal 1 Kelas target terlebih dahulu.');
      return;
    }

    // Pastikan butir soal tersinkron jika tombol Simpan ditekan dari Langkah 1
    let itemsToSave = soalItems;
    if (step === 1 || soalItems.length === 0 || compositionDirty) {
      const synced = syncItemsFromStep1AndGo();
      if (!synced) return;
      itemsToSave = synced;
    }

    if (itemsToSave.length === 0) {
      setStep(1);
      toast.error('Minimal harus ada 1 butir soal.');
      return;
    }

    const unfilled = itemsToSave.filter((s) => !isSoalFilled(s));
    if (unfilled.length > 0) {
      setStep(2);
      setButirFilter('unfilled');
      toast.error(`Masih ada ${unfilled.length} soal yang kunci jawabannya belum diisi.`);
      return;
    }

    setSaving(true);
    try {
      const poinMap: Record<string, any> = {
        benar: 1,
        salah: poinSalah < 0 ? poinSalah : 0,
        kompleks_mode: kompleksMode,
        jenis_asesmen: jenisAsesmen,
      };
      itemsToSave.forEach((s) => {
        poinMap[String(s.no)] = s.perlakuan === 'anulir' ? 0 : Number(s.poin) || 1;
      });

      const res = await saveKunciAction({
        id_kunci: mode === 'edit' ? editingKunci?.id_kunci : undefined,
        judul_ujian: resolvedJudul,
        semester,
        id_mapel: idMapel,
        id_kelas: effectiveKelasIds[0],
        target_kelas_ids: mode !== 'edit' ? effectiveKelasIds : undefined,
        tipe_soal: inferDominantTipe(itemsToSave),
        pengaturan_poin: poinMap,
        data_json: itemsToSave,
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

  const modalTitle =
    mode === 'edit'
      ? 'Edit Kunci Jawaban'
      : mode === 'duplicate'
        ? 'Duplikat Kunci ke Kelas Lain'
        : 'Buat Kunci Jawaban Baru';

  const headerSoalCount = step === 1 ? compSoalCount : soalItems.length;
  const headerPoinDisplay =
    step === 1
      ? `${compTotalPct}%`
      : `${totalPoin} Poin`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 lg:backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200 print:hidden"
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
                  {headerSoalCount} Soal · {headerPoinDisplay}
                </span>
                {headerSoalCount > 0 && (
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                    LJK: {ljkEstimate.columns} Kolom · {ljkEstimate.densityLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Standar Asesmen Kurikulum Merdeka, otomatis tersinkron ke Generator LJK PDF &amp; AI Scanner.
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

          {/* 2-Step Nav Pills */}
          <div className="grid grid-cols-2 gap-2">
            {STEPS.map((st) => {
              const active = step === st.id;
              const passed = step > st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleStepClick(st.id)}
                  className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-black border transition-colors duration-100 ${
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
                  Draf pengisian sebelumnya ditemukan ({pendingDraft.soalItems?.length || 0} butir). Lanjutkan?
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
                Ujian ini sudah memiliki <strong>{hasilCount} hasil scan siswa</strong>. Setelah menyimpan perubahan kunci atau bobot, buka <strong>Detail</strong> kunci untuk menghitung ulang nilai siswa.
              </p>
            </div>
          )}

          {/* LANGKAH 1: IDENTITAS ASESMEN & KOMPOSISI SOAL */}
          {step === 1 && (
            <div className="space-y-4">
              {(masterData.mapel.length === 0 || masterData.kelas.length === 0) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    Daftar Kelas atau Mata Pelajaran masih kosong untuk akun Anda. Jika Anda Guru, minta Admin menugaskan kelas di menu <strong>Tugas Mengajar</strong>.
                  </p>
                </div>
              )}

              {/* Identitas Ujian */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-purple-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      Identitas Ujian (Kurikulum Merdeka)
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

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-5">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      Jenis Asesmen *
                    </label>
                    <select
                      value={jenisAsesmen}
                      onChange={(e) => setJenisAsesmen(e.target.value as JenisAsesmenKode)}
                      aria-label="Jenis Asesmen"
                      className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none focus:border-purple-500">
                      {JENIS_ASESMEN_KM.map((j) => (
                        <option key={j.kode} value={j.kode}>
                          {j.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      Semester *
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value as SemesterKode)}
                      aria-label="Semester"
                      className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none focus:border-purple-500">
                      {SEMESTER_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      Mata Pelajaran *
                    </label>
                    <select
                      value={idMapel}
                      onChange={(e) => setIdMapel(e.target.value)}
                      aria-label="Mata Pelajaran"
                      className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none focus:border-purple-500">
                      <option value="">-- Pilih Mapel --</option>
                      {masterData.mapel.map((m) => (
                        <option key={m.id_mapel} value={m.id_mapel}>
                          {m.nama_mapel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    {jenisAsesmen === 'KUSTOM' ? (
                      <>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                          Judul Ujian Manual *
                        </label>
                        <input
                          type="text"
                          value={customJudul}
                          onChange={(e) => setCustomJudul(e.target.value)}
                          placeholder="Ketik judul ujian khusus..."
                          className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-purple-500"
                        />
                      </>
                    ) : (
                      <>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                          Keterangan / Materi (Opsional)
                        </label>
                        <input
                          type="text"
                          value={keterangan}
                          onChange={(e) => setKeterangan(e.target.value)}
                          placeholder="Misal: Bab 1–3, Susulan, atau Paket A (boleh kosong)"
                          className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-sm outline-none focus:border-purple-500"
                        />
                      </>
                    )}
                  </div>

                  {!(mode !== 'edit' && multiKelasMode) && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                        Kelas Target *
                      </label>
                      <select
                        value={idKelas}
                        onChange={(e) => setIdKelas(e.target.value)}
                        aria-label="Kelas Target"
                        className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs sm:text-sm outline-none focus:border-purple-500">
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

                {/* Multi-Kelas Checklist */}
                {mode !== 'edit' && multiKelasMode && (
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
                )}

                {resolvedJudul && (
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-[11px] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">
                      Label Ujian: <strong className="text-slate-900 dark:text-white">{resolvedJudul}</strong>
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickToolsTab('excel');
                          setShowQuickTools(true);
                          setStep(2);
                        }}
                        className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1">
                        <FileSpreadsheet className="w-3 h-3" /> Impor Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickToolsTab('ai');
                          setShowQuickTools(true);
                          setStep(2);
                        }}
                        className="text-[10px] font-black text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1">
                        <Bot className="w-3 h-3" /> Ekstrak Soal / Kunci AI →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Konfigurasi Jumlah Soal & Bobot Nilai (Gaya Gambar 4) */}
              <CompositionConfigurator
                config={composition}
                onChange={handleCompositionChange}
                ljkEstimate={ljkEstimate}
                kompleksMode={kompleksMode}
                onChangeKompleksMode={setKompleksMode}
                poinSalah={poinSalah}
                onChangePoinSalah={setPoinSalah}
                isLegacyInterleaved={isLegacyInterleaved}
              />
            </div>
          )}

          {/* LANGKAH 2: ISI KUNCI JAWABAN */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Toolbar Bersih */}
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
                    <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-white/10 border border-slate-200 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setStep2Layout('detail')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          step2Layout === 'detail'
                            ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                        <ListChecks className="w-3 h-3" /> Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep2Layout('grid')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                          step2Layout === 'grid'
                            ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                        <Grid2x2 className="w-3 h-3" /> Papan Cepat
                      </button>
                    </div>

                    {[
                      { id: 'all' as const, label: `Semua (${soalItems.length})` },
                      { id: 'unfilled' as const, label: `Belum Diisi (${unfilledCount})` },
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
                      onClick={() => setShowQuickTools((v) => !v)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border inline-flex items-center gap-1 ${
                        showQuickTools
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25'
                      }`}>
                      <ClipboardPaste className="w-3 h-3" /> Input Kilat
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCorrectionTools((v) => !v)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border inline-flex items-center gap-1 ${
                        showCorrectionTools
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                      }`}
                      title="Tampilkan kontrol Bonus/Anulir atau ubah tipe per nomor">
                      <SlidersHorizontal className="w-3 h-3" /> Bonus/Anulir
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
                        <span>Sebaran PG terisi ({pgStats.totalPg}):</span>
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

              {/* Drawer Input Kilat (Opsional saat dibuka) */}
              {showQuickTools && (
                <BulkPastePanel
                  soalItems={soalItems}
                  defaultOpen={true}
                  initialTab={quickToolsTab}
                  onCloseDrawer={() => setShowQuickTools(false)}
                  onApply={(updated) => {
                    handleApplyQuickPaste(updated);
                    setShowQuickTools(false);
                  }}
                  onSuggestMeta={(meta) => {
                    if (meta.jenisAsesmen && mode === 'create') {
                      setJenisAsesmen(meta.jenisAsesmen);
                    }
                    if (meta.semester && mode === 'create') {
                      setSemester(meta.semester);
                    }
                    if (meta.judul) {
                      if (jenisAsesmen === 'KUSTOM' && !customJudul.trim()) {
                        setCustomJudul(meta.judul);
                      } else if (!keterangan.trim()) {
                        setKeterangan(meta.judul.slice(0, 48));
                      }
                    }
                  }}
                  onAppliedJumpToReview={() => setShowQuickTools(false)}
                />
              )}

              {/* Daftar Kunci per Butir */}
              {filteredItems.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                  <ClipboardCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {soalItems.length === 0
                      ? 'Belum ada komposisi soal. Kembali ke Langkah 1 untuk mengisi jumlah soal.'
                      : 'Tidak ada butir soal yang cocok dengan filter ini.'}
                  </p>
                </div>
              ) : step2Layout === 'grid' ? (
                <QuickTapGrid
                  items={filteredItems}
                  onChangeJawaban={handleChangeJawabanByNo}
                  onInspectInDetail={handleInspectInDetail}
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredItems.map((s, viewIdx) => {
                    const idx = soalItems.findIndex((x) => x.no === s.no);
                    const meta = getTipeMeta(s.tipe);
                    const filled = isSoalFilled(s);
                    const prevItem = viewIdx > 0 ? filteredItems[viewIdx - 1] : null;
                    const showSectionHeader = !prevItem || prevItem.tipe !== s.tipe;

                    return (
                      <React.Fragment key={s.no}>
                        {showSectionHeader && (
                          <div className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${TIPE_COLOR[meta.color]}`}>
                              {meta.short} · {meta.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {s.perlakuan === 'anulir' ? 'Dianulir' : `${s.poin} poin / soal`}
                            </span>
                          </div>
                        )}

                        <div
                          ref={(el) => {
                            detailRowRefs.current[s.no] = el;
                          }}
                          className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center gap-3 ${
                            s.perlakuan === 'bonus'
                              ? 'bg-emerald-500/5 border-emerald-500/30'
                              : s.perlakuan === 'anulir'
                                ? 'bg-slate-100/80 dark:bg-white/[0.015] border-slate-200 dark:border-white/10'
                                : filled
                                  ? 'bg-white dark:bg-white/[0.025] border-slate-200 dark:border-white/10'
                                  : 'bg-amber-500/5 border-amber-500/35'
                          }`}>
                          {/* Info Nomor + Poin (atau Kontrol Edit Lanjutan jika diaktifkan) */}
                          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0 lg:shrink-0">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                              <span
                                className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center border shrink-0 ${
                                  s.perlakuan === 'anulir'
                                    ? 'bg-slate-400 dark:bg-slate-700 text-white border-transparent'
                                    : s.perlakuan === 'bonus'
                                      ? 'bg-emerald-600 text-white border-emerald-500'
                                      : filled
                                        ? 'bg-purple-600 text-white border-transparent'
                                        : 'bg-amber-500 text-white border-amber-500'
                                }`}>
                                {s.no}
                              </span>

                              {showCorrectionTools ? (
                                <>
                                  <select
                                    value={s.tipe}
                                    onChange={(e) =>
                                      handleChangeTipeItem(idx, e.target.value as TipeSoalKode)
                                    }
                                    aria-label={`Tipe soal nomor ${s.no}`}
                                    className={`h-8 max-w-[148px] sm:max-w-[190px] truncate px-2 rounded-xl text-[11px] font-black border outline-none cursor-pointer ${TIPE_COLOR[meta.color]}`}>
                                    {TIPE_SOAL_AKM.map((t) => (
                                      <option
                                        key={t.kode}
                                        value={t.kode}
                                        className="bg-white dark:bg-[#0d111d] text-slate-900 dark:text-white">
                                        {t.short} — {t.label}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={s.perlakuan || 'normal'}
                                    onChange={(e) =>
                                      handleChangePerlakuan(idx, e.target.value as PerlakuanSoal)
                                    }
                                    aria-label={`Perlakuan soal nomor ${s.no}`}
                                    className="h-8 px-2 rounded-xl text-[10px] font-black border bg-white dark:bg-[#050314] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 outline-none">
                                    <option value="normal">Normal</option>
                                    <option value="bonus">Bonus</option>
                                    <option value="anulir">Anulir</option>
                                  </select>
                                  {s.perlakuan !== 'anulir' && (
                                    <SafeNumberInput
                                      value={s.poin}
                                      min={0.05}
                                      max={100}
                                      step={0.25}
                                      ariaLabel={`Poin soal nomor ${s.no}`}
                                      onChangeValue={(val) => handlePatchItem(idx, { poin: val })}
                                      className="w-14 h-8 px-1.5 rounded-xl bg-slate-50 dark:bg-[#050314] border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-xs text-center outline-none shrink-0"
                                    />
                                  )}
                                </>
                              ) : (
                                <span
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                                    s.perlakuan === 'anulir'
                                      ? 'bg-slate-200 dark:bg-white/10 text-slate-500 border-transparent'
                                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                  }`}>
                                  {s.perlakuan === 'anulir'
                                    ? 'Anulir (0p)'
                                    : s.perlakuan === 'bonus'
                                      ? `Bonus (${s.poin}p)`
                                      : `${s.poin} poin`}
                                </span>
                              )}
                            </div>

                            {!showCorrectionTools && !filled && (
                              <span className="lg:hidden text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                Belum diisi
                              </span>
                            )}
                          </div>

                          {/* Baris kanan: Jawaban Interaktif atau Status Bonus/Anulir */}
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
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {Math.abs(totalPoin - 100) >= 0.1 && soalItems.length > 0 && showCorrectionTools && (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-indigo-800 dark:text-indigo-200">
                    Total poin mentah setelah penyesuaian: <strong>{totalPoin} Poin</strong>.
                  </span>
                  <button
                    type="button"
                    onClick={() => setSoalItems((prev) => autoScalePoinTo100(prev, 'proportional'))}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-black">
                    Skalakan Ulang ke 100
                  </button>
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
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
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
            {step === 1 ? (
              <button
                type="button"
                onClick={() => syncItemsFromStep1AndGo()}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-lg shadow-purple-500/20 transition-all">
                <span>Lanjut: Isi Kunci Jawaban</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-lg shadow-purple-500/20 transition-all">
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FilePlus2 className="w-3.5 h-3.5" />
                  )}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
