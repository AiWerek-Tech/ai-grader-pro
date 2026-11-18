'use client';

import { getMasterData, saveMasterAction, updateMasterAction, deleteMasterAction } from '@/lib/actions/master';
import { getSiswaAction, bulkAssignKelasAction } from '@/lib/actions/siswa';
import { initializeKurikulumMerdeka2026Action, promoteStudentsWizardAction } from '@/lib/actions/academic';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Search, Plus, RefreshCw, Download, Trash2, Pencil, X,
  School, Users, Key, ChevronDown, GraduationCap,
  ArrowUpDown, ArrowUp, ArrowDown, UserCheck, ChevronLeft, ChevronRight,
  CheckSquare, Square, UserPlus, Loader2, Sparkles, ArrowRight
} from 'lucide-react';

type SortDir = 'asc' | 'desc';
type ConfirmModal = { type: 'KELAS' | 'MAPEL'; id: string; label: string } | null;

function getGradeNumber(namaKelas: string): number {
  const n = String(namaKelas || '').toUpperCase().trim();
  if (/\b(VII|7)\b/.test(n) && !/\bVIII\b/.test(n)) return 7;
  if (/\b(VIII|8)\b/.test(n)) return 8;
  if (/\b(IX|9)\b/.test(n)) return 9;
  if (/\b(X|10)\b/.test(n) && !/\b(XI|XII)\b/.test(n)) return 10;
  if (/\b(XI|11)\b/.test(n) && !/\bXII\b/.test(n)) return 11;
  if (/\b(XII|12)\b/.test(n)) return 12;
  return 99;
}

function getFaseKurikulumMerdeka(namaKelas: string, jenjang?: string): { fase: string; desc: string; color: string } {
  const grade = getGradeNumber(namaKelas);
  if (grade >= 7 && grade <= 9 || String(jenjang).toUpperCase() === 'SMP') {
    return { fase: 'FASE D', desc: 'SMP (Kelas VII–IX)', color: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20' };
  }
  if (grade === 10) {
    return { fase: 'FASE E', desc: 'SMA Fondasi (Kelas X)', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' };
  }
  return { fase: 'FASE F', desc: 'SMA Lanjutan (Kelas XI–XII)', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
}

export default function KelasMapelPage() {
  // ─── Data ────────────────────────────────────────────────────────────────
  const [data, setData] = useState<{ kelas: any[]; mapel: any[] }>({ kelas: [], mapel: [] });
  const [allSiswa, setAllSiswa] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Modal State ─────────────────────────────────────────────────────────
  const [showAddKelas, setShowAddKelas] = useState(false);
  const [showAddMapel, setShowAddMapel] = useState(false);
  const [editingItem, setEditingItem] = useState<{ type: 'KELAS' | 'MAPEL'; item: any } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmModal>(null);
  const [saving, setSaving] = useState(false);

  // ─── Wizard Tahun Ajaran & Kenaikan Kelas ─────────────────────────────────
  const [showPromoteWizard, setShowPromoteWizard] = useState(false);
  const [showInit2026Modal, setShowInit2026Modal] = useState(false);
  const [wizardTahun, setWizardTahun] = useState('2026/2027');
  const [wizardSem, setWizardSem] = useState<'GANJIL' | 'GENAP'>('GANJIL');
  const [promoteIXtoX, setPromoteIXtoX] = useState(true);
  const [graduateXII, setGraduateXII] = useState(true);
  const [wizardRunning, setWizardRunning] = useState(false);

  // ─── Rombel Manager ──────────────────────────────────────────────────────
  const [rombelKelas, setRombelKelas] = useState<any | null>(null); // kelas yang sedang dikelola
  const [rombelSaving, setRombelSaving] = useState(false);
  const [rombelSearch, setRombelSearch] = useState('');
  const [rombelTab, setRombelTab] = useState<'anggota' | 'tambah'>('anggota');
  const [rombelSelected, setRombelSelected] = useState<Set<string>>(new Set());

  // ─── Kelas Filter / Sort ─────────────────────────────────────────────────
  const [kelasSearch, setKelasSearch] = useState('');
  const [kelasJenjang, setKelasJenjang] = useState('ALL');
  const [kelasSortField, setKelasSortField] = useState<'nama_kelas' | 'jumlah_siswa'>('nama_kelas');
  const [kelasSortDir, setKelasSortDir] = useState<SortDir>('asc');

  // ─── Mapel Filter / Sort / Pagination ────────────────────────────────────
  const [mapelSearch, setMapelSearch] = useState('');
  const [mapelSortField, setMapelSortField] = useState<'nama_mapel' | 'jumlah_kunci'>('nama_mapel');
  const [mapelSortDir, setMapelSortDir] = useState<SortDir>('asc');
  const [mapelPage, setMapelPage] = useState(1);
  const MAPEL_PER_PAGE = 10;

  // ─── Fetch ───────────────────────────────────────────────────────────────
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [mRes, sRes] = await Promise.all([getMasterData(), getSiswaAction()]);
      if (mRes.success) setData(mRes.data || { kelas: [], mapel: [] });
      else setError(mRes.message || 'Gagal memuat data');
      if (sRes.success) setAllSiswa(sRes.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const smpCount = data.kelas.filter(k => String(k.jenjang).toUpperCase() === 'SMP').length;
    const smaCount = data.kelas.filter(k => String(k.jenjang).toUpperCase() === 'SMA').length;
    const totalSiswa = data.kelas.reduce((s, k) => s + (k.jumlah_siswa || 0), 0);
    return { smpCount, smaCount, totalSiswa };
  }, [data]);

  // ─── Filtered Kelas ──────────────────────────────────────────────────────
  const filteredKelas = useMemo(() => {
    let list = [...data.kelas];
    if (kelasSearch) list = list.filter(k => k.nama_kelas.toLowerCase().includes(kelasSearch.toLowerCase()));
    if (kelasJenjang !== 'ALL') list = list.filter(k => String(k.jenjang).toUpperCase() === kelasJenjang);
    list.sort((a, b) => {
      if (kelasSortField === 'jumlah_siswa') {
        const diff = (a.jumlah_siswa || 0) - (b.jumlah_siswa || 0);
        return kelasSortDir === 'asc' ? diff : -diff;
      }
      const ga = getGradeNumber(a.nama_kelas);
      const gb = getGradeNumber(b.nama_kelas);
      if (ga !== gb) return kelasSortDir === 'asc' ? ga - gb : gb - ga;
      const cmp = String(a.nama_kelas || '').localeCompare(String(b.nama_kelas || ''));
      return kelasSortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data.kelas, kelasSearch, kelasJenjang, kelasSortField, kelasSortDir]);

  // ─── Filtered Mapel (with pagination) ────────────────────────────────────
  const filteredMapel = useMemo(() => {
    let list = [...data.mapel];
    if (mapelSearch) list = list.filter(m => m.nama_mapel.toLowerCase().includes(mapelSearch.toLowerCase()));
    list.sort((a, b) => {
      const va = mapelSortField === 'jumlah_kunci' ? (a.jumlah_kunci || 0) : a.nama_mapel;
      const vb = mapelSortField === 'jumlah_kunci' ? (b.jumlah_kunci || 0) : b.nama_mapel;
      return mapelSortDir === 'asc'
        ? (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb)))
        : (typeof vb === 'number' ? vb - va : String(vb).localeCompare(String(va)));
    });
    return list;
  }, [data.mapel, mapelSearch, mapelSortField, mapelSortDir]);

  const mapelTotalPages = Math.ceil(filteredMapel.length / MAPEL_PER_PAGE);
  const paginatedMapel = filteredMapel.slice((mapelPage - 1) * MAPEL_PER_PAGE, mapelPage * MAPEL_PER_PAGE);

  // Reset page ketika filter berubah
  useEffect(() => { setMapelPage(1); }, [mapelSearch, mapelSortField, mapelSortDir]);

  // ─── Rombel Data Computed ─────────────────────────────────────────────────
  const rombelAnggota = useMemo(() => {
    if (!rombelKelas) return [];
    return allSiswa.filter(s => String(s.id_kelas) === String(rombelKelas.id_kelas));
  }, [allSiswa, rombelKelas]);

  const rombelCandidates = useMemo(() => {
    if (!rombelKelas) return [];
    // Siswa yang TIDAK ada di kelas ini (bisa dipindahkan ke sini)
    return allSiswa.filter(s => String(s.id_kelas) !== String(rombelKelas.id_kelas));
  }, [allSiswa, rombelKelas]);

  const rombelAnggotaFiltered = rombelAnggota.filter(s =>
    !rombelSearch || s.nama.toLowerCase().includes(rombelSearch.toLowerCase()) || s.nis.includes(rombelSearch)
  );
  const rombelCandidatesFiltered = rombelCandidates.filter(s =>
    !rombelSearch || s.nama.toLowerCase().includes(rombelSearch.toLowerCase()) || s.nis.includes(rombelSearch)
  );

  // ─── Sort helpers ─────────────────────────────────────────────────────────
  const toggleKelasSort = (field: typeof kelasSortField) => {
    if (kelasSortField === field) setKelasSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setKelasSortField(field); setKelasSortDir('asc'); }
  };
  const toggleMapelSort = (field: typeof mapelSortField) => {
    if (mapelSortField === field) setMapelSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setMapelSortField(field); setMapelSortDir('asc'); }
  };
  const SortIcon = ({ field, cur, dir }: { field: string; cur: string; dir: SortDir }) =>
    field !== cur ? <ArrowUpDown className="w-3 h-3 opacity-30" /> :
      dir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />;

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent<HTMLFormElement>, type: 'KELAS' | 'MAPEL') => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await saveMasterAction(type, fd.get('nama') as string, fd.get('jenjang') as string || undefined);
      if (res.success) {
        toast.success(`${type === 'KELAS' ? 'Kelas' : 'Mata Pelajaran'} berhasil ditambahkan!`);
        if (type === 'KELAS') setShowAddKelas(false); else setShowAddMapel(false);
        fetchData(true);
      } else toast.error(res.message);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!editingItem) return; setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const id = editingItem.type === 'KELAS' ? editingItem.item.id_kelas : editingItem.item.id_mapel;
      const res = await updateMasterAction(editingItem.type, id, fd.get('nama') as string, fd.get('jenjang') as string || undefined);
      if (res.success) {
        toast.success(`Berhasil diperbarui!`);
        setEditingItem(null);
        fetchData(true);
      } else toast.error(res.message);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await deleteMasterAction(confirmDelete.type, confirmDelete.id);
      if (res.success) { toast.success('Berhasil dihapus!'); fetchData(true); }
      else toast.error(res.message);
    } catch (e: any) { toast.error(e.message); }
    finally { setConfirmDelete(null); }
  };

  // ─── Rombel handlers ──────────────────────────────────────────────────────
  const openRombel = (kelas: any) => {
    setRombelKelas(kelas);
    setRombelTab('anggota');
    setRombelSearch('');
    setRombelSelected(new Set());
  };

  const closeRombel = () => {
    setRombelKelas(null);
    setRombelSelected(new Set());
    setRombelSearch('');
  };

  const toggleRombelSelect = (id: string) =>
    setRombelSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  const toggleSelectAll = (list: any[]) => {
    if (rombelSelected.size === list.length && list.every(s => rombelSelected.has(s.id_siswa))) {
      setRombelSelected(new Set());
    } else {
      setRombelSelected(new Set(list.map(s => s.id_siswa)));
    }
  };

  // Tambahkan siswa ke kelas ini (dari tab Tambah)
  const handleAddToRombel = async () => {
    if (!rombelKelas || rombelSelected.size === 0) return;
    setRombelSaving(true);
    try {
      const res = await bulkAssignKelasAction(Array.from(rombelSelected), rombelKelas.id_kelas);
      if (res.success) {
        toast.success(res.message);
        setRombelSelected(new Set());
        setRombelTab('anggota');
        await fetchData(true);
      } else toast.error(res.message);
    } catch (e: any) { toast.error(e.message); }
    finally { setRombelSaving(false); }
  };

  // Keluarkan siswa dari kelas (pindahkan ke "tidak ber-kelas" / kelas lain)
  // Dalam konteks ini: keluarkan = hapus id_kelas (set ke '') ← tidak ideal
  // Jadi kita biarkan user hanya bisa memindahkan ke kelas lain via tab Tambah
  // "Keluarkan" bisa berarti pindahkan ke kelas yang dipilih secara manual
  // Untuk sekarang: "Keluarkan dari kelas ini" = clear / pindah — tapi itu out of scope
  // Fitur utama: masukkan siswa ke kelas → sudah cukup sesuai permintaan user

  // ─── Export CSV ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    const kelasRows = [['Jenjang', 'Nama Kelas', 'Jumlah Siswa'], ...data.kelas.map(k => [k.jenjang, k.nama_kelas, k.jumlah_siswa])];
    const mapelRows = [[], ['Nama Mata Pelajaran', 'Jumlah Kunci'], ...data.mapel.map(m => [m.nama_mapel, m.jumlah_kunci])];
    const all = [...kelasRows, ...mapelRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([all], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'master-kelas-mapel.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Data master berhasil diekspor!');
  };

  // ─── Wizard Tahun Ajaran & Kenaikan Kelas Handlers ──────────────────────
  const handleInit2026 = async () => {
    setWizardRunning(true);
    try {
      const res = await initializeKurikulumMerdeka2026Action();
      if (res.success) {
        toast.success(res.message);
        setShowInit2026Modal(false);
        await fetchData(true);
      } else {
        toast.error(res.message || 'Gagal menyiapkan data.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWizardRunning(false);
    }
  };

  const handleRunPromoteWizard = async () => {
    if (!wizardTahun.trim()) {
      toast.error('Tahun Ajaran tujuan wajib diisi.');
      return;
    }
    setWizardRunning(true);
    try {
      const res = await promoteStudentsWizardAction({
        targetTahunAjaran: wizardTahun.trim(),
        targetSemester: wizardSem,
        promoteGrade9ToGrade10: promoteIXtoX,
        graduateGrade12: graduateXII,
      });
      if (res.success) {
        toast.success(res.message);
        setShowPromoteWizard(false);
        await fetchData(true);
      } else {
        toast.error(res.message || 'Gagal memproses kenaikan kelas.');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWizardRunning(false);
    }
  };

  const closeModal = () => { setShowAddKelas(false); setShowAddMapel(false); setEditingItem(null); };
  const isModalOpen = showAddKelas || showAddMapel || !!editingItem;
  const isKelasModal = isModalOpen && (showAddKelas || editingItem?.type === 'KELAS');
  const modalType = editingItem?.type ?? (showAddKelas ? 'KELAS' : 'MAPEL');

  const maxSiswa = Math.max(...data.kelas.map(k => k.jumlah_siswa || 0), 1);
  const maxKunci = Math.max(...data.mapel.map(m => m.jumlah_kunci || 0), 1);

  if (loading) return (
    <DashboardLoadingState
      title="Sinkronisasi Master Data..."
      subtitle="Memuat daftar rombel kelas, fase Kurikulum Merdeka, dan mata pelajaran"
      accentClass="border-t-sky-500"
    />
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 fade-in">

      {/* ── Header ── */}
      <PageHeader
        icon={<School className="w-6 h-6 sm:w-7 sm:h-7" />}
        iconBgClass="bg-sky-500/10 dark:bg-sky-500/20 border-sky-500/20 text-sky-600 dark:text-sky-400"
        title="Unit & Mata Pelajaran"
        description="Konfigurasi struktur kelas Full Kurikulum Merdeka (Fase D, E, F), kenaikan kelas, dan daftar mata pelajaran sekolah."
        actions={
          <>
            <button onClick={() => fetchData(true)} disabled={refreshing}
              className="w-10 h-10 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-300 transition-all disabled:opacity-50 shadow-sm" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-2 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-sky-300 hover:text-sky-600 dark:hover:text-sky-400 transition-all shadow-sm">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={() => setShowPromoteWizard(true)}
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-4 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95">
              <GraduationCap className="w-4 h-4" /> Wizard Naik Kelas
            </button>
            <button onClick={() => setShowInit2026Modal(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-md shadow-violet-500/20 active:scale-95">
              <Sparkles className="w-4 h-4" /> Siapkan TA 2026/2027
            </button>
            <button onClick={() => setShowAddKelas(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 active:scale-95">
              <Plus className="w-4 h-4" /> Tambah Kelas
            </button>
            <button onClick={() => setShowAddMapel(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-md shadow-emerald-500/20 active:scale-95">
              <Plus className="w-4 h-4" /> Tambah Mapel
            </button>
          </>
        }
      />

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl font-bold flex items-center gap-3 text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Kelas', value: data.kelas.length, icon: <School className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Jenjang SMP', value: stats.smpCount, icon: <GraduationCap className="w-4 h-4" />, color: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
          { label: 'Jenjang SMA', value: stats.smaCount, icon: <GraduationCap className="w-4 h-4" />, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'Total Siswa', value: stats.totalSiswa, icon: <Users className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 shadow-sm lg:backdrop-blur-sm">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center ${s.color} flex-shrink-0`}>{s.icon}</div>
            <div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ═══════════════════════════════════════ KELAS ══════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
              Daftar Kelas
              <span className="text-xs font-black text-slate-400 dark:text-slate-600 normal-case tracking-normal">({filteredKelas.length}/{data.kelas.length})</span>
            </h2>
            <button onClick={() => setShowAddKelas(true)}
              className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-500/20 transition-all active:scale-95">
              <Plus className="w-3 h-3" /> Tambah
            </button>
          </div>

          {/* Kelas search + filter */}
          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
              <input type="text" placeholder="Cari nama kelas..." value={kelasSearch} onChange={e => setKelasSearch(e.target.value)}
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" />
              {kelasSearch && <button onClick={() => setKelasSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-3 h-3" /></button>}
            </div>
            <div className="relative">
              <select value={kelasJenjang} onChange={e => setKelasJenjang(e.target.value)}
                className={`appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-3 pr-8 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer shadow-sm ${kelasJenjang !== 'ALL' ? 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
                <option value="ALL">Semua Jenjang</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Kelas table */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl">
            <div className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/[0.05] grid grid-cols-[56px_1fr_48px_108px] sm:grid-cols-[80px_1fr_80px_124px] gap-0 text-[9px] uppercase font-black tracking-widest text-slate-500">
              <div className="px-3 sm:px-5 py-3.5">Jenjang</div>
              <button onClick={() => toggleKelasSort('nama_kelas')} className="px-2 sm:px-4 py-3.5 flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-white transition-colors text-left">
                Nama Kelas <SortIcon field="nama_kelas" cur={kelasSortField} dir={kelasSortDir} />
              </button>
              <button onClick={() => toggleKelasSort('jumlah_siswa')} className="px-1 sm:px-3 py-3.5 flex items-center justify-center gap-1 hover:text-slate-800 dark:hover:text-white transition-colors">
                Siswa <SortIcon field="jumlah_siswa" cur={kelasSortField} dir={kelasSortDir} />
              </button>
              <div className="px-2 sm:px-4 py-3.5 text-center">Aksi</div>
            </div>

            {filteredKelas.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.02]">
                {filteredKelas.map(k => (
                  <div key={k.id_kelas} className="grid grid-cols-[56px_1fr_48px_108px] sm:grid-cols-[80px_1fr_80px_124px] gap-0 items-center hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group">
                    <div className="px-3 sm:px-5 py-3.5 sm:py-4 flex-shrink-0">
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${String(k.jenjang).toUpperCase() === 'SMA'
                        ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20'
                        : 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border border-fuchsia-500/20'}`}>
                        {k.jenjang}
                      </span>
                    </div>
                    <div className="px-2 sm:px-4 py-3.5 sm:py-4 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">{k.nama_kelas}</span>
                        {(() => {
                          const fInfo = getFaseKurikulumMerdeka(k.nama_kelas, k.jenjang);
                          return (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${fInfo.color}`} title={fInfo.desc}>
                              {fInfo.fase}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500/60 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(4, ((k.jumlah_siswa || 0) / maxSiswa) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="px-1 sm:px-3 py-3.5 sm:py-4 text-center">
                      <div className="inline-flex items-center gap-1 font-black text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <Users className="w-3 h-3 text-slate-400 hidden sm:inline" />
                        {k.jumlah_siswa}
                      </div>
                    </div>
                    {/* Aksi: Kelola Siswa + Edit + Hapus */}
                    <div className="px-2 sm:px-3 py-3.5 sm:py-4 flex items-center justify-center gap-1">
                      <button
                        onClick={() => openRombel(k)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider transition-all border border-indigo-500/20 whitespace-nowrap active:scale-95"
                        title="Kelola Siswa Rombel">
                        <UserCheck className="w-3 h-3" /> <span className="hidden sm:inline">Rombel</span>
                      </button>
                      <button onClick={() => setEditingItem({ type: 'KELAS', item: k })}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/20 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95" title="Edit">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => setConfirmDelete({ type: 'KELAS', id: k.id_kelas, label: k.nama_kelas })}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95" title="Hapus">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="text-4xl mb-4 grayscale opacity-20">🏫</div>
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                  {kelasSearch || kelasJenjang !== 'ALL' ? 'Tidak ada kelas ditemukan.' : 'Belum ada data kelas.'}
                </p>
              </div>
            )}

            {filteredKelas.length > 0 && (
              <div className="px-5 py-3 bg-slate-50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/[0.03] flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                  {filteredKelas.length} kelas · {filteredKelas.reduce((s, k) => s + (k.jumlah_siswa || 0), 0)} siswa
                </span>
                <div className="flex gap-2">
                  {['SMP', 'SMA'].map(j => {
                    const count = filteredKelas.filter(k => String(k.jenjang).toUpperCase() === j).length;
                    if (count === 0) return null;
                    return (
                      <span key={j} className={`text-[9px] font-black px-2 py-0.5 rounded-md ${j === 'SMA' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400'}`}>
                        {j}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════ MAPEL ══════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
              Mata Pelajaran
              <span className="text-xs font-black text-slate-400 dark:text-slate-600 normal-case tracking-normal">({filteredMapel.length}/{data.mapel.length})</span>
            </h2>
            <button onClick={() => setShowAddMapel(true)}
              className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/20 transition-all active:scale-95">
              <Plus className="w-3 h-3" /> Tambah
            </button>
          </div>

          {/* Mapel search */}
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
            <input type="text" placeholder="Cari mata pelajaran..." value={mapelSearch} onChange={e => setMapelSearch(e.target.value)}
              className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" />
            {mapelSearch && <button onClick={() => setMapelSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-3 h-3" /></button>}
          </div>

          {/* Mapel table */}
          <div className="bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl">
            <div className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/[0.05] grid grid-cols-[1fr_90px_60px] gap-0 text-[9px] uppercase font-black tracking-widest text-slate-500">
              <button onClick={() => toggleMapelSort('nama_mapel')} className="px-5 py-3.5 flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-white transition-colors text-left">
                Mata Pelajaran <SortIcon field="nama_mapel" cur={mapelSortField} dir={mapelSortDir} />
              </button>
              <button onClick={() => toggleMapelSort('jumlah_kunci')} className="px-3 py-3.5 flex items-center justify-center gap-1.5 hover:text-slate-800 dark:hover:text-white transition-colors">
                Kunci <SortIcon field="jumlah_kunci" cur={mapelSortField} dir={mapelSortDir} />
              </button>
              <div className="px-4 py-3.5 text-right">Aksi</div>
            </div>

            {paginatedMapel.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.02]">
                {paginatedMapel.map((m, idx) => {
                  const globalIdx = (mapelPage - 1) * MAPEL_PER_PAGE + idx;
                  return (
                    <div key={m.id_mapel} className="grid grid-cols-[1fr_90px_60px] gap-0 items-center hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group">
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0 ${globalIdx === 0 && mapelSortField === 'jumlah_kunci' && mapelSortDir === 'desc' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                            {globalIdx + 1}
                          </span>
                          <div>
                            <div className="font-black text-sm text-slate-900 dark:text-white">{m.nama_mapel}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="w-20 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500/60 rounded-full transition-all duration-700"
                                  style={{ width: `${Math.max(4, ((m.jumlah_kunci || 0) / maxKunci) * 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-4 text-center">
                        <div className="inline-flex items-center gap-1 font-black text-sm text-slate-700 dark:text-slate-300">
                          <Key className="w-3 h-3 text-slate-400" />{m.jumlah_kunci}
                        </div>
                      </div>
                      <div className="px-3 sm:px-4 py-4 flex justify-end gap-1.5">
                        <button onClick={() => setEditingItem({ type: 'MAPEL', item: m })}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-emerald-500/20 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => setConfirmDelete({ type: 'MAPEL', id: m.id_mapel, label: m.nama_mapel })}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="text-4xl mb-4 grayscale opacity-20">📚</div>
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                  {mapelSearch ? 'Tidak ada mapel ditemukan.' : 'Belum ada data mata pelajaran.'}
                </p>
              </div>
            )}

            {/* Mapel Pagination Footer */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/[0.03] flex items-center justify-between gap-4">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest flex-shrink-0">
                {filteredMapel.length} mapel · hal {mapelPage}/{mapelTotalPages || 1}
              </span>
              {mapelTotalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setMapelPage(p => Math.max(1, p - 1))} disabled={mapelPage === 1}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: mapelTotalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setMapelPage(p)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${mapelPage === p ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setMapelPage(p => Math.min(mapelTotalPages, p + 1))} disabled={mapelPage === mapelTotalPages}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex-shrink-0">
                {filteredMapel.reduce((s, m) => s + (m.jumlah_kunci || 0), 0)} kunci
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Rombel Manager
      ═══════════════════════════════════════════════════════════════════ */}
      {rombelKelas && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[100] flex items-start justify-center p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) closeRombel(); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden my-8">

            {/* Modal header */}
            <div className="bg-gradient-to-r from-indigo-600/10 to-indigo-600/5 dark:from-indigo-600/20 dark:to-transparent px-8 py-6 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                    <UserCheck className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Rombel — {rombelKelas.nama_kelas}</h2>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                      <span className={`${String(rombelKelas.jenjang).toUpperCase() === 'SMA' ? 'text-sky-500' : 'text-fuchsia-500'}`}>{rombelKelas.jenjang}</span>
                      {' · '}{rombelAnggota.length} Anggota · {rombelCandidates.length} Siswa Lain
                    </p>
                  </div>
                </div>
              </div>
              <button type="button" onClick={closeRombel}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab + Search */}
            <div className="px-6 pt-5 pb-0 space-y-4">
              <div className="flex gap-2">
                <button onClick={() => { setRombelTab('anggota'); setRombelSelected(new Set()); setRombelSearch(''); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rombelTab === 'anggota' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                  <Users className="w-3.5 h-3.5" /> Anggota Kelas ({rombelAnggota.length})
                </button>
                <button onClick={() => { setRombelTab('tambah'); setRombelSelected(new Set()); setRombelSearch(''); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rombelTab === 'tambah' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                  <UserPlus className="w-3.5 h-3.5" /> Tambah Siswa ({rombelCandidates.length})
                </button>
              </div>

              <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none" />
                <input type="text" placeholder="Cari nama atau NIS siswa..." value={rombelSearch} onChange={e => setRombelSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-9 pr-8 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                {rombelSearch && <button onClick={() => setRombelSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
              </div>
            </div>

            {/* ─── TAB: ANGGOTA ─── */}
            {rombelTab === 'anggota' && (
              <div className="px-6 pb-6 mt-4">
                {rombelAnggotaFiltered.length > 0 ? (
                  <>
                    <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-100 dark:bg-white/[0.04] text-[9px] font-black uppercase tracking-widest text-slate-500 flex justify-between border-b border-slate-200 dark:border-white/[0.06]">
                        <span>{rombelAnggotaFiltered.length} siswa dalam kelas ini</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.03]">
                        {rombelAnggotaFiltered.map((s, i) => (
                          <div key={s.id_siswa} className="flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-white/[0.03] transition-colors">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-sm text-slate-900 dark:text-white truncate">{s.nama}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{s.nis}</div>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Aktif di kelas ini" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center mt-3 font-bold">
                      Untuk memindahkan siswa ke kelas lain, gunakan halaman <span className="text-indigo-500">Direktori Siswa → Edit</span>.
                    </p>
                  </>
                ) : (
                  <div className="py-12 text-center">
                    <div className="text-5xl mb-4 grayscale opacity-20">👥</div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                      {rombelSearch ? 'Tidak ada siswa ditemukan.' : 'Belum ada anggota di kelas ini.'}
                    </p>
                    <button onClick={() => { setRombelTab('tambah'); setRombelSearch(''); }}
                      className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mx-auto transition-all">
                      <UserPlus className="w-3.5 h-3.5" /> Tambahkan Siswa
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB: TAMBAH SISWA ─── */}
            {rombelTab === 'tambah' && (
              <div className="px-6 pb-6 mt-4">
                {rombelCandidatesFiltered.length > 0 ? (
                  <>
                    {/* Toolbar seleksi */}
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => toggleSelectAll(rombelCandidatesFiltered)}
                        className="flex items-center gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-widest">
                        {rombelSelected.size > 0 && rombelCandidatesFiltered.every(s => rombelSelected.has(s.id_siswa))
                          ? <><CheckSquare className="w-3.5 h-3.5" /> Batal Pilih Semua</>
                          : <><Square className="w-3.5 h-3.5" /> Pilih Semua ({rombelCandidatesFiltered.length})</>
                        }
                      </button>
                      {rombelSelected.size > 0 && (
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                          {rombelSelected.size} dipilih
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden mb-4">
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.03]">
                        {rombelCandidatesFiltered.map(s => {
                          const isSelected = rombelSelected.has(s.id_siswa);
                          // Cari info kelas asal
                          const kelasAsal = data.kelas.find(k => String(k.id_kelas) === String(s.id_kelas));
                          return (
                            <button key={s.id_siswa} type="button" onClick={() => toggleRombelSelect(s.id_siswa)}
                              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-white/[0.04] transition-colors text-left ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''}`}>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-white/20'}`}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-sm text-slate-900 dark:text-white truncate">{s.nama}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                  <span className="font-mono">{s.nis}</span>
                                  {kelasAsal && (
                                    <span className="text-slate-400">· saat ini: <span className="text-indigo-500">{kelasAsal.nama_kelas}</span></span>
                                  )}
                                  {!kelasAsal && <span className="text-slate-400 dark:text-slate-600">· belum memiliki kelas</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tombol simpan */}
                    <button onClick={handleAddToRombel}
                      disabled={rombelSelected.size === 0 || rombelSaving}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2">
                      {rombelSaving
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                        : <><UserPlus className="w-4 h-4" /> Masukkan {rombelSelected.size > 0 ? `${rombelSelected.size} Siswa` : 'Siswa'} ke {rombelKelas.nama_kelas}</>
                      }
                    </button>
                  </>
                ) : (
                  <div className="py-12 text-center">
                    <div className="text-5xl mb-4 grayscale opacity-20">🎉</div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                      {rombelSearch ? 'Tidak ada siswa ditemukan.' : 'Semua siswa sudah ada di kelas ini atau belum ada data siswa.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Add / Edit Kelas or Mapel
      ═══════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-40 h-40 blur-[70px] rounded-full -mr-20 -mt-20 pointer-events-none ${isKelasModal ? 'bg-indigo-600/10' : 'bg-emerald-600/10'}`} />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
                <span className={`p-2.5 rounded-xl text-lg border ${isKelasModal ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                  {editingItem ? '✏️' : '➕'}
                </span>
                {editingItem ? `Edit ${editingItem.type === 'KELAS' ? 'Kelas' : 'Mapel'}` : `Tambah ${showAddKelas ? 'Kelas' : 'Mapel'}`}
              </h2>
              <button type="button" onClick={closeModal} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={editingItem ? handleUpdate : (e) => handleSave(e, modalType)} className="space-y-5 relative z-10">
              {isKelasModal && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Pilih Jenjang</label>
                  <select name="jenjang" defaultValue={editingItem?.item?.jenjang || 'SMA'}
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer">
                    <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                    <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                  Nama {isKelasModal ? 'Kelas' : 'Mata Pelajaran'}
                </label>
                <input required type="text" name="nama"
                  defaultValue={editingItem?.item?.nama_kelas || editingItem?.item?.nama_mapel || ''}
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
                  placeholder={isKelasModal ? 'Contoh: Kelas XI A' : 'Contoh: Matematika Wajib'}
                  autoFocus />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className={`flex-1 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${isKelasModal ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'}`}>
                  {saving ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan...</> : (editingItem ? 'Update Data' : 'Simpan Data')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Konfirmasi Hapus
      ═══════════════════════════════════════════════════════════════════ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-rose-600/8 blur-[60px] rounded-full -ml-20 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="w-7 h-7 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
                Hapus {confirmDelete.type === 'KELAS' ? 'Kelas' : 'Mapel'}?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Item ini akan dihapus permanen:</p>
              <p className="text-sm font-black text-rose-600 dark:text-rose-400 mb-6 bg-rose-500/10 px-4 py-2 rounded-xl">{confirmDelete.label}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">Batal</button>
                <button onClick={handleDelete} className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Wizard Kenaikan Kelas & Tahun Ajaran Baru
      ═══════════════════════════════════════════════════════════════════ */}
      {showPromoteWizard && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[120] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget && !wizardRunning) setShowPromoteWizard(false); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                  <GraduationCap className="w-6 h-6 text-amber-500" /> Wizard Kenaikan Kelas
                </h3>
                <p className="text-xs text-slate-400 mt-1">Promosi otomatis siswa SMP (VII–IX) & SMA (X–XII) ke tingkat berikutnya.</p>
              </div>
              <button onClick={() => setShowPromoteWizard(false)} disabled={wizardRunning} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Tahun Ajaran Tujuan</label>
                  <input type="text" value={wizardTahun} onChange={e => setWizardTahun(e.target.value)}
                    placeholder="2026/2027"
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Semester</label>
                  <select value={wizardSem} onChange={e => setWizardSem(e.target.value as 'GANJIL' | 'GENAP')}
                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white">
                    <option value="GANJIL">GANJIL</option>
                    <option value="GENAP">GENAP</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-4 space-y-2 text-xs">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Skema Promosi Otomatis</div>
                {[
                  { from: 'KELAS VII (SMP)', to: 'KELAS VIII (SMP)' },
                  { from: 'KELAS VIII (SMP)', to: 'KELAS IX (SMP)' },
                  { from: 'KELAS IX (SMP)', to: promoteIXtoX ? 'KELAS X (SMA - Lanjut Otomatis)' : 'LULUS SMP' },
                  { from: 'KELAS X (SMA)', to: 'KELAS XI (SMA)' },
                  { from: 'KELAS XI (SMA)', to: 'KELAS XII (SMA)' },
                  { from: 'KELAS XII (SMA)', to: graduateXII ? 'LULUS / ALUMNI' : 'TETAP DI KELAS XII' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/[0.04] last:border-0">
                    <span className="font-bold text-slate-600 dark:text-slate-300">{r.from}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-black text-indigo-600 dark:text-indigo-400">{r.to}</span>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 cursor-pointer">
                <input type="checkbox" checked={promoteIXtoX} onChange={e => setPromoteIXtoX(e.target.checked)} className="rounded text-indigo-600" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Lulusan Kelas IX SMP otomatis lanjut masuk ke Kelas X SMA</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 cursor-pointer">
                <input type="checkbox" checked={graduateXII} onChange={e => setGraduateXII(e.target.checked)} className="rounded text-amber-600" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Luluskan siswa Kelas XII SMA dari daftar siswa aktif</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowPromoteWizard(false)} disabled={wizardRunning}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">
                  Batal
                </button>
                <button onClick={handleRunPromoteWizard} disabled={wizardRunning}
                  className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50">
                  {wizardRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : 'Jalankan Kenaikan Kelas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Siapkan Data Awal TA 2026/2027 (Full Kurikulum Merdeka)
      ═══════════════════════════════════════════════════════════════════ */}
      {showInit2026Modal && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[120] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget && !wizardRunning) setShowInit2026Modal(false); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                  <Sparkles className="w-6 h-6 text-violet-500" /> Siapkan TA 2026/2027 (Kurikulum Merdeka)
                </h3>
                <p className="text-xs text-slate-400 mt-1">Reset & siapkan data awal Tahun Ajaran 2026/2027 Ganjil dari Kelas VII SMP s/d XII SMA.</p>
              </div>
              <button onClick={() => setShowInit2026Modal(false)} disabled={wizardRunning} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <div className="font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest text-[10px]">Data yang Akan Disiapkan Otomatis:</div>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li><b>Sesi Akademik:</b> Tahun Ajaran <b>2026/2027</b> · Semester <b>GANJIL</b></li>
                  <li><b>6 Kelas Kurikulum Merdeka:</b> KELAS VII, VIII, IX (SMP - Fase D) & KELAS X, XI, XII (SMA - Fase E & F)</li>
                  <li><b>16 Mata Pelajaran:</b> Struktur resmi Kurikulum Merdeka SMP & SMA</li>
                  <li><b>Dewan Guru & Penugasan:</b> 5 Guru aktif beserta 38 penugasan mengajar baru</li>
                  <li><b>36 Siswa:</b> Siswa baru Kelas VII & X serta siswa naik kelas VIII, IX, XI, XII</li>
                  <li><b>4 Contoh Kunci Jawaban AKM:</b> Siap langsung dicetak LJK dan diuji scan OMR/AI</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowInit2026Modal(false)} disabled={wizardRunning}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest">
                  Batal
                </button>
                <button onClick={handleInit2026} disabled={wizardRunning}
                  className="flex-1 py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 disabled:opacity-50">
                  {wizardRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan...</> : <><Sparkles className="w-4 h-4" /> Siapkan Sekarang</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
