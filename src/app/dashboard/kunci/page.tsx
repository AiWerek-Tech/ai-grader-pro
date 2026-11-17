'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit2,
  Eye,
  FileText,
  HelpCircle,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Scan,
  Search,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { getIRTStatsAction } from '@/lib/actions/admin';
import { deleteKunciAction, getKunciListAction } from '@/lib/actions/kunci';
import { getMasterData } from '@/lib/actions/master';
import {
  getTipeDistribusi,
  getTipeMeta,
  SemesterKode,
  TIPE_COLOR,
  TIPE_SOAL_AKM,
} from '@/lib/constants/tipe-soal';
import KunciEditorModal, { EditorMode } from '@/components/kunci/KunciEditorModal';
import { KunciDeleteModal, KunciDetailModal, KunciIrtModal } from '@/components/kunci/KunciModals';
import KunciPrintSheet from '@/components/kunci/KunciPrintSheet';
import {
  calcTotalPoin,
  downloadKunciCsv,
  formatTanggalSingkat,
  hydrateSoalItems,
  parseDataJsonSafe,
} from '@/components/kunci/kunci-utils';

const ITEMS_PER_PAGE = 9;

type KindFilter = 'all' | 'pg_only' | 'akm_mix' | 'has_essay';
type SortOption = 'newest' | 'title_asc' | 'most_items' | 'most_results';

export default function KunciJawabanPage() {
  const router = useRouter();
  const [kunciList, setKunciList] = useState<any[]>([]);
  const [masterData, setMasterData] = useState<{ kelas: any[]; mapel: any[] }>({
    kelas: [],
    mapel: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeSemester, setActiveSemester] = useState<SemesterKode>('GANJIL');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterSemester, setFilterSemester] = useState<'' | 'GANJIL' | 'GENAP'>('');
  const [filterKind, setFilterKind] = useState<KindFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showGuide, setShowGuide] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals & Print State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editorTarget, setEditorTarget] = useState<any | null>(null);

  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [irtTarget, setIrtTarget] = useState<any | null>(null);
  const [irtStats, setIrtStats] = useState<any[]>([]);
  const [loadingIrt, setLoadingIrt] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [printingKunci, setPrintingKunci] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, mRes] = await Promise.all([
        getKunciListAction(undefined, 'ALL'),
        getMasterData(),
      ]);
      if (kRes.success && kRes.data) {
        setKunciList(kRes.data);
        if (kRes.activeSemester === 'GENAP' || kRes.activeSemester === 'GANJIL') {
          setActiveSemester(kRes.activeSemester);
        }
      } else if (kRes.message) {
        toast.error(kRes.message);
      }

      if (mRes.success && mRes.data) {
        setMasterData({
          kelas: mRes.data.kelas || [],
          mapel: mRes.data.mapel || [],
        });
      }
    } catch {
      toast.error('Gagal terhubung ke server spreadsheet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMapelLabel = useCallback(
    (id: string) => masterData.mapel.find((m) => m.id_mapel === id)?.nama_mapel || id || '—',
    [masterData.mapel]
  );

  const getKelasLabel = useCallback(
    (id: string) => masterData.kelas.find((k) => k.id_kelas === id)?.nama_kelas || id || '—',
    [masterData.kelas]
  );

  const filteredAndSortedKunci = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = kunciList.filter((k) => {
      if (filterMapel && k.id_mapel !== filterMapel) return false;
      if (filterKelas && k.id_kelas !== filterKelas) return false;
      if (filterSemester) {
        const kSem = String(k.semester || '').trim().toUpperCase();
        if (kSem !== filterSemester) return false;
      }

      if (filterKind !== 'all') {
        const items = parseDataJsonSafe(k.data_json);
        const hasEssay = items.some((x: any) => getTipeMeta(x.tipe).kode === 'essay');
        const allSinglePg =
          items.length > 0 &&
          items.every((x: any) => ['single_choice', 'single_choice_4'].includes(getTipeMeta(x.tipe).kode));
        if (filterKind === 'pg_only' && !allSinglePg) return false;
        if (filterKind === 'has_essay' && !hasEssay) return false;
        if (filterKind === 'akm_mix' && allSinglePg) return false;
      }

      if (!q) return true;
      return (
        String(k.judul_ujian || '').toLowerCase().includes(q) ||
        String(k.id_kunci || '').toLowerCase().includes(q) ||
        String(k.nama_guru || '').toLowerCase().includes(q) ||
        getMapelLabel(k.id_mapel).toLowerCase().includes(q) ||
        getKelasLabel(k.id_kelas).toLowerCase().includes(q)
      );
    });

    if (sortBy === 'newest') {
      return [...list].sort((a, b) => {
        const ta = new Date(a.timestamp || 0).getTime() || 0;
        const tb = new Date(b.timestamp || 0).getTime() || 0;
        return tb - ta;
      });
    }
    if (sortBy === 'title_asc') {
      return [...list].sort((a, b) => String(a.judul_ujian || '').localeCompare(String(b.judul_ujian || ''), 'id'));
    }
    if (sortBy === 'most_items') {
      return [...list].sort((a, b) => parseDataJsonSafe(b.data_json).length - parseDataJsonSafe(a.data_json).length);
    }
    if (sortBy === 'most_results') {
      return [...list].sort((a, b) => (Number(b.hasil_count) || 0) - (Number(a.hasil_count) || 0));
    }
    return list;
  }, [
    kunciList,
    filterMapel,
    filterKelas,
    filterSemester,
    filterKind,
    searchQuery,
    sortBy,
    getMapelLabel,
    getKelasLabel,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedKunci.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMapel, filterKelas, filterSemester, filterKind, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedKunci = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedKunci.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedKunci, currentPage]);

  const stats = useMemo(() => {
    let totalSoal = 0;
    let mixedCount = 0;
    kunciList.forEach((k) => {
      const items = parseDataJsonSafe(k.data_json);
      totalSoal += items.length;
      const dist = getTipeDistribusi(items);
      if (
        Object.keys(dist).length > 1 ||
        items.some((x: any) => !['single_choice', 'single_choice_4'].includes(x.tipe))
      ) {
        mixedCount++;
      }
    });
    return { totalKunci: kunciList.length, totalSoal, mixedCount };
  }, [kunciList]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push('ellipsis');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  const openEditor = (mode: EditorMode, target: any | null) => {
    setEditorMode(mode);
    setEditorTarget(target);
    setEditorOpen(true);
  };

  const handleOpenIRT = async (k: any) => {
    setIrtTarget(k);
    setIrtStats([]);
    setLoadingIrt(true);
    try {
      const res = await getIRTStatsAction(k.id_kunci);
      if (res.success && res.data) setIrtStats(res.data);
      else toast.info(res.message || 'Belum ada data hasil scan untuk kunci ini.');
    } catch {
      toast.error('Gagal mengambil analisis butir IRT.');
    } finally {
      setLoadingIrt(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteKunciAction(deleteTarget.id_kunci);
      if (res.success) {
        toast.success('Master kunci jawaban berhasil dihapus.');
        setDeleteTarget(null);
        await loadData();
      } else {
        toast.error(res.message || 'Gagal menghapus kunci jawaban.');
      }
    } catch {
      toast.error('Terjadi gangguan saat menghapus kunci.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePrintKunci = (k: any) => {
    setPrintingKunci(k);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleGoLjk = (k: any) => {
    router.push(`/dashboard/ljk?kunci=${encodeURIComponent(k.id_kunci)}`);
  };

  const handleGoScan = (k: any) => {
    router.push(`/dashboard/analisis?kunci=${encodeURIComponent(k.id_kunci)}`);
  };

  return (
    <>
      <div className="space-y-6 pb-20 fade-in print:hidden">
        {/* Hero Header */}
        <div className="surface-card p-5 sm:p-6 bg-gradient-to-br from-purple-600/10 via-indigo-500/5 to-cyan-500/10 border-purple-500/20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 text-[10px] font-black uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" /> Studio Kunci Jawaban v2
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Buat &amp; Kelola Kunci Jawaban
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                Atur identitas asesmen Kurikulum Merdeka, jumlah soal &amp; persentase bobot tiap jenis dalam satu layar bersih, lalu isi kunci dengan cepat via <strong>Detail</strong>, <strong>Papan Cepat</strong>, maupun <strong>Excel / AI</strong>.
              </p>

              {/* Alur Cepat Pemula */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  1. Buat Kunci &amp; Bobot
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  2. Cetak LJK PDF
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  3. Scan Lembar Siswa
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowGuide((v) => !v)}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:border-purple-400 transition-all">
                <HelpCircle className="w-4 h-4 text-purple-500" />
                <span>{showGuide ? 'Tutup Panduan' : 'Panduan 8 Tipe'}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadKunciCsv(filteredAndSortedKunci, getMapelLabel, getKelasLabel)}
                disabled={filteredAndSortedKunci.length === 0}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:border-emerald-400 disabled:opacity-40 transition-all">
                <Download className="w-4 h-4 text-emerald-500" />
                <span>Ekspor CSV</span>
              </button>

              <button
                type="button"
                onClick={() => openEditor('create', null)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-black inline-flex items-center gap-2 shadow-lg shadow-purple-500/25 active:scale-95 transition-all">
                <Plus className="w-4 h-4" />
                <span>Buat Kunci Baru</span>
              </button>
            </div>
          </div>

          {/* Collapsible Panduan 8 Tipe Soal AKM */}
          {showGuide && (
            <div className="mt-5 pt-5 border-t border-slate-200/80 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {TIPE_SOAL_AKM.map((t) => (
                <div
                  key={t.kode}
                  className="p-3 rounded-2xl bg-white/90 dark:bg-[#0d111d] border border-slate-200 dark:border-white/10 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${TIPE_COLOR[t.color]}`}>
                      {t.short}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{t.contoh}</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">{t.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ringkasan Statistik */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {[
            {
              label: 'Kunci Ujian',
              val: stats.totalKunci,
              icon: KeyRound,
              color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
            },
            {
              label: 'Total Soal',
              val: stats.totalSoal,
              icon: FileText,
              color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
            },
            {
              label: 'Paket AKM',
              val: stats.mixedCount,
              icon: Layers,
              color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="surface-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight">
                  {s.label}
                </p>
                <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                  {s.val}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter & Sort Toolbar */}
        <div className="surface-card p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul ujian, mapel, kelas, guru, atau ID..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-medium outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterMapel}
                onChange={(e) => setFilterMapel(e.target.value)}
                aria-label="Filter Mata Pelajaran"
                className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none">
                <option value="">Semua Mapel</option>
                {masterData.mapel.map((m) => (
                  <option key={m.id_mapel} value={m.id_mapel}>
                    {m.nama_mapel}
                  </option>
                ))}
              </select>

              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                aria-label="Filter Kelas"
                className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none">
                <option value="">Semua Kelas</option>
                {masterData.kelas.map((k) => (
                  <option key={k.id_kelas} value={k.id_kelas}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>

              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value as '' | 'GANJIL' | 'GENAP')}
                aria-label="Filter Semester"
                className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none">
                <option value="">Semua Semester</option>
                <option value="GANJIL">Semester Ganjil</option>
                <option value="GENAP">Semester Genap</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Urutkan"
                className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#050314] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none">
                <option value="newest">Terbaru</option>
                <option value="title_asc">Judul A–Z</option>
                <option value="most_items">Soal Terbanyak</option>
                <option value="most_results">Hasil Terbanyak</option>
              </select>

              <div className="hidden lg:inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1 transition-all ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                  <LayoutGrid className="w-3.5 h-3.5" /> Kartu
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1 transition-all ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                  <List className="w-3.5 h-3.5" /> Tabel
                </button>
              </div>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="h-10 px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-purple-400 transition-all"
                title="Muat ulang daftar kunci">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filter Jenis Soal Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/70 dark:border-white/10">
            {[
              { id: 'all' as const, label: 'Semua Format' },
              { id: 'pg_only' as const, label: 'PG Tunggal' },
              { id: 'akm_mix' as const, label: 'AKM / Campuran' },
              { id: 'has_essay' as const, label: 'Mengandung Esai' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterKind(chip.id)}
                className={`px-3 py-1 rounded-xl text-[11px] font-black border transition-all ${
                  filterKind === chip.id
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-purple-400'
                }`}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="surface-card py-20 text-center space-y-3">
            <Loader2 className="w-9 h-9 animate-spin text-purple-500 mx-auto" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Memuat daftar master kunci jawaban...
            </p>
          </div>
        ) : filteredAndSortedKunci.length === 0 ? (
          <div className="surface-card py-16 px-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {kunciList.length === 0 ? 'Belum Ada Kunci Jawaban' : 'Tidak Ada Kunci yang Cocok'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {kunciList.length === 0
                  ? 'Mulai buat kunci ujian pertama Anda: pilih jenis asesmen, tentukan jumlah & bobot soal (total 100%), lalu isi jawabannya.'
                  : 'Coba ubah kata kunci pencarian atau reset filter di atas.'}
              </p>
            </div>
            {kunciList.length === 0 && (
              <button
                type="button"
                onClick={() => openEditor('create', null)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black inline-flex items-center gap-2 shadow-lg shadow-purple-500/25">
                <Plus className="w-4 h-4" /> Buat Kunci Pertama Sekarang
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Card View */}
            <div
              className={
                viewMode === 'cards'
                  ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
                  : 'grid grid-cols-1 gap-3 lg:hidden'
              }>
              {paginatedKunci.map((k) => {
                const items = hydrateSoalItems(k);
                const totalPoin = calcTotalPoin(items);
                const dist = getTipeDistribusi(items);
                const hasilCount = Number(k.hasil_count) || 0;

                return (
                  <div
                    key={k.id_kunci}
                    className="surface-card p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-purple-500/40 transition-all">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[9px] font-mono font-black text-purple-700 dark:text-purple-300">
                            {k.id_kunci}
                          </span>
                          {k.semester && (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase">
                              {k.semester}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {hasilCount > 0 && (
                            <span
                              className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[10px] font-black text-blue-700 dark:text-blue-300 inline-flex items-center gap-1"
                              title="Sudah memiliki hasil scan siswa">
                              <CheckCircle2 className="w-3 h-3" /> {hasilCount} siswa
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                            {items.length} Soal · {totalPoin} Poin
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
                          {k.judul_ujian}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                          {getMapelLabel(k.id_mapel)} · Kelas {getKelasLabel(k.id_kelas)}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] font-bold text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" /> {k.nama_guru || k.id_guru || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatTanggalSingkat(k.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(dist).map(([kode, cnt]) => {
                          const meta = getTipeMeta(kode);
                          return (
                            <span
                              key={kode}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${TIPE_COLOR[meta.color]}`}>
                              {meta.short}: {cnt}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Aksi Cepat */}
                    <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleGoLjk(k)}
                          className="h-9 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white border border-blue-500/25 text-[11px] font-black inline-flex items-center justify-center gap-1.5 transition-all">
                          <Printer className="w-3.5 h-3.5" /> Cetak LJK
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGoScan(k)}
                          className="h-9 px-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-500/25 text-[11px] font-black inline-flex items-center justify-center gap-1.5 transition-all">
                          <Scan className="w-3.5 h-3.5" /> Scan LJK
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailTarget(k)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-purple-600"
                            title="Detail & Cetak Kunci">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenIRT(k)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-amber-500"
                            title="Analisis butir IRT">
                            <BarChart3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditor('duplicate', k)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-cyan-500"
                            title="Duplikat ke kelas lain">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditor('edit', k)}
                            className="px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600 text-purple-700 dark:text-purple-300 hover:text-white border border-purple-500/25 text-[11px] font-black inline-flex items-center gap-1 transition-all">
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(k)}
                            className={`p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/25 transition-all ${
                              hasilCount > 0 ? 'opacity-65' : ''
                            }`}
                            title={hasilCount > 0 ? 'Dilindungi hasil siswa' : 'Hapus kunci'}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Compact Table View */}
            {viewMode === 'table' && (
              <div className="hidden lg:block surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3.5 px-5">Ujian &amp; Pembuat</th>
                        <th className="py-3.5 px-4">Mapel &amp; Kelas</th>
                        <th className="py-3.5 px-4">Komposisi Soal</th>
                        <th className="py-3.5 px-4 text-center">Butir / Bobot / Hasil</th>
                        <th className="py-3.5 px-5 text-right">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                      {paginatedKunci.map((k) => {
                        const items = hydrateSoalItems(k);
                        const totalPoin = calcTotalPoin(items);
                        const dist = getTipeDistribusi(items);
                        const hasilCount = Number(k.hasil_count) || 0;

                        return (
                          <tr key={k.id_kunci} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-black text-slate-900 dark:text-white">{k.judul_ujian}</p>
                                {k.semester && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase">
                                    Smt {k.semester === 'GANJIL' ? 'Ganjil' : k.semester === 'GENAP' ? 'Genap' : k.semester}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                                  {k.id_kunci}
                                </span>
                                <span>· {k.nama_guru || k.id_guru || '—'}</span>
                                <span>· {formatTanggalSingkat(k.timestamp)}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                              <div>{getMapelLabel(k.id_mapel)}</div>
                              <div className="text-[11px] text-slate-500">Kelas {getKelasLabel(k.id_kelas)}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(dist).map(([kode, cnt]) => {
                                  const meta = getTipeMeta(kode);
                                  return (
                                    <span
                                      key={kode}
                                      className={`px-2 py-0.5 rounded text-[9px] font-black border ${TIPE_COLOR[meta.color]}`}>
                                      {meta.short}:{cnt}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center font-black text-slate-900 dark:text-white">
                              <div>
                                {items.length} <span className="text-slate-400 font-normal">/</span>{' '}
                                <span className="text-emerald-600 dark:text-emerald-400">{totalPoin} pts</span>
                              </div>
                              {hasilCount > 0 && (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                                  {hasilCount} terkoreksi
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDetailTarget(k)}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-purple-500/15 text-slate-600 dark:text-slate-300"
                                  title="Detail & Cetak Kunci">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGoLjk(k)}
                                  className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white"
                                  title="Cetak LJK">
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGoScan(k)}
                                  className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white"
                                  title="Scan LJK">
                                  <Scan className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenIRT(k)}
                                  className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-600 text-amber-600 dark:text-amber-400 hover:text-white"
                                  title="Analisis IRT">
                                  <BarChart3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditor('duplicate', k)}
                                  className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-600 text-cyan-600 dark:text-cyan-400 hover:text-white"
                                  title="Duplikat ke kelas lain">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditor('edit', k)}
                                  className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-600 text-purple-600 dark:text-purple-400 hover:text-white"
                                  title="Edit">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(k)}
                                  className={`p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white ${
                                    hasilCount > 0 ? 'opacity-65' : ''
                                  }`}
                                  title={hasilCount > 0 ? 'Dilindungi hasil siswa' : 'Hapus'}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Smart Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> (
                  {filteredAndSortedKunci.length} ujian)
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                    aria-label="Halaman sebelumnya">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e-${i}`} className="px-1.5 text-xs text-slate-400 font-bold">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-9 h-9 rounded-xl text-xs font-black border transition-all ${
                          currentPage === p
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-purple-400'
                        }`}>
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-9 px-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                    aria-label="Halaman berikutnya">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modals */}
        <KunciEditorModal
          open={editorOpen}
          mode={editorMode}
          editingKunci={editorTarget}
          masterData={masterData}
          defaultSemester={activeSemester}
          onClose={() => setEditorOpen(false)}
          onSaved={async (savedId, goToLjk) => {
            const editedHadHasil =
              editorMode === 'edit' && (Number(editorTarget?.hasil_count) || 0) > 0;
            setEditorOpen(false);
            if (goToLjk && savedId) {
              router.push(`/dashboard/ljk?kunci=${encodeURIComponent(savedId)}`);
              return;
            }
            await loadData();
            if (editedHadHasil) {
              toast.info(
                'Jika Anda mengubah kunci atau bobot poin, buka Detail kunci ini untuk menekan "Hitung Ulang Nilai".'
              );
            }
          }}
        />

        <KunciDetailModal
          kunci={detailTarget}
          getMapelLabel={getMapelLabel}
          getKelasLabel={getKelasLabel}
          onClose={() => setDetailTarget(null)}
          onEdit={(k) => openEditor('edit', k)}
          onDuplicate={(k) => openEditor('duplicate', k)}
          onLjk={handleGoLjk}
          onScan={handleGoScan}
          onPrintKunci={handlePrintKunci}
          onRegraded={loadData}
        />

        <KunciIrtModal
          kunci={irtTarget}
          irtStats={irtStats}
          loading={loadingIrt}
          onClose={() => setIrtTarget(null)}
        />

        <KunciDeleteModal
          kunci={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      </div>

      {/* Print Sheet Khusus Pegangan Guru */}
      <KunciPrintSheet
        kunci={printingKunci}
        getMapelLabel={getMapelLabel}
        getKelasLabel={getKelasLabel}
      />
    </>
  );
}
