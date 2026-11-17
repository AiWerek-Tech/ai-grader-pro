'use client';

import { getTugasAction, saveTugasAction, saveTugasBatchAction, deleteTugasAction } from '@/lib/actions/tugas';
import { getGuruList } from '@/lib/actions/admin';
import { getMasterData } from '@/lib/actions/master';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { transformDriveLink } from '@/lib/utils';
import Image from 'next/image';
import {
  Search, SlidersHorizontal, LayoutGrid, List, Download,
  Plus, RefreshCw, ChevronDown, X, Trash2, BookOpen, School, Users
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
type KelasItem = { id_tugas: string; nama_kelas: string };
type MapelGroup = { nama_mapel: string; id_mapel: string; kelas: KelasItem[] };
type GuruGroup = { nama: string; profile_url: string; mapels: Record<string, MapelGroup> };

export default function TugasMengajarPage() {
  // ─── Data state ─────────────────────────────────────────────────────────
  const [tugas, setTugas] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [mapelList, setMapelList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── UI state ───────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  // ─── Filter / search / sort ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMapel, setFilterMapel] = useState('ALL');
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [sortBy, setSortBy] = useState<'az' | 'za' | 'most' | 'least'>('az');

  // ─── Form state ─────────────────────────────────────────────────────────
  const [selectedKelas, setSelectedKelas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [tRes, gRes, mRes] = await Promise.all([
        getTugasAction(),
        getGuruList(),
        getMasterData()
      ]);
      setTugas(tRes.data || []);
      setGuruList((gRes.data || []).filter((g: any) => g.role === 'GURU'));
      setKelasList(mRes.data?.kelas || []);
      setMapelList(mRes.data?.mapel || []);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Group tugas: guru → mapel → [kelas] ─────────────────────────────
  const grouped = useMemo<Record<string, GuruGroup>>(() => {
    const g: Record<string, GuruGroup> = {};
    tugas.forEach(t => {
      const gKey = t.id_user || 'UNKNOWN';
      if (!g[gKey]) g[gKey] = { nama: t.nama_guru, profile_url: t.profile_url || '', mapels: {} };
      const mKey = t.id_mapel || t.nama_mapel || 'UNKNOWN';
      if (!g[gKey].mapels[mKey]) g[gKey].mapels[mKey] = { nama_mapel: t.nama_mapel, id_mapel: t.id_mapel, kelas: [] };
      g[gKey].mapels[mKey].kelas.push({ id_tugas: t.id_tugas, nama_kelas: t.nama_kelas });
    });
    return g;
  }, [tugas]);

  // ─── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const guruCount = Object.keys(grouped).length;
    const mapelSet = new Set(tugas.map(t => t.id_mapel));
    const kelasSet = new Set(tugas.map(t => t.id_kelas));
    return { guruCount, mapelCount: mapelSet.size, kelasCount: kelasSet.size, totalRows: tugas.length };
  }, [grouped, tugas]);

  // ─── All unique mapel / kelas from tugas (for filter dropdowns) ─────────
  const allMapelInTugas = useMemo(() => {
    const map: Record<string, string> = {};
    tugas.forEach(t => { if (t.id_mapel) map[t.id_mapel] = t.nama_mapel; });
    return Object.entries(map).map(([id, nama]) => ({ id, nama }));
  }, [tugas]);

  const allKelasInTugas = useMemo(() => {
    const map: Record<string, string> = {};
    tugas.forEach(t => { if (t.id_kelas) map[t.id_kelas] = t.nama_kelas; });
    return Object.entries(map).map(([id, nama]) => ({ id, nama }));
  }, [tugas]);

  // ─── Filtered + sorted entries ──────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let entries = Object.entries(grouped);

    // Search by guru name
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      entries = entries.filter(([, g]) => {
        const nameMatch = g.nama.toLowerCase().includes(q);
        const mapelMatch = Object.values(g.mapels).some(m =>
          m.nama_mapel.toLowerCase().includes(q) ||
          m.kelas.some(k => k.nama_kelas.toLowerCase().includes(q))
        );
        return nameMatch || mapelMatch;
      });
    }

    // Filter by mapel
    if (filterMapel !== 'ALL') {
      entries = entries.filter(([, g]) => Object.keys(g.mapels).includes(filterMapel));
    }

    // Filter by kelas
    if (filterKelas !== 'ALL') {
      entries = entries.filter(([, g]) =>
        Object.values(g.mapels).some(m => m.kelas.some(k => {
          const kData = kelasList.find((kl: any) => kl.nama_kelas === k.nama_kelas);
          return kData?.id_kelas === filterKelas || k.nama_kelas === allKelasInTugas.find(x => x.id === filterKelas)?.nama;
        }))
      );
    }

    // Sort
    entries.sort(([, a], [, b]) => {
      if (sortBy === 'az') return a.nama.localeCompare(b.nama);
      if (sortBy === 'za') return b.nama.localeCompare(a.nama);
      const countA = Object.keys(a.mapels).length;
      const countB = Object.keys(b.mapels).length;
      if (sortBy === 'most') return countB - countA;
      if (sortBy === 'least') return countA - countB;
      return 0;
    });

    return entries;
  }, [grouped, searchTerm, filterMapel, filterKelas, sortBy, allKelasInTugas, kelasList]);

  const hasActiveFilters = searchTerm || filterMapel !== 'ALL' || filterKelas !== 'ALL';

  // ─── Handlers ─────────────────────────────────────────────────────────
  const toggleKelas = (id: string) =>
    setSelectedKelas(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);

  const handleCloseModal = () => { setShowAddModal(false); setSelectedKelas([]); };

  const handleAddTugas = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const idGuru = fd.get('id_user') as string;
    const idMapel = fd.get('id_mapel') as string;
    if (!idGuru || !idMapel) { toast.error('Pilih guru dan mata pelajaran.'); return; }
    if (selectedKelas.length === 0) { toast.error('Pilih minimal satu kelas.'); return; }
    setSaving(true);
    try {
      const res = await saveTugasBatchAction(idGuru, idMapel, selectedKelas);
      if (res.success) {
        toast.success(res.message || `${selectedKelas.length} penugasan berhasil ditambahkan!`);
        handleCloseModal();
        fetchData(true);
      } else {
        toast.error(res.message || 'Gagal menyimpan penugasan');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await deleteTugasAction(confirmDelete.id);
      if (res.success) { toast.success('Penugasan berhasil dihapus!'); fetchData(true); }
      else toast.error(res.message);
    } catch (e: any) { toast.error(e.message); }
    finally { setConfirmDelete(null); }
  };

  // ─── Export CSV ────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [['Nama Guru', 'Mata Pelajaran', 'Kelas']];
    tugas.forEach(t => rows.push([t.nama_guru, t.nama_mapel, t.nama_kelas]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tugas-mengajar.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Data berhasil diekspor!');
  };

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      <div className="text-slate-500 dark:text-slate-400 font-bold animate-pulse tracking-tight">Menyusun Struktur Penugasan...</div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 sm:gap-4">
            <span className="p-2.5 sm:p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl sm:rounded-[1.5rem] text-indigo-500 text-xl sm:text-2xl shadow-inner border border-indigo-500/10 dark:border-indigo-500/20">📋</span>
            Tugas Mengajar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2 font-semibold text-xs sm:text-sm max-w-xl">
            Atur relasi siapa mengajar apa di kelas mana. Guru hanya dapat mengelola LJK sesuai penugasan ini.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="w-10 h-10 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition-all disabled:opacity-50 shadow-sm"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Tambah Penugasan
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Guru', value: stats.guruCount, icon: <Users className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Mata Pelajaran', value: stats.mapelCount, icon: <BookOpen className="w-4 h-4" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Kelas Aktif', value: stats.kelasCount, icon: <School className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Total Penugasan', value: stats.totalRows, icon: <span className="text-sm">📋</span>, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0a0e1a]/40 border border-slate-200 dark:border-white/[0.05] rounded-2xl p-5 flex items-center gap-4 shadow-sm backdrop-blur-sm">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center ${s.color} flex-shrink-0`}>
              {s.icon}
            </div>
            <div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama guru, mata pelajaran, atau kelas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-11 pr-10 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Mapel */}
        <div className="relative">
          <select
            value={filterMapel}
            onChange={e => setFilterMapel(e.target.value)}
            className={`appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-4 pr-9 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer shadow-sm ${filterMapel !== 'ALL' ? 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}
          >
            <option value="ALL">Semua Mapel</option>
            {allMapelInTugas.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Filter Kelas */}
        <div className="relative">
          <select
            value={filterKelas}
            onChange={e => setFilterKelas(e.target.value)}
            className={`appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-4 pr-9 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer shadow-sm ${filterKelas !== 'ALL' ? 'border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}
          >
            <option value="ALL">Semua Kelas</option>
            {allKelasInTugas.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="appearance-none bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-4 pr-9 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer shadow-sm"
          >
            <option value="az">Nama A–Z</option>
            <option value="za">Nama Z–A</option>
            <option value="most">Terbanyak Mapel</option>
            <option value="least">Tersedikit Mapel</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Divider + View toggle */}
        <div className="flex gap-2">
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-1 flex shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              title="Grid view"
            ><LayoutGrid className="w-4 h-4" /></button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              title="List view"
            ><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3" /> Filter aktif:
          </span>
          {searchTerm && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black">
              &ldquo;{searchTerm}&rdquo;
              <button onClick={() => setSearchTerm('')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterMapel !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-black">
              {allMapelInTugas.find(m => m.id === filterMapel)?.nama}
              <button onClick={() => setFilterMapel('ALL')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterKelas !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black">
              {allKelasInTugas.find(k => k.id === filterKelas)?.nama}
              <button onClick={() => setFilterKelas('ALL')}><X className="w-3 h-3" /></button>
            </span>
          )}
          <button onClick={() => { setSearchTerm(''); setFilterMapel('ALL'); setFilterKelas('ALL'); }}
            className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest">
            Hapus semua
          </button>
          <span className="ml-auto text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            {filteredEntries.length} guru ditemukan
          </span>
        </div>
      )}

      {/* ── Results count (no filter) ── */}
      {!hasActiveFilters && filteredEntries.length > 0 && (
        <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          Menampilkan {filteredEntries.length} guru · {stats.totalRows} penugasan aktif
        </div>
      )}

      {/* ── Grid / List View ── */}
      {filteredEntries.length === 0 ? (
        /* Empty state */
        <div className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/5 rounded-[3rem] p-20 text-center backdrop-blur-xl shadow-sm">
          {hasActiveFilters ? (
            <>
              <div className="text-6xl mb-6 grayscale opacity-20">🔍</div>
              <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Tidak ada hasil.</p>
              <p className="text-slate-500 dark:text-slate-600 text-[10px] mt-3 max-w-xs mx-auto font-bold">
                Coba ubah kata kunci atau hapus filter yang aktif.
              </p>
              <button onClick={() => { setSearchTerm(''); setFilterMapel('ALL'); setFilterKelas('ALL'); }}
                className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                Reset Filter
              </button>
            </>
          ) : (
            <>
              <div className="text-6xl mb-6 grayscale opacity-20">📋</div>
              <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Belum ada penugasan mengajar.</p>
              <p className="text-slate-500 dark:text-slate-600 text-[10px] mt-3 max-w-xs mx-auto font-bold">
                Tetapkan guru pada kelas dan mata pelajaran agar mereka dapat mengelola ujian.
              </p>
              <button onClick={() => setShowAddModal(true)}
                className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 mx-auto">
                <Plus className="w-4 h-4" /> Tambah Sekarang
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEntries.map(([idGuru, group]) => {
            const mapelEntries = Object.entries(group.mapels);
            return (
              <div key={idGuru} className="space-y-3 group/card">
                {/* Guru header */}
                <div className="flex items-center gap-3 px-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-center text-sm font-black text-indigo-600 dark:text-indigo-400 group-hover/card:scale-105 transition-all shadow-inner overflow-hidden flex-shrink-0">
                    {group.profile_url ? (
                      <Image src={transformDriveLink(group.profile_url)} alt={group.nama} width={40} height={40} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    ) : group.nama.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">{group.nama}</h2>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                      {mapelEntries.length} Mapel · {mapelEntries.reduce((s, [, m]) => s + m.kelas.length, 0)} Kelas
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[1.75rem] overflow-hidden shadow-sm dark:shadow-xl">
                  <div className="bg-slate-50 dark:bg-white/[0.02] px-5 py-2.5 text-[9px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-white/[0.05] flex justify-between">
                    <span>Mapel / Kelas</span><span>Aksi</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.02]">
                    {mapelEntries.map(([mapelKey, mg]) => (
                      <div key={mapelKey} className="px-5 py-3.5">
                        <div className="font-black text-indigo-600 dark:text-indigo-400 text-xs mb-2 flex items-center gap-2">
                          <BookOpen className="w-3 h-3 flex-shrink-0" />
                          {mg.nama_mapel}
                        </div>
                        <div className="space-y-1.5">
                          {mg.kelas.map(kls => (
                            <div key={kls.id_tugas} className="flex items-center justify-between group/row">
                              <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-500">
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 flex-shrink-0" />
                                {kls.nama_kelas}
                              </div>
                              <button
                                onClick={() => setConfirmDelete({ id: kls.id_tugas, label: `${mg.nama_mapel} – ${kls.nama_kelas} (${group.nama})` })}
                                className="w-6 h-6 rounded-md hover:bg-rose-500/20 text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 flex items-center justify-center transition-all opacity-0 group-hover/row:opacity-100 text-xs"
                                title="Hapus"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="bg-white dark:bg-[#0a0e1a]/60 backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl">
          <div className="bg-slate-50 dark:bg-white/[0.03] px-8 py-4 text-[9px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-white/[0.05] grid grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center">
            <span>Guru Pengajar</span>
            <span>Mata Pelajaran</span>
            <span>Kelas</span>
            <span>Aksi</span>
          </div>
          {filteredEntries.map(([, group]) =>
            Object.entries(group.mapels).map(([, mg]) =>
              mg.kelas.map((kls, ki) => (
                <div key={kls.id_tugas} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center px-8 py-4 border-b border-slate-100 dark:border-white/[0.02] hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group/row last:border-0">
                  {/* Guru — only show on first kelas of this guru-mapel combo */}
                  <div className="flex items-center gap-3">
                    {ki === 0 ? (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400 overflow-hidden flex-shrink-0">
                          {group.profile_url ? (
                            <Image src={transformDriveLink(group.profile_url)} alt={group.nama} width={32} height={32} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                          ) : group.nama.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{group.nama}</span>
                      </>
                    ) : (
                      <span className="w-8 h-8 flex-shrink-0" /> // spacer
                    )}
                  </div>
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{mg.nama_mapel}</div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">{kls.nama_kelas}</div>
                  <button
                    onClick={() => setConfirmDelete({ id: kls.id_tugas, label: `${mg.nama_mapel} – ${kls.nama_kelas}` })}
                    className="w-7 h-7 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 flex items-center justify-center transition-all opacity-0 group-hover/row:opacity-100"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Tambah Penugasan
      ═══════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-start justify-center p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden my-8">
            <div className="absolute top-0 right-0 w-56 h-56 bg-indigo-600/8 blur-[80px] rounded-full -mr-28 -mt-28 pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
                <span className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500 text-lg border border-indigo-500/10">➕</span>
                Tambah Tugas
              </h2>
              <button type="button" onClick={handleCloseModal}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTugas} className="space-y-5 relative z-10">
              {/* Pilih Guru */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Pilih Guru Pengajar</label>
                <select required name="id_user" className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer">
                  <option value="">-- Pilih Guru --</option>
                  {guruList.map((g: any, i: number) => (
                    <option key={g.id || `g-${i}`} value={g.id}>{g.nama} (@{g.username})</option>
                  ))}
                </select>
              </div>

              {/* Pilih Mapel */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Mata Pelajaran</label>
                <select required name="id_mapel" className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer">
                  <option value="">-- Pilih Mapel --</option>
                  {mapelList.map((m: any, i: number) => (
                    <option key={m.id_mapel || `m-${i}`} value={m.id_mapel}>{m.nama_mapel}</option>
                  ))}
                </select>
              </div>

              {/* Multi-select Kelas */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                    Kelas Tujuan
                    {selectedKelas.length > 0 && (
                      <span className="ml-2 text-indigo-500 normal-case tracking-normal">
                        · {selectedKelas.length} dipilih
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const smpIds = kelasList.filter((k: any) => String(k.jenjang || '').toUpperCase() === 'SMP').map((k: any) => k.id_kelas);
                        setSelectedKelas(Array.from(new Set([...selectedKelas, ...smpIds])));
                      }}
                      className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md hover:bg-emerald-500/20 transition-all uppercase tracking-wider"
                    >
                      + Semua SMP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const smaIds = kelasList.filter((k: any) => String(k.jenjang || '').toUpperCase() === 'SMA').map((k: any) => k.id_kelas);
                        setSelectedKelas(Array.from(new Set([...selectedKelas, ...smaIds])));
                      }}
                      className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md hover:bg-indigo-500/20 transition-all uppercase tracking-wider"
                    >
                      + Semua SMA
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-3 max-h-48 overflow-y-auto">
                  {(['SMP', 'SMA', ''] as string[]).map(jenjang => {
                    const filtered = kelasList.filter((k: any) =>
                      jenjang === ''
                        ? !['SMP', 'SMA'].includes(String(k.jenjang || '').toUpperCase())
                        : String(k.jenjang || '').toUpperCase() === jenjang
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div key={jenjang || 'other'} className="mb-3 last:mb-0">
                        {jenjang && <div className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest px-1 mb-1.5">{jenjang}</div>}
                        <div className="flex flex-wrap gap-1.5">
                          {filtered.map((k: any, i: number) => {
                            const isSelected = selectedKelas.includes(k.id_kelas);
                            return (
                              <button key={k.id_kelas || `k-${i}`} type="button" onClick={() => toggleKelas(k.id_kelas)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30'
                                  : 'bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08] hover:border-indigo-400 hover:text-indigo-600'
                                }`}>
                                {k.nama_kelas}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedKelas.length > 0 && (
                  <button type="button" onClick={() => setSelectedKelas([])}
                    className="mt-2 text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline ml-1">
                    Hapus semua pilihan
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleCloseModal}
                  className="flex-1 bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">
                  Batal
                </button>
                <button type="submit" disabled={saving || selectedKelas.length === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2">
                  {saving
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                    : `Simpan${selectedKelas.length > 0 ? ` (${selectedKelas.length} Kelas)` : ''}`
                  }
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-rose-600/8 blur-[60px] rounded-full -ml-20 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="w-7 h-7 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">Hapus Penugasan?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Penugasan ini akan dihapus permanen:</p>
              <p className="text-sm font-black text-rose-600 dark:text-rose-400 mb-6 bg-rose-500/10 px-4 py-2 rounded-xl">
                {confirmDelete.label}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">
                  Batal
                </button>
                <button onClick={handleDelete}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
