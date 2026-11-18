'use client';

import { getKunciListAction } from '@/lib/actions/kunci';
import { getSiswaAction } from '@/lib/actions/siswa';
import { getHasilAction } from '@/lib/actions/hasil';
import { scanLJKAction, batchSaveScanResultsAction } from '@/lib/actions/analisis';
import { scoreStudentEssaysWithAIAction } from '@/lib/actions/essay';
import { answersMatch, formatAnswerForDisplay, normalizeTipe, hitungSkorV3, normalizeAIAnswer } from '@/lib/ai/grader-engine';
import { TIPE_SOAL_AKM, TIPE_COLOR, getTipeDistribusi } from '@/lib/constants/tipe-soal';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import {
  ScanLine, Search,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Brain,
  Users, Pencil, Save,
  Activity, Check, X, Trash2,
  HelpCircle, ImagePlus, DatabaseZap, RotateCcw,
  FileCheck, Camera, FolderOpen, ChevronDown, ChevronUp, Sparkles, Zap
} from 'lucide-react';
import { SmartLJKScannerModal } from '@/components/scan/SmartLJKScannerModal';

// ─── Types ────────────────────────────────────────────────────────────────────
type ScanStatus = 'pending' | 'scanning' | 'done' | 'error' | 'saved';

interface ScanResult {
  aiName: string;
  aiNis?: string;
  matchedSiswa?: any | null;   // optional — may be null if no match found
  matchScore: number;
  answers: any[];
  skorHitung: number;
  skorDetail: any;
  confidence: number;
  needReview: boolean;
  warning?: string;
  consensus?: boolean;
  entropy?: number;
}

interface ScanItem {
  id: string;
  file: File;
  previewUrl: string;
  thumbDataUrl?: string;
  status: ScanStatus;
  errorMsg?: string;
  result?: ScanResult;
  selectedSiswaId: string;
  isSaved: boolean;
}

const DRAFT_STORAGE_KEY = 'wmvaa_analisis_draft_v1';
const FALLBACK_THUMB_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160' viewBox='0 0 120 160'><rect width='120' height='160' rx='16' fill='%231e1b4b'/><text x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' fill='%23a78bfa' font-family='sans-serif' font-weight='bold' font-size='18'>LJK</text></svg>";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function TipeBadge({ kode }: { kode: string }) {
  const def = TIPE_SOAL_AKM.find(t => t.kode === kode);
  if (!def) return <span className="px-1.5 py-0.5 rounded text-[8px] font-black border border-indigo-500/50 text-indigo-400 bg-indigo-500/10">PG</span>;
  return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[def.color]}`}>{def.short}</span>;
}

function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 80) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border text-emerald-400 bg-emerald-500/10 border-emerald-500/30">🎯 {value}%</span>;
  if (value >= 60) return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border text-amber-400 bg-amber-500/10 border-amber-500/30">⚡ {value}%</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border text-rose-400 bg-rose-500/10 border-rose-500/30">⚠️ {value}%</span>;
}

function StatusBadge({ status }: { status: ScanStatus }) {
  const map: Record<ScanStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:  { label: 'Menunggu',      cls: 'text-slate-400 bg-slate-500/10 border-slate-500/20',                icon: <HelpCircle className="w-3 h-3" /> },
    scanning: { label: 'Memproses...', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20 animate-pulse',        icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    done:     { label: 'Selesai',      cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',          icon: <CheckCircle2 className="w-3 h-3" /> },
    error:    { label: 'Error',        cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20',                   icon: <XCircle className="w-3 h-3" /> },
    saved:    { label: 'Tersimpan ✓', cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20',             icon: <DatabaseZap className="w-3 h-3" /> },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black border ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function DropZone({
  onFiles,
  onOpenSmartScanner,
  autoScanOnAdd,
  onToggleAutoScan,
  disabled,
}: {
  onFiles: (files: File[], forceAutoScan?: boolean) => void;
  onOpenSmartScanner: () => void;
  autoScanOnAdd: boolean;
  onToggleAutoScan: () => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incomingFiles: File[], fromCamera = false) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    const imgs = incomingFiles.filter(f => f.type.startsWith('image/') || f.name.match(/\.(jpe?g|png|webp|heic)$/i));
    if (imgs.length > 0) onFiles(imgs, fromCamera || autoScanOnAdd);
    else toast.error('Hanya file gambar yang diterima (JPG, PNG, WebP).');
  };

  return (
    <div className="space-y-3">
      {/* Hidden inputs */}
      <input
        ref={galleryInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={e => {
          const picked = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          handleFiles(picked, false);
        }}
        disabled={disabled}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const picked = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          handleFiles(picked, true);
        }}
        disabled={disabled}
      />

      {/* Primary Mobile-First Smart Scanner Launchpad */}
      <div className="bg-gradient-to-br from-violet-600/10 via-indigo-600/5 to-transparent border border-violet-500/25 rounded-[2rem] p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
              <ScanLine className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-violet-600 text-white text-[10px] font-black">Langkah 2</span>
                <span>Foto / Unggah LJK</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
                  Auto-Detect
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Klik kamera, foto kertas LJK full-page, lalu AI langsung menilai otomatis.
              </p>
            </div>
          </div>

          {/* Toggle Auto-Scan Instan */}
          <button
            type="button"
            onClick={onToggleAutoScan}
            className={`self-start sm:self-center px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${
              autoScanOnAdd
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto-Scan: {autoScanOnAdd ? 'AKTIF' : 'MANUAL'}</span>
          </button>
        </div>

        {/* 3 Action Buttons: Mobile-first 1-Klik Kamera Utama + Scanner Viewfinder + Galeri */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && cameraInputRef.current?.click()}
            className="col-span-2 sm:col-span-1 order-1 sm:order-2 flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-3.5 sm:py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>Foto Kamera HP (1-Klik)</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onOpenSmartScanner()}
            className="order-2 sm:order-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed text-white px-3 py-3 sm:py-4 rounded-2xl font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all shadow-md shadow-violet-500/20 active:scale-95"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Scanner AI</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && galleryInputRef.current?.click()}
            className="order-3 flex items-center justify-center gap-2 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 hover:border-violet-500/40 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-3 sm:py-4 rounded-2xl font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95"
          >
            <FolderOpen className="w-4 h-4 text-violet-500 shrink-0" />
            <span>Pilih Galeri</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Area (Compact on Mobile, Spacious on Desktop) */}
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!disabled) handleFiles(e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [], false); }}
        onClick={() => !disabled && galleryInputRef.current?.click()}
        className={`
          hidden sm:flex border-2 border-dashed rounded-[2rem] p-6 flex-col items-center gap-2
          transition-all duration-300 select-none
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          ${dragging
            ? 'border-violet-500 bg-violet-500/10 scale-[1.01]'
            : 'border-slate-300 dark:border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5'
          }
        `}
      >
        <div className="flex items-center gap-3">
          <ImagePlus className="w-5 h-5 text-violet-500" />
          <p className="font-black text-slate-700 dark:text-slate-300 text-xs">
            {disabled
              ? 'Pilih kunci ujian terlebih dahulu untuk mengunggah LJK'
              : dragging ? 'Lepaskan foto LJK di sini' : 'Atau seret & lepaskan (Drag & Drop) banyak foto LJK ke area ini'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalisisPage() {
  const [kunciList, setKunciList]     = useState<any[]>([]);
  const [allSiswa, setAllSiswa]       = useState<any[]>([]);
  const [existingHasil, setExistingHasil] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedKunci, setSelectedKunci] = useState<any | null>(null);
  const [searchKunci, setSearchKunci]     = useState('');
  const [filterSemester, setFilterSemester] = useState<'ALL' | 'GANJIL' | 'GENAP'>('ALL');
  const [isKunciCollapsed, setIsKunciCollapsed] = useState(false);
  const [showMissingSiswa, setShowMissingSiswa] = useState(false);

  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [scanning, setScanning]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showSmartScanner, setShowSmartScanner] = useState(false);
  const [autoScanOnAdd, setAutoScanOnAdd] = useState(true);
  
  // Scan progress tracking
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const queueSectionRef = useRef<HTMLDivElement>(null);

  // Detail modal state
  const [detailItem, setDetailItem]     = useState<ScanItem | null>(null);
  const [editingSiswaId, setEditingSiswaId] = useState('');
  const [siswaSearch, setSiswaSearch]   = useState('');
  const [showSiswaPicker, setShowSiswaPicker] = useState<boolean>(false);
  const [modalAnswerFilter, setModalAnswerFilter] = useState<'ALL' | 'WRONG_ONLY'>('ALL');
  const [activeEditNo, setActiveEditNo] = useState<number | null>(null);
  const [inlineAnswerInput, setInlineAnswerInput] = useState<string>('');
  const [showModalPhoto, setShowModalPhoto] = useState<boolean>(false);
  const [scoringEssaysAI, setScoringEssaysAI] = useState<boolean>(false);

  // ─── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingData(true);
      try {
        const [kRes, sRes, hRes] = await Promise.all([
          getKunciListAction(undefined, 'ALL'),
          getSiswaAction(),
          getHasilAction(undefined, 'ALL'),
        ]);
        const kList = kRes.success ? kRes.data || [] : [];
        if (kRes.success) setKunciList(kList);
        if (sRes.success) setAllSiswa(sRes.data || []);
        if (hRes.success) setExistingHasil(hRes.data || []);

        if (typeof window !== 'undefined' && kList.length > 0) {
          const qKunci = new URLSearchParams(window.location.search).get('kunci');
          const found = qKunci ? kList.find((k: any) => k.id_kunci === qKunci) : null;
          if (found) {
            setSelectedKunci(found);
            setIsKunciCollapsed(true);
          }

          // Pulihkan antrian draft yang belum disimpan dari sesi HP sebelumnya (Anti-Hilang saat reload browser)
          try {
            const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
            if (rawDraft) {
              const parsedDraft = JSON.parse(rawDraft);
              if (parsedDraft?.items?.length > 0) {
                const draftKunci = kList.find((k: any) => k.id_kunci === parsedDraft.idKunci);
                if (!found && draftKunci) {
                  setSelectedKunci(draftKunci);
                  setIsKunciCollapsed(true);
                }
                if (!found || (draftKunci && found.id_kunci === draftKunci.id_kunci)) {
                  const restoredItems: ScanItem[] = parsedDraft.items.map((d: any) => ({
                    id: d.id,
                    file: new File([], d.fileName || 'ljk-restored.jpg', { type: 'image/jpeg' }),
                    previewUrl: d.thumbDataUrl || FALLBACK_THUMB_SVG,
                    thumbDataUrl: d.thumbDataUrl || FALLBACK_THUMB_SVG,
                    status: d.status || 'done',
                    result: d.result,
                    selectedSiswaId: d.selectedSiswaId || '',
                    isSaved: Boolean(d.isSaved),
                  }));
                  setScanItems(restoredItems);
                  toast.info(`♻️ Memulihkan ${restoredItems.length} hasil scan yang belum disimpan dari sesi sebelumnya.`);
                }
              }
            }
          } catch {
            // Abaikan bila localStorage penuh/rusak
          }
        }
      } catch (e: any) { toast.error(e.message); }
      finally { setLoadingData(false); }
    })();
  }, []);

  // ─── Auto-Save Draft Antrian ke LocalStorage (Proteksi Reload Browser HP) ───
  useEffect(() => {
    if (typeof window === 'undefined' || loadingData) return;
    try {
      const unsavedDoneItems = scanItems.filter(i => i.status === 'done' && !i.isSaved && i.result);
      if (unsavedDoneItems.length === 0 || !selectedKunci) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }
      const payload = {
        idKunci: selectedKunci.id_kunci,
        updatedAt: Date.now(),
        items: unsavedDoneItems.slice(0, 45).map(i => ({
          id: i.id,
          fileName: i.file?.name || 'ljk.jpg',
          thumbDataUrl: i.thumbDataUrl || FALLBACK_THUMB_SVG,
          status: i.status,
          result: i.result,
          selectedSiswaId: i.selectedSiswaId,
          isSaved: i.isSaved,
        })),
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota exceeded
    }
  }, [scanItems, selectedKunci, loadingData]);

  const filteredKunci = useMemo(() =>
    kunciList.filter(k => {
      if (filterSemester !== 'ALL') {
        const smt = String(k.semester || '').toUpperCase();
        if (filterSemester === 'GANJIL' && !(smt.includes('GANJIL') || smt === '1')) return false;
        if (filterSemester === 'GENAP' && !(smt.includes('GENAP') || smt === '2')) return false;
      }
      return (
        !searchKunci ||
        k.judul_ujian?.toLowerCase().includes(searchKunci.toLowerCase()) ||
        k.nama_mapel?.toLowerCase().includes(searchKunci.toLowerCase()) ||
        k.nama_guru?.toLowerCase().includes(searchKunci.toLowerCase())
      );
    }), [kunciList, searchKunci, filterSemester]);

  // ─── Kelengkapan Scan Siswa per Kelas untuk Kunci Aktif ─────────────────────
  const classScanCoverage = useMemo(() => {
    if (!selectedKunci || allSiswa.length === 0) return null;
    const targetKelasId = selectedKunci.id_kelas && selectedKunci.id_kelas !== 'ALL' ? String(selectedKunci.id_kelas) : null;
    const classStudents = targetKelasId
      ? allSiswa.filter(s => String(s.id_kelas) === targetKelasId)
      : allSiswa;
    if (classStudents.length === 0) return null;

    const savedIds = new Set(
      existingHasil
        .filter(h => String(h.id_kunci) === String(selectedKunci.id_kunci) && h.id_siswa)
        .map(h => String(h.id_siswa))
    );
    const queuedIds = new Set(
      scanItems
        .filter(i => (i.status === 'done' || i.status === 'saved') && i.selectedSiswaId)
        .map(i => String(i.selectedSiswaId))
    );

    const missingSiswa = classStudents.filter(
      s => !savedIds.has(String(s.id_siswa)) && !queuedIds.has(String(s.id_siswa))
    );
    const scannedCount = classStudents.length - missingSiswa.length;
    const pct = Math.round((scannedCount / classStudents.length) * 100);

    return {
      totalKelas: classStudents.length,
      scannedCount,
      missingSiswa,
      pct,
      namaKelas: selectedKunci.nama_kelas || (targetKelasId ? 'Kelas Target' : 'Semua Kelas'),
    };
  }, [selectedKunci, allSiswa, existingHasil, scanItems]);

  // ─── Scan one ───────────────────────────────────────────────────────────────
  const scanOne = useCallback(async (itemId: string, directFile?: File) => {
    if (!selectedKunci) return;

    setScanItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'scanning' as ScanStatus } : i));

    let targetFile = directFile;
    if (!targetFile) {
      const currentItems = await new Promise<ScanItem[]>(resolve => {
        setScanItems(prev => { resolve(prev); return prev; });
      });
      const item = currentItems.find(i => i.id === itemId);
      if (!item) return;
      targetFile = item.file;
    }

    try {
      const [base64, thumbDataUrl] = await Promise.all([
        fileToBase64(targetFile),
        createMiniThumbnail(targetFile),
      ]);
      const res = await scanLJKAction({
        imageBase64: base64,
        mimeType: targetFile.type || 'image/jpeg',
        idKunci: selectedKunci.id_kunci,
      });

      if (!res.success || !res.data) {
        setScanItems(prev => prev.map(i =>
          i.id === itemId ? { ...i, status: 'error', errorMsg: res.message || 'Scan gagal.' } : i
        ));
        return;
      }

      setScanItems(prev => prev.map(i =>
        i.id === itemId ? {
          ...i,
          status: 'done' as ScanStatus,
          thumbDataUrl,
          result: res.data as ScanResult,
          selectedSiswaId: res.data!.matchedSiswa?.id_siswa || '',
          errorMsg: undefined,
        } : i
      ));
    } catch (e: any) {
      setScanItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, status: 'error', errorMsg: e.message } : i
      ));
    }
  }, [selectedKunci]);

  // ─── Add files (with optional instant auto-scan) ────────────────────────────
  const addFiles = useCallback((files: File[], forceAutoScan?: boolean) => {
    if (!selectedKunci) { toast.error('Pilih kunci jawaban terlebih dahulu!'); return; }
    const shouldAuto = forceAutoScan ?? autoScanOnAdd;
    const newItems: ScanItem[] = files.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: shouldAuto ? 'scanning' : 'pending',
      selectedSiswaId: '',
      isSaved: false,
    }));
    setScanItems(prev => [...prev, ...newItems]);

    // Auto-scroll ke bagian Antrian Scan agar progres langsung terlihat di layar HP
    setTimeout(() => {
      queueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    if (shouldAuto) {
      setScanning(true);
      setScanProgress({ current: 0, total: newItems.length });
      toast.info(`⚡ Menganalisis ${files.length} foto LJK dengan AI Vision V5...`);
      (async () => {
        let doneCount = 0;
        for (const item of newItems) {
          await scanOne(item.id, item.file);
          doneCount++;
          setScanProgress({ current: doneCount, total: newItems.length });
        }
        setScanning(false);
        setScanProgress({ current: 0, total: 0 });
        toast.success(`✅ Analisis selesai! Silakan periksa jawaban sebelum klik Simpan ke DB.`);
      })();
    } else {
      toast.success(`${files.length} foto berhasil ditambahkan ke antrian.`);
    }
  }, [selectedKunci, autoScanOnAdd, scanOne]);

  const removeItem = useCallback((id: string) => {
    setScanItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  // ─── Scan all pending/error items ─────────────────────────────────────────
  const scanAll = useCallback(async () => {
    const toScan = scanItems.filter(i => i.status === 'pending' || i.status === 'error');
    if (toScan.length === 0) { toast.info('Tidak ada item yang perlu di-scan.'); return; }
    if (!selectedKunci) { toast.error('Pilih kunci jawaban!'); return; }

    setScanning(true);
    setScanProgress({ current: 0, total: toScan.length });

    let doneCount = 0;
    for (const item of toScan) {
      await scanOne(item.id);
      doneCount++;
      setScanProgress({ current: doneCount, total: toScan.length });
    }

    setScanning(false);
    setScanProgress({ current: 0, total: 0 });
    toast.success(`🎉 Scan selesai! ${doneCount} LJK diproses.`);
  }, [scanItems, selectedKunci, scanOne]);

  // ─── Batch save ─────────────────────────────────────────────────────────────
  const batchSave = useCallback(async () => {
    const readyItems = scanItems.filter(i =>
      i.status === 'done' && !i.isSaved && i.selectedSiswaId && i.result
    );
    if (readyItems.length === 0) {
      toast.error('Tidak ada hasil siap simpan. Pastikan setiap LJK sudah dipasangkan dengan siswa.');
      return;
    }
    const skipped = scanItems.filter(i => i.status === 'done' && !i.isSaved && !i.selectedSiswaId).length;
    if (skipped > 0) toast.warning(`${skipped} item dilewati karena belum dipasangkan siswa.`);

    setSaving(true);
    try {
      const payloads = readyItems.map(item => ({
        id_kunci: selectedKunci!.id_kunci,
        id_siswa: item.selectedSiswaId,
        answers: item.result!.answers,
        confidence_score: (item.result!.confidence || 0) / 100,
        need_review: item.result!.needReview || false,
      }));

      const res = await batchSaveScanResultsAction({ items: payloads });
      if (!res.success) throw new Error(res.message);

      const savedIds = new Set(readyItems.map(i => i.id));
      setScanItems(prev => prev.map(i =>
        savedIds.has(i.id) ? { ...i, isSaved: true, status: 'saved' as ScanStatus } : i
      ));
      toast.success(`✅ ${res.saved} nilai berhasil disimpan ke database!`);
    } catch (e: any) {
      toast.error(`Gagal menyimpan: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [scanItems, selectedKunci]);

  // ─── Stats (memoized) ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = scanItems.length;
    const pending  = scanItems.filter(i => i.status === 'pending').length;
    const scanning$= scanItems.filter(i => i.status === 'scanning').length;
    const done     = scanItems.filter(i => i.status === 'done').length;
    const error    = scanItems.filter(i => i.status === 'error').length;
    const saved    = scanItems.filter(i => i.status === 'saved' || i.isSaved).length;
    const needReview = scanItems.filter(i => i.result?.needReview).length;
    const withResult = scanItems.filter(i => i.result);
    const avgScore = withResult.length > 0
      ? Math.round(withResult.reduce((acc, i) => acc + (i.result?.skorHitung || 0), 0) / withResult.length)
      : 0;
    const readyToSave = scanItems.filter(i => i.status === 'done' && !i.isSaved && i.selectedSiswaId).length;
    return { total, pending, scanning: scanning$, done, error, saved, needReview, avgScore, readyToSave };
  }, [scanItems]);

  // ─── Deteksi Duplikat Siswa di Antrian & di Database (Anti-Dobel Scan Guard) ───
  const duplicateQueueSiswaIds = useMemo(() => {
    const counts: Record<string, number> = {};
    scanItems.forEach(item => {
      if (!item.isSaved && item.selectedSiswaId) {
        counts[item.selectedSiswaId] = (counts[item.selectedSiswaId] || 0) + 1;
      }
    });
    const dupSet = new Set<string>();
    Object.entries(counts).forEach(([sid, count]) => {
      if (count > 1) dupSet.add(sid);
    });
    return dupSet;
  }, [scanItems]);

  const existingScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!selectedKunci?.id_kunci) return map;
    existingHasil.forEach(h => {
      if (String(h.id_kunci) === String(selectedKunci.id_kunci) && h.id_siswa) {
        map[String(h.id_siswa)] = Number(h.skor) || 0;
      }
    });
    return map;
  }, [existingHasil, selectedKunci]);

  // ─── Siswa for modal (Siswa terpilih selalu di urutan paling atas) ───────────
  const filteredSiswaForModal = useMemo(() => {
    const q = siswaSearch.toLowerCase();
    const list = allSiswa.filter(s =>
      !q ||
      s.nama?.toLowerCase().includes(q) ||
      String(s.nis).includes(q) ||
      s.nama_kelas?.toLowerCase().includes(q)
    );
    list.sort((a, b) => {
      // 1. Siswa yang sedang terpilih selalu di urutan #1
      const aSelected = editingSiswaId && String(a.id_siswa) === String(editingSiswaId) ? 0 : 1;
      const bSelected = editingSiswaId && String(b.id_siswa) === String(editingSiswaId) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;

      // 2. Prioritaskan kelas dari kunci ujian aktif
      if (selectedKunci?.id_kelas) {
        const aSame = String(a.id_kelas) === String(selectedKunci.id_kelas) ? 0 : 1;
        const bSame = String(b.id_kelas) === String(selectedKunci.id_kelas) ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
      }
      return String(a.nama || '').localeCompare(String(b.nama || ''));
    });
    return list.slice(0, 100);
  }, [allSiswa, siswaSearch, selectedKunci, editingSiswaId]);

  // ─── Open detail modal ───────────────────────────────────────────────────────
  const openDetail = useCallback((item: ScanItem, focusQuestionNo?: number) => {
    setDetailItem({ ...item, result: item.result ? { ...item.result, answers: item.result.answers.map(a => ({ ...a })) } : undefined });
    setEditingSiswaId(item.selectedSiswaId);
    setSiswaSearch('');
    // Hanya buka daftar pilih siswa jika siswa belum otomatis terpasangkan
    setShowSiswaPicker(!item.selectedSiswaId);
    setModalAnswerFilter('ALL');
    setShowModalPhoto(false);
    if (focusQuestionNo !== undefined) {
      setActiveEditNo(focusQuestionNo);
      const targetAns = item.result?.answers?.find((a: any) => Number(a.no) === Number(focusQuestionNo));
      const disp = formatAnswerForDisplay(targetAns?.ans ?? '');
      setInlineAnswerInput(disp === '—' || disp === '?' ? '' : disp);
    } else {
      setActiveEditNo(null);
      setInlineAnswerInput('');
    }
  }, []);

  const handleEditAnswerInModal = useCallback((noSoal: number, rawInput: string) => {
    if (!detailItem?.result || !selectedKunci) return;
    const kItem = selectedKunci.data_json?.find((k: any) => Number(k.no) === Number(noSoal));
    const tipe = normalizeTipe(kItem?.tipe || selectedKunci.tipe_soal || 'single_choice');
    const normalizedAns = rawInput.trim() === '' || rawInput.trim() === '?'
      ? '?'
      : normalizeAIAnswer(rawInput, tipe);

    const updatedAnswers = detailItem.result.answers.map((a: any) =>
      Number(a.no) === Number(noSoal) ? { ...a, ans: normalizedAns } : a
    );
    const recalc = hitungSkorV3(updatedAnswers, selectedKunci);
    setDetailItem(prev => prev && prev.result ? {
      ...prev,
      result: {
        ...prev.result,
        answers: updatedAnswers,
        skorHitung: recalc.skor,
        skorDetail: recalc,
      }
    } : prev);
  }, [detailItem, selectedKunci]);

  const handleEditEssayScoreInModal = useCallback((noSoal: number, newPoin: number, customText?: string) => {
    if (!detailItem?.result || !selectedKunci) return;
    const kItem = selectedKunci.data_json?.find((k: any) => Number(k.no) === Number(noSoal));
    const bobot = selectedKunci.pengaturan_poin || {};
    const maxPoin =
      kItem?.perlakuan === 'anulir'
        ? 0
        : Number(kItem?.poin ?? bobot[String(noSoal)] ?? bobot.esai ?? bobot.benar ?? 8) || 8;
    const clampedPoin = Math.min(maxPoin, Math.max(0, Number(newPoin) || 0));

    const updatedAnswers = detailItem.result.answers.map((a: any) =>
      Number(a.no) === Number(noSoal)
        ? {
            ...a,
            ...(customText !== undefined ? { ans: customText } : {}),
            poin_manual: clampedPoin,
          }
        : a
    );
    const recalc = hitungSkorV3(updatedAnswers, selectedKunci);
    setDetailItem(prev => prev && prev.result ? {
      ...prev,
      result: {
        ...prev.result,
        answers: updatedAnswers,
        skorHitung: recalc.skor,
        skorDetail: recalc,
      }
    } : prev);
  }, [detailItem, selectedKunci]);

  const handleAutoGradeEssaysInModal = useCallback(async () => {
    if (!detailItem?.result || !selectedKunci?.data_json) return;
    const bobot = selectedKunci.pengaturan_poin || {};
    const essayConfigs = (selectedKunci.data_json as any[]).filter(
      (k) => normalizeTipe(k.tipe) === 'essay'
    );
    if (essayConfigs.length === 0) return;

    setScoringEssaysAI(true);
    try {
      const payload = essayConfigs.map((k) => {
        const no = Number(k.no);
        const ansObj = detailItem.result?.answers?.find((a: any) => Number(a.no) === no);
        const maxPoin =
          k.perlakuan === 'anulir'
            ? 0
            : Number(k.poin ?? bobot[String(no)] ?? bobot.esai ?? bobot.benar ?? 8) || 8;
        return {
          no,
          studentAnswer: String(ansObj?.ans ?? ''),
          rubricOrKey: String(k.jawaban ?? ''),
          maxPoin,
        };
      });

      const res = await scoreStudentEssaysWithAIAction(payload, selectedKunci.judul_ujian);
      if (res.success && res.data) {
        const scoreMap = new Map(res.data.map((r) => [Number(r.no), r]));
        const updatedAnswers = detailItem.result.answers.map((a: any) => {
          const hit = scoreMap.get(Number(a.no));
          if (!hit) return a;
          return {
            ...a,
            poin_manual: hit.score,
            ai_feedback: hit.feedback,
          };
        });
        const recalc = hitungSkorV3(updatedAnswers, selectedKunci);
        setDetailItem((prev) =>
          prev && prev.result
            ? {
                ...prev,
                result: {
                  ...prev.result,
                  answers: updatedAnswers,
                  skorHitung: recalc.skor,
                  skorDetail: recalc,
                },
              }
            : prev
        );
        toast.success(res.message || 'Penilaian esai AI berhasil diterapkan!');
      } else {
        toast.error(res.message || 'Gagal menilai esai dengan AI.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScoringEssaysAI(false);
    }
  }, [detailItem, selectedKunci]);

  // ─── Apply modal edits ───────────────────────────────────────────────────────
  const applyModalEdit = useCallback(() => {
    if (!detailItem) return;
    setScanItems(prev => prev.map(i =>
      i.id === detailItem.id ? { ...i, selectedSiswaId: editingSiswaId, result: detailItem.result } : i
    ));
    setDetailItem(null);
    toast.success('Perubahan siswa & jawaban berhasil diterapkan.');
  }, [detailItem, editingSiswaId]);

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loadingData) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      <p className="text-slate-400 font-bold animate-pulse">Memuat sistem analisis LJK...</p>
    </div>
  );

  return (
    <div className="p-3.5 pb-44 sm:p-8 lg:p-10 max-w-[1700px] mx-auto space-y-5 sm:space-y-8">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4">
          <span className="p-2.5 sm:p-3 bg-violet-500/10 dark:bg-violet-500/20 rounded-2xl sm:rounded-[1.5rem] text-xl sm:text-2xl shadow-inner border border-violet-500/10 dark:border-violet-500/20">🔬</span>
          Analisis LJK
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 sm:mt-2 font-semibold text-xs sm:text-sm max-w-2xl">
          Pilih kunci ujian, foto kertas LJK siswa, lalu simpan nilai otomatis ke database.
        </p>
      </div>

      {/* ── Capability chips (Desktop Only agar layar HP bersih untuk Guru) ── */}
      <div className="hidden sm:flex flex-wrap gap-2">
        {[
          { icon: '🧠', label: 'Dual-Model Consensus',        color: 'text-violet-400 border-violet-500/30 bg-violet-500/5' },
          { icon: '🎯', label: 'AKM 7 Tipe Soal',             color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5' },
          { icon: '🔍', label: 'Auto-Match Nama & NIS',       color: 'text-sky-400    border-sky-500/30    bg-sky-500/5'    },
          { icon: '⚡', label: 'Anomaly Detection',           color: 'text-amber-400  border-amber-500/30  bg-amber-500/5'  },
          { icon: '🔀', label: 'Normalisasi Format Jawaban',  color: 'text-teal-400   border-teal-500/30   bg-teal-500/5'   },
          { icon: '✋', label: 'Human-in-the-Loop Override',  color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'},
        ].map(f => (
          <span key={f.label} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${f.color}`}>
            {f.icon} {f.label}
          </span>
        ))}
      </div>

      {/* ═══════ MAIN GRID ═══════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">

        {/* ─── LEFT: Setup Panel ─── */}
        <div className="space-y-4">

          {/* Pilih Kunci */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm">
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
              <h2 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[10px] font-black">Langkah 1</span>
                <span>Pilih Kunci Ujian</span>
              </h2>
              {selectedKunci ? (
                <button
                  type="button"
                  onClick={() => setIsKunciCollapsed(!isKunciCollapsed)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 transition-all active:scale-95"
                >
                  {isKunciCollapsed ? (
                    <><span>Ganti Kunci</span><ChevronDown className="w-3.5 h-3.5" /></>
                  ) : (
                    <><span>Tutup List</span><ChevronUp className="w-3.5 h-3.5" /></>
                  )}
                </button>
              ) : (
                <span className="text-[9px] text-slate-400 font-normal">{kunciList.length} tersedia</span>
              )}
            </div>

            {/* Collapsible search and list */}
            {(!selectedKunci || !isKunciCollapsed) && (
              <div className="p-4 transition-all">
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input type="text" placeholder="Cari judul, mapel, guru..."
                      value={searchKunci} onChange={e => setSearchKunci(e.target.value)}
                      className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" />
                  </div>
                  <select
                    value={filterSemester}
                    onChange={e => setFilterSemester(e.target.value as 'ALL' | 'GANJIL' | 'GENAP')}
                    aria-label="Filter semester kunci ujian"
                    className={`border rounded-xl px-2.5 py-2 text-[11px] font-bold focus:outline-none cursor-pointer ${filterSemester !== 'ALL' ? 'bg-indigo-500/5 border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}
                  >
                    <option value="ALL">Semua Smt</option>
                    <option value="GANJIL">Smt Ganjil</option>
                    <option value="GENAP">Smt Genap</option>
                  </select>
                </div>
                <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1 custom-scroll">
                  {filteredKunci.length === 0
                    ? <div className="py-8 text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tidak ada kunci jawaban</p></div>
                    : filteredKunci.map(k => {
                      const isSelected = selectedKunci?.id_kunci === k.id_kunci;
                      const dist = getTipeDistribusi(k.data_json || []);
                      return (
                        <button key={k.id_kunci}
                          onClick={() => {
                            setSelectedKunci(k);
                            setScanItems([]);
                            setScanProgress({ current: 0, total: 0 });
                            setIsKunciCollapsed(true);
                          }}
                          className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${isSelected ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] border border-transparent'}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-white/20'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-black truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{k.judul_ujian}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                              {k.nama_mapel} · {k.nama_guru}
                              {k.semester ? ` · Smt ${String(k.semester).toUpperCase().includes('GENAP') || String(k.semester) === '2' ? 'Genap' : 'Ganjil'}` : ''}
                            </div>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {Object.keys(dist).length > 0
                                ? Object.keys(dist).map(t => <TipeBadge key={t} kode={t} />)
                                : <TipeBadge kode={k.tipe_soal || 'single_choice'} />}
                            </div>
                          </div>
                          <div className={`text-lg font-black tabular-nums flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {k.data_json?.length || 0}
                          </div>
                        </button>
                      );
                    })
                  }
                </div>
              </div>
            )}

            {/* Active Key Display */}
            {selectedKunci && (
              <div className="px-5 py-3.5 border-t border-indigo-500/20 bg-indigo-500/5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Kunci Aktif
                  </div>
                  <div className="font-black text-sm text-slate-900 dark:text-white truncate">{selectedKunci.judul_ujian}</div>
                  <div className="text-[10px] text-slate-400">{selectedKunci.data_json?.length} butir · {selectedKunci.nama_mapel}</div>
                </div>
                <button onClick={() => { setSelectedKunci(null); setScanItems([]); setIsKunciCollapsed(false); }}
                  className="w-8 h-8 rounded-xl bg-indigo-500/10 hover:bg-rose-500/20 flex items-center justify-center text-indigo-400 hover:text-rose-500 transition-all active:scale-95"
                  title="Batalkan pilihan kunci">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Progres Scan Kelas & Checklist Siswa Belum Discan */}
            {selectedKunci && classScanCoverage && (
              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50/60 dark:bg-white/[0.015] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Progres Kelas ({classScanCoverage.namaKelas})
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${classScanCoverage.missingSiswa.length === 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {classScanCoverage.scannedCount}/{classScanCoverage.totalKelas} Siswa ({classScanCoverage.pct}%)
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${classScanCoverage.missingSiswa.length === 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${classScanCoverage.pct}%` }}
                  />
                </div>
                {classScanCoverage.missingSiswa.length > 0 ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowMissingSiswa(v => !v)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline pt-0.5"
                    >
                      <span>⚠️ {classScanCoverage.missingSiswa.length} siswa belum discan</span>
                      <span>{showMissingSiswa ? 'Sembunyikan ▲' : 'Lihat Daftar ▼'}</span>
                    </button>
                    {showMissingSiswa && (
                      <div className="mt-2 max-h-32 overflow-y-auto flex flex-wrap gap-1 pr-1">
                        {classScanCoverage.missingSiswa.map(s => (
                          <span
                            key={s.id_siswa}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300"
                          >
                            {s.nama} <span className="text-[9px] text-slate-400 font-mono">({s.nis || '—'})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ Seluruh siswa di kelas ini sudah discan!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats grid */}
          {scanItems.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total',      value: stats.total,     color: 'text-slate-700 dark:text-slate-300' },
                { label: 'Selesai',    value: stats.done + stats.saved, color: 'text-emerald-500' },
                { label: 'Error',      value: stats.error,     color: stats.error > 0 ? 'text-rose-500' : 'text-slate-400' },
                { label: 'Tersimpan', value: stats.saved,     color: 'text-violet-500' },
                { label: 'Review',     value: stats.needReview, color: stats.needReview > 0 ? 'text-amber-500' : 'text-slate-400' },
                { label: 'Rata Skor', value: `${stats.avgScore}`,  color: stats.avgScore >= 70 ? 'text-emerald-500' : 'text-rose-500' },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] rounded-2xl p-3 text-center">
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar saat scanning */}
          {scanning && scanProgress.total > 0 && (
            <div className="bg-white dark:bg-white/[0.02] border border-violet-500/20 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-[10px] font-black">
                <span className="text-violet-400 animate-pulse">AI Memproses...</span>
                <span className="text-slate-400">{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` }}
                />
              </div>
              <div className="text-[9px] text-slate-400 text-center">
                {Math.round((scanProgress.current / scanProgress.total) * 100)}% selesai
              </div>
            </div>
          )}

          {/* Actions (Desktop sidebar — di HP dipindah ke Antrian & Dock Bawah agar tidak menghalangi kamera) */}
          <div className="hidden xl:flex flex-col gap-2">
            <button onClick={scanAll}
              disabled={scanning || !selectedKunci || stats.pending + stats.error === 0}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-violet-500/20 active:scale-95">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {scanning
                ? `Memproses ${scanProgress.current}/${scanProgress.total}...`
                : `Scan Semua (${stats.pending + stats.error} item)`}
            </button>

            <button onClick={batchSave}
              disabled={saving || stats.readyToSave === 0}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
              {saving ? 'Menyimpan...' : `Simpan ${stats.readyToSave} Hasil ke DB`}
            </button>

            {scanItems.length > 0 && (
              <button
                onClick={() => {
                  if (!confirm('Reset semua foto dan hasil scan? Tindakan ini tidak dapat dibatalkan.')) return;
                  scanItems.forEach(i => URL.revokeObjectURL(i.previewUrl));
                  setScanItems([]);
                  setScanProgress({ current: 0, total: 0 });
                }}
                disabled={scanning || saving}
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:border-rose-400 hover:text-rose-500 transition-all disabled:opacity-30">
                <Trash2 className="w-4 h-4" /> Reset Semua
              </button>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Upload + Queue ─── */}
        <div className="space-y-6">

          <DropZone
            onFiles={addFiles}
            onOpenSmartScanner={() => setShowSmartScanner(true)}
            autoScanOnAdd={autoScanOnAdd}
            onToggleAutoScan={() => setAutoScanOnAdd(v => !v)}
            disabled={!selectedKunci || scanning}
          />

          {/* Live AI Scanning Banner (Sangat Jelas di Layar HP) */}
          <div ref={queueSectionRef} className="scroll-mt-24 space-y-4">
            {(scanning || stats.scanning > 0) && (
              <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 text-white rounded-2xl p-4 sm:p-5 shadow-xl shadow-indigo-500/25 border border-white/20 animate-pulse">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black uppercase tracking-wider">
                        AI Vision V5 Sedang Menganalisis LJK...
                      </div>
                      <div className="text-[11px] text-white/85 font-medium mt-0.5">
                        Mendeteksi posisi bulatan kiri-ke-kanan &amp; mencocokkan kunci jawaban ({scanProgress.current}/{Math.max(1, scanProgress.total || stats.scanning)})
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-black/25 text-xs font-mono font-black">
                    {scanProgress.total > 0 ? `${Math.round((scanProgress.current / scanProgress.total) * 100)}%` : 'PROSES'}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full bg-black/25 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{
                      width: `${scanProgress.total > 0 ? Math.max(15, Math.round((scanProgress.current / scanProgress.total) * 100)) : 50}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Empty state */}
          {scanItems.length === 0 ? (
            <div className="bg-white dark:bg-[#0a0e1a]/40 border border-dashed border-slate-200 dark:border-white/[0.05] rounded-[2rem] py-20 flex flex-col items-center gap-4">
              <div className="text-6xl opacity-20 grayscale">🔬</div>
              <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-center max-w-xs">
                {selectedKunci
                  ? 'Unggah foto LJK ke area di atas untuk memulai analisis'
                  : 'Pilih kunci ujian di panel kiri terlebih dahulu'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm">
              {/* Queue header */}
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-500" /> Antrian Hasil Scan
                  <span className="text-xs font-mono text-slate-400">({scanItems.length})</span>
                </h2>
                <div className="flex items-center gap-2.5 text-[9px] font-black">
                  {stats.done  > 0 && <span className="text-emerald-500">{stats.done} SIAP SIMPAN</span>}
                  {stats.pending > 0 && <span className="text-slate-400">{stats.pending} PENDING</span>}
                  {stats.error > 0 && <span className="text-rose-400">{stats.error} ERROR</span>}
                  {stats.saved > 0 && <span className="text-violet-500">{stats.saved} TERSIMPAN</span>}
                  {stats.readyToSave > 0 && (
                    <button
                      type="button"
                      onClick={batchSave}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <DatabaseZap className="w-3 h-3" />}
                      <span>Simpan ({stats.readyToSave})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Queue list (Single scroll di mobile agar tidak kewalahan) */}
              <div className="divide-y divide-slate-100 dark:divide-white/[0.03] lg:max-h-[680px] lg:overflow-y-auto touch-scroll">
                {scanItems.map((item, idx) => {
                  const siswaInfo = item.selectedSiswaId
                    ? allSiswa.find(s => s.id_siswa === item.selectedSiswaId)
                    : item.result?.matchedSiswa;

                  return (
                    <div key={item.id} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-4 sm:px-5 sm:py-4 transition-all group
                      ${item.status === 'done' && !item.isSaved ? 'bg-emerald-500/[0.02]' : ''}
                      ${item.status === 'error' ? 'bg-rose-500/[0.02]' : ''}
                      ${item.status === 'saved' || item.isSaved ? 'bg-violet-500/[0.02]' : ''}
                      ${item.status === 'scanning' ? 'bg-sky-500/[0.02] animate-pulse' : ''}
                    `}>
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Thumbnail */}
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-white/10 shadow-sm">
                          <Image src={item.previewUrl} alt={`LJK ${idx + 1}`} fill unoptimized className="object-cover" />
                          {item.status === 'scanning' && (
                            <div className="absolute inset-0 bg-sky-500/60 flex items-center justify-center">
                              <Brain className="w-5 h-5 text-white animate-pulse" />
                            </div>
                          )}
                          {(item.status === 'saved' || item.isSaved) && (
                            <div className="absolute inset-0 bg-violet-600/75 flex items-center justify-center">
                              <Check className="w-5 h-5 text-white stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {/* Info Body */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-[9px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                            <StatusBadge status={item.isSaved ? 'saved' : item.status} />
                            {item.result?.confidence !== undefined && <ConfidenceBadge value={item.result.confidence} />}
                            {item.result?.warning && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black border border-amber-500/30 text-amber-500 bg-amber-500/10">
                                <AlertTriangle className="w-2.5 h-2.5" /> ANOMALI
                              </span>
                            )}
                            {item.result?.needReview && !item.result?.warning && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black border border-amber-500/20 text-amber-500 bg-amber-500/5">
                                ⚠️ REVIEW
                              </span>
                            )}
                            {!item.isSaved && item.selectedSiswaId && duplicateQueueSiswaIds.has(item.selectedSiswaId) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black border border-rose-500/40 text-rose-500 bg-rose-500/15 animate-pulse">
                                ⚠️ DUPLIKAT DI ANTRIAN
                              </span>
                            )}
                            {!item.isSaved && item.selectedSiswaId && existingScoreMap[item.selectedSiswaId] !== undefined && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black border border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10">
                                🔄 UPDATE NILAI DB (Skor Lama: {existingScoreMap[item.selectedSiswaId]})
                              </span>
                            )}
                          </div>

                          {item.status === 'error' ? (
                            <p className="text-xs text-rose-500 font-medium truncate">{item.errorMsg}</p>
                          ) : item.result ? (
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px]">{item.result.aiName}</span>
                                {siswaInfo && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 truncate">
                                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                                    {siswaInfo.nama || item.result.matchedSiswa?.nama}
                                  </span>
                                )}
                                {!siswaInfo && item.status === 'done' && (
                                  <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                                    <XCircle className="w-3 h-3 flex-shrink-0" /> Belum dipasangkan
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xl sm:text-2xl font-black tabular-nums ${item.result.skorHitung >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                  {item.result.skorHitung}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {item.result.skorDetail?.benar ?? 0}B ·{' '}
                                  {item.result.skorDetail?.salah ?? 0}S ·{' '}
                                  {item.result.skorDetail?.tidak_dijawab ?? 0}K
                                </span>
                              </div>

                              {/* Strip Butir Kosong / Salah (1-Tap Quick Override) */}
                              {!item.isSaved && item.result.answers?.length > 0 && (() => {
                                const blankOrWrong = item.result.answers.filter((a: any) => {
                                  const isBlank = a.ans === '?' || a.ans === '' || a.ans === null || a.ans === undefined;
                                  if (isBlank) return true;
                                  const kItem = selectedKunci?.data_json?.find((k: any) => Number(k.no) === Number(a.no));
                                  const tipe = normalizeTipe(kItem?.tipe || selectedKunci?.tipe_soal || 'single_choice');
                                  return kItem && !answersMatch(a.ans, kItem.jawaban, tipe);
                                });
                                if (blankOrWrong.length === 0) return null;
                                return (
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 mr-0.5">Ketuk Koreksi:</span>
                                    {blankOrWrong.slice(0, 8).map((a: any) => {
                                      const isBlank = a.ans === '?' || a.ans === '' || a.ans === null || a.ans === undefined;
                                      return (
                                        <button
                                          key={a.no}
                                          type="button"
                                          onClick={() => openDetail(item, Number(a.no))}
                                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black border transition-all active:scale-95 ${
                                            isBlank
                                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                                              : 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                                          }`}
                                          title={`Ketuk untuk mengoreksi Soal #${a.no}`}
                                        >
                                          #{a.no}:{isBlank ? '?' : formatAnswerForDisplay(a.ans)}
                                        </button>
                                      );
                                    })}
                                    {blankOrWrong.length > 8 && (
                                      <button
                                        type="button"
                                        onClick={() => openDetail(item)}
                                        className="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-slate-100 dark:bg-white/5 text-slate-500"
                                      >
                                        +{blankOrWrong.length - 8} lagi
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : item.status === 'pending' ? (
                            <p className="text-xs text-slate-400 truncate">{item.file.name}</p>
                          ) : item.status === 'scanning' ? (
                            <p className="text-xs text-sky-500 font-semibold animate-pulse">AI menganalisis LJK...</p>
                          ) : null}
                        </div>
                      </div>

                      {/* Per-item actions: Mobile Horizontal Bar / Desktop Vertical Icons */}
                      <div className="flex flex-row sm:flex-col items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t border-slate-100 dark:border-white/5 sm:border-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {item.result && !item.isSaved && (
                          <button onClick={() => openDetail(item)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:p-2 rounded-xl bg-violet-50 dark:bg-white/5 border border-violet-200 dark:border-white/10 hover:border-violet-400 text-violet-600 dark:text-violet-400 transition-all active:scale-95 text-xs font-bold"
                            title="Edit / Pasangkan Siswa">
                            <Pencil className="w-3.5 h-3.5" />
                            <span className="sm:hidden">Review & Edit</span>
                          </button>
                        )}
                        {(item.status === 'pending' || item.status === 'error') && !scanning && (
                          <button onClick={() => scanOne(item.id)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-all active:scale-95 text-xs font-bold shadow-sm"
                            title="Scan sekarang">
                            <Brain className="w-3.5 h-3.5" />
                            <span className="sm:hidden">Scan</span>
                          </button>
                        )}
                        {item.status === 'error' && (
                          <button onClick={() => scanOne(item.id)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition-all active:scale-95 text-xs font-bold"
                            title="Coba ulang">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="sm:hidden">Ulangi</span>
                          </button>
                        )}
                        {!item.isSaved && !scanning && (
                          <button onClick={() => removeItem(item.id)}
                            className="p-2 sm:p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-rose-400 hover:text-rose-500 text-slate-400 transition-all active:scale-95"
                            title="Hapus dari antrian">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Aksi Cepat di Bawah Antrian (Terutama untuk Mobile / Tablet) */}
              <div className="xl:hidden p-4 border-t border-slate-100 dark:border-white/[0.05] bg-slate-50/70 dark:bg-white/[0.02] flex flex-wrap items-center gap-2">
                {stats.pending + stats.error > 0 && (
                  <button
                    type="button"
                    onClick={scanAll}
                    disabled={scanning}
                    className="flex-1 min-w-[140px] py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-violet-500/20 active:scale-95 disabled:opacity-40"
                  >
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    <span>{scanning ? 'Memproses...' : `Scan (${stats.pending + stats.error})`}</span>
                  </button>
                )}
                {stats.readyToSave > 0 && (
                  <button
                    type="button"
                    onClick={batchSave}
                    disabled={saving}
                    className="flex-1 min-w-[160px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
                    <span>{saving ? 'Menyimpan...' : `Simpan ${stats.readyToSave} ke DB`}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm('Reset semua foto dan hasil scan? Tindakan ini tidak dapat dibatalkan.')) return;
                    scanItems.forEach(i => URL.revokeObjectURL(i.previewUrl));
                    setScanItems([]);
                    setScanProgress({ current: 0, total: 0 });
                  }}
                  disabled={scanning || saving}
                  className="py-3 px-4 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-rose-500 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ DETAIL / EDIT MODAL (Ramah Pemula & Bebas Scroll Berlebih di HP) ═══════ */}
      {detailItem && detailItem.result && (() => {
        const matchedSiswaObj = editingSiswaId
          ? (allSiswa.find(s => String(s.id_siswa) === String(editingSiswaId)) || detailItem.result?.matchedSiswa)
          : null;

        const allAnswers = detailItem.result.answers || [];
        const wrongOrBlankAnswers = allAnswers.filter((ans: any) => {
          const kItem = selectedKunci?.data_json?.find((k: any) => Number(k.no) === Number(ans.no));
          const isKosong = ans.ans === '?' || ans.ans === '' || ans.ans === null || ans.ans === undefined;
          const tipe = normalizeTipe(kItem?.tipe || selectedKunci?.tipe_soal || 'single_choice');
          if (tipe === 'essay') return false;
          return isKosong || (kItem && !answersMatch(ans.ans, kItem.jawaban, tipe));
        });
        const displayedAnswers = modalAnswerFilter === 'WRONG_ONLY' ? wrongOrBlankAnswers : allAnswers;

        return (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setDetailItem(null)}
          >
            <div
              className="bg-white dark:bg-[#0d1117] rounded-t-[2rem] sm:rounded-[2.5rem] max-w-3xl w-full h-[92dvh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-white dark:bg-[#0d1117] border-b border-slate-100 dark:border-white/[0.05] px-4 py-3.5 sm:px-7 sm:py-5 flex items-center justify-between flex-shrink-0 z-10">
                <div className="min-w-0 pr-2">
                  <div className="font-black text-sm sm:text-lg text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <ScanLine className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500 flex-shrink-0" />
                    <span>Review & Koreksi LJK</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    Ketuk nomor soal untuk mengubah jawaban bila diperlukan
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={applyModalEdit}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailItem(null)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Modal Body */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 custom-scroll touch-scroll">

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { label: 'Nama Terbaca', value: detailItem.result.aiName, cls: 'text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate' },
                    { label: 'Skor Hitung', value: `${detailItem.result.skorHitung}`, cls: `text-xl sm:text-2xl font-black ${detailItem.result.skorHitung >= 70 ? 'text-emerald-500' : 'text-rose-500'}` },
                    { label: 'Confidence', value: '', cls: '' },
                  ].map((c, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] rounded-2xl p-2.5 sm:p-4">
                      <div className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{c.label}</div>
                      {i === 2
                        ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <ConfidenceBadge value={detailItem.result!.confidence} />
                            {detailItem.result!.consensus && <span className="text-[8px] text-emerald-500 font-bold">✦ Terverifikasi</span>}
                          </div>
                        )
                        : <div className={c.cls}>{c.value}</div>
                      }
                    </div>
                  ))}
                </div>

                {/* Anomaly warning */}
                {detailItem.result.warning && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[11px] font-black text-amber-600 dark:text-amber-400">⚠️ CATATAN PEMINDAIAN</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">{detailItem.result.warning}</div>
                    </div>
                  </div>
                )}

                {/* ── 1. SISWA MATCHING (Ringkas & Tidak Perlu Scroll Panjang) ── */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        matchedSiswaObj
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                      }`}>
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          {matchedSiswaObj ? '✓ Dipasangkan dengan Siswa' : '⚠️ Siswa Belum Dipilih'}
                        </div>
                        {matchedSiswaObj ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                              {matchedSiswaObj.nama}
                            </span>
                            {matchedSiswaObj.nama_kelas && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                                {matchedSiswaObj.nama_kelas}
                              </span>
                            )}
                            {matchedSiswaObj.nis && (
                              <span className="text-[10px] font-mono text-slate-400">NIS {matchedSiswaObj.nis}</span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-rose-500">Pilih nama siswa dari daftar di bawah</div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowSiswaPicker(v => !v)}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-violet-600 dark:text-violet-400 hover:border-violet-400 transition-all active:scale-95 flex-shrink-0"
                    >
                      {showSiswaPicker ? 'Tutup Daftar' : (matchedSiswaObj ? 'Ganti Siswa' : 'Pilih Siswa')}
                    </button>
                  </div>

                  {/* Dropdown Pencarian Siswa (Hanya Muncul Saat Klik "Ganti Siswa" atau Belum Ada Siswa) */}
                  {(showSiswaPicker || !matchedSiswaObj) && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-white/[0.06] space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Ketik nama atau NIS siswa..."
                          value={siswaSearch}
                          onChange={e => setSiswaSearch(e.target.value)}
                          className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-violet-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                      </div>
                      <div className="max-h-[150px] overflow-y-auto space-y-1 border border-slate-200 dark:border-white/[0.05] bg-white dark:bg-[#0a0e1a]/60 rounded-xl p-1.5 touch-scroll">
                        {filteredSiswaForModal.length === 0 ? (
                          <p className="text-center text-[10px] text-slate-400 py-3 font-bold">Tidak ada siswa ditemukan</p>
                        ) : (
                          filteredSiswaForModal.map(s => {
                            const selected = String(editingSiswaId) === String(s.id_siswa);
                            const isTargetKelas = selectedKunci?.id_kelas && String(s.id_kelas) === String(selectedKunci.id_kelas);
                            return (
                              <button
                                key={s.id_siswa}
                                type="button"
                                onClick={() => {
                                  setEditingSiswaId(s.id_siswa);
                                  setShowSiswaPicker(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-all text-xs active:scale-[0.99] ${
                                  selected
                                    ? 'bg-emerald-500/15 border border-emerald-500/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border border-transparent'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                  selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-white/20'
                                }`}>
                                  {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                                <span className={`font-bold flex-1 truncate ${selected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                  {s.nama}
                                </span>
                                {s.nama_kelas && (
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                    isTargetKelas ? 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                                  }`}>
                                    {s.nama_kelas}
                                  </span>
                                )}
                                <span className="text-slate-400 font-mono text-[9px] flex-shrink-0">{s.nis}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 2. PRATINJAU FOTO LJK (Bisa Dibuka/Tutup dengan 1 Ketukan) ── */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowModalPhoto(v => !v)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-200 hover:border-violet-400 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-violet-500" />
                      <span>{showModalPhoto ? 'Sembunyikan Foto Kertas LJK' : 'Lihat Foto Kertas LJK Asli'}</span>
                    </span>
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                      {showModalPhoto ? '▲ Tutup' : '▼ Buka Foto'}
                    </span>
                  </button>
                  {showModalPhoto && (
                    <div className="mt-2 relative w-full max-h-[280px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-950/40 p-2 flex justify-center touch-scroll">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={detailItem.previewUrl}
                        alt="Pratinjau LJK"
                        className="max-w-full h-auto rounded-xl object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* ── 3. ANSWER GRID (Filter Cepat + Grid 5 Kolom Ringkas di HP) ── */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>
                        {detailItem.result.skorDetail?.benar ?? 0} Benar · {detailItem.result.skorDetail?.salah ?? 0} Salah · {detailItem.result.skorDetail?.tidak_dijawab ?? 0} Kosong
                      </span>
                    </div>

                    {/* Filter Tab: Semua vs Salah/Kosong */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setModalAnswerFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                          modalAnswerFilter === 'ALL'
                            ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Semua ({allAnswers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalAnswerFilter('WRONG_ONLY')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                          modalAnswerFilter === 'WRONG_ONLY'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Perlu Cek ({wrongOrBlankAnswers.length})
                      </button>
                    </div>
                  </div>

                  {/* Panel Koreksi Interaktif Tanpa Prompt Browser */}
                  {activeEditNo !== null && (() => {
                    const targetAnsObj = detailItem.result.answers.find((a: any) => Number(a.no) === activeEditNo);
                    const kItem = selectedKunci?.data_json?.find((k: any) => Number(k.no) === activeEditNo);
                    const tipe = normalizeTipe(kItem?.tipe || selectedKunci?.tipe_soal || 'single_choice');
                    const kunciDisp = formatAnswerForDisplay(kItem?.jawaban ?? '—');
                    const isSimpleChoice = tipe === 'single_choice' || tipe === 'single_choice_4' || tipe === 'true_false';
                    const choiceOptions = tipe === 'true_false'
                      ? ['B', 'S']
                      : tipe === 'single_choice_4'
                        ? ['A', 'B', 'C', 'D']
                        : (kItem?.opsi?.length ? kItem.opsi : ['A', 'B', 'C', 'D', 'E']);

                    return (
                      <div className="mb-3 p-3 rounded-2xl bg-violet-500/10 border-2 border-violet-500/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-violet-600 text-white text-[10px]">Ubah Soal #{activeEditNo}</span>
                            <TipeBadge kode={tipe} />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              Kunci: <b className="text-emerald-600 dark:text-emerald-400">{kunciDisp}</b>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveEditNo(null)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {isSimpleChoice ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {choiceOptions.map((opt: string) => {
                              const active = String(targetAnsObj?.ans || '').toUpperCase() === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    handleEditAnswerInModal(activeEditNo, opt);
                                    setActiveEditNo(null);
                                  }}
                                  className={`min-w-[44px] h-10 px-3 rounded-xl font-black text-xs border transition-all active:scale-95 ${
                                    active
                                      ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                                      : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-violet-400'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                handleEditAnswerInModal(activeEditNo, '?');
                                setActiveEditNo(null);
                              }}
                              className="h-10 px-3 rounded-xl font-black text-[10px] uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95 ml-auto"
                            >
                              Kosong (?)
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={inlineAnswerInput}
                              onChange={(e) => setInlineAnswerInput(e.target.value)}
                              placeholder={
                                tipe === 'multiple_select'
                                  ? 'Contoh: A, C'
                                  : tipe === 'multiple_true_false'
                                    ? 'Contoh: B, S, B'
                                    : tipe === 'matching'
                                      ? 'Contoh: 1-A, 2-B, 3-C'
                                      : 'Ketik jawaban siswa...'
                              }
                              className="flex-1 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleEditAnswerInModal(activeEditNo, inlineAnswerInput);
                                setActiveEditNo(null);
                              }}
                              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase tracking-wider active:scale-95"
                            >
                              OK
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Grid 5 Kolom di HP (40 Soal = 8 Baris Pas di Layar Tanpa Scroll Panjang!) */}
                  {displayedAnswers.length === 0 ? (
                    <div className="py-6 text-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                      🎉 Luar biasa! Semua jawaban pilihan ganda sudah benar.
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
                      {displayedAnswers.map((ans: any) => {
                        const kItem = selectedKunci?.data_json?.find((k: any) => k.no === ans.no);
                        const isKosong = ans.ans === '?' || ans.ans === '' || ans.ans === null || ans.ans === undefined;
                        const tipe = normalizeTipe(kItem?.tipe || selectedKunci?.tipe_soal || 'single_choice');
                        const isEssay = tipe === 'essay';
                        const detailRow = detailItem.result?.skorDetail?.detail?.find((d: any) => Number(d.no) === Number(ans.no));
                        const essayScored = isEssay && (ans.poin_manual !== undefined || detailRow?.status === 'dinilai');
                        const essayPoin = Number(ans.poin_manual ?? detailRow?.poin_didapat ?? 0);
                        const essayMax = Number(detailRow?.poin_max ?? kItem?.poin ?? 8);
                        const correct = isEssay ? (essayScored && essayPoin >= essayMax * 0.5) : (!isKosong && kItem && answersMatch(ans.ans, kItem.jawaban, tipe));
                        const displayAns = isEssay
                          ? (essayScored ? `${essayPoin}/${essayMax}p` : 'Esai')
                          : formatAnswerForDisplay(ans.ans ?? '?');
                        const isEditingThis = activeEditNo === Number(ans.no);
                        return (
                          <button
                            type="button"
                            key={ans.no}
                            onClick={() => {
                              const rawAns = formatAnswerForDisplay(ans.ans ?? '?');
                              const currentVal = rawAns === '—' || rawAns === '?' ? '' : rawAns;
                              setActiveEditNo(Number(ans.no));
                              setInlineAnswerInput(currentVal);
                            }}
                            title={`Ketuk untuk mengoreksi Soal #${ans.no}`}
                            className={`py-1.5 px-1 rounded-xl border text-center transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center
                            ${isEditingThis ? 'ring-2 ring-violet-500 border-violet-500 bg-violet-500/20' :
                              isEssay
                                ? (essayScored ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10')
                                : isKosong ? 'border-amber-500/40 bg-amber-500/10'
                                : correct ? 'border-emerald-500/30 bg-emerald-500/10'
                                : 'border-rose-500/35 bg-rose-500/10'}`}
                          >
                            <div className="font-mono text-slate-400 text-[8px] font-bold leading-none">#{ans.no}</div>
                            <div className={`font-black text-xs sm:text-sm leading-tight mt-0.5 truncate max-w-full ${
                              isEssay ? (essayScored ? 'text-emerald-500' : 'text-amber-500') : isKosong ? 'text-amber-500' : correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                            }`}>
                              {displayAns}
                            </div>
                            {kItem && !isEssay && !correct && (
                              <div className="text-[8px] text-slate-500 dark:text-slate-400 font-bold leading-none mt-0.5 truncate max-w-full">
                                k:{formatAnswerForDisplay(kItem.jawaban ?? '—')}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ── PANEL PENILAIAN URAIAN / ESAI TERPADU ── */}
                  {(() => {
                    const essayQuestions = (selectedKunci?.data_json || []).filter(
                      (k: any) => normalizeTipe(k.tipe) === 'essay'
                    );
                    if (essayQuestions.length === 0) return null;
                    const bobot = selectedKunci?.pengaturan_poin || {};
                    const skorDet = detailItem.result?.skorDetail;

                    return (
                      <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/[0.06] border border-rose-500/20 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                              <span>✍️ Penilaian Soal Uraian / Esai ({essayQuestions.length} Nomor)</span>
                              <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-[10px] font-mono">
                                Poin Esai: {skorDet?.poin_esai ?? 0} / {skorDet?.poin_maksimal_esai ?? 0}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Gunakan <b>Auto-Score AI</b> jika esai ditulis di LJK, atau <b>ketik/klik poin</b> langsung.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={scoringEssaysAI}
                            onClick={handleAutoGradeEssaysInModal}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-40"
                          >
                            {scoringEssaysAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            <span>Nilai Esai dengan AI</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {essayQuestions.map((kItem: any) => {
                            const no = Number(kItem.no);
                            const maxPoin =
                              kItem.perlakuan === 'anulir'
                                ? 0
                                : Number(kItem.poin ?? bobot[String(no)] ?? bobot.esai ?? bobot.benar ?? 8) || 8;
                            const ansObj = detailItem.result?.answers?.find((a: any) => Number(a.no) === no);
                            const detRow = skorDet?.detail?.find((d: any) => Number(d.no) === no);
                            const currentPoin = Number(ansObj?.poin_manual ?? detRow?.poin_didapat ?? 0);
                            const isGraded = ansObj?.poin_manual !== undefined || detRow?.status === 'dinilai';
                            const studentText = ansObj?.ans && ansObj.ans !== '?' ? String(ansObj.ans) : '';
                            const feedback = ansObj?.ai_feedback || detRow?.ai_feedback;

                            return (
                              <div
                                key={no}
                                className="p-3 rounded-xl bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/10 space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black">
                                      Esai #{no}
                                    </span>
                                    {kItem.jawaban && (
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]" title={String(kItem.jawaban)}>
                                        Pedoman: <b className="text-slate-700 dark:text-slate-200">{String(kItem.jawaban)}</b>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:ml-auto justify-between sm:justify-end">
                                    <div className="flex flex-wrap items-center gap-1">
                                      {[
                                        { label: '0', val: 0 },
                                        { label: '½', val: Math.round((maxPoin * 0.5) * 2) / 2 },
                                        { label: '¾', val: Math.round((maxPoin * 0.75) * 2) / 2 },
                                        { label: `Penuh (${maxPoin})`, val: maxPoin },
                                      ].map((preset) => (
                                        <button
                                          key={preset.label}
                                          type="button"
                                          onClick={() => handleEditEssayScoreInModal(no, preset.val)}
                                          className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all active:scale-95 ${
                                            isGraded && currentPoin === preset.val
                                              ? 'bg-emerald-600 text-white border-emerald-600'
                                              : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-rose-400'
                                          }`}
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxPoin}
                                        step={0.5}
                                        value={isGraded ? currentPoin : ''}
                                        placeholder="0"
                                        onChange={(e) => handleEditEssayScoreInModal(no, Number(e.target.value) || 0)}
                                        className="w-14 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded-lg px-2 py-1 text-center text-xs font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-rose-500"
                                      />
                                      <span className="text-[10px] font-mono font-bold text-slate-400">/{maxPoin}</span>
                                    </div>
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  value={studentText}
                                  onChange={(e) => handleEditEssayScoreInModal(no, currentPoin, e.target.value || '?')}
                                  placeholder="Transkripsi jawaban esai siswa di LJK (atau catatan koreksi kertas terpisah)..."
                                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500/40"
                                />
                                {feedback && (
                                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                    💡 {feedback}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Sticky Modal Footer — Pasti Terlihat di Atas Navigasi HP */}
              <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0d1117] flex items-center justify-between gap-2.5 flex-shrink-0 pb-safe">
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={applyModalEdit}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan & Terapkan Perubahan</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ MOBILE FLOATING ACTION DOCK (Kenyamanan Satu Tangan di HP, Sembunyi Saat Modal Buka) ═══════ */}
      {selectedKunci && !detailItem && !showSmartScanner && (
        <div className="lg:hidden fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] inset-x-3 z-30 bg-slate-900/95 dark:bg-[#0d1117]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 shadow-2xl flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSmartScanner(true)}
            className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Kamera Pintar</span>
          </button>

          {stats.pending + stats.error > 0 && (
            <button
              type="button"
              onClick={scanAll}
              disabled={scanning}
              className="py-3 px-3.5 rounded-xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              <span>Scan ({stats.pending + stats.error})</span>
            </button>
          )}

          {stats.readyToSave > 0 && (
            <button
              type="button"
              onClick={batchSave}
              disabled={saving}
              className="py-3 px-3.5 rounded-xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
              <span>Simpan ({stats.readyToSave})</span>
            </button>
          )}
        </div>
      )}

      {/* ═══════ AI SMART CAMERA SCANNER MODAL ═══════ */}
      <SmartLJKScannerModal
        isOpen={showSmartScanner}
        onClose={() => setShowSmartScanner(false)}
        onCaptureFiles={(files, autoStart) => addFiles(files, autoStart ?? true)}
        kunciTitle={selectedKunci?.judul_ujian}
        totalSoal={selectedKunci?.data_json?.length || 40}
      />
    </div>
  );
}

// ─── Helper: Client-Side Automatic Image Compressor & Base64 Encoder ──────────
async function fileToBase64(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Fungsi ini hanya berjalan di browser.');
  }

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // 1024px adalah ukuran 1-Tile Native Gemini Vision (768x1024, ~100KB):
        // Mencegah gambar dipotong menjadi 9 sub-tiles oleh Gemini (yang membuat lambat >25s & membelah baris bulatan)
        const MAX_DIM = 1024;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl.split(',')[1]);
      } catch {
        URL.revokeObjectURL(objectUrl);
        // Fallback to raw FileReader
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

async function createMiniThumbnail(file: File): Promise<string> {
  if (typeof window === 'undefined') return FALLBACK_THUMB_SVG;

  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const MAX_DIM = 240;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(FALLBACK_THUMB_SVG);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(FALLBACK_THUMB_SVG);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(FALLBACK_THUMB_SVG);
    };

    img.src = objectUrl;
  });
}
