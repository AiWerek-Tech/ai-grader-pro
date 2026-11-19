'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ClipboardCheck,
  Printer,
  Save,
  CalendarDays,
  Users,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { ReadOnlyBanner } from '@/components/dashboard/ReadOnlyBanner';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import DaftarHadirSheet from '@/components/daftar-hadir/DaftarHadirSheet';
import {
  getDaftarHadirBundleAction,
  saveDaftarHadirConfigAction,
} from '@/lib/actions/daftar-hadir';
import {
  buildDaftarHadirDocuments,
  buildDaftarHadirGroups,
  DaftarHadirConfig,
  DaftarHadirGroupMode,
  DaftarHadirMode,
  DaftarHadirSignerMode,
  getDefaultDaftarHadirConfig,
} from '@/lib/daftar-hadir-utils';
import {
  getDefaultKartuConfig,
  KartuPesertaConfig,
  KartuStudentItem,
  KartuStudentOverride,
} from '@/lib/kartu-peserta-utils';
import {
  getDefaultJadwalUnitConfig,
  JadwalUjianUnitConfig,
} from '@/lib/jadwal-ujian-utils';

export default function DaftarHadirPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  const [students, setStudents] = useState<KartuStudentItem[]>([]);
  const [mapelList, setMapelList] = useState<string[]>([]);
  const [guruList, setGuruList] = useState<{ id: string; nama: string; role: string }[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [academicSession, setAcademicSession] = useState({
    tahunAjaran: '2026/2027',
    semester: 'GANJIL',
  });
  const [kartuConfig, setKartuConfig] = useState<KartuPesertaConfig>(() =>
    getDefaultKartuConfig()
  );
  const [kartuOverrides, setKartuOverrides] = useState<Record<string, KartuStudentOverride>>({});
  const [jadwalMaster, setJadwalMaster] = useState<{
    SMP: JadwalUjianUnitConfig;
    SMA: JadwalUjianUnitConfig;
  }>(() => ({
    SMP: getDefaultJadwalUnitConfig('SMP'),
    SMA: getDefaultJadwalUnitConfig('SMA'),
  }));

  const [config, setConfig] = useState<DaftarHadirConfig>(() => getDefaultDaftarHadirConfig());

  // Filter State
  const [filterJenjang, setFilterJenjang] = useState<'ALL' | 'SMP' | 'SMA'>('ALL');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('ALL');
  const [filterDayId, setFilterDayId] = useState<string>('ALL');
  const [filterSlotKey, setFilterSlotKey] = useState<string>('ALL');

  // Preview Pagination & Scale
  const [previewDocIdx, setPreviewDocIdx] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.75);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await getDaftarHadirBundleAction();
      if (!active) return;
      if (res.success && res.data) {
        const d = res.data;
        setStudents(d.students || []);
        setMapelList(d.mapelList || []);
        setGuruList(d.guruList || []);
        setSettings(d.settings || {});
        setAcademicSession(d.academicSession);
        setKartuConfig(d.kartuConfig);
        setKartuOverrides(d.kartuOverrides || {});
        setJadwalMaster(d.jadwalMaster);
        setConfig(d.config);
        setCanEdit(d.canSaveConfig !== false);
      } else {
        toast.error(res.message || 'Gagal memuat data Daftar Hadir.');
      }
      setLoading(false);
    })();
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

  const allGroups = useMemo(
    () =>
      buildDaftarHadirGroups(
        students,
        kartuConfig,
        kartuOverrides,
        settings,
        academicSession,
        config.groupMode
      ),
    [students, kartuConfig, kartuOverrides, settings, academicSession, config.groupMode]
  );

  const visibleGroups = useMemo(
    () =>
      allGroups.filter((g) => (filterJenjang === 'ALL' ? true : g.jenjang === filterJenjang)),
    [allGroups, filterJenjang]
  );

  // Pilih kelas pertama secara otomatis saat pertama kali muat agar pratinjau langsung fokus
  useEffect(() => {
    if (visibleGroups.length > 0 && selectedGroupKey !== 'ALL') {
      const exists = visibleGroups.some((g) => g.key === selectedGroupKey);
      if (!exists) setSelectedGroupKey(visibleGroups[0].key);
    } else if (visibleGroups.length > 0 && selectedGroupKey === 'ALL' && students.length > 0) {
      setSelectedGroupKey(visibleGroups[0].key);
    }
  }, [visibleGroups, selectedGroupKey, students.length]);

  const targetGroups = useMemo(() => {
    if (selectedGroupKey === 'ALL') return visibleGroups;
    return visibleGroups.filter((g) => g.key === selectedGroupKey);
  }, [visibleGroups, selectedGroupKey]);

  const activeUnitForDayOptions: 'SMP' | 'SMA' = useMemo(() => {
    if (filterJenjang === 'SMP' || filterJenjang === 'SMA') return filterJenjang;
    if (targetGroups.length > 0) return targetGroups[0].jenjang;
    return 'SMP';
  }, [filterJenjang, targetGroups]);

  const availableDays = useMemo(
    () => jadwalMaster[activeUnitForDayOptions]?.days || [],
    [jadwalMaster, activeUnitForDayOptions]
  );

  const availableSlotsInDay = useMemo(() => {
    if (filterDayId === 'ALL') return [];
    const day = availableDays.find((d) => d.id === filterDayId);
    if (!day) return [];
    return day.slots.filter((s) => s.type === 'EXAM');
  }, [availableDays, filterDayId]);

  //Pilih hari & sesi pertama otomatis pada mode PER_SESI agar siap cetak 1 klik
  useEffect(() => {
    if (config.mode === 'PER_SESI' && availableDays.length > 0 && filterDayId === 'ALL') {
      setFilterDayId(availableDays[0].id);
    }
  }, [config.mode, availableDays, filterDayId]);

  const documents = useMemo(
    () =>
      buildDaftarHadirDocuments(
        targetGroups,
        config,
        jadwalMaster,
        filterDayId,
        filterSlotKey
      ),
    [targetGroups, config, jadwalMaster, filterDayId, filterSlotKey]
  );

  const safeDocIdx = Math.min(previewDocIdx, Math.max(0, documents.length - 1));
  const currentPreviewDoc = documents[safeDocIdx] ? [documents[safeDocIdx]] : [];
  const totalPrintedSheets = documents.length * (config.includeBeritaAcara ? 2 : 1);

  const handleSaveConfig = async () => {
    setSaving(true);
    const res = await saveDaftarHadirConfigAction(config);
    setSaving(false);
    if (res.success) {
      toast.success('Preferensi Daftar Hadir berhasil disimpan!');
    } else {
      toast.error(res.message || 'Gagal menyimpan konfigurasi.');
    }
  };

  if (loading) {
    return (
      <DashboardLoadingState
        title="Memuat Studio Daftar Hadir Peserta..."
        subtitle="Menyinkronkan data siswa, nomor peserta, ruang ujian, dan jadwal asesmen"
      />
    );
  }

  return (
    <div className="space-y-6 pb-14">
      <div className="print:hidden space-y-6">
        <PageHeader
          icon={<ClipboardCheck className="w-6 h-6 sm:w-7 sm:h-7" />}
          iconBgClass="bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          title="Daftar Hadir & Berita Acara Ujian"
          description="Terintegrasi penuh dengan Direktori Siswa, Nomor Peserta & Ruang dari Kartu Peserta, serta Mata Pelajaran dari Jadwal Ujian — siap cetak A4."
          actions={
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving || !canEdit}
                title={!canEdit ? 'Dikunci — Mode Read-Only' : 'Simpan preferensi Daftar Hadir'}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {canEdit ? <Save className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span>{!canEdit ? 'Terkunci (Read-Only)' : saving ? 'Menyimpan...' : 'Simpan Opsi'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={documents.length === 0}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / PDF ({totalPrintedSheets} Lembar)</span>
              </button>
            </div>
          }
        />

        {!canEdit && <ReadOnlyBanner menuLabel="Daftar Hadir & Berita Acara" />}

        <datalist id="pengawas-guru-suggestions">
          {guruList.map((g) => (
            <option key={g.id} value={g.nama} />
          ))}
        </datalist>

        <datalist id="daftar-hadir-mapel-suggestions">
          {mapelList.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: Konfigurasi Cepat Tinggal Cetak */}
          <div className="xl:col-span-5 space-y-5">
            {/* 1. Pilih Unit & Kelas / Ruang */}
            <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>1. Pilih Unit &amp; Kelas / Ruang</span>
                </h3>
                <Link
                  href="/dashboard/kartu-peserta"
                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Atur No. Peserta
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                {(['ALL', 'SMP', 'SMA'] as const).map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => {
                      setFilterJenjang(j);
                      setFilterDayId('ALL');
                      setFilterSlotKey('ALL');
                      setPreviewDocIdx(0);
                    }}
                    className={`py-2 rounded-xl text-[11px] font-black uppercase transition cursor-pointer ${
                      filterJenjang === j
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                    }`}
                  >
                    {j === 'ALL' ? 'Semua Unit' : `Unit ${j}`}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Pengelompokan Peserta
                  </label>
                  <select
                    value={config.groupMode}
                    onChange={(e) => {
                      setConfig({ ...config, groupMode: e.target.value as DaftarHadirGroupMode });
                      setSelectedGroupKey('ALL');
                      setPreviewDocIdx(0);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="PER_KELAS">Per Rombel / Kelas</option>
                    <option value="PER_RUANG">Per Ruang Ujian (Kartu)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Pilih Kelas / Ruang
                  </label>
                  <select
                    value={selectedGroupKey}
                    onChange={(e) => {
                      setSelectedGroupKey(e.target.value);
                      setPreviewDocIdx(0);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="ALL">Semua Kelas/Ruang ({visibleGroups.length})</option>
                    {visibleGroups.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label} ({g.participants.length} siswa)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Format Daftar Hadir & Sinkron Jadwal */}
            <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-500" />
                  <span>2. Format &amp; Sesi Jadwal Ujian</span>
                </h3>
                <Link
                  href="/dashboard/jadwal-ujian"
                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Edit Jadwal
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'PER_SESI' as DaftarHadirMode,
                    title: 'Format 1: Per Mata Pelajaran (Tanda Tangan Zig-Zag)',
                    desc: '1 lembar per mapel sesuai Jadwal Ujian, cocok dimasukkan ke amplop LJK.',
                  },
                  {
                    id: 'PER_HARI' as DaftarHadirMode,
                    title: 'Format 2: Matriks Harian (Hemat Kertas — 1 Lembar / Hari)',
                    desc: 'Semua sesi mapel dalam 1 hari digabung dalam 1 lembar A4.',
                  },
                  {
                    id: 'BLANGKO' as DaftarHadirMode,
                    title: 'Format 3: Blangko Kustom / Manual',
                    desc: 'Isi mapel/tanggal manual atau cetak kosong.',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setConfig({ ...config, mode: opt.id });
                      setPreviewDocIdx(0);
                    }}
                    className={`text-left p-3 rounded-2xl border transition cursor-pointer ${
                      config.mode === opt.id
                        ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-400 dark:border-indigo-500'
                        : 'bg-slate-50/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      {opt.title}
                    </div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>

              {config.mode !== 'BLANGKO' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Pilih Hari Ujian ({activeUnitForDayOptions})
                    </label>
                    <select
                      value={filterDayId}
                      onChange={(e) => {
                        setFilterDayId(e.target.value);
                        setFilterSlotKey('ALL');
                        setPreviewDocIdx(0);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="ALL">Semua Hari ({availableDays.length} Hari)</option>
                      {availableDays.map((d, idx) => (
                        <option key={d.id} value={d.id}>
                          Hari {idx + 1}: {d.hariTanggal}
                        </option>
                      ))}
                    </select>
                  </div>

                  {config.mode === 'PER_SESI' && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Pilih Sesi / Jam Ujian
                      </label>
                      <select
                        value={filterSlotKey}
                        onChange={(e) => {
                          setFilterSlotKey(e.target.value);
                          setPreviewDocIdx(0);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="ALL">Semua Sesi Mapel</option>
                        {availableSlotsInDay.map((s, idx) => (
                          <option key={s.id} value={s.id}>
                            Jam {idx + 1} ({s.waktu}) —{' '}
                            {Object.values(s.mapelByColumn || {})
                              .filter((v) => v && v !== '-')
                              .join(' / ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <input
                    type="text"
                    value={config.customHariTanggal}
                    onChange={(e) =>
                      setConfig({ ...config, customHariTanggal: e.target.value })
                    }
                    placeholder="Hari, Tanggal..."
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold"
                  />
                  <input
                    type="text"
                    list="daftar-hadir-mapel-suggestions"
                    value={config.customMapel}
                    onChange={(e) => setConfig({ ...config, customMapel: e.target.value })}
                    placeholder="Mata Pelajaran..."
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={config.customWaktu}
                    onChange={(e) => setConfig({ ...config, customWaktu: e.target.value })}
                    placeholder="07.30 - 09.00"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold"
                  />
                </div>
              )}
            </div>

            {/* 3. Pengawas Ruang & Berita Acara */}
            <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-amber-500" />
                <span>3. Pengawas Ruang &amp; Berita Acara</span>
              </h3>

              {/* Toggle Berita Acara */}
              <button
                type="button"
                onClick={() =>
                  setConfig({ ...config, includeBeritaAcara: !config.includeBeritaAcara })
                }
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                  config.includeBeritaAcara
                    ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-400 dark:border-indigo-500'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10'
                }`}
              >
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">
                    Sertakan Lembar Berita Acara Pelaksanaan
                  </div>
                  <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Otomatis mencetak lembar Berita Acara pendamping amplop LJK untuk setiap daftar hadir.
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                    config.includeBeritaAcara ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      config.includeBeritaAcara ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Jumlah Pengawas Ruang
                  </label>
                  <select
                    value={config.jumlahPengawas}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        jumlahPengawas: Number(e.target.value) === 1 ? 1 : 2,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value={1}>1 Pengawas Ruang</option>
                    <option value={2}>2 Pengawas Ruang (I &amp; II)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Pejabat Mengetahui
                  </label>
                  <select
                    value={config.signerMode}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        signerMode: e.target.value as DaftarHadirSignerMode,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="PANITIA">Ketua Panitia (Otomatis)</option>
                    <option value="KEPSEK">Kepala Sekolah (Otomatis)</option>
                    <option value="NONE">Hanya Pengawas Ruang</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">
                    Nama Pengawas I (Kosong = Titik-titik)
                  </label>
                  <input
                    type="text"
                    list="pengawas-guru-suggestions"
                    value={config.pengawas1Nama}
                    onChange={(e) => setConfig({ ...config, pengawas1Nama: e.target.value })}
                    placeholder="Pilih guru / kosongkan..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold"
                  />
                </div>
                {config.jumlahPengawas === 2 && (
                  <div>
                    <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">
                      Nama Pengawas II (Kosong = Titik-titik)
                    </label>
                    <input
                      type="text"
                      list="pengawas-guru-suggestions"
                      value={config.pengawas2Nama}
                      onChange={(e) => setConfig({ ...config, pengawas2Nama: e.target.value })}
                      placeholder="Pilih guru / kosongkan..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 text-xs font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Live A4 Preview */}
          <div className="xl:col-span-7 bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>Pratinjau Kertas A4</span>
                </h2>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {documents.length} dokumen ({totalPrintedSheets} halaman cetak A4)
                </p>
              </div>

              {documents.length > 1 && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    disabled={safeDocIdx <= 0}
                    onClick={() => setPreviewDocIdx((i) => Math.max(0, i - 1))}
                    className="p-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-700 dark:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2.5 text-[11px] font-black text-slate-700 dark:text-slate-200">
                    Dokumen {safeDocIdx + 1} / {documents.length}
                  </span>
                  <button
                    type="button"
                    disabled={safeDocIdx >= documents.length - 1}
                    onClick={() =>
                      setPreviewDocIdx((i) => Math.min(documents.length - 1, i + 1))
                    }
                    className="p-1.5 rounded-lg bg-white dark:bg-white/10 text-slate-700 dark:text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div
              ref={previewContainerRef}
              className="w-full bg-slate-200/75 dark:bg-black/50 rounded-2xl p-3 sm:p-5 overflow-x-auto flex justify-center"
            >
              <div
                className="origin-top"
                style={{
                  width: '794px',
                  zoom: previewScale,
                }}
              >
                <div id="daftar-hadir-preview-root" className="[&_.daftar-hadir-page]:shadow-2xl">
                  <DaftarHadirSheet
                    documents={currentPreviewDoc}
                    config={config}
                    settings={settings}
                    judulUjian={kartuConfig.judulUjian}
                    academicSession={academicSession}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ISOLATED PRINT ROOT (Bersih Saat Ctrl+P / window.print()) */}
      <div id="daftar-hadir-print-isolated" className="hidden print:block bg-white">
        <DaftarHadirSheet
          documents={documents}
          config={config}
          settings={settings}
          judulUjian={kartuConfig.judulUjian}
          academicSession={academicSession}
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4 portrait; margin: 8mm 10mm; }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          #daftar-hadir-print-isolated {
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
          }
          .daftar-hadir-page {
            page-break-after: always;
            break-after: page;
          }
          .daftar-hadir-page:last-child {
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
