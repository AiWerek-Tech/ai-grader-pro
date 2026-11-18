'use client';

import { getSettingsAction, saveSettingsAction, backupDatabaseAction, restoreDatabaseAction, checkAIStatusAction } from '@/lib/actions/settings';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import Image from 'next/image';
import { 
  Settings2, School, GraduationCap, BrainCircuit, DatabaseZap, 
  Save, Download, Upload, ShieldCheck, RefreshCw, 
  Sparkles, FileText, Activity, AlertTriangle, Building2, 
  Clock, Target, Zap
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'academic' | 'ai' | 'backup'>('branding');
  const [activeJenjangTab, setActiveJenjangTab] = useState<'SMA'|'SMP'>('SMA');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [pendingRestore, setPendingRestore] = useState<{ fileName: string; data: any } | null>(null);

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement;
    if (target.name) {
      setSettings(prev => ({...prev, [target.name]: target.value}));
    }
  };

  const parseDriveUrl = (url: string) => {
    if (!url) return '';
    // Handle typical Google Drive sharing links
    const idMatch = url.match(/\/d\/([^\/?]+)/) || url.match(/id=([^\/?&]+)/);
    if (idMatch && idMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
    return url;
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await getSettingsAction();
      if (res.success) {
        const data = res.data || {};
        setSettings(data);
        const currentModel = data['ai_model'];
        const knownModels = [
          'gemini-2.5-flash',
          'gemini-3.5-flash',
          'gemini-3.5-flash-lite',
          'gemini-3-flash-preview',
          'gemini-2.5-pro',
          'gemini-3.8-flash',
          'gemini-2.0-flash',
          'gemini-1.5-flash',
          'gemini-3.1-pro-preview',
          'gemini-1.5-pro'
        ];
        if (currentModel && !knownModels.includes(currentModel)) {
          setIsCustomModel(true);
          setCustomModelInput(currentModel);
        }
      }
      else toast.error(res.message || 'Gagal memuat pengaturan');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const updates: Record<string, string> = {};
    formData.forEach((value, key) => { updates[key] = value.toString(); });

    // Ensure checkboxes are captured even if unchecked (browsers omit unchecked checkboxes from FormData)
    if (activeTab === 'academic') {
      updates['auto_sync'] = formData.get('auto_sync') ? 'true' : 'false';
    }

    try {
      const res = await saveSettingsAction(updates);
      if (res.success) {
        toast.success('Pengaturan sistem berhasil diperbarui!');
        fetchSettings();
      } else {
        toast.error('Gagal: ' + res.message);
      }
    } catch (err: any) {
      toast.error('Kesalahan sistem: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    try {
      const res = await checkAIStatusAction();
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    } catch (e: any) {
      toast.error('Gagal melakukan tes koneksi AI: ' + e.message);
    } finally {
      setTestingAI(false);
    }
  };

  const handleBackup = async () => {
    toast.loading('Menyiapkan file backup...', { id: 'backup-toast' });
    try {
      const res = await backupDatabaseAction();
      if (res.success) {
        const dataStr = JSON.stringify(res.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', res.filename || 'wmvaa_backup.json');
        linkElement.click();
        toast.success('Backup database berhasil diunduh!', { id: 'backup-toast' });
      } else {
        toast.error('Backup gagal: ' + res.message, { id: 'backup-toast' });
      }
    } catch (e: any) {
      toast.error('Koneksi terputus saat backup: ' + e.message, { id: 'backup-toast' });
    }
  };

  const handleRestore = async (jsonData: any) => {
    toast.loading('Memulihkan database, harap tunggu...', { id: 'restore-toast' });
    try {
      const res = await restoreDatabaseAction(jsonData);
      if (res.success) {
        toast.success('Database berhasil dipulihkan secara penuh!', { id: 'restore-toast' });
        fetchSettings();
      } else {
        toast.error('Restorasi gagal: ' + res.message, { id: 'restore-toast' });
      }
    } catch (e: any) {
      toast.error('Kesalahan saat restorasi: ' + e.message, { id: 'restore-toast' });
    }
  };

  // ─── Render Loading ───
  if (loading) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
        <Settings2 className="w-16 h-16 text-indigo-500 animate-[spin_3s_linear_infinite] relative z-10" />
      </div>
      <div>
        <p className="text-slate-900 dark:text-white font-black text-lg tracking-tight">Menghubungkan ke Pusat Konfigurasi</p>
        <p className="text-slate-500 font-medium text-xs mt-1 animate-pulse">Sinkronisasi data dari server...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 sm:p-10 max-w-[1600px] mx-auto space-y-10 fade-in">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-4">
            <span className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-[1.5rem] shadow-inner border border-indigo-500/10 dark:border-indigo-500/20">
              <Settings2 className="w-7 h-7 text-indigo-500" />
            </span>
            Konfigurasi Sistem
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 font-semibold text-sm max-w-xl">
            Pusat kendali aplikasi. Sesuaikan identitas instansi, kalender akademik, integrasi engine kecerdasan buatan (AI), dan manajemen database.
          </p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-wrap gap-2 p-2 bg-white dark:bg-[#0a0e1a]/90 lg:dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-2xl sm:rounded-[1.5rem] w-full sm:w-fit shadow-sm transition-colors">
        {[
          { id: 'branding', label: 'Identitas Sekolah', icon: <School className="w-4 h-4" /> },
          { id: 'academic', label: 'Info Akademik', icon: <GraduationCap className="w-4 h-4" /> },
          { id: 'ai',       label: 'AI Engine', icon: <BrainCircuit className="w-4 h-4" /> },
          { id: 'backup',   label: 'Data & Recovery', icon: <DatabaseZap className="w-4 h-4" /> },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-7 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all duration-300 ${
              activeTab === tab.id 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-indigo-500/50' 
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT: TAB BRANDING ── */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-[2.5rem] p-8 sm:p-12 shadow-sm dark:shadow-2xl relative overflow-hidden transition-all duration-500 animate-in slide-in-from-bottom-4">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
          
          <form onSubmit={handleSubmit} onChange={handleFormChange} className="space-y-12 relative z-10">
            {/* Identitas Shared */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                <Building2 className="w-4 h-4 text-indigo-400" /> Identitas Yayasan & Lokasi
                <span className="w-full h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Nama Yayasan</label>
                   <input type="text" name="nama_yayasan" defaultValue={settings['nama_yayasan'] || ''} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium placeholder:text-slate-400" placeholder="Cth: Yayasan Pendidikan Indonesia..." />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Alamat Lengkap (Kop Surat)</label>
                   <input type="text" name="alamat_sekolah" defaultValue={settings['alamat_sekolah'] || ''} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-medium placeholder:text-slate-400" placeholder="Cth: Jl. Merdeka No. 123, Kota..." />
                 </div>
              </div>
            </div>

            {/* Jenjang Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8 border-t border-slate-100 dark:border-white/[0.05]">
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4 mb-4">
                   <FileText className="w-4 h-4 text-indigo-400" /> Detail Kop Per Jenjang
                 </h3>
                 
                 <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/[0.03] rounded-2xl w-full">
                   {(['SMA', 'SMP'] as const).map(j => (
                     <button 
                       key={j} type="button" 
                       onClick={() => setActiveJenjangTab(j)} 
                       className={`flex-1 py-3 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 ${
                         activeJenjangTab === j 
                         ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-white/10' 
                         : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                       }`}
                     >
                       <School className="w-3.5 h-3.5" /> Kop {j}
                     </button>
                   ))}
                 </div>

                 <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Baris 1 — Nama Resmi Sekolah</label>
                      <input type="text" name={`${activeJenjangTab.toLowerCase()}_nama_sekolah_1`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_nama_sekolah_1`] || ''} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-xl px-5 py-3.5 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" placeholder={`Cth: SMA NEGERI 1 JAKARTA`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Baris 2 — Nama Populer / Singkatan</label>
                      <input type="text" name={`${activeJenjangTab.toLowerCase()}_nama_sekolah_2`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_nama_sekolah_2`] || ''} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-xl px-5 py-3.5 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" placeholder={`Cth: SMANSA JAKARTA`} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Logo Kiri (Drive URL)</label>
                          <input type="url" name={`${activeJenjangTab.toLowerCase()}_logo_kiri_url`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_logo_kiri_url`] || ''} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-xl px-5 py-3.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" placeholder="https://drive.google.com/..." />
                       </div>
                       <div>
                          <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Logo Kanan (Drive URL)</label>
                          <input type="url" name={`${activeJenjangTab.toLowerCase()}_logo_kanan_url`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_logo_kanan_url`] || ''} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-xl px-5 py-3.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" placeholder="Opsional jika ada logo 2..." />
                       </div>
                    </div>

                    <div className="pt-6 grid grid-cols-2 gap-6">
                       <div className="bg-slate-50 dark:bg-[#0d1326] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.05]">
                          <label className="block text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Sparkles className="w-3 h-3"/> TTD Kepala Sekolah</label>
                          <input type="text" placeholder="Nama Beserta Gelar" name={`${activeJenjangTab.toLowerCase()}_kepala_nama`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_kepala_nama`] || ''} className="w-full mb-2 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-[11px] font-bold focus:outline-none focus:border-indigo-500/30 transition-all placeholder:font-normal placeholder:text-slate-400" />
                          <input type="text" placeholder="NIP / NRG" name={`${activeJenjangTab.toLowerCase()}_kepala_nip`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_kepala_nip`] || ''} className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-[11px] font-mono mt-2 focus:outline-none focus:border-indigo-500/30 transition-all placeholder:font-normal placeholder:font-sans placeholder:text-slate-400" />
                       </div>
                       <div className="bg-slate-50 dark:bg-[#0d1326] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.05]">
                          <label className="block text-[9px] font-black text-sky-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Sparkles className="w-3 h-3"/> TTD Ketua Panitia</label>
                          <input type="text" placeholder="Nama Beserta Gelar" name={`${activeJenjangTab.toLowerCase()}_panitia_nama`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_panitia_nama`] || ''} className="w-full mb-2 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-[11px] font-bold focus:outline-none focus:border-sky-500/30 transition-all placeholder:font-normal placeholder:text-slate-400" />
                          <input type="text" placeholder="NIP / NRG" name={`${activeJenjangTab.toLowerCase()}_panitia_nip`} defaultValue={settings[`${activeJenjangTab.toLowerCase()}_panitia_nip`] || ''} className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-[11px] font-mono mt-2 focus:outline-none focus:border-sky-500/30 transition-all placeholder:font-normal placeholder:font-sans placeholder:text-slate-400" />
                       </div>
                    </div>
                 </div>
              </div>

              {/* LIVE PREVIEW BOX */}
              <div className="relative">
                 <div className="sticky top-10 w-full p-8 rounded-[2rem] bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] shadow-inner transition-colors">
                    <h4 className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center mb-6">
                      <Activity className="w-4 h-4 text-emerald-500" /> Live Render: Kop Cetakan LJK ({activeJenjangTab})
                    </h4>
                    
                    {/* Simulated Paper Render */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300 font-serif text-center relative overflow-hidden w-full aspect-[4/2] flex flex-col justify-start select-none transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                       <div className="flex items-start justify-between gap-4 border-b-[3px] border-double border-black pb-4 w-full h-fit">
                          {/* Logo Kiri */}
                          <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                            {settings[`${activeJenjangTab.toLowerCase()}_logo_kiri_url`] 
                              ? <Image src={parseDriveUrl(settings[`${activeJenjangTab.toLowerCase()}_logo_kiri_url`])} alt="Logo" width={64} height={64} className="max-w-full max-h-full object-contain" /> 
                              : <div className="w-12 h-12 border-2 border-dashed border-slate-300 rounded flex items-center justify-center"><School className="w-5 h-5 text-slate-300"/></div>
                            }
                          </div>
                          
                          {/* Text Center */}
                          <div className="flex-1 flex flex-col justify-center items-center h-full pt-1">
                            <div className="text-[10px] font-bold text-slate-950 uppercase leading-tight tracking-[0.05em]">{settings['nama_yayasan'] || 'NAMA YAYASAN'}</div>
                            <div className="text-sm font-black text-slate-950 uppercase leading-tight tracking-wider my-0.5">{settings[`${activeJenjangTab.toLowerCase()}_nama_sekolah_1`] || 'NAMA RESMI SEKOLAH'}</div>
                            <div className="text-xl font-black text-black uppercase leading-tight tracking-wider">{settings[`${activeJenjangTab.toLowerCase()}_nama_sekolah_2`] || 'SINGKATAN / POPULER'}</div>
                            <div className="text-[9px] text-slate-800 leading-tight mt-1 opacity-90">{settings['alamat_sekolah'] || 'Jalan Raya Pendidikan No. 123, Kota Anda'}</div>
                          </div>
                          
                          {/* Logo Kanan */}
                          <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                            {settings[`${activeJenjangTab.toLowerCase()}_logo_kanan_url`] 
                              ? <Image src={parseDriveUrl(settings[`${activeJenjangTab.toLowerCase()}_logo_kanan_url`])} alt="Logo" width={64} height={64} className="max-w-full max-h-full object-contain" /> 
                              : <div className="w-12 h-12 border-2 border-dashed border-slate-100 rounded flex items-center justify-center opacity-50"><School className="w-4 h-4 text-slate-200"/></div>
                            }
                          </div>
                       </div>
                       
                       {/* Mock Signatures */}
                       <div className="mt-8 flex justify-between px-6 opacity-80 mix-blend-multiply">
                          <div className="flex flex-col items-center gap-8">
                            <div className="text-[9px] font-semibold text-black">Ketua Panitia Ujian</div>
                            <div className="text-center">
                              <div className="text-[10px] font-bold text-black border-b border-black inline-block py-0.5 min-w-[120px]">{settings[`${activeJenjangTab.toLowerCase()}_panitia_nama`] || 'Nama Ketua Panitia, M.Pd'}</div>
                              <div className="text-[8px] text-black mt-1 font-sans">NIP. {settings[`${activeJenjangTab.toLowerCase()}_panitia_nip`] || '19800101 200501 1 001'}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-8">
                            <div className="text-[9px] font-semibold text-black">Kepala Sekolah</div>
                            <div className="text-center">
                              <div className="text-[10px] font-bold text-black border-b border-black inline-block py-0.5 min-w-[120px]">{settings[`${activeJenjangTab.toLowerCase()}_kepala_nama`] || 'Nama Kepala Sekolah, S.Pd'}</div>
                              <div className="text-[8px] text-black mt-1 font-sans">NIP. {settings[`${activeJenjangTab.toLowerCase()}_kepala_nip`] || '19750101 200001 1 002'}</div>
                            </div>
                          </div>
                       </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium text-center mt-5">Semua data secara live dimasukkan dari form pengaturan. Pastikan tampilan rapi.</p>
                 </div>
              </div>
            </div>

            <div className="pt-10 border-t border-slate-100 dark:border-white/[0.05] flex justify-end">
              <button disabled={saving} type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-12 py-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Menyimpan...' : 'Simpan Identitas Sekolah'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONTENT: TAB ACADEMIC ── */}
      {activeTab === 'academic' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-[2.5rem] p-8 sm:p-12 shadow-sm dark:shadow-2xl relative overflow-hidden transition-all duration-500 animate-in slide-in-from-bottom-4">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
          
          <form onSubmit={handleSubmit} className="space-y-12 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <Clock className="w-4 h-4 text-emerald-400" /> Sesi Akademik Aktif
                  <span className="w-full h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Tahun Pelajaran</label>
                    <input type="text" name="tahun_ajaran" placeholder="Contoh: 2025/2026" defaultValue={settings['tahun_ajaran']} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-base font-bold focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Semester Yang Berjalan</label>
                    <select name="semester" defaultValue={settings['semester']} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-2xl px-6 py-4 text-slate-900 dark:text-white text-base font-bold focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer">
                      <option value="GANJIL">SEMESTER GANJIL (GSL)</option>
                      <option value="GENAP">SEMESTER GENAP (GNP)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <Target className="w-4 h-4 text-amber-400" /> Parameter Kelulusan Minimal
                  <span className="w-full h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] p-5 rounded-2xl">
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 text-center">Batas KKM Eksakta</label>
                      <input type="number" name="kkm_eksakta" defaultValue={settings['kkm_eksakta'] || '65'} className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-xl px-4 py-3 text-emerald-600 dark:text-emerald-400 text-2xl font-black text-center focus:outline-none focus:border-amber-500/50 transition-all shadow-sm" />
                    </div>
                    <div className="bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] p-5 rounded-2xl">
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 text-center">Batas KKM Umum</label>
                      <input type="number" name="kkm_non_eksakta" defaultValue={settings['kkm_non_eksakta'] || '70'} className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-xl px-4 py-3 text-sky-600 dark:text-sky-400 text-2xl font-black text-center focus:outline-none focus:border-amber-500/50 transition-all shadow-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Kategori Auto-Deteksi Eksakta</label>
                    <input type="text" name="mapel_eksakta_keywords" placeholder="Matematika, Fisika, Kimia, Biologi, IPA..." defaultValue={settings['mapel_eksakta_keywords']} className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.05] rounded-xl px-6 py-4 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-slate-400" />
                    <p className="text-[9px] text-slate-500 mt-2 font-medium flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-500"/> Pisahkan nama mapel dengan tanda koma (,). Sistem menggunakan ini untuk menetapkan KKM spesifik saat menampilkan hasil.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-slate-100 dark:border-white/[0.05]">
              <div className="space-y-8">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                  <Zap className="w-4 h-4 text-violet-400" /> Scanner & Automation Engine
                  <span className="w-full h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 flex justify-between items-center">
                      <span>Batas Anomali Kepercayaan AI (Confidence)</span>
                      <span className="text-violet-500">{settings['min_confidence'] || '60'}%</span>
                    </label>
                    <input type="range" min="10" max="100" name="min_confidence" defaultValue={settings['min_confidence'] || '60'} className="w-full accent-violet-500" onChange={(e) => { e.currentTarget.previousElementSibling!.lastElementChild!.textContent = `${e.currentTarget.value}%`; }} />
                    <p className="text-[9px] text-slate-500 font-medium mt-2">Nilai LJK yang diyakini AI di bawah prsentase ini akan ditandai dengan peringatan wajib *Review Manual* di tabel analisis.</p>
                  </div>
                  
                  <label className="flex items-start gap-4 p-5 rounded-2xl bg-violet-50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/20 cursor-pointer transition-colors hover:bg-violet-100 dark:hover:bg-violet-500/10">
                    <input type="checkbox" name="auto_sync" defaultChecked={settings['auto_sync'] === 'true'} className="w-5 h-5 mt-0.5 rounded shadow-sm text-violet-600 focus:ring-violet-500 bg-white border-slate-300" />
                    <div>
                      <div className="text-[11px] font-black text-violet-700 dark:text-violet-400 uppercase tracking-widest">Sinkronisasi Server Otomatis (Auto Sync)</div>
                      <div className="text-[10px] text-violet-600/70 dark:text-violet-400/60 font-medium mt-1">Mengizinkan modul LJK & Kunci mengirim pembaruan diam-diam ke Database pusat (Google Spreadsheet) di background.</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-slate-100 dark:border-white/[0.05] flex justify-end">
              <button disabled={saving} type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-12 py-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Menyimpan...' : 'Simpan Parameter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONTENT: TAB AI ── */}
      {activeTab === 'ai' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-[2.5rem] p-8 sm:p-12 shadow-sm dark:shadow-2xl relative overflow-hidden transition-all duration-500 animate-in slide-in-from-bottom-4">
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
          
          <form onSubmit={handleSubmit} className="space-y-12 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                    <BrainCircuit className="w-4 h-4 text-sky-400" /> Neural Architecture
                    <span className="w-full h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                  </h3>
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-[#0d1326] p-6 rounded-2xl border border-slate-200 dark:border-white/[0.05]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Model Visi Utama (LLM)</label>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Model Gemini untuk koreksi LJK & pembacaan visual</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleTestAI} 
                        disabled={testingAI}
                        className="px-4 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[9px] font-black uppercase tracking-widest border border-sky-500/20 transition-all flex items-center gap-2"
                      >
                        {testingAI ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        Ping API
                      </button>
                    </div>
                    
                    {!isCustomModel ? (
                      <div className="space-y-3">
                        <select 
                          name="ai_model" 
                          value={settings['ai_model'] || 'gemini-3-flash-preview'} 
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setIsCustomModel(true);
                              setCustomModelInput(settings['ai_model'] || '');
                            } else {
                              setSettings(prev => ({ ...prev, ai_model: e.target.value }));
                            }
                          }}
                          className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-xl px-5 py-4 text-slate-900 dark:text-white font-bold text-sm focus:outline-none focus:border-sky-500/50 transition-all shadow-sm"
                        >
                          <optgroup label="Model Produksi Berkecepatan Tinggi (Rekomendasi)">
                            <option value="gemini-3-flash-preview">🎯 Gemini 3 Flash Preview (Akurasi Spasial OMR 100% [40/40] - REKOMENDASI UTAMA)</option>
                            <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Cepat & Stabil)</option>
                            <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Cadangan Cepat)</option>
                          </optgroup>
                          <optgroup label="Model Penalaran Kompleks (Pro Series)">
                            <option value="gemini-3.1-pro-preview">🧠 Gemini 3.1 Pro Preview (Akurasi Penalaran Ekstrem & Esai Mendalam)</option>
                          </optgroup>
                          <optgroup label="Model Lainnya / Eksperimental">
                            <option value="gemini-3.8-flash">⚡ Gemini 3.8 Flash (High Demand Experimental)</option>
                            <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Legacy)</option>
                            <option value="gemini-1.5-flash">⚡ Gemini 1.5 Flash (Legacy)</option>
                          </optgroup>
                          <optgroup label="Opsi Kustom">
                            <option value="__custom__">✏️ Ketik Nama Model Kustom Sendiri...</option>
                          </optgroup>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            name="ai_model" 
                            value={customModelInput}
                            onChange={(e) => {
                              setCustomModelInput(e.target.value);
                              setSettings(prev => ({ ...prev, ai_model: e.target.value }));
                            }}
                            placeholder="Contoh: gemini-2.5-flash" 
                            className="flex-1 bg-white dark:bg-[#0a0e1a] border border-sky-500/50 rounded-xl px-5 py-3 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomModel(false);
                              setSettings(prev => ({ ...prev, ai_model: 'gemini-2.5-flash' }));
                            }}
                            className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            Pilihan Preset
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400">Ketik ID model persis seperti yang tertera di Google AI Studio.</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-[#0d1326] p-6 rounded-2xl border border-slate-200 dark:border-white/[0.05]">
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Kreativitas vs Presisi (Temp)</label>
                      <span className="text-sky-500 font-mono text-sm font-black">{settings['ai_temperature'] || '0.1'}</span>
                    </div>
                    <input type="range" name="ai_temperature" min="0" max="1" step="0.1" defaultValue={settings['ai_temperature'] || '0.1'} className="w-full accent-sky-500" onChange={(e) => { e.currentTarget.previousElementSibling!.lastElementChild!.textContent = e.currentTarget.value; }} />
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                      <span>Exact (0.0)</span>
                      <span>Balanced (0.5)</span>
                      <span>Creative (1.0)</span>
                    </div>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">Berdasarkan riset OMR Scanning AI, nilai temperature yang direkomendasikan adalah **0.1 - 0.2**. Angka yang tinggi berpotensi membuat AI berhalusinasi melihat jawaban yang salah.</p>
                  </div>

                  {/* Multi-API Key Rotation Pool (Anti-Rate-Limit) */}
                  <div className="bg-slate-50 dark:bg-[#0d1326] p-6 rounded-2xl border border-slate-200 dark:border-white/[0.05]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Pool Rotasi API Key Cadangan (Anti-Limit)</label>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Opsional: Masukkan 1 atau beberapa Gemini API Key tambahan (pisahkan dengan baris baru/koma) untuk rotasi otomatis saat banyak guru scan bersamaan.</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest shrink-0">
                        Round-Robin
                      </span>
                    </div>
                    <textarea
                      name="ai_api_keys_pool"
                      value={settings['ai_api_keys_pool'] || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, ai_api_keys_pool: e.target.value }))}
                      rows={3}
                      placeholder="AIzaSy... (Key Cadangan 1)&#10;AIzaSy... (Key Cadangan 2)"
                      className="w-full mt-2 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/[0.1] rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all"
                    />
                    <p className="text-[9px] text-slate-400 mt-2">
                      Jika dikosongkan, sistem tetap menggunakan <code>GEMINI_API_KEY</code> utama dari <code>.env.local</code>.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                 <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4">
                    <Sparkles className="w-4 h-4 text-sky-400" /> Prompt Injection Variables
                    <span className="w-full h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                 </h3>
                 <div className="p-6 rounded-[1.5rem] bg-sky-50 dark:bg-sky-500/5 border border-sky-100 dark:border-sky-500/10">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                       Untuk memaksimalkan pembacaan gambar LJK, AI harus diberikan konteks spesifik. 
                       <br/><br/>
                       Gunakan tag mustache berikut di dalam form <b>System Instructions</b> yang akan otomatis diganti saat runtime eksekusi Grader:
                    </p>
                    <div className="mt-4 space-y-2">
                       <div className="flex items-center gap-3"><code className="bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 px-2 py-1 rounded text-[10px] font-black">{"{{totalSoal}}"}</code> <span className="text-[10px] text-slate-500">= Menghitung total soal dari Kunci Ujian</span></div>
                       <div className="flex items-center gap-3"><code className="bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 px-2 py-1 rounded text-[10px] font-black">{"{{questionBlueprint}}"}</code> <span className="text-[10px] text-slate-500">= Daftar rincian tipe soal AKM per butir</span></div>
                       <div className="flex items-center gap-3"><code className="bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 px-2 py-1 rounded text-[10px] font-black">{"{{retryIndex}}"}</code> <span className="text-[10px] text-slate-500">= Deteksi looping fallback algoritma</span></div>
                       <div className="flex items-center gap-3"><code className="bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 px-2 py-1 rounded text-[10px] font-black">{"{{siswaInfo}}"}</code> <span className="text-[10px] text-slate-500">= Metrik dataset OCR nama &amp; NIS murid</span></div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-1">Master Prompt Payload (System Instructions)</label>
                <button
                  type="button"
                  onClick={() => {
                    const defaultPrompt =
                      "Role: SISTEM KOREKSI LJK (Lembar Jawaban Komputer) ULTRA-AKURAT - WMVAA AI Grader Enterprise Vision Engine V5.\n" +
                      "Task: Mengekstraksi identitas siswa dan seluruh jawaban soal secara presisi dari citra LJK fisik (Citra 1 = Lembar LJK Utuh, Citra 2 = Zoom Area Jawaban).\n\n" +
                      "=== PROTOKOL PENALARAN VISUAL & TATA LETAK LJK ===\n" +
                      "1. ORIENTASI & KALIBRASI SPASIAL:\n" +
                      "   - Deteksi 4 Fiducial Marker (kotak hitam konsentris) di keempat sudut lembar kertas sebagai patokan batas dokumen.\n" +
                      "   - Kompensasikan kemiringan sudut (skew/rotation), perspektif kamera ponsel, atau bayangan tangan secara visual.\n\n" +
                      "2. BLOK IDENTITAS PESERTA (KIRI ATAS) & QR ANCHOR (KANAN ATAS):\n" +
                      "   - Baca kolom 'NAMA PESERTA': Transkrip nama lengkap siswa.\n" +
                      "   - Baca 'NIS / NO. PESERTA' di kotak identitas ATAU di bawah QR Code kanan atas.\n\n" +
                      "3. ATURAN KRITIS DETEKSI POSISI BULATAN (ANTI-JEBAKAN HURUF TERTUTUP TINTA):\n" +
                      "   - Setiap bulatan kosong pada LJK memiliki huruf tercetak tipis (A, B, C, D, E atau B, S) di tengahnya.\n" +
                      "   - Ketika siswa MENGHITAMKAN bulatan (●) atau MEMBERI TANDA SILANG (X) pada pilihannya (misalnya memilih A di bulatan paling kiri), huruf 'A' di dalam bulatan pertama tersebut akan TERTUTUP TINTA GELAP / SILANG, sedangkan huruf 'B', 'C', 'D' di sebelahnya tetap terlihat jelas di dalam lingkaran putih kosong!\n" +
                      "   - JANGAN PERNAH memilih huruf yang masih terlihat bersih di bulatan kosong! Bulatan yang dipilih siswa adalah bulatan yang GELAP TERISI TINTA/PENSIL atau TERTIMPA TANDA SILANG (X)!\n" +
                      "   - Untuk setiap nomor soal, amati deretan bulatan dari KIRI ke KANAN pada baris nomor tersebut dan tentukan urutan posisinya (field 'pos'):\n" +
                      "     * Bulatan ke-1 (paling kiri) dihitamkan/disilang -> 'pos': 1 -> 'ans': 'A' (atau 'B' pada soal Benar/Salah).\n" +
                      "     * Bulatan ke-2 dari kiri dihitamkan/disilang -> 'pos': 2 -> 'ans': 'B' (atau 'S' pada soal Benar/Salah).\n" +
                      "     * Bulatan ke-3 dari kiri dihitamkan/disilang -> 'pos': 3 -> 'ans': 'C'.\n" +
                      "     * Bulatan ke-4 dari kiri dihitamkan/disilang -> 'pos': 4 -> 'ans': 'D'.\n" +
                      "     * Bulatan ke-5 (paling kanan pada PG 5 opsi) dihitamkan/disilang -> 'pos': 5 -> 'ans': 'E'.\n" +
                      "     * Jika semua bulatan pada baris tersebut kosong -> 'pos': 0 -> 'ans': '?'.\n" +
                      "     * Bulatan dengan coretan horizontal ganda (==) dianggap BATAL -> abaikan.\n\n" +
                      "=== ATURAN FORMAT OUTPUT JSON (MURNI TANPA MARKDOWN/BACKTICK) ===\n" +
                      "Kembalikan HANYA objek JSON valid berikut:\n" +
                      "{\n" +
                      "  \"name\": \"NAMA SISWA LENGKAP\",\n" +
                      "  \"nis\": \"NIS JIKA TERTERA\",\n" +
                      "  \"id_siswa\": \"\",\n" +
                      "  \"answers\": [\n" +
                      "    { \"no\": 1, \"pos\": 1, \"ans\": \"A\" },\n" +
                      "    { \"no\": 2, \"pos\": 3, \"ans\": \"C\" }\n" +
                      "  ],\n" +
                      "  \"confidence\": 92\n" +
                      "}\n" +
                      "PENTING:\n" +
                      "- Array 'answers' harus berisi TEPAT {{totalSoal}} item bernomor 1 sampai {{totalSoal}}.\n" +
                      "- Field 'pos' wajib diisi nomor urut bulatan dari kiri (1..5, atau 0 jika kosong) sebelum menentukan 'ans'.\n" +
                      "{{questionBlueprint}}";
                    setSettings(prev => ({ ...prev, ai_system_prompt: defaultPrompt }));
                    toast.info('Master Prompt dikembalikan ke standar V5 Positional OMR. Klik Simpan Algoritma AI untuk menerapkan.');
                  }}
                  className="text-[10px] font-black text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Reset ke Default V5
                </button>
              </div>
              <div className="relative group rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/[0.05] focus-within:border-sky-500/50 focus-within:ring-4 focus-within:ring-sky-500/10 transition-all shadow-inner bg-slate-50 dark:bg-black/40">
                <textarea 
                  name="ai_system_prompt" 
                  value={settings['ai_system_prompt'] || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, ai_system_prompt: e.target.value }))}
                  className="w-full bg-transparent p-8 text-sky-700 dark:text-sky-300 text-[11px] font-mono leading-relaxed h-[450px] focus:outline-none resize-none custom-scroll"
                  placeholder="Anda adalah AI ahli yang bertugas memeriksa LJK..."
                />
              </div>
            </div>

            <div className="pt-10 border-t border-slate-100 dark:border-white/[0.05] flex justify-end">
              <button disabled={saving} type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-black px-12 py-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-sky-500/20 active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Kompilasi Prompt...' : 'Simpan Algoritma AI'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONTENT: TAB BACKUP / RECOVERY ── */}
      {activeTab === 'backup' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-[3rem] p-12 sm:p-20 text-center space-y-12 shadow-sm dark:shadow-2xl relative overflow-hidden transition-all animate-in slide-in-from-bottom-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-rose-500/5 blur-[120px] rounded-full -mt-64 pointer-events-none" />
          
          <div className="max-w-xl mx-auto relative z-10">
            <div className="relative w-32 h-32 mx-auto mb-10">
              <div className="absolute inset-0 bg-rose-500/20 rounded-[3rem] rotate-12" />
              <div className="absolute inset-0 bg-slate-900 border border-white/10 rounded-[3rem] flex items-center justify-center shadow-xl">
                <ShieldCheck className="w-16 h-16 text-rose-500" />
              </div>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Disaster Recovery</h3>
            <p className="text-slate-500 mt-6 font-medium text-sm leading-relaxed max-w-md mx-auto">
              Fitur penyelamatan data. Lakukan eksport manual seluruh database institusi ke dalam format <code className="text-rose-500 font-bold bg-rose-50 dark:bg-rose-500/10 px-1 rounded">JSON</code> untuk persiapan perpindahan server atau recovery total.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6 relative z-10 pt-4">
            <button 
              onClick={handleBackup} 
              className="group flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white p-8 rounded-3xl transition-all border border-slate-200 dark:border-white/5 shadow-sm min-w-[280px]"
            >
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/20 transition-all">
                <Download className="w-7 h-7 text-indigo-500" />
              </div>
              <div className="text-center">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] mb-1">Backup Database</div>
                <div className="text-[10px] text-slate-500 font-medium">Unduh file .json terstruktur</div>
              </div>
            </button>
            
            <label className="group cursor-pointer flex flex-col items-center justify-center gap-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 p-8 rounded-3xl transition-all border border-rose-500/20 shadow-sm min-w-[280px]">
               <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#0a0e1a] border border-rose-100 dark:border-rose-500/30 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all text-rose-500">
                <Upload className="w-7 h-7" />
               </div>
               <div className="text-center">
                 <div className="text-[11px] font-black uppercase tracking-[0.2em] mb-1">Restore Database</div>
                 <div className="text-[10px] font-medium opacity-80">Timpa seluruh sistem aktif saat ini</div>
               </div>
               <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (file.type !== 'application/json' && !file.name.endsWith('.json')) { toast.error('Hanya format file .json yang diterima!'); return; }
                  
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                     try {
                        const data = JSON.parse(event.target?.result as string);
                        setPendingRestore({ fileName: file.name, data });
                     } catch { toast.error('Gagal memproses file! JSON corrupt.'); }
                  };
                  reader.readAsText(file);
               }} />
            </label>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingRestore)}
        title="Restore Database Live?"
        description={
          pendingRestore
            ? `TINDAKAN BERBAHAYA!\nSeluruh data siswa, kelas, guru, mapel, dan hasil ujian yang sedang LIVE akan ditimpa oleh isi file [${pendingRestore.fileName}].`
            : ''
        }
        confirmText="Ya, Timpa & Restore"
        variant="danger"
        loading={saving}
        onConfirm={async () => {
          if (!pendingRestore) return;
          const payload = pendingRestore.data;
          setPendingRestore(null);
          await handleRestore(payload);
        }}
        onCancel={() => setPendingRestore(null)}
      />
    </div>
  );
}
