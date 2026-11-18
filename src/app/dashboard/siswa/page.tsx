'use client';

import {
  getSiswaAction, deleteSiswaAction, cleanDuplicateSiswaAction,
  addSiswaAction, editSiswaAction, bulkAddSiswaAction, deleteSiswaBatchAction,
  bulkAssignKelasAction
} from '@/lib/actions/siswa';
import { getMasterData } from '@/lib/actions/master';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { createWorkbook, downloadWorkbook, loadWorkbookFromFile, worksheetToObjects } from '@/lib/utils/excel';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import {
  Search, UserPlus, FileUp, FileDown, RefreshCw, Trash2, Pencil,
  X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square,
  GraduationCap, School, Database, UploadCloud, Download,
  CheckCircle2, FileSpreadsheet, AlertCircle, ChevronLeft, ChevronRight,
  LayoutGrid, LayoutList, Loader2
} from 'lucide-react';

type SortField = 'nama' | 'nis' | 'kelas';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'card';

export default function SiswaPage() {
  // ─── Data ────────────────────────────────────────────────────────────────
  const [siswa, setSiswa] = useState<any[]>([]);
  const [kelas, setKelas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── View ─────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // ─── Search / Filter / Sort ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('ALL');
  const [filterJenjang, setFilterJenjang] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('nama');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ─── Pagination ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // ─── Selection ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // ─── Modals ───────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'DELETE' | 'BULK_DELETE' | 'CLEAN';
    ids: string[];
    label: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Import ───────────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors: any[] } | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [sRes, mRes] = await Promise.all([getSiswaAction(), getMasterData()]);
      if (sRes.success) setSiswa(sRes.data || []);
      if (mRes.success) setKelas(mRes.data?.kelas || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setViewMode('card');
    }
  }, []);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterKelas, filterJenjang, sortField, sortDir]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const smpCount = siswa.filter(s => kelas.find(k => k.id_kelas === s.id_kelas)?.jenjang === 'SMP').length;
    const smaCount = siswa.filter(s => kelas.find(k => k.id_kelas === s.id_kelas)?.jenjang === 'SMA').length;
    const noKelas = siswa.filter(s => !kelas.find(k => k.id_kelas === s.id_kelas)).length;
    return { total: siswa.length, smpCount, smaCount, noKelas };
  }, [siswa, kelas]);

  // ─── Filtered + Sorted ───────────────────────────────────────────────────
  const filteredSiswa = useMemo(() => {
    let list = [...siswa];
    const q = searchTerm.toLowerCase();
    if (q) list = list.filter(s =>
      s.nama?.toLowerCase().includes(q) || String(s.nis).includes(q)
    );
    if (filterKelas !== 'ALL') list = list.filter(s => String(s.id_kelas) === filterKelas);
    if (filterJenjang !== 'ALL') {
      list = list.filter(s => kelas.find(k => k.id_kelas === s.id_kelas)?.jenjang === filterJenjang);
    }
    list.sort((a, b) => {
      let va: string, vb: string;
      if (sortField === 'nis') { va = String(a.nis || ''); vb = String(b.nis || ''); }
      else if (sortField === 'kelas') {
        va = kelas.find(k => k.id_kelas === a.id_kelas)?.nama_kelas || '';
        vb = kelas.find(k => k.id_kelas === b.id_kelas)?.nama_kelas || '';
      } else { va = a.nama || ''; vb = b.nama || ''; }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [siswa, kelas, searchTerm, filterKelas, filterJenjang, sortField, sortDir]);

  const totalPages = Math.ceil(filteredSiswa.length / ITEMS_PER_PAGE);
  const paginatedSiswa = filteredSiswa.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ─── Sort helper ─────────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };
  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field ? <ArrowUpDown className="w-3 h-3 opacity-30" /> :
      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />;

  // ─── Selection ────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    if (n.has(id)) {
      n.delete(id);
    } else {
      n.add(id);
    }
    return n;
  });
  const toggleSelectAllPage = () => {
    const pageIds = paginatedSiswa.map(s => s.id_siswa);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (allSelected) pageIds.forEach(id => n.delete(id));
      else pageIds.forEach(id => n.add(id));
      return n;
    });
  };
  const allPageSelected = paginatedSiswa.length > 0 && paginatedSiswa.every(s => selectedIds.has(s.id_siswa));

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await addSiswaAction(fd.get('nis') as string, fd.get('nama') as string, fd.get('id_kelas') as string);
      if (res.success) { toast.success('Siswa berhasil ditambahkan!'); setShowAddModal(false); fetchData(true); }
      else toast.error(res.message);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await editSiswaAction(showEditModal.id_siswa, fd.get('nis') as string, fd.get('nama') as string, fd.get('id_kelas') as string);
      if (res.success) { toast.success('Data siswa berhasil diperbarui!'); setShowEditModal(null); fetchData(true); }
      else toast.error(res.message);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const executeConfirm = async () => {
    if (!confirmModal) return;
    setSaving(true);
    try {
      let res: any;
      if (confirmModal.type === 'DELETE') res = await deleteSiswaAction(confirmModal.ids[0]);
      else if (confirmModal.type === 'BULK_DELETE') { res = await deleteSiswaBatchAction(confirmModal.ids); setSelectedIds(new Set()); }
      else if (confirmModal.type === 'CLEAN') res = await cleanDuplicateSiswaAction();
      if (res?.success) { toast.success(res.message || 'Berhasil'); setConfirmModal(null); fetchData(true); }
      else toast.error(res?.message || 'Gagal');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ─── Export CSV ───────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = filteredSiswa.map(s => {
      const kls = kelas.find(k => k.id_kelas === s.id_kelas);
      return { NIS: s.nis, Nama: s.nama, Kelas: kls?.nama_kelas || 'N/A', Jenjang: kls?.jenjang || 'N/A', 'Tahun Ajaran': s.tahun_ajaran || '', Semester: s.semester || '' };
    });
    const workbook = createWorkbook();
    const worksheet = workbook.addWorksheet('Direktori Siswa');
    worksheet.columns = [
      { header: 'NIS', key: 'NIS', width: 15 },
      { header: 'Nama', key: 'Nama', width: 30 },
      { header: 'Kelas', key: 'Kelas', width: 15 },
      { header: 'Jenjang', key: 'Jenjang', width: 10 },
      { header: 'Tahun Ajaran', key: 'Tahun Ajaran', width: 15 },
      { header: 'Semester', key: 'Semester', width: 12 },
    ];
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    downloadWorkbook(workbook, `direktori_siswa_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Data berhasil diekspor ke Excel!');
  };

  // ─── Download Template ────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    const rows = kelas.slice(0, 6).map((k, i) => ({
      nis: `260${String(i + 1).padStart(4, '0')}`,
      nama: `Contoh Siswa ${i + 1}`,
      kelas: k.nama_kelas,
    }));
    if (rows.length === 0) rows.push({ nis: '2607001', nama: 'Contoh Siswa', kelas: 'KELAS VII' });
    const workbook = createWorkbook();
    const templateSheet = workbook.addWorksheet('Template');
    templateSheet.columns = [
      { header: 'nis', key: 'nis', width: 15 },
      { header: 'nama', key: 'nama', width: 30 },
      { header: 'kelas', key: 'kelas', width: 20 },
    ];
    rows.forEach((row) => templateSheet.addRow(row));
    templateSheet.getRow(1).font = { bold: true };

    // Sheet daftar kelas untuk referensi
    if (kelas.length > 0) {
      const kelasRef = kelas.map(k => ({ nama_kelas: k.nama_kelas, id_kelas: k.id_kelas, jenjang: k.jenjang }));
      const referenceSheet = workbook.addWorksheet('Daftar Kelas (Referensi)');
      referenceSheet.columns = [
        { header: 'nama_kelas', key: 'nama_kelas', width: 20 },
        { header: 'id_kelas', key: 'id_kelas', width: 20 },
        { header: 'jenjang', key: 'jenjang', width: 12 },
      ];
      kelasRef.forEach((row) => referenceSheet.addRow(row));
      referenceSheet.getRow(1).font = { bold: true };
    }
    await downloadWorkbook(workbook, 'Template_Import_Siswa_TA_2026_2027.xlsx');
    toast.success('Template berhasil diunduh! Anda dapat mengisi nama kelas (misal: KELAS VII, X, XII) atau ID kelas.');
  };

  // ─── Import file ──────────────────────────────────────────────────────────
  const processImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const workbook = await loadWorkbookFromFile(selectedFile);
      const worksheet = workbook.worksheets[0];
      const rawRows = worksheet ? worksheetToObjects(worksheet) as any[] : [];
      const rows = rawRows.map(r => ({
        nis: String(r.nis || r.NIS || r.Nis || '').trim(),
        nama: String(r.nama || r.Nama || r.NAMA || r['Nama Lengkap'] || '').trim(),
        id_kelas: String(r.id_kelas || r.kelas || r.Kelas || r.KELAS || '').trim()
      })).filter(r => r.nis || r.nama);
      if (rows.length === 0) { toast.error('File kosong atau format tidak valid.'); setImporting(false); return; }
      const res = await bulkAddSiswaAction(rows);
      if (res.success) {
        toast.success(res.message);
        setImportResult({ inserted: (res as any).inserted || 0, skipped: (res as any).skipped || 0, errors: (res as any).errors || [] });
        fetchData(true);
      } else toast.error(res.message);
    } catch (err: any) { toast.error('Gagal membaca file: ' + err.message); }
    finally { setImporting(false); }
  };

  const handleBulkMoveKelas = async (targetKelasId: string) => {
    if (!targetKelasId || selectedIds.size === 0) return;
    setSaving(true);
    try {
      const res = await bulkAssignKelasAction(Array.from(selectedIds), targetKelasId);
      if (res.success) {
        toast.success(res.message);
        setSelectedIds(new Set());
        fetchData(true);
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setSelectedFile(f);
  };

  // Active filters count
  const activeFilterCount = [searchTerm, filterKelas !== 'ALL' ? filterKelas : '', filterJenjang !== 'ALL' ? filterJenjang : ''].filter(Boolean).length;

  if (loading) return (
    <DashboardLoadingState
      title="Sinkronisasi Data Siswa..."
      subtitle="Memuat direktori siswa, rombel kelas, dan jenjang aktif"
      accentClass="border-t-emerald-500"
    />
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-5 sm:space-y-8 fade-in">

      {/* ── Header ── */}
      <PageHeader
        icon={<GraduationCap className="w-6 h-6 sm:w-7 sm:h-7" />}
        iconBgClass="bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
        title="Direktori Siswa"
        description="Kelola data peserta didik, filter berdasarkan kelas, dan impor massal dari Excel."
        actions={
          <>
            <button onClick={() => fetchData(true)} disabled={refreshing} aria-label="Segarkan data siswa"
              className="w-10 h-10 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all disabled:opacity-50 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-sm">
              <FileDown className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={() => { setShowImportModal(true); setImportResult(null); setSelectedFile(null); }}
              className="flex items-center gap-2 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-sm">
              <FileUp className="w-3.5 h-3.5" /> Import Excel
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
              <UserPlus className="w-4 h-4" /> Tambah Siswa
            </button>
          </>
        }
      />

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: 'Total Siswa', value: stats.total, icon: <Database className="w-4 h-4" />, color: 'text-slate-800 dark:text-slate-200', bg: 'bg-slate-500/10' },
          { label: 'Unit SMP', value: stats.smpCount, icon: <GraduationCap className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Unit SMA', value: stats.smaCount, icon: <GraduationCap className="w-4 h-4" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
          { label: 'Belum Ada Kelas', value: stats.noKelas, icon: <School className="w-4 h-4" />, color: stats.noKelas > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400', bg: stats.noKelas > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm lg:backdrop-blur-sm">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center ${s.color} flex-shrink-0`}>{s.icon}</div>
            <div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search / Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
          <input type="text" placeholder="Cari nama atau NIS siswa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl pl-10 pr-9 py-2.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {/* Filter Jenjang & Kelas Side-by-Side di HP */}
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
          <div className="relative">
            <select value={filterJenjang} onChange={e => setFilterJenjang(e.target.value)}
              className={`w-full sm:w-auto appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-3 sm:pl-4 pr-8 py-2.5 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none transition-all cursor-pointer shadow-sm ${filterJenjang !== 'ALL' ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
              <option value="ALL">Semua Jenjang</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
              className={`w-full sm:w-auto appearance-none bg-white dark:bg-white/[0.03] border rounded-xl pl-3 sm:pl-4 pr-8 py-2.5 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none transition-all cursor-pointer shadow-sm ${filterKelas !== 'ALL' ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'}`}>
              <option value="ALL">Semua Kelas</option>
              {kelas.map(k => <option key={k.id_kelas} value={k.id_kelas}>[{k.jenjang}] {k.nama_kelas}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* View toggle & reset */}
        <div className="flex gap-2 flex-shrink-0">
          {activeFilterCount > 0 && (
            <button onClick={() => { setSearchTerm(''); setFilterKelas('ALL'); setFilterJenjang('ALL'); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20">
              <X className="w-3 h-3" /> Reset ({activeFilterCount})
            </button>
          )}
          <div className="hidden md:flex rounded-xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm">
            <button onClick={() => setViewMode('table')} title="Tampilan Tabel"
              className={`w-10 h-10 flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-white/[0.03] text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
              <LayoutList className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('card')} title="Tampilan Kartu"
              className={`w-10 h-10 flex items-center justify-center transition-all ${viewMode === 'card' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-white/[0.03] text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Table/Card + Toolbar ── */}
      <div className="bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2rem] overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Selection mode */}
            <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSelectionMode ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-emerald-300'}`}>
              {isSelectionMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {isSelectionMode ? `Mode Seleksi (${selectedIds.size})` : 'Mode Seleksi'}
            </button>

            {isSelectionMode && (
              <button
                onClick={() => setSelectedIds(new Set(filteredSiswa.map(s => s.id_siswa)))}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-emerald-500/10 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest transition-all border border-slate-200 dark:border-white/10"
              >
                Pilih Semua ({filteredSiswa.length})
              </button>
            )}

            {isSelectionMode && selectedIds.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="h-4 w-px bg-slate-200 dark:bg-white/10" />
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{selectedIds.size} dipilih</span>
                <select
                  defaultValue=""
                  disabled={saving}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      handleBulkMoveKelas(val);
                      e.target.value = '';
                    }
                  }}
                  className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest cursor-pointer focus:outline-none"
                >
                  <option value="" disabled>🎓 Naik / Pindah Kelas Ke...</option>
                  {kelas.map(k => (
                    <option key={k.id_kelas} value={k.id_kelas}>
                      → {k.nama_kelas} ({k.jenjang})
                    </option>
                  ))}
                </select>
                <button onClick={() => setConfirmModal({ type: 'BULK_DELETE', ids: Array.from(selectedIds), label: `${selectedIds.size} siswa terpilih` })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                  <Trash2 className="w-3 h-3" /> Hapus Terpilih
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="text-[9px] font-black text-slate-400 hover:text-slate-700 dark:hover:text-white uppercase tracking-widest">
                  Batal Pilih
                </button>
              </div>
            )}

            {!isSelectionMode && (
              <button onClick={() => setConfirmModal({ type: 'CLEAN', ids: [], label: 'seluruh database siswa' })}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-500/20 hover:border-amber-500 transition-all">
                Bersihkan Duplikat
              </button>
            )}
          </div>
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            {filteredSiswa.length} siswa · hal {currentPage}/{totalPages || 1}
          </div>
        </div>

        {/* ── MOBILE COMPACT LIST (HP: 1 baris per siswa, tanpa scroll bertumpuk) ── */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
          {paginatedSiswa.length > 0 ? paginatedSiswa.map((s, i) => {
            const klsInfo = kelas.find(k => k.id_kelas === s.id_kelas);
            const isSelected = selectedIds.has(s.id_siswa);
            const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
            return (
              <div
                key={s.id_siswa}
                onClick={() => isSelectionMode && toggleSelect(s.id_siswa)}
                className={`flex items-center gap-3 px-4 py-3 active:bg-slate-50 dark:active:bg-white/[0.03] ${isSelected ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : ''}`}
              >
                {isSelectionMode ? (
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-white/20'}`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                ) : (
                  <span className="w-6 text-center text-[10px] font-black text-slate-400 flex-shrink-0">{globalIdx}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-black text-[13px] text-slate-900 dark:text-white truncate">{s.nama}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[10px] text-slate-400">NIS {s.nis}</span>
                    {klsInfo ? (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${klsInfo.jenjang === 'SMA' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                        {klsInfo.nama_kelas}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400">Tanpa Kelas</span>
                    )}
                  </div>
                </div>
                {!isSelectionMode && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => setShowEditModal(s)} title="Edit"
                      className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 flex items-center justify-center active:scale-95">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirmModal({ type: 'DELETE', ids: [s.id_siswa], label: s.nama })} title="Hapus"
                      className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center active:scale-95">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="py-16 text-center">
              <div className="text-5xl mb-3 grayscale opacity-20">🎓</div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                {activeFilterCount > 0 ? 'Tidak ada siswa sesuai filter.' : 'Belum ada data siswa.'}
              </p>
              {activeFilterCount > 0 && (
                <button onClick={() => { setSearchTerm(''); setFilterKelas('ALL'); setFilterJenjang('ALL'); }}
                  className="mt-3 text-[11px] font-black text-emerald-500 underline">Reset Filter</button>
              )}
            </div>
          )}
        </div>

        {/* ── TABLE VIEW (Tablet/Desktop) ── */}
        {viewMode === 'table' && (
          <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[560px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0d1117] text-[9px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-200 dark:border-white/[0.05]">
                <tr>
                  {isSelectionMode && (
                    <th className="pl-6 py-4 w-8">
                      <button onClick={toggleSelectAllPage} className="hover:bg-slate-200 dark:hover:bg-white/10 rounded-md p-0.5 transition-all">
                        {allPageSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                  )}
                  <th className="px-5 py-4 w-8 text-center">#</th>
                  <th className="px-5 py-4 cursor-pointer hover:text-slate-800 dark:hover:text-white" onClick={() => toggleSort('nis')}>
                    <div className="flex items-center gap-1.5">NIS <SortIcon field="nis" /></div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer hover:text-slate-800 dark:hover:text-white" onClick={() => toggleSort('nama')}>
                    <div className="flex items-center gap-1.5">Nama Lengkap <SortIcon field="nama" /></div>
                  </th>
                  <th className="px-5 py-4 cursor-pointer hover:text-slate-800 dark:hover:text-white text-center" onClick={() => toggleSort('kelas')}>
                    <div className="flex items-center justify-center gap-1.5">Unit/Kelas <SortIcon field="kelas" /></div>
                  </th>
                  <th className="px-5 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.02]">
                {paginatedSiswa.length > 0 ? paginatedSiswa.map((s, i) => {
                  const klsInfo = kelas.find(k => k.id_kelas === s.id_kelas);
                  const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
                  const isSelected = selectedIds.has(s.id_siswa);
                  return (
                    <tr key={s.id_siswa} className={`hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : ''}`}>
                      {isSelectionMode && (
                        <td className="pl-6 py-4">
                          <button onClick={() => toggleSelect(s.id_siswa)} className="p-0.5">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                          </button>
                        </td>
                      )}
                      <td className="px-5 py-4 text-center text-[10px] font-black text-slate-400 dark:text-slate-600">{globalIdx}</td>
                      <td className="px-5 py-4 font-mono text-xs font-black text-slate-500 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors whitespace-nowrap">{s.nis}</td>
                      <td className="px-5 py-4">
                        <div className="font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{s.nama}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{s.tahun_ajaran} · Sem {s.semester}</div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {klsInfo ? (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black tracking-widest border ${klsInfo.jenjang === 'SMA' ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20'}`}>
                            <span className="opacity-60">[{klsInfo.jenjang}]</span> {klsInfo.nama_kelas}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Belum ada kelas</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setShowEditModal(s)} title="Edit"
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-emerald-500/20 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/70 dark:border-white/5 flex items-center justify-center transition-all active:scale-95">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmModal({ type: 'DELETE', ids: [s.id_siswa], label: s.nama })} title="Hapus"
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-rose-500/20 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/70 dark:border-white/5 flex items-center justify-center transition-all active:scale-95">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={isSelectionMode ? 6 : 5} className="px-6 py-20 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-500">
                        <GraduationCap className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {activeFilterCount > 0 ? 'Tidak ada siswa sesuai filter.' : 'Belum ada data siswa.'}
                      </p>
                      {activeFilterCount > 0 && (
                        <button onClick={() => { setSearchTerm(''); setFilterKelas('ALL'); setFilterJenjang('ALL'); }}
                          className="mt-3 text-[10px] font-black text-emerald-500 hover:underline">Reset Filter</button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── CARD VIEW ── */}
        {viewMode === 'card' && (
          <div className="hidden md:block p-4 sm:p-6 overflow-y-auto max-h-[560px] touch-scroll">
            {paginatedSiswa.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {paginatedSiswa.map((s) => {
                  const klsInfo = kelas.find(k => k.id_kelas === s.id_kelas);
                  const isSelected = selectedIds.has(s.id_siswa);
                  const initials = s.nama?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';
                  return (
                    <div key={s.id_siswa} onClick={() => isSelectionMode && toggleSelect(s.id_siswa)}
                      className={`relative bg-slate-50 dark:bg-white/[0.03] border rounded-2xl p-4 sm:p-5 hover:border-emerald-500/40 transition-all group ${isSelected ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-white/[0.07]'} ${isSelectionMode ? 'cursor-pointer' : ''}`}>
                      {isSelectionMode && (
                        <div className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-white/20 bg-white dark:bg-transparent'}`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-sm text-slate-900 dark:text-white truncate">{s.nama}</div>
                          <div className="font-mono text-[10px] text-slate-400">{s.nis}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {klsInfo ? (
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black ${klsInfo.jenjang === 'SMA' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                            {klsInfo.nama_kelas}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400">Tanpa Kelas</span>
                        )}
                        {!isSelectionMode && (
                          <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setShowEditModal(s)} className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 hover:bg-emerald-500/20 text-slate-500 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-white/10 flex items-center justify-center transition-all active:scale-95">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setConfirmModal({ type: 'DELETE', ids: [s.id_siswa], label: s.nama })} className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 hover:bg-rose-500/20 text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-white/10 flex items-center justify-center transition-all active:scale-95">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="text-5xl mb-4 grayscale opacity-20">🎓</div>
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                  {activeFilterCount > 0 ? 'Tidak ada siswa sesuai filter.' : 'Belum ada data siswa.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            Menampilkan <span className="text-emerald-600 dark:text-emerald-500">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredSiswa.length)}</span>–<span className="text-emerald-600 dark:text-emerald-500">{Math.min(currentPage * ITEMS_PER_PAGE, filteredSiswa.length)}</span> dari <span className="text-emerald-600 dark:text-emerald-500">{filteredSiswa.length}</span> siswa
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">«</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {/* Smart page numbers */}
              {(() => {
                const pages: (number | '...')[] = [];
                if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                else {
                  pages.push(1);
                  if (currentPage > 3) pages.push('...');
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                  if (currentPage < totalPages - 2) pages.push('...');
                  pages.push(totalPages);
                }
                return pages.map((p, i) => p === '...' ? (
                  <span key={`d${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">…</span>
                ) : (
                  <button key={p} onClick={() => setCurrentPage(p as number)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black transition-all ${currentPage === p ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                    {p}
                  </button>
                ));
              })()}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black text-slate-500 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">»</button>
            </div>
          )}
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            Total DB: <span className="text-emerald-600 dark:text-emerald-500">{siswa.length}</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MODAL: Tambah Siswa
      ════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-600/10 blur-[70px] rounded-full -mr-20 -mt-20 pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-lg">🎓</span>
                Tambah Siswa
              </h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4 relative z-10">
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">NIS</label>
                <input required type="text" name="nis" placeholder="Contoh: 2024001"
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Nama Lengkap</label>
                <input required type="text" name="nama" placeholder="Contoh: Ahmad Fauzi"
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Kelas</label>
                <select required name="id_kelas"
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer">
                  <option value="">-- Pilih Kelas --</option>
                  {kelas.map(k => <option key={k.id_kelas} value={k.id_kelas}>[{k.jenjang}] {k.nama_kelas}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...</> : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Edit Siswa
      ════════════════════════════════════════════════════════ */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowEditModal(null); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-600/10 blur-[70px] rounded-full -mr-20 -mt-20 pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-lg">✏️</span>
                Edit Siswa
              </h2>
              <button onClick={() => setShowEditModal(null)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4 relative z-10">
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">NIS</label>
                <input required type="text" name="nis" defaultValue={showEditModal.nis}
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Nama Lengkap</label>
                <input required type="text" name="nama" defaultValue={showEditModal.nama}
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Kelas</label>
                <select required name="id_kelas" defaultValue={showEditModal.id_kelas}
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer">
                  <option value="">-- Pilih Kelas --</option>
                  {kelas.map(k => <option key={k.id_kelas} value={k.id_kelas}>[{k.jenjang}] {k.nama_kelas}</option>)}
                </select>
              </div>
              {/* Info Kelas asal */}
              {(() => {
                const kelasAsal = kelas.find(k => k.id_kelas === showEditModal.id_kelas);
                return kelasAsal ? (
                  <p className="text-[10px] text-slate-400 dark:text-slate-600 ml-1">
                    Kelas sekarang: <span className="text-emerald-600 dark:text-emerald-400 font-black">{kelasAsal.nama_kelas}</span>
                  </p>
                ) : null;
              })()}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(null)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Menyimpan...</> : 'Update Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Import Excel
      ════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget && !importing) { setShowImportModal(false); setSelectedFile(null); } }}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-600/5 blur-[80px] rounded-full -mr-30 -mt-30 pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-lg">📤</span>
                Import Data Siswa
              </h2>
              <button onClick={() => { setShowImportModal(false); setSelectedFile(null); setImportResult(null); }} disabled={importing}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 flex items-center justify-center transition-all disabled:opacity-30">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative z-10 space-y-4">
              {/* Template download */}
              <button onClick={handleDownloadTemplate}
                className="w-full flex items-center gap-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.07] rounded-2xl px-5 py-4 hover:border-emerald-500/40 transition-all group text-left">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm text-slate-900 dark:text-white">Download Template Excel</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Format: NIS, Nama, id_kelas + sheet referensi kelas</div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              </button>

              {/* Upload area */}
              <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 transition-all ${dragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-200 dark:border-white/10'}`}>
                {selectedFile ? (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-slate-900 dark:text-white truncate">{selectedFile.name}</div>
                      <div className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="text-[9px] font-black text-rose-500 hover:underline flex-shrink-0">Ganti</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center text-center cursor-pointer">
                    <div className="w-12 h-12 bg-white dark:bg-white/5 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                      <UploadCloud className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="font-black text-sm text-slate-700 dark:text-slate-300 mb-1">Drag & drop atau klik untuk upload</div>
                    <div className="text-[10px] text-slate-400">Format: .xlsx / .xls</div>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                  </label>
                )}
              </div>

              {/* Import result */}
              {importResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                  <div className="font-black text-sm text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Hasil Import
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3 text-center">
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{importResult.inserted}</div>
                      <div className="text-slate-500 font-bold uppercase tracking-widest">Berhasil</div>
                    </div>
                    <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3 text-center">
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{importResult.skipped}</div>
                      <div className="text-slate-500 font-bold uppercase tracking-widest">Dilewati</div>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-[10px] font-black text-rose-500 cursor-pointer">{importResult.errors.length} error detail</summary>
                      <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                        {importResult.errors.map((e, i) => (
                          <div key={i} className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/10 rounded px-2 py-1">{e.msg || e}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowImportModal(false); setSelectedFile(null); setImportResult(null); }} disabled={importing}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 disabled:opacity-30">
                  Tutup
                </button>
                <button onClick={processImport} disabled={!selectedFile || importing}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                  {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Mengimpor...</> : <><FileUp className="w-3.5 h-3.5" />Mulai Import</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Konfirmasi Hapus
      ════════════════════════════════════════════════════════ */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 lg:backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-40 h-40 bg-rose-600/8 blur-[60px] rounded-full -ml-20 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${confirmModal.type === 'CLEAN' ? 'bg-amber-500/10' : 'bg-rose-500/10'}`}>
                {confirmModal.type === 'CLEAN'
                  ? <AlertCircle className="w-7 h-7 text-amber-500" />
                  : <Trash2 className="w-7 h-7 text-rose-500" />
                }
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                {confirmModal.type === 'CLEAN' ? 'Bersihkan Duplikat?' : confirmModal.type === 'BULK_DELETE' ? `Hapus ${confirmModal.ids.length} Siswa?` : 'Hapus Siswa?'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 leading-relaxed">
                {confirmModal.type === 'CLEAN'
                  ? 'Sistem akan mencari dan menghapus data siswa duplikat berdasarkan NIS. Tindakan ini tidak dapat dibatalkan.'
                  : 'Data yang akan dihapus permanen:'}
              </p>
              {confirmModal.type !== 'CLEAN' && (
                <p className="text-sm font-black text-rose-600 dark:text-rose-400 mb-5 bg-rose-500/10 px-4 py-2 rounded-xl truncate">{confirmModal.label}</p>
              )}
              {confirmModal.type === 'CLEAN' && <div className="mb-5" />}
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">
                  Batal
                </button>
                <button onClick={executeConfirm} disabled={saving}
                  className={`flex-1 py-3.5 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${confirmModal.type === 'CLEAN' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'}`}>
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Memproses...</> :
                    confirmModal.type === 'CLEAN' ? 'Ya, Bersihkan' : <><Trash2 className="w-3.5 h-3.5" />Ya, Hapus</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
