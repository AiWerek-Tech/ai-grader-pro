'use client';

import { getGuruList, addGuruAction, deleteGuruAction, toggleStatusGuruAction, resetPasswordAction, editNamaAction, bulkAddGuruAction, deleteGuruBatchAction, resetPasswordBatchAction, updateProfileUrlAction } from '@/lib/actions/admin';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { createWorkbook, downloadWorkbook, loadWorkbookFromFile, worksheetToObjects } from '@/lib/utils/excel';
import { transformDriveLink, compressImageFileToDataUrl } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { ReadOnlyBanner } from '@/components/dashboard/ReadOnlyBanner';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { 
  UserPlus, 
  Users,
  Search,
  FileUp, 
  Trash2, 
  Activity, 
  CheckSquare, 
  Square,
  KeyRound,
  Download,
  AlertCircle,
  TrendingUp,
  Award,
  Contact2,
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  UserCircle2,
  Link2,
  Camera,
  Eye,
  EyeOff,
  Copy,
  Lock
} from 'lucide-react';

export default function GuruPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<any>(null);
  const [newPassInput, setNewPassInput] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showAllPasswords, setShowAllPasswords] = useState(true);
  const [visiblePassIds, setVisiblePassIds] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{ type: 'DELETE' | 'RESET' | 'STATUS' | 'BULK_DELETE' | 'BULK_RESET', id: string | string[], name: string } | null>(null);
    
  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Import states
  const [importing, setImporting] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const downloadCredentialsWorkbook = async (
    rows: Array<{ username: string; nama?: string; role?: string; password: string; generated?: boolean }>,
    filename: string
  ) => {
    if (!rows.length) return;

    const workbook = createWorkbook();
    const worksheet = workbook.addWorksheet('Kredensial Sementara');
    worksheet.columns = [
      { header: 'username', key: 'username', width: 20 },
      { header: 'nama', key: 'nama', width: 28 },
      { header: 'role', key: 'role', width: 14 },
      { header: 'password', key: 'password', width: 24 },
      { header: 'generated', key: 'generated', width: 14 },
    ];
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    await downloadWorkbook(workbook, filename);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getGuruList();
      if (res.success) {
        setData(res.data || []);
        setCanEdit((res as any).canEdit !== false);
      } else {
        setError(res.message || 'Gagal memuat data');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered and Paginated data
  const filteredData = useMemo(() => {
    return data.filter(guru => {
      const matchesSearch = guru.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            guru.username.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || guru.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || guru.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [data, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map(g => g.id)));
    }
  };

  const handleDownloadTemplate = async () => {
    // Data dummy untuk template
    const templateData = [
      { username: 'budi123', password: '', nama: 'Budi Santoso, S.Pd', role: 'GURU', profile_url: 'https://images.unsplash.com/photo-1544717297-fa154da09f9b?w=200' },
      { username: 'admin_utama', password: 'AdminSementara#2026', nama: 'Siti Aminah, M.Pd', role: 'ADMIN', profile_url: '' },
    ];

    const workbook = createWorkbook();
    const worksheet = workbook.addWorksheet('Template Import Guru');
    worksheet.columns = [
      { header: 'username', key: 'username', width: 18 },
      { header: 'password', key: 'password', width: 18 },
      { header: 'nama', key: 'nama', width: 30 },
      { header: 'role', key: 'role', width: 12 },
      { header: 'profile_url', key: 'profile_url', width: 40 },
    ];
    templateData.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    await downloadWorkbook(workbook, 'Template_Import_Guru_Pro.xlsx');
    toast.success('Template Excel Pro berhasil diunduh!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const processImport = async () => {
    if (!selectedFile) return;
    setImporting(true);

    try {
      const workbook = await loadWorkbookFromFile(selectedFile);
      const worksheet = workbook.worksheets[0];
      const rawRows = worksheet ? worksheetToObjects(worksheet) as any[] : [];

      // Clean data to ensure plain objects for Server Actions
      const rows = rawRows.map(row => ({
        username: String(row.username || '').trim(),
        password: String(row.password || '').trim(),
        nama: String(row.nama || '').trim(),
        role: String(row.role || 'GURU').toUpperCase().trim(),
        profile_url: String(row.profile_url || '').trim()
      }));

      if (rows.length === 0) {
        toast.error('File Excel kosong atau tidak valid.');
        setImporting(false);
        return;
      }

      const res = await bulkAddGuruAction(rows);
      if (res.success) {
        toast.success(res.message);
        if (res.data?.length) {
          await downloadCredentialsWorkbook(res.data, 'Kredensial_Import_Guru.xlsx');
        }
        setShowImportModal(false);
        setSelectedFile(null);
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error('Gagal membaca file: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleAddGuru = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData);
    
    try {
      const res = await addGuruAction(payload);
      if (res.success) {
        toast.success('Guru berhasil ditambahkan!');
        setShowAddModal(false);
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditGuru = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nama = formData.get('nama') as string;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    
    try {
      const res = await editNamaAction(showEditModal.id, nama, 'SYSTEM', {
        username,
        password,
        role,
      });
      if (res.success) {
        toast.success('Data akun & password berhasil diperbarui!');
        setShowEditModal(null);
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveCustomPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showPasswordModal) return;
    setSavingPassword(true);
    try {
      const targetPass = newPassInput.trim() || 'guru12345';
      const res = await resetPasswordAction(showPasswordModal.id, targetPass);
      if (res.success) {
        toast.success(`Password ${showPasswordModal.nama} diatur menjadi: "${targetPass}"`);
        setShowPasswordModal(null);
        setNewPassInput('');
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleQuickResetDefault = async (guru: any) => {
    setSavingPassword(true);
    try {
      const res = await resetPasswordAction(guru.id, 'guru12345');
      if (res.success) {
        toast.success(res.message);
        setShowPasswordModal(null);
        setNewPassInput('');
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleSinglePassVisibility = (id: string) => {
    const next = new Set(visiblePassIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisiblePassIds(next);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin: ${text}`);
  };

  const exportAllCredentials = async () => {
    const rows = data.map(g => ({
      username: g.username,
      nama: g.nama,
      role: g.role,
      password: g.password_plain || (g.role === 'ADMIN' ? 'admin123' : 'guru12345'),
      generated: false,
    }));
    await downloadCredentialsWorkbook(rows, `Daftar_Akun_dan_Password_Guru_WMVAA.xlsx`);
    toast.success('Daftar lengkap Username & Password Guru berhasil diunduh!');
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUpdatingProfile(true);
    const formData = new FormData(e.currentTarget);
    const url = formData.get('profile_url') as string;
    
    try {
      const res = await updateProfileUrlAction(showProfileModal.id, url);
      if (res.success) {
        toast.success('Foto profil berhasil diperbarui!');
        setShowProfileModal(null);
        fetchData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmModal) return;
    const { type, id } = confirmModal;
    
    try {
      let res: any;
      if (type === 'DELETE') res = await deleteGuruAction(id as string);
      else if (type === 'STATUS') res = await toggleStatusGuruAction(id as string);
      else if (type === 'RESET') res = await resetPasswordAction(id as string, 'guru12345');
      else if (type === 'BULK_DELETE') {
        res = await deleteGuruBatchAction(id as string[]);
        setSelectedIds(new Set());
      }
      else if (type === 'BULK_RESET') {
        res = await resetPasswordBatchAction(id as string[], 'guru12345');
        setSelectedIds(new Set());
      }
      
      if (res?.success) {
        toast.success(res.message || 'Berhasil');
        setConfirmModal(null);
        fetchData();
      } else {
        toast.error(res?.message || 'Gagal');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const downloadWelcomeCard = (guru: any) => {
    const pass = guru.password_plain || (guru.role === 'ADMIN' ? 'admin123' : 'guru12345');
    const cardContent = [
      '=========================================',
      '   WMVAA AI GRADER PRO - KARTU LOGIN',
      '=========================================',
      `Nama Lengkap : ${guru.nama}`,
      `Role Akses   : ${guru.role}`,
      `Username     : ${guru.username}`,
      `Password     : ${pass}`,
      '=========================================',
      'Anda dapat mengganti password kapan saja',
      'melalui menu "Profil Saya" di aplikasi.',
      '=========================================',
    ].join('\n');
    const blob = new Blob([cardContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `KartuLogin_${guru.username}.txt`;
    link.click();
    document.body.removeChild(link);
    toast.success(`Kartu Login @${guru.username} berhasil diunduh!`);
  };

  // Helper for Heatmap
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-white/5';
    if (count < 2) return 'bg-indigo-200 dark:bg-indigo-900/40';
    if (count < 5) return 'bg-indigo-400 dark:bg-indigo-600';
    return 'bg-indigo-600 dark:bg-indigo-400';
  };

  if (loading) return (
    <DashboardLoadingState
      title="Sinkronisasi Database Pengajar..."
      subtitle="Memuat akun guru, admin, dan hak akses sistem"
      accentClass="border-t-indigo-500"
    />
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 fade-in">
      <PageHeader
        icon={<Users className="w-6 h-6 sm:w-7 sm:h-7" />}
        iconBgClass="bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
        title="Database Pengajar"
        description="Kelola hak akses guru dan admin, pantau produktivitas, serta manajemen akun sistem."
        actions={
          <>
            <button 
              onClick={() => canEdit && setShowAddModal(true)}
              disabled={!canEdit}
              title={!canEdit ? 'Dikunci — Mode Read-Only' : 'Daftarkan Pengajar'}
              className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed text-white px-6 py-3 font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2.5 active:scale-95 transition-all"
            >
              {canEdit ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Daftarkan Pengajar
            </button>
            <button 
              onClick={() => canEdit && exportAllCredentials()}
              disabled={!canEdit}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white px-5 py-3 font-black rounded-xl text-[10px] uppercase tracking-widest shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
              title={!canEdit ? 'Dikunci — Mode Read-Only' : 'Download Daftar Semua Username & Password Guru (.xlsx)'}
            >
              {canEdit ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Ekspor Akun
            </button>
            <button 
              onClick={() => canEdit && setShowImportModal(true)}
              disabled={!canEdit}
              title={!canEdit ? 'Dikunci — Mode Read-Only' : 'Impor Guru'}
              className="flex-1 md:flex-none bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.1] px-5 py-3 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              {canEdit ? <FileUp className="w-4 h-4 text-indigo-500" /> : <Lock className="w-4 h-4" />} Impor Guru
            </button>
          </>
        }
      />

      {!canEdit && <ReadOnlyBanner menuLabel="Manajemen Guru" />}

      {/* Stats Cards Quick Look */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.06] p-5 sm:p-6 rounded-3xl lg:backdrop-blur-md shadow-sm dark:shadow-none">
          <div className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1.5">Total Guru</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{data.filter(g => g.role === 'GURU').length}</div>
        </div>
        <div className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.06] p-5 sm:p-6 rounded-3xl lg:backdrop-blur-md shadow-sm dark:shadow-none">
          <div className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1.5">Total Admin</div>
          <div className="text-3xl font-black text-amber-700 dark:text-amber-500">{data.filter(g => g.role === 'ADMIN').length}</div>
        </div>
        <div className="bg-white dark:bg-[#0a0e1a]/60 border border-slate-200 dark:border-white/[0.06] p-5 sm:p-6 rounded-3xl lg:backdrop-blur-md shadow-sm dark:shadow-none">
          <div className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1.5">Status Aktif</div>
          <div className="text-3xl font-black text-emerald-700 dark:text-emerald-500">{data.filter(g => g.status === 'Aktif').length}</div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative group">
          <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-600 transition-colors pointer-events-none" />
          <input 
            type="text" 
            placeholder="Cari Nama atau Username..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white dark:bg-white/[0.03] border border-slate-300 dark:border-white/[0.08] rounded-[1.5rem] pl-14 pr-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-500 dark:placeholder:text-slate-700 shadow-sm dark:shadow-inner"
          />
        </div>
        <div className="relative">
          <select 
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white dark:bg-white/[0.03] border border-slate-300 dark:border-white/[0.08] rounded-[1.5rem] px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer shadow-sm dark:shadow-inner"
          >
            <option value="ALL" className="bg-white dark:bg-[#0a0e1a]">Semua Role</option>
            <option value="GURU" className="bg-white dark:bg-[#0a0e1a]">GURU</option>
            <option value="ADMIN" className="bg-white dark:bg-[#0a0e1a]">ADMIN</option>
          </select>
          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">▼</span>
        </div>
        <div className="relative">
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white dark:bg-white/[0.03] border border-slate-300 dark:border-white/[0.08] rounded-[1.5rem] px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer shadow-sm dark:shadow-inner"
          >
            <option value="ALL" className="bg-white dark:bg-[#0a0e1a]">Semua Status</option>
            <option value="Aktif" className="bg-white dark:bg-[#0a0e1a]">AKTIF</option>
            <option value="Non-Aktif" className="bg-white dark:bg-[#0a0e1a]">NON-AKTIF</option>
          </select>
          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">▼</span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-5 rounded-2xl font-bold flex items-center gap-4 animate-shake">
          <span className="text-xl">🚫</span> {error}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-[2.5rem] overflow-hidden shadow-sm dark:shadow-2xl relative">
        <div className="p-8 border-b border-slate-100 dark:border-white/[0.05] flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.02]">
           <div className="flex items-center gap-4">
              {canEdit && (
                <button 
                  onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSelectionMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'}`}
                >
                  {isSelectionMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {isSelectionMode ? 'Selesai Memilih' : 'Mode Seleksi'}
                </button>
              )}
              
              {isSelectionMode && selectedIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-4 fade-in duration-300">
                  <span className="h-4 w-[1px] bg-slate-200 dark:bg-white/10 mx-2" />
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{selectedIds.size} Terpilih</span>
                  <button 
                    onClick={() => setConfirmModal({ type: 'BULK_DELETE', id: Array.from(selectedIds), name: `${selectedIds.size} Pengajar` })}
                    className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all" 
                    title="Hapus Masal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setConfirmModal({ type: 'BULK_RESET', id: Array.from(selectedIds), name: `${selectedIds.size} Pengajar` })}
                    className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg hover:bg-indigo-500 hover:text-white transition-all" 
                    title="Reset Pass Masal"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                </div>
              )}
           </div>
           
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Show <span className="text-indigo-600 mx-1">{paginatedData.length}</span> of {filteredData.length}
           </div>
        </div>

        {/* ── Mobile Native Card View (Hanya tampil di layar HP <640px) ── */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/[0.05]">
          {paginatedData.length > 0 ? paginatedData.map(guru => {
            const isPassVisible = showAllPasswords || visiblePassIds.has(guru.id);
            const plainPass = guru.password_plain || (guru.role === 'ADMIN' ? 'admin123' : 'guru12345');
            return (
              <div key={guru.id} className="p-4 space-y-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-center text-base font-black text-indigo-600 dark:text-indigo-400 shrink-0 overflow-hidden">
                      {guru.profile_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={transformDriveLink(guru.profile_url)} alt={guru.nama} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      ) : (
                        guru.nama.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{guru.nama}</h4>
                      <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mt-0.5">
                        <span>@{guru.username}</span>
                        <span>·</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{isPassVisible ? plainPass : '••••••'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${guru.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'}`}>
                      {guru.role}
                    </span>
                    <button
                      disabled={!canEdit}
                      onClick={() => canEdit && setConfirmModal({ type: 'STATUS', id: guru.id, name: guru.nama })}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border disabled:opacity-60 disabled:cursor-not-allowed ${guru.status === 'Aktif' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}
                    >
                      {guru.status}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button disabled={!canEdit} onClick={() => canEdit && setShowEditModal(guru)} title={canEdit ? 'Edit' : 'Dikunci — Mode Read-Only'} className="py-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-black uppercase flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    {canEdit ? '✏️ Edit' : <Lock className="w-3.5 h-3.5" />}
                  </button>
                  <button disabled={!canEdit} onClick={() => { if (!canEdit) return; setShowPasswordModal(guru); setNewPassInput(plainPass); }} title={canEdit ? 'Password' : 'Dikunci — Mode Read-Only'} className="py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    {canEdit ? '🔑 Pass' : <Lock className="w-3.5 h-3.5" />}
                  </button>
                  <button disabled={!canEdit} onClick={() => canEdit && downloadWelcomeCard(guru)} title={canEdit ? 'Kartu Login' : 'Dikunci — Mode Read-Only'} className="py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    {canEdit ? <><Contact2 className="w-3.5 h-3.5" /> Kartu</> : <Lock className="w-3.5 h-3.5" />}
                  </button>
                  <button disabled={!canEdit} onClick={() => canEdit && setConfirmModal({ type: 'DELETE', id: guru.id, name: guru.nama })} title={canEdit ? 'Hapus' : 'Dikunci — Mode Read-Only'} className="py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    {canEdit ? '🗑️ Hapus' : <Lock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-10 text-center text-xs text-slate-400 font-bold">Database Pengajar Kosong / Tidak Ditemukan</div>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.03] text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 border-b border-slate-200 dark:border-white/[0.05]">
              <tr>
                {isSelectionMode && (
                  <th className="pl-10 py-6 w-10">
                    <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-md transition-all">
                      {selectedIds.size === paginatedData.length ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                )}
                <th className="px-8 py-6">Identitas Pengajar</th>
                <th className="px-6 py-6">
                  <div className="flex items-center gap-2">
                    <span>Kredensial Login</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setShowAllPasswords(!showAllPasswords)}
                        className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-white/10 hover:bg-indigo-500 hover:text-white transition-all text-slate-600 dark:text-slate-300"
                        title={showAllPasswords ? 'Sembunyikan Semua Password' : 'Tampilkan Semua Password'}
                      >
                        {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </th>
                <th className="px-6 py-6 text-center">Akses Role</th>
                <th className="px-6 py-6 text-center">Status</th>
                <th className="px-6 py-6 text-center">Analitik Performa</th>
                <th className="px-8 py-6 text-right">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.02]">
              {paginatedData.length > 0 ? paginatedData.map(guru => {
                const isPassVisible = showAllPasswords || visiblePassIds.has(guru.id);
                const plainPass = guru.password_plain || (guru.role === 'ADMIN' ? 'admin123' : 'guru12345');
                return (
                <tr key={guru.id} className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-all group ${selectedIds.has(guru.id) ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`}>
                  {isSelectionMode && (
                    <td className="pl-10 py-6">
                      <button onClick={() => toggleSelect(guru.id)} className="p-1">
                        {selectedIds.has(guru.id) ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                  )}
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="relative group/avatar">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-center text-lg font-black text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-all shadow-inner overflow-hidden">
                          {guru.profile_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={transformDriveLink(guru.profile_url)} alt={guru.nama} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            guru.nama.charAt(0).toUpperCase()
                          )}
                          <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white dark:border-[#0a0e1a] rounded-full z-10 ${guru.status === 'Aktif' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        </div>
                        {canEdit && (
                        <button 
                          onClick={() => setShowProfileModal(guru)}
                          className="absolute inset-0 bg-indigo-600/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-2xl text-white"
                          title="Update Foto"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{guru.nama}</div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                          ID: {guru.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 rounded-2xl px-3.5 py-2.5 max-w-[230px]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">User:</span>
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">{guru.username}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(guru.username, `Username ${guru.nama}`)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                          title="Salin Username"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Pass:</span>
                          <span className={`font-mono text-xs font-black truncate ${canEdit && isPassVisible ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 tracking-widest'}`}>
                            {canEdit && isPassVisible ? plainPass : '••••••••'}
                          </span>
                        </div>
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleSinglePassVisibility(guru.id)}
                              className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-colors"
                              title={isPassVisible ? 'Sembunyikan Password' : 'Lihat Password'}
                            >
                              {isPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyText(plainPass, `Password ${guru.nama}`)}
                              className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-colors"
                              title="Salin Password"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span
                            title="Password disembunyikan pada mode Read-Only"
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded"
                          >
                            <Lock className="w-2.5 h-2.5" /> Terkunci
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${guru.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 border-indigo-500/20'}`}>
                      {guru.role}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <button 
                      disabled={!canEdit}
                      onClick={() => canEdit && setConfirmModal({ type: 'STATUS', id: guru.id, name: guru.nama })}
                      className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${guru.status === 'Aktif' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-500 border-rose-500/20 hover:bg-rose-500/20'}`}
                    >
                      {guru.status}
                    </button>
                  </td>
                  <td className="px-6 py-6 text-center min-w-[180px]">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                         <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Efisiensi</span>
                         <span className="text-indigo-600">{Math.min(100, (guru.score / 200) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-1000 shadow-[0_0_8px_rgba(79,70,229,0.3)]" 
                          style={{ width: `${Math.max(5, Math.min(100, (guru.score / 200) * 100))}%` }}
                        />
                      </div>
                      {/* Activity Heatmap Small */}
                      <div className="flex gap-0.5 justify-center">
                         {[...Array(14)].map((_, i) => {
                            const date = new Date();
                            date.setDate(date.getDate() - (13 - i));
                            const dateStr = date.toISOString().split('T')[0];
                            const count = guru.activity?.filter((a: any) => String(a.t).startsWith(dateStr)).length || 0;
                            return (
                               <div key={i} className={`w-2 h-2 rounded-sm ${getHeatmapColor(count)}`} title={`${dateStr}: ${count} Aktivitas`} />
                            );
                         })}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button disabled={!canEdit} onClick={() => canEdit && downloadWelcomeCard(guru)} className="w-9 h-9 bg-slate-100 dark:bg-white/[0.03] hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all border border-slate-200 dark:border-white/5 flex items-center justify-center text-sm shadow-inner disabled:opacity-40 disabled:cursor-not-allowed" title={canEdit ? 'Download Kartu Login (.xlsx)' : 'Dikunci — Mode Read-Only'}>{canEdit ? <Contact2 className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}</button>
                      <button disabled={!canEdit} onClick={() => canEdit && setShowEditModal(guru)} className="w-9 h-9 bg-slate-100 dark:bg-white/[0.03] hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all border border-slate-200 dark:border-white/5 flex items-center justify-center text-sm shadow-inner disabled:opacity-40 disabled:cursor-not-allowed" title={canEdit ? 'Edit Akun & Password' : 'Dikunci — Mode Read-Only'}>{canEdit ? '✏️' : <Lock className="w-3.5 h-3.5" />}</button>
                      <button disabled={!canEdit} onClick={() => { if (!canEdit) return; setShowPasswordModal(guru); setNewPassInput(plainPass); }} className="w-9 h-9 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl transition-all border border-amber-500/20 flex items-center justify-center text-sm shadow-inner disabled:opacity-40 disabled:cursor-not-allowed" title={canEdit ? 'Lihat / Ganti / Reset Password' : 'Dikunci — Mode Read-Only'}>{canEdit ? '🔑' : <Lock className="w-3.5 h-3.5" />}</button>
                      <button disabled={!canEdit} onClick={() => canEdit && setConfirmModal({ type: 'DELETE', id: guru.id, name: guru.nama })} className="w-9 h-9 bg-slate-100 dark:bg-white/[0.03] hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:hover:text-rose-500 rounded-xl transition-all border border-slate-200 dark:border-white/5 flex items-center justify-center text-sm shadow-inner disabled:opacity-40 disabled:cursor-not-allowed" title={canEdit ? 'Hapus User' : 'Dikunci — Mode Read-Only'}>{canEdit ? '🗑️' : <Lock className="w-3.5 h-3.5" />}</button>
                    </div>
                  </td>
                </tr>
              )}) : (
                <tr>
                  <td colSpan={7} className="px-10 py-24 text-center">
                    <div className="text-6xl mb-8 grayscale opacity-10">🌑</div>
                    <div className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Database Pengajar Kosong / Tidak Ditemukan</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Workload Predictor Banner */}
        <div className="px-10 py-6 bg-indigo-600 text-white flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
              <div className="p-2 bg-white/20 rounded-xl"><Award className="w-5 h-5" /></div>
              <div>
                 <div className="text-[10px] font-black uppercase tracking-widest opacity-80">AI Workload Predictor</div>
                 <div className="text-xs font-bold">
                    {data.some(g => g.score > 150) 
                       ? "Peringatan: Beban kerja beberapa guru sudah mencapai ambang batas (High Load)."
                       : "Kabar Baik: Distribusi beban kerja pengajar saat ini terpantau stabil."}
                 </div>
              </div>
           </div>
           <div className="text-[10px] font-black uppercase tracking-widest border border-white/30 px-4 py-2 rounded-xl lg:backdrop-blur-sm">
              Status: Optimized
           </div>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-10 py-6 border-t border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.01] flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em]">
              Menampilkan <span className="text-indigo-600 dark:text-indigo-500 mx-1">{paginatedData.length}</span> dari <span className="text-indigo-600 dark:text-indigo-500 mx-1">{filteredData.length}</span> pengajar
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                ◀
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black transition-all shadow-sm ${currentPage === i + 1 ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah Guru */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 lg:backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 w-full max-w-md rounded-[3rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/10 blur-[80px] rounded-full -mr-20 -mt-20" />
            
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-10 flex items-center gap-4 relative z-10">
              <span className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 text-xl shadow-inner border border-indigo-500/10">➕</span>
              Tambah Guru
            </h2>
            
            <form onSubmit={handleAddGuru} className="space-y-6 relative z-10">
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Nama Lengkap</label>
                  <input required type="text" name="nama" className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner" placeholder="Contoh: Budi Santoso, S.Pd" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Username</label>
                  <input required type="text" name="username" className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner" placeholder="budis123" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Role User</label>
                  <select name="role" className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer shadow-inner">
                    <option value="GURU" className="bg-white dark:bg-[#0a0e1a]">GURU (Pengajar)</option>
                    <option value="ADMIN" className="bg-white dark:bg-[#0a0e1a]">ADMIN (Super User)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Password (Kosongkan = guru12345)</label>
                  <input type="text" name="password" defaultValue="guru12345" className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner" placeholder="Contoh: guru12345 (Min. 4 karakter)" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">URL Foto Profil (Opsional)</label>
                  <input type="text" name="profile_url" className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner" placeholder="https://link-foto.com/gambar.jpg" />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 shadow-inner">Batal</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Guru Modern */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 lg:backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 w-full max-w-2xl rounded-[3.5rem] p-10 sm:p-14 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full -mr-32 -mt-32" />
            
            <button onClick={() => setShowImportModal(false)} className="absolute top-10 right-10 w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-4">Import Data Guru</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Gunakan standar Excel modern (.xlsx) untuk mendaftarkan pengajar secara masal.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {/* Opsi 1: Download Template */}
              <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] p-8 rounded-[2.5rem] flex flex-col items-center text-center group hover:border-indigo-500/30 transition-all">
                <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="font-black text-slate-900 dark:text-white mb-2">Belum ada file?</h3>
                <p className="text-[10px] font-bold text-slate-500 mb-6 leading-relaxed">Download template Excel profesional yang sudah kami siapkan.</p>
                <button 
                  onClick={handleDownloadTemplate}
                  className="mt-auto w-full py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              {/* Opsi 2: Upload Area */}
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`bg-slate-50 dark:bg-white/[0.02] border-2 border-dashed p-8 rounded-[2.5rem] flex flex-col items-center text-center transition-all ${dragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-200 dark:border-white/10'}`}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white mb-1 truncate max-w-[150px]">{selectedFile.name}</h3>
                    <p className="text-[9px] font-bold text-slate-500 mb-6 uppercase tracking-widest">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <button onClick={() => setSelectedFile(null)} className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline">Ganti File</button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                      <UploadCloud className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white mb-2">Pilih File Excel</h3>
                    <p className="text-[10px] font-bold text-slate-500 mb-6 leading-relaxed">Drag & drop atau klik untuk memilih file dari komputer.</p>
                    <input type="file" className="hidden" id="excel-upload" accept=".xlsx,.xls" onChange={handleFileChange} />
                    <label 
                      htmlFor="excel-upload"
                      className="mt-auto w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
                    >
                      Pilih File
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl mb-12">
               <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
               <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                  Kolom <span className="text-indigo-600">username</span> dan <span className="text-indigo-600">nama</span> wajib diisi. Kolom <span className="text-indigo-600">password</span> boleh dikosongkan agar sistem mengisi password standar sekolah (<span className="font-mono font-black">guru12345</span>) secara otomatis.
               </p>
            </div>

            <button 
              disabled={!selectedFile || importing}
              onClick={processImport}
              className="w-full py-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
                  Memproses Data...
                </>
              ) : (
                'Mulai Import Sekarang'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal Edit Akun Lengkap (Nama, Username, Role, Password) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 lg:backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 w-full max-w-md rounded-[3rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/10 blur-[80px] rounded-full -mr-20 -mt-20" />
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter mb-8 flex items-center gap-4 relative z-10">
              <span className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 text-xl shadow-inner border border-indigo-500/10">✏️</span>
              Edit Akun & Password
            </h2>
            
            <form onSubmit={handleEditGuru} className="space-y-5 relative z-10">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Nama Lengkap</label>
                <input required type="text" name="nama" defaultValue={showEditModal.nama} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner" autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Username Login</label>
                <input required type="text" name="username" defaultValue={showEditModal.username} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Role Akses</label>
                <select name="role" defaultValue={showEditModal.role} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer shadow-inner">
                  <option value="GURU" className="bg-white dark:bg-[#0a0e1a]">GURU (Pengajar)</option>
                  <option value="ADMIN" className="bg-white dark:bg-[#0a0e1a]">ADMIN (Super User)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Password Saat Ini / Baru (Min. 4 Karakter)</label>
                <input required type="text" name="password" minLength={4} defaultValue={showEditModal.password_plain || (showEditModal.role === 'ADMIN' ? 'admin123' : 'guru12345')} className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-2xl px-5 py-3.5 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 transition-all shadow-inner" />
              </div>
              
              <div className="flex gap-4 pt-3">
                <button type="button" onClick={() => setShowEditModal(null)} className="flex-1 bg-slate-100 dark:bg-white/[0.03] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 shadow-inner">Batal</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola & Reset Password Cepat */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 lg:backdrop-blur-sm z-[120] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 w-full max-w-md rounded-[3rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-[80px] rounded-full -mr-20 -mt-20" />
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 text-xl border border-amber-500/20">🔑</span>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Kelola Password Guru</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{showPasswordModal.nama}</p>
                </div>
              </div>
              <button onClick={() => setShowPasswordModal(null)} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-6 space-y-2 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Username</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">{showPasswordModal.username}</span>
                  <button type="button" onClick={() => copyText(showPasswordModal.username, 'Username')} className="p-1 text-slate-400 hover:text-indigo-500"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password Aktif</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {showPasswordModal.password_plain || (showPasswordModal.role === 'ADMIN' ? 'admin123' : 'guru12345')}
                  </span>
                  <button type="button" onClick={() => copyText(showPasswordModal.password_plain || 'guru12345', 'Password')} className="p-1 text-slate-400 hover:text-emerald-500"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveCustomPassword} className="space-y-4 relative z-10">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Ubah ke Password Baru (Bebas, Min. 4 Karakter)</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Ketik password baru..."
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setNewPassInput('guru12345')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/10 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-white/10 transition-all"
                >
                  Set: guru12345
                </button>
                <button
                  type="button"
                  onClick={() => setNewPassInput(`${showPasswordModal.username.split('.')[0]}123`)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/10 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-white/10 transition-all"
                >
                  Set: {showPasswordModal.username.split('.')[0]}123
                </button>
                <button
                  type="button"
                  onClick={() => setNewPassInput('123456')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/10 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-white/10 transition-all"
                >
                  Set: 123456
                </button>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  disabled={savingPassword}
                  onClick={() => handleQuickResetDefault(showPasswordModal)}
                  className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                >
                  Reset (guru12345)
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20"
                >
                  {savingPassword ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Profile / Foto Profil Modern */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 lg:backdrop-blur-sm z-[120] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 blur-[80px] rounded-full -mr-24 -mt-24" />
            
            <div className="flex flex-col items-center mb-8 relative z-10">
              <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-5 shadow-inner overflow-hidden">
                {showProfileModal.profile_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={transformDriveLink(showProfileModal.profile_url)} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight text-center">{showProfileModal.nama}</h2>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-2">Update Identitas Visual</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6 relative z-10">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3 ml-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Link2 className="w-3 h-3" /> Foto Profil (Upload File / URL / Google Drive)
                  </label>
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 active:scale-95 transition-all">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const dataUrl = await compressImageFileToDataUrl(file, 220, 36000);
                          setShowProfileModal((prev: any) => prev ? { ...prev, profile_url: dataUrl } : prev);
                          toast.success('Foto siap disimpan! Klik Simpan Foto.');
                        } catch (err: any) {
                          toast.error(err.message || 'Gagal memproses foto.');
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea 
                  name="profile_url" 
                  value={showProfileModal.profile_url || ''}
                  onChange={(e) => setShowProfileModal((prev: any) => prev ? { ...prev, profile_url: e.target.value } : prev)}
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner min-h-[90px] resize-none" 
                  placeholder="Tempel link gambar dari Google Drive, website mana saja, atau klik Upload File..."
                />
              </div>

              <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-2xl">
                 <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                   💡 <span className="text-indigo-600 dark:text-indigo-400">Tips:</span> Gunakan link gambar publik agar foto muncul dengan sempurna di seluruh sistem.
                 </p>
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={() => setShowProfileModal(null)} className="flex-1 bg-slate-100 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5">Batal</button>
                <button 
                  disabled={updatingProfile}
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  {updatingProfile ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Simpan Foto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 lg:backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative overflow-hidden text-center">
            <div className={`w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center text-3xl shadow-inner ${confirmModal.type === 'DELETE' || confirmModal.type === 'BULK_DELETE' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
              {confirmModal.type === 'DELETE' || confirmModal.type === 'BULK_DELETE' ? <Trash2 className="w-10 h-10" /> : confirmModal.type === 'STATUS' ? <Activity className="w-10 h-10" /> : <KeyRound className="w-10 h-10" />}
            </div>
            
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              {confirmModal.type === 'DELETE' || confirmModal.type === 'BULK_DELETE' ? 'Hapus Pengajar?' : confirmModal.type === 'STATUS' ? 'Ubah Status?' : 'Reset Password?'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold leading-relaxed mb-10">
              Anda akan melakukan tindakan ini pada <span className="text-slate-900 dark:text-white font-black">{confirmModal.name}</span>. 
              {confirmModal.type === 'DELETE' || confirmModal.type === 'BULK_DELETE' ? ' Data yang dihapus tidak dapat dipulihkan kembali.' : confirmModal.type === 'RESET' || confirmModal.type === 'BULK_RESET' ? ' Password akan direset ke kata sandi standar sekolah (guru12345).' : ' Status akses akan segera diperbarui.'}
            </p>
            
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 bg-slate-100 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all border border-slate-200 dark:border-white/5 shadow-inner">Batal</button>
              <button 
                onClick={executeConfirmAction} 
                className={`flex-1 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg ${confirmModal.type === 'DELETE' || confirmModal.type === 'BULK_DELETE' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Guide & Tooltip (Desktop Only) */}
      <div className="hidden lg:block fixed bottom-10 right-10 z-40 group">
         <div className="bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 p-6 rounded-3xl shadow-2xl max-w-xs animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-3">
               <AlertCircle className="w-5 h-5 text-indigo-500" />
               <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Enterprise Hub</h4>
            </div>
            <div className="space-y-3">
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                   Gunakan <span className="text-indigo-600 dark:text-indigo-400 font-black">Import Guru (Pro)</span> untuk manajemen masal via Excel modern (.xlsx).
                </p>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-sm bg-indigo-600" />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">High Activity</span>
                   <div className="w-2 h-2 rounded-sm bg-slate-100 dark:bg-white/5" />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No Activity</span>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
}
