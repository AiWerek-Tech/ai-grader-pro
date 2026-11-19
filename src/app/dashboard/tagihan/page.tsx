'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Wallet,
  CreditCard,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Save,
  Trash2,
  X,
  MessageSquare,
  SlidersHorizontal,
  Receipt,
  FileText,
  Ban,
  IdCard,
  Upload,
  Lock,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DashboardLoadingState } from '@/components/dashboard/DashboardLoadingState';
import { createWorkbook, downloadWorkbook } from '@/lib/utils/excel';
import {
  createSingleTagihanAction,
  deleteTagihanAction,
  generateTagihanBulananAction,
  getTagihanBundleAction,
  recordPembayaranAction,
  saveKeuanganConfigAction,
  setStudentDispensasiAction,
  TagihanKelasItem,
  TagihanStudentItem,
  updateTagihanAction,
  voidPembayaranAction,
} from '@/lib/actions/tagihan';
import {
  allocatePaymentFifo,
  buildWhatsAppReminderText,
  computeStudentEligibility,
  formatDateIdShort,
  formatRupiah,
  getDefaultKeuanganConfig,
  getSemesterMonths,
  getTodayYmd,
  KeuanganConfig,
  MetodePembayaran,
  PembayaranRecord,
  StudentExamEligibility,
  TagihanKategori,
  TagihanRecord,
} from '@/lib/tagihan-utils';
import { KwitansiGroupData, KwitansiPrintSheet } from '@/components/tagihan/KwitansiPrintSheet';
import { SuratTagihanItem, SuratTagihanSheet } from '@/components/tagihan/SuratTagihanSheet';
import {
  LaporanKeuanganMode,
  LaporanKeuanganSheet,
} from '@/components/tagihan/LaporanKeuanganSheet';

type ActiveTab = 'MATRIKS' | 'KASIR' | 'PENGATURAN' | 'SURAT' | 'LAPORAN';
type PrintPayload =
  | { kind: 'KWITANSI'; data: KwitansiGroupData }
  | { kind: 'SURAT'; items: SuratTagihanItem[] }
  | { kind: 'LAPORAN'; mode: LaporanKeuanganMode }
  | null;

export default function TagihanBiayaSekolahPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canInputKasir, setCanInputKasir] = useState(false);
  const [financeRoleLabel, setFinanceRoleLabel] = useState('Lihat Saja (Read-Only)');
  const [isAdminUser, setIsAdminUser] = useState(false);

  const [students, setStudents] = useState<TagihanStudentItem[]>([]);
  const [kelasList, setKelasList] = useState<TagihanKelasItem[]>([]);
  const [bills, setBills] = useState<TagihanRecord[]>([]);
  const [payments, setPayments] = useState<PembayaranRecord[]>([]);
  const [config, setConfig] = useState<KeuanganConfig>(getDefaultKeuanganConfig());
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [academicSession, setAcademicSession] = useState({
    tahunAjaran: '2026/2027',
    semester: 'GANJIL',
  });
  const [eligibilityMap, setEligibilityMap] = useState<Record<string, StudentExamEligibility>>({});

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<ActiveTab>('MATRIKS');
  const [jenjangFilter, setJenjangFilter] = useState<'ALL' | 'SMP' | 'SMA'>('ALL');
  const [kelasFilter, setKelasFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'LAYAK' | 'BELUM_LAYAK' | 'LUNAS' | 'DISPENSASI'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Tab 2: Kasir Cepat State
  const [kasirSearch, setKasirSearch] = useState('');
  const [kasirStudentId, setKasirStudentId] = useState('');
  const [kasirAmount, setKasirAmount] = useState<string>('');
  const [kasirDate, setKasirDate] = useState<string>(getTodayYmd());
  const [kasirMetode, setKasirMetode] = useState<MetodePembayaran>('TUNAI');
  const [kasirCatatan, setKasirCatatan] = useState('');
  const [kasirSelectedBillIds, setKasirSelectedBillIds] = useState<string[]>([]);
  const [lastKwitansiNo, setLastKwitansiNo] = useState<string>('');
  const [receiptSearch, setReceiptSearch] = useState('');

  // Tab 3: Generate Massal & Custom Tagihan State
  const [genScope, setGenScope] = useState<string>('ALL');
  const [genKategori, setGenKategori] = useState<TagihanKategori>('SPP');
  const [genPeriodes, setGenPeriodes] = useState<string[]>([]);
  const [genNominalSmp, setGenNominalSmp] = useState<string>('');
  const [genNominalSma, setGenNominalSma] = useState<string>('');
  const [genCustomNama, setGenCustomNama] = useState('');
  const [genSaveDefault, setGenSaveDefault] = useState(true);

  const [singleStudentId, setSingleStudentId] = useState('');
  const [singleKategori, setSingleKategori] = useState<TagihanKategori>('UJIAN');
  const [singleNama, setSingleNama] = useState('');
  const [singlePeriode, setSinglePeriode] = useState('');
  const [singleNominal, setSingleNominal] = useState('');
  const [singlePotongan, setSinglePotongan] = useState('0');
  const [singleCatatan, setSingleCatatan] = useState('');

  // Tab 4: Surat Tagihan Selection
  const [suratSelectedIds, setSuratSelectedIds] = useState<Set<string>>(new Set());

  // Tab 5: Laporan State
  const [laporanMode, setLaporanMode] = useState<LaporanKeuanganMode>('REKAP_KELAS');
  const [laporanDateFrom, setLaporanDateFrom] = useState<string>(() => {
    const today = getTodayYmd();
    return `${today.slice(0, 7)}-01`;
  });
  const [laporanDateTo, setLaporanDateTo] = useState<string>(getTodayYmd());

  // Modals: Detail/Edit Tagihan, Dispensasi, Void Transaksi
  const [detailStudent, setDetailStudent] = useState<TagihanStudentItem | null>(null);
  const [editingBill, setEditingBill] = useState<TagihanRecord | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [editPotongan, setEditPotongan] = useState('');
  const [editCatatan, setEditCatatan] = useState('');

  const [dispensasiStudent, setDispensasiStudent] = useState<TagihanStudentItem | null>(null);
  const [dispensasiAlasan, setDispensasiAlasan] = useState('');
  const [dispensasiSampai, setDispensasiSampai] = useState('');

  const [voidTargetKwitansi, setVoidTargetKwitansi] = useState<string | null>(null);
  const [voidAlasan, setVoidAlasan] = useState('');

  // Print State
  const [printPayload, setPrintPayload] = useState<PrintPayload>(null);

  const semesterMonths = useMemo(
    () => getSemesterMonths(academicSession.tahunAjaran, academicSession.semester),
    [academicSession.tahunAjaran, academicSession.semester]
  );

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getTagihanBundleAction();
      if (!res.success || !res.data) {
        toast.error(res.message || 'Gagal memuat data tagihan biaya sekolah.');
        return;
      }
      const d = res.data;
      setStudents(d.students);
      setKelasList(d.kelasList);
      setBills(d.bills);
      setPayments(d.payments);
      setConfig(d.config);
      setSettings(d.settings);
      setAcademicSession(d.academicSession);
      setEligibilityMap(d.eligibilityMap);
      const isBendahara = Boolean((d as any).canManageBendahara ?? d.canEdit);
      const isKasir = Boolean((d as any).canInputKasir ?? isBendahara);
      setCanEdit(isBendahara);
      setCanInputKasir(isKasir);
      setFinanceRoleLabel(
        String((d as any).financeRoleLabel || (isBendahara ? 'Bendahara Sekolah' : 'Lihat Saja (Read-Only)'))
      );
      setIsAdminUser(d.currentUser?.role === 'ADMIN');

      setGenNominalSmp((prev) =>
        prev === '' && d.config.tarifSppSmp > 0 ? String(d.config.tarifSppSmp) : prev
      );
      setGenNominalSma((prev) =>
        prev === '' && d.config.tarifSppSma > 0 ? String(d.config.tarifSppSma) : prev
      );
      const months = getSemesterMonths(d.academicSession.tahunAjaran, d.academicSession.semester);
      setGenPeriodes((prev) => (prev.length === 0 ? months.map((m) => m.periode) : prev));
      setSinglePeriode((prev) => prev || months[0]?.periode || getTodayYmd().slice(0, 7));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Trigger window.print() setelah DOM cetak selesai render
  const triggerPrint = (payload: NonNullable<PrintPayload>) => {
    setPrintPayload(payload);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  // Lookup Maps
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id_siswa, s])), [students]);
  const billMap = useMemo(() => new Map(bills.map((b) => [b.id_tagihan, b])), [bills]);

  const billsByStudent = useMemo(() => {
    const map = new Map<string, TagihanRecord[]>();
    for (const b of bills) {
      if (
        b.tahun_ajaran &&
        b.tahun_ajaran !== academicSession.tahunAjaran
      ) {
        continue;
      }
      if (
        b.semester &&
        b.semester.toUpperCase() !== academicSession.semester.toUpperCase()
      ) {
        continue;
      }
      const list = map.get(b.id_siswa);
      if (list) list.push(b);
      else map.set(b.id_siswa, [b]);
    }
    return map;
  }, [bills, academicSession]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (jenjangFilter !== 'ALL' && s.jenjang !== jenjangFilter) return false;
      if (kelasFilter !== 'ALL' && s.id_kelas !== kelasFilter) return false;
      const el = eligibilityMap[s.id_siswa];
      if (statusFilter === 'LAYAK' && !el?.eligibleForExamCard) return false;
      if (statusFilter === 'BELUM_LAYAK' && el?.eligibleForExamCard !== false) return false;
      if (statusFilter === 'LUNAS' && el?.status !== 'LUNAS') return false;
      if (statusFilter === 'DISPENSASI' && el?.status !== 'DISPENSASI') return false;
      if (q) {
        const hay = `${s.nama} ${s.nis} ${s.nama_kelas}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, jenjangFilter, kelasFilter, statusFilter, searchQuery, eligibilityMap]);

  // Global KPI Stats (scoped to jenjangFilter)
  const kpi = useMemo(() => {
    const scoped = students.filter(
      (s) => jenjangFilter === 'ALL' || s.jenjang === jenjangFilter
    );
    let totalTagihan = 0;
    let totalTerbayar = 0;
    let totalSisa = 0;
    let layakCount = 0;
    let lunasCount = 0;
    let dispensasiCount = 0;
    let belumLayakCount = 0;

    for (const st of scoped) {
      const el = eligibilityMap[st.id_siswa];
      if (!el) continue;
      totalTagihan += el.totalTagihan;
      totalTerbayar += el.totalTerbayar;
      totalSisa += el.sisaTunggakan;
      if (el.status === 'LUNAS') lunasCount++;
      if (el.status === 'DISPENSASI') dispensasiCount++;
      if (el.eligibleForExamCard) layakCount++;
      else belumLayakCount++;
    }
    const pct = totalTagihan > 0 ? Math.round((totalTerbayar / totalTagihan) * 1000) / 10 : 0;
    return {
      totalStudents: scoped.length,
      totalTagihan,
      totalTerbayar,
      totalSisa,
      pct,
      layakCount,
      lunasCount,
      dispensasiCount,
      belumLayakCount,
    };
  }, [students, jenjangFilter, eligibilityMap]);

  // Grouped Receipts (per no_kwitansi)
  const allReceiptGroups = useMemo(() => {
    const map = new Map<string, KwitansiGroupData & { isVoid: boolean; voidNominal: number }>();
    for (const p of payments) {
      const st = studentMap.get(p.id_siswa);
      if (!st) continue;
      const existing = map.get(p.no_kwitansi);
      const isValid = p.status_transaksi === 'VALID';
      if (existing) {
        existing.items.push({ payment: p, bill: billMap.get(p.id_tagihan) });
        if (isValid) {
          existing.totalBayar += p.nominal_bayar;
          existing.isVoid = false;
        } else {
          existing.voidNominal += p.nominal_bayar;
        }
      } else {
        map.set(p.no_kwitansi, {
          noKwitansi: p.no_kwitansi,
          tanggalBayar: p.tanggal_bayar,
          metode: p.metode,
          namaPetugas: p.nama_petugas,
          catatan: p.catatan,
          student: st,
          items: [{ payment: p, bill: billMap.get(p.id_tagihan) }],
          totalBayar: isValid ? p.nominal_bayar : 0,
          eligibility: eligibilityMap[st.id_siswa],
          isVoid: !isValid,
          voidNominal: isValid ? 0 : p.nominal_bayar,
        });
      }
    }
    return Array.from(map.values());
  }, [payments, studentMap, billMap, eligibilityMap]);

  const receiptGroups = useMemo(() => {
    const q = receiptSearch.trim().toLowerCase();
    if (!q) return allReceiptGroups;
    return allReceiptGroups.filter((g) =>
      `${g.noKwitansi} ${g.student.nama} ${g.student.nama_kelas} ${g.metode} ${g.namaPetugas || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [allReceiptGroups, receiptSearch]);

  // Kasir selected student & unpaid bills
  const kasirStudent = useMemo(
    () => studentMap.get(kasirStudentId) || null,
    [studentMap, kasirStudentId]
  );
  const kasirStudentBills = useMemo(() => {
    if (!kasirStudentId) return [];
    return (billsByStudent.get(kasirStudentId) || [])
      .filter((b) => b.nominal_akhir > b.terbayar)
      .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan));
  }, [billsByStudent, kasirStudentId]);

  const kasirFilteredStudents = useMemo(() => {
    const q = kasirSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.nama} ${s.nis} ${s.nama_kelas} ${s.jenjang}`.toLowerCase().includes(q)
    );
  }, [students, kasirSearch]);

  // Simulasi real-time alokasi FIFO & proyeksi status kartu ujian saat Kasir mengetik nominal
  const kasirSimulation = useMemo(() => {
    if (!kasirStudent) return null;
    const numericAmt = Number(String(kasirAmount).replace(/[^\d]/g, '')) || 0;
    if (numericAmt <= 0) return null;
    const allStudentBills = billsByStudent.get(kasirStudent.id_siswa) || [];
    const sim = allocatePaymentFifo(
      allStudentBills,
      numericAmt,
      kasirSelectedBillIds.length > 0 ? kasirSelectedBillIds : undefined
    );
    if (sim.allocations.length === 0) return null;

    const allocMap = new Map(sim.allocations.map((a) => [a.tagihan.id_tagihan, a]));
    const projectedBills = allStudentBills.map((b) => {
      const a = allocMap.get(b.id_tagihan);
      return a ? { ...b, terbayar: a.newTerbayar, status: a.newStatus } : b;
    });
    const projectedEl = computeStudentEligibility(
      kasirStudent.id_siswa,
      projectedBills,
      config,
      academicSession.tahunAjaran,
      academicSession.semester
    );
    return { ...sim, projectedEl };
  }, [
    kasirStudent,
    kasirAmount,
    billsByStudent,
    kasirSelectedBillIds,
    config,
    academicSession,
  ]);

  const openKasirForStudent = (st: TagihanStudentItem) => {
    setKasirStudentId(st.id_siswa);
    setKasirSelectedBillIds([]);
    const el = eligibilityMap[st.id_siswa];
    if (el && !el.eligibleForExamCard && el.minimalAgarLayak > 0) {
      setKasirAmount(String(el.minimalAgarLayak));
    } else if (el && el.sisaTunggakan > 0) {
      setKasirAmount(String(el.sisaTunggakan));
    } else {
      setKasirAmount('');
    }
    setActiveTab('KASIR');
  };

  // Handlers
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasirStudent) {
      toast.error('Pilih siswa terlebih dahulu.');
      return;
    }
    const numericAmt = Number(String(kasirAmount).replace(/[^\d]/g, ''));
    if (!numericAmt || numericAmt <= 0) {
      toast.error('Masukkan nominal pembayaran yang valid.');
      return;
    }
    setBusy(true);
    try {
      const res = await recordPembayaranAction({
        id_siswa: kasirStudent.id_siswa,
        studentName: kasirStudent.nama,
        amount: numericAmt,
        tanggal_bayar: kasirDate || getTodayYmd(),
        metode: kasirMetode,
        catatan: kasirCatatan,
        selectedTagihanIds: kasirSelectedBillIds.length > 0 ? kasirSelectedBillIds : undefined,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setKasirAmount('');
      setKasirCatatan('');
      setKasirSelectedBillIds([]);
      if (res.data?.no_kwitansi) {
        setLastKwitansiNo(res.data.no_kwitansi);
      }
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateMassal = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomSmp = Number(String(genNominalSmp).replace(/[^\d]/g, '')) || 0;
    const nomSma = Number(String(genNominalSma).replace(/[^\d]/g, '')) || 0;
    if (nomSmp <= 0 && nomSma <= 0) {
      toast.error('Isi minimal salah satu nominal tarif (SMP atau SMA).');
      return;
    }
    if (genPeriodes.length === 0) {
      toast.error('Pilih minimal 1 bulan / periode.');
      return;
    }
    setBusy(true);
    try {
      const res = await generateTagihanBulananAction({
        periodes: genPeriodes,
        targetScope: genScope,
        nominalSmp: nomSmp,
        nominalSma: nomSma,
        kategori: genKategori,
        customNama: genCustomNama,
        saveAsDefaultTarif: genSaveDefault,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSingleBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = Number(String(singleNominal).replace(/[^\d]/g, '')) || 0;
    const pot = Number(String(singlePotongan).replace(/[^\d]/g, '')) || 0;
    if (!singleStudentId || !singleNama.trim() || nom <= 0) {
      toast.error('Lengkapi siswa, nama tagihan, dan nominal.');
      return;
    }
    setBusy(true);
    try {
      const res = await createSingleTagihanAction({
        id_siswa: singleStudentId,
        kategori: singleKategori,
        periode_bulan: singlePeriode || getTodayYmd().slice(0, 7),
        nama_tagihan: singleNama.trim(),
        nominal: nom,
        potongan: pot,
        catatan: singleCatatan,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSingleNama('');
      setSingleNominal('');
      setSinglePotongan('0');
      setSingleCatatan('');
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveConfig = async () => {
    setBusy(true);
    try {
      const res = await saveKeuanganConfigAction(config);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateBill = async () => {
    if (!editingBill) return;
    const nom = Number(String(editNominal).replace(/[^\d]/g, '')) || 0;
    const pot = Number(String(editPotongan).replace(/[^\d]/g, '')) || 0;
    setBusy(true);
    try {
      const res = await updateTagihanAction({
        id_tagihan: editingBill.id_tagihan,
        nominal: nom,
        potongan: pot,
        catatan: editCatatan,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setEditingBill(null);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBill = async (idTagihan: string) => {
    setBusy(true);
    try {
      const res = await deleteTagihanAction(idTagihan);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDispensasi = async (active: boolean) => {
    if (!dispensasiStudent) return;
    setBusy(true);
    try {
      const res = await setStudentDispensasiAction({
        id_siswa: dispensasiStudent.id_siswa,
        studentName: dispensasiStudent.nama,
        active,
        alasan: dispensasiAlasan,
        berlakuSampai: dispensasiSampai,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setDispensasiStudent(null);
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTargetKwitansi) return;
    if (!voidAlasan.trim()) {
      toast.error('Masukkan alasan pembatalan transaksi.');
      return;
    }
    setBusy(true);
    try {
      const res = await voidPembayaranAction({
        no_kwitansi: voidTargetKwitansi,
        alasan: voidAlasan.trim(),
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setVoidTargetKwitansi(null);
      setVoidAlasan('');
      await loadData(true);
    } finally {
      setBusy(false);
    }
  };

  const handleUploadBendaharaTtd = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File tanda tangan harus berupa gambar (PNG/JPG).');
      return;
    }
    if (file.size > 400 * 1024) {
      toast.error('Ukuran gambar tanda tangan maksimal 400 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setConfig((prev) => ({ ...prev, bendaharaTtdUrl: reader.result as string }));
        toast.success('Gambar TTD Bendahara dimuat. Klik "Simpan Pengaturan" untuk menerapkan.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopyWhatsApp = async (st: TagihanStudentItem) => {
    const el = eligibilityMap[st.id_siswa];
    if (!el) return;
    const prefix = st.jenjang === 'SMP' ? 'smp_' : 'sma_';
    const schoolName =
      settings[prefix + 'nama_sekolah_2'] ||
      settings['nama_sekolah_2'] ||
      (st.jenjang === 'SMP' ? 'SMP Advent Sogokmo' : 'SMA Advent Sogokmo');

    const msg = buildWhatsAppReminderText({
      schoolName,
      studentName: st.nama,
      kelasName: st.nama_kelas,
      nis: st.nis,
      tahunAjaran: academicSession.tahunAjaran,
      semester: academicSession.semester,
      eligibility: el,
      rekeningInfo: config.rekeningInfo,
      bendaharaNama: config.bendaharaNama,
    });
    try {
      await navigator.clipboard.writeText(msg);
      toast.success(`Pesan pengingat WA untuk ${st.nama} berhasil disalin.`);
    } catch {
      toast.error('Gagal menyalin pesan ke clipboard.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const wb = createWorkbook();
      wb.creator = 'WMVAA AI Grader Pro';
      wb.created = new Date();

      // Sheet 1: Rekap Per Kelas
      const wsKelas = wb.addWorksheet('Rekap Per Kelas');
      wsKelas.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Kelas', key: 'kelas', width: 18 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Jumlah Siswa', key: 'siswa', width: 14 },
        { header: 'Target Tagihan (Rp)', key: 'tagihan', width: 20 },
        { header: 'Terkumpul (Rp)', key: 'terbayar', width: 20 },
        { header: 'Sisa Tunggakan (Rp)', key: 'sisa', width: 20 },
        { header: 'Kolektibilitas (%)', key: 'pct', width: 18 },
        { header: 'Layak Kartu', key: 'layak', width: 14 },
        { header: 'Belum Layak', key: 'belum', width: 14 },
      ];
      wsKelas.getRow(1).font = { bold: true };

      const scopedKelas = kelasList.filter(
        (k) => jenjangFilter === 'ALL' || k.jenjang === jenjangFilter
      );
      scopedKelas.forEach((k, idx) => {
        const ks = students.filter((s) => s.id_kelas === k.id_kelas);
        let t = 0;
        let p = 0;
        let s = 0;
        let layak = 0;
        let belum = 0;
        for (const st of ks) {
          const el = eligibilityMap[st.id_siswa];
          if (!el) continue;
          t += el.totalTagihan;
          p += el.totalTerbayar;
          s += el.sisaTunggakan;
          if (el.eligibleForExamCard) layak++;
          else belum++;
        }
        wsKelas.addRow({
          no: idx + 1,
          kelas: k.nama_kelas,
          unit: k.jenjang,
          siswa: ks.length,
          tagihan: t,
          terbayar: p,
          sisa: s,
          pct: t > 0 ? Math.round((p / t) * 1000) / 10 : 0,
          layak,
          belum,
        });
      });

      // Sheet 2: Status & Kelayakan Per Siswa
      const wsSiswa = wb.addWorksheet('Status & Kelayakan Ujian');
      wsSiswa.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'NIS', key: 'nis', width: 12 },
        { header: 'Nama Siswa', key: 'nama', width: 28 },
        { header: 'Kelas', key: 'kelas', width: 14 },
        { header: 'Unit', key: 'unit', width: 8 },
        { header: 'Total Tagihan', key: 'tagihan', width: 18 },
        { header: 'Terbayar', key: 'terbayar', width: 18 },
        { header: 'Sisa Tunggakan', key: 'sisa', width: 18 },
        { header: 'Persen (%)', key: 'pct', width: 12 },
        { header: 'Status Ujian', key: 'status', width: 18 },
        { header: 'Min. Bayar Syarat', key: 'minBayar', width: 18 },
        { header: 'Keterangan', key: 'ket', width: 32 },
      ];
      wsSiswa.getRow(1).font = { bold: true };

      students
        .filter((s) => jenjangFilter === 'ALL' || s.jenjang === jenjangFilter)
        .forEach((st, idx) => {
          const el = eligibilityMap[st.id_siswa];
          wsSiswa.addRow({
            no: idx + 1,
            nis: st.nis,
            nama: st.nama,
            kelas: st.nama_kelas,
            unit: st.jenjang,
            tagihan: el?.totalTagihan || 0,
            terbayar: el?.totalTerbayar || 0,
            sisa: el?.sisaTunggakan || 0,
            pct: el?.persentaseTerbayar ?? 0,
            status: el?.status || 'BELUM_ADA_TAGIHAN',
            minBayar: el?.minimalAgarLayak || 0,
            ket: el?.dispensasi
              ? `Dispensasi: ${el.dispensasi.alasan}`
              : el?.bulanMenunggak?.join(', ') || 'Lunas',
          });
        });

      // Sheet 3: Riwayat Pembayaran
      const wsKas = wb.addWorksheet('Riwayat Kas Masuk');
      wsKas.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Tanggal', key: 'tgl', width: 14 },
        { header: 'No Kwitansi', key: 'kw', width: 18 },
        { header: 'Nama Siswa', key: 'nama', width: 26 },
        { header: 'Kelas', key: 'kelas', width: 14 },
        { header: 'Tagihan', key: 'tagihan', width: 24 },
        { header: 'Metode', key: 'metode', width: 12 },
        { header: 'Nominal (Rp)', key: 'nominal', width: 16 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Petugas', key: 'petugas', width: 22 },
        { header: 'Catatan', key: 'catatan', width: 28 },
      ];
      wsKas.getRow(1).font = { bold: true };

      payments.forEach((p, idx) => {
        const st = studentMap.get(p.id_siswa);
        const bl = billMap.get(p.id_tagihan);
        wsKas.addRow({
          no: idx + 1,
          tgl: p.tanggal_bayar,
          kw: p.no_kwitansi,
          nama: st?.nama || p.id_siswa,
          kelas: st?.nama_kelas || '-',
          tagihan: bl?.nama_tagihan || p.id_tagihan,
          metode: p.metode,
          nominal: p.nominal_bayar,
          status: p.status_transaksi,
          petugas: p.nama_petugas,
          catatan: p.catatan,
        });
      });

      const filename = `Laporan_Keuangan_WMVAA_${academicSession.tahunAjaran.replace('/', '-')}_${academicSession.semester}.xlsx`;
      await downloadWorkbook(wb, filename);
      toast.success(`Laporan Excel ${filename} berhasil diunduh.`);
    } catch {
      toast.error('Gagal mengekspor laporan Excel.');
    }
  };

  // Students with unpaid balance for Surat Tagihan tab
  const siswaMenunggak = useMemo(() => {
    return filteredStudents.filter((s) => (eligibilityMap[s.id_siswa]?.sisaTunggakan || 0) > 0);
  }, [filteredStudents, eligibilityMap]);

  const handlePrintSuratMassal = () => {
    const selected = siswaMenunggak.filter((s) => suratSelectedIds.has(s.id_siswa));
    if (selected.length === 0) {
      toast.error('Centang minimal 1 siswa yang ingin dicetak surat tagihannya.');
      return;
    }
    const items: SuratTagihanItem[] = selected.map((st) => ({
      student: st,
      eligibility: eligibilityMap[st.id_siswa],
      unpaidBills: (billsByStudent.get(st.id_siswa) || [])
        .filter((b) => b.nominal_akhir > b.terbayar)
        .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan)),
    }));
    triggerPrint({ kind: 'SURAT', items });
  };

  const renderClearanceBadge = (el?: StudentExamEligibility) => {
    if (!el || el.status === 'BELUM_ADA_TAGIHAN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
          Belum Ditagih
        </span>
      );
    }
    if (el.status === 'LUNAS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> Lunas 100%
        </span>
      );
    }
    if (el.status === 'MEMENUHI_SYARAT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
          <ShieldCheck className="w-3 h-3" /> Layak ({el.persentaseTerbayar}%)
        </span>
      );
    }
    if (el.status === 'DISPENSASI') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
          <ShieldAlert className="w-3 h-3" /> Dispensasi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
        <AlertTriangle className="w-3 h-3" /> Belum ({el.persentaseTerbayar}%)
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLoadingState
        title="Memuat Modul Tagihan & Biaya Sekolah..."
        subtitle="Menyinkronkan data SPP, kwitansi kasir, dan status kelayakan kartu ujian"
        accentClass="border-t-emerald-500"
      />
    );
  }

  const visibleTabs: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'MATRIKS', label: '1. Matriks SPP & Kelayakan', icon: Wallet },
    { id: 'KASIR', label: '2. Kasir & Kwitansi', icon: CreditCard },
    ...(canEdit
      ? [{ id: 'PENGATURAN' as ActiveTab, label: '3. Generate & Aturan', icon: SlidersHorizontal }]
      : []),
    { id: 'SURAT', label: canEdit ? '4. Surat Tagihan & WA' : '3. Surat Tagihan & WA', icon: MessageSquare },
    { id: 'LAPORAN', label: canEdit ? '5. Rekap & Laporan' : '4. Rekap & Laporan', icon: FileSpreadsheet },
  ];

  return (
    <>
      <div className="space-y-6 pb-10 print:hidden">
        <PageHeader
          icon={<Wallet className="w-6 h-6 sm:w-7 sm:h-7" />}
          iconBgClass="bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          title="Tagihan & Biaya Sekolah"
          description={`Manajemen SPP bulanan, kasir kwitansi, dispensasi, surat tagihan, dan validasi syarat kartu ujian (minimal ${config.minPercentForExamCard}%) • TA ${academicSession.tahunAjaran} (${academicSession.semester}).`}
          actions={
            <>
              <button
                type="button"
                onClick={() => loadData(false)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
              </button>
              <Link
                href="/dashboard/kartu-peserta"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
              >
                <IdCard className="w-3.5 h-3.5" /> Ke Kartu Peserta
              </Link>
            </>
          }
        />

        {/* Role & Pemisahan Jabatan Banner */}
        <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black shrink-0 ${
                canEdit
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : canInputKasir
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                  : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Jabatan: {financeRoleLabel}
            </span>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {canEdit
                ? 'Otoritas penuh: atur tarif & syarat kartu, generate tagihan, potongan/beasiswa, kasir kwitansi, dispensasi ujian & pembatalan (VOID).'
                : canInputKasir
                ? 'Wewenang Kasir Loket: terima pembayaran siswa, terbitkan & cetak kwitansi, kirim surat/WA, serta rekap kas. (Ubah tarif, dispensasi & VOID khusus Bendahara).'
                : 'Mode Lihat Saja (Read-Only): pantau status kelayakan ujian, salin WA, dan cetak laporan.'}
            </p>
          </div>
          {isAdminUser && (
            <Link
              href="/dashboard/settings"
              className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
            >
              Atur Akun Bendahara / Kasir →
            </Link>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Total Tagihan Periode
            </div>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
              {formatRupiah(kpi.totalTagihan)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              {kpi.totalStudents} siswa ({jenjangFilter === 'ALL' ? 'SMP & SMA' : jenjangFilter})
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Kas Masuk Terkumpul
            </div>
            <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              {formatRupiah(kpi.totalTerbayar)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Kolektibilitas: <strong className="text-emerald-600">{kpi.pct}%</strong>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Total Sisa Tunggakan
            </div>
            <div className="text-xl font-black font-mono text-rose-700 dark:text-rose-400 mt-1">
              {formatRupiah(kpi.totalSisa)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Lunas penuh: <strong>{kpi.lunasCount}</strong> siswa
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0e1a]/80 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Kesiapan Kartu Ujian (&ge;{config.minPercentForExamCard}%)
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              <span className="text-emerald-600">{kpi.layakCount}</span>{' '}
              <span className="text-xs font-bold text-slate-400">/ {kpi.totalStudents} Layak</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Belum Layak: <strong className="text-rose-600">{kpi.belumLayakCount}</strong> • Dispensasi:{' '}
              <strong className="text-purple-600">{kpi.dispensasiCount}</strong>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-1.5 flex flex-wrap gap-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Bar Shared (Matriks & Surat) */}
        {(activeTab === 'MATRIKS' || activeTab === 'SURAT') && (
          <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa, NIS, atau kelas..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={jenjangFilter}
              onChange={(e) => {
                setJenjangFilter(e.target.value as 'ALL' | 'SMP' | 'SMA');
                setKelasFilter('ALL');
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
            >
              <option value="ALL">Semua Unit (SMP &amp; SMA)</option>
              <option value="SMP">Unit SMP</option>
              <option value="SMA">Unit SMA</option>
            </select>
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
            >
              <option value="ALL">Semua Kelas</option>
              {kelasList
                .filter((k) => jenjangFilter === 'ALL' || k.jenjang === jenjangFilter)
                .map((k) => (
                  <option key={k.id_kelas} value={k.id_kelas}>
                    {k.nama_kelas} ({k.jenjang})
                  </option>
                ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
            >
              <option value="ALL">Semua Status</option>
              <option value="LAYAK">Layak Kartu Ujian</option>
              <option value="BELUM_LAYAK">Belum Layak (&lt;{config.minPercentForExamCard}%)</option>
              <option value="LUNAS">Lunas 100%</option>
              <option value="DISPENSASI">Dispensasi</option>
            </select>
          </div>
        )}

        {/* TAB 1: MATRIKS SPP & KELAYAKAN */}
        {activeTab === 'MATRIKS' && (
          <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm">
            {bills.length === 0 && (
              <div className="p-5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {canEdit ? (
                    <>
                      Belum ada tagihan SPP yang dibuat untuk semester ini. Mulai dengan mengatur tarif fleksibel &amp; generate massal di tab <strong>3. Generate &amp; Aturan</strong>.
                    </>
                  ) : (
                    <>
                      Belum ada tagihan SPP yang dibuat untuk semester ini. Hubungi <strong>Bendahara Sekolah</strong> untuk mengatur tarif dan membuat tagihan bulanan.
                    </>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('PENGATURAN')}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
                  >
                    Mulai Generate Tagihan →
                  </button>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 text-center w-10">No</th>
                    <th className="py-3 px-3 min-w-[180px]">Siswa &amp; Kelas</th>
                    {semesterMonths.map((m) => (
                      <th key={m.periode} className="py-3 px-2 text-center min-w-[54px]">
                        {m.shortLabel}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-right">Terbayar / Sisa</th>
                    <th className="py-3 px-3 text-center min-w-[125px]">Status Kartu</th>
                    <th className="py-3 px-3 text-right min-w-[175px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={semesterMonths.length + 5} className="py-10 text-center text-slate-400 font-semibold">
                        Tidak ada siswa sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const sBills = billsByStudent.get(st.id_siswa) || [];
                      const el = eligibilityMap[st.id_siswa];
                      return (
                        <tr
                          key={st.id_siswa}
                          className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition"
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-extrabold text-slate-900 dark:text-white uppercase leading-tight">
                              {st.nama}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              {st.nama_kelas} ({st.jenjang}) • NIS {st.nis || '-'}
                            </div>
                          </td>
                          {semesterMonths.map((m) => {
                            const mb = sBills.find(
                              (b) => b.periode_bulan === m.periode && b.kategori === 'SPP'
                            );
                            if (!mb) {
                              return (
                                <td key={m.periode} className="py-2 px-1.5 text-center text-slate-300 dark:text-slate-700">
                                  —
                                </td>
                              );
                            }
                            const pillCls =
                              mb.status === 'LUNAS'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : mb.status === 'CICILAN'
                                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
                                : 'bg-rose-500/12 text-rose-700 dark:text-rose-400';
                            const label =
                              mb.status === 'LUNAS'
                                ? '✓'
                                : mb.status === 'CICILAN'
                                ? `${Math.round((mb.terbayar / Math.max(1, mb.nominal_akhir)) * 100)}%`
                                : '•';
                            return (
                              <td key={m.periode} className="py-2 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDetailStudent(st)}
                                  title={`${mb.nama_tagihan}: Terbayar ${formatRupiah(mb.terbayar)} / ${formatRupiah(mb.nominal_akhir)}`}
                                  className={`w-8 h-6 rounded-lg text-[10px] font-black ${pillCls} hover:opacity-80 cursor-pointer`}
                                >
                                  {label}
                                </button>
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right font-mono">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatRupiah(el?.totalTerbayar || 0)}
                            </div>
                            <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              Sisa: {formatRupiah(el?.sisaTunggakan || 0)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {renderClearanceBadge(el)}
                            {el && !el.eligibleForExamCard && el.minimalAgarLayak > 0 && (
                              <div className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                                Min. {formatRupiah(el.minimalAgarLayak)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {canInputKasir && (
                                <button
                                  type="button"
                                  onClick={() => openKasirForStudent(st)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                                >
                                  Bayar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDetailStudent(st)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[10px] font-bold hover:bg-slate-200 cursor-pointer"
                              >
                                Detail
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDispensasiStudent(st);
                                    setDispensasiAlasan(el?.dispensasi?.alasan || '');
                                    setDispensasiSampai(el?.dispensasi?.berlakuSampai || '');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold hover:bg-purple-500/25 cursor-pointer"
                                  title="Kelola Dispensasi Ujian"
                                >
                                  Disp.
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyWhatsApp(st)}
                                className="p-1.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 hover:bg-teal-500/25 cursor-pointer"
                                title="Salin Pesan WA Orang Tua"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: KASIR PEMBAYARAN & RIWAYAT KWITANSI */}
        {activeTab === 'KASIR' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Form Kasir Kiri (Khusus Kasir Loket SPP / Bendahara / Admin) */}
            {canInputKasir && (
              <div className="xl:col-span-5 bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600" /> Input Pembayaran Kasir
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {financeRoleLabel}
                  </span>
                </div>

              <form onSubmit={handleRecordPayment} className="space-y-3.5">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Cari &amp; Pilih Siswa (Ketik Nama / NIS / Kelas)
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={kasirSearch}
                      onChange={(e) => setKasirSearch(e.target.value)}
                      disabled={!canInputKasir}
                      placeholder="Ketik cepat nama siswa atau NIS..."
                      className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                    {kasirSearch && (
                      <button
                        type="button"
                        onClick={() => setKasirSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {kasirSearch.trim() && kasirFilteredStudents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {kasirFilteredStudents.slice(0, 6).map((s) => {
                        const el = eligibilityMap[s.id_siswa];
                        const isPicked = s.id_siswa === kasirStudentId;
                        return (
                          <button
                            key={s.id_siswa}
                            type="button"
                            onClick={() => {
                              setKasirStudentId(s.id_siswa);
                              setKasirSelectedBillIds([]);
                              if (el && !el.eligibleForExamCard && el.minimalAgarLayak > 0) {
                                setKasirAmount(String(el.minimalAgarLayak));
                              } else if (el && el.sisaTunggakan > 0) {
                                setKasirAmount(String(el.sisaTunggakan));
                              } else {
                                setKasirAmount('');
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              isPicked
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                            }`}
                          >
                            {s.nama} ({s.nama_kelas}) • Sisa {formatRupiah(el?.sisaTunggakan || 0)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <select
                    value={kasirStudentId}
                    onChange={(e) => {
                      setKasirStudentId(e.target.value);
                      setKasirSelectedBillIds([]);
                      setKasirAmount('');
                    }}
                    disabled={!canInputKasir}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="">-- Pilih Siswa ({kasirFilteredStudents.length}) --</option>
                    {kasirFilteredStudents.map((s) => {
                      const el = eligibilityMap[s.id_siswa];
                      return (
                        <option key={s.id_siswa} value={s.id_siswa}>
                          {s.nama} ({s.nama_kelas}) — Sisa {formatRupiah(el?.sisaTunggakan || 0)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {kasirStudent && (
                  <>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase">{kasirStudent.nama}</span>
                        {renderClearanceBadge(eligibilityMap[kasirStudent.id_siswa])}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <span>Tagihan: {formatRupiah(eligibilityMap[kasirStudent.id_siswa]?.totalTagihan || 0)}</span>
                        <span>Terbayar: {formatRupiah(eligibilityMap[kasirStudent.id_siswa]?.totalTerbayar || 0)}</span>
                        <span className="text-rose-600 font-black">
                          Sisa: {formatRupiah(eligibilityMap[kasirStudent.id_siswa]?.sisaTunggakan || 0)}
                        </span>
                      </div>

                      {/* Shortcut Nominal */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(eligibilityMap[kasirStudent.id_siswa]?.minimalAgarLayak || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setKasirAmount(
                                String(eligibilityMap[kasirStudent.id_siswa].minimalAgarLayak)
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-black cursor-pointer"
                          >
                            Syarat {config.minPercentForExamCard}%:{' '}
                            {formatRupiah(eligibilityMap[kasirStudent.id_siswa].minimalAgarLayak)}
                          </button>
                        )}
                        {kasirStudentBills[0] && (
                          <button
                            type="button"
                            onClick={() =>
                              setKasirAmount(
                                String(
                                  Math.max(
                                    0,
                                    kasirStudentBills[0].nominal_akhir - kasirStudentBills[0].terbayar
                                  )
                                )
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white text-[10px] font-bold cursor-pointer"
                          >
                            1 Bulan ({formatRupiah(kasirStudentBills[0].nominal_akhir - kasirStudentBills[0].terbayar)})
                          </button>
                        )}
                        {(eligibilityMap[kasirStudent.id_siswa]?.sisaTunggakan || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setKasirAmount(
                                String(eligibilityMap[kasirStudent.id_siswa].sisaTunggakan)
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black cursor-pointer"
                          >
                            Lunasi Semua ({formatRupiah(eligibilityMap[kasirStudent.id_siswa].sisaTunggakan)})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional Checklist Tagihan Spesifik */}
                    {kasirStudentBills.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Target Tagihan (Opsional — kosong = otomatis urut dari bulan terlama / FIFO)
                        </label>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {kasirStudentBills.map((b) => {
                            const due = Math.max(0, b.nominal_akhir - b.terbayar);
                            const checked = kasirSelectedBillIds.includes(b.id_tagihan);
                            return (
                              <label
                                key={b.id_tagihan}
                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-[11px] cursor-pointer"
                              >
                                <span className="flex items-center gap-2 font-bold">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setKasirSelectedBillIds((prev) =>
                                        e.target.checked
                                          ? [...prev, b.id_tagihan]
                                          : prev.filter((id) => id !== b.id_tagihan)
                                      );
                                    }}
                                  />
                                  {b.nama_tagihan}
                                </span>
                                <span className="font-mono font-black text-rose-600">
                                  Sisa {formatRupiah(due)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Nominal Bayar (Rp)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={kasirAmount}
                      onChange={(e) => setKasirAmount(e.target.value)}
                      disabled={!canInputKasir}
                      placeholder="Contoh: 250000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-black text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Tanggal Bayar
                    </label>
                    <input
                      type="date"
                      value={kasirDate}
                      onChange={(e) => setKasirDate(e.target.value)}
                      disabled={!canInputKasir}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Metode Bayar
                    </label>
                    <select
                      value={kasirMetode}
                      onChange={(e) => setKasirMetode(e.target.value as MetodePembayaran)}
                      disabled={!canInputKasir}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                    >
                      <option value="TUNAI">Tunai</option>
                      <option value="TRANSFER">Transfer Bank</option>
                      <option value="LAINNYA">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Catatan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={kasirCatatan}
                      onChange={(e) => setKasirCatatan(e.target.value)}
                      disabled={!canInputKasir}
                      placeholder="Mis. Titipan orang tua"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Preview Simulasi Alokasi FIFO & Proyeksi Status Kartu Ujian */}
                {kasirSimulation && (
                  <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 space-y-1.5 text-[11px]">
                    <div className="font-black text-indigo-950 dark:text-indigo-200 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Simulasi Alokasi Pembayaran
                      </span>
                      <span className="font-mono">{formatRupiah(kasirSimulation.totalAllocated)}</span>
                    </div>
                    <div className="space-y-0.5 text-[10.5px] text-indigo-900/85 dark:text-indigo-200/85">
                      {kasirSimulation.allocations.map((a) => (
                        <div key={a.tagihan.id_tagihan} className="flex justify-between gap-2">
                          <span className="truncate">
                            • {a.tagihan.nama_tagihan}{' '}
                            <strong
                              className={
                                a.newStatus === 'LUNAS' ? 'text-emerald-700 dark:text-emerald-400' : 'text-sky-700 dark:text-sky-300'
                              }
                            >
                              ({a.newStatus === 'LUNAS' ? 'LUNAS' : 'CICILAN'})
                            </strong>
                          </span>
                          <span className="font-mono font-bold shrink-0">
                            +{formatRupiah(a.allocatedAmount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1 border-t border-indigo-200/80 dark:border-indigo-500/20 flex items-center justify-between font-bold">
                      <span>Status Kartu Ujian setelah bayar:</span>
                      {renderClearanceBadge(kasirSimulation.projectedEl)}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !canInputKasir || !kasirStudentId}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  {busy ? 'Memproses...' : 'Simpan Pembayaran & Terbitkan Kwitansi'}
                </button>

                {lastKwitansiNo && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                      Kwitansi <strong>{lastKwitansiNo}</strong> siap dicetak!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const grp = allReceiptGroups.find((g) => g.noKwitansi === lastKwitansiNo);
                        if (grp) triggerPrint({ kind: 'KWITANSI', data: grp });
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Cetak
                    </button>
                  </div>
                )}
              </form>
            </div>
            )}

            {/* Riwayat Kwitansi Kanan (Full-width bila mode Lihat Saja) */}
            <div
              className={`${
                canInputKasir ? 'xl:col-span-7' : 'xl:col-span-12'
              } bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-3 shadow-sm`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-indigo-600" /> Riwayat Kwitansi ({receiptGroups.length})
                  </h3>
                  {!canInputKasir && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                      Mode Lihat Saja — Input pembayaran khusus Kasir Loket / Bendahara
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  placeholder="Cari kwitansi / siswa / kasir..."
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white w-60"
                />
              </div>

              <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.05]">
                {receiptGroups.length === 0 ? (
                  <p className="py-10 text-center text-xs text-slate-400 font-semibold">
                    Belum ada riwayat pembayaran tercatat.
                  </p>
                ) : (
                  receiptGroups.map((g) => (
                    <div
                      key={g.noKwitansi}
                      className={`py-3 flex flex-wrap items-center justify-between gap-3 ${
                        g.isVoid ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-400">
                            {g.noKwitansi}
                          </span>
                          <span className="text-xs font-extrabold uppercase text-slate-900 dark:text-white">
                            {g.student.nama}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {g.student.nama_kelas}
                          </span>
                          {g.isVoid && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400">
                              VOID / BATAL
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {formatDateIdShort(g.tanggalBayar)} • {g.metode} • Petugas: {g.namaPetugas || '-'} •{' '}
                          {g.items.map((i) => i.bill?.nama_tagihan || i.payment.id_tagihan).join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {g.isVoid ? (
                          <span className="font-mono text-sm font-black text-rose-500 line-through">
                            {formatRupiah(g.voidNominal || g.totalBayar)}
                          </span>
                        ) : (
                          <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                            {formatRupiah(g.totalBayar)}
                          </span>
                        )}
                        {!g.isVoid && (
                          <>
                            <button
                              type="button"
                              onClick={() => triggerPrint({ kind: 'KWITANSI', data: g })}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" /> Kwitansi
                            </button>
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidTargetKwitansi(g.noKwitansi);
                                  setVoidAlasan('');
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 cursor-pointer"
                                title="Batalkan (Void) Transaksi — Khusus Bendahara"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              canInputKasir && (
                                <span
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400"
                                  title="Pembatalan (VOID) transaksi hanya dapat dilakukan oleh Bendahara Sekolah"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GENERATE MASSAL, TAGIHAN KUSTOM & PENGATURAN (Khusus Bendahara / Admin) */}
        {activeTab === 'PENGATURAN' && canEdit && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Generate Tagihan Massal + Tambah 1 Tagihan */}
            <div className="xl:col-span-6 space-y-5">
              <form
                onSubmit={handleGenerateMassal}
                className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm"
              >
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> Generate Tagihan Massal (Anti-Duplikat)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Masukkan nominal fleksibel sesuai kebijakan sekolah. Siswa yang sudah memiliki tagihan di periode sama otomatis dilewati.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Target Siswa
                    </label>
                    <select
                      value={genScope}
                      onChange={(e) => setGenScope(e.target.value)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                    >
                      <option value="ALL">Semua Siswa (SMP &amp; SMA)</option>
                      <option value="SMP">Seluruh Unit SMP</option>
                      <option value="SMA">Seluruh Unit SMA</option>
                      {kelasList.map((k) => (
                        <option key={k.id_kelas} value={k.id_kelas}>
                          Hanya {k.nama_kelas} ({k.jenjang})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Kategori Tagihan
                    </label>
                    <select
                      value={genKategori}
                      onChange={(e) => setGenKategori(e.target.value as TagihanKategori)}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                    >
                      <option value="SPP">SPP Bulanan</option>
                      <option value="UJIAN">Biaya Ujian</option>
                      <option value="ASRAMA">Biaya Asrama</option>
                      <option value="LAINNYA">Biaya Lainnya</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Nominal Unit SMP (Rp / Bulan)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={genNominalSmp}
                      onChange={(e) => setGenNominalSmp(e.target.value)}
                      disabled={!canEdit}
                      placeholder="Masukkan tarif SMP"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Nominal Unit SMA (Rp / Bulan)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={genNominalSma}
                      onChange={(e) => setGenNominalSma(e.target.value)}
                      disabled={!canEdit}
                      placeholder="Masukkan tarif SMA"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">
                    Pilih Bulan Semester {academicSession.semester} ({academicSession.tahunAjaran})
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {semesterMonths.map((m) => {
                      const active = genPeriodes.includes(m.periode);
                      return (
                        <label
                          key={m.periode}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer ${
                            active
                              ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-400 text-indigo-800 dark:text-indigo-200'
                              : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            disabled={!canEdit}
                            onChange={(e) =>
                              setGenPeriodes((prev) =>
                                e.target.checked
                                  ? [...prev, m.periode]
                                  : prev.filter((p) => p !== m.periode)
                              )
                            }
                          />
                          {m.fullLabel}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {genKategori !== 'SPP' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Label Nama Tagihan Kustom (Opsional)
                    </label>
                    <input
                      type="text"
                      value={genCustomNama}
                      onChange={(e) => setGenCustomNama(e.target.value)}
                      disabled={!canEdit}
                      placeholder="Mis. Biaya Ujian SAS Ganjil 2026"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genSaveDefault}
                    disabled={!canEdit}
                    onChange={(e) => setGenSaveDefault(e.target.checked)}
                  />
                  Simpan nominal di atas sebagai tarif default SPP SMP &amp; SMA
                </label>

                <button
                  type="submit"
                  disabled={busy || !canEdit}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
                >
                  {busy ? 'Membuat Tagihan...' : 'Generate Tagihan Sekarang'}
                </button>
              </form>

              {/* Tagihan Kustom Per Siswa */}
              <form
                onSubmit={handleCreateSingleBill}
                className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-3 shadow-sm"
              >
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Tambah Tagihan Khusus (Per Siswa)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={singleStudentId}
                    onChange={(e) => setSingleStudentId(e.target.value)}
                    disabled={!canEdit}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((s) => (
                      <option key={s.id_siswa} value={s.id_siswa}>
                        {s.nama} ({s.nama_kelas})
                      </option>
                    ))}
                  </select>
                  <select
                    value={singleKategori}
                    onChange={(e) => setSingleKategori(e.target.value as TagihanKategori)}
                    disabled={!canEdit}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold"
                  >
                    <option value="SPP">SPP</option>
                    <option value="UJIAN">Biaya Ujian</option>
                    <option value="ASRAMA">Asrama</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={singleNama}
                    onChange={(e) => setSingleNama(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Nama Tagihan (mis. Uang Praktikum)"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    value={singlePeriode}
                    onChange={(e) => setSinglePeriode(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Periode (mis. 2026-11)"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={1}
                    value={singleNominal}
                    onChange={(e) => setSingleNominal(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Nominal (Rp)"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                  <input
                    type="number"
                    min={0}
                    value={singlePotongan}
                    onChange={(e) => setSinglePotongan(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Potongan (Rp)"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                  />
                  <input
                    type="text"
                    value={singleCatatan}
                    onChange={(e) => setSingleCatatan(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Catatan"
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !canEdit}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white/15 hover:opacity-90 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
                >
                  + Tambahkan Tagihan Individu
                </button>
              </form>
            </div>

            {/* Pengaturan Syarat Ujian & Identitas Bendahara Tunggal */}
            <div className="xl:col-span-6 bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" /> Aturan Kartu Ujian &amp; Profil Bendahara (1 Orang)
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Ambang Minimal Kartu Ujian (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.minPercentForExamCard}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        minPercentForExamCard: Math.max(
                          1,
                          Math.min(100, Number(e.target.value) || 50)
                        ),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-black"
                  />
                  <span className="text-[10px] text-slate-500">Default: 50% (lunas setengahnya).</span>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enforceOnKartuPeserta}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setConfig({ ...config, enforceOnKartuPeserta: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span className="text-[11px] font-bold text-emerald-950 dark:text-emerald-200 leading-snug">
                    Kunci cetak Kartu Peserta bagi siswa di bawah {config.minPercentForExamCard}% (kecuali ada Dispensasi)
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">
                  Bulan Syarat Ujian Saat Ini (Kosongkan = hitung seluruh tagihan semester aktif)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {semesterMonths.map((m) => {
                    const active = config.examRequiredPeriods.includes(m.periode);
                    return (
                      <label
                        key={m.periode}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                          active
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 text-emerald-800 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...config.examRequiredPeriods, m.periode]
                              : config.examRequiredPeriods.filter((p) => p !== m.periode);
                            setConfig({ ...config, examRequiredPeriods: next });
                          }}
                        />
                        {m.shortLabel} ({m.periode.slice(0, 4)})
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Identitas Bendahara Sekolah (Penandatangan Kwitansi, Surat &amp; Laporan)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Nama Lengkap Bendahara
                    </label>
                    <input
                      type="text"
                      value={config.bendaharaNama}
                      disabled={!canEdit}
                      onChange={(e) => setConfig({ ...config, bendaharaNama: e.target.value })}
                      placeholder="Contoh: Ibu Ester Wetipo, S.E"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Jabatan / NIP (Opsional)
                    </label>
                    <input
                      type="text"
                      value={config.bendaharaJabatan}
                      disabled={!canEdit}
                      onChange={(e) => setConfig({ ...config, bendaharaJabatan: e.target.value })}
                      placeholder="Bendahara Sekolah"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      NIP / NRG Bendahara (Opsional)
                    </label>
                    <input
                      type="text"
                      value={config.bendaharaNip}
                      disabled={!canEdit}
                      onChange={(e) => setConfig({ ...config, bendaharaNip: e.target.value })}
                      placeholder="-"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Tanda Tangan Digital Bendahara
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-white cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {config.bendaharaTtdUrl ? 'Ganti Gambar TTD' : 'Upload PNG/JPG TTD'}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!canEdit}
                          className="hidden"
                          onChange={(e) => handleUploadBendaharaTtd(e.target.files?.[0] || null)}
                        />
                      </label>
                      {config.bendaharaTtdUrl && (
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, bendaharaTtdUrl: '' })}
                          title="Hapus Tanda Tangan"
                          className="p-2 rounded-xl bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {config.bendaharaTtdUrl && (
                      <div className="mt-2 p-2 rounded-xl bg-white border border-slate-200 inline-flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={config.bendaharaTtdUrl}
                          alt="Preview TTD Bendahara"
                          className="h-9 max-w-[140px] object-contain"
                        />
                        <span className="text-[10px] font-bold text-emerald-700">TTD Aktif</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Informasi Rekening Sekolah (Tampil di Surat Tagihan &amp; Pesan WA)
                  </label>
                  <textarea
                    rows={2}
                    value={config.rekeningInfo}
                    disabled={!canEdit}
                    onChange={(e) => setConfig({ ...config, rekeningInfo: e.target.value })}
                    placeholder="Contoh: Bank Papua / BRI No. Rek 1234-5678 a.n. WMVAA Sogokmo"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  />
                </div>

                <button
                  type="button"
                  disabled={busy || !canEdit}
                  onClick={handleSaveConfig}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {busy ? 'Menyimpan...' : 'Simpan Pengaturan Keuangan & Bendahara'}
                </button>

                {/* Matriks Pembagian Jabatan Bendahara vs Kasir */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-slate-900 dark:text-white">
                      Pembagian Jabatan: Bendahara vs Kasir Loket
                    </span>
                    {isAdminUser && (
                      <Link
                        href="/dashboard/settings"
                        className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Kelola Hak Akses →
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/20">
                      <div className="font-black text-emerald-800 dark:text-emerald-300">
                        Bendahara Sekolah (Full)
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                        Atur tarif &amp; syarat ujian, generate/edit/hapus tagihan, beasiswa, dispensasi kartu ujian, VOID transaksi, terima kas, &amp; laporan resmi.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/20">
                      <div className="font-black text-sky-800 dark:text-sky-300">
                        Kasir Loket SPP (Terbatas)
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                        Terima pembayaran siswa di loket, terbitkan &amp; cetak kwitansi, kirim surat/WA, &amp; rekap kas. Tidak bisa ubah tarif, dispensasi, atau VOID.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SURAT TAGIHAN & PENGINGAT WHATSAPP */}
        {activeTab === 'SURAT' && (
          <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" /> Surat Pemberitahuan Tagihan &amp; Pengingat WA ({siswaMenunggak.length} Siswa Menunggak)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Cetak surat resmi 2 surat per kertas A4 atau salin teks WhatsApp sopan untuk orang tua.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const belumIds = siswaMenunggak
                      .filter((s) => !eligibilityMap[s.id_siswa]?.eligibleForExamCard)
                      .map((s) => s.id_siswa);
                    setSuratSelectedIds(new Set(belumIds));
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 text-xs font-black cursor-pointer"
                >
                  Pilih Semua Belum Layak
                </button>
                <button
                  type="button"
                  onClick={() => setSuratSelectedIds(new Set(siswaMenunggak.map((s) => s.id_siswa)))}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-bold cursor-pointer"
                >
                  Pilih Semua ({siswaMenunggak.length})
                </button>
                <button
                  type="button"
                  onClick={handlePrintSuratMassal}
                  disabled={suratSelectedIds.size === 0}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Surat ({suratSelectedIds.size})
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/[0.05] max-h-[500px] overflow-y-auto">
              {siswaMenunggak.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-400 font-semibold">
                  Semua siswa pada filter ini sudah melunasi tagihannya!
                </p>
              ) : (
                siswaMenunggak.map((st) => {
                  const el = eligibilityMap[st.id_siswa];
                  const checked = suratSelectedIds.has(st.id_siswa);
                  return (
                    <div key={st.id_siswa} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(suratSelectedIds);
                            if (e.target.checked) next.add(st.id_siswa);
                            else next.delete(st.id_siswa);
                            setSuratSelectedIds(next);
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                            {st.nama} {renderClearanceBadge(el)}
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold">
                            {st.nama_kelas} ({st.jenjang}) • Sisa{' '}
                            <strong className="text-rose-600 font-mono">
                              {formatRupiah(el?.sisaTunggakan || 0)}
                            </strong>
                            {!el?.eligibleForExamCard && el?.minimalAgarLayak > 0 && (
                              <span>
                                {' '}
                                • Min. bayar syarat kartu:{' '}
                                <strong className="text-amber-700 font-mono">
                                  {formatRupiah(el.minimalAgarLayak)}
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyWhatsApp(st)}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" /> Salin WA
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            triggerPrint({
                              kind: 'SURAT',
                              items: [
                                {
                                  student: st,
                                  eligibility: el,
                                  unpaidBills: (billsByStudent.get(st.id_siswa) || [])
                                    .filter((b) => b.nominal_akhir > b.terbayar)
                                    .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan)),
                                },
                              ],
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white/15 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" /> Surat
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 5: REKAP & LAPORAN KEUANGAN */}
        {activeTab === 'LAPORAN' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0a0e1a]/85 border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 flex flex-wrap items-end justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Jenis Laporan
                  </label>
                  <select
                    value={laporanMode}
                    onChange={(e) => setLaporanMode(e.target.value as LaporanKeuanganMode)}
                    className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="REKAP_KELAS">Rekapitulasi Tagihan &amp; Tunggakan per Kelas</option>
                    <option value="KAS_MASUK">Laporan Pemasukan Kas Harian / Periode</option>
                    <option value="KESIAPAN_UJIAN">Laporan Kesiapan Administrasi Kartu Ujian</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Unit
                  </label>
                  <select
                    value={jenjangFilter}
                    onChange={(e) => setJenjangFilter(e.target.value as 'ALL' | 'SMP' | 'SMA')}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="ALL">SMP &amp; SMA</option>
                    <option value="SMP">Hanya SMP</option>
                    <option value="SMA">Hanya SMA</option>
                  </select>
                </div>
                {laporanMode === 'KAS_MASUK' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Dari Tanggal
                      </label>
                      <input
                        type="date"
                        value={laporanDateFrom}
                        onChange={(e) => setLaporanDateFrom(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                        Sampai Tanggal
                      </label>
                      <input
                        type="date"
                        value={laporanDateTo}
                        onChange={(e) => setLaporanDateTo(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white dark:[color-scheme:dark]"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Export Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => triggerPrint({ kind: 'LAPORAN', mode: laporanMode })}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak PDF A4 Resmi
                </button>
              </div>
            </div>

            {/* Pratinjau Langsung Laporan A4 */}
            <div className="bg-slate-200/70 dark:bg-black/40 rounded-3xl p-4 overflow-x-auto">
              <div className="min-w-[820px]">
                <LaporanKeuanganSheet
                  mode={laporanMode}
                  dateFrom={laporanDateFrom}
                  dateTo={laporanDateTo}
                  jenjangFilter={jenjangFilter}
                  students={students}
                  kelasList={kelasList}
                  bills={bills}
                  payments={payments}
                  eligibilityMap={eligibilityMap}
                  config={config}
                  settings={settings}
                  academicSession={academicSession}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETAIL TAGIHAN & POTONGAN / BEASISWA PER SISWA */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl max-w-2xl w-full p-5 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-black uppercase text-slate-900 dark:text-white">
                  {detailStudent.nama}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {detailStudent.nama_kelas} ({detailStudent.jenjang}) • NIS {detailStudent.nis || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailStudent(null);
                  setEditingBill(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {(billsByStudent.get(detailStudent.id_siswa) || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  Belum ada tagihan pada semester ini.
                </p>
              ) : (
                (billsByStudent.get(detailStudent.id_siswa) || [])
                  .sort((a, b) => a.periode_bulan.localeCompare(b.periode_bulan))
                  .map((b) => (
                    <div
                      key={b.id_tagihan}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-black text-slate-900 dark:text-white">
                          {b.nama_tagihan}{' '}
                          <span className="text-[10px] font-bold text-slate-400">({b.kategori})</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                          Tarif {formatRupiah(b.nominal)}
                          {b.potongan > 0 && (
                            <span className="text-indigo-600"> − Potongan {formatRupiah(b.potongan)}</span>
                          )}{' '}
                          = <strong>{formatRupiah(b.nominal_akhir)}</strong> • Terbayar{' '}
                          <strong className="text-emerald-600">{formatRupiah(b.terbayar)}</strong>
                        </div>
                        {b.catatan && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">{b.catatan}</div>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBill(b);
                              setEditNominal(String(b.nominal));
                              setEditPotongan(String(b.potongan));
                              setEditCatatan(b.catatan);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black cursor-pointer"
                          >
                            Edit / Beasiswa
                          </button>
                          {b.terbayar === 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBill(b.id_tagihan)}
                              className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 cursor-pointer"
                              title="Hapus Tagihan Belum Dibayar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>

            {editingBill && (
              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 space-y-3">
                <div className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                  Edit Nominal / Beasiswa: {editingBill.nama_tagihan}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Nominal Dasar (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editNominal}
                      onChange={(e) => setEditNominal(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Potongan / Beasiswa (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editPotongan}
                      onChange={(e) => setEditPotongan(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Catatan potongan / beasiswa (mis. Beasiswa Yayasan 50%)"
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-semibold"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingBill(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUpdateBill}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DISPENSASI KARTU UJIAN */}
      {dispensasiStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Dispensasi Kartu Ujian
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {dispensasiStudent.nama} • {dispensasiStudent.nama_kelas}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDispensasiStudent(null)}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Alasan / Dasar Izin Dispensasi
                </label>
                <textarea
                  rows={2}
                  value={dispensasiAlasan}
                  onChange={(e) => setDispensasiAlasan(e.target.value)}
                  placeholder="Contoh: Surat perjanjian orang tua disetujui Kepala Sekolah, lunas 5 Des."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Janji Bayar / Berlaku Sampai (Opsional)
                </label>
                <input
                  type="date"
                  value={dispensasiSampai}
                  onChange={(e) => setDispensasiSampai(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {eligibilityMap[dispensasiStudent.id_siswa]?.dispensasi ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveDispensasi(false)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 text-rose-700 text-xs font-black cursor-pointer"
                >
                  Cabut Dispensasi
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDispensasiStudent(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveDispensasi(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black cursor-pointer"
                >
                  Aktifkan Dispensasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VOID / BATAL TRANSAKSI */}
      {voidTargetKwitansi && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-rose-600">
              Batalkan (VOID) Kwitansi {voidTargetKwitansi}?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Transaksi tidak akan dihapus permanen melainkan ditandai <strong>BATAL</strong> di audit kas, dan saldo tagihan siswa otomatis dikembalikan.
            </p>
            <input
              type="text"
              value={voidAlasan}
              onChange={(e) => setVoidAlasan(e.target.value)}
              placeholder="Wajib isi alasan pembatalan (mis. salah nominal input)"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs font-semibold"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidTargetKwitansi(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmVoid}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
              >
                Konfirmasi VOID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROOT CETAK TERISOLASI */}
      {printPayload && (
        <div id="tagihan-print-root" className="hidden print:block bg-white">
          {printPayload.kind === 'KWITANSI' && (
            <KwitansiPrintSheet
              kwitansi={printPayload.data}
              config={config}
              settings={settings}
              academicSession={academicSession}
            />
          )}
          {printPayload.kind === 'SURAT' && (
            <SuratTagihanSheet
              items={printPayload.items}
              config={config}
              settings={settings}
              academicSession={academicSession}
            />
          )}
          {printPayload.kind === 'LAPORAN' && (
            <LaporanKeuanganSheet
              mode={printPayload.mode}
              dateFrom={laporanDateFrom}
              dateTo={laporanDateTo}
              jenjangFilter={jenjangFilter}
              students={students}
              kelasList={kelasList}
              bills={bills}
              payments={payments}
              eligibilityMap={eligibilityMap}
              config={config}
              settings={settings}
              academicSession={academicSession}
            />
          )}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4 portrait; margin: 6mm; }
              body { background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .tagihan-print-page { page-break-after: always; break-after: page; }
              .tagihan-print-page:last-child { page-break-after: auto; break-after: auto; }
            }
          `,
        }}
      />
    </>
  );
}
