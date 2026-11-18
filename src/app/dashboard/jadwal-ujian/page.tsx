'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CalendarDays,
  Plus,
  Trash2,
  Printer,
  Save,
  Coffee,
  RotateCcw,
  School,
  Eye,
  Edit3,
  Clock,
  FileText,
  Lock,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Copy,
  CheckCircle2,
  RefreshCw,
  Columns2,
  ExternalLink,
  UserCheck,
} from 'lucide-react';
import { withBasePath } from '@/lib/base-path';
import { buildImageFallbackCandidates } from '@/lib/utils';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import JadwalPrintSheet from '@/components/jadwal/JadwalPrintSheet';
import {
  getJadwalUjianBundleAction,
  JadwalKelasItem,
  saveJadwalUjianAction,
} from '@/lib/actions/jadwal-ujian';
import {
  getDefaultJadwalUnitConfig,
  JadwalDay,
  JadwalSignerSource,
  JadwalSlot,
  JadwalUjianUnitConfig,
  JadwalUnit,
  resolveJadwalSigner,
  resolveMatchingScheduleColumn,
} from '@/lib/jadwal-ujian-utils';

export default function JadwalUjianPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const [activeUnit, setActiveUnit] = useState<JadwalUnit>('SMP');
  const [smpConfig, setSmpConfig] = useState<JadwalUjianUnitConfig | null>(null);
  const [smaConfig, setSmaConfig] = useState<JadwalUjianUnitConfig | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [academicSession, setAcademicSession] = useState({
    tahunAjaran: '2026/2027',
    semester: 'GANJIL',
  });
  const [mapelList, setMapelList] = useState<string[]>([]);
  const [kelasList, setKelasList] = useState<JadwalKelasItem[]>([]);
  const [viewTab, setViewTab] = useState<'EDITOR' | 'SPLIT' | 'PREVIEW'>('EDITOR');
  const [collapsedDayIds, setCollapsedDayIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getJadwalUjianBundleAction();
      if (res.success && res.data) {
        setSmpConfig(res.data.smp);
        setSmaConfig(res.data.sma);
        setSettings(res.data.settings || {});
        setAcademicSession(res.data.academicSession);
        setMapelList(res.data.mapelList || []);
        setKelasList(res.data.kelasList || []);
        setCanEdit(Boolean(res.data.canEdit));
        if (!res.data.canEdit) setViewTab('PREVIEW');
      } else {
        toast.error(res.message || 'Gagal memuat Jadwal Ujian.');
      }
      setLoading(false);
    })();
  }, []);

  const currentConfig = activeUnit === 'SMP' ? smpConfig : smaConfig;

  const unitKelasList = useMemo(
    () => kelasList.filter((k) => k.jenjang === activeUnit),
    [kelasList, activeUnit]
  );

  const columnToDbClasses = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!currentConfig) return map;
    for (const col of currentConfig.columns) map[col] = [];
    for (const k of unitKelasList) {
      const matched = resolveMatchingScheduleColumn(k.nama_kelas, currentConfig.columns);
      if (matched) {
        if (!map[matched]) map[matched] = [];
        map[matched].push(k.nama_kelas);
      }
    }
    return map;
  }, [currentConfig, unitKelasList]);

  const resolvedSigner = useMemo(
    () => (currentConfig ? resolveJadwalSigner(currentConfig, settings) : null),
    [currentConfig, settings]
  );
  const setCurrentConfig = (updater: (prev: JadwalUjianUnitConfig) => JadwalUjianUnitConfig) => {
    if (activeUnit === 'SMP') {
      setSmpConfig((prev) => (prev ? updater(prev) : prev));
    } else {
      setSmaConfig((prev) => (prev ? updater(prev) : prev));
    }
  };

  const handleSave = async () => {
    if (!currentConfig) return;
    setSaving(true);
    const res = await saveJadwalUjianAction(activeUnit, currentConfig);
    setSaving(false);
    if (res.success) {
      toast.success(`Jadwal Ujian Unit ${activeUnit} berhasil disimpan & tersinkron ke Kartu Peserta!`);
    } else {
      toast.error(res.message || 'Gagal menyimpan Jadwal Ujian.');
    }
  };

  const handleResetTemplate = () => {
    const template = getDefaultJadwalUnitConfig(
      activeUnit,
      settings,
      academicSession.tahunAjaran,
      academicSession.semester
    );
    setCurrentConfig(() => template);
    toast.info(`Template standar Unit ${activeUnit} dimuat. Klik Simpan untuk menerapkan.`);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidPrint?.printPage) {
      (window as any).AndroidPrint.printPage();
    } else {
      window.print();
    }
  };

  const handleRenameColumn = (colIdx: number, newName: string) => {
    setCurrentConfig((prev) => {
      const oldName = prev.columns[colIdx];
      const nextCols = [...prev.columns];
      nextCols[colIdx] = newName;
      const nextDays = prev.days.map((day) => ({
        ...day,
        slots: day.slots.map((slot) => {
          const nextMap = { ...slot.mapelByColumn };
          if (oldName !== undefined && oldName !== newName) {
            nextMap[newName] = nextMap[oldName] || '';
            delete nextMap[oldName];
          }
          return { ...slot, mapelByColumn: nextMap };
        }),
      }));
      return { ...prev, columns: nextCols, days: nextDays };
    });
  };

  const handleAddColumn = () => {
    setCurrentConfig((prev) => ({
      ...prev,
      columns: [...prev.columns, `KELAS BARU ${prev.columns.length + 1}`],
    }));
  };

  const handleRemoveColumn = (colIdx: number) => {
    setCurrentConfig((prev) => {
      if (prev.columns.length <= 1) return prev;
      const target = prev.columns[colIdx];
      const nextCols = prev.columns.filter((_, idx) => idx !== colIdx);
      const nextDays = prev.days.map((day) => ({
        ...day,
        slots: day.slots.map((slot) => {
          const nextMap = { ...slot.mapelByColumn };
          delete nextMap[target];
          return { ...slot, mapelByColumn: nextMap };
        }),
      }));
      return { ...prev, columns: nextCols, days: nextDays };
    });
  };

  const handleAddDay = () => {
    setCurrentConfig((prev) => {
      const newDay: JadwalDay = {
        id: `day-${Date.now()}`,
        hariTanggal: 'Senin, ...',
        slots: [
          {
            id: `slot-${Date.now()}-1`,
            type: 'EXAM',
            waktu: '07.30-08.30',
            ket: '',
            mapelByColumn: Object.fromEntries(prev.columns.map((c) => [c, ''])),
          },
        ],
      };
      return { ...prev, days: [...prev.days, newDay] };
    });
  };

  const handleRemoveDay = (dayIdx: number) => {
    setCurrentConfig((prev) => ({
      ...prev,
      days: prev.days.filter((_, idx) => idx !== dayIdx),
    }));
  };

  const handleAddSlot = (dayIdx: number, type: 'EXAM' | 'BREAK') => {
    setCurrentConfig((prev) => {
      const nextDays = [...prev.days];
      const day = nextDays[dayIdx];
      const newSlot: JadwalSlot = {
        id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        waktu: type === 'BREAK' ? '09.30-09.50' : '09.50-10.50',
        ket: '',
        mapelByColumn:
          type === 'EXAM' ? Object.fromEntries(prev.columns.map((c) => [c, ''])) : {},
      };
      nextDays[dayIdx] = { ...day, slots: [...day.slots, newSlot] };
      return { ...prev, days: nextDays };
    });
  };

  const handleRemoveSlot = (dayIdx: number, slotIdx: number) => {
    setCurrentConfig((prev) => {
      const nextDays = [...prev.days];
      const day = nextDays[dayIdx];
      nextDays[dayIdx] = {
        ...day,
        slots: day.slots.filter((_, idx) => idx !== slotIdx),
      };
      return { ...prev, days: nextDays };
    });
  };

  const handleMoveSlot = (dayIdx: number, slotIdx: number, dir: -1 | 1) => {
    setCurrentConfig((prev) => {
      const nextDays = [...prev.days];
      const day = nextDays[dayIdx];
      const targetIdx = slotIdx + dir;
      if (targetIdx < 0 || targetIdx >= day.slots.length) return prev;
      const nextSlots = [...day.slots];
      [nextSlots[slotIdx], nextSlots[targetIdx]] = [nextSlots[targetIdx], nextSlots[slotIdx]];
      nextDays[dayIdx] = { ...day, slots: nextSlots };
      return { ...prev, days: nextDays };
    });
  };

  const handleCopyMapelAcrossColumns = (dayIdx: number, slotIdx: number, sourceVal: string) => {
    if (!sourceVal.trim()) return;
    setCurrentConfig((prev) => {
      const nextDays = [...prev.days];
      const day = nextDays[dayIdx];
      const nextSlots = [...day.slots];
      const slot = nextSlots[slotIdx];
      nextSlots[slotIdx] = {
        ...slot,
        mapelByColumn: Object.fromEntries(prev.columns.map((c) => [c, sourceVal])),
      };
      nextDays[dayIdx] = { ...day, slots: nextSlots };
      return { ...prev, days: nextDays };
    });
    toast.success(`"${sourceVal}" diterapkan ke semua kolom tingkat.`);
  };

  const handleSyncSubJudulFromSession = () => {
    const semNum =
      String(academicSession.semester || 'GANJIL').toUpperCase() === 'GENAP' ? '2' : '1';
    const taDash = String(academicSession.tahunAjaran || '2026/2027').replace(/\//g, '-');
    setCurrentConfig((prev) => ({
      ...prev,
      subJudul: `TAHUN PELAJARAN ${taDash} | SEMESTER ${semNum}`,
    }));
    toast.success('Sub-judul disinkronkan dengan Tahun Ajaran & Semester aktif.');
  };

  const handleSyncColumnsFromDb = () => {
    if (unitKelasList.length === 0) {
      toast.info(`Belum ada data kelas ${activeUnit} di Master Kelas.`);
      return;
    }
    const nextCols = unitKelasList.map((k) => k.nama_kelas.toUpperCase());
    setCurrentConfig((prev) => ({
      ...prev,
      columns: nextCols,
      days: prev.days.map((d) => ({
        ...d,
        slots: d.slots.map((s) => {
          if (s.type !== 'EXAM') return s;
          const nextMap: Record<string, string> = {};
          for (const col of nextCols) {
            const matchedOld = resolveMatchingScheduleColumn(col, prev.columns);
            nextMap[col] = matchedOld ? s.mapelByColumn?.[matchedOld] || '' : '';
          }
          return { ...s, mapelByColumn: nextMap };
        }),
      })),
    }));
    toast.success(`Kolom tingkat disinkronkan dari ${unitKelasList.length} kelas DB (${activeUnit}).`);
  };

  const toggleDayCollapse = (dayId: string) => {
    setCollapsedDayIds((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  const handleUpdateSlot = (
    dayIdx: number,
    slotIdx: number,
    updater: (slot: JadwalSlot) => JadwalSlot
  ) => {
    setCurrentConfig((prev) => {
      const nextDays = [...prev.days];
      const day = nextDays[dayIdx];
      const nextSlots = [...day.slots];
      nextSlots[slotIdx] = updater(nextSlots[slotIdx]);
      nextDays[dayIdx] = { ...day, slots: nextSlots };
      return { ...prev, days: nextDays };
    });
  };

  if (loading || !currentConfig) {
    return (
      <DashboardLoadingState
        title="Memuat Studio Jadwal Ujian..."
        subtitle="Menyiapkan matriks jadwal SMP & SMA dan kop surat resmi sekolah"
        accentClass="border-t-indigo-500"
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto space-y-6 fade-in print:p-0 print:m-0 print:max-w-none">
      {/* ── Header ── */}
      <PageHeader
        icon={<CalendarDays className="w-6 h-6 sm:w-7 sm:h-7" />}
        iconBgClass="bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
        title="Jadwal Ujian Resmi"
        description="Susun jadwal asesmen multi-tingkat Unit SMP & Unit SMA sesuai format surat sekolah, cetak langsung ke PDF A4, dan sinkronkan otomatis ke halaman belakang Kartu Peserta."
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : `Simpan Unit ${activeUnit}`}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF ({activeUnit})</span>
            </button>
          </div>
        }
      />

      {/* ── Switch Unit SMP vs Unit SMA + Mode View ── */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0a0e1a]/70 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          {(['SMP', 'SMA'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setActiveUnit(unit)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 transition-all ${
                activeUnit === unit
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <School className="w-4 h-4" />
              <span>Jadwal Unit {unit}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!canEdit && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Mode Lihat &amp; Cetak
            </span>
          )}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setViewTab('EDITOR')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewTab === 'EDITOR'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editor
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('SPLIT')}
                  className={`hidden xl:inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black items-center gap-1.5 transition-all cursor-pointer ${
                    viewTab === 'SPLIT'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Columns2 className="w-3.5 h-3.5" /> Split Layar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setViewTab('PREVIEW')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'PREVIEW'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Pratinjau A4
            </button>
          </div>
        </div>
      </div>

      {/* ── EDITOR & SPLIT WORKSPACE (Admin Only) ── */}
      {canEdit && (viewTab === 'EDITOR' || viewTab === 'SPLIT') && (
        <div
          className={`print:hidden ${
            viewTab === 'SPLIT' ? 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start' : 'space-y-6'
          }`}
        >
          <div className={viewTab === 'SPLIT' ? 'xl:col-span-7 space-y-6' : 'space-y-6'}>
          <datalist id="master-mapel-suggestions">
            {mapelList.map((m) => (
              <option key={m} value={m} />
            ))}
            <option value="-" />
          </datalist>

          {/* Identitas Judul & Kolom Tingkat */}
          <div className="bg-white dark:bg-[#0a0e1a]/75 border border-slate-200 dark:border-white/[0.06] rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Identitas Surat &amp; Kolom Tingkat ({activeUnit})</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncSubJudulFromSession}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Sinkron TA/Smt
                </button>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Muat Template {activeUnit}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Judul Jadwal Ujian
                </label>
                <input
                  type="text"
                  value={currentConfig.judulUjian}
                  onChange={(e) =>
                    setCurrentConfig((prev) => ({ ...prev, judulUjian: e.target.value }))
                  }
                  className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Sub-Judul Tahun Pelajaran &amp; Semester
                </label>
                <input
                  type="text"
                  value={currentConfig.subJudul}
                  onChange={(e) =>
                    setCurrentConfig((prev) => ({ ...prev, subJudul: e.target.value }))
                  }
                  className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Kolom Tingkat + Integrasi Master Kelas DB */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Sub-Kolom Tingkat (di bawah &quot;MATA PELAJARAN&quot;)
                </label>
                <div className="flex items-center gap-2">
                  {unitKelasList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncColumnsFromDb}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                      title="Buat kolom otomatis mengikuti seluruh kelas aktif di Master Kelas"
                    >
                      <RefreshCw className="w-3 h-3" /> Ikuti Master Kelas ({unitKelasList.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Tambah Kolom
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentConfig.columns.map((col, colIdx) => {
                  const mappedClasses = columnToDbClasses[col] || [];
                  return (
                    <div
                      key={colIdx}
                      className="flex flex-col gap-1 bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-2xl px-3 py-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={col}
                          onChange={(e) => handleRenameColumn(colIdx, e.target.value)}
                          className="bg-transparent text-xs font-black text-slate-900 dark:text-white w-28 sm:w-32 focus:outline-none"
                        />
                        {currentConfig.columns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(colIdx)}
                            className="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg cursor-pointer"
                            title="Hapus kolom tingkat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-bold">
                        <CheckCircle2
                          className={`w-3 h-3 shrink-0 ${
                            mappedClasses.length > 0 ? 'text-emerald-500' : 'text-slate-400'
                          }`}
                        />
                        <span
                          className={
                            mappedClasses.length > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-400'
                          }
                        >
                          {mappedClasses.length > 0
                            ? `DB: ${mappedClasses.join(', ')}`
                            : 'Belum cocok kelas DB'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Daftar Hari & Sesi */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span>Daftar Hari &amp; Sesi Ujian ({currentConfig.days.length} Hari)</span>
              </h3>
              <button
                type="button"
                onClick={handleAddDay}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" /> Tambah Hari Ujian
              </button>
            </div>

            {currentConfig.days.map((day, dayIdx) => {
              const isCollapsed = Boolean(collapsedDayIds[day.id]);
              const examCount = day.slots.filter((s) => s.type === 'EXAM').length;
              return (
              <div
                key={day.id}
                className="bg-white dark:bg-[#0a0e1a]/75 border border-slate-200 dark:border-white/[0.06] rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.05]">
                  <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => toggleDayCollapse(day.id)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-600 cursor-pointer"
                      title={isCollapsed ? 'Buka detail sesi' : 'Ringkas hari ini'}
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase shrink-0">
                      Hari {dayIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={day.hariTanggal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentConfig((prev) => {
                          const nextDays = [...prev.days];
                          nextDays[dayIdx] = { ...nextDays[dayIdx], hariTanggal: val };
                          return { ...prev, days: nextDays };
                        });
                      }}
                      placeholder="Contoh: Senin, 23 November 2026"
                      className="flex-1 bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-black text-slate-900 dark:text-white"
                    />
                    {isCollapsed && (
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        {examCount} Mapel
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddSlot(dayIdx, 'EXAM')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Sesi Ujian
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSlot(dayIdx, 'BREAK')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Coffee className="w-3.5 h-3.5" /> Istirahat
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDay(dayIdx)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 cursor-pointer"
                      title="Hapus hari ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Slots Table */}
                {!isCollapsed && (
                <div className="space-y-2">
                  {day.slots.map((slot, slotIdx) => (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-2xl border flex flex-col lg:flex-row lg:items-center gap-2.5 ${
                        slot.type === 'BREAK'
                          ? 'bg-amber-500/[0.04] border-amber-500/20'
                          : 'bg-slate-50 dark:bg-[#0d1326] border-slate-200/80 dark:border-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={slotIdx === 0}
                            onClick={() => handleMoveSlot(dayIdx, slotIdx, -1)}
                            className="p-0.5 text-slate-400 hover:text-indigo-500 disabled:opacity-25 cursor-pointer"
                            title="Geser ke atas"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={slotIdx === day.slots.length - 1}
                            onClick={() => handleMoveSlot(dayIdx, slotIdx, 1)}
                            className="p-0.5 text-slate-400 hover:text-indigo-500 disabled:opacity-25 cursor-pointer"
                            title="Geser ke bawah"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                            slot.type === 'BREAK'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {slot.type === 'BREAK' ? 'Istirahat' : `Jam ${slotIdx + 1}`}
                        </span>
                        <input
                          type="text"
                          value={slot.waktu}
                          onChange={(e) =>
                            handleUpdateSlot(dayIdx, slotIdx, (s) => ({
                              ...s,
                              waktu: e.target.value,
                            }))
                          }
                          placeholder="07.30-08.30"
                          className="w-28 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white text-center"
                        />
                      </div>

                      {slot.type === 'BREAK' ? (
                        <div className="flex-1 text-xs italic font-bold text-amber-700 dark:text-amber-400 px-2">
                          Baris Istirahat (Otomatis di-merge penuh antar kolom tingkat)
                        </div>
                      ) : (
                        <div
                          className="flex-1 grid gap-2"
                          style={{
                            gridTemplateColumns: `repeat(${Math.max(1, currentConfig.columns.length)}, minmax(0, 1fr))`,
                          }}
                        >
                          {currentConfig.columns.map((col, cIdx) => (
                            <div key={`${col}-${cIdx}`} className="min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase truncate">
                                  {col}
                                </span>
                                {cIdx === 0 && currentConfig.columns.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyMapelAcrossColumns(
                                        dayIdx,
                                        slotIdx,
                                        slot.mapelByColumn?.[col] || ''
                                      )
                                    }
                                    className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-0.5 cursor-pointer"
                                    title="Samakan mapel ini ke semua kolom tingkat"
                                  >
                                    <Copy className="w-2.5 h-2.5" /> Semua
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                list="master-mapel-suggestions"
                                value={slot.mapelByColumn?.[col] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleUpdateSlot(dayIdx, slotIdx, (s) => ({
                                    ...s,
                                    mapelByColumn: { ...s.mapelByColumn, [col]: val },
                                  }));
                                }}
                                placeholder="Pilih/ketik mapel..."
                                className="w-full bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          value={slot.ket || ''}
                          onChange={(e) =>
                            handleUpdateSlot(dayIdx, slotIdx, (s) => ({
                              ...s,
                              ket: e.target.value,
                            }))
                          }
                          placeholder="Ket."
                          className="w-20 bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(dayIdx, slotIdx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          title="Hapus sesi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
              );
            })}
          </div>

          {/* Pengesahan Terintegrasi & Keterangan */}
          <div className="bg-white dark:bg-[#0a0e1a]/75 border border-slate-200 dark:border-white/[0.06] rounded-3xl p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 shadow-sm">
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-500" />
                  <span>Pengesahan Terintegrasi ({activeUnit})</span>
                </h4>
                <Link
                  href="/dashboard/settings"
                  className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Atur TTD di Pengaturan
                </Link>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Sumber Penandatangan (Sinkron Otomatis)
                </label>
                <select
                  value={currentConfig.signerSource || 'SETTINGS_PANITIA'}
                  onChange={(e) => {
                    const src = e.target.value as JadwalSignerSource;
                    setCurrentConfig((prev) => ({
                      ...prev,
                      signerSource: src,
                      jabatanPenandatangan:
                        src === 'SETTINGS_KEPSEK' ? 'Kepala Sekolah' : 'Ketua Panitia',
                    }));
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="SETTINGS_PANITIA">
                    Ketua Panitia {activeUnit} — Otomatis dari Pengaturan Sekolah
                  </option>
                  <option value="SETTINGS_KEPSEK">
                    Kepala Sekolah {activeUnit} — Otomatis dari Pengaturan Sekolah
                  </option>
                  <option value="CUSTOM">Isi Manual (Kustom Khusus Jadwal Ini)</option>
                </select>
              </div>

              {resolvedSigner && (currentConfig.signerSource || 'SETTINGS_PANITIA') !== 'CUSTOM' ? (
                <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/25 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                      {resolvedSigner.jabatan} • Terhubung Pengaturan
                    </div>
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                      {resolvedSigner.nama}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {resolvedSigner.nip ? `NIP. ${resolvedSigner.nip}` : 'Tanpa NIP'} •{' '}
                      {resolvedSigner.ttdUrl ? 'TTD Digital Aktif' : 'Belum ada gambar TTD'}
                    </div>
                  </div>
                  {resolvedSigner.ttdUrl && (
                    <div className="h-12 w-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          buildImageFallbackCandidates(
                            resolvedSigner.ttdUrl,
                            withBasePath('/logo/logo_advent.png')
                          )[0]
                        }
                        alt="Preview TTD"
                        referrerPolicy="no-referrer"
                        className="max-h-10 w-auto object-contain"
                      />
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Tempat &amp; Tanggal
                  </label>
                  <input
                    type="text"
                    value={currentConfig.kotaTanggal}
                    onChange={(e) =>
                      setCurrentConfig((prev) => ({ ...prev, kotaTanggal: e.target.value }))
                    }
                    className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Jabatan di Surat
                  </label>
                  <input
                    type="text"
                    value={currentConfig.jabatanPenandatangan}
                    onChange={(e) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        jabatanPenandatangan: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              {(currentConfig.signerSource || 'SETTINGS_PANITIA') === 'CUSTOM' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                      Nama Penandatangan (Manual)
                    </label>
                    <input
                      type="text"
                      value={currentConfig.namaPenandatangan}
                      onChange={(e) =>
                        setCurrentConfig((prev) => ({ ...prev, namaPenandatangan: e.target.value }))
                      }
                      className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                      NIP (Opsional)
                    </label>
                    <input
                      type="text"
                      value={currentConfig.nipPenandatangan || ''}
                      onChange={(e) =>
                        setCurrentConfig((prev) => ({ ...prev, nipPenandatangan: e.target.value }))
                      }
                      className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Keterangan / Tata Tertib (1 baris per nomor)
              </label>
              <textarea
                rows={5}
                value={currentConfig.keteranganLines.join('\n')}
                onChange={(e) =>
                  setCurrentConfig((prev) => ({
                    ...prev,
                    keteranganLines: e.target.value.split(/\r?\n/),
                  }))
                }
                className="w-full bg-slate-50 dark:bg-[#0d1326] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium"
              />
            </div>
          </div>
          </div>

          {/* SPLIT VIEW: Live A4 Preview Side-by-Side di Desktop */}
          {viewTab === 'SPLIT' && (
            <div className="xl:col-span-5 sticky top-4 bg-slate-200/70 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-3xl p-3 overflow-hidden">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1 flex items-center justify-between">
                <span>Live Pratinjau A4 ({activeUnit})</span>
                <span>Otomatis Update</span>
              </div>
              <div className="overflow-auto max-h-[78vh] rounded-2xl bg-white shadow-xl">
                <div className="origin-top-left w-[760px]" style={{ zoom: 0.64 }}>
                  <JadwalPrintSheet
                    config={currentConfig}
                    settings={settings}
                    rootId="jadwal-split-preview"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FULL LIVE A4 PREVIEW (Layar) ── */}
      {viewTab === 'PREVIEW' && (
        <div className="print:hidden overflow-x-auto bg-slate-200/70 dark:bg-black/40 p-3 sm:p-6 rounded-3xl">
          <div className="min-w-[720px] max-w-[200mm] mx-auto shadow-2xl bg-white">
            <JadwalPrintSheet
              config={currentConfig}
              settings={settings}
              rootId="jadwal-preview-sheet"
            />
          </div>
        </div>
      )}

      {/* ── ISOLATED PRINT ROOT (Bersih Tanpa Kotak Abu-Abu Saat Ctrl+P / Cetak) ── */}
      <div id="jadwal-print-isolated" className="hidden print:block bg-white">
        <JadwalPrintSheet
          config={currentConfig}
          settings={settings}
          rootId="jadwal-print-root"
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
          #jadwal-print-isolated {
            display: block !important;
            width: 100% !important;
            background: #ffffff !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
