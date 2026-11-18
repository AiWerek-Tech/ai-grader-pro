'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IdCard,
  Printer,
  Save,
  Search,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Users,
  Edit3,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Layers,
  CalendarClock,
  Plus,
  Trash2,
  Building2,
  ShieldCheck,
  ExternalLink,
  QrCode,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { withBasePath } from '@/lib/base-path';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { KartuPesertaSheet } from '@/components/kartu/KartuPesertaSheet';
import { JadwalUjianUnitConfig } from '@/lib/jadwal-ujian-utils';
import {
  getKartuPesertaBundleAction,
  rotateKartuQrEpochAction,
  saveKartuPesertaSettingsAction,
} from '@/lib/actions/kartu-peserta';
import {
  buildClassAbsenMap,
  getDefaultKartuConfig,
  getDefaultScheduleRows,
  getStudentInitials,
  getCardTheme,
  KartuLayoutMode,
  KartuPesertaConfig,
  KartuRoomMode,
  KartuSignerMode,
  KartuStudentItem,
  KartuStudentOverride,
  KartuThemeMode,
  normalizePortalBaseUrl,
} from '@/lib/kartu-peserta-utils';

export default function KartuPesertaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [students, setStudents] = useState<KartuStudentItem[]>([]);
  const [kelasList, setKelasList] = useState<{ id_kelas: string; nama_kelas: string; jenjang: string }[]>([]);
  const [mapelList, setMapelList] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [academicSession, setAcademicSession] = useState({ tahunAjaran: '2026/2027', semester: 'GANJIL' });

  const [config, setConfig] = useState<KartuPesertaConfig>(() => getDefaultKartuConfig());
  const [overrides, setOverrides] = useState<Record<string, KartuStudentOverride>>({});
  const [jadwalMaster, setJadwalMaster] = useState<{
    SMP?: JadwalUjianUnitConfig;
    SMA?: JadwalUjianUnitConfig;
  }>({});
  const [qrTokensByStudentId, setQrTokensByStudentId] = useState<Record<string, string>>({});
  const [suggestedUrls, setSuggestedUrls] = useState<{
    recommendedUrl: string;
    lanUrl: string;
    cloudUrl: string;
  }>({
    recommendedUrl: '',
    lanUrl: '',
    cloudUrl: 'https://app.wmvaa.id/ai-grader',
  });
  const [rotatingEpoch, setRotatingEpoch] = useState(false);
  const [copiedSampleUrl, setCopiedSampleUrl] = useState(false);

  // Filter & Selection State
  const [activeTab, setActiveTab] = useState<'PESERTA' | 'PENGATURAN' | 'JADWAL'>('PESERTA');
  const [filterJenjang, setFilterJenjang] = useState<'ALL' | 'SMP' | 'SMA'>('ALL');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Preview Pagination & Auto-Scale
  const [previewMode, setPreviewMode] = useState<'SINGLE_PAGE' | 'ALL_PAGES'>('SINGLE_PAGE');
  const [previewPageIdx, setPreviewPageIdx] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.72);

  // Per-student Override Modal
  const [editingStudent, setEditingStudent] = useState<KartuStudentItem | null>(null);
  const [editDraft, setEditDraft] = useState<KartuStudentOverride>({});

  useEffect(() => {
    let active = true;
    async function loadBundle() {
      setLoading(true);
      setErrorMsg('');
      const res = await getKartuPesertaBundleAction();
      if (!active) return;

      if (!res.success || !res.data) {
        setErrorMsg(res.message || 'Gagal memuat data Kartu Peserta.');
        setLoading(false);
        return;
      }

      const d = res.data;
      setStudents(d.students);
      setKelasList(d.kelasList);
      setMapelList(d.mapelList || []);
      setSettings(d.settings);
      setAcademicSession(d.academicSession);
      setConfig(d.config);
      setOverrides(d.overrides);
      if ((d as any).jadwalMaster) {
        setJadwalMaster((d as any).jadwalMaster);
      }
      setQrTokensByStudentId(d.qrTokensByStudentId || {});
      if (d.suggestedUrls) {
        setSuggestedUrls(d.suggestedUrls);
      }

      setSelectedIds(new Set(d.students.map((s) => s.id_siswa)));
      setLoading(false);
    }

    loadBundle();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;

    const updateScale = () => {
      const availableWidth = Math.max(260, el.clientWidth - 24);
      const a4WidthPx = 794;
      const computed = Math.min(1, availableWidth / a4WidthPx);
      setPreviewScale(Number(computed.toFixed(3)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const visibleKelasOptions = useMemo(() => {
    if (filterJenjang === 'ALL') return kelasList;
    return kelasList.filter((k) => k.jenjang === filterJenjang);
  }, [kelasList, filterJenjang]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (filterJenjang !== 'ALL' && s.jenjang !== filterJenjang) return false;
      if (filterKelas !== 'ALL' && s.id_kelas !== filterKelas) return false;
      if (q) {
        const hay = `${s.nama} ${s.nis} ${s.nama_kelas}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, filterJenjang, filterKelas, searchQuery]);

  const selectedStudents = useMemo(() => {
    return students.filter((s) => selectedIds.has(s.id_siswa));
  }, [students, selectedIds]);

  const classAbsenMap = useMemo(() => buildClassAbsenMap(students), [students]);

  const isPairLayout = config.layoutMode === 'FRONT_BACK_JADWAL';
  const isBackOnly = config.layoutMode === 'BACK_ONLY';
  const hasBackSchedule = config.layoutMode !== 'FRONT_ONLY';
  const rowsPerPage = config.rowsPerPage === 3 ? 3 : 4;
  const studentsPerPage = isPairLayout ? rowsPerPage : rowsPerPage * 2;
  const totalPages = Math.max(1, Math.ceil(selectedStudents.length / studentsPerPage));

  useEffect(() => {
    if (previewPageIdx >= totalPages) {
      setPreviewPageIdx(Math.max(0, totalPages - 1));
    }
  }, [totalPages, previewPageIdx]);

  const previewStudents = useMemo(() => {
    if (previewMode === 'ALL_PAGES') return selectedStudents;
    const start = previewPageIdx * studentsPerPage;
    return selectedStudents.slice(start, start + studentsPerPage);
  }, [selectedStudents, previewMode, previewPageIdx, studentsPerPage]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredStudents.forEach((s) => next.add(s.id_siswa));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredStudents.forEach((s) => next.delete(s.id_siswa));
      return next;
    });
  };

  const handleSaveSettings = async (overrideMap = overrides) => {
    setSaving(true);
    const res = await saveKartuPesertaSettingsAction(config, overrideMap);
    setSaving(false);
    if (res.success) {
      showToast('success', 'Pengaturan desain & jadwal Kartu Peserta berhasil disimpan.');
    } else {
      showToast('error', res.message || 'Gagal menyimpan pengaturan.');
    }
  };

  const openEditStudent = (s: KartuStudentItem) => {
    setEditingStudent(s);
    setEditDraft(overrides[s.id_siswa] || {});
  };

  const applyEditStudent = () => {
    if (!editingStudent) return;
    const nextOverrides = { ...overrides };
    const clean: KartuStudentOverride = {
      noAbsen: editDraft.noAbsen?.trim() || undefined,
      noPeserta: editDraft.noPeserta?.trim() || undefined,
      ruang: editDraft.ruang?.trim() || undefined,
      meja: editDraft.meja?.trim() || undefined,
    };
    if (clean.noAbsen || clean.noPeserta || clean.ruang || clean.meja) {
      nextOverrides[editingStudent.id_siswa] = clean;
    } else {
      delete nextOverrides[editingStudent.id_siswa];
    }
    setOverrides(nextOverrides);
    setEditingStudent(null);
    showToast('success', `Detail kartu ${editingStudent.nama} diperbarui.`);
  };

  const syncKopFromSchoolSettings = () => {
    setConfig((prev) => ({
      ...prev,
      kopYayasan: settings['nama_yayasan'] || 'YAYASAN PENDIDIKAN ADVENT PAPUA',
      kopAkademi:
        settings['sma_nama_sekolah_1'] ||
        settings['smp_nama_sekolah_1'] ||
        settings['nama_sekolah_1'] ||
        'Wamena Mountain View Adventist Academy',
      kopNamaSekolah: '',
      kopAlamat:
        settings['alamat_sekolah'] ||
        'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya',
      kotaCetak: settings['kota_sekolah'] || 'Wamena',
    }));
    showToast('success', 'Teks Kop & Kota disinkronkan ulang dari Pengaturan Sekolah.');
  };

  const effectivePortalBaseUrl = useMemo(() => {
    const manual = normalizePortalBaseUrl(config.publicBaseUrl);
    if (manual) return manual;
    if (suggestedUrls.recommendedUrl) return suggestedUrls.recommendedUrl;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${withBasePath('')}`.replace(/\/+$/, '');
    }
    return suggestedUrls.cloudUrl;
  }, [config.publicBaseUrl, suggestedUrls]);

  const handleRotateQrEpoch = async () => {
    setRotatingEpoch(true);
    const res = await rotateKartuQrEpochAction();
    setRotatingEpoch(false);
    if (res.success && res.data) {
      setConfig((prev) => ({ ...prev, qrTokenEpoch: res.data!.qrTokenEpoch }));
      setQrTokensByStudentId(res.data.qrTokensByStudentId);
      showToast(
        'success',
        `Token QR diperbarui ke versi v${res.data.qrTokenEpoch}. Kartu cetakan lama otomatis dinonaktifkan.`
      );
    } else {
      showToast('error', res.message || 'Gagal memutar kunci token QR.');
    }
  };

  const handleOpenSamplePortal = () => {
    const sampleStudent = selectedStudents[0] || students[0];
    if (!sampleStudent) {
      showToast('error', 'Belum ada data siswa untuk pratinjau portal QR.');
      return;
    }
    const token = qrTokensByStudentId[sampleStudent.id_siswa];
    if (!token) {
      showToast('error', 'Token QR siswa belum tersedia.');
      return;
    }
    window.open(withBasePath(`/kartu/v/${token}`), '_blank', 'noopener,noreferrer');
  };

  const sampleQrFullUrl = useMemo(() => {
    const sampleStudent = selectedStudents[0] || students[0];
    if (!sampleStudent || !effectivePortalBaseUrl) return '';
    const token = qrTokensByStudentId[sampleStudent.id_siswa];
    if (!token) return '';
    return `${effectivePortalBaseUrl.replace(/\/+$/, '')}/kartu/v/${token}`;
  }, [selectedStudents, students, qrTokensByStudentId, effectivePortalBaseUrl]);

  const isLocalhostUrl =
    effectivePortalBaseUrl.includes('localhost') || effectivePortalBaseUrl.includes('127.0.0.1');

  const handleCopySampleUrl = async () => {
    if (!sampleQrFullUrl) return;
    try {
      await navigator.clipboard.writeText(sampleQrFullUrl);
      setCopiedSampleUrl(true);
      setTimeout(() => setCopiedSampleUrl(false), 2000);
      showToast('success', 'Link QR verifikasi berhasil disalin ke clipboard.');
    } catch {
      showToast('error', 'Gagal menyalin link QR.');
    }
  };

  const resetAllOverrides = () => {
    setOverrides({});
    showToast('success', 'Semua custom No. Peserta / Ruang per siswa direset ke otomatis.');
  };

  // Jadwal handlers
  const updateJadwalRow = (idx: number, field: 'hariTanggal' | 'mapel' | 'waktu', value: string) => {
    const nextRows = [...config.jadwalRows];
    nextRows[idx] = { ...nextRows[idx], [field]: value };
    setConfig({ ...config, jadwalRows: nextRows });
  };

  const addJadwalRow = () => {
    setConfig({
      ...config,
      jadwalRows: [
        ...config.jadwalRows,
        {
          id: `sch-${Date.now()}`,
          hariTanggal: 'Hari Berikutnya',
          mapel: mapelList[config.jadwalRows.length % Math.max(1, mapelList.length)] || 'Mata Pelajaran',
          waktu: '08.00 – 09.30',
        },
      ],
    });
  };

  const removeJadwalRow = (idx: number) => {
    setConfig({
      ...config,
      jadwalRows: config.jadwalRows.filter((_, i) => i !== idx),
    });
  };

  const loadFromMapelSheet = () => {
    setConfig({
      ...config,
      jadwalRows: getDefaultScheduleRows(mapelList),
    });
    showToast('success', 'Baris jadwal diisi otomatis dari daftar Mata Pelajaran sekolah.');
  };

  const handlePrint = () => {
    if (selectedStudents.length === 0) {
      showToast('error', 'Pilih minimal 1 siswa terlebih dahulu sebelum mencetak.');
      return;
    }
    window.print();
  };

  if (loading) {
    return (
      <DashboardLoadingState
        title="Menyiapkan Studio Kartu Asesmen..."
        subtitle="Memuat direktori siswa aktif, kop SMP/SMA, dan tata letak landscape A4"
        accentClass="border-t-indigo-500"
      />
    );
  }

  if (errorMsg) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-3xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-rose-900 dark:text-rose-200">
            Gagal Memuat Kartu Peserta
          </h2>
          <p className="text-sm text-rose-700 dark:text-rose-300">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const a4HeightPx = 1122;
  const pageCountRendered = Math.max(1, Math.ceil(previewStudents.length / studentsPerPage));
  const scaledHeight = Math.round(pageCountRendered * a4HeightPx * previewScale + (pageCountRendered - 1) * 16);

  return (
    <div className="min-h-screen">
      {/* SCREEN UI (Tersembunyi saat print) */}
      <div className="p-4 sm:p-6 lg:p-10 max-w-[1600px] mx-auto space-y-6 print:hidden">
        <PageHeader
          icon={<IdCard className="w-6 h-6 sm:w-7 sm:h-7" />}
          iconBgClass="bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          title="Kartu Peserta Asesmen"
          description={`Desain landscape tampak depan resmi WMVAA (SMP Biru · SMA Maroon) dengan QR Verifikasi & opsi tambahan halaman belakang jadwal untuk TA ${academicSession.tahunAjaran} (${academicSession.semester}).`}
          actions={
            <>
              <button
                type="button"
                onClick={() => handleSaveSettings(overrides)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-extrabold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {saving ? 'Menyimpan...' : 'Simpan Default'}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={selectedStudents.length === 0}
                className="px-5 py-2.5 rounded-xl btn-indigo text-xs font-black flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak A4 / PDF ({selectedStudents.length})
              </button>
            </>
          }
        />

        {/* Toast Feedback */}
        {toast && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-xs sm:text-sm font-bold shadow-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{toast.text}</span>
          </div>
        )}

        {/* KPI Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Siswa Aktif
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                {students.length}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Peserta Cetak
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                {selectedStudents.length} Siswa
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lembar A4
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                {selectedStudents.length === 0 ? 0 : totalPages} Hal
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kapasitas / A4
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                {studentsPerPage} {isPairLayout ? 'Pasang' : 'Kartu'}
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-Column Studio */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT: Selection, Config & Schedule */}
          <div className="xl:col-span-5 bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
            {/* Tab Switcher (2 Tab Default Fokus Depan, Tab Jadwal Muncul Saat Mode Belakang/Jadwal Aktif) */}
            <div
              className={`grid ${
                hasBackSchedule ? 'grid-cols-3' : 'grid-cols-2'
              } border-b border-slate-200 dark:border-white/[0.07] bg-slate-50/80 dark:bg-white/[0.02] p-1.5 gap-1`}
            >
              <button
                type="button"
                onClick={() => setActiveTab('PESERTA')}
                className={`py-2 px-2 rounded-2xl text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'PESERTA'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm border border-slate-200/80 dark:border-indigo-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">1. Peserta</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PENGATURAN')}
                className={`py-2 px-2 rounded-2xl text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'PENGATURAN'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm border border-slate-200/80 dark:border-indigo-500'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">2. Desain Kartu</span>
              </button>
              {hasBackSchedule && (
                <button
                  type="button"
                  onClick={() => setActiveTab('JADWAL')}
                  className={`py-2 px-2 rounded-2xl text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTab === 'JADWAL'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm border border-slate-200/80 dark:border-indigo-500'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">3. Jadwal</span>
                </button>
              )}
            </div>

            {activeTab === 'PESERTA' && (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Unit Jenjang
                    </label>
                    <select
                      value={filterJenjang}
                      onChange={(e) => {
                        setFilterJenjang(e.target.value as 'ALL' | 'SMP' | 'SMA');
                        setFilterKelas('ALL');
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="ALL">Semua Unit (SMP & SMA)</option>
                      <option value="SMP">SMP Advent Sogokmo</option>
                      <option value="SMA">SMA Advent Sogokmo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Filter Kelas
                    </label>
                    <select
                      value={filterKelas}
                      onChange={(e) => setFilterKelas(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="ALL">Semua Kelas ({visibleKelasOptions.length})</option>
                      {visibleKelasOptions.map((k) => (
                        <option key={k.id_kelas} value={k.id_kelas}>
                          {k.nama_kelas} ({k.jenjang})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama siswa atau NIS..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Pilih Semua ({filteredStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllFiltered}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 text-[11px] font-extrabold hover:bg-slate-200 dark:hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Kosongkan
                    </button>
                  </div>

                  {Object.keys(overrides).length > 0 && (
                    <button
                      type="button"
                      onClick={resetAllOverrides}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset {Object.keys(overrides).length} Override
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-white/[0.07] rounded-2xl divide-y divide-slate-100 dark:divide-white/[0.05] max-h-[430px] overflow-y-auto touch-scroll">
                  {filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-xs font-semibold text-slate-500">
                      Tidak ada siswa yang sesuai filter.
                    </div>
                  ) : (
                    filteredStudents.map((s) => {
                      const checked = selectedIds.has(s.id_siswa);
                      const hasOv = Boolean(overrides[s.id_siswa]);
                      const theme = getCardTheme(s.jenjang, config.themeMode);
                      return (
                        <div
                          key={s.id_siswa}
                          className={`flex items-center gap-3 px-3 py-2.5 transition ${
                            checked
                              ? 'bg-indigo-50/40 dark:bg-indigo-500/[0.07]'
                              : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleStudent(s.id_siswa)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                checked
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-white/20 bg-white dark:bg-transparent'
                              }`}
                            >
                              {checked && <CheckSquare className="w-3.5 h-3.5" />}
                            </div>
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 shadow-xs text-white"
                              style={{ backgroundColor: theme.primaryDark }}
                            >
                              {getStudentInitials(s.nama)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate uppercase">
                                {s.nama}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                <span className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-slate-200 font-mono text-[9px] font-black">
                                  #{String(overrides[s.id_siswa]?.noAbsen || classAbsenMap[s.id_siswa] || 1).padStart(2, '0')}
                                </span>
                                <span className="font-mono">{s.nis || 'Tanpa NIS'}</span>
                                <span>•</span>
                                <span>{s.nama_kelas}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                    s.jenjang === 'SMP'
                                      ? 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300'
                                      : 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300'
                                  }`}
                                >
                                  {s.jenjang}
                                </span>
                                {hasOv && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[9px] font-black">
                                    Custom
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditStudent(s)}
                            title="Atur No. Peserta / Ruang / Meja khusus siswa ini"
                            className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 transition shrink-0 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'PENGATURAN' && (
              <div className="p-4 sm:p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Mode Halaman Kartu
                  </label>
                  <select
                    value={config.layoutMode}
                    onChange={(e) =>
                      setConfig({ ...config, layoutMode: e.target.value as KartuLayoutMode })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="FRONT_ONLY">
                      Tampak Depan Saja — 2 Kolom (Default)
                    </option>
                    <option value="BACK_ONLY">
                      Halaman Belakang / Bagian Jadwal Saja — 2 Kolom
                    </option>
                    <option value="FRONT_BACK_JADWAL">
                      Depan + Belakang Berdampingan — Siap Lipat
                    </option>
                  </select>
                </div>

                {isBackOnly && (
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.backMirrorDuplex}
                      onChange={(e) =>
                        setConfig({ ...config, backMirrorDuplex: e.target.checked })
                      }
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <span className="block text-[11px] font-black text-indigo-950 dark:text-indigo-200">
                        Mirror Kolom Otomatis (Cetak 2 Sisi / Bolak-Balik A4)
                      </span>
                      <span className="block text-[10px] text-indigo-800/80 dark:text-indigo-300/80 leading-snug mt-0.5">
                        Aktifkan bila dicetak langsung di balik kertas <b>Tampak Depan Saja</b>{' '}
                        (menukar kolom Kiri ↔ Kanan agar depan &amp; jadwal tiap siswa pas). Nonaktifkan jika dicetak terpisah di kertas kosong.
                      </span>
                    </div>
                  </label>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Tema Warna Kartu
                    </label>
                    <select
                      value={config.themeMode}
                      onChange={(e) =>
                        setConfig({ ...config, themeMode: e.target.value as KartuThemeMode })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="AUTO_JENJANG">Otomatis (SMP Biru · SMA Maroon)</option>
                      <option value="NAVY_BLUE">Selalu Biru Navy (Gambar 1)</option>
                      <option value="MAROON">Selalu Maroon (Gambar 4)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Ukuran / Baris per A4
                    </label>
                    <select
                      value={config.rowsPerPage}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rowsPerPage: Number(e.target.value) === 3 ? 3 : 4,
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value={4}>
                        {isPairLayout ? '4 Pasang / A4 (Ramping 64mm)' : '8 Kartu / A4 (Ramping 64mm)'}
                      </option>
                      <option value={3}>
                        {isPairLayout ? '3 Pasang / A4 (Besar 86mm)' : '6 Kartu / A4 (Besar 86mm)'}
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Pill Jenis Asesmen (Contoh: SAS / SAT / STS)
                  </label>
                  <input
                    type="text"
                    value={config.judulUjian}
                    onChange={(e) => setConfig({ ...config, judulUjian: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    placeholder="SAS (Sumatif Akhir Semester)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Subjudul Kurikulum
                    </label>
                    <input
                      type="text"
                      value={config.kurikulumLabel}
                      onChange={(e) => setConfig({ ...config, kurikulumLabel: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Awalan Nomor Peserta
                    </label>
                    <input
                      type="text"
                      value={config.prefixNomor}
                      onChange={(e) => setConfig({ ...config, prefixNomor: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      placeholder="2026-SAS-"
                    />
                  </div>
                </div>

                {/* ── KOP KARTU & TANGGAL (TERISI DARI PENGATURAN SEKOLAH, DAPAT DIEDIT) ── */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Kop Surat &amp; Tanggal Kartu (Bisa Diedit)
                    </span>
                    <button
                      type="button"
                      onClick={syncKopFromSchoolSettings}
                      className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Ikuti Pengaturan Sekolah</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                        Baris 1 — Nama Yayasan
                      </label>
                      <input
                        type="text"
                        value={config.kopYayasan}
                        onChange={(e) => setConfig({ ...config, kopYayasan: e.target.value })}
                        placeholder="YAYASAN PENDIDIKAN ADVENT PAPUA"
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                        Baris 2 — Wamena Mountain View Adventist Academy
                      </label>
                      <input
                        type="text"
                        value={config.kopAkademi}
                        onChange={(e) => setConfig({ ...config, kopAkademi: e.target.value })}
                        placeholder="Wamena Mountain View Adventist Academy"
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                        Baris 3 — Nama Sekolah (Kosong = Otomatis SMP / SMA)
                      </label>
                      <input
                        type="text"
                        value={config.kopNamaSekolah}
                        onChange={(e) => setConfig({ ...config, kopNamaSekolah: e.target.value })}
                        placeholder="Otomatis: SMP / SMA Advent Sogokmo (Pengaturan Sekolah)"
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                        Baris 4 — Alamat Sekolah
                      </label>
                      <input
                        type="text"
                        value={config.kopAlamat}
                        onChange={(e) => setConfig({ ...config, kopAlamat: e.target.value })}
                        placeholder="Jl. Wamena – Kurima, Kampung Sogokmo..."
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                      <div>
                        <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                          Kota Pengesahan
                        </label>
                        <input
                          type="text"
                          value={config.kotaCetak}
                          onChange={(e) => setConfig({ ...config, kotaCetak: e.target.value })}
                          placeholder="Wamena"
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold uppercase text-slate-500 mb-0.5">
                          Tanggal Ujian / Cetak
                        </label>
                        <input
                          type="text"
                          value={config.tanggalCetak}
                          onChange={(e) => setConfig({ ...config, tanggalCetak: e.target.value })}
                          placeholder="Contoh: 5 – 9 Oktober 2026"
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── DATA LOGO, NPSN & PEJABAT DARI PENGATURAN SEKOLAH ── */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-500/[0.08] border border-indigo-200/80 dark:border-indigo-500/20 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">
                          Identitas, Kop, Logo &amp; Pejabat dari Pengaturan Sekolah
                        </div>
                        <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                          Kota: {settings['kota_sekolah'] || 'Wamena'} • Kop &amp; Logo mengikuti unit SMP/SMA
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/dashboard/settings"
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 border border-indigo-200 dark:border-white/10 text-[10px] font-black text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Ubah</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-[#0a0e1a]/70 border border-slate-200/70 dark:border-white/[0.06]">
                      <div className="font-black text-blue-700 dark:text-blue-300 uppercase">
                        SMP {settings['smp_npsn'] ? `• NPSN ${settings['smp_npsn']}` : ''}
                      </div>
                      <div className="truncate font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                        Kepsek: {settings['smp_kepala_nama'] || settings['kepala_nama'] || 'Belum diisi'}
                      </div>
                      <div className="truncate font-bold text-slate-700 dark:text-slate-300">
                        Panitia: {settings['smp_panitia_nama'] || settings['panitia_nama'] || 'Belum diisi'}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 dark:bg-[#0a0e1a]/70 border border-slate-200/70 dark:border-white/[0.06]">
                      <div className="font-black text-rose-700 dark:text-rose-300 uppercase">
                        SMA {settings['sma_npsn'] ? `• NPSN ${settings['sma_npsn']}` : ''}
                      </div>
                      <div className="truncate font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                        Kepsek: {settings['sma_kepala_nama'] || settings['kepala_nama'] || 'Belum diisi'}
                      </div>
                      <div className="truncate font-bold text-slate-700 dark:text-slate-300">
                        Panitia: {settings['sma_panitia_nama'] || settings['panitia_nama'] || 'Belum diisi'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── OPSI PENGESAHAN: KETUA PANITIA VS KEPALA SEKOLAH ── */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Pejabat Pengesahan Kartu (Pilih Sesuai Keputusan Sekolah)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          value: 'PANITIA' as KartuSignerMode,
                          title: 'Ketua Panitia',
                          smpName: settings['smp_panitia_nama'] || settings['panitia_nama'] || 'Belum diisi',
                          smaName: settings['sma_panitia_nama'] || settings['panitia_nama'] || 'Belum diisi',
                          hasTtd: Boolean(settings['smp_panitia_ttd_url'] || settings['sma_panitia_ttd_url']),
                        },
                        {
                          value: 'KEPALA' as KartuSignerMode,
                          title: 'Kepala Sekolah',
                          smpName: settings['smp_kepala_nama'] || settings['kepala_nama'] || 'Belum diisi',
                          smaName: settings['sma_kepala_nama'] || settings['kepala_nama'] || 'Belum diisi',
                          hasTtd: Boolean(settings['smp_kepala_ttd_url'] || settings['sma_kepala_ttd_url']),
                        },
                      ] as const
                    ).map((opt) => {
                      const active = config.signerMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setConfig({ ...config, signerMode: opt.value })}
                          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                            active
                              ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 ring-1 ring-indigo-500/40'
                              : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-black ${
                                active
                                  ? 'text-indigo-800 dark:text-indigo-200'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {opt.title}
                            </span>
                            <span
                              className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                active ? 'border-indigo-600' : 'border-slate-300 dark:border-white/30'
                              }`}
                            >
                              {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                            </span>
                          </div>
                          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 space-y-0.5">
                            <div className="truncate">SMP: {opt.smpName}</div>
                            <div className="truncate">SMA: {opt.smaName}</div>
                            <div
                              className={`text-[9px] font-extrabold mt-1 ${
                                opt.hasTtd
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {opt.hasTtd ? '✓ TTD Digital Siap' : '○ Tanpa gambar TTD'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Aturan Ruang Ujian
                    </label>
                    <select
                      value={config.roomMode}
                      onChange={(e) =>
                        setConfig({ ...config, roomMode: e.target.value as KartuRoomMode })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="PER_KELAS">Otomatis per Nama Kelas</option>
                      <option value="DEFAULT">Satu Ruang Default</option>
                      <option value="AUTO_CAPACITY">Bagi per Kapasitas Kursi</option>
                    </select>
                  </div>

                  {config.roomMode === 'AUTO_CAPACITY' ? (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Kapasitas / Ruang
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        value={config.kapasitasRuang}
                        onChange={(e) =>
                          setConfig({ ...config, kapasitasRuang: Number(e.target.value) || 24 })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Ruang Default
                      </label>
                      <input
                        type="text"
                        value={config.ruangDefault}
                        onChange={(e) => setConfig({ ...config, ruangDefault: e.target.value })}
                        disabled={config.roomMode === 'PER_KELAS'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white disabled:opacity-50"
                        placeholder="R. 01"
                      />
                    </div>
                  )}
                </div>

                {/* ── PORTAL QR VERIFIKASI SISWA TANPA LOGIN ── */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/65 dark:bg-emerald-500/[0.07] border border-emerald-200/80 dark:border-emerald-500/20 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">
                          Portal Verifikasi &amp; Status Mapel LJK via QR
                        </div>
                        <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                          Token HMAC-SHA256 (v{config.qrTokenEpoch}) — hanya bisa dibuka lewat scan QR
                        </div>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-[#0a0e1a]/70 border border-slate-200 dark:border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.portalEnabled}
                      onChange={(e) => setConfig({ ...config, portalEnabled: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                      Sertakan Link Portal Status Mapel LJK di Kode QR
                    </span>
                  </label>

                  {config.portalEnabled && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-1">
                          Tampilan Nilai di Halaman QR Siswa
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { val: true, label: 'Status LJK + Nilai & Tuntas' },
                            { val: false, label: 'Status Proses Saja (Tanpa Angka)' },
                          ].map((opt) => (
                            <button
                              key={String(opt.val)}
                              type="button"
                              onClick={() => setConfig({ ...config, portalShowScore: opt.val })}
                              className={`py-2 px-2.5 rounded-xl border text-[10.5px] font-extrabold transition cursor-pointer ${
                                config.portalShowScore === opt.val
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white dark:bg-[#0a0e1a] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-1">
                          Alamat URL Server Tujuan QR
                        </label>
                        <input
                          type="text"
                          value={config.publicBaseUrl}
                          onChange={(e) => setConfig({ ...config, publicBaseUrl: e.target.value })}
                          placeholder={suggestedUrls.recommendedUrl || 'https://app.wmvaa.id/ai-grader'}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 text-[11px] font-mono font-bold text-slate-900 dark:text-white"
                        />
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setConfig({ ...config, publicBaseUrl: suggestedUrls.cloudUrl })
                            }
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 cursor-pointer"
                          >
                            Pakai Domain Cloud
                          </button>
                          {suggestedUrls.lanUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfig({ ...config, publicBaseUrl: suggestedUrls.lanUrl })
                              }
                              className="px-2 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 cursor-pointer"
                            >
                              Pakai LAN ({suggestedUrls.lanUrl.replace(/^https?:\/\//, '')})
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={handleOpenSamplePortal}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-white dark:bg-white/10 border border-emerald-300 dark:border-emerald-500/30 text-[11px] font-black text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Tes Buka Portal QR</span>
                        </button>
                        {sampleQrFullUrl && (
                          <button
                            type="button"
                            onClick={handleCopySampleUrl}
                            className="py-1.5 px-3 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/15 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Salin contoh link URL yang tertanam di QR"
                          >
                            {copiedSampleUrl ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedSampleUrl ? 'Tersalin' : 'Salin Link'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={rotatingEpoch}
                          onClick={handleRotateQrEpoch}
                          className="py-1.5 px-3 rounded-xl bg-white dark:bg-white/10 border border-amber-300 dark:border-amber-500/30 text-[11px] font-black text-amber-800 dark:text-amber-300 hover:bg-amber-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          title="Cabut seluruh QR cetakan lama agar hanya kartu baru yang berlaku"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${rotatingEpoch ? 'animate-spin' : ''}`} />
                          <span>Cabut QR Lama</span>
                        </button>
                      </div>

                      {sampleQrFullUrl && (
                        <div className="p-2 rounded-xl bg-white/75 dark:bg-black/30 border border-slate-200/80 dark:border-white/10 text-[10px]">
                          <div className="font-bold text-slate-500 mb-0.5">
                            URL Otomatis Saat QR Dipindai ({sampleQrFullUrl.length} karakter):
                          </div>
                          <div className="font-mono text-[9.5px] text-slate-800 dark:text-slate-200 break-all">
                            {sampleQrFullUrl}
                          </div>
                          {isLocalhostUrl && (
                            <div className="mt-1 text-amber-700 dark:text-amber-300 font-bold">
                              ⚠️ Alamat memakai localhost (hanya terbuka di PC ini). Pilih tombol &quot;Pakai LAN&quot; atau &quot;Domain Cloud&quot; agar langsung terbuka saat discan HP.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showInitialsBadge}
                    onChange={(e) => setConfig({ ...config, showInitialsBadge: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Tampilkan lencana Avatar Inisial di samping Nama Peserta
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleSaveSettings(overrides)}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl btn-indigo text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Pengaturan ke Database'}
                </button>
              </div>
            )}

            {activeTab === 'JADWAL' && (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wide">
                      Jadwal Sisi Belakang (Gaya Gambar 4)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Pilih sumber jadwal: otomatis per kelas dari menu Jadwal Ujian, atau daftar kustom manual.
                    </p>
                  </div>
                  {config.jadwalSource === 'CUSTOM' && (
                    <button
                      type="button"
                      onClick={loadFromMapelSheet}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.07] text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer"
                    >
                      Isi dari Mapel
                    </button>
                  )}
                </div>

                {/* Sumber Jadwal Toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, jadwalSource: 'MASTER_JADWAL' })}
                    className={`py-2 px-3 rounded-xl text-[11px] font-black transition cursor-pointer ${
                      config.jadwalSource !== 'CUSTOM'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                    }`}
                  >
                    Otomatis (Jadwal Ujian)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, jadwalSource: 'CUSTOM' })}
                    className={`py-2 px-3 rounded-xl text-[11px] font-black transition cursor-pointer ${
                      config.jadwalSource === 'CUSTOM'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                    }`}
                  >
                    Kustom Kartu
                  </button>
                </div>

                {!hasBackSchedule && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    Saat ini mode aktif adalah <b>Depan Saja</b>. Ubah ke{' '}
                    <b>Halaman Belakang Saja</b> atau <b>Depan + Belakang</b> di tab{' '}
                    <b>2. Desain Kartu</b> agar jadwal ikut dicetak.
                  </div>
                )}

                {config.jadwalSource !== 'CUSTOM' ? (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/30 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                          Terhubung ke Modul Jadwal Ujian
                        </p>
                        <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                          Sisi belakang kartu otomatis menyesuaikan mata pelajaran per unit (<b>SMP</b> / <b>SMA</b>) dan tingkatan kelas masing-masing peserta (<b>VII</b>, <b>VIII-IX</b>, <b>X</b>, <b>XI</b>, <b>XII</b>). Jika lebih dari {rowsPerPage === 3 ? 7 : 5} mapel, tabel otomatis dibagi 2 kolom agar semua mapel muat rapi.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.05] border border-indigo-100 dark:border-white/10">
                        <div className="font-black text-slate-900 dark:text-white">UNIT SMP</div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {jadwalMaster.SMP?.days.length || 0} hari • {jadwalMaster.SMP?.columns.join(', ') || '-'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.05] border border-indigo-100 dark:border-white/10">
                        <div className="font-black text-slate-900 dark:text-white">UNIT SMA</div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          {jadwalMaster.SMA?.days.length || 0} hari • {jadwalMaster.SMA?.columns.join(', ') || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href="/dashboard/jadwal-ujian"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Buka &amp; Edit Master Jadwal
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleSaveSettings(overrides)}
                        disabled={saving}
                        className="py-2.5 px-3 rounded-xl btn-indigo text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? '...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {config.jadwalRows.map((row, idx) => (
                    <div
                      key={row.id || idx}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          Sesi #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeJadwalRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          title="Hapus baris jadwal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={row.hariTanggal}
                          onChange={(e) => updateJadwalRow(idx, 'hariTanggal', e.target.value)}
                          placeholder="Sen, 10 Jan 2027"
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={row.waktu}
                          onChange={(e) => updateJadwalRow(idx, 'waktu', e.target.value)}
                          placeholder="08.00 - 09.30"
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-[11px] font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                      <input
                        type="text"
                        value={row.mapel}
                        onChange={(e) => updateJadwalRow(idx, 'mapel', e.target.value)}
                        placeholder="Nama Mata Pelajaran"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addJadwalRow}
                    className="flex-1 py-2 rounded-xl border border-dashed border-indigo-400 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveSettings(overrides)}
                    disabled={saving}
                    className="flex-1 py-2 rounded-xl btn-indigo text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
                  </button>
                </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Live A4 Preview */}
          <div className="xl:col-span-7 bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Pratinjau Kertas A4 Landscape
                </h2>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {isPairLayout
                    ? 'Mode 2 Sisi Berdampingan: Sisi Depan (kiri) & Belakang Jadwal (kanan) siap lipat/potong per siswa.'
                    : isBackOnly
                    ? config.backMirrorDuplex
                      ? 'Mode Halaman Belakang Saja (Mirror Bolak-Balik Aktif): Kanan ↔ Kiri ditukar presisi agar pas di balik kertas Depan.'
                      : 'Mode Halaman Belakang / Jadwal Saja: Urutan standar 2 kolom untuk cetak terpisah di kertas kosong.'
                    : 'Mode Tampak Depan Landscape: Desain Formal Minimalis otomatis SMP Biru / SMA Maroon.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-white/[0.06] p-1 text-[11px] font-extrabold">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('SINGLE_PAGE')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      previewMode === 'SINGLE_PAGE'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Per Halaman
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('ALL_PAGES')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      previewMode === 'ALL_PAGES'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Semua ({totalPages})
                  </button>
                </div>

                {previewMode === 'SINGLE_PAGE' && totalPages > 1 && (
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-xl text-xs font-extrabold">
                    <button
                      type="button"
                      disabled={previewPageIdx === 0}
                      onClick={() => setPreviewPageIdx((p) => Math.max(0, p - 1))}
                      className="px-1.5 py-0.5 rounded hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                    >
                      ‹
                    </button>
                    <span>
                      Hal {previewPageIdx + 1}/{totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={previewPageIdx >= totalPages - 1}
                      onClick={() => setPreviewPageIdx((p) => Math.min(totalPages - 1, p + 1))}
                      className="px-1.5 py-0.5 rounded hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              ref={previewContainerRef}
              className="w-full rounded-2xl bg-slate-200/80 dark:bg-black/40 border border-slate-300/70 dark:border-white/[0.06] p-3 overflow-hidden"
            >
              {selectedStudents.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <IdCard className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                    Belum ada peserta yang dipilih
                  </p>
                  <p className="text-xs text-slate-500">
                    Centang siswa di tab <b>1. Peserta</b> untuk menampilkan pratinjau kartu A4.
                  </p>
                </div>
              ) : (
                <div
                  className="mx-auto relative overflow-hidden"
                  style={{
                    width: `${Math.round(794 * previewScale)}px`,
                    height: `${scaledHeight}px`,
                  }}
                >
                  <div
                    className="origin-top-left space-y-4 [&_.kartu-page]:shadow-xl"
                    style={{
                      width: '794px',
                      transform: `scale(${previewScale})`,
                    }}
                  >
                    <KartuPesertaSheet
                      students={previewStudents}
                      config={config}
                      overrides={overrides}
                      settings={settings}
                      academicSession={academicSession}
                      indexOffset={previewMode === 'SINGLE_PAGE' ? previewPageIdx * studentsPerPage : 0}
                      classAbsenMap={classAbsenMap}
                      qrTokensByStudentId={qrTokensByStudentId}
                      portalBaseUrl={effectivePortalBaseUrl}
                      jadwalMaster={jadwalMaster}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL EDIT OVERRIDE PER SISWA */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs print:hidden">
          <div className="bg-white dark:bg-[#0e1326] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Atur Detail Peserta
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingStudent.nama} • {editingStudent.nama_kelas}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    No. Urut / Absen
                  </label>
                  <input
                    type="text"
                    value={editDraft.noAbsen || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, noAbsen: e.target.value })}
                    placeholder={String(classAbsenMap[editingStudent.id_siswa] || 1).padStart(2, '0')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Nomor Peserta
                  </label>
                  <input
                    type="text"
                    value={editDraft.noPeserta || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, noPeserta: e.target.value })}
                    placeholder={`${editingStudent.jenjang}-${config.prefixNomor}${editingStudent.nis || '001'}`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Ruang Ujian Khusus
                  </label>
                  <input
                    type="text"
                    value={editDraft.ruang || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, ruang: e.target.value })}
                    placeholder={config.ruangDefault}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Nomor Meja / Kursi
                  </label>
                  <input
                    type="text"
                    value={editDraft.meja || ''}
                    onChange={(e) => setEditDraft({ ...editDraft, meja: e.target.value })}
                    placeholder="Otomatis"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditDraft({})}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyEditStudent}
                className="px-5 py-2 rounded-xl btn-indigo text-xs font-black cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROOT CETAK A4 TERISOLASI (Hanya Tampil Saat window.print() / Ctrl+P) */}
      {selectedStudents.length > 0 && (
        <div id="kartu-print-root" className="hidden print:block bg-white">
          <KartuPesertaSheet
            students={selectedStudents}
            config={config}
            overrides={overrides}
            settings={settings}
            academicSession={academicSession}
            classAbsenMap={classAbsenMap}
            qrTokensByStudentId={qrTokensByStudentId}
            portalBaseUrl={effectivePortalBaseUrl}
            jadwalMaster={jadwalMaster}
          />
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #kartu-print-root {
            display: block !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .kartu-page {
            page-break-after: always;
            break-after: page;
          }
          .kartu-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
