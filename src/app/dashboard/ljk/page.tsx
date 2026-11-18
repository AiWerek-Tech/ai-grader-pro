'use client';

import { getKunciListAction } from '@/lib/actions/kunci';
import { getMasterData } from '@/lib/actions/master';
import { getSiswaAction } from '@/lib/actions/siswa';
import { getGuruList } from '@/lib/actions/admin';
import { getSettingsAction } from '@/lib/actions/settings';
import { TIPE_SOAL_AKM, TIPE_COLOR, getTipeDistribusi } from '@/lib/constants/tipe-soal';
import { buildMachinePageLayout, type EssayLayoutMode } from '@/lib/scan/machine-layout';
import { LJKSheet } from '@/components/ljk/LJKSheet';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Printer, RefreshCw, Search, ChevronDown,
  Users, FileText, Key,
  CheckSquare, GraduationCap,
  ClipboardList, Calendar, CopyPlus, LayoutGrid,
  ZoomIn, ZoomOut, Eye, ChevronLeft, ChevronRight,
  Maximize2, Sparkles, CheckCircle2, QrCode
} from 'lucide-react';

// ─── TipeBadge ────────────────────────────────────────────────────────────────
function TipeBadge({ kode }: { kode: string }) {
  const def = TIPE_SOAL_AKM.find(t => t.kode === kode);
  if (!def) {
    const map: Record<string, { short: string; color: string }> = {
      'A-E': { short: 'PG-E', color: 'indigo' },
      'A-D': { short: 'PG-D', color: 'violet' },
      'Benar-Salah': { short: 'B/S', color: 'teal' },
    };
    const fallback = map[kode] || { short: kode, color: 'indigo' };
    return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[fallback.color]}`}>{fallback.short}</span>;
  }
  return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${TIPE_COLOR[def.color]}`}>{def.short}</span>;
}

export default function CetakLJKPage() {
  const router = useRouter();
  const previewSectionRef = useRef<HTMLDivElement>(null);

  // ─── Data ─────────────────────────────────────────────────────────────────
  const [kunciList, setKunciList] = useState<any[]>([]);
  const [masterData, setMasterData] = useState<{ kelas: any[]; mapel: any[] }>({ kelas: [], mapel: [] });
  const [allSiswa, setAllSiswa] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Filters ──────────────────────────────────────────────────────────────
  const [filterGuru, setFilterGuru] = useState('ALL');
  const [filterMapel, setFilterMapel] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState<'ALL' | 'GANJIL' | 'GENAP'>('ALL');
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [searchKunci, setSearchKunci] = useState('');
  const [searchSiswa, setSearchSiswa] = useState('');

  // ─── Selection & Print Options ────────────────────────────────────────────
  const [selectedKunci, setSelectedKunci] = useState<any | null>(null);
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<Set<string>>(new Set());
  const [blankCopies, setBlankCopies] = useState<number>(0);
  const [examDate, setExamDate] = useState<string>(() =>
    new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  );

  // ─── Integrated Preview & Print Studio State ──────────────────────────────
  const [zoom, setZoom] = useState<number>(75);
  const [showSensorGrid, setShowSensorGrid] = useState<boolean>(false);
  const [previewSheetIndex, setPreviewSheetIndex] = useState<number>(0);
  const [sampleOnlyMode, setSampleOnlyMode] = useState<boolean>(false);
  const [essayLayoutMode, setEssayLayoutMode] = useState<EssayLayoutMode>('integrated');

  // Auto-fit zoom pada layar mobile dan restore sampleOnlyMode seusai print
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) {
        setZoom(42);
      } else if (window.innerWidth < 1024) {
        setZoom(60);
      }

      const handleAfterPrint = () => {
        setSampleOnlyMode(false);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
    }
  }, []);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [kRes, mRes, sRes, gRes, setRes] = await Promise.all([
        getKunciListAction(undefined, 'ALL'),
        getMasterData(),
        getSiswaAction(),
        getGuruList(),
        getSettingsAction(),
      ]);
      const kData = kRes.success ? kRes.data || [] : [];
      const mData = mRes.success ? mRes.data || { kelas: [], mapel: [] } : { kelas: [], mapel: [] };
      const sData = sRes.success ? sRes.data || [] : [];
      if (kRes.success) setKunciList(kData);
      if (mRes.success) setMasterData(mData);
      if (sRes.success) setAllSiswa(sData);
      if (gRes.success) setGuruList(gRes.data || []);
      if (setRes.success) setSettings(setRes.data || {});

      const requestedKunciId =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('kunci')
          : null;
      const initialKunci =
        (requestedKunciId && kData.find((x: any) => x.id_kunci === requestedKunciId)) ||
        selectedKunci ||
        kData[0] ||
        null;

      if (initialKunci && (!selectedKunci || requestedKunciId)) {
        setSelectedKunci(initialKunci);
        if (initialKunci.id_kelas && initialKunci.id_kelas !== 'ALL' && mData.kelas.some((c: any) => c.id_kelas === initialKunci.id_kelas)) {
          setFilterKelas(initialKunci.id_kelas);
          const classStudents = sData.filter((s: any) => s.id_kelas === initialKunci.id_kelas);
          setSelectedSiswaIds(new Set(classStudents.map((s: any) => s.id_siswa)));
        }
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Filtered Kunci ───────────────────────────────────────────────────────
  const filteredKunci = useMemo(() => {
    let list = [...kunciList];
    const q = searchKunci.toLowerCase();
    if (q) list = list.filter(k =>
      k.judul_ujian?.toLowerCase().includes(q) ||
      k.nama_mapel?.toLowerCase().includes(q)
    );
    if (filterGuru !== 'ALL') list = list.filter(k => k.id_guru === filterGuru);
    if (filterMapel !== 'ALL') list = list.filter(k => k.id_mapel === filterMapel);
    if (filterSemester !== 'ALL') {
      list = list.filter(k => {
        const smt = String(k.semester || '').toUpperCase();
        if (filterSemester === 'GANJIL') return smt.includes('GANJIL') || smt === '1';
        if (filterSemester === 'GENAP') return smt.includes('GENAP') || smt === '2';
        return true;
      });
    }
    return list;
  }, [kunciList, searchKunci, filterGuru, filterMapel, filterSemester]);

  // ─── Enriched & Filtered Siswa ────────────────────────────────────────────
  const allEnrichedSiswa = useMemo(() => {
    return allSiswa.map(s => {
      const kls = masterData.kelas.find((k: any) => k.id_kelas === s.id_kelas);
      return {
        ...s,
        nama_kelas: kls?.nama_kelas || s.nama_kelas || s.id_kelas,
        jenjang: kls?.jenjang || s.jenjang || 'SMA',
      };
    });
  }, [allSiswa, masterData.kelas]);

  const enrichedSiswa = useMemo(() => {
    let list = [...allEnrichedSiswa];
    const q = searchSiswa.toLowerCase();
    if (q) list = list.filter(s =>
      s.nama?.toLowerCase().includes(q) ||
      String(s.nis).includes(q)
    );
    if (filterKelas !== 'ALL') list = list.filter(s => s.id_kelas === filterKelas);
    return list.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
  }, [allEnrichedSiswa, searchSiswa, filterKelas]);

  // ─── Handle Select Kunci (Auto-filter & Auto-select Kelas) ────────────────
  const handleSelectKunci = (k: any) => {
    setSelectedKunci(k);
    setPreviewSheetIndex(0);
    setSampleOnlyMode(false);
    if (k.id_kelas && k.id_kelas !== 'ALL' && masterData.kelas.some((c: any) => c.id_kelas === k.id_kelas)) {
      setFilterKelas(k.id_kelas);
      const classStudents = allEnrichedSiswa.filter(s => s.id_kelas === k.id_kelas);
      setSelectedSiswaIds(new Set(classStudents.map(s => s.id_siswa)));
    } else {
      setSelectedSiswaIds(new Set());
    }
  };

  // ─── Select all / none ────────────────────────────────────────────────────
  const toggleAllSiswa = () => {
    setSampleOnlyMode(false);
    const allFilteredSelected =
      enrichedSiswa.length > 0 && enrichedSiswa.every(s => selectedSiswaIds.has(s.id_siswa));
    if (allFilteredSelected) {
      setSelectedSiswaIds(prev => {
        const next = new Set(prev);
        enrichedSiswa.forEach(s => next.delete(s.id_siswa));
        return next;
      });
    } else {
      setSelectedSiswaIds(prev => {
        const next = new Set(prev);
        enrichedSiswa.forEach(s => next.add(s.id_siswa));
        return next;
      });
    }
  };

  const toggleSiswa = (id: string) => {
    setSampleOnlyMode(false);
    setSelectedSiswaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Live Layout Preview / Inspector ──────────────────────────────────────
  const layoutPreview = useMemo(() => {
    if (!selectedKunci) return null;
    const rawItems = selectedKunci.data_json || [];
    const bobotMap = selectedKunci.pengaturan_poin || {};
    const totalSoal = rawItems.length || 40;
    const questionConfig = rawItems.map((item: any, idx: number) => {
      const no = item.no || idx + 1;
      const tipe = item.tipe || selectedKunci.tipe_soal || 'single_choice';
      const opsi = item.opsi?.length > 0 ? item.opsi : getDefaultOpts(tipe);
      const poin = item.poin ?? bobotMap[String(no)] ?? (tipe === 'essay' ? 8 : (bobotMap.benar ?? 1));
      return {
        no,
        tipe,
        poin,
        opsi,
        jumlah_pernyataan: item.jumlah_pernyataan,
        jumlah_pasang: item.jumlah_pasang,
        panjang_jawaban: item.panjang_jawaban,
      };
    });
    const layout = buildMachinePageLayout(
      questionConfig,
      totalSoal,
      selectedKunci.tipe_soal || 'single_choice',
      essayLayoutMode !== 'integrated'
    );
    const essayCount = questionConfig.filter(
      (q: any) => q.tipe === 'essay' || q.tipe === 'ESAI' || q.tipe === 'URAIAN'
    ).length;
    const shortAnswerCount = questionConfig.filter(
      (q: any) => q.tipe === 'short_answer' || q.tipe === 'ISIAN' || q.tipe === 'ISIAN_SINGKAT'
    ).length;
    const objectiveCount = totalSoal - essayCount - shortAnswerCount;

    return {
      layout,
      totalSoal,
      objectiveCount,
      shortAnswerCount,
      essayCount,
      questionConfig,
    };
  }, [selectedKunci, essayLayoutMode]);

  // ─── Daftar Lembar LJK Aktif (untuk Preview & Cetak Langsung) ─────────────
  const printableSheets = useMemo(() => {
    if (!selectedKunci) return [];
    const targetKelasObj = masterData.kelas.find(
      (k: any) => k.id_kelas === (filterKelas !== 'ALL' ? filterKelas : selectedKunci.id_kelas)
    );
    const defaultKelasName = targetKelasObj?.nama_kelas || selectedKunci.nama_kelas || '';
    const defaultJenjang = targetKelasObj?.jenjang || 'SMA';

    if (sampleOnlyMode) {
      return [
        {
          id_siswa: '',
          nis: '0000',
          nama: 'LEMBAR CADANGAN',
          kelas: defaultKelasName,
          jenjang: defaultJenjang,
          isBlank: true,
        },
      ];
    }

    const selectedStudents = allEnrichedSiswa
      .filter(s => selectedSiswaIds.has(s.id_siswa))
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'))
      .map(s => ({
        id_siswa: s.id_siswa,
        nis: s.nis,
        nama: s.nama,
        kelas: s.nama_kelas,
        jenjang: s.jenjang,
        isBlank: false,
      }));

    const blankList = Array.from({ length: blankCopies }, (_, idx) => ({
      id_siswa: '',
      nis: '0000',
      nama: `LEMBAR CADANGAN #${idx + 1}`,
      kelas: selectedStudents[0]?.kelas || defaultKelasName,
      jenjang: selectedStudents[0]?.jenjang || defaultJenjang,
      isBlank: true,
    }));

    const combined = [...selectedStudents, ...blankList];
    if (combined.length === 0) {
      return [
        {
          id_siswa: '',
          nis: '0000',
          nama: 'LEMBAR CADANGAN',
          kelas: defaultKelasName,
          jenjang: defaultJenjang,
          isBlank: true,
        },
      ];
    }
    return combined;
  }, [selectedKunci, masterData.kelas, filterKelas, sampleOnlyMode, allEnrichedSiswa, selectedSiswaIds, blankCopies]);

  const safePreviewIndex = Math.min(previewSheetIndex, Math.max(0, printableSheets.length - 1));
  const currentPreviewSiswa = printableSheets[safePreviewIndex] || null;

  // ─── Cetak Langsung dari Halaman Utama (Tanpa Pindah Tab) ─────────────────
  const handleDirectPrint = (onlySample = false) => {
    if (!selectedKunci) {
      toast.error('Pilih kunci jawaban/ujian terlebih dahulu!');
      return;
    }
    if (!onlySample && selectedSiswaIds.size === 0 && blankCopies === 0) {
      toast.error('Pilih minimal 1 siswa atau tambahkan lembar blanko cadangan!');
      return;
    }
    setSampleOnlyMode(onlySample);
    if (showSensorGrid) setShowSensorGrid(false);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  // ─── Buka Studio Cetak Layar Penuh (/print/ljk) ───────────────────────────
  const handleOpenPrintStudio = () => {
    if (!selectedKunci || !layoutPreview) {
      toast.error('Pilih kunci ujian terlebih dahulu!');
      return;
    }
    const payload = {
      idKunci: selectedKunci.id_kunci,
      title: selectedKunci.judul_ujian,
      mapel: selectedKunci.nama_mapel,
      totalSoal: layoutPreview.totalSoal,
      options: selectedKunci.tipe_soal || 'single_choice',
      questionConfig: layoutPreview.questionConfig,
      essayLayoutMode,
      examDate,
      siswaList: printableSheets,
    };
    localStorage.setItem('WMVAA_PRINT_PAYLOAD', JSON.stringify(payload));
    router.push('/print/ljk');
  };

  const handleAutoFitZoom = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) setZoom(42);
      else if (window.innerWidth < 1024) setZoom(62);
      else setZoom(78);
    } else {
      setZoom(75);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
      <div className="text-slate-500 dark:text-slate-400 font-bold animate-pulse tracking-tight">Memuat Studio Cetak LJK...</div>
    </div>
  );

  const totalSheetsToPrint = selectedSiswaIds.size + blankCopies;

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          UI DASHBOARD UTAMA (Disembunyikan Otomatis Saat Print Kertas A4)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="p-4 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 fade-in print:hidden">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4">
              <span className="p-2.5 sm:p-3 bg-sky-500/10 dark:bg-sky-500/20 rounded-2xl sm:rounded-[1.5rem] text-sky-500 text-xl sm:text-2xl shadow-inner border border-sky-500/10 dark:border-sky-500/20">🖨️</span>
              Cetak LJK Terpadu
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2 font-semibold text-xs sm:text-sm max-w-2xl">
              Pilih paket ujian, tentukan peserta, tinjau pratinjau lembar A4 berkalibrasi OMR/AI secara langsung, dan cetak seketika.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:border-sky-400 transition-all shadow-sm active:scale-95"
            >
              <Eye className="w-4 h-4 text-sky-500" />
              <span>Pratinjau A4</span>
            </button>
            <button
              type="button"
              onClick={handleOpenPrintStudio}
              disabled={!selectedKunci}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-indigo-600 dark:text-indigo-400 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:border-indigo-400 transition-all shadow-sm disabled:opacity-40 active:scale-95"
              title="Buka Studio Cetak Layar Penuh"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Studio Penuh</span>
            </button>
            <button
              onClick={() => handleDirectPrint(false)}
              disabled={!selectedKunci || totalSheetsToPrint === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-sky-500/20 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Cetak {totalSheetsToPrint > 0 ? `${totalSheetsToPrint} Lembar LJK` : 'LJK'}
            </button>
            <button onClick={() => fetchData(true)} disabled={refreshing}
              title="Muat ulang data kunci & siswa"
              className="w-10 h-10 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-center text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-all disabled:opacity-50 shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total Kunci', value: kunciList.length, icon: <Key className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
            { label: 'Total Siswa', value: allSiswa.length, icon: <Users className="w-4 h-4" />, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
            { label: 'Lembar Siap Cetak', value: totalSheetsToPrint, icon: <CheckSquare className="w-4 h-4" />, color: totalSheetsToPrint > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500', bg: totalSheetsToPrint > 0 ? 'bg-emerald-500/10' : 'bg-slate-500/10' },
            { label: 'Jumlah Soal Aktif', value: selectedKunci ? selectedKunci.data_json?.length || 0 : 0, icon: <ClipboardList className="w-4 h-4" />, color: selectedKunci ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500', bg: selectedKunci ? 'bg-amber-500/10' : 'bg-slate-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-[#0a0e1a]/40 border border-slate-200 dark:border-white/[0.05] rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 shadow-sm backdrop-blur-sm">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 ${s.bg} rounded-xl flex items-center justify-center ${s.color} flex-shrink-0`}>{s.icon}</div>
              <div>
                <div className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            STEP 1 & 2: PILIH UJIAN & PESERTA
        ════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ──── KOLOM KIRI: Pilih Ujian ──── */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-500" /> 1. Pilih Ujian / Kunci Jawaban
                </h2>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{filteredKunci.length} tersedia</span>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="text" placeholder="Cari judul ujian atau mapel..." value={searchKunci} onChange={e => setSearchKunci(e.target.value)}
                    className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <select value={filterGuru} onChange={e => setFilterGuru(e.target.value)}
                      aria-label="Filter guru kunci"
                      className="w-full appearance-none bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-3 pr-7 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer">
                      <option value="ALL">Semua Guru</option>
                      {guruList.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)}
                      aria-label="Filter mapel kunci"
                      className="w-full appearance-none bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-3 pr-7 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer">
                      <option value="ALL">Semua Mapel</option>
                      {masterData.mapel.map(m => <option key={m.id_mapel} value={m.id_mapel}>{m.nama_mapel}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select value={filterSemester} onChange={e => setFilterSemester(e.target.value as 'ALL' | 'GANJIL' | 'GENAP')}
                      aria-label="Filter semester kunci"
                      className={`w-full appearance-none border rounded-xl pl-3 pr-7 py-2.5 text-xs font-bold focus:outline-none cursor-pointer ${filterSemester !== 'ALL' ? 'bg-indigo-500/5 border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
                      <option value="ALL">Semua Semester</option>
                      <option value="GANJIL">Smt 1 (Ganjil)</option>
                      <option value="GENAP">Smt 2 (Genap)</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* List Kunci */}
            <div className="overflow-y-auto max-h-[340px] divide-y divide-slate-100 dark:divide-white/[0.03]">
              {filteredKunci.length > 0 ? filteredKunci.map(k => {
                const isSelected = selectedKunci?.id_kunci === k.id_kunci;
                const tipeDistribusi = getTipeDistribusi(k.data_json || []);
                return (
                  <button key={k.id_kunci} onClick={() => handleSelectKunci(k)}
                    className={`w-full px-5 py-4 text-left flex items-start gap-4 transition-all group ${isSelected ? 'bg-indigo-500/10 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-white/20'}`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-sm truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{k.judul_ujian}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-mono">{k.nama_guru}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-500 font-bold">{k.nama_mapel}</span>
                        {k.nama_kelas && (
                          <>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold">{k.nama_kelas}</span>
                          </>
                        )}
                        {k.semester && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black uppercase">
                            Smt {String(k.semester).toUpperCase().includes('GENAP') || String(k.semester) === '2' ? 'Genap' : 'Ganjil'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.keys(tipeDistribusi).length > 0
                          ? Object.entries(tipeDistribusi).map(([tipe, jumlah]) => (
                            <div key={tipe} className="flex items-center gap-0.5">
                              <TipeBadge kode={tipe} />
                              <span className="text-[8px] text-slate-400 font-mono">×{String(jumlah)}</span>
                            </div>
                          ))
                          : <TipeBadge kode={k.tipe_soal || 'single_choice'} />
                        }
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xl font-black tabular-nums ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>{k.data_json?.length || 0}</div>
                      <div className="text-[8px] text-slate-400 uppercase font-black">soal</div>
                    </div>
                  </button>
                );
              }) : (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-3 grayscale opacity-20">🔑</div>
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Tidak ada kunci jawaban.</p>
                </div>
              )}
            </div>
          </div>

          {/* ──── KOLOM KANAN: Pilih Siswa ──── */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-500" /> 2. Pilih Peserta Ujian
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">{selectedSiswaIds.size} dipilih</span>
                  <button onClick={toggleAllSiswa}
                    className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-sky-400 hover:text-sky-600 active:scale-95">
                    {enrichedSiswa.length > 0 && enrichedSiswa.every(s => selectedSiswaIds.has(s.id_siswa)) ? 'Batal Semua' : 'Pilih Semua'}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="text" placeholder="Cari nama atau NIS siswa..." value={searchSiswa} onChange={e => setSearchSiswa(e.target.value)}
                    className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                </div>
                <div className="relative">
                  <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
                    className={`w-full appearance-none border rounded-xl pl-3 pr-7 py-2.5 text-xs font-bold focus:outline-none cursor-pointer transition-all ${filterKelas !== 'ALL' ? 'bg-sky-500/5 border-sky-500/50 text-sky-600 dark:text-sky-400' : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
                    <option value="ALL">Semua Kelas ({allSiswa.length} siswa)</option>
                    {masterData.kelas.map(k => {
                      const count = allSiswa.filter(s => s.id_kelas === k.id_kelas).length;
                      return <option key={k.id_kelas} value={k.id_kelas}>[{k.jenjang}] {k.nama_kelas} ({count})</option>;
                    })}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* List Siswa */}
            <div className="overflow-y-auto max-h-[340px] divide-y divide-slate-50 dark:divide-white/[0.02]">
              {enrichedSiswa.length > 0 ? enrichedSiswa.map((s, idx) => {
                const checked = selectedSiswaIds.has(s.id_siswa);
                return (
                  <button key={s.id_siswa} onClick={() => toggleSiswa(s.id_siswa)}
                    className={`w-full px-5 py-3 text-left flex items-center gap-4 transition-all ${checked ? 'bg-sky-500/8 dark:bg-sky-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
                    <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${checked ? 'border-sky-600 bg-sky-600' : 'border-slate-300 dark:border-white/20'}`}>
                      {checked && <span className="text-white text-[10px] font-black">✓</span>}
                    </div>
                    <div className="w-7 h-7 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-3.5 h-3.5 text-sky-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-sm truncate ${checked ? 'text-sky-700 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`}>{s.nama}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {s.nis} · [{s.jenjang}] {s.nama_kelas}
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-400">#{idx + 1}</div>
                  </button>
                );
              }) : (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-3 grayscale opacity-20">🎓</div>
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                    {filterKelas !== 'ALL' || searchSiswa ? 'Tidak ada siswa sesuai filter.' : 'Belum ada siswa.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3: PRATINJAU LANGSUNG & CETAK A4 (TERINTEGRASI PENUH)
        ══════════════════════════════════════════════════════════════════ */}
        <div
          ref={previewSectionRef}
          className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm"
        >
          {/* Toolbar Kontrol Pratinjau & Cetak */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  3. Studio Pratinjau Lembar Jawaban (A4) &amp; Kalibrasi Cetak
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {selectedKunci
                    ? `${selectedKunci.judul_ujian} • ${layoutPreview?.totalSoal || 0} Soal (${layoutPreview?.layout.columns || 2} Kolom)`
                    : 'Pilih kunci jawaban di atas untuk menampilkan lembar jawaban'}
                </p>
              </div>
            </div>

            {/* Kontrol Tanggal, Blanko, Navigasi Lembar, Zoom, Sensor OMR, & Tombol Cetak */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Tanggal */}
              <div className="flex items-center gap-2 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <input
                  type="text"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  placeholder="Tanggal Ujian..."
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none w-28 sm:w-32"
                />
              </div>

              {/* Blanko Cadangan */}
              <div className="flex items-center gap-2 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5">
                <CopyPlus className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <select
                  value={blankCopies}
                  onChange={(e) => {
                    setSampleOnlyMode(false);
                    setBlankCopies(Number(e.target.value));
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={0} className="dark:bg-slate-900">+0 Blanko</option>
                  <option value={1} className="dark:bg-slate-900">+1 Blanko</option>
                  <option value={2} className="dark:bg-slate-900">+2 Blanko</option>
                  <option value={3} className="dark:bg-slate-900">+3 Blanko</option>
                  <option value={5} className="dark:bg-slate-900">+5 Blanko</option>
                  <option value={10} className="dark:bg-slate-900">+10 Blanko</option>
                </select>
              </div>

              {/* Pilih Siswa untuk Pratinjau */}
              {printableSheets.length > 1 && (
                <div className="flex items-center bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewSheetIndex((i) => Math.max(0, i - 1))}
                    disabled={safePreviewIndex === 0}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <select
                    value={safePreviewIndex}
                    onChange={(e) => setPreviewSheetIndex(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 px-1.5 focus:outline-none max-w-[150px] sm:max-w-[180px] truncate"
                  >
                    {printableSheets.map((s, idx) => (
                      <option key={idx} value={idx} className="dark:bg-slate-900">
                        #{idx + 1} - {s.nama}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPreviewSheetIndex((i) => Math.min(printableSheets.length - 1, i + 1))}
                    disabled={safePreviewIndex >= printableSheets.length - 1}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Zoom */}
              <div className="flex items-center bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(35, z - 10))}
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Perkecil pratinjau"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleAutoFitZoom}
                  className="px-2 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-500"
                  title="Klik untuk Auto-Fit ukuran layar"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(110, z + 10))}
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  title="Perbesar pratinjau"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sensor OMR Toggle */}
              <button
                type="button"
                onClick={() => setShowSensorGrid((v) => !v)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                  showSensorGrid
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-300'
                    : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Titik Sensor AI</span>
              </button>

              {/* Cetak 1 Blanko */}
              <button
                type="button"
                onClick={() => handleDirectPrint(true)}
                disabled={!selectedKunci}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider hover:border-slate-400 transition-all flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Cetak 1 Blanko</span>
              </button>

              {/* Cetak Semua Terpilih */}
              <button
                type="button"
                onClick={() => handleDirectPrint(false)}
                disabled={!selectedKunci || totalSheetsToPrint === 0}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak {totalSheetsToPrint} LJK</span>
              </button>
            </div>
          </div>

          {/* Diagnostic & Architecture Strip */}
          {selectedKunci && layoutPreview && (
            <div className="px-5 sm:px-6 py-2.5 bg-indigo-500/[0.04] border-b border-slate-200/70 dark:border-white/[0.04] flex flex-col gap-2.5 text-[10px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-bold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Kalibrasi A4 Presisi (210×297mm)
                  </span>
                  <span>•</span>
                  <span>
                    Tata Letak: <b className="text-indigo-600 dark:text-indigo-400">{layoutPreview.layout.columns} Kolom Vertikal ({layoutPreview.layout.density.toUpperCase()})</b>
                  </span>
                  <span>•</span>
                  <span>
                    Komposisi: <b>{layoutPreview.objectiveCount} Objektif</b>
                    {layoutPreview.shortAnswerCount > 0 ? ` · ${layoutPreview.shortAnswerCount} Isian` : ''}
                    {layoutPreview.essayCount > 0 ? ` · ${layoutPreview.essayCount} Esai` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 font-mono">
                  <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>QR Anchor v2.0 + 4 Fiducial OMR Aktif</span>
                </div>
              </div>

              {/* Pilihan Mode Cetak untuk Ujian yang Memiliki Soal Esai */}
              {layoutPreview.essayCount > 0 && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-2">
                  <span className="font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span>✍️ Mode Tata Letak {layoutPreview.essayCount} Soal Esai:</span>
                  </span>
                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
                    {[
                      {
                        id: 'integrated' as EssayLayoutMode,
                        label: '📄 Opsi A: 1 Lembar Terpadu (Ringkas)',
                        desc: 'Kotak esai dicetak di bawah LJK utama (hemat kertas, dibaca AI)',
                      },
                      {
                        id: 'separate_manual' as EssayLayoutMode,
                        label: '📝 Opsi B: Kertas Folio Terpisah (Hibrida)',
                        desc: 'LJK hanya mencetak soal objektif/isian secara lega, esai di kertas terpisah',
                      },
                      {
                        id: 'second_page' as EssayLayoutMode,
                        label: '📑 Opsi A+B: 2 Halaman (Lampiran Esai Luas)',
                        desc: 'Hal 1 Objektif + Hal 2 khusus Lembar Jawaban Esai bergaris luas ber-QR',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEssayLayoutMode(opt.id)}
                        title={opt.desc}
                        className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl font-black text-[10px] text-left sm:text-center border transition-all active:scale-95 ${
                          essayLayoutMode === opt.id
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-rose-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kanvas Pratinjau Kertas A4 (tanpa overscroll-contain agar scroll halaman utama tidak terkunci) */}
          <div className="bg-slate-200/70 dark:bg-slate-950/80 p-3 sm:p-8 lg:p-10 overflow-x-auto">
            {selectedKunci && currentPreviewSiswa && layoutPreview ? (() => {
              const scale = zoom / 100;
              const hasSecondPage = essayLayoutMode === 'second_page' && layoutPreview.essayCount > 0;
              return (
                <div
                  className="mx-auto shrink-0 relative"
                  style={{
                    width: `calc(210mm * ${scale})`,
                    height: hasSecondPage ? `calc((594mm + 1.5rem) * ${scale})` : `calc(297mm * ${scale})`,
                  }}
                >
                  <div
                    className="w-[210mm] origin-top-left transition-transform duration-150"
                    style={{
                      transform: zoom !== 100 ? `scale(${scale})` : undefined,
                    }}
                  >
                    <LJKSheet
                      siswa={currentPreviewSiswa}
                      mapel={selectedKunci.nama_mapel}
                      title={selectedKunci.judul_ujian}
                      idKunci={selectedKunci.id_kunci}
                      examDate={examDate}
                      totalSoal={layoutPreview.totalSoal}
                      options={selectedKunci.tipe_soal || 'single_choice'}
                      pageIndex={safePreviewIndex}
                      totalPages={printableSheets.length}
                      settings={settings}
                      questionConfig={layoutPreview.questionConfig}
                      showSensorGrid={showSensorGrid}
                      essayLayoutMode={essayLayoutMode}
                    />
                  </div>
                </div>
              );
            })() : (
              <div className="py-24 text-center text-slate-400">
                <Printer className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-black uppercase tracking-widest">Pilih Kunci Jawaban Untuk Melihat Pratinjau LJK</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ROOT CETAK A4 (Hanya Tampil Saat window.print() / Ctrl+P)
      ══════════════════════════════════════════════════════════════════ */}
      {selectedKunci && layoutPreview && (
        <div id="ljk-print-root" className="hidden print:block bg-white">
          {printableSheets.map((siswa, idx) => (
            <LJKSheet
              key={`${siswa.id_siswa || siswa.nis || 'blank'}-${idx}`}
              siswa={siswa}
              mapel={selectedKunci.nama_mapel}
              title={selectedKunci.judul_ujian}
              idKunci={selectedKunci.id_kunci}
              examDate={examDate}
              totalSoal={layoutPreview.totalSoal}
              options={selectedKunci.tipe_soal || 'single_choice'}
              pageIndex={idx}
              totalPages={printableSheets.length}
              settings={settings}
              questionConfig={layoutPreview.questionConfig}
              showSensorGrid={false}
              essayLayoutMode={essayLayoutMode}
            />
          ))}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #ljk-print-root {
            display: block !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .ljk-page {
            page-break-after: always;
            break-after: page;
          }
          .ljk-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `,
        }}
      />
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDefaultOpts(tipe: string): string[] {
  if (tipe === 'true_false' || tipe === 'Benar-Salah') return ['B', 'S'];
  if (tipe === 'single_choice_4' || tipe === 'A-D') return ['A', 'B', 'C', 'D'];
  return ['A', 'B', 'C', 'D', 'E'];
}
