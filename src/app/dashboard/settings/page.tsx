'use client';

import {
  getSettingsAction,
  saveSettingsAction,
  backupDatabaseAction,
  exportDatabaseToSqlAction,
  restoreDatabaseAction,
  checkAIStatusAction,
} from '@/lib/actions/settings';
import { getGuruList } from '@/lib/actions/admin';
import {
  FLEXIBLE_MENU_DEFINITIONS,
  FlexibleMenuKey,
  parseRbacFromSettings,
  RbacConfig,
} from '@/lib/rbac-config';
import {
  buildImageFallbackCandidates,
  compressImageFileToDataUrl,
} from '@/lib/utils';
import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import {
  Settings2,
  School,
  GraduationCap,
  BrainCircuit,
  DatabaseZap,
  Save,
  Download,
  Upload,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  FileText,
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  Target,
  Zap,
  ImagePlus,
  RotateCcw,
  Copy,
  CheckCircle2,
  MapPin,
  Users,
  PenTool,
  Trash2,
} from 'lucide-react';

const KNOWN_AI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const DEFAULT_V6_PROMPT =
  "Role: SISTEM KOREKSI LJK (Lembar Jawaban Komputer) ULTRA-AKURAT - WMVAA AI Grader Enterprise Vision Engine V6.\n" +
  "Task: Mengekstraksi identitas siswa dan seluruh jawaban soal secara presisi dari citra LJK fisik.\n\n" +
  "=== PROTOKOL PENALARAN VISUAL & TATA LETAK LJK V6 ===\n" +
  "1. ORIENTASI & KALIBRASI SPASIAL:\n" +
  "   - Deteksi 4 Fiducial Marker (kotak hitam konsentris) di keempat sudut lembar kertas sebagai patokan batas dokumen.\n" +
  "   - Kompensasikan kemiringan sudut (skew/rotation), perspektif kamera ponsel, atau bayangan tangan secara visual.\n\n" +
  "2. BLOK IDENTITAS PESERTA (KIRI ATAS) & QR ANCHOR (KANAN ATAS):\n" +
  "   - Baca kolom 'NAMA PESERTA': Transkrip nama lengkap siswa.\n" +
  "   - Baca 'NIS / NO. PESERTA' di kotak identitas ATAU pada label 'NIS:' di bawah QR Code kanan atas.\n\n" +
  "3. ATURAN ELIMINASI VISUAL BULATAN (ANTI-JEBAKAN HURUF TERTUTUP TINTA):\n" +
  "   - Setiap bulatan yang dipilih siswa dihitamkan penuh (●) atau diberi tanda silang (X) sehingga huruf di dalamnya TERTUTUP.\n" +
  "   - Sementara bulatan lain yang TIDAK dipilih pada baris yang sama tetap putih bersih (○) dengan huruf tercetak terlihat jelas di dalamnya.\n" +
  "   - Hitung jumlah bulatan kosong di sebelah KIRI ('left_empty') dan KANAN ('right_empty') dari bulatan yang dihitamkan, catat huruf yang masih terlihat ('unfilled_letters_visible'), lalu tentukan huruf jawaban ('filled_letter' atau '?' jika kosong).\n\n" +
  "4. ATURAN KOTAK ISIAN SINGKAT (ISN) & ZONA URAIAN / ESAI:\n" +
  "   - Untuk soal Isian Singkat (ISN), baca tulisan tangan (angka, pecahan, simbol matematika, atau kata) di dalam kotak persegi panjang terbuka dan masukkan ke 'filled_letter'.\n" +
  "   - Untuk soal Uraian/Esai di bagian bawah 'JAWABAN URAIAN / ESAI', transkripsikan jawaban tulisan tangan siswa secara utuh ke 'filled_letter'.\n\n" +
  "=== ATURAN FORMAT OUTPUT JSON (MURNI TANPA MARKDOWN/BACKTICK) ===\n" +
  "{\n" +
  "  \"name\": \"NAMA SISWA LENGKAP\",\n" +
  "  \"nis\": \"388\",\n" +
  "  \"id_siswa\": \"\",\n" +
  "  \"confidence\": 98,\n" +
  "  \"answers\": [\n" +
  "    { \"no\": 1, \"left_empty\": 0, \"right_empty\": 3, \"unfilled_letters_visible\": [\"B\", \"C\", \"D\"], \"filled_letter\": \"A\" }\n" +
  "  ]\n" +
  "}\n" +
  "Pastikan 'answers' memuat tepat {{totalSoal}} item bernomor 1 s/d {{totalSoal}}.\n" +
  "{{questionBlueprint}}";

function UniversalLogoPreview({
  src,
  defaultSrc,
  alt,
  sizeClass = 'w-14 h-14',
  isSignature = false,
}: {
  src?: string;
  defaultSrc: string;
  alt: string;
  sizeClass?: string;
  isSignature?: boolean;
}) {
  const candidates = useMemo(
    () => buildImageFallbackCandidates(src, defaultSrc),
    [src, defaultSrc]
  );
  const [idx, setIdx] = useState(0);
  const [prevKey, setPrevKey] = useState(`${src || ''}|${defaultSrc}`);

  const currentKey = `${src || ''}|${defaultSrc}`;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setIdx(0);
  }

  const activeUrl = candidates[idx] || '';

  if (!activeUrl) {
    return (
      <div
        className={`${sizeClass} border border-dashed border-slate-300 dark:border-white/15 rounded-lg flex flex-col items-center justify-center shrink-0 gap-0.5 text-slate-300`}
      >
        {isSignature ? (
          <>
            <PenTool className="w-3.5 h-3.5" />
            <span className="text-[8px] font-bold uppercase text-slate-400">Kosong</span>
          </>
        ) : (
          <School className="w-5 h-5" />
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setIdx((prev) => prev + 1)}
      className={`${sizeClass} object-contain select-none shrink-0`}
    />
  );
}

function UniversalLogoField({
  label,
  value,
  defaultPath = '',
  onChange,
  variant = 'logo',
  compact = false,
}: {
  label: string;
  value: string;
  defaultPath?: string;
  onChange: (newValue: string) => void;
  variant?: 'logo' | 'signature';
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isSignature = variant === 'signature';
  const isDataUri = value.startsWith('data:image/');
  const isDrive =
    value.includes('drive.google.com') ||
    value.includes('googleusercontent.com') ||
    value.includes('docs.google.com');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(
        file,
        isSignature ? 320 : 240,
        42000
      );
      onChange(dataUrl);
      toast.success(`${label} berhasil diunggah & dioptimasi!`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses file gambar.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`${
        compact ? 'p-3 bg-white dark:bg-[#0a0e1a] border-slate-200 dark:border-white/10' : 'p-3.5 bg-slate-50 dark:bg-[#0d1326] border-slate-200 dark:border-white/[0.06]'
      } rounded-2xl border space-y-2`}
    >
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </label>
        <span
          className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
            isDataUri
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : isDrive
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
          }`}
        >
          {isDataUri
            ? 'File Upload'
            : isDrive
              ? 'Google Drive'
              : value
                ? 'URL Aktif'
                : isSignature
                  ? 'Opsional'
                  : 'Default'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`${
            isSignature ? 'w-24 h-12 px-1.5 py-1' : 'w-14 h-14 p-1.5'
          } rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm`}
        >
          <UniversalLogoPreview
            src={value || defaultPath}
            defaultSrc={defaultPath}
            alt={label}
            sizeClass={isSignature ? 'w-20 h-10' : 'w-11 h-11'}
            isSignature={isSignature}
          />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <input
            type="text"
            value={
              isDataUri
                ? isSignature
                  ? '[TTD Digital Terunggah — Siap Cetak]'
                  : '[Logo File Terunggah — Siap Cetak]'
                : value
            }
            readOnly={isDataUri}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              isSignature
                ? 'Upload PNG transparan / scan TTD atau URL...'
                : 'Tempel link Google Drive, URL gambar web, atau /logo/...'
            }
            className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-[11px] font-medium focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <ImagePlus className="w-3 h-3" />
              <span>{uploading ? 'Memproses...' : isSignature ? 'Upload TTD' : 'Upload File'}</span>
            </button>

            {isSignature ? (
              value && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-[10px] font-bold inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="Hapus gambar tanda tangan"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onChange(defaultPath)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 text-[10px] font-bold inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title="Kembalikan ke logo bawaan sekolah"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Default</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'academic' | 'ai' | 'rbac' | 'backup'>('branding');
  const [guruUsers, setGuruUsers] = useState<{ id_user: string; username: string; nama: string }[]>([]);
  const [rbacSavingKey, setRbacSavingKey] = useState<string>('');
  const [guruRbacSearch, setGuruRbacSearch] = useState<string>('');
  const [showGlobalRbac, setShowGlobalRbac] = useState<boolean>(false);
  const [activeJenjangTab, setActiveJenjangTab] = useState<'SMA' | 'SMP'>('SMA');
  const [showBothJenjang, setShowBothJenjang] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [pendingRestore, setPendingRestore] = useState<{ fileName: string; data: any } | null>(null);

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [res, guruRes] = await Promise.all([getSettingsAction(), getGuruList()]);
      if (guruRes?.success && Array.isArray(guruRes.data)) {
        const list = guruRes.data
          .filter((u: any) => String(u.role || '').toUpperCase() !== 'ADMIN')
          .map((u: any) => ({
            id_user: String(u.id || u.id_user || ''),
            username: String(u.username || ''),
            nama: String(u.nama || u.username || ''),
          }))
          .filter((u: any) => u.id_user);
        setGuruUsers(list);
      }
      if (res.success) {
        const data = res.data || {};
        setSettings(data);
        const currentModel = data['ai_model'];
        if (currentModel && !KNOWN_AI_MODELS.includes(currentModel)) {
          setIsCustomModel(true);
          setCustomModelInput(currentModel);
        } else {
          setIsCustomModel(false);
        }
      } else {
        toast.error(res.message || 'Gagal memuat pengaturan');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveSettingsAction(settings);
      if (res.success) {
        toast.success('Pengaturan sistem berhasil disimpan!');
        await fetchSettings();
      } else {
        toast.error('Gagal menyimpan: ' + res.message);
      }
    } catch (err: any) {
      toast.error('Kesalahan sistem: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLogosBetweenUnits = (fromUnit: 'sma' | 'smp', toUnit: 'sma' | 'smp') => {
    setSettings((prev) => ({
      ...prev,
      [`${toUnit}_logo_kiri_url`]: prev[`${fromUnit}_logo_kiri_url`] || '/logo/logo_advent.png',
      [`${toUnit}_logo_kanan_url`]: prev[`${fromUnit}_logo_kanan_url`] || '/logo/tut_wuri.png',
      [`${toUnit}_nama_sekolah_1`]:
        prev[`${fromUnit}_nama_sekolah_1`] || 'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY',
    }));
    toast.success(`Logo & Baris 1 Kop berhasil disalin dari ${fromUnit.toUpperCase()} ke ${toUnit.toUpperCase()}!`);
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
    toast.loading('Menyiapkan file backup 11 tabel...', { id: 'backup-toast' });
    try {
      const res = await backupDatabaseAction();
      if (res.success) {
        const dataStr = JSON.stringify(res.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
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

  const handleExportSql = async () => {
    toast.loading('Menyiapkan file script MySQL (.sql)...', { id: 'sql-toast' });
    try {
      const res = await exportDatabaseToSqlAction();
      if (res.success && res.sql) {
        const blob = new Blob([res.sql], { type: 'application/sql;charset=utf-8;' });
        const dataUri = URL.createObjectURL(blob);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', res.filename || 'wmvaa_database.sql');
        linkElement.click();
        URL.revokeObjectURL(dataUri);
        toast.success('Script SQL berhasil diunduh! Siap diimpor ke phpMyAdmin cPanel.', { id: 'sql-toast' });
      } else {
        toast.error('Gagal export SQL: ' + res.message, { id: 'sql-toast' });
      }
    } catch (e: any) {
      toast.error('Koneksi terputus saat export SQL: ' + e.message, { id: 'sql-toast' });
    }
  };

  const handleRestore = async (jsonData: any) => {
    toast.loading('Memulihkan database & membersihkan cache...', { id: 'restore-toast' });
    try {
      const res = await restoreDatabaseAction(jsonData);
      if (res.success) {
        toast.success(res.message || 'Database berhasil dipulihkan secara penuh!', {
          id: 'restore-toast',
        });
        await fetchSettings();
      } else {
        toast.error('Restorasi gagal: ' + res.message, { id: 'restore-toast' });
      }
    } catch (e: any) {
      toast.error('Kesalahan saat restorasi: ' + e.message, { id: 'restore-toast' });
    }
  };

  const apiKeyPoolCount = useMemo(() => {
    const raw = settings['ai_api_keys_pool'] || '';
    return raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 20).length;
  }, [settings]);

  const renderUnitConfigForm = (jenjang: 'SMP' | 'SMA') => {
    const prefix = jenjang.toLowerCase() as 'smp' | 'sma';
    const otherPrefix = prefix === 'sma' ? 'smp' : 'sma';
    const isSmp = jenjang === 'SMP';
    const badgeTone = isSmp
      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
      : 'bg-purple-500/10 text-purple-600 dark:text-cyan-400 border-purple-500/20';

    return (
      <div
        key={jenjang}
        className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#090d1a] border border-slate-200 dark:border-white/[0.07] space-y-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${badgeTone}`}>
              UNIT {jenjang} ({isSmp ? 'Kelas VII–IX' : 'Kelas X–XII'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopyLogosBetweenUnits(otherPrefix, prefix)}
            className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 transition-colors"
            title={`Salin Logo & Baris 1 dari Unit ${otherPrefix.toUpperCase()}`}
          >
            <Copy className="w-3 h-3" />
            <span>Samakan Logo dgn {otherPrefix.toUpperCase()}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Baris 1 — Nama Akademi / Instansi Induk ({jenjang})
            </label>
            <input
              type="text"
              value={settings[`${prefix}_nama_sekolah_1`] || ''}
              onChange={(e) => updateSetting(`${prefix}_nama_sekolah_1`, e.target.value)}
              placeholder="WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY"
              className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Baris 2 — Nama Resmi Unit Sekolah ({jenjang})
            </label>
            <input
              type="text"
              value={settings[`${prefix}_nama_sekolah_2`] || ''}
              onChange={(e) => updateSetting(`${prefix}_nama_sekolah_2`, e.target.value)}
              placeholder={isSmp ? 'SMP ADVENT SOGOKMO' : 'SMA ADVENT SOGOKMO'}
              className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              NPSN Unit {jenjang} (Opsional)
            </label>
            <input
              type="text"
              value={settings[`${prefix}_npsn`] || ''}
              onChange={(e) => updateSetting(`${prefix}_npsn`, e.target.value)}
              placeholder={`NPSN ${jenjang}`}
              className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs font-mono font-bold focus:outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UniversalLogoField
            label={`Logo Kiri Kop ${jenjang}`}
            value={settings[`${prefix}_logo_kiri_url`] || ''}
            defaultPath="/logo/logo_advent.png"
            onChange={(val) => updateSetting(`${prefix}_logo_kiri_url`, val)}
          />
          <UniversalLogoField
            label={`Logo Kanan Kop ${jenjang}`}
            value={settings[`${prefix}_logo_kanan_url`] || ''}
            defaultPath="/logo/tut_wuri.png"
            onChange={(val) => updateSetting(`${prefix}_logo_kanan_url`, val)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-50 dark:bg-[#0d1326] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.06] space-y-2.5">
            <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Kepala Sekolah {jenjang}</span>
            </label>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                Nama Lengkap &amp; Gelar Kepala {jenjang}
              </span>
              <input
                type="text"
                placeholder={`Nama Kepala Sekolah ${jenjang}`}
                value={settings[`${prefix}_kepala_nama`] || ''}
                onChange={(e) => updateSetting(`${prefix}_kepala_nama`, e.target.value)}
                className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500/40"
              />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                NIP / NRG Kepala {jenjang}
              </span>
              <input
                type="text"
                placeholder="NIP / NRG Kepala Sekolah"
                value={settings[`${prefix}_kepala_nip`] || ''}
                onChange={(e) => updateSetting(`${prefix}_kepala_nip`, e.target.value)}
                className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-indigo-500/40"
              />
            </div>
            <UniversalLogoField
              label={`Tanda Tangan Kepala ${jenjang}`}
              value={settings[`${prefix}_kepala_ttd_url`] || ''}
              onChange={(val) => updateSetting(`${prefix}_kepala_ttd_url`, val)}
              variant="signature"
              compact
            />
          </div>

          <div className="bg-slate-50 dark:bg-[#0d1326] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.06] space-y-2.5">
            <label className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Ketua Panitia Ujian {jenjang}</span>
            </label>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                Nama Lengkap &amp; Gelar Ketua Panitia {jenjang}
              </span>
              <input
                type="text"
                placeholder={`Nama Ketua Panitia ${jenjang}`}
                value={settings[`${prefix}_panitia_nama`] || ''}
                onChange={(e) => updateSetting(`${prefix}_panitia_nama`, e.target.value)}
                className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-sky-500/40"
              />
            </div>
            <div>
              <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                NIP / NRG Ketua Panitia {jenjang}
              </span>
              <input
                type="text"
                placeholder="NIP / NRG Ketua Panitia"
                value={settings[`${prefix}_panitia_nip`] || ''}
                onChange={(e) => updateSetting(`${prefix}_panitia_nip`, e.target.value)}
                className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-sky-500/40"
              />
            </div>
            <UniversalLogoField
              label={`Tanda Tangan Ketua Panitia ${jenjang}`}
              value={settings[`${prefix}_panitia_ttd_url`] || ''}
              onChange={(val) => updateSetting(`${prefix}_panitia_ttd_url`, val)}
              variant="signature"
              compact
            />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLoadingState
        title="Menghubungkan ke Pusat Konfigurasi..."
        subtitle="Sinkronisasi pengaturan sekolah (SMP & SMA), akademik, dan Gemini AI dari server"
        accentClass="border-t-indigo-500"
      />
    );
  }

  const previewPrefix = activeJenjangTab.toLowerCase() as 'sma' | 'smp';

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 fade-in">
      {/* ── Header ── */}
      <PageHeader
        icon={<Settings2 className="w-6 h-6 sm:w-7 sm:h-7" />}
        iconBgClass="bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
        title="Konfigurasi Sistem & Sekolah"
        description="Pusat kendali instansi. Atur Kop & Pejabat Unit SMP dan SMA secara terpisah, unggah/tempel URL logo dari mana saja, kelola parameter KKM, AI Engine, serta pencadangan database."
      />

      {/* ── Navigation Tabs ── */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 p-2 bg-white dark:bg-[#0a0e1a]/90 lg:dark:bg-[#0a0e1a]/60 lg:backdrop-blur-xl border border-slate-200 dark:border-white/[0.05] rounded-2xl sm:rounded-[1.5rem] w-full sm:w-fit shadow-sm transition-colors">
        {[
          { id: 'branding', label: 'Identitas Sekolah', icon: <School className="w-4 h-4" /> },
          { id: 'academic', label: 'Info Akademik', icon: <GraduationCap className="w-4 h-4" /> },
          { id: 'ai', label: 'AI Engine', icon: <BrainCircuit className="w-4 h-4" /> },
          { id: 'rbac', label: 'Hak Akses Guru', icon: <ShieldCheck className="w-4 h-4" /> },
          { id: 'backup', label: 'Data & Recovery', icon: <DatabaseZap className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center justify-center gap-2 px-3 sm:px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider sm:tracking-[0.16em] transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-indigo-500/50'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── CONTENT: TAB BRANDING ── */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 lg:backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-10 shadow-sm dark:shadow-2xl relative overflow-hidden transition-all duration-500">
          <form onSubmit={handleSaveSettings} className="space-y-8 sm:space-y-10 relative z-10">
            {/* 1. Identitas Yayasan & Lokasi Bersama */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.22em] flex items-center gap-3">
                <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>1. Identitas Yayasan, Alamat &amp; Kota Pengesahan</span>
                <span className="h-[1px] bg-slate-100 dark:bg-white/[0.06] flex-1" />
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Nama Yayasan Penaung
                  </label>
                  <input
                    type="text"
                    value={settings['nama_yayasan'] || ''}
                    onChange={(e) => updateSetting('nama_yayasan', e.target.value)}
                    placeholder="YAYASAN PENDIDIKAN ADVENT PAPUA"
                    className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.07] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Alamat Lengkap (Baris Bawah Kop Surat)
                  </label>
                  <input
                    type="text"
                    value={settings['alamat_sekolah'] || ''}
                    onChange={(e) => updateSetting('alamat_sekolah', e.target.value)}
                    placeholder="Jl. Wamena – Kurima, Kampung Sogokmo..."
                    className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.07] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Kota Tanda Tangan &amp; Opsi Panitia</span>
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={settings['kota_sekolah'] || ''}
                      onChange={(e) => updateSetting('kota_sekolah', e.target.value)}
                      placeholder="Wamena"
                      className="w-full sm:w-40 bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.07] rounded-xl px-3.5 py-3 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all"
                    />
                    <label className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.07] cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={settings['tampilkan_ttd_panitia'] === 'true'}
                        onChange={(e) =>
                          updateSetting('tampilkan_ttd_panitia', e.target.checked ? 'true' : 'false')
                        }
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                      />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                        Sertakan TTD Ketua Panitia di PDF Nilai
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Pengesahan Default Kartu Peserta Ujian */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Pejabat Pengesahan Kartu Peserta Ujian
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    Tentukan pejabat penanda tangan kartu peserta sesuai keputusan sekolah (mengikuti data SMP &amp; SMA di bawah).
                  </p>
                </div>
                <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 shrink-0">
                  {[
                    { value: 'PANITIA', label: 'Ketua Panitia' },
                    { value: 'KEPALA', label: 'Kepala Sekolah' },
                  ].map((opt) => {
                    const active = (settings['kartu_signer_mode'] || 'PANITIA') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateSetting('kartu_signer_mode', opt.value)}
                        className={`px-3.5 py-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Ringkasan Pemisahan Pejabat Unit SMP vs Unit SMA */}
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-500/[0.04] dark:bg-white/[0.02] border border-indigo-500/15 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Status Pemisahan Data Pejabat Unit SMP &amp; Unit SMA</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBothJenjang((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:border-indigo-400 transition-all active:scale-95"
                >
                  {showBothJenjang
                    ? 'Mode Tab Per Unit'
                    : 'Buka Form SMP & SMA Berdampingan'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div
                  onClick={() => setActiveJenjangTab('SMP')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    activeJenjangTab === 'SMP'
                      ? 'bg-white dark:bg-[#0d1326] border-indigo-500 shadow-sm'
                      : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      UNIT SMP — {settings['smp_nama_sekolah_2'] || 'SMP ADVENT SOGOKMO'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">Kelas VII–IX</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] mt-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">
                        Kepala Sekolah SMP:
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate block">
                        {settings['smp_kepala_nama'] || 'Belum diisi'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">
                        Ketua Panitia SMP:
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate block">
                        {settings['smp_panitia_nama'] || 'Belum diisi'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setActiveJenjangTab('SMA')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    activeJenjangTab === 'SMA'
                      ? 'bg-white dark:bg-[#0d1326] border-purple-500 shadow-sm'
                      : 'bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-cyan-400">
                      UNIT SMA — {settings['sma_nama_sekolah_2'] || 'SMA ADVENT SOGOKMO'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">Kelas X–XII</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] mt-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">
                        Kepala Sekolah SMA:
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate block">
                        {settings['sma_kepala_nama'] || 'Belum diisi'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">
                        Ketua Panitia SMA:
                      </span>
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate block">
                        {settings['sma_panitia_nama'] || 'Belum diisi'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Detail Kop, Logo, Kepala Sekolah, & Ketua Panitia Per Jenjang + Live Render */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
              <div className="lg:col-span-7 space-y-5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.22em] flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>2. Pengaturan Kop, Logo &amp; Pejabat Per Unit</span>
                  </h3>

                  {!showBothJenjang && (
                    <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl">
                      {(['SMP', 'SMA'] as const).map((j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => setActiveJenjangTab(j)}
                          className={`px-4 py-2 font-black text-[10px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                            activeJenjangTab === j
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <School className="w-3.5 h-3.5" />
                          <span>Unit {j}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {showBothJenjang ? (
                  <div className="space-y-6">
                    {renderUnitConfigForm('SMP')}
                    {renderUnitConfigForm('SMA')}
                  </div>
                ) : (
                  renderUnitConfigForm(activeJenjangTab)
                )}
              </div>

              {/* LIVE PREVIEW BOX */}
              <div className="lg:col-span-5 min-w-0">
                <div className="sticky top-24 w-full p-4 sm:p-7 rounded-3xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] shadow-inner space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      <span>Live Render Kop &amp; Pengesahan ({activeJenjangTab})</span>
                    </h4>
                    <div className="flex gap-1">
                      {(['SMP', 'SMA'] as const).map((j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => setActiveJenjangTab(j)}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                            activeJenjangTab === j
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-white/5 text-slate-500'
                          }`}
                        >
                          {j}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Simulated Paper Render */}
                  <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-300 font-serif text-center relative overflow-hidden w-full flex flex-col justify-between select-none">
                    <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-black pb-3 w-full">
                      {/* Logo Kiri */}
                      <div className="w-14 h-14 flex items-center justify-center shrink-0">
                        <UniversalLogoPreview
                          src={settings[`${previewPrefix}_logo_kiri_url`]}
                          defaultSrc="/logo/logo_advent.png"
                          alt="Logo Kiri"
                          sizeClass="w-14 h-14"
                        />
                      </div>

                      {/* Text Center */}
                      <div className="flex-1 flex flex-col justify-center items-center min-w-0">
                        <div className="text-[9px] font-bold text-slate-900 uppercase leading-tight tracking-[0.06em]">
                          {settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA'}
                        </div>
                        <div className="text-xs font-black text-black uppercase leading-tight tracking-wide my-0.5">
                          {settings[`${previewPrefix}_nama_sekolah_1`] ||
                            'WAMENA MOUNTAIN VIEW ADVENTIST ACADEMY'}
                        </div>
                        <div className="text-base sm:text-lg font-black text-black uppercase leading-tight tracking-wide">
                          {settings[`${previewPrefix}_nama_sekolah_2`] ||
                            (activeJenjangTab === 'SMP'
                              ? 'SMP ADVENT SOGOKMO'
                              : 'SMA ADVENT SOGOKMO')}
                        </div>
                        <div className="text-[8.5px] text-slate-700 italic leading-tight mt-0.5">
                          {settings['alamat_sekolah'] ||
                            'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya'}
                        </div>
                      </div>

                      {/* Logo Kanan */}
                      <div className="w-14 h-14 flex items-center justify-center shrink-0">
                        <UniversalLogoPreview
                          src={settings[`${previewPrefix}_logo_kanan_url`]}
                          defaultSrc="/logo/tut_wuri.png"
                          alt="Logo Kanan"
                          sizeClass="w-14 h-14"
                        />
                      </div>
                    </div>

                    {/* Mock Signatures */}
                    <div className="mt-6 pt-2 grid grid-cols-2 gap-2 sm:gap-4 px-1 sm:px-2 text-black font-sans">
                      <div className="flex flex-col items-center min-w-0">
                        <div className="text-[9px] font-semibold text-slate-700 truncate max-w-full">
                          Ketua Panitia Ujian ({activeJenjangTab})
                        </div>
                        <div className="h-10" />
                        <div className="text-[9.5px] sm:text-[10px] font-black border-b border-black pb-0.5 truncate max-w-full">
                          {settings[`${previewPrefix}_panitia_nama`] ||
                            `Ketua Panitia ${activeJenjangTab}`}
                        </div>
                        <div className="text-[8px] text-slate-700 mt-0.5 font-mono truncate max-w-full">
                          NIP/NRG. {settings[`${previewPrefix}_panitia_nip`] || '—'}
                        </div>
                      </div>

                      <div className="flex flex-col items-center min-w-0">
                        <div className="text-[9px] font-semibold text-slate-700 truncate max-w-full">
                          {settings['kota_sekolah'] || 'Wamena'}, Kepala {activeJenjangTab}
                        </div>
                        <div className="h-10" />
                        <div className="text-[9.5px] sm:text-[10px] font-black border-b border-black pb-0.5 truncate max-w-full">
                          {settings[`${previewPrefix}_kepala_nama`] ||
                            `Kepala Sekolah ${activeJenjangTab}`}
                        </div>
                        <div className="text-[8px] text-slate-700 mt-0.5 font-mono truncate max-w-full">
                          NIP/NRG. {settings[`${previewPrefix}_kepala_nip`] || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium text-center leading-relaxed">
                    Pratinjau otomatis menyesuaikan unit <strong>SMP</strong> (Kelas VII–IX) dan{' '}
                    <strong>SMA</strong> (Kelas X–XII) pada saat cetak LJK maupun cetak PDF Daftar
                    Nilai Kelas.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-white/[0.06] flex justify-end">
              <button
                disabled={saving}
                type="submit"
                className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 sm:px-10 py-3.5 sm:py-4 rounded-2xl text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-[0.18em] transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-2.5 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">{saving ? 'Menyimpan...' : 'Simpan Identitas Sekolah (SMP & SMA)'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONTENT: TAB ACADEMIC ── */}
      {activeTab === 'academic' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 lg:backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-10 shadow-sm dark:shadow-2xl relative overflow-hidden transition-all duration-500">
          <form onSubmit={handleSaveSettings} className="space-y-10 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Sesi Akademik Aktif</span>
                  <span className="h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Tahun Pelajaran Aktif
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 2026/2027"
                      value={settings['tahun_ajaran'] || ''}
                      onChange={(e) => updateSetting('tahun_ajaran', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.06] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm sm:text-base font-bold focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Semester Yang Berjalan
                    </label>
                    <select
                      value={settings['semester'] || 'GANJIL'}
                      onChange={(e) => updateSetting('semester', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.06] rounded-2xl px-5 py-3.5 text-slate-900 dark:text-white text-sm sm:text-base font-bold focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                    >
                      <option value="GANJIL">SEMESTER GANJIL (1)</option>
                      <option value="GENAP">SEMESTER GENAP (2)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span>Standar Ketuntasan Minimal (KKM / KKTP)</span>
                  <span className="h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.06] p-4 rounded-2xl">
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
                        Batas KKM Eksakta
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={settings['kkm_eksakta'] || '70'}
                        onChange={(e) => updateSetting('kkm_eksakta', e.target.value)}
                        className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-emerald-600 dark:text-emerald-400 text-2xl font-black text-center focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.06] p-4 rounded-2xl">
                      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
                        Batas KKM Non-Eksakta
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={settings['kkm_non_eksakta'] || '75'}
                        onChange={(e) => updateSetting('kkm_non_eksakta', e.target.value)}
                        className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sky-600 dark:text-sky-400 text-2xl font-black text-center focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Kata Kunci Auto-Deteksi Mapel Eksakta
                    </label>
                    <input
                      type="text"
                      value={settings['mapel_eksakta_keywords'] || ''}
                      onChange={(e) => updateSetting('mapel_eksakta_keywords', e.target.value)}
                      placeholder="IPA, Matematika, Fisika, Kimia, Biologi, Informatika"
                      className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.06] rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-amber-500/50"
                    />
                    <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>
                        Pisahkan dengan koma (,). Mapel yang cocok menggunakan KKM Eksakta, lainnya
                        menggunakan KKM Non-Eksakta.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t border-slate-100 dark:border-white/[0.05]">
              <div className="space-y-5">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span>Kalibrasi Scanner &amp; Tata Letak LJK</span>
                  <span className="h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>

                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.06] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Batas Minimal Kepercayaan AI (Confidence)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-black">
                      {settings['min_confidence'] || '60'}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings['min_confidence'] || '60'}
                    onChange={(e) => updateSetting('min_confidence', e.target.value)}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Hasil pindaian LJK dengan keyakinan visual di bawah nilai ini otomatis diberi
                    label <strong>Perlu Review Manual</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Preferensi Cetak LJK Default</span>
                  <span className="h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>

                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/[0.06] space-y-3">
                  <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Tata Letak Default Zona Uraian / Esai pada LJK
                  </label>
                  <select
                    value={settings['ljk_essay_layout_default'] || 'integrated'}
                    onChange={(e) => updateSetting('ljk_essay_layout_default', e.target.value)}
                    className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="integrated">
                      Gabung 1 Lembar A4 (Otomatis pindah ke Hal. 2 bila soal penuh)
                    </option>
                    <option value="second_page">
                      Pisahkan Lembar Esai ke Halaman 2 Khusus
                    </option>
                    <option value="separate_manual">
                      Hanya Objektif di LJK (Esai Dikerjakan di Kertas Folio Terpisah)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-white/[0.06] flex justify-end">
              <button
                disabled={saving}
                type="submit"
                className="w-full sm:w-auto justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-black px-10 py-4 rounded-2xl text-xs uppercase tracking-[0.18em] transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Menyimpan...' : 'Simpan Parameter Akademik'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONTENT: TAB AI ── */}
      {activeTab === 'ai' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 lg:backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-10 shadow-sm dark:shadow-2xl relative overflow-hidden transition-all duration-500">
          <form onSubmit={handleSaveSettings} className="space-y-10 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                  <BrainCircuit className="w-4 h-4 text-sky-400" />
                  <span>Arsitektur Model Gemini Vision</span>
                  <span className="h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>

                <div className="bg-slate-50 dark:bg-[#0d1326] p-5 rounded-2xl border border-slate-200 dark:border-white/[0.06] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Model Visi Utama (LLM)
                      </label>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Digunakan untuk pemindaian LJK, ekstraksi kunci soal AI, dan koreksi esai
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestAI}
                      disabled={testingAI}
                      className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[10px] font-black uppercase tracking-wider border border-sky-500/20 transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                    >
                      {testingAI ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Activity className="w-3.5 h-3.5" />
                      )}
                      <span>Ping API</span>
                    </button>
                  </div>

                  {!isCustomModel ? (
                    <select
                      value={settings['ai_model'] || 'gemini-3-flash-preview'}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomModel(true);
                          setCustomModelInput(settings['ai_model'] || '');
                        } else {
                          updateSetting('ai_model', e.target.value);
                        }
                      }}
                      className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-sky-500/50"
                    >
                      <optgroup label="Model Produksi Berkecepatan Tinggi (Rekomendasi)">
                        <option value="gemini-3-flash-preview">
                          🎯 Gemini 3 Flash Preview (Akurasi Spasial OMR 100% — Rekomendasi Utama)
                        </option>
                        <option value="gemini-2.5-flash">
                          ⚡ Gemini 2.5 Flash (Cepat &amp; Stabil)
                        </option>
                        <option value="gemini-2.0-flash">
                          ⚡ Gemini 2.0 Flash (Cadangan Cepat)
                        </option>
                      </optgroup>
                      <optgroup label="Model Penalaran Mendalam (Pro Series)">
                        <option value="gemini-2.5-pro">
                          🧠 Gemini 2.5 Pro (Penalaran Kompleks &amp; Esai Mendalam)
                        </option>
                      </optgroup>
                      <optgroup label="Model Kompatibilitas Lama">
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      </optgroup>
                      <optgroup label="Opsi Kustom">
                        <option value="__custom__">✏️ Ketik ID Model Kustom Sendiri...</option>
                      </optgroup>
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customModelInput}
                          onChange={(e) => {
                            setCustomModelInput(e.target.value);
                            updateSetting('ai_model', e.target.value);
                          }}
                          placeholder="Contoh: gemini-2.5-flash"
                          className="flex-1 bg-white dark:bg-[#0a0e1a] border border-sky-500/50 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomModel(false);
                            updateSetting('ai_model', 'gemini-3-flash-preview');
                          }}
                          className="px-3.5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Daftar Preset
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Masukkan kode model resmi sesuai dokumentasi Google AI Studio.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-[#0d1326] p-5 rounded-2xl border border-slate-200 dark:border-white/[0.06] space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Presisi vs Kreativitas (Temperature)
                    </label>
                    <span className="text-sky-500 font-mono text-sm font-black">
                      {settings['ai_temperature'] || '0.1'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings['ai_temperature'] || '0.1'}
                    onChange={(e) => updateSetting('ai_temperature', e.target.value)}
                    className="w-full accent-sky-500"
                  />
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Presisi OMR (0.0–0.1)</span>
                    <span>Seimbang (0.5)</span>
                    <span>Kreatif (1.0)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Pool Multi-API Key (Anti-Limit)</span>
                  <span className="h-[1px] bg-slate-100 dark:bg-white/[0.05] flex-1" />
                </h3>

                <div className="bg-slate-50 dark:bg-[#0d1326] p-5 rounded-2xl border border-slate-200 dark:border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <label className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Rotasi API Key Cadangan (Round-Robin)
                      </label>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Pisahkan dengan baris baru atau koma untuk membagi beban saat banyak guru
                        memindai LJK bersamaan.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider shrink-0">
                      {apiKeyPoolCount > 0 ? `${apiKeyPoolCount} Key Pool` : 'Default .env'}
                    </span>
                  </div>
                  <textarea
                    value={settings['ai_api_keys_pool'] || ''}
                    onChange={(e) => updateSetting('ai_api_keys_pool', e.target.value)}
                    rows={5}
                    placeholder={'AIzaSy... (Key Cadangan 1)\nAIzaSy... (Key Cadangan 2)'}
                    className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-sky-500/50"
                  />
                  <p className="text-[10px] text-slate-400">
                    Aman: Kunci ini hanya dapat dilihat oleh Admin dan tetap menggabungkan{' '}
                    <code>GEMINI_API_KEY</code> dari server.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Master Prompt Payload (System Instructions V6)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    updateSetting('ai_system_prompt', DEFAULT_V6_PROMPT);
                    toast.info(
                      'Master Prompt dikembalikan ke standar V6 Elimination OMR. Klik Simpan Konfigurasi AI untuk menerapkan.'
                    );
                  }}
                  className="text-[10px] font-black text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset ke Default V6</span>
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-black/40">
                <textarea
                  value={settings['ai_system_prompt'] || ''}
                  onChange={(e) => updateSetting('ai_system_prompt', e.target.value)}
                  className="w-full bg-transparent p-5 text-sky-700 dark:text-sky-300 text-[11px] font-mono leading-relaxed h-[320px] focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-white/[0.06] flex justify-end">
              <button
                disabled={saving}
                type="submit"
                className="w-full sm:w-auto justify-center bg-sky-600 hover:bg-sky-500 text-white font-black px-10 py-4 rounded-2xl text-xs uppercase tracking-[0.18em] transition-all shadow-xl shadow-sky-500/20 active:scale-95 flex items-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Menyimpan...' : 'Simpan Konfigurasi AI'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONTENT: TAB BACKUP / RECOVERY ── */}
      {activeTab === 'backup' && (
        <div className="bg-white dark:bg-[#0a0e1a]/80 lg:backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-3xl sm:rounded-[3rem] p-8 sm:p-16 text-center space-y-10 shadow-sm dark:shadow-2xl relative overflow-hidden">
          <div className="max-w-xl mx-auto relative z-10 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Disaster Recovery &amp; Pencadangan Penuh (11 Tabel)
            </h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm leading-relaxed">
              Unduh seluruh data institusi (<code>USERS</code>, <code>KELAS</code>,{' '}
              <code>MAPEL</code>, <code>SISWA</code>, <code>KUNCI_JAWABAN</code>,{' '}
              <code>HASIL</code>, <code>SETTINGS</code>, <code>TUGAS_GURU</code>,{' '}
              <code>AI_FEEDBACK</code>, <code>FILES</code>, dan <code>LOG</code>) ke dalam file{' '}
              <code>.json</code> atau pulihkan kembali secara instan disertai pembersihan cache
              otomatis.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-5 relative z-10">
            <button
              type="button"
              onClick={handleBackup}
              className="group flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white p-7 rounded-3xl transition-all border border-slate-200 dark:border-white/10 shadow-sm min-w-[260px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
                <Download className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider">Backup Database</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Unduh seluruh 11 tabel (.json)
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportSql}
              className="group flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white p-7 rounded-3xl transition-all border border-emerald-500/20 dark:border-emerald-500/30 shadow-sm min-w-[260px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/5 border border-emerald-500/30 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
                <DatabaseZap className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Export MySQL (.sql)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Script DDL &amp; Data untuk phpMyAdmin
                </div>
              </div>
            </button>

            <label className="group cursor-pointer flex flex-col items-center justify-center gap-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 p-7 rounded-3xl transition-all border border-rose-500/20 shadow-sm min-w-[260px]">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#0a0e1a] border border-rose-100 dark:border-rose-500/30 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all text-rose-500">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider">Restore Database</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Pulihkan dari file .json &amp; segarkan cache
                </div>
              </div>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                    toast.error('Hanya format file .json yang diterima!');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string);
                      setPendingRestore({ fileName: file.name, data });
                    } catch {
                      toast.error('Gagal memproses file! JSON corrupt.');
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* ── CONTENT: TAB HAK AKSES GURU (KONSEP SEDERHANA: PILIH GURU -> CENTANG MENU) ── */}
      {activeTab === 'rbac' && (() => {
        const rbac: RbacConfig = parseRbacFromSettings(settings);

        const persistRbac = async (next: RbacConfig, savingKey: string, successMsg: string) => {
          const updates = {
            guru_menu_permissions_json: JSON.stringify(next.globalGuru),
            user_menu_overrides_json: JSON.stringify(next.userOverrides),
          };
          setSettings((prev) => ({ ...prev, ...updates }));
          setRbacSavingKey(savingKey);
          try {
            const res = await saveSettingsAction(updates);
            if (res.success) {
              toast.success(successMsg);
            } else {
              toast.error(res.message || 'Gagal menyimpan hak akses.');
            }
          } catch (err: any) {
            toast.error(err?.message || 'Gagal menyimpan hak akses.');
          } finally {
            setRbacSavingKey('');
          }
        };

        // Klik 1x: beri / cabut akses menu untuk SATU guru (langsung tersimpan otomatis)
        const toggleGuruMenu = (guru: { id_user: string; nama: string }, menuKey: FlexibleMenuKey, label: string) => {
          const nextOverrides = { ...rbac.userOverrides };
          const current = { ...(nextOverrides[guru.id_user] || {}) };
          const isOn = current[menuKey] === true;
          if (isOn) {
            delete current[menuKey];
          } else {
            current[menuKey] = true;
          }
          if (Object.keys(current).length === 0) {
            delete nextOverrides[guru.id_user];
          } else {
            nextOverrides[guru.id_user] = current;
          }
          persistRbac(
            { ...rbac, userOverrides: nextOverrides },
            `${guru.id_user}:${menuKey}`,
            isOn
              ? `Akses "${label}" dicabut dari ${guru.nama}.`
              : `Akses "${label}" diberikan ke ${guru.nama}.`
          );
        };

        const clearGuruAccess = (guru: { id_user: string; nama: string }) => {
          const nextOverrides = { ...rbac.userOverrides };
          delete nextOverrides[guru.id_user];
          persistRbac(
            { ...rbac, userOverrides: nextOverrides },
            `${guru.id_user}:ALL`,
            `Semua akses tambahan ${guru.nama} dicabut.`
          );
        };

        const toggleGlobalMenu = (menuKey: FlexibleMenuKey, label: string) => {
          const nextVal = !rbac.globalGuru[menuKey];
          persistRbac(
            { ...rbac, globalGuru: { ...rbac.globalGuru, [menuKey]: nextVal } },
            `GLOBAL:${menuKey}`,
            nextVal
              ? `"${label}" dibuka untuk SEMUA guru.`
              : `"${label}" ditutup untuk semua guru.`
          );
        };

        const keyword = guruRbacSearch.trim().toLowerCase();
        const filteredGurus = guruUsers.filter(
          (g) =>
            !keyword ||
            g.nama.toLowerCase().includes(keyword) ||
            g.username.toLowerCase().includes(keyword)
        );
        const gurusWithAccess = guruUsers.filter(
          (g) => Object.values(rbac.userOverrides[g.id_user] || {}).some((v) => v === true)
        );
        const globalOnCount = FLEXIBLE_MENU_DEFINITIONS.filter((m) => rbac.globalGuru[m.key]).length;

        return (
          <div className="bg-white dark:bg-[#0a0e1a]/80 lg:backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-sm dark:shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.05]">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  <span>Hak Akses Guru</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Cari nama guru, lalu <b>klik menu</b> yang ingin diberikan. Langsung tersimpan otomatis —
                  hanya guru tersebut yang mendapat akses, guru lain tidak terpengaruh.
                </p>
              </div>
              <div className="relative w-full lg:w-80">
                <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={guruRbacSearch}
                  onChange={(e) => setGuruRbacSearch(e.target.value)}
                  placeholder="Cari nama / username guru..."
                  className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Ringkasan guru yang sudah punya akses tambahan */}
            {gurusWithAccess.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                  Guru dengan akses tambahan ({gurusWithAccess.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {gurusWithAccess.map((g) => {
                    const menus = FLEXIBLE_MENU_DEFINITIONS.filter(
                      (m) => rbac.userOverrides[g.id_user]?.[m.key] === true
                    ).map((m) => m.label);
                    return (
                      <button
                        key={g.id_user}
                        type="button"
                        onClick={() => setGuruRbacSearch(g.nama)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold text-slate-700 dark:text-slate-200 text-left cursor-pointer hover:border-emerald-400"
                        title="Klik untuk menampilkan guru ini"
                      >
                        <span className="font-black text-emerald-700 dark:text-emerald-400">{g.nama}</span>
                        <span className="text-slate-500 dark:text-slate-400"> — {menus.join(', ')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daftar Guru: klik chip menu untuk memberi / mencabut akses */}
            {guruUsers.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 text-xs text-slate-500 text-center">
                Belum ada akun Guru terdaftar. Tambahkan guru di menu <b>Manajemen Guru</b>.
              </div>
            ) : filteredGurus.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 text-xs text-slate-500 text-center">
                Tidak ada guru yang cocok dengan &quot;{guruRbacSearch}&quot;.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredGurus.map((g) => {
                  const userPerms = rbac.userOverrides[g.id_user] || {};
                  const extraCount = Object.values(userPerms).filter((v) => v === true).length;
                  return (
                    <div
                      key={g.id_user}
                      className={`p-3.5 rounded-2xl border transition-colors ${
                        extraCount > 0
                          ? 'bg-indigo-50/50 dark:bg-indigo-500/[0.07] border-indigo-200 dark:border-indigo-500/30'
                          : 'bg-slate-50/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                            {(g.nama || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                              {g.nama}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                              @{g.username} • {extraCount > 0 ? `${extraCount} akses tambahan` : 'Akses standar guru'}
                            </div>
                          </div>
                        </div>
                        {extraCount > 0 && (
                          <button
                            type="button"
                            disabled={Boolean(rbacSavingKey)}
                            onClick={() => clearGuruAccess(g)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-black text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            Cabut Semua
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {FLEXIBLE_MENU_DEFINITIONS.map((menu) => {
                          const viaGlobal = Boolean(rbac.globalGuru[menu.key]);
                          const isOn = userPerms[menu.key] === true;
                          const isSavingThis = rbacSavingKey === `${g.id_user}:${menu.key}`;
                          if (viaGlobal) {
                            return (
                              <span
                                key={menu.key}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"
                                title="Sudah dibuka untuk semua guru"
                              >
                                <CheckCircle2 className="w-3 h-3" /> {menu.label} (semua guru)
                              </span>
                            );
                          }
                          return (
                            <button
                              key={menu.key}
                              type="button"
                              disabled={Boolean(rbacSavingKey)}
                              onClick={() => toggleGuruMenu(g, menu.key, menu.label)}
                              title={menu.description}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border inline-flex items-center gap-1 transition-all cursor-pointer disabled:cursor-wait ${
                                isOn
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                                  : 'bg-white dark:bg-[#0a0e1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                              }`}
                            >
                              {isSavingThis ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : isOn ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <span className="text-[11px] leading-none">+</span>
                              )}
                              {menu.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Opsi lanjutan: buka menu untuk SEMUA guru sekaligus (disembunyikan default) */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowGlobalRbac((v) => !v)}
                className="text-[11px] font-black text-slate-500 dark:text-slate-400 hover:text-indigo-600 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {showGlobalRbac ? 'Sembunyikan' : 'Tampilkan'} opsi lanjutan: buka menu untuk SEMUA guru sekaligus
                {globalOnCount > 0 ? ` (${globalOnCount} aktif)` : ''}
              </button>

              {showGlobalRbac && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                    Perhatian: menu yang diaktifkan di sini akan terbuka untuk <b>seluruh akun guru</b>.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {FLEXIBLE_MENU_DEFINITIONS.map((menu) => {
                      const on = Boolean(rbac.globalGuru[menu.key]);
                      return (
                        <button
                          key={menu.key}
                          type="button"
                          disabled={Boolean(rbacSavingKey)}
                          onClick={() => toggleGlobalMenu(menu.key, menu.label)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border inline-flex items-center gap-1 cursor-pointer disabled:cursor-wait ${
                            on
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'bg-white dark:bg-[#0a0e1a] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-amber-400'
                          }`}
                        >
                          {on ? <CheckCircle2 className="w-3 h-3" /> : <span className="text-[11px] leading-none">+</span>}
                          {menu.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <ConfirmDialog
        isOpen={Boolean(pendingRestore)}
        title="Restore Database Live?"
        description={
          pendingRestore
            ? `TINDAKAN BERBAHAYA! Seluruh data aktif akan ditimpa oleh isi file [${pendingRestore.fileName}] dan cache server akan disegarkan ulang.`
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
